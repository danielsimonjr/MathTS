/**
 * Runtime tests for the AssemblyScript polynomial algebra functions.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('polynomial test: WASM not found. Run asbuild.');
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
const arrEq = (a, b) =>
  a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

console.log('AssemblyScript polynomial algebra\n=================================');

function poly2(fn, a, b) {
  const pa = makeArray(a);
  const pb = makeArray(b);
  const r = exports[fn](pa, pb);
  const out = readArr(r);
  exports.__unpin(pa);
  exports.__unpin(pb);
  return out;
}

check('polyadd([1,2],[3,4,5])', arrEq(poly2('polyadd', [1, 2], [3, 4, 5]), [4, 6, 5]));
check(
  'polynomialQuotient((x^2-1)/(x-1))',
  arrEq(poly2('polynomialQuotient', [-1, 0, 1], [-1, 1]), [1, 1])
);
check(
  'polynomialRemainder((x^2-1)/(x-1))',
  arrEq(poly2('polynomialRemainder', [-1, 0, 1], [-1, 1]), [0])
);
check(
  'polynomialRemainder((x^2+1)/(x-1))',
  arrEq(poly2('polynomialRemainder', [1, 0, 1], [-1, 1]), [2])
);
check(
  'polynomialGCD(x^2-1, x-1)',
  arrEq(poly2('polynomialGCD', [-1, 0, 1], [-1, 1]), [-1, 1])
);
check(
  'polynomialLCM(x-1, x-2)',
  arrEq(poly2('polynomialLCM', [-1, 1], [-2, 1]), [2, -3, 1])
);

function disc(coeffs) {
  const p = makeArray(coeffs);
  const v = exports.discriminant(p);
  exports.__unpin(p);
  return v;
}
check('discriminant(x^2-4) = 16', Math.abs(disc([-4, 0, 1]) - 16) < 1e-9);
check('discriminant(x^2-3x+2) = 1', Math.abs(disc([2, -3, 1]) - 1) < 1e-9);
check('discriminant(x^3-1) = -27', Math.abs(disc([-1, 0, 0, 1]) + 27) < 1e-7);

function res(p, q) {
  const pp = makeArray(p);
  const pq = makeArray(q);
  const v = exports.resultant(pp, pq);
  exports.__unpin(pp);
  exports.__unpin(pq);
  return v;
}
check('resultant(x^2-1, x-1) = 0', Math.abs(res([-1, 0, 1], [-1, 1])) < 1e-9);
check('resultant(x-2, x-3) = -1', Math.abs(res([-2, 1], [-3, 1]) + 1) < 1e-9);

console.log('\n=================================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
