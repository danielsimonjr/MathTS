/**
 * Tests for forward-mode AD over DualTensor elementwise ops.
 *
 * Before this slice DualTensor implemented only add/sub/mul/scale. This brings
 * it to parity with reverse-mode TapedTensor:
 *   divide, exp, log, sin, cos, tan, sqrt, square, pow, reciprocal, abs,
 *   sinh, cosh, tanh, asin, acos, atan, asinh, acosh, atanh,
 *   log2, log10, log1p, expm1, cbrt, sign, atan2.
 *
 * Forward-mode dual-number rule for a unary f: (a, a') ↦ (f(a), f'(a)·a').
 * Each unary test seeds the input tangent with ones, so the output tangent
 * equals f'(x) and is checked against the closed-form derivative. Binary ops
 * (divide, atan2) are checked against their dual-number rules directly.
 */
import { describe, it, expect } from 'vitest';
import { DualTensor } from '../src/dual-tensor.js';

/** Run a unary op with input tangent = 1, returning (primal, tangent=f'(x)). */
function dualUnary(
  op: (d: DualTensor) => DualTensor,
  xData: number[]
): { primal: Float64Array; tangent: Float64Array } {
  const primal = new Float64Array(xData);
  const tangent = new Float64Array(xData.length).fill(1);
  const out = op(new DualTensor([xData.length], primal, tangent));
  return { primal: out.primal, tangent: out.tangent };
}

interface UnaryCase {
  readonly name: string;
  readonly op: (d: DualTensor) => DualTensor;
  readonly primal: (x: number) => number;
  readonly deriv: (x: number) => number;
  readonly pts: number[];
}

const UNARY_CASES: UnaryCase[] = [
  {
    name: 'exp',
    op: (d) => d.exp(),
    primal: Math.exp,
    deriv: (x) => Math.exp(x),
    pts: [-1, 0, 1, 2],
  },
  { name: 'log', op: (d) => d.log(), primal: Math.log, deriv: (x) => 1 / x, pts: [0.5, 1, 2, 4] },
  {
    name: 'sin',
    op: (d) => d.sin(),
    primal: Math.sin,
    deriv: (x) => Math.cos(x),
    pts: [0, 0.5, 1, 2],
  },
  {
    name: 'cos',
    op: (d) => d.cos(),
    primal: Math.cos,
    deriv: (x) => -Math.sin(x),
    pts: [0, 0.5, 1, 2],
  },
  {
    name: 'tan',
    op: (d) => d.tan(),
    primal: Math.tan,
    deriv: (x) => 1 / Math.cos(x) ** 2,
    pts: [0, 0.4, 0.8, 1.2],
  },
  {
    name: 'sqrt',
    op: (d) => d.sqrt(),
    primal: Math.sqrt,
    deriv: (x) => 1 / (2 * Math.sqrt(x)),
    pts: [0.5, 1, 4, 9],
  },
  {
    name: 'square',
    op: (d) => d.square(),
    primal: (x) => x * x,
    deriv: (x) => 2 * x,
    pts: [-2, -1, 1, 3],
  },
  {
    name: 'reciprocal',
    op: (d) => d.reciprocal(),
    primal: (x) => 1 / x,
    deriv: (x) => -1 / (x * x),
    pts: [0.5, 1, 2, 5],
  },
  {
    name: 'abs',
    op: (d) => d.abs(),
    primal: Math.abs,
    deriv: (x) => Math.sign(x),
    pts: [-3, -1, 1, 4],
  },
  {
    name: 'sinh',
    op: (d) => d.sinh(),
    primal: Math.sinh,
    deriv: (x) => Math.cosh(x),
    pts: [-1.5, -0.5, 0.5, 1.5],
  },
  {
    name: 'cosh',
    op: (d) => d.cosh(),
    primal: Math.cosh,
    deriv: (x) => Math.sinh(x),
    pts: [-1.5, -0.5, 0.5, 1.5],
  },
  {
    name: 'tanh',
    op: (d) => d.tanh(),
    primal: Math.tanh,
    deriv: (x) => 1 - Math.tanh(x) ** 2,
    pts: [-1.5, -0.5, 0.5, 1.5],
  },
  {
    name: 'asin',
    op: (d) => d.asin(),
    primal: Math.asin,
    deriv: (x) => 1 / Math.sqrt(1 - x * x),
    pts: [-0.7, -0.2, 0.3, 0.6],
  },
  {
    name: 'acos',
    op: (d) => d.acos(),
    primal: Math.acos,
    deriv: (x) => -1 / Math.sqrt(1 - x * x),
    pts: [-0.7, -0.2, 0.3, 0.6],
  },
  {
    name: 'atan',
    op: (d) => d.atan(),
    primal: Math.atan,
    deriv: (x) => 1 / (1 + x * x),
    pts: [-2, -0.5, 0.5, 2],
  },
  {
    name: 'asinh',
    op: (d) => d.asinh(),
    primal: Math.asinh,
    deriv: (x) => 1 / Math.sqrt(x * x + 1),
    pts: [-1.5, 0.5, 2],
  },
  {
    name: 'acosh',
    op: (d) => d.acosh(),
    primal: Math.acosh,
    deriv: (x) => 1 / Math.sqrt(x * x - 1),
    pts: [1.5, 2, 3],
  },
  {
    name: 'atanh',
    op: (d) => d.atanh(),
    primal: Math.atanh,
    deriv: (x) => 1 / (1 - x * x),
    pts: [-0.6, -0.1, 0.4, 0.7],
  },
  {
    name: 'log2',
    op: (d) => d.log2(),
    primal: Math.log2,
    deriv: (x) => 1 / (x * Math.LN2),
    pts: [0.5, 1, 2, 8],
  },
  {
    name: 'log10',
    op: (d) => d.log10(),
    primal: Math.log10,
    deriv: (x) => 1 / (x * Math.LN10),
    pts: [0.5, 1, 2, 8],
  },
  {
    name: 'log1p',
    op: (d) => d.log1p(),
    primal: Math.log1p,
    deriv: (x) => 1 / (1 + x),
    pts: [-0.5, 0, 1, 3],
  },
  {
    name: 'expm1',
    op: (d) => d.expm1(),
    primal: Math.expm1,
    deriv: (x) => Math.exp(x),
    pts: [-1, 0, 0.5, 1],
  },
  {
    name: 'cbrt',
    op: (d) => d.cbrt(),
    primal: Math.cbrt,
    deriv: (x) => 1 / (3 * Math.cbrt(x) ** 2),
    pts: [-8, -1, 1, 8],
  },
];

for (const c of UNARY_CASES) {
  describe(`DualTensor.${c.name} — primal + tangent`, () => {
    it(`${c.name}() primal matches Math.${c.name}`, () => {
      const { primal } = dualUnary(c.op, c.pts);
      for (let i = 0; i < c.pts.length; i++) {
        expect(primal[i]).toBeCloseTo(c.primal(c.pts[i]), 10);
      }
    });

    it(`${c.name}() tangent equals the closed-form derivative (seed = 1)`, () => {
      const { tangent } = dualUnary(c.op, c.pts);
      for (let i = 0; i < c.pts.length; i++) {
        expect(tangent[i]).toBeCloseTo(c.deriv(c.pts[i]), 8);
      }
    });
  });
}

describe('DualTensor.pow — primal + tangent', () => {
  it('pow(k) primal is x^k and tangent is k·x^(k-1)', () => {
    const k = 2.5;
    const pts = [0.5, 1, 2, 3];
    const { primal, tangent } = dualUnary((d) => d.pow(k), pts);
    for (let i = 0; i < pts.length; i++) {
      expect(primal[i]).toBeCloseTo(Math.pow(pts[i], k), 10);
      expect(tangent[i]).toBeCloseTo(k * Math.pow(pts[i], k - 1), 8);
    }
  });
});

describe('DualTensor.sign — primal + zero tangent', () => {
  it('sign() primal is sign(x); tangent is 0', () => {
    const { primal, tangent } = dualUnary((d) => d.sign(), [-3, 2, 0.5, -0.1]);
    expect(Array.from(primal)).toEqual([-1, 1, 1, -1]);
    for (const t of tangent) expect(t).toBe(0);
  });
});

describe('DualTensor.divide — dual-number quotient rule', () => {
  it('(a/b) primal and tangent = (a′·b − a·b′)/b²', () => {
    const aP = new Float64Array([6, 4, 9]);
    const aT = new Float64Array([1, 0, 2]);
    const bP = new Float64Array([2, 2, 3]);
    const bT = new Float64Array([0, 1, 1]);
    const a = new DualTensor([3], aP, aT);
    const b = new DualTensor([3], bP, bT);
    const out = a.divide(b);
    for (let i = 0; i < 3; i++) {
      expect(out.primal[i]).toBeCloseTo(aP[i] / bP[i], 10);
      const expected = (aT[i] * bP[i] - aP[i] * bT[i]) / (bP[i] * bP[i]);
      expect(out.tangent[i]).toBeCloseTo(expected, 10);
    }
  });

  it('aliased self-division a.divide(a) has primal 1 and tangent 0', () => {
    const aP = new Float64Array([2, -3, 5]);
    const aT = new Float64Array([1, 1, 1]);
    const a = new DualTensor([3], aP, aT);
    const out = a.divide(a);
    for (let i = 0; i < 3; i++) {
      expect(out.primal[i]).toBeCloseTo(1, 12);
      expect(out.tangent[i]).toBeCloseTo(0, 12);
    }
  });
});

describe('DualTensor.atan2 — dual-number rule', () => {
  it('atan2(a, b) primal + tangent = (b·a′ − a·b′)/(a²+b²)', () => {
    const aP = new Float64Array([1, 2, -1]);
    const aT = new Float64Array([1, 0, 2]);
    const bP = new Float64Array([1, -1, 2]);
    const bT = new Float64Array([0, 1, 1]);
    const a = new DualTensor([3], aP, aT);
    const b = new DualTensor([3], bP, bT);
    const out = a.atan2(b);
    for (let i = 0; i < 3; i++) {
      expect(out.primal[i]).toBeCloseTo(Math.atan2(aP[i], bP[i]), 10);
      const d = aP[i] * aP[i] + bP[i] * bP[i];
      const expected = (bP[i] * aT[i] - aP[i] * bT[i]) / d;
      expect(out.tangent[i]).toBeCloseTo(expected, 10);
    }
  });
});

describe('DualTensor — chain consistency with reverse mode is exercised elsewhere', () => {
  it('square() matches mul(self) tangent', () => {
    const pts = [1.5, -2, 3];
    const { tangent: viaSquare } = dualUnary((d) => d.square(), pts);
    const { tangent: viaMul } = dualUnary((d) => d.mul(d), pts);
    for (let i = 0; i < pts.length; i++) {
      expect(viaSquare[i]).toBeCloseTo(viaMul[i], 12);
    }
  });
});
