/**
 * Runtime tests for the AssemblyScript special functions (orthogonal
 * polynomials, integral functions) and number-theory functions.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('special/number-theory test: WASM not found. Run asbuild.');
  process.exit(1);
}

const { exports } = loader.instantiateSync(readFileSync(wasmPath), {
  env: {
    abort: (_m, _f, line, col) => {
      throw new Error(`AS abort at ${line}:${col}`);
    },
    trace: () => {},
    seed: () => Date.now(),
  },
});

/** Build an AS Float64Array (reuse matrix_zeros + a live view). */
function makeArray(data) {
  const ptr = exports.matrix_zeros(1, data.length);
  exports.__pin(ptr);
  exports.__getArrayView(ptr).set(data);
  return ptr;
}
const readArr = (ptr) => Array.from(exports.__getFloat64Array(ptr));

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.log(`✗ ${name} ${detail ?? ''}`);
  }
}
const near = (a, b, tol) => Math.abs(a - b) < (tol ?? 1e-9);
const arrEq = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

console.log('AssemblyScript special functions\n================================');
check('chebyshevT(2, 0.5) = -0.5', near(exports.chebyshevT(2, 0.5), -0.5));
check('hermiteH(3, 0.5) = -5', near(exports.hermiteH(3, 0.5), -5));
check('laguerreL(2, 1) = -0.5', near(exports.laguerreL(2, 1), -0.5));
check('legendreP(2, 0.5) = -0.125', near(exports.legendreP(2, 0.5), -0.125));

// Batch I2 (#1332, D4): a value that leaves the double range is the signed Infinity of the
// leading term, never NaN. The oracle is mpmath 1.3.0 (exact doubles); the sign of H_n and L_n
// oscillates with n, so hermiteH and laguerreL run on a rescaled recurrence.
const rel = (got, want) => Math.abs((got - want) / want);
check('legendreP(1000, 1.5) = +Infinity', exports.legendreP(1000, 1.5) === Infinity);
check('legendreP(1001, -1.5) = -Infinity', exports.legendreP(1001, -1.5) === -Infinity);
check('legendreP(741, 1.5) is finite (false overflow of the numerator)', rel(exports.legendreP(741, 1.5), 1.175968637766774e+308) < 1e-12);
check('legendreP(5, Infinity) = +Infinity, legendreP(5, NaN) is NaN', exports.legendreP(5, Infinity) === Infinity && Number.isNaN(exports.legendreP(5, NaN)));
check('chebyshevT(1000, 1.5) = +Infinity', exports.chebyshevT(1000, 1.5) === Infinity);
check('chebyshevT(5028, 1.01) is finite (false overflow of the product)', rel(exports.chebyshevT(5028, 1.01), 1.796781755589011e+308) < 1e-12);
check('hermiteH(1000, 1.5) = -Infinity, hermiteH(1001, 1.5) = -Infinity', exports.hermiteH(1000, 1.5) === -Infinity && exports.hermiteH(1001, 1.5) === -Infinity);
check('hermiteH(300, 10) = +Infinity, hermiteH(301, -10) = +Infinity', exports.hermiteH(300, 10) === Infinity && exports.hermiteH(301, -10) === Infinity);
check('hermiteH(150, 10) is unchanged', rel(exports.hermiteH(150, 10), -1.3205101243688398e175) < 1e-12);
check('hermiteH(1001, 0) is exactly 0 and hermiteH(1000, 0) = +Infinity', exports.hermiteH(1001, 0) === 0 && exports.hermiteH(1000, 0) === Infinity);
check('hermiteH(5, -1e200) = -Infinity, hermiteH(4, -1e200) = +Infinity', exports.hermiteH(5, -1e200) === -Infinity && exports.hermiteH(4, -1e200) === Infinity);
check('hermiteH(3, NaN) is NaN', Number.isNaN(exports.hermiteH(3, NaN)));
check('laguerreL(1000, -1000) = +Infinity, laguerreL(2000, 3000) = +Infinity', exports.laguerreL(1000, -1000) === Infinity && exports.laguerreL(2000, 3000) === Infinity);
check('laguerreL(1001, 3000) = -Infinity', exports.laguerreL(1001, 3000) === -Infinity);
check('laguerreL(801, 1419) is finite (false overflow of the numerator)', rel(exports.laguerreL(801, 1419), -7.551637020847091e+305) < 1e-12);
check('laguerreL(300, 1000) is unchanged', rel(exports.laguerreL(300, 1000), -5.268176709875155e+215) < 1e-12);
check('laguerreL(5, 1e200) = -Infinity, laguerreL(4, 1e200) = +Infinity', exports.laguerreL(5, 1e200) === -Infinity && exports.laguerreL(4, 1e200) === Infinity);

// D1: sin(pi x) next to a nonzero integer. lgamma_f64 reduces x exactly (mpmath: -1.0000001).
{
  const ptr = makeArray([-1.0000001, -1.5, 0.25]);
  const out = readArr(exports.lgamma_f64(ptr));
  check('lgamma_f64(-1.0000001) = 16.11809560809603 (was 1.5e-10 off)', Math.abs(out[0] - 16.11809560809603) < 1e-13);
  check('lgamma_f64(-1.5) = log(4 sqrt(pi) / 3)', Math.abs(out[1] - Math.log((4 * Math.sqrt(Math.PI)) / 3)) < 1e-13);
  check('lgamma_f64(0.25) is unchanged', Math.abs(out[2] - 1.2880225246980774) < 1e-13);
}
check('erfi(1)', near(exports.erfi(1), 1.650425758797542));
check('expIntegralEi(1)', near(exports.expIntegralEi(1), 1.8951178163559368));
check('sinIntegral(1)', near(exports.sinIntegral(1), 0.946083070367183));
check('cosIntegral(1)', near(exports.cosIntegral(1), 0.3374039229009681));
check('logIntegral(2)', near(exports.logIntegral(2), 1.0451637801174927, 1e-8));

console.log('\nAssemblyScript number theory\n============================');
check('eulerPhi(12) = 4', exports.eulerPhi(12) === 4);
check('divisorSigma(6, 1) = 12', exports.divisorSigma(6, 1) === 12);
check('moebiusMu(30) = -1', exports.moebiusMu(30) === -1);
check('carmichaelLambda(15) = 4', exports.carmichaelLambda(15) === 4);
check('jacobiSymbol(2, 15) = 1', exports.jacobiSymbol(2, 15) === 1);
check('harmonicNumber(4)', near(exports.harmonicNumber(4), 2.083333333333333));
check('partitions(10) = 42', exports.partitions(10) === 42);

check(
  'primeFactors(360) = [2,2,2,3,3,5]',
  arrEq(readArr(exports.primeFactors(360)), [2, 2, 2, 3, 3, 5])
);
check('divisors(12) = [1,2,3,4,6,12]', arrEq(readArr(exports.divisors(12)), [1, 2, 3, 4, 6, 12]));
check('integerDigits(255, 16) = [15,15]', arrEq(readArr(exports.integerDigits(255, 16)), [15, 15]));

{
  const rem = makeArray([2, 3, 2]);
  const mods = makeArray([3, 5, 7]);
  check('chineseRemainder([2,3,2],[3,5,7]) = 23', exports.chineseRemainder(rem, mods) === 23);
  exports.__unpin(rem);
  exports.__unpin(mods);
}

console.log('\n============================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
