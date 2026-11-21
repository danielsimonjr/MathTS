import { describe, it, expect } from 'vitest';
import { airyAi, airyBi, betainc, normalCDF } from '../src/index.js';
import { erfcScalar } from '../src/typed/special.js';
import {
  erfcSelfContained,
  _lgamma,
  sinPiScalar,
  normalCDFScalar,
  airyUCoeffs,
  airyAsymPQ,
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
    const src = kernelSource([sinPiScalar, _lgamma], '(x) => _lgamma(x)');
    const fn = evalKernel(src);
    for (const x of [-1.5, 0.25, 1, 2.5, 10, 100]) {
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
      [airyUCoeffs, airyAsymPQ, airyScalar, airyAiScalar],
      '(x) => airyAiScalar(x)'
    );
    expect(src).toContain('airyScalar');
    expect(src).not.toContain('airyPowerSeries');
    // Numeric settings only — a per-call kind object + closures was a ~30% series-path loss.
    expect(airyAiScalar.toString()).toMatch(/airyScalar\(x,\s*-1,\s*-1,\s*2(?:\.0)?,\s*0\)/);
    expect(airyAiScalar.toString()).not.toContain('=>');
    const fn = evalKernel(src);
    for (const x of pinX) {
      expect(Object.is(fn(x), airyAiScalar(x))).toBe(true);
    }
  });

  it('airyBi worker kernel resolves callees and matches scalar', () => {
    const src = kernelSource(
      [airyUCoeffs, airyAsymPQ, airyScalar, airyBiScalar],
      '(x) => airyBiScalar(x)'
    );
    expect(airyBiScalar.toString()).toMatch(/airyScalar\(x,\s*1,\s*1,\s*1(?:\.0)?,\s*1\)/);
    expect(airyBiScalar.toString()).not.toContain('=>');
    const fn = evalKernel(src);
    for (const x of pinX) {
      expect(Object.is(fn(x), airyBiScalar(x))).toBe(true);
    }
  });

  it('airyAi Float64Array worker path matches scalar', () => {
    const xs = new Float64Array(pinX);
    const parallel = airyAi(xs) as Float64Array;
    for (let i = 0; i < xs.length; i++) {
      expect(Object.is(parallel[i]!, airyAiScalar(xs[i]!))).toBe(true);
    }
  });

  it('airyBi Float64Array worker path matches scalar', () => {
    const xs = new Float64Array(pinX);
    const parallel = airyBi(xs) as Float64Array;
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

  it('betainc Float64Array worker path matches scalar', () => {
    const a = 2;
    const b = 5;
    const xs = new Float64Array([0.1, 0.3, 0.8]);
    const parallel = betainc(a, b, xs) as Float64Array;
    for (let i = 0; i < xs.length; i++) {
      expect(Object.is(parallel[i]!, betaincScalar(a, b, xs[i]!))).toBe(true);
    }
  });
});

// =============================================================================
// Closure of every registered kernel (batch I2).
//
// `_lgamma` calls `sinPiScalar`, so a kernel that lists `_lgamma` and not `sinPiScalar` fails
// only when an input reaches the reflection (x < 0.5), and a worker evaluates its source lazily:
// `_lgamma(2.5)` passes. A value test with one input cannot see that. This test is structural:
// it fails for a missing entry whatever the input.
// =============================================================================

import * as scalars from '../src/wasm/special/scalars.js';
import '../src/typed/distributions.js';
import { workerKernel } from '../src/typed/worker-kernels.js';
import { lgamma, besselJ, besselY, besselI, besselK } from '../src/typed/special.js';
import { gammainc, gammaincp, beta } from '../src/index.js';

/** The names of the registered kernels, from the error message of an unknown name. */
function registeredKernelNames(): string[] {
  try {
    workerKernel('__no_such_kernel__');
  } catch (e) {
    const m = /Known: (.*)$/.exec((e as Error).message);
    if (m) return m[1]!.split(', ');
  }
  throw new Error('workerKernel did not list the kernel names');
}

/** The kernel source of `name`, with the least number of parameters that the builder takes. */
function kernelSourceOf(name: string): string {
  for (let count = 0; count <= 3; count++) {
    try {
      return workerKernel(name, ...new Array<number>(count).fill(1));
    } catch (e) {
      if (!/takes \d/.test((e as Error).message)) throw e;
    }
  }
  throw new Error(`no parameter count fits the kernel ${name}`);
}

describe('kernelSource closure: every scalar that a kernel calls is in its source', () => {
  const scalarNames = Object.entries(scalars)
    .filter(([, v]) => typeof v === 'function')
    .map(([k]) => k);

  it('lists the registered kernels and the scalars', () => {
    expect(registeredKernelNames().length).toBeGreaterThan(30);
    expect(scalarNames).toContain('sinPiScalar');
  });

  for (const name of registeredKernelNames()) {
    it(`${name}: each scalar call has its declaration in the source`, () => {
      const src = kernelSourceOf(name);
      // An export name holds letters, digits and `_` only, so it needs no escaping in a RegExp.
      const missing = scalarNames.filter(
        (fn) =>
          new RegExp(String.raw`(?<![A-Za-z0-9_$.])${fn}\(`).test(src) &&
          !new RegExp(String.raw`function ${fn}\(`).test(src)
      );
      expect(missing).toEqual([]);
    });
  }
});

describe('kernels that reach the reflection of _lgamma match the scalar bit for bit', () => {
  it('lgamma at -1.5 and -1.0000001', () => {
    const fn = evalKernel(workerKernel('lgamma'));
    for (const x of [-1.5, -1.0000001, 0.25]) {
      expect(fn(x)).toBe(lgamma(x));
    }
  });

  it('beta with b = -0.5 at a = 0.25', () => {
    const fn = evalKernel(workerKernel('beta', -0.5));
    expect(fn(0.25)).toBe(beta(0.25, -0.5));
  });

  it('gammainc and gammaincp with a = 0.25 at x = 0.5', () => {
    expect(evalKernel(workerKernel('gammainc', 0.25))(0.5)).toBe(gammainc(0.25, 0.5));
    expect(evalKernel(workerKernel('gammaincp', 0.25))(0.5)).toBe(gammaincp(0.25, 0.5));
  });

  it('betainc with (0.25, 0.3) at x = 0.4', () => {
    expect(evalKernel(workerKernel('betainc', 0.25, 0.3))(0.4)).toBe(betaincScalar(0.25, 0.3, 0.4));
  });

  it('besselJ of order -1.0000001 at x = 1e-10', () => {
    expect(evalKernel(workerKernel('besselJ', -1.0000001))(1e-10)).toBe(besselJ(-1.0000001, 1e-10));
  });

  it('besselY of order -0.3 at x = 0.5', () => {
    expect(evalKernel(workerKernel('besselY', -0.3))(0.5)).toBe(besselY(-0.3, 0.5));
  });

  it('besselI of order 2 at x = 3 and besselK of order 2 at x = 3', () => {
    expect(evalKernel(workerKernel('besselI', 2))(3)).toBe(besselI(2, 3));
    expect(evalKernel(workerKernel('besselK', 2))(3)).toBe(besselK(2, 3));
  });

  // Each input reaches the new helpers of the real-order engine: the Hankel start (x >= 25), the
  // recurrence with the 2^-600 scale, the K core with its scale, and the I series with its exponent.
  it('besselJ of order 400.3 at x = 5000 and of order 322.5 at x = 25', () => {
    expect(evalKernel(workerKernel('besselJ', 400.3))(5000)).toBe(besselJ(400.3, 5000));
    expect(evalKernel(workerKernel('besselJ', 322.5))(25)).toBe(besselJ(322.5, 25));
  });

  it('besselY of order 400.3 at x = 1.5e5 and of order -0.3 at x = 1e-300', () => {
    expect(evalKernel(workerKernel('besselY', 400.3))(1.5e5)).toBe(besselY(400.3, 1.5e5));
    expect(evalKernel(workerKernel('besselY', -0.3))(1e-300)).toBe(besselY(-0.3, 1e-300));
  });

  it('besselI of order -2.5 at x = 3 and of order 200 at x = 700', () => {
    expect(evalKernel(workerKernel('besselI', -2.5))(3)).toBe(besselI(-2.5, 3));
    expect(evalKernel(workerKernel('besselI', 200))(700)).toBe(besselI(200, 700));
  });

  it('besselK of order 1.49 at x = 3', () => {
    expect(evalKernel(workerKernel('besselK', 1.49))(3)).toBe(besselK(1.49, 3));
  });
});
