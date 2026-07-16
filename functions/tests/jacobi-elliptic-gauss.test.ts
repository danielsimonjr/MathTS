import { describe, it, expect } from 'vitest';
import { jacobiSN, jacobiCN, jacobiDN, rootsLegendre } from '../src/index.js';

describe('Jacobi elliptic + Gauss-Legendre nodes', () => {
  it('jacobiSN/CN/DN(0.5, 0.3) match mpmath', () => {
    expect(jacobiSN(0.5, 0.3)).toBeCloseTo(0.4742156227, 8);
    expect(jacobiCN(0.5, 0.3)).toBeCloseTo(0.8804087364, 8);
    expect(jacobiDN(0.5, 0.3)).toBeCloseTo(0.9656789647, 8);
  });
  it('identity sn^2 + cn^2 = 1', () => {
    const s = jacobiSN(0.7, 0.4),
      c = jacobiCN(0.7, 0.4);
    expect(s * s + c * c).toBeCloseTo(1, 10);
  });
  it('m=0: sn=sin, dn=1', () => {
    expect(jacobiSN(0.5, 0)).toBeCloseTo(Math.sin(0.5), 10);
    expect(jacobiDN(0.5, 0)).toBeCloseTo(1, 10);
  });
  it('rootsLegendre(3) matches scipy', () => {
    const { nodes, weights } = rootsLegendre(3);
    expect(nodes[0]).toBeCloseTo(-0.7745966692, 8);
    expect(nodes[1]).toBeCloseTo(0, 8);
    expect(nodes[2]).toBeCloseTo(0.7745966692, 8);
    expect(weights[0]).toBeCloseTo(0.5555555556, 8);
    expect(weights[1]).toBeCloseTo(0.8888888889, 8);
  });
  it('rootsLegendre(4) integrates x^2 exactly: ∫_-1^1 x^2 = 2/3', () => {
    const { nodes, weights } = rootsLegendre(4);
    const I = nodes.reduce((s, x, i) => s + weights[i] * x * x, 0);
    expect(I).toBeCloseTo(2 / 3, 10);
  });
});
