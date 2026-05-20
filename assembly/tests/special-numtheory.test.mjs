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
const arrEq = (a, b) =>
  a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

console.log('AssemblyScript special functions\n================================');
check('chebyshevT(2, 0.5) = -0.5', near(exports.chebyshevT(2, 0.5), -0.5));
check('hermiteH(3, 0.5) = -5', near(exports.hermiteH(3, 0.5), -5));
check('laguerreL(2, 1) = -0.5', near(exports.laguerreL(2, 1), -0.5));
check('legendreP(2, 0.5) = -0.125', near(exports.legendreP(2, 0.5), -0.125));
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
check(
  'divisors(12) = [1,2,3,4,6,12]',
  arrEq(readArr(exports.divisors(12)), [1, 2, 3, 4, 6, 12])
);
check(
  'integerDigits(255, 16) = [15,15]',
  arrEq(readArr(exports.integerDigits(255, 16)), [15, 15])
);

{
  const rem = makeArray([2, 3, 2]);
  const mods = makeArray([3, 5, 7]);
  check(
    'chineseRemainder([2,3,2],[3,5,7]) = 23',
    exports.chineseRemainder(rem, mods) === 23
  );
  exports.__unpin(rem);
  exports.__unpin(mods);
}

console.log('\n============================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
