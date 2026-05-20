/**
 * Runtime tests for the AssemblyScript rational-approximation kernels.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');
if (!existsSync(wasmPath)) {
  console.error('approx test: WASM not found. Run asbuild.');
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

console.log('AssemblyScript rational approximation\n=====================================');

// residue of 1 / (x^2 - 1): poles +/-1, residue at pole = 1/(2*pole)
{
  const p = makeArray([1]);
  const q = makeArray([-1, 0, 1]);
  const packed = readArr(exports.residue(p, q));
  const count = packed.length / 2;
  const residues = packed.slice(0, count);
  const poles = packed.slice(count);
  let ok = count === 2;
  for (let i = 0; i < count; i++) {
    const pole = poles[i];
    if (Math.abs(pole - 1) > 1e-6 && Math.abs(pole + 1) > 1e-6) ok = false;
    if (Math.abs(residues[i] - 1 / (2 * pole)) > 1e-6) ok = false;
  }
  check('residue(1/(x^2-1))', ok, `poles=${poles} residues=${residues}`);
  exports.__unpin(p);
  exports.__unpin(q);
}

// Pade[1/1] of e^x = (1 + x/2)/(1 - x/2)
{
  const c = makeArray([1, 1, 0.5, 1 / 6, 1 / 24]);
  const packed = readArr(exports.padeApproximant(c, 1, 1));
  // num = packed[0..2], den = packed[2..4]
  check(
    'padeApproximant(e^x, [1/1])',
    Math.abs(packed[0] - 1) < 1e-12 &&
      Math.abs(packed[1] - 0.5) < 1e-12 &&
      Math.abs(packed[2] - 1) < 1e-12 &&
      Math.abs(packed[3] + 0.5) < 1e-12,
    `packed=${packed}`
  );
  exports.__unpin(c);
}

console.log('\n=====================================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
