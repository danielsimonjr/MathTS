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
const arrEq = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

console.log('AssemblyScript signal windowing\n===============================');

check(
  'windowFunction(5, rectangular)',
  arrEq(readArr(exports.windowFunction(5, 0)), [1, 1, 1, 1, 1])
);
check('windowFunction(3, hamming)', arrEq(readArr(exports.windowFunction(3, 1)), [0.08, 1, 0.08]));
check('windowFunction(3, hann)', arrEq(readArr(exports.windowFunction(3, 2)), [0, 1, 0]));

{
  const x = makeArray([1, 5, 2, 8, 3]);
  check('medfilt([1,5,2,8,3], 3)', arrEq(readArr(exports.medfilt(x, 3)), [5, 2, 5, 3, 8]));
  exports.__unpin(x);
}

{
  const x = makeArray([0, 1, 2, 3]);
  check('resample down by 2', arrEq(readArr(exports.resample(x, 2, 4)), [0, 2]));
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

// welch_psd_f64 zero-pads each frame to the next power of two; bins 0..floor(frame/2) are
// returned. Only an even frame ends on the Nyquist bin: the last bin of an odd frame lies below
// Nyquist and is doubled like the bins before it (#1145). Oracle: numpy 2.3.5, two frames of
// x = [1,5,2,8,3,9,4,7,6,10] zero-padded to 8, rect window, |fft|^2 / (2 * 5), bins 1..2 doubled.
{
  const x = makeArray([1, 5, 2, 8, 3, 9, 4, 7, 6, 10]);
  const odd = readArr(exports.welch_psd_f64(x, 5, 0, 3));
  check(
    'welch_psd_f64 doubles the last bin of an odd frame',
    odd.length === 3 && arrEq(odd, [165.7, 69.21564209736039, 32.19999999999999]),
    JSON.stringify(odd)
  );
  // An even frame keeps its Nyquist bin single: frame 4, two frames (the first 8 samples).
  const even = readArr(exports.welch_psd_f64(x, 4, 0, 3));
  check(
    'welch_psd_f64 leaves the Nyquist bin of an even frame single',
    even.length === 3 && arrEq(even, [98.125, 3.750000000000001, 22.625]),
    JSON.stringify(even)
  );
  exports.__unpin(x);
}

console.log('\n===============================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
