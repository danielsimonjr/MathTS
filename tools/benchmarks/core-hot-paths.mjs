/**
 * Core hot-path benchmark.
 *
 * Measures the symbols a caller actually imports from `@danielsimonjr/mathts-core`.
 * Warm the JIT (≥5 reps). Requires a built core package:
 *
 *   npx turbo build --filter=@danielsimonjr/mathts-core
 *   npm run bench:core
 */
import { BigNumber, Complex, Fraction, sumSquaredDeviations } from '@danielsimonjr/mathts-core';

const WARMUP = 8;

function timeMs(fn, iterations) {
  for (let i = 0; i < WARMUP; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return performance.now() - start;
}

function row(name, iterations, fn) {
  const ms = timeMs(fn, iterations);
  const ops = (iterations / ms) * 1000;
  console.log(
    `${name.padEnd(36)} ${ms.toFixed(2).padStart(10)} ms  ${iterations.toLocaleString().padStart(10)} ops  ${(ops / 1e3).toFixed(0).padStart(8)} K/s`
  );
}

const a = new Complex(3, 4);
const b = new Complex(1, 2);
const z = new Complex(0.7, 0.4);
const fa = new Fraction(355n, 113n);
const fb = new Fraction(22n, 7n);
const xs = Float64Array.from({ length: 50_000 }, (_, i) => 1e6 + (i % 97) / 97);

console.log('core hot paths (built package). Warmup', WARMUP, 'reps.\n');
row('Complex.add', 200_000, () => a.add(b));
row('Complex.multiply', 200_000, () => a.multiply(b));
row('Complex.abs', 200_000, () => a.abs());
row('Complex.sqrt', 100_000, () => z.sqrt());
row('Complex.tan', 100_000, () => z.tan());
row('Complex.log10', 100_000, () => z.log10());
row('Fraction.add', 100_000, () => fa.add(fb));
row('Fraction.multiply', 100_000, () => fa.multiply(fb));
row('Fraction.new bigint', 100_000, () => new Fraction(355n, 113n));
row('BigNumber.fromNumber int', 50_000, () => BigNumber.fromNumber(123456789));
row('BigNumber.fromBigInt', 50_000, () => BigNumber.fromBigInt(123456789n));
row('sumSquaredDeviations n=50k', 80, () => sumSquaredDeviations(xs));
