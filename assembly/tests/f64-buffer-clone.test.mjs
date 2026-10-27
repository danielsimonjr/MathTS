/**
 * Oracle pins for Sprint 2R assembly clone-merge G0–G5 (f64-buffer helpers).
 * Independent expectations — not round-tripped through duplicate export bodies.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('f64-buffer-clone: WASM not found. Run asbuild.');
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

const arrEq = (a, b, tol = 1e-12) =>
  a.length === b.length &&
  a.every((v, i) => {
    const e = b[i];
    if (Object.is(v, e)) return true;
    return Math.abs(v - e) < tol;
  });

function runBinary(fn, a, b) {
  const aPtr = makeArray(a);
  const bPtr = makeArray(b);
  const rPtr = makeArray(new Array(a.length).fill(0));
  exports[fn](aPtr, bPtr, rPtr);
  return readArr(rPtr);
}

console.log('f64-buffer clone oracles (G0–G5)\n================================');

// G0 min
for (const fn of ['array_min', 'matrix_min']) {
  check(`${fn} [2,1,3] -> 1`, exports[fn](makeArray([2, 1, 3])) === 1);
  check(`${fn} empty -> NaN`, Number.isNaN(exports[fn](makeArray([]))));
}

// G1 max
for (const fn of ['array_max', 'matrix_max']) {
  check(`${fn} [2,1,3] -> 3`, exports[fn](makeArray([2, 1, 3])) === 3);
  check(`${fn} empty -> NaN`, Number.isNaN(exports[fn](makeArray([]))));
}

// G2 add
const addExpected = [4, 6];
for (const fn of ['array_add', 'matrix_add']) {
  check(`${fn} [1,2]+[3,4]`, arrEq(runBinary(fn, [1, 2], [3, 4]), addExpected));
}
check(
  'complex_array_add length-4 interleaved',
  arrEq(runBinary('complex_array_add', [1, 2, 3, 4], [5, 6, 7, 8]), [6, 8, 10, 12])
);

// G3 sub
const subExpected = [3, -2];
for (const fn of ['array_sub', 'matrix_sub', 'complex_array_sub']) {
  check(`${fn} [5,1]-[2,3]`, arrEq(runBinary(fn, [5, 1], [2, 3]), subExpected));
}

// G4 mul
const mulExpected = [8, 15];
for (const fn of ['array_mul', 'matrix_mul_elementwise']) {
  check(`${fn} [2,3]*[4,5]`, arrEq(runBinary(fn, [2, 3], [4, 5]), mulExpected));
}

// G5 div
const divExpected = [4, 3];
for (const fn of ['array_div', 'matrix_div_elementwise']) {
  check(`${fn} [8,9]/[2,3]`, arrEq(runBinary(fn, [8, 9], [2, 3]), divExpected));
  check(`${fn} /0 -> Infinity`, arrEq(runBinary(fn, [1, 1], [0, 2]), [Infinity, 0.5]));
}

console.log('\n================================');
console.log(`Tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
