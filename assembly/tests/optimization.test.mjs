/**
 * Runtime tests for the AssemblyScript optimization kernels.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('optimization test: WASM not found. Run asbuild.');
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

console.log('AssemblyScript optimization\n===========================');

// quadprog: min 0.5 x^T I x + f^T x, f = [-2,-3] -> x = [2,3]
{
  const h = makeArray([1, 0, 0, 1]);
  const f = makeArray([-2, -3]);
  const a = makeArray([]);
  const b = makeArray([]);
  const x = readArr(exports.quadprog(h, 2, f, a, 0, b));
  check(
    'quadprog unconstrained -> [2,3]',
    Math.abs(x[0] - 2) < 1e-6 && Math.abs(x[1] - 3) < 1e-6,
    `x=${x}`
  );
  [h, f, a, b].forEach((p) => exports.__unpin(p));
}

// linprog: minimize -3x-2y s.t. x+y<=4, x<=2, y<=3 -> objective -10
{
  const c = makeArray([-3, -2]);
  const a = makeArray([1, 1, 1, 0, 0, 1]);
  const b = makeArray([4, 2, 3]);
  const x = readArr(exports.linprog(c, 2, a, b, 3));
  const obj = -3 * x[0] - 2 * x[1];
  check('linprog optimum objective = -10', Math.abs(obj + 10) < 1e-6, `x=${x}`);
  [c, a, b].forEach((p) => exports.__unpin(p));
}

// nullspace of [[1,2,3],[4,5,6],[7,8,9]] -> 1 vector, A*v ~ 0
{
  const a = makeArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const v = readArr(exports.nullspace(a, 3, 3));
  const count = v.length / 3;
  let maxResid = 0;
  const A = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  for (let i = 0; i < 3; i++) {
    let s = 0;
    for (let j = 0; j < 3; j++) s += A[i][j] * v[j];
    maxResid = Math.max(maxResid, Math.abs(s));
  }
  check(
    'nullspace -> 1 basis vector with A*v ~ 0',
    count === 1 && maxResid < 1e-9,
    `count=${count} resid=${maxResid}`
  );
  exports.__unpin(a);
}

console.log('\n===========================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
