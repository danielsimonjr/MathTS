/**
 * Tests for reverse-mode AD over TapedTensor elementwise transcendentals.
 *
 * Methods covered: log, exp, sin, cos, tan, sqrt, square, pow, reciprocal, abs,
 *                  sub, divide.
 *
 * For each method:
 *   - Forward-correctness test: primal output equals the corresponding Math.* call.
 *   - Gradient-check test: analytical reverse-mode gradient vs central finite differences
 *     (ε = 1e-6, tolerance = 1e-7).
 *
 * Special cases:
 *   - pow tested with integer and fractional k.
 *   - abs at exact zero — subgradient = 0.
 *   - divide: aliased self-division (a/a → grad = 0).
 *
 * Composition tests:
 *   - taped.log().sum() → gradient = 1/x.
 *   - a.contract(b).square().sum() → gradients across both leaves correct.
 *   - sub and divide chained in multi-step graphs.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { idx } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '../src/tape.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Allocate a leaf TapedTensor and run reverse-mode AD on fn(leaf).
 * Seeds the backward pass with all-ones (sum gradient).
 */
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

/**
 * Numerical gradient (central finite differences) of sum(f(x)) w.r.t. x.
 * ε = 1e-6.
 */
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

function assertClose(a: Float64Array, b: Float64Array, tol = 1e-7, label = ''): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    if (diff >= tol) {
      throw new Error(`${label}: element [${i}] differs: ${a[i]} vs ${b[i]}, diff=${diff}`);
    }
    expect(diff).toBeLessThan(tol);
  }
}

/**
 * Two-leaf reverse-mode helper.
 * Computes fn(leafA, leafB), seeds backward with all-ones, returns both gradients.
 */
function reverseGradTwo(
  fn: (a: TapedTensor, b: TapedTensor) => TapedTensor,
  aData: Float64Array,
  aShape: ReadonlyArray<number>,
  bData: Float64Array,
  bShape: ReadonlyArray<number>
): { gradA: Float64Array; gradB: Float64Array; value: Float64Array } {
  const tape = new Tape();
  const { id: idA } = tape.allocate(aData.length);
  const { id: idB } = tape.allocate(bData.length);
  const leafA = new TapedTensor(aShape, new Float64Array(aData), tape, idA);
  const leafB = new TapedTensor(bShape, new Float64Array(bData), tape, idB);
  const out = fn(leafA, leafB);
  tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
  return {
    gradA: new Float64Array(tape.getInputGrad(idA)!),
    gradB: new Float64Array(tape.getInputGrad(idB)!),
    value: new Float64Array(out.primal),
  };
}

/**
 * Numerical gradient (central FD) of sum(f(a, b)) w.r.t. both a and b.
 */
function numericalGradTwo(
  fn: (aData: Float64Array, bData: Float64Array) => Float64Array,
  aData: Float64Array,
  bData: Float64Array,
  eps = 1e-5
): { numGradA: Float64Array; numGradB: Float64Array } {
  const numGradA = new Float64Array(aData.length);
  for (let i = 0; i < aData.length; i++) {
    const aPlus = new Float64Array(aData);
    aPlus[i] += eps;
    const aMinus = new Float64Array(aData);
    aMinus[i] -= eps;
    const fPlus = fn(aPlus, bData).reduce((s, v) => s + v, 0);
    const fMinus = fn(aMinus, bData).reduce((s, v) => s + v, 0);
    numGradA[i] = (fPlus - fMinus) / (2 * eps);
  }
  const numGradB = new Float64Array(bData.length);
  for (let i = 0; i < bData.length; i++) {
    const bPlus = new Float64Array(bData);
    bPlus[i] += eps;
    const bMinus = new Float64Array(bData);
    bMinus[i] -= eps;
    const fPlus = fn(aData, bPlus).reduce((s, v) => s + v, 0);
    const fMinus = fn(aData, bMinus).reduce((s, v) => s + v, 0);
    numGradB[i] = (fPlus - fMinus) / (2 * eps);
  }
  return { numGradA, numGradB };
}

// ---------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------

describe('TapedTensor.log — forward + gradient', () => {
  it('log() primal matches Math.log element-wise', () => {
    const xData = new Float64Array([1, Math.E, 2, 4]);
    const { value } = reverseGradOne((t) => t.log(), xData, [4]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(Math.log(xData[i]), 12);
    }
  });

  it('log() gradient = 1/x (analytical)', () => {
    const xData = new Float64Array([1, 2, 4]);
    const { grad } = reverseGradOne((t) => t.log(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(1 / xData[i], 10);
    }
  });

  it('log() gradient matches finite differences', () => {
    const xData = new Float64Array([0.5, 1, 2, 3]);
    const shape: ReadonlyArray<number> = [4];
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = Math.log(d[i]);
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.log(), xData, shape);
    assertClose(grad, numGrad, 1e-7, 'log gradient');
  });
});

// ---------------------------------------------------------------------------
// exp
// ---------------------------------------------------------------------------

describe('TapedTensor.exp — forward + gradient', () => {
  it('exp() primal matches Math.exp element-wise', () => {
    const xData = new Float64Array([0, 1, -1, 2]);
    const { value } = reverseGradOne((t) => t.exp(), xData, [4]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(Math.exp(xData[i]), 12);
    }
  });

  it('exp() gradient = exp(x) (= dY * y, dY=1)', () => {
    const xData = new Float64Array([0, 1, 2]);
    const { grad } = reverseGradOne((t) => t.exp(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(Math.exp(xData[i]), 10);
    }
  });

  it('exp() gradient matches finite differences', () => {
    const xData = new Float64Array([-1, 0, 1, 2]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = Math.exp(d[i]);
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.exp(), xData, [4]);
    assertClose(grad, numGrad, 1e-7, 'exp gradient');
  });
});

// ---------------------------------------------------------------------------
// sin
// ---------------------------------------------------------------------------

describe('TapedTensor.sin — forward + gradient', () => {
  it('sin() primal matches Math.sin element-wise', () => {
    const xData = new Float64Array([0, Math.PI / 6, Math.PI / 2, Math.PI]);
    const { value } = reverseGradOne((t) => t.sin(), xData, [4]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(Math.sin(xData[i]), 12);
    }
  });

  it('sin() gradient = cos(x)', () => {
    const xData = new Float64Array([0, 1, 2]);
    const { grad } = reverseGradOne((t) => t.sin(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(Math.cos(xData[i]), 10);
    }
  });

  it('sin() gradient matches finite differences', () => {
    const xData = new Float64Array([0.1, 0.5, 1.0, 1.5]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = Math.sin(d[i]);
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.sin(), xData, [4]);
    assertClose(grad, numGrad, 1e-7, 'sin gradient');
  });
});

// ---------------------------------------------------------------------------
// cos
// ---------------------------------------------------------------------------

describe('TapedTensor.cos — forward + gradient', () => {
  it('cos() primal matches Math.cos element-wise', () => {
    const xData = new Float64Array([0, Math.PI / 3, Math.PI]);
    const { value } = reverseGradOne((t) => t.cos(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(Math.cos(xData[i]), 12);
    }
  });

  it('cos() gradient = -sin(x)', () => {
    const xData = new Float64Array([0, 1, 2]);
    const { grad } = reverseGradOne((t) => t.cos(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(-Math.sin(xData[i]), 10);
    }
  });

  it('cos() gradient matches finite differences', () => {
    const xData = new Float64Array([0.2, 0.7, 1.2, 2.0]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = Math.cos(d[i]);
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.cos(), xData, [4]);
    assertClose(grad, numGrad, 1e-7, 'cos gradient');
  });
});

// ---------------------------------------------------------------------------
// tan
// ---------------------------------------------------------------------------

describe('TapedTensor.tan — forward + gradient', () => {
  it('tan() primal matches Math.tan element-wise', () => {
    const xData = new Float64Array([0, 0.5, 1.0]);
    const { value } = reverseGradOne((t) => t.tan(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(Math.tan(xData[i]), 12);
    }
  });

  it('tan() gradient = 1/cos²(x)', () => {
    const xData = new Float64Array([0, 0.5, 1.0]);
    const { grad } = reverseGradOne((t) => t.tan(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      const c = Math.cos(xData[i]);
      expect(grad[i]).toBeCloseTo(1 / (c * c), 10);
    }
  });

  it('tan() gradient matches finite differences', () => {
    const xData = new Float64Array([0.1, 0.4, 0.8, 1.2]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = Math.tan(d[i]);
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.tan(), xData, [4]);
    assertClose(grad, numGrad, 1e-7, 'tan gradient');
  });
});

// ---------------------------------------------------------------------------
// sqrt
// ---------------------------------------------------------------------------

describe('TapedTensor.sqrt — forward + gradient', () => {
  it('sqrt() primal matches Math.sqrt element-wise', () => {
    const xData = new Float64Array([1, 4, 9, 16]);
    const { value } = reverseGradOne((t) => t.sqrt(), xData, [4]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(Math.sqrt(xData[i]), 12);
    }
  });

  it('sqrt() gradient = 1/(2*sqrt(x))', () => {
    const xData = new Float64Array([1, 4, 9]);
    const { grad } = reverseGradOne((t) => t.sqrt(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(1 / (2 * Math.sqrt(xData[i])), 10);
    }
  });

  it('sqrt() gradient matches finite differences', () => {
    const xData = new Float64Array([0.5, 1, 2, 5]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = Math.sqrt(d[i]);
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.sqrt(), xData, [4]);
    assertClose(grad, numGrad, 1e-7, 'sqrt gradient');
  });
});

// ---------------------------------------------------------------------------
// square
// ---------------------------------------------------------------------------

describe('TapedTensor.square — forward + gradient', () => {
  it('square() primal matches x*x element-wise', () => {
    const xData = new Float64Array([1, 2, 3, -2]);
    const { value } = reverseGradOne((t) => t.square(), xData, [4]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(xData[i] * xData[i], 12);
    }
  });

  it('square() gradient = 2x', () => {
    const xData = new Float64Array([1, -3, 2]);
    const { grad } = reverseGradOne((t) => t.square(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(2 * xData[i], 10);
    }
  });

  it('square() gradient matches finite differences', () => {
    const xData = new Float64Array([-2, -1, 0, 1, 2]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = d[i] * d[i];
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.square(), xData, [5]);
    assertClose(grad, numGrad, 1e-7, 'square gradient');
  });
});

// ---------------------------------------------------------------------------
// pow
// ---------------------------------------------------------------------------

describe('TapedTensor.pow — forward + gradient', () => {
  it('pow(3) primal matches x^3 element-wise', () => {
    const xData = new Float64Array([1, 2, 3]);
    const { value } = reverseGradOne((t) => t.pow(3), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(Math.pow(xData[i], 3), 12);
    }
  });

  it('pow(3) gradient = 3*x^2', () => {
    const xData = new Float64Array([1, 2, 3]);
    const { grad } = reverseGradOne((t) => t.pow(3), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(3 * xData[i] * xData[i], 10);
    }
  });

  it('pow(0.5) is equivalent to sqrt, gradient = 0.5*x^(-0.5)', () => {
    const xData = new Float64Array([1, 4, 9]);
    const { grad: gradPow } = reverseGradOne((t) => t.pow(0.5), xData, [3]);
    const { grad: gradSqrt } = reverseGradOne((t) => t.sqrt(), xData, [3]);
    assertClose(gradPow, gradSqrt, 1e-10, 'pow(0.5) vs sqrt');
  });

  it('pow(k) gradient matches finite differences for k=2.5', () => {
    const k = 2.5;
    const xData = new Float64Array([0.5, 1, 2, 3]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = Math.pow(d[i], k);
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.pow(k), xData, [4]);
    assertClose(grad, numGrad, 1e-7, `pow(${k}) gradient`);
  });
});

// ---------------------------------------------------------------------------
// reciprocal
// ---------------------------------------------------------------------------

describe('TapedTensor.reciprocal — forward + gradient', () => {
  it('reciprocal() primal matches 1/x element-wise', () => {
    const xData = new Float64Array([1, 2, 4, 0.5]);
    const { value } = reverseGradOne((t) => t.reciprocal(), xData, [4]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(1 / xData[i], 12);
    }
  });

  it('reciprocal() gradient = -1/x²', () => {
    const xData = new Float64Array([1, 2, 4]);
    const { grad } = reverseGradOne((t) => t.reciprocal(), xData, [3]);
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(-1 / (xData[i] * xData[i]), 10);
    }
  });

  it('reciprocal() gradient matches finite differences', () => {
    const xData = new Float64Array([0.5, 1, 2, 5]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = 1 / d[i];
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.reciprocal(), xData, [4]);
    assertClose(grad, numGrad, 1e-7, 'reciprocal gradient');
  });
});

// ---------------------------------------------------------------------------
// abs
// ---------------------------------------------------------------------------

describe('TapedTensor.abs — forward + gradient', () => {
  it('abs() primal matches Math.abs element-wise', () => {
    const xData = new Float64Array([-3, -1, 0, 1, 4]);
    const { value } = reverseGradOne((t) => t.abs(), xData, [5]);
    for (let i = 0; i < xData.length; i++) {
      expect(value[i]).toBeCloseTo(Math.abs(xData[i]), 12);
    }
  });

  it('abs() gradient = sign(x), subgradient = 0 at exact zero', () => {
    const xData = new Float64Array([-3, 0, 2]);
    const { grad } = reverseGradOne((t) => t.abs(), xData, [3]);
    expect(grad[0]).toBeCloseTo(-1, 12); // sign(-3) = -1
    expect(grad[1]).toBeCloseTo(0, 12); // subgradient at 0 = 0
    expect(grad[2]).toBeCloseTo(1, 12); // sign(2) = 1
  });

  it('abs() gradient matches finite differences (away from zero)', () => {
    const xData = new Float64Array([-2, -1, 1, 3]);
    const fwd = (d: Float64Array) => {
      const out = new Float64Array(d.length);
      for (let i = 0; i < d.length; i++) out[i] = Math.abs(d[i]);
      return out;
    };
    const numGrad = numericalGrad(fwd, xData);
    const { grad } = reverseGradOne((t) => t.abs(), xData, [4]);
    assertClose(grad, numGrad, 1e-7, 'abs gradient');
  });
});

// ---------------------------------------------------------------------------
// Composition: log().sum() → gradient = 1/x
// ---------------------------------------------------------------------------

describe('TapedTensor composition — log().sum()', () => {
  it('taped.log().sum() gives gradient 1/x at each element', () => {
    const xData = new Float64Array([1, 2, 4, 8]);
    const shape: ReadonlyArray<number> = [4];
    const tape = new Tape();
    const { id } = tape.allocate(xData.length);
    const leaf = new TapedTensor(shape, new Float64Array(xData), tape, id);
    const out = leaf.log().sum();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    for (let i = 0; i < xData.length; i++) {
      expect(grad[i]).toBeCloseTo(1 / xData[i], 10);
    }
  });
});

// ---------------------------------------------------------------------------
// Composition: contract().square().sum() → gradients across both leaves
// ---------------------------------------------------------------------------

describe('TapedTensor composition — a.contract(b).square().sum()', () => {
  it('A.contract(B).square().sum() gradients match finite differences for both leaves', () => {
    // A: [2,2], B: [2,2], shared axis has size 2.
    // Y = A @ B (as a contraction), then Z = Y^2, S = sum(Z).
    // This tests the chain rule through three operations.
    const iA = idx(2, 'i');
    const kAB = idx(2, 'k'); // shared axis — size 2
    const jB = idx(2, 'j');

    const aData = new Float64Array([1, 2, 3, 4]); // [2,2]
    const bData = new Float64Array([0.5, 1, 1.5, 2]); // [2,2]
    const aShape: ReadonlyArray<number> = [2, 2];
    const bShape: ReadonlyArray<number> = [2, 2];

    // Analytical via reverse-mode AD.
    const tape = new Tape();
    const { id: idA } = tape.allocate(aData.length);
    const { id: idB } = tape.allocate(bData.length);
    const A = new TapedTensor(aShape, new Float64Array(aData), tape, idA, [iA, kAB]);
    const B = new TapedTensor(bShape, new Float64Array(bData), tape, idB, [kAB, jB]);
    const Y = A.contract(B).square().sum();
    tape.backward(Y.id, new Float64Array([1]));
    const gradA = new Float64Array(tape.getInputGrad(idA)!);
    const gradB = new Float64Array(tape.getInputGrad(idB)!);

    // Numerical gradient w.r.t. A.
    const numGradA = new Float64Array(aData.length);
    const eps = 1e-6;
    for (let i = 0; i < aData.length; i++) {
      const fwd = (aD: Float64Array, bD: Float64Array): number => {
        const tA = new Tensor(aShape, new Float64Array(aD), [iA, kAB]);
        const tB = new Tensor(bShape, new Float64Array(bD), [kAB, jB]);
        const c = tA.contract(tB);
        let s = 0;
        for (let k = 0; k < c.data.length; k++) s += c.data[k] * c.data[k];
        return s;
      };
      const aPlus = new Float64Array(aData);
      aPlus[i] += eps;
      const aMinus = new Float64Array(aData);
      aMinus[i] -= eps;
      numGradA[i] = (fwd(aPlus, bData) - fwd(aMinus, bData)) / (2 * eps);
    }

    // Numerical gradient w.r.t. B.
    const numGradB = new Float64Array(bData.length);
    for (let i = 0; i < bData.length; i++) {
      const fwd = (aD: Float64Array, bD: Float64Array): number => {
        const tA = new Tensor(aShape, new Float64Array(aD), [iA, kAB]);
        const tB = new Tensor(bShape, new Float64Array(bD), [kAB, jB]);
        const c = tA.contract(tB);
        let s = 0;
        for (let k = 0; k < c.data.length; k++) s += c.data[k] * c.data[k];
        return s;
      };
      const bPlus = new Float64Array(bData);
      bPlus[i] += eps;
      const bMinus = new Float64Array(bData);
      bMinus[i] -= eps;
      numGradB[i] = (fwd(aData, bPlus) - fwd(aData, bMinus)) / (2 * eps);
    }

    assertClose(gradA, numGradA, 1e-7, 'dA for contract.square.sum');
    assertClose(gradB, numGradB, 1e-7, 'dB for contract.square.sum');
  });
});

// ---------------------------------------------------------------------------
// sub — forward + gradient
// ---------------------------------------------------------------------------

describe('TapedTensor.sub — forward + gradient', () => {
  it('sub() primal is a - b element-wise (same shape)', () => {
    const aData = new Float64Array([5, 3, 8, 1]);
    const bData = new Float64Array([2, 1, 5, 4]);
    const { value } = reverseGradTwo((a, b) => a.sub(b), aData, [4], bData, [4]);
    for (let i = 0; i < aData.length; i++) {
      expect(value[i]).toBeCloseTo(aData[i] - bData[i], 12);
    }
  });

  it('sub() gradient w.r.t. a is +dY (all-ones seed → gradA = 1 per element)', () => {
    const aData = new Float64Array([3, 7, 2]);
    const bData = new Float64Array([1, 4, 6]);
    const { gradA } = reverseGradTwo((a, b) => a.sub(b), aData, [3], bData, [3]);
    for (let i = 0; i < gradA.length; i++) {
      expect(gradA[i]).toBeCloseTo(1, 12);
    }
  });

  it('sub() gradient w.r.t. b is -dY (all-ones seed → gradB = -1 per element)', () => {
    const aData = new Float64Array([3, 7, 2]);
    const bData = new Float64Array([1, 4, 6]);
    const { gradB } = reverseGradTwo((a, b) => a.sub(b), aData, [3], bData, [3]);
    for (let i = 0; i < gradB.length; i++) {
      expect(gradB[i]).toBeCloseTo(-1, 12);
    }
  });

  it('sub() gradients match finite differences', () => {
    const aData = new Float64Array([2, -1, 4, 0.5]);
    const bData = new Float64Array([1, 3, -2, 0.1]);
    const fwd = (aD: Float64Array, bD: Float64Array) => {
      const out = new Float64Array(aD.length);
      for (let i = 0; i < out.length; i++) out[i] = aD[i] - bD[i];
      return out;
    };
    const { numGradA, numGradB } = numericalGradTwo(fwd, aData, bData);
    const { gradA, gradB } = reverseGradTwo((a, b) => a.sub(b), aData, [4], bData, [4]);
    assertClose(gradA, numGradA, 1e-6, 'sub gradA');
    assertClose(gradB, numGradB, 1e-6, 'sub gradB');
  });

  it('sub() chained in a multi-step graph: ((a - b) * a).sum()', () => {
    // f = sum((a - b) * a) = sum(a² - a·b)
    // df/da = 2a - b, df/db = -a
    const aData = new Float64Array([2, 3]);
    const bData = new Float64Array([1, 1]);
    const tape = new Tape();
    const { id: idA } = tape.allocate(aData.length);
    const { id: idB } = tape.allocate(bData.length);
    const leafA = new TapedTensor([2], new Float64Array(aData), tape, idA);
    const leafB = new TapedTensor([2], new Float64Array(bData), tape, idB);
    const out = leafA.sub(leafB).mul(leafA).sum();
    tape.backward(out.id, new Float64Array([1]));
    const gradA = tape.getInputGrad(idA)!;
    const gradB = tape.getInputGrad(idB)!;
    // df/da[i] = 2*a[i] - b[i]
    for (let i = 0; i < aData.length; i++) {
      expect(gradA[i]).toBeCloseTo(2 * aData[i] - bData[i], 8);
    }
    // df/db[i] = -a[i]
    for (let i = 0; i < bData.length; i++) {
      expect(gradB[i]).toBeCloseTo(-aData[i], 8);
    }
  });
});

// ---------------------------------------------------------------------------
// divide — forward + gradient
// ---------------------------------------------------------------------------

describe('TapedTensor.divide — forward + gradient', () => {
  it('divide() primal is a / b element-wise (same shape)', () => {
    const aData = new Float64Array([6, 4, 9, 1]);
    const bData = new Float64Array([2, 2, 3, 5]);
    const { value } = reverseGradTwo((a, b) => a.divide(b), aData, [4], bData, [4]);
    for (let i = 0; i < aData.length; i++) {
      expect(value[i]).toBeCloseTo(aData[i] / bData[i], 12);
    }
  });

  it('divide() gradient w.r.t. a is dY/b (all-ones seed → 1/b)', () => {
    const aData = new Float64Array([6, 4, 9]);
    const bData = new Float64Array([2, 2, 3]);
    const { gradA } = reverseGradTwo((a, b) => a.divide(b), aData, [3], bData, [3]);
    for (let i = 0; i < gradA.length; i++) {
      expect(gradA[i]).toBeCloseTo(1 / bData[i], 10);
    }
  });

  it('divide() gradient w.r.t. b is -dY*a/b² (all-ones seed → -a/b²)', () => {
    const aData = new Float64Array([6, 4, 9]);
    const bData = new Float64Array([2, 2, 3]);
    const { gradB } = reverseGradTwo((a, b) => a.divide(b), aData, [3], bData, [3]);
    for (let i = 0; i < gradB.length; i++) {
      expect(gradB[i]).toBeCloseTo(-aData[i] / (bData[i] * bData[i]), 10);
    }
  });

  it('divide() gradients match finite differences', () => {
    const aData = new Float64Array([3, 5, 2, 8]);
    const bData = new Float64Array([1, 2, 4, 0.5]);
    const fwd = (aD: Float64Array, bD: Float64Array) => {
      const out = new Float64Array(aD.length);
      for (let i = 0; i < out.length; i++) out[i] = aD[i] / bD[i];
      return out;
    };
    const { numGradA, numGradB } = numericalGradTwo(fwd, aData, bData, 1e-5);
    const { gradA, gradB } = reverseGradTwo((a, b) => a.divide(b), aData, [4], bData, [4]);
    assertClose(gradA, numGradA, 1e-6, 'divide gradA');
    assertClose(gradB, numGradB, 1e-6, 'divide gradB');
  });

  it('divide() aliased self-division (a.divide(a)) has zero gradient', () => {
    // d(a/a)/da = d(1)/da = 0 everywhere.
    const aData = new Float64Array([2, -3, 5]);
    const tape = new Tape();
    const { id } = tape.allocate(aData.length);
    const leaf = new TapedTensor([3], new Float64Array(aData), tape, id);
    const out = leaf.divide(leaf);
    tape.backward(out.id, new Float64Array(out.primal.length).fill(1));
    const grad = tape.getInputGrad(id)!;
    for (let i = 0; i < grad.length; i++) {
      expect(grad[i]).toBeCloseTo(0, 12);
    }
  });

  it('divide() chained with mul and add in a multi-step graph', () => {
    // f = sum((a / b) * b + a) = sum(a + a) = sum(2a)  (algebraically)
    // df/da = 2 for each element, df/db = 0 for each element.
    // This tests multi-node graph traversal.
    const aData = new Float64Array([3, 1, 4]);
    const bData = new Float64Array([2, 5, 1]);
    const tape = new Tape();
    const { id: idA } = tape.allocate(aData.length);
    const { id: idB } = tape.allocate(bData.length);
    const leafA = new TapedTensor([3], new Float64Array(aData), tape, idA);
    const leafB = new TapedTensor([3], new Float64Array(bData), tape, idB);
    // (a / b) * b + a
    const div = leafA.divide(leafB);
    const restored = div.mul(leafB);
    const result = restored.add(leafA);
    const out = result.sum();
    tape.backward(out.id, new Float64Array([1]));
    const gradA = tape.getInputGrad(idA)!;
    const gradB = tape.getInputGrad(idB)!;
    for (let i = 0; i < gradA.length; i++) {
      expect(gradA[i]).toBeCloseTo(2, 8);
    }
    for (let i = 0; i < gradB.length; i++) {
      expect(gradB[i]).toBeCloseTo(0, 8);
    }
  });
});
