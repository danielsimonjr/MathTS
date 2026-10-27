/**
 * Oracle pins for Sprint 2R assembly clone-merge G0–G5 (f64-buffer helpers).
 * Independent expectations — not round-tripped through duplicate export bodies.
 *
 * Length for complex_array_add/sub is the Float64Array element count (interleaved
 * re/im), not the number of complex values. The shared helper does not double it.
 * min/max use `<` / `>` (NaN never wins after a finite start; a leading NaN stays).
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

function runBinary(fn, a, b, resultLen = a.length) {
  const aPtr = makeArray(a);
  const bPtr = makeArray(b);
  const rPtr = makeArray(new Array(resultLen).fill(0));
  exports[fn](aPtr, bPtr, rPtr);
  return readArr(rPtr);
}

console.log('f64-buffer clone oracles (G0–G5)\n================================');

check('f64Min not a wasm export', typeof exports.f64Min !== 'function');
check('f64Max not a wasm export', typeof exports.f64Max !== 'function');
check('f64Add not a wasm export', typeof exports.f64Add !== 'function');
check('f64Sub not a wasm export', typeof exports.f64Sub !== 'function');
check('f64Mul not a wasm export', typeof exports.f64Mul !== 'function');
check('f64Div not a wasm export', typeof exports.f64Div !== 'function');

// G0 min — empty → NaN; `<` so a later NaN is ignored, a leading NaN stays
for (const fn of ['array_min', 'matrix_min']) {
  check(`${fn} [2,1,3] -> 1`, exports[fn](makeArray([2, 1, 3])) === 1);
  check(`${fn} empty -> NaN`, Number.isNaN(exports[fn](makeArray([]))));
  check(`${fn} [NaN] -> NaN`, Number.isNaN(exports[fn](makeArray([NaN]))));
  check(`${fn} [NaN, 2, 1] -> NaN`, Number.isNaN(exports[fn](makeArray([NaN, 2, 1]))));
  check(`${fn} [2, NaN, 1] -> 1`, exports[fn](makeArray([2, NaN, 1])) === 1);
}

// G1 max — `>` so a later NaN is ignored, a leading NaN stays
for (const fn of ['array_max', 'matrix_max']) {
  check(`${fn} [2,1,3] -> 3`, exports[fn](makeArray([2, 1, 3])) === 3);
  check(`${fn} empty -> NaN`, Number.isNaN(exports[fn](makeArray([]))));
  check(`${fn} [NaN] -> NaN`, Number.isNaN(exports[fn](makeArray([NaN]))));
  check(`${fn} [NaN, 2, 1] -> NaN`, Number.isNaN(exports[fn](makeArray([NaN, 2, 1]))));
  check(`${fn} [2, NaN, 1] -> 2`, exports[fn](makeArray([2, NaN, 1])) === 2);
}

// G2 add — length is f64 elements (complex pair is interleaved, not 2×)
const addExpected = [4, 6];
const addComplex4 = [6, 8, 10, 12];
for (const fn of ['array_add', 'matrix_add', 'complex_array_add']) {
  check(`${fn} [1,2]+[3,4] -> [4,6]`, arrEq(runBinary(fn, [1, 2], [3, 4]), addExpected));
  check(
    `${fn} length-4 interleaved [1,2,3,4]+[5,6,7,8] -> [6,8,10,12]`,
    arrEq(runBinary(fn, [1, 2, 3, 4], [5, 6, 7, 8]), addComplex4)
  );
  check(`${fn} empty -> []`, arrEq(runBinary(fn, [], []), []));
}
check(
  'complex_array_add odd-length elements (not complex-count)',
  arrEq(runBinary('complex_array_add', [1, 2, 3], [4, 5, 6]), [5, 7, 9])
);
check(
  'array_add min-length [1,2,3]+[4,5] result len 3 -> [5,7,0]',
  arrEq(runBinary('array_add', [1, 2, 3], [4, 5], 3), [5, 7, 0])
);

// G3 sub
const subExpected = [3, -2];
const subComplex4 = [-4, -4, -4, -4];
for (const fn of ['array_sub', 'matrix_sub', 'complex_array_sub']) {
  check(`${fn} [5,1]-[2,3] -> [3,-2]`, arrEq(runBinary(fn, [5, 1], [2, 3]), subExpected));
  check(
    `${fn} length-4 interleaved [1,2,3,4]-[5,6,7,8] -> [-4,-4,-4,-4]`,
    arrEq(runBinary(fn, [1, 2, 3, 4], [5, 6, 7, 8]), subComplex4)
  );
  check(`${fn} empty -> []`, arrEq(runBinary(fn, [], []), []));
}

// G4 mul
const mulExpected = [8, 15];
for (const fn of ['array_mul', 'matrix_mul_elementwise']) {
  check(`${fn} [2,3]*[4,5] -> [8,15]`, arrEq(runBinary(fn, [2, 3], [4, 5]), mulExpected));
  check(`${fn} empty -> []`, arrEq(runBinary(fn, [], []), []));
}

// G5 div — IEEE: 1/0 = Infinity, -1/0 = -Infinity, 0/0 = NaN
const divExpected = [4, 3];
for (const fn of ['array_div', 'matrix_div_elementwise']) {
  check(`${fn} [8,9]/[2,3] -> [4,3]`, arrEq(runBinary(fn, [8, 9], [2, 3]), divExpected));
  check(`${fn} 1/0 -> Infinity`, arrEq(runBinary(fn, [1, 1], [0, 2]), [Infinity, 0.5]));
  check(
    `${fn} [-1,0]/[0,0] -> [-Infinity, NaN]`,
    arrEq(runBinary(fn, [-1, 0], [0, 0]), [-Infinity, NaN])
  );
  check(`${fn} empty -> []`, arrEq(runBinary(fn, [], []), []));
}

console.log('\n================================');
console.log(`Tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
