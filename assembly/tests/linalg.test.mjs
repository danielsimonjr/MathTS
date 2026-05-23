/**
 * Runtime tests for the AssemblyScript extra linear-algebra kernels.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('linalg test: WASM not found. Run asbuild.');
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
const arrEq = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

console.log('AssemblyScript extra linear algebra\n===================================');

function rref(a, m, n) {
  const p = makeArray(a);
  const r = exports.rowReduce(p, m, n, 1e-10);
  const out = readArr(r);
  exports.__unpin(p);
  return out;
}
check(
  'rowReduce([[1,2,3],[4,5,6],[7,8,9]])',
  arrEq(rref([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3), [1, 0, -1, 0, 1, 2, 0, 0, 0])
);
check('rowReduce([[2,4],[1,1]]) = I', arrEq(rref([2, 4, 1, 1], 2, 2), [1, 0, 0, 1]));

function charpoly(a, n) {
  const p = makeArray(a);
  const r = exports.characteristicPolynomial(p, n);
  const out = readArr(r);
  exports.__unpin(p);
  return out;
}
check(
  'characteristicPolynomial(diag(2,3)) = [6,-5,1]',
  arrEq(charpoly([2, 0, 0, 3], 2), [6, -5, 1])
);
check(
  'characteristicPolynomial([[0,1],[-2,-3]]) = [2,3,1]',
  arrEq(charpoly([0, 1, -2, -3], 2), [2, 3, 1])
);
check(
  'characteristicPolynomial(I_3) = [-1,3,-3,1]',
  arrEq(charpoly([1, 0, 0, 0, 1, 0, 0, 0, 1], 3), [-1, 3, -3, 1])
);

console.log('\n===================================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
