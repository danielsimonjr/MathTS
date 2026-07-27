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

  test('mod_f64', () => {
    assertEqual(exports.mod_f64(5, 2), 1);
    assertEqual(exports.mod_f64(-5, 2), -1);
  });

  test('neg_f64', () => {
    assertEqual(exports.neg_f64(5), -5);
    assertEqual(exports.neg_f64(-5), 5);
  });

  test('sqrt_f64', () => {
    assertEqual(exports.sqrt_f64(4), 2);
    assertEqual(exports.sqrt_f64(9), 3);
  });

  test('pow_f64', () => {
    assertEqual(exports.pow_f64(2, 3), 8);
    assertEqual(exports.pow_f64(3, 2), 9);
  });

  test('square_f64', () => {
    assertEqual(exports.square_f64(3), 9);
    assertEqual(exports.square_f64(-4), 16);
  });

  test('cube_f64', () => {
    assertEqual(exports.cube_f64(2), 8);
    assertEqual(exports.cube_f64(-3), -27);
  });

  test('cbrt_f64', () => {
    assertEqual(exports.cbrt_f64(8), 2);
    assertEqual(exports.cbrt_f64(-27), -3);
  });

  test('nthRoot_f64', () => {
    assertEqual(exports.nthRoot_f64(16, 4), 2);
    assertEqual(exports.nthRoot_f64(-27, 3), -3);
  });

  test('exp_f64', () => {
    assertEqual(exports.exp_f64(0), 1);
    assertEqual(exports.exp_f64(1), Math.E, 1e-10);
  });

  test('expm1_f64', () => {
    assertEqual(exports.expm1_f64(0), 0);
    assertEqual(exports.expm1_f64(1), Math.expm1(1), 1e-10);
  });

  test('log_f64', () => {
    assertEqual(exports.log_f64(1), 0);
    assertEqual(exports.log_f64(Math.E), 1, 1e-10);
  });

  test('log1p_f64', () => {
    assertEqual(exports.log1p_f64(0), 0);
    assertEqual(exports.log1p_f64(Math.E - 1), 1, 1e-10);
  });

  test('log10_f64', () => {
    assertEqual(exports.log10_f64(1), 0);
    assertEqual(exports.log10_f64(100), 2, 1e-10);
  });

  test('log2_f64', () => {
    assertEqual(exports.log2_f64(1), 0);
    assertEqual(exports.log2_f64(8), 3, 1e-10);
  });

  test('sin_f64', () => {
    assertEqual(exports.sin_f64(0), 0);
    assertEqual(exports.sin_f64(Math.PI / 2), 1, 1e-10);
  });

  test('cos_f64', () => {
    assertEqual(exports.cos_f64(0), 1);
    assertEqual(exports.cos_f64(Math.PI), -1, 1e-10);
  });

  test('tan_f64', () => {
    assertEqual(exports.tan_f64(0), 0);
    assertEqual(exports.tan_f64(Math.PI / 4), 1, 1e-10);
  });

  test('asin_f64', () => {
    assertEqual(exports.asin_f64(0), 0);
    assertEqual(exports.asin_f64(1), Math.PI / 2, 1e-10);
  });

  test('acos_f64', () => {
    assertEqual(exports.acos_f64(1), 0);
    assertEqual(exports.acos_f64(-1), Math.PI, 1e-10);
  });

  test('atan_f64', () => {
    assertEqual(exports.atan_f64(0), 0);
    assertEqual(exports.atan_f64(1), Math.PI / 4, 1e-10);
  });

  test('atan2_f64', () => {
    assertEqual(exports.atan2_f64(0, 1), 0);
    assertEqual(exports.atan2_f64(1, 0), Math.PI / 2, 1e-10);
  });

  test('sinh_f64', () => {
    assertEqual(exports.sinh_f64(0), 0);
    assertEqual(exports.sinh_f64(1), Math.sinh(1), 1e-10);
  });

  test('cosh_f64', () => {
    assertEqual(exports.cosh_f64(0), 1);
    assertEqual(exports.cosh_f64(1), Math.cosh(1), 1e-10);
  });

  test('tanh_f64', () => {
    assertEqual(exports.tanh_f64(0), 0);
    assertEqual(exports.tanh_f64(1), Math.tanh(1), 1e-10);
  });

  test('asinh_f64', () => {
    assertEqual(exports.asinh_f64(0), 0);
    assertEqual(exports.asinh_f64(1), Math.asinh(1), 1e-10);
  });

  test('acosh_f64', () => {
    assertEqual(exports.acosh_f64(1), 0);
    assertEqual(exports.acosh_f64(2), Math.acosh(2), 1e-10);
  });

  test('atanh_f64', () => {
    assertEqual(exports.atanh_f64(0), 0);
    assertEqual(exports.atanh_f64(0.5), Math.atanh(0.5), 1e-10);
  });

  test('abs_f64', () => {
    assertEqual(exports.abs_f64(-5), 5);
    assertEqual(exports.abs_f64(5), 5);
  });

  test('floor_f64', () => {
    assertEqual(exports.floor_f64(3.7), 3);
    assertEqual(exports.floor_f64(-3.2), -4);
  });

  test('ceil_f64', () => {
    assertEqual(exports.ceil_f64(3.2), 4);
    assertEqual(exports.ceil_f64(-3.7), -3);
  });

  test('round_f64', () => {
    assertEqual(exports.round_f64(3.5), 4);
    assertEqual(exports.round_f64(-3.5), -4);
    assertEqual(exports.round_f64(3.2), 3);
  });

  test('trunc_f64', () => {
    assertEqual(exports.trunc_f64(3.7), 3);
    assertEqual(exports.trunc_f64(-3.7), -3);
  });

  test('sign_f64', () => {
    assertEqual(exports.sign_f64(5), 1);
    assertEqual(exports.sign_f64(-5), -1);
    assertEqual(exports.sign_f64(0), 0);
  });

  test('min_f64', () => {
    assertEqual(exports.min_f64(5, 3), 3);
    assertEqual(exports.min_f64(-5, 3), -5);
  });

  test('max_f64', () => {
    assertEqual(exports.max_f64(5, 3), 5);
    assertEqual(exports.max_f64(-5, 3), 3);
  });

  test('clamp_f64', () => {
    assertEqual(exports.clamp_f64(5, 1, 10), 5);
    assertEqual(exports.clamp_f64(0, 1, 10), 1);
    assertEqual(exports.clamp_f64(15, 1, 10), 10);
  });

  test('isNaN_f64', () => {
    assertEqual(exports.isNaN_f64(NaN), 1);
    assertEqual(exports.isNaN_f64(5), 0);
  });

  test('isFinite_f64', () => {
    assertEqual(exports.isFinite_f64(5), 1);
    assertEqual(exports.isFinite_f64(Infinity), 0);
  });

  test('Constants', () => {
    assertEqual(exports.PI.valueOf(), 3.141592653589793);
    assertEqual(exports.E.valueOf(), 2.718281828459045);
    assertEqual(exports.PHI.valueOf(), 1.618033988749895);
    assertEqual(exports.SQRT2.valueOf(), 1.4142135623730951);
    assertEqual(exports.SQRT1_2.valueOf(), 0.7071067811865476);
    assertEqual(exports.LN2.valueOf(), 0.6931471805599453);
    assertEqual(exports.LN10.valueOf(), 2.302585092994046);
    assertEqual(exports.LOG2E.valueOf(), 1.4426950408889634);
    assertEqual(exports.LOG10E.valueOf(), 0.4342944819032518);
    assertEqual(exports.EPSILON.valueOf(), 2.220446049250313e-16);
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
