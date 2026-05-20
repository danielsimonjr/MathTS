/**
 * Runtime tests for the AssemblyScript signal windowing kernels.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('signal test: WASM not found. Run asbuild.');
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

console.log('AssemblyScript signal windowing\n===============================');

check(
  'windowFunction(5, rectangular)',
  arrEq(readArr(exports.windowFunction(5, 0)), [1, 1, 1, 1, 1])
);
check(
  'windowFunction(3, hamming)',
  arrEq(readArr(exports.windowFunction(3, 1)), [0.08, 1, 0.08])
);
check(
  'windowFunction(3, hann)',
  arrEq(readArr(exports.windowFunction(3, 2)), [0, 1, 0])
);

{
  const x = makeArray([1, 5, 2, 8, 3]);
  check(
    'medfilt([1,5,2,8,3], 3)',
    arrEq(readArr(exports.medfilt(x, 3)), [5, 2, 5, 3, 8])
  );
  exports.__unpin(x);
}

{
  const x = makeArray([0, 1, 2, 3]);
  check(
    'resample down by 2',
    arrEq(readArr(exports.resample(x, 2, 4)), [0, 2])
  );
  exports.__unpin(x);
}
{
  const x = makeArray([0, 10, 20, 30]);
  check(
    'resample up by 2',
    arrEq(readArr(exports.resample(x, 8, 4)), [0, 5, 10, 15, 20, 25, 30, 30])
  );
  exports.__unpin(x);
}

console.log('\n===============================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
