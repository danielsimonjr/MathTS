/**
 * Simple test runner for MathTS WASM module
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('MathTS WASM Test Runner');
  console.log('=======================\n');

  // Load the debug WASM module
  const wasmPath = path.join(__dirname, '../build/mathts-debug.wasm');

  if (!fs.existsSync(wasmPath)) {
    console.error('WASM module not found. Run `npm run asbuild` first.');
    process.exit(1);
  }

  const wasmBuffer = fs.readFileSync(wasmPath);

  const imports = {
    env: {
      abort: (msg, file, line, col) => {
        console.error(`Abort at ${line}:${col}`);
        throw new Error('WASM abort');
      },
      trace: () => {},
      seed: () => Date.now() * Math.random(),
    },
  };

  const { instance } = await WebAssembly.instantiate(wasmBuffer, imports);
  const exports = instance.exports;

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  function assertEqual(actual, expected, tolerance = 1e-10) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Expected ${expected}, got ${actual}`);
    }
  }

  // Scalar operation tests
  console.log('\nScalar Operations:');

  test('add_f64', () => {
    assertEqual(exports.add_f64(2, 3), 5);
    assertEqual(exports.add_f64(-1, 1), 0);
  });

  test('sub_f64', () => {
    assertEqual(exports.sub_f64(5, 3), 2);
    assertEqual(exports.sub_f64(-1, -1), 0);
  });

  test('mul_f64', () => {
    assertEqual(exports.mul_f64(2, 3), 6);
    assertEqual(exports.mul_f64(-2, 3), -6);
  });

  test('div_f64', () => {
    assertEqual(exports.div_f64(6, 2), 3);
    assertEqual(exports.div_f64(1, 4), 0.25);
  });

  test('sqrt_f64', () => {
    assertEqual(exports.sqrt_f64(4), 2);
    assertEqual(exports.sqrt_f64(9), 3);
  });

  test('pow_f64', () => {
    assertEqual(exports.pow_f64(2, 3), 8);
    assertEqual(exports.pow_f64(3, 2), 9);
  });

  test('exp_f64', () => {
    assertEqual(exports.exp_f64(0), 1);
    assertEqual(exports.exp_f64(1), Math.E, 1e-10);
  });

  test('log_f64', () => {
    assertEqual(exports.log_f64(1), 0);
    assertEqual(exports.log_f64(Math.E), 1, 1e-10);
  });

  test('sin_f64', () => {
    assertEqual(exports.sin_f64(0), 0);
    assertEqual(exports.sin_f64(Math.PI / 2), 1, 1e-10);
  });

  test('cos_f64', () => {
    assertEqual(exports.cos_f64(0), 1);
    assertEqual(exports.cos_f64(Math.PI), -1, 1e-10);
  });

  test('abs_f64', () => {
    assertEqual(exports.abs_f64(-5), 5);
    assertEqual(exports.abs_f64(5), 5);
  });

  // Summary
  console.log('\n=======================');
  console.log(`Tests: ${passed} passed, ${failed} failed`);
  console.log('=======================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
