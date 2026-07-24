/**
 * solveODE event detection (`events` option), pinned to scipy.integrate.solve_ivp(..., events=...).
 *
 * Event functions g(t, y) are located where they cross zero between accepted steps (cubic-Hermite
 * dense interpolation + bisection). `terminal` stops the integration at the event; `direction`
 * filters to +→ (neg→pos) or −→ (pos→neg) crossings. Results expose `tEvents`/`yEvents`
 * (one list per event function), mirroring scipy's `t_events`/`y_events`.
 *
 * Oracle values from scipy 1.17.1 (verified out-of-band):
 *   projectile ground hit: t = 4.081632653061226
 *   sin(t) up-crossings on [0.1,20]: 2π, 4π, 6π
 *   sin(t)=0.5 crossings on [0,10]: π/6, 5π/6, 6.80678408, 8.90117919
 *   cos(t)=0 crossings on [0,10]: π/2, 3π/2, 5π/2
 *   terminal=2 on sin=0.5: stops at 5π/6 = 2.6179938779888476
 */
import { describe, it, expect } from 'vitest';
import { solveODE } from '../src/index.js';

// Harmonic oscillator y' = [y1, -y0], y0 = [0, 1] ⇒ y0(t) = sin t, y1(t) = cos t.
const harmonic = (_t: number, y: number[]): number[] => [y[1], -y[0]];

describe('solveODE — event detection (scipy solve_ivp parity)', () => {
  it('terminal projectile ground-hit: stops at the exact fall time, height ≈ 0', () => {
    const g = 9.8;
    const proj = (_t: number, y: number[]): number[] => [y[1], -g];
    const hit = (_t: number, y: number[]): number => y[0]; // height
    (hit as { terminal?: boolean }).terminal = true;
    (hit as { direction?: number }).direction = -1; // falling only (avoid the t=0 launch point)

    const sol = solveODE(proj, [0, 10], [0, 20], { events: hit, tol: 1e-10 }) as {
      t: number[];
      y: number[][];
      tEvents: number[][];
      yEvents: number[][][];
    };
    expect(sol.tEvents[0]).toHaveLength(1);
    expect(sol.tEvents[0][0]).toBeCloseTo(4.081632653061226, 6);
    // state at the event: height ≈ 0, velocity ≈ −20
    expect(Math.abs(sol.yEvents[0][0][0])).toBeLessThan(1e-6);
    expect(sol.yEvents[0][0][1]).toBeCloseTo(-20, 5);
    // integration truncated at the event
    expect(sol.t[sol.t.length - 1]).toBeCloseTo(4.081632653061226, 6);
  });

  it('direction-filtered up-crossings of sin(t): only 2π, 4π, 6π', () => {
    const cross = (_t: number, y: number[]): number => y[0];
    (cross as { direction?: number }).direction = 1; // neg→pos only
    const sol = solveODE(harmonic, [0.1, 20], [Math.sin(0.1), Math.cos(0.1)], {
      events: cross,
      tol: 1e-10,
    }) as { tEvents: number[][] };
    const times = sol.tEvents[0];
    expect(times).toHaveLength(3);
    expect(times[0]).toBeCloseTo(2 * Math.PI, 6);
    expect(times[1]).toBeCloseTo(4 * Math.PI, 6);
    expect(times[2]).toBeCloseTo(6 * Math.PI, 6);
  });

  it('multiple non-terminal events, one list per event function', () => {
    const evA = (_t: number, y: number[]): number => y[0] - 0.5; // sin t = 0.5
    const evB = (_t: number, y: number[]): number => y[1]; // cos t = 0 (peaks/troughs)
    const sol = solveODE(harmonic, [0, 10], [0, 1], { events: [evA, evB], tol: 1e-10 }) as {
      tEvents: number[][];
    };
    const [aTimes, bTimes] = sol.tEvents;
    expect(aTimes.map((t) => +t.toFixed(6))).toEqual([0.523599, 2.617994, 6.806784, 8.901179]);
    expect(bTimes.map((t) => +t.toFixed(6))).toEqual([1.570796, 4.712389, 7.853982]);
  });

  it('EventSpec object API: {event, terminal, direction} matches the function-attribute API', () => {
    const g = 9.8;
    const proj = (_t: number, y: number[]): number[] => [y[1], -g];
    const sol = solveODE(proj, [0, 10], [0, 20], {
      events: { event: (_t, y) => y[0], terminal: true, direction: -1 },
      tol: 1e-10,
    }) as { tEvents: number[][]; t: number[] };
    expect(sol.tEvents[0][0]).toBeCloseTo(4.081632653061226, 6);
    expect(sol.t[sol.t.length - 1]).toBeCloseTo(4.081632653061226, 6);
  });

  it('terminal count = 2 stops at the second crossing (5π/6)', () => {
    const evA = (_t: number, y: number[]): number => y[0] - 0.5;
    const sol = solveODE(harmonic, [0, 10], [0, 1], {
      events: { event: evA, terminal: 2 },
      tol: 1e-10,
    }) as { tEvents: number[][]; t: number[] };
    expect(sol.tEvents[0]).toHaveLength(2);
    expect(sol.tEvents[0][1]).toBeCloseTo((5 * Math.PI) / 6, 6);
    expect(sol.t[sol.t.length - 1]).toBeCloseTo((5 * Math.PI) / 6, 6);
  });

  it('scalar ODE events: y′ = 1 from 0, event at y = 3 (state passed as [v])', () => {
    // y(t) = t; event g = y[0] − 3 fires at t = 3. Scalar y0 wraps to a length-1 state.
    const sol = solveODE((_t, _y) => 1, [0, 10], 0, {
      events: { event: (_t, y) => y[0] - 3, terminal: true },
      tol: 1e-10,
    }) as { tEvents: number[][]; yEvents: number[][]; t: number[]; y: number[] };
    expect(sol.tEvents[0][0]).toBeCloseTo(3, 8);
    // scalar unwrap: yEvents entries are bare numbers, matching y
    expect(sol.yEvents[0][0]).toBeCloseTo(3, 8);
    expect(sol.t[sol.t.length - 1]).toBeCloseTo(3, 8);
  });

  it('works with the stiff Rosenbrock method too', () => {
    // y′ = −y from y0 = 1 ⇒ y = e^−t; event at y = 0.5 fires at t = ln 2.
    const sol = solveODE((_t, y) => -(y as number), [0, 5], 1, {
      method: 'Rosenbrock',
      events: { event: (_t, y) => y[0] - 0.5, terminal: true },
      tol: 1e-9,
    }) as { tEvents: number[][]; t: number[] };
    expect(sol.tEvents[0][0]).toBeCloseTo(Math.LN2, 6);
  });

  it('no events option → result is unchanged (no tEvents/yEvents fields)', () => {
    const sol = solveODE(harmonic, [0, 1], [0, 1], { tol: 1e-9 }) as Record<string, unknown>;
    expect('tEvents' in sol).toBe(false);
    expect('yEvents' in sol).toBe(false);
  });
});
