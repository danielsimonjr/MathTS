/**
 * Tests for reverse-mode AD over TapedTensor EXTENDED elementwise ops.
 *
 * Covers the transcendentals added on top of the original
 * log/exp/sin/cos/tan/sqrt/square/pow/reciprocal/abs set:
 *   sinh, cosh, tanh, asin, acos, atan, asinh, acosh, atanh,
 *   log2, log10, log1p, expm1, cbrt, sign, atan2 (binary).
 *
 * For each unary op:
 *   - primal output equals the corresponding Math.* call;
 *   - analytical reverse-mode gradient equals the closed-form derivative;
 *   - gradient matches central finite differences (ε = 1e-6).
 *
 * Domains are chosen to stay clear of derivative singularities
 * (asin/acos away from ±1, acosh away from 1, atanh away from ±1, cbrt away
 * from 0) so the finite-difference cross-check is well-conditioned.
 */
import { describe, it, expect } from 'vitest';
import { Tape, TapedTensor } from '../src/tape.js';

function reverseGradOne(
  fn: (t: TapedTensor) => TapedTensor,
  xData: Float64Array,
  xShape: ReadonlyArray<number>
): { grad: Float64Array; value: Float64Array } {
  const tape = new Tape();
  const { id } = tape.allocate(xData.length);
  const leaf = new TapedTensor(xShape, new Float64Array(xData), tape, id);
  const out = fn(leaf);
  tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
  return {
    grad: new Float64Array(tape.getInputGrad(id)!),
    value: new Float64Array(out.primal),
  };
}

function numericalGrad(
  fn: (data: Float64Array) => Float64Array,
  xData: Float64Array,
  eps = 1e-6
): Float64Array {
  const grad = new Float64Array(xData.length);
  for (let i = 0; i < xData.length; i++) {
    const xPlus = new Float64Array(xData);
    xPlus[i] += eps;
    const xMinus = new Float64Array(xData);
    xMinus[i] -= eps;
    const fPlus = fn(xPlus).reduce((s, v) => s + v, 0);
    const fMinus = fn(xMinus).reduce((s, v) => s + v, 0);
    grad[i] = (fPlus - fMinus) / (2 * eps);
  }
  return grad;
}

function assertClose(a: Float64Array, b: Float64Array, tol = 1e-6, label = ''): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    if (diff >= tol) {
      throw new Error(`${label}: element [${i}] differs: ${a[i]} vs ${b[i]}, diff=${diff}`);
    }
    expect(diff).toBeLessThan(tol);
  }
}

interface UnaryCase {
  readonly name: string;
  readonly op: (t: TapedTensor) => TapedTensor;
  readonly primal: (x: number) => number;
  readonly deriv: (x: number) => number;
  readonly pts: number[];
}

const UNARY_CASES: UnaryCase[] = [
  {
    name: 'sinh',
    op: (t) => t.sinh(),
    primal: Math.sinh,
    deriv: (x) => Math.cosh(x),
    pts: [-1.5, -0.5, 0.5, 1.5],
  },
  {
    name: 'cosh',
    op: (t) => t.cosh(),
    primal: Math.cosh,
    deriv: (x) => Math.sinh(x),
    pts: [-1.5, -0.5, 0.5, 1.5],
  },
  {
    name: 'tanh',
    op: (t) => t.tanh(),
    primal: Math.tanh,
    deriv: (x) => 1 - Math.tanh(x) ** 2,
    pts: [-1.5, -0.5, 0.5, 1.5],
  },
  {
    name: 'asin',
    op: (t) => t.asin(),
    primal: Math.asin,
    deriv: (x) => 1 / Math.sqrt(1 - x * x),
    pts: [-0.7, -0.2, 0.3, 0.6],
  },
  {
    name: 'acos',
    op: (t) => t.acos(),
    primal: Math.acos,
    deriv: (x) => -1 / Math.sqrt(1 - x * x),
    pts: [-0.7, -0.2, 0.3, 0.6],
  },
  {
    name: 'atan',
    op: (t) => t.atan(),
    primal: Math.atan,
    deriv: (x) => 1 / (1 + x * x),
    pts: [-2, -0.5, 0.5, 2],
  },
  {
    name: 'asinh',
    op: (t) => t.asinh(),
    primal: Math.asinh,
    deriv: (x) => 1 / Math.sqrt(x * x + 1),
    pts: [-1.5, 0.5, 2],
  },
  {
    name: 'acosh',
    op: (t) => t.acosh(),
    primal: Math.acosh,
    deriv: (x) => 1 / Math.sqrt(x * x - 1),
    pts: [1.5, 2, 3],
  },
  {
    name: 'atanh',
    op: (t) => t.atanh(),
    primal: Math.atanh,
    deriv: (x) => 1 / (1 - x * x),
    pts: [-0.6, -0.1, 0.4, 0.7],
  },
  {
    name: 'log2',
    op: (t) => t.log2(),
    primal: Math.log2,
    deriv: (x) => 1 / (x * Math.LN2),
    pts: [0.5, 1, 2, 8],
  },
  {
    name: 'log10',
    op: (t) => t.log10(),
    primal: Math.log10,
    deriv: (x) => 1 / (x * Math.LN10),
    pts: [0.5, 1, 2, 8],
  },
  {
    name: 'log1p',
    op: (t) => t.log1p(),
    primal: Math.log1p,
    deriv: (x) => 1 / (1 + x),
    pts: [-0.5, 0, 1, 3],
  },
  {
    name: 'expm1',
    op: (t) => t.expm1(),
    primal: Math.expm1,
    deriv: (x) => Math.exp(x),
    pts: [-1, 0, 0.5, 1],
  },
  {
    name: 'cbrt',
    op: (t) => t.cbrt(),
    primal: Math.cbrt,
    deriv: (x) => 1 / (3 * Math.cbrt(x) ** 2),
    pts: [-8, -1, 1, 8],
  },
];

for (const c of UNARY_CASES) {
  describe(`TapedTensor.${c.name} — primal + gradient`, () => {
    it(`${c.name}() primal matches Math.${c.name}`, () => {
      const xData = new Float64Array(c.pts);
      const { value } = reverseGradOne(c.op, xData, [c.pts.length]);
      for (let i = 0; i < xData.length; i++) {
        expect(value[i]).toBeCloseTo(c.primal(xData[i]), 10);
      }
    });

    it(`${c.name}() gradient matches the closed-form derivative`, () => {
      const xData = new Float64Array(c.pts);
      const { grad } = reverseGradOne(c.op, xData, [c.pts.length]);
      for (let i = 0; i < xData.length; i++) {
        expect(grad[i]).toBeCloseTo(c.deriv(xData[i]), 8);
      }
    });

    it(`${c.name}() gradient matches finite differences`, () => {
      const xData = new Float64Array(c.pts);
      const fwd = (d: Float64Array): Float64Array => {
        const out = new Float64Array(d.length);
        for (let i = 0; i < d.length; i++) out[i] = c.primal(d[i]);
        return out;
      };
      const numGrad = numericalGrad(fwd, xData);
      const { grad } = reverseGradOne(c.op, xData, [c.pts.length]);
      assertClose(grad, numGrad, 1e-6, `${c.name} gradient`);
    });
  });
}

describe('TapedTensor.sign — primal + zero gradient', () => {
  it('sign() primal is sign(x); gradient is 0 (a.e.)', () => {
    const xData = new Float64Array([-3, 2, 0.5, -0.1]);
    const { value, grad } = reverseGradOne((t) => t.sign(), xData, [4]);
    expect(value[0]).toBe(-1);
    expect(value[1]).toBe(1);
    expect(value[2]).toBe(1);
    expect(value[3]).toBe(-1);
    for (const g of grad) expect(g).toBe(0);
  });
});

describe('TapedTensor.atan2 — primal + gradient (two leaves)', () => {
  it('atan2(a, b) primal + analytic gradients', () => {
    // y = this = a, x = other = b: atan2(a, b).
    // ∂/∂a = b/(a²+b²); ∂/∂b = -a/(a²+b²).
    const aData = new Float64Array([1, 2, -1]);
    const bData = new Float64Array([1, -1, 2]);
    const tape = new Tape();
    const { id: idA } = tape.allocate(3);
    const { id: idB } = tape.allocate(3);
    const A = new TapedTensor([3], new Float64Array(aData), tape, idA);
    const B = new TapedTensor([3], new Float64Array(bData), tape, idB);
    const out = A.atan2(B);
    for (let i = 0; i < 3; i++) {
      expect(out.primal[i]).toBeCloseTo(Math.atan2(aData[i], bData[i]), 10);
    }
    tape.backward(out.id, new Float64Array(3).fill(1));
    const gA = tape.getInputGrad(idA)!;
    const gB = tape.getInputGrad(idB)!;
    for (let i = 0; i < 3; i++) {
      const a = aData[i];
      const b = bData[i];
      const d = a * a + b * b;
      expect(gA[i]).toBeCloseTo(b / d, 8);
      expect(gB[i]).toBeCloseTo(-a / d, 8);
    }
  });

  it('atan2 chains through a downstream op (atan2(a,b).square().sum())', () => {
    const aData = new Float64Array([1, 0.5]);
    const bData = new Float64Array([2, 1]);
    const tape = new Tape();
    const { id: idA } = tape.allocate(2);
    const { id: idB } = tape.allocate(2);
    const A = new TapedTensor([2], new Float64Array(aData), tape, idA);
    const B = new TapedTensor([2], new Float64Array(bData), tape, idB);
    const out = A.atan2(B).square().sum();
    tape.backward(out.id, new Float64Array([1]));
    const gA = tape.getInputGrad(idA)!;
    const gB = tape.getInputGrad(idB)!;
    // d/da sum(atan2(a,b)²) = 2·atan2(a,b)·(b/(a²+b²)); symmetric for b.
    for (let i = 0; i < 2; i++) {
      const a = aData[i];
      const b = bData[i];
      const d = a * a + b * b;
      const theta = Math.atan2(a, b);
      expect(gA[i]).toBeCloseTo(2 * theta * (b / d), 8);
      expect(gB[i]).toBeCloseTo(2 * theta * (-a / d), 8);
    }
  });
});
