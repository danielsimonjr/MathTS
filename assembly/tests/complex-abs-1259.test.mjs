/** |z| of the AS complex kernels follows the IEEE hypot rule and does not overflow (#1259). Oracle: Math.hypot. */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('complex-abs-1259: WASM not found. Run asbuild.');
  process.exit(1);
}
const { exports } = loader.instantiateSync(readFileSync(wasmPath), {
  env: {
    abort: (_m, _f, l, c) => {
      throw new Error(`AS abort at ${l}:${c}`);
    },
    trace: () => {},
    seed: () => Date.now(),
  },
});
const cases = [
  [3, 4],
  [3e200, 4e200],
  [3e-200, 4e-200],
  [Infinity, NaN],
  [NaN, -Infinity],
  [NaN, 1],
  [0, 0],
  [-0, 5],
];

let passed = 0;
let failed = 0;
const same = (a, b) => Object.is(a, b);
for (const [re, im] of cases) {
  const want = Math.hypot(re, im);
  const z = exports.complex(re, im);
  exports.__pin(z);
  const got = exports.complex_abs(z);
  const polar = exports.__getFloat64Array(exports.complex_to_polar(z))[0];
  exports.__unpin(z);
  const a = exports.matrix_zeros(1, 2);
  exports.__pin(a);
  exports.__getArrayView(a).set([re, im]);
  const r = exports.matrix_zeros(1, 1);
  exports.__pin(r);
  exports.complex_array_abs(a, r);
  const arrAbs = exports.__getArrayView(r)[0];
  exports.complex_array_arg(a, r);
  const arrArg = exports.__getArrayView(r)[0];
  if (same(arrArg, Math.atan2(im, re))) passed++;
  else {
    failed++;
    console.error(`FAIL complex_array_arg(${re}, ${im}) = ${arrArg}`);
  }
  exports.__unpin(a);
  exports.__unpin(r);
  for (const [name, v] of [
    ['complex_abs', got],
    ['complex_to_polar', polar],
    ['complex_array_abs', arrAbs],
  ]) {
    if (same(v, want)) passed++;
    else {
      failed++;
      console.error(`FAIL ${name}(${re}, ${im}) = ${v}, want ${want}`);
    }
  }
}
console.log(`complex-abs-1259: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
