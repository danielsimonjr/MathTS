import { describe, it, expect } from 'vitest';
import {
  rootsHermite,
  rootsLaguerre,
  rootsChebyshevT,
  rootsChebyshevU,
  rootsJacobi,
  gaussHermiteIntegrate,
  gaussLaguerreIntegrate,
} from '../src/numeric/gauss-nodes-extra.js';

const expectArrayClose = (a: number[], b: number[], tol: number): void => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(tol));
};

describe('Gauss-Hermite nodes', () => {
  it('n = 2', () => {
    const r = rootsHermite(2);
    expectArrayClose(r.nodes, [-0.7071067811865476, 0.7071067811865476], 1e-12);
    expectArrayClose(r.weights, [0.886226925452758, 0.886226925452758], 1e-12);
  });

  it('n = 3', () => {
    const r = rootsHermite(3);
    expectArrayClose(r.nodes, [-1.224744871391589, 0, 1.224744871391589], 1e-12);
    expectArrayClose(
      r.weights,
      [0.2954089751509193, 1.1816359006036774, 0.2954089751509193],
      1e-12
    );
  });

  it('integrates x² against e^{-x²} exactly with n = 5', () => {
    expect(gaussHermiteIntegrate((x) => x * x, 5)).toBeCloseTo(Math.sqrt(Math.PI) / 2, 12);
  });
});

describe('Gauss-Laguerre nodes', () => {
  it('n = 2', () => {
    const r = rootsLaguerre(2);
    expectArrayClose(r.nodes, [0.5857864376269049, 3.414213562373095], 1e-12);
    expectArrayClose(r.weights, [0.8535533905932737, 0.14644660940672627], 1e-12);
  });

  it('integrates x² against e^{-x} exactly with n = 5', () => {
    expect(gaussLaguerreIntegrate((x) => x * x, 5)).toBeCloseTo(2, 10);
  });

  it('generalized alpha = 1 weights sum to Γ(2) = 1', () => {
    const r = rootsLaguerre(4, 1);
    expect(r.weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 10);
  });
});

describe('Chebyshev nodes', () => {
  it('T_3 nodes and equal weights', () => {
    const r = rootsChebyshevT(3);
    expectArrayClose(r.nodes, [-0.8660254037844387, 0, 0.8660254037844387], 1e-12);
    expectArrayClose(r.weights, [Math.PI / 3, Math.PI / 3, Math.PI / 3], 1e-12);
  });

  it('U_1 has the single node 0 with weight π/2', () => {
    const r = rootsChebyshevU(1);
    expectArrayClose(r.nodes, [0], 1e-12);
    expectArrayClose(r.weights, [Math.PI / 2], 1e-12);
  });
});

describe('Jacobi nodes', () => {
  it('α = β = 0 reproduces Gauss-Legendre n = 3', () => {
    const r = rootsJacobi(3, 0, 0);
    expectArrayClose(r.nodes, [-Math.sqrt(3 / 5), 0, Math.sqrt(3 / 5)], 1e-12);
    expectArrayClose(r.weights, [5 / 9, 8 / 9, 5 / 9], 1e-12);
  });
});

describe('gauss-nodes-extra argument validation', () => {
  it('rejects non-positive degrees', () => {
    expect(() => rootsHermite(0)).toThrow(RangeError);
    expect(() => rootsChebyshevT(1.5)).toThrow(RangeError);
  });
});
