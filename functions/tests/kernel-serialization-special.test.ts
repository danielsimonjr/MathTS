import { describe, it, expect } from 'vitest';
import { airyAi, airyBi, betainc, normalCDF } from '../src/index.js';
import { erfcScalar } from '../src/typed/special.js';
import {
  erfcSelfContained,
  _lgamma,
  normalCDFScalar,
  airyUCoeffs,
  airyAsymPQ,
  airyPowerSeries,
  airyScalar,
  airyAiScalar,
  airyBiScalar,
  incompleteBetaFraction,
  betaincScalar,
} from '../src/wasm/special/scalars.js';
import { kernelSource } from '../src/typed/parallel-map.js';

/** Evaluate a `kernelSource` bundle the same way workers do. */
function evalKernel(src: string): (x: number) => number {
  // eslint-disable-next-line no-new-func -- mirrors worker eval of serialized kernels
  return new Function(`return (${src})`)() as (x: number) => number;
}

describe('kernelSource serialization — erfc / normal CDF', () => {
  it('erfcSelfContained stringifies and matches erfcScalar', () => {
    const src = kernelSource([erfcSelfContained, erfcScalar], '(x) => erfcScalar(x)');
    expect(src).toContain('erfcSelfContained');
    const fn = evalKernel(src);
    for (const x of [0, 0.5, 1, -1, 3, 8, -8]) {
      expect(fn(x)).toBeCloseTo(erfcScalar(x), 14);
    }
  });

  it('normalCDF worker kernel matches normalCDF scalar', () => {
    const src = kernelSource(
      [erfcSelfContained],
      '(x) => 0.5 * erfcSelfContained(-x / Math.SQRT2)'
    );
    const fn = evalKernel(src);
    for (const x of [0, 1, -1, 3, 8]) {
      expect(fn(x)).toBeCloseTo(normalCDF(x, 0, 1) as number, 14);
    }
  });

  it('normalCDFScalar kernel stringifies with erfcSelfContained', () => {
    const src = kernelSource(
      [erfcSelfContained, normalCDFScalar],
      '(x) => normalCDFScalar(x, 0, 1)'
    );
    expect(src).toContain('erfcSelfContained');
    expect(normalCDFScalar.toString()).toContain('erfcSelfContained');
    const fn = evalKernel(src);
    expect(fn(1)).toBeCloseTo(normalCDF(1, 0, 1) as number, 14);
  });

  it('KS normal-CDF worker kernel matches sequential erfcScalar path', () => {
    const src = kernelSource(
      [erfcSelfContained],
      '(x) => 0.5 * erfcSelfContained(-x / Math.SQRT2)'
    );
    const workerCdf = evalKernel(src);
    const seqCdf = (x: number) => 0.5 * erfcScalar(-x / Math.SQRT2);
    const grid = [-5, -2, -1, 0, 0.5, 1, 2, 5, 8];
    for (const x of grid) {
      expect(workerCdf(x)).toBeCloseTo(seqCdf(x), 14);
    }
  });
});

describe('kernelSource serialization — _lgamma', () => {
  it('_lgamma stringifies and matches direct calls', () => {
    const src = kernelSource([_lgamma], '(x) => _lgamma(x)');
    const fn = evalKernel(src);
    for (const x of [0.25, 1, 2.5, 10, 100]) {
      expect(fn(x)).toBe(_lgamma(x));
    }
  });
});

describe('erfc / normal CDF oracle constants', () => {
  // Independent of this implementation: CPython math.erfc / math.erf (libm)
  // and mpmath dps=50. Cited values are the libm doubles.
  it('erfc(0.5) reference', () => {
    expect(erfcScalar(0.5)).toBeCloseTo(0.4795001221869535, 14);
  });

  it('erf via erfc at x=1', () => {
    expect(1 - erfcScalar(1)).toBeCloseTo(0.8427007929497149, 14);
  });

  it('standard normal CDF at known points', () => {
    // Independent oracles: CPython math.erfc (libm) and mpmath dps=50.
    // Φ(z) = ½ erfc(−z/√2). Not a paste of this implementation's output.
    const cdf = (z: number) => 0.5 * erfcScalar(-z / Math.SQRT2);
    expect(cdf(0)).toBeCloseTo(0.5, 14);
    expect(cdf(1)).toBeCloseTo(0.8413447460685429, 14);
    expect(cdf(-1)).toBeCloseTo(0.15865525393145707, 14);
    expect(cdf(3)).toBeCloseTo(0.9986501019683699, 14);
    // mpmath Φ(8) = 0.9999999999999993779; libm = 0.9999999999999993
    expect(cdf(8)).toBeCloseTo(0.9999999999999993, 14);
  });
});

describe('kernelSource serialization — Airy Ai / Bi', () => {
  const pinX = [0, 1, -1, 5, -5, 20, -20] as const;

  it('airyAi worker kernel resolves callees and matches scalar', () => {
    const src = kernelSource(
      [airyUCoeffs, airyAsymPQ, airyPowerSeries, airyScalar, airyAiScalar],
      '(x) => airyAiScalar(x)'
    );
    expect(src).toContain('airyScalar');
    expect(src).toContain('airyPowerSeries');
    const fn = evalKernel(src);
    for (const x of pinX) {
      expect(Object.is(fn(x), airyAiScalar(x))).toBe(true);
    }
  });

  it('airyBi worker kernel resolves callees and matches scalar', () => {
    const src = kernelSource(
      [airyUCoeffs, airyAsymPQ, airyPowerSeries, airyScalar, airyBiScalar],
      '(x) => airyBiScalar(x)'
    );
    const fn = evalKernel(src);
    for (const x of pinX) {
      expect(Object.is(fn(x), airyBiScalar(x))).toBe(true);
    }
  });

  it('airyAi Float64Array worker path matches scalar', async () => {
    const xs = new Float64Array(pinX);
    const parallel = (await airyAi(xs)) as Float64Array;
    for (let i = 0; i < xs.length; i++) {
      expect(Object.is(parallel[i]!, airyAiScalar(xs[i]!))).toBe(true);
    }
  });

  it('airyBi Float64Array worker path matches scalar', async () => {
    const xs = new Float64Array(pinX);
    const parallel = (await airyBi(xs)) as Float64Array;
    for (let i = 0; i < xs.length; i++) {
      expect(Object.is(parallel[i]!, airyBiScalar(xs[i]!))).toBe(true);
    }
  });
});

describe('kernelSource serialization — betainc', () => {
  it('betainc worker kernel contains incompleteBetaFraction and matches scalar', () => {
    const a = 2;
    const b = 5;
    const src = kernelSource(
      [_lgamma, incompleteBetaFraction, betaincScalar],
      `(x) => betaincScalar(${a}, ${b}, x)`
    );
    expect(src).toContain('incompleteBetaFraction');
    const fn = evalKernel(src);
    for (const x of [0.1, 0.3, 0.8]) {
      expect(Object.is(fn(x), betaincScalar(a, b, x))).toBe(true);
    }
  });

  it('betainc Float64Array worker path matches scalar', async () => {
    const a = 2;
    const b = 5;
    const xs = new Float64Array([0.1, 0.3, 0.8]);
    const parallel = (await betainc(a, b, xs)) as Float64Array;
    for (let i = 0; i < xs.length; i++) {
      expect(Object.is(parallel[i]!, betaincScalar(a, b, xs[i]!))).toBe(true);
    }
  });
});
