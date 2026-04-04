/**
 * Performance Regression Tests
 *
 * Measures execution time for critical hot paths and asserts they complete
 * within generous upper bounds so CI can catch severe regressions without
 * flaking on slow machines.
 *
 * Time limits are set at ~3–5x the expected time on a modern developer machine.
 */
import { describe, it, expect } from 'vitest';
import { Complex, Fraction, BigNumber } from '@mathts/core';
import { mathTyped } from '@mathts/core';
import { DenseMatrix } from '@mathts/matrix';
import { add, abs, sqrt, exp } from '@mathts/functions';

// ---------------------------------------------------------------------------
// Benchmark helper
// ---------------------------------------------------------------------------

/**
 * Runs `fn` for `warmup` iterations (discarded), then `iterations` timed
 * iterations.  Returns elapsed milliseconds and logs a summary line.
 */
function benchmark(
  name: string,
  fn: () => void,
  iterations = 10_000,
  warmup = 100
): number {
  for (let i = 0; i < warmup; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;

  const opsPerSec = (iterations / elapsed) * 1000;
  console.log(
    `  ${name}: ${elapsed.toFixed(2)}ms for ${iterations.toLocaleString()} ops` +
      ` (${(opsPerSec / 1000).toFixed(0)}K ops/sec)`
  );
  return elapsed;
}

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

describe('Performance Regression Tests', () => {
  describe('Core Types – Complex', () => {
    it('Complex construction: 10K ops under 200ms', () => {
      const elapsed = benchmark('Complex new', () => new Complex(3, 4));
      expect(elapsed).toBeLessThan(200);
    });

    it('Complex.add: 10K ops under 200ms', () => {
      const a = new Complex(3, 4);
      const b = new Complex(1, 2);
      const elapsed = benchmark('Complex add', () => a.add(b));
      expect(elapsed).toBeLessThan(200);
    });

    it('Complex.multiply: 10K ops under 200ms', () => {
      const a = new Complex(3, 4);
      const b = new Complex(1, 2);
      const elapsed = benchmark('Complex multiply', () => a.multiply(b));
      expect(elapsed).toBeLessThan(200);
    });

    it('Complex.sin: 10K ops under 300ms', () => {
      const z = new Complex(1, 1);
      const elapsed = benchmark('Complex sin', () => z.sin());
      expect(elapsed).toBeLessThan(300);
    });

    it('Complex.exp: 10K ops under 300ms', () => {
      const z = new Complex(0.5, 0.5);
      const elapsed = benchmark('Complex exp', () => z.exp());
      expect(elapsed).toBeLessThan(300);
    });
  });

  // -------------------------------------------------------------------------

  describe('Core Types – BigNumber', () => {
    it('BigNumber.fromNumber: 10K ops under 300ms', () => {
      const elapsed = benchmark('BigNumber fromNumber', () =>
        BigNumber.fromNumber(123456789)
      );
      expect(elapsed).toBeLessThan(300);
    });

    it('BigNumber.add: 10K ops under 400ms', () => {
      const a = BigNumber.fromNumber(123456789);
      const b = BigNumber.fromNumber(987654321);
      const elapsed = benchmark('BigNumber add', () => a.add(b));
      expect(elapsed).toBeLessThan(400);
    });

    it('BigNumber.multiply: 10K ops under 400ms', () => {
      const a = BigNumber.fromNumber(123456);
      const b = BigNumber.fromNumber(987654);
      const elapsed = benchmark('BigNumber multiply', () => a.multiply(b));
      expect(elapsed).toBeLessThan(400);
    });
  });

  // -------------------------------------------------------------------------

  describe('Core Types – Fraction', () => {
    it('Fraction construction: 10K ops under 200ms', () => {
      const elapsed = benchmark('Fraction new', () => new Fraction(355, 113));
      expect(elapsed).toBeLessThan(200);
    });

    it('Fraction.add: 10K ops under 200ms', () => {
      const a = new Fraction(355, 113);
      const b = new Fraction(22, 7);
      const elapsed = benchmark('Fraction add', () => a.add(b));
      expect(elapsed).toBeLessThan(200);
    });

    it('Fraction.multiply: 10K ops under 200ms', () => {
      const a = new Fraction(355, 113);
      const b = new Fraction(22, 7);
      const elapsed = benchmark('Fraction multiply', () => a.multiply(b));
      expect(elapsed).toBeLessThan(200);
    });
  });

  // -------------------------------------------------------------------------

  describe('Matrix Operations – DenseMatrix', () => {
    it('DenseMatrix construction 100x100: under 100ms', () => {
      const data = new Float64Array(10_000).fill(1);
      const elapsed = benchmark(
        'DenseMatrix 100x100 new',
        () => new DenseMatrix(100, 100, data),
        1_000,
        10
      );
      expect(elapsed).toBeLessThan(100);
    });

    it('DenseMatrix transpose 100x100: 100 ops under 200ms', () => {
      const data = Float64Array.from({ length: 10_000 }, (_, i) => i);
      const m = new DenseMatrix(100, 100, data);
      const elapsed = benchmark(
        'DenseMatrix 100x100 transpose',
        () => m.transpose(),
        100,
        5
      );
      expect(elapsed).toBeLessThan(200);
    });

    it('DenseMatrix multiply 100x100: 10 ops under 1000ms', () => {
      const data = Float64Array.from({ length: 10_000 }, (_, i) => i % 100);
      const a = new DenseMatrix(100, 100, data);
      const b = new DenseMatrix(100, 100, data);
      const elapsed = benchmark(
        'DenseMatrix 100x100 multiply',
        () => a.multiply(b),
        10,
        2
      );
      expect(elapsed).toBeLessThan(1000);
    });

    it('DenseMatrix fromArray 10x10: 10K ops under 300ms', () => {
      const arr = Array.from({ length: 10 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => r * 10 + c)
      );
      const elapsed = benchmark('DenseMatrix fromArray 10x10', () =>
        DenseMatrix.fromArray(arr)
      );
      expect(elapsed).toBeLessThan(300);
    });
  });

  // -------------------------------------------------------------------------

  describe('Typed Function Dispatch', () => {
    it('mathTyped: define and call simple function 1K times under 200ms', () => {
      // Create a typed function inside the benchmark window so we also
      // measure definition overhead (once) — actual dispatch is the hot path.
      const double = mathTyped('double', {
        number: (x: number) => x * 2,
      });

      const elapsed = benchmark('typed dispatch number', () => double(42), 1_000, 50);
      expect(elapsed).toBeLessThan(200);
    });

    it('mathTyped multi-signature dispatch: 10K calls under 300ms', () => {
      const coerce = mathTyped('coerce', {
        number: (x: number) => x,
        string: (x: string) => parseFloat(x),
        boolean: (x: boolean) => (x ? 1 : 0),
      });

      // Alternate signatures to stress the dispatch path
      let i = 0;
      const elapsed = benchmark(
        'typed dispatch multi-sig',
        () => {
          i++;
          if (i % 3 === 0) coerce(true);
          else if (i % 3 === 1) coerce(3.14);
          else coerce('2.71');
        },
        10_000,
        100
      );
      expect(elapsed).toBeLessThan(300);
    });
  });

  // -------------------------------------------------------------------------

  describe('Factory Functions (typed arithmetic)', () => {
    it('abs number: 10K calls under 100ms', () => {
      const elapsed = benchmark('abs(number)', () => abs(-42));
      expect(elapsed).toBeLessThan(100);
    });

    it('abs Complex: 10K calls under 200ms', () => {
      const z = new Complex(3, 4);
      const elapsed = benchmark('abs(Complex)', () => abs(z));
      expect(elapsed).toBeLessThan(200);
    });

    it('add numbers: 10K calls under 100ms', () => {
      const elapsed = benchmark('add(number, number)', () => add(3, 4));
      expect(elapsed).toBeLessThan(100);
    });

    it('add Complex: 10K calls under 200ms', () => {
      const a = new Complex(1, 2);
      const b = new Complex(3, 4);
      const elapsed = benchmark('add(Complex, Complex)', () => add(a, b));
      expect(elapsed).toBeLessThan(200);
    });

    it('sqrt number: 10K calls under 100ms', () => {
      const elapsed = benchmark('sqrt(number)', () => sqrt(144));
      expect(elapsed).toBeLessThan(100);
    });

    it('exp number: 10K calls under 100ms', () => {
      const elapsed = benchmark('exp(number)', () => exp(1));
      expect(elapsed).toBeLessThan(100);
    });
  });
});
