/**
 * Tests for `solveDAE` — semi-explicit index-1 DAE via a variable-step BDF(1–2)
 * integrator with a coupled Newton solve for (y, z).
 *
 * scipy has NO DAE solver, so every oracle here is implementation-independent:
 *  - Manufactured / closed-form solutions of coupled index-1 DAEs.
 *  - The constraint-residual invariant |g(t, y, z)| ≈ 0 over the WHOLE trajectory
 *    (the defining property of a DAE solver — an ODE solver drifts off the manifold).
 *  - A reduce-to-ODE cross-check: a DAE whose constraint solves explicitly for
 *    z = z(t, y), substituted to an ODE with a KNOWN closed form.
 *  - A classic RC-circuit index-1 DAE with a closed-form solution.
 */
import { describe, it, expect } from 'vitest';
import { solveDAE } from '../src/typed/numeric.js';

/** Max relative error of two equal-length vectors (denominator = max |exact|). */
function maxRelErr(numeric: number[], exact: number[]): number {
  let maxAbs = 0;
  let maxDen = 0;
  for (let i = 0; i < exact.length; i++) {
    maxAbs = Math.max(maxAbs, Math.abs(numeric[i] - exact[i]));
    maxDen = Math.max(maxDen, Math.abs(exact[i]));
  }
  return maxAbs / Math.max(maxDen, 1e-300);
}

describe('solveDAE — manufactured / closed-form coupled index-1 DAE', () => {
  // y' = f = z − 2y,  0 = g = z − (t + y)  ⇒ on the manifold z = t + y, so
  // y' = (t + y) − 2y = t − y  ⇒  y = t − 1 + (y0 + 1) e^{−t},  z = t + y.
  // g_z = 1 (index-1). y0 = 1, consistent z0 = t0 + y0 = 1.
  const f = (t: number, y: number[], z: number[]) => [z[0] - 2 * y[0]];
  const g = (t: number, y: number[], z: number[]) => [z[0] - (t + y[0])];
  const yExact = (t: number) => t - 1 + 2 * Math.exp(-t);
  const zExact = (t: number) => t + yExact(t);

  it('recovers y(t), z(t) to ~1e-6 at the final time', () => {
    const sol = solveDAE(f, g, [0, 3], 1, 1, { tol: 1e-9 });
    const tf = sol.t[sol.t.length - 1];
    expect(tf).toBeCloseTo(3, 10);
    const yN = sol.y as number[];
    const zN = sol.z as number[];
    const yErr = maxRelErr([yN[yN.length - 1]], [yExact(3)]);
    const zErr = maxRelErr([zN[zN.length - 1]], [zExact(3)]);
    expect(yErr).toBeLessThan(1e-6);
    expect(zErr).toBeLessThan(1e-6);
  });

  it('recovers y(t), z(t) to ~1e-6 across the WHOLE trajectory', () => {
    const sol = solveDAE(f, g, [0, 3], 1, 1, { tol: 1e-9 });
    const yN = sol.y as number[];
    const zN = sol.z as number[];
    let maxY = 0;
    let maxZ = 0;
    for (let i = 0; i < sol.t.length; i++) {
      maxY = Math.max(maxY, Math.abs(yN[i] - yExact(sol.t[i])));
      maxZ = Math.max(maxZ, Math.abs(zN[i] - zExact(sol.t[i])));
    }
    expect(maxY).toBeLessThan(1e-6);
    expect(maxZ).toBeLessThan(1e-6);
  });

  it('constraint residual |g(t, y, z)| stays < 1e-8 at every output step', () => {
    const sol = solveDAE(f, g, [0, 3], 1, 1, { tol: 1e-8 });
    const yN = sol.y as number[];
    const zN = sol.z as number[];
    let maxRes = 0;
    for (let i = 0; i < sol.t.length; i++) {
      const res = Math.abs(g(sol.t[i], [yN[i]], [zN[i]])[0]);
      maxRes = Math.max(maxRes, res);
    }
    // The defining DAE invariant: the algebraic block is solved to Newton tol every step.
    expect(maxRes).toBeLessThan(1e-8);
  });

  it('solves for a consistent z0 when z0 is omitted (scalar z default)', () => {
    // Omit z0 → solver Newton-solves g(0, y0, z0) = 0. Here z0 = 0 + 1 = 1.
    const sol = solveDAE(f, g, [0, 1], 1, undefined, { tol: 1e-8 });
    const zN = sol.z as number[];
    expect(zN[0]).toBeCloseTo(1, 8); // consistent z0 found
    const yN = sol.y as number[];
    expect(yN[yN.length - 1]).toBeCloseTo(yExact(1), 5);
  });

  it('refines an inconsistent z0 guess onto the manifold before stepping', () => {
    // Deliberately wrong z0 guess (5 instead of consistent 1) → gets corrected.
    const sol = solveDAE(f, g, [0, 1], 1, 5, { tol: 1e-9 });
    const zN = sol.z as number[];
    expect(zN[0]).toBeCloseTo(1, 6);
    expect(Math.abs(g(0, [1], [zN[0]])[0])).toBeLessThan(1e-8);
  });
});

describe('solveDAE — reduce-to-ODE cross-check', () => {
  // Same system reduces to the ODE y' = t − y (closed form above). Cross-check the
  // DAE solution against a direct integration of that ODE by an independent method
  // (classic RK4 fixed-step reference computed in-test — implementation-independent).
  const f = (t: number, y: number[], z: number[]) => [z[0] - 2 * y[0]];
  const g = (t: number, y: number[], z: number[]) => [z[0] - (t + y[0])];

  function rk4Ref(tf: number): number {
    // y' = t − y, y(0) = 1.
    const ode = (t: number, y: number) => t - y;
    let y = 1;
    const N = 200000;
    const h = tf / N;
    let t = 0;
    for (let i = 0; i < N; i++) {
      const k1 = ode(t, y);
      const k2 = ode(t + h / 2, y + (h / 2) * k1);
      const k3 = ode(t + h / 2, y + (h / 2) * k2);
      const k4 = ode(t + h, y + h * k3);
      y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      t += h;
    }
    return y;
  }

  it('DAE y(T) matches the reduced ODE integrated independently', () => {
    const T = 2;
    const sol = solveDAE(f, g, [0, T], 1, 1, { tol: 1e-9 });
    const yN = sol.y as number[];
    const ref = rk4Ref(T);
    const delta = Math.abs(yN[yN.length - 1] - ref);
    expect(delta).toBeLessThan(1e-6);
  });
});

describe('solveDAE — classic RC-circuit index-1 DAE', () => {
  // C·V' = i,  i·R = Vs − V  →  semi-explicit: y = V (differential), z = i (algebraic).
  // C = R = Vs = 1, V(0) = 0  ⇒  V = 1 − e^{−t},  i = e^{−t}.
  const f = (t: number, y: number[], z: number[]) => [z[0]]; // V' = i
  const g = (t: number, y: number[], z: number[]) => [z[0] - (1 - y[0])]; // i − (Vs − V) = 0

  it('recovers V = 1 − e^{−t}, i = e^{−t}', () => {
    const sol = solveDAE(f, g, [0, 4], 0, 1, { tol: 1e-9 });
    const V = sol.y as number[];
    const i = sol.z as number[];
    let maxV = 0;
    let maxI = 0;
    let maxRes = 0;
    for (let k = 0; k < sol.t.length; k++) {
      const t = sol.t[k];
      maxV = Math.max(maxV, Math.abs(V[k] - (1 - Math.exp(-t))));
      maxI = Math.max(maxI, Math.abs(i[k] - Math.exp(-t)));
      maxRes = Math.max(maxRes, Math.abs(g(t, [V[k]], [i[k]])[0]));
    }
    expect(maxV).toBeLessThan(1e-6);
    expect(maxI).toBeLessThan(1e-6);
    expect(maxRes).toBeLessThan(1e-8);
  });
});

describe('solveDAE — vector system with non-identity ∂g/∂z', () => {
  // y1' = 2 z1, 0 = 2 z1 + y1  → z1 = −y1/2, y1' = −y1 → y1 = e^{−t}, z1 = −e^{−t}/2.
  // y2' =  z2 , 0 =  z2 + 2 y2 → z2 = −2 y2, y2' = −2 y2 → y2 = e^{−2t}, z2 = −2 e^{−2t}.
  // ∂g/∂z = diag(2, 1) (nonsingular, non-identity).
  const f = (t: number, y: number[], z: number[]) => [2 * z[0], z[1]];
  const g = (t: number, y: number[], z: number[]) => [2 * z[0] + y[0], z[1] + 2 * y[1]];

  it('recovers the two decoupled exponentials + constraint residual', () => {
    const sol = solveDAE(f, g, [0, 2], [1, 1], [-0.5, -2], { tol: 1e-9 });
    const y = sol.y as number[][];
    const z = sol.z as number[][];
    let maxErr = 0;
    let maxRes = 0;
    for (let k = 0; k < sol.t.length; k++) {
      const t = sol.t[k];
      maxErr = Math.max(
        maxErr,
        Math.abs(y[k][0] - Math.exp(-t)),
        Math.abs(y[k][1] - Math.exp(-2 * t)),
        Math.abs(z[k][0] + Math.exp(-t) / 2),
        Math.abs(z[k][1] + 2 * Math.exp(-2 * t))
      );
      const gv = g(t, y[k], z[k]);
      maxRes = Math.max(maxRes, Math.abs(gv[0]), Math.abs(gv[1]));
    }
    expect(maxErr).toBeLessThan(1e-5);
    expect(maxRes).toBeLessThan(1e-8);
  });
});

describe('solveDAE — analytic Jacobian matches finite-difference', () => {
  const f = (t: number, y: number[], z: number[]) => [z[0] - 2 * y[0]];
  const g = (t: number, y: number[], z: number[]) => [z[0] - (t + y[0])];
  const jacobian = () => ({ fy: [[-2]], fz: [[1]], gy: [[-1]], gz: [[1]] });

  it('produces the same solution with an analytic Jacobian as with FD', () => {
    const fd = solveDAE(f, g, [0, 2], 1, 1, { tol: 1e-9 });
    const an = solveDAE(f, g, [0, 2], 1, 1, { tol: 1e-9, jacobian });
    const yFd = fd.y as number[];
    const yAn = an.y as number[];
    expect(yAn[yAn.length - 1]).toBeCloseTo(yFd[yFd.length - 1], 8);
    expect(yAn[yAn.length - 1]).toBeCloseTo(2 - 1 + 2 * Math.exp(-2), 5); // yExact(2) = 1.2707…
  });
});

describe('solveDAE — higher-index / singular ∂g/∂z detection', () => {
  it('throws a clear error when ∂g/∂z is singular (not index-1)', () => {
    // g does NOT depend on z (∂g/∂z = 0) → index-2, cannot land a consistent z0.
    const f = (t: number, y: number[], z: number[]) => [z[0]];
    const g = (t: number, y: number[]) => [y[0] - Math.sin(t)];
    expect(() => solveDAE(f, g, [0, 1], 0, 0)).toThrow(/index-1|∂g\/∂z|singular/);
  });
});

describe('solveDAE — input validation', () => {
  const f = (t: number, y: number[], z: number[]) => [z[0]];
  const g = (t: number, y: number[], z: number[]) => [z[0] - (1 - y[0])];

  it('requires T > t0', () => {
    expect(() => solveDAE(f, g, [1, 0], 0, 1)).toThrow(/T > t0/);
  });
});
