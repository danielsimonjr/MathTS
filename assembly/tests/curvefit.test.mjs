/**
 * Runtime tests for the AssemblyScript curve-fitting kernels.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('curvefit test: WASM not found. Run asbuild.');
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

function fit(fn, xs, ys) {
  const px = makeArray(xs);
  const py = makeArray(ys);
  const r = readArr(exports[fn](px, py));
  exports.__unpin(px);
  exports.__unpin(py);
  return r;
}

console.log('AssemblyScript curve fitting\n============================');

const xs = [0, 1, 2, 3, 4];
const expYs = xs.map((x) => 2 * Math.exp(0.5 * x));
const e = fit('expfit', xs, expYs);
check(
  'expfit recovers y = 2*exp(0.5x)',
  Math.abs(e[0] - 2) < 1e-9 && Math.abs(e[1] - 0.5) < 1e-9,
  `[a,b]=${e}`
);

const xs2 = [1, 2, 3, 4, 5];
const logYs = xs2.map((x) => 3 * Math.log(x) + 1);
const l = fit('logfit', xs2, logYs);
check(
  'logfit recovers y = 3*ln(x)+1',
  Math.abs(l[0] - 3) < 1e-9 && Math.abs(l[1] - 1) < 1e-9,
  `[a,b]=${l}`
);

const powYs = xs2.map((x) => 2 * Math.pow(x, 1.5));
const p = fit('powerfit', xs2, powYs);
check(
  'powerfit recovers y = 2*x^1.5',
  Math.abs(p[0] - 2) < 1e-9 && Math.abs(p[1] - 1.5) < 1e-9,
  `[a,b]=${p}`
);

console.log('\n============================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
