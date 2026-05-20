/**
 * Runtime tests for the AssemblyScript rank-N tensor operations.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('tensor test: WASM not found. Run asbuild.');
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

function transpose(data, shape, perm) {
  const pd = makeArray(data);
  const ps = makeArray(shape);
  const pp = makeArray(perm);
  const r = readArr(exports.tensorTranspose(pd, ps, pp));
  [pd, ps, pp].forEach((p) => exports.__unpin(p));
  return r;
}

console.log('AssemblyScript rank-N tensor ops\n================================');

check(
  'tensorTranspose 2x3 with perm [1,0]',
  arrEq(transpose([1, 2, 3, 4, 5, 6], [2, 3], [1, 0]), [1, 4, 2, 5, 3, 6])
);
check(
  'tensorTranspose identity perm',
  arrEq(transpose([1, 2, 3, 4, 5, 6], [2, 3], [0, 1]), [1, 2, 3, 4, 5, 6])
);

// rank-3 reverse: out[k,j,i] = in[i,j,k]
{
  const data = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = transpose(data, [2, 2, 2], [2, 1, 0]);
  let ok = true;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        if (out[k * 4 + j * 2 + i] !== data[i * 4 + j * 2 + k]) ok = false;
      }
    }
  }
  check('tensorTranspose rank-3 reverse', ok);
}

console.log('\n================================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
