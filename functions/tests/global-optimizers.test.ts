import { describe, it, expect } from 'vitest';
import { differentialEvolution, simulatedAnnealing } from '../src/numeric/global-optimizers.js';

const rastrigin = (x: number[]): number =>
  10 * x.length + x.reduce((s, v) => s + v * v - 10 * Math.cos(2 * Math.PI * v), 0);
const rosenbrock = (x: number[]): number => (1 - x[0]) ** 2 + 100 * (x[1] - x[0] * x[0]) ** 2;
const sphere = (x: number[]): number => x.reduce((s, v) => s + v * v, 0);

describe('differentialEvolution', () => {
  it('finds the global minimum of 2-D Rastrigin', () => {
    const r = differentialEvolution(
      rastrigin,
      [
        [-5.12, 5.12],
        [-5.12, 5.12],
      ],
      { seed: 42 }
    );
    expect(r.fx).toBeLessThan(1e-6);
    for (const v of r.x) expect(Math.abs(v)).toBeLessThan(1e-3);
  });

  it('finds the Rosenbrock valley minimum at [1, 1]', () => {
    const r = differentialEvolution(
      rosenbrock,
      [
        [-2, 2],
        [-2, 2],
      ],
      { seed: 42 }
    );
    expect(r.x[0]).toBeCloseTo(1, 3);
    expect(r.x[1]).toBeCloseTo(1, 3);
  });

  it('minimizes the 3-D sphere', () => {
    const r = differentialEvolution(
      sphere,
      [
        [-1, 1],
        [-1, 1],
        [-1, 1],
      ],
      { seed: 42 }
    );
    expect(r.fx).toBeLessThan(1e-8);
  });

  it('is deterministic for a fixed seed', () => {
    const b: [number, number][] = [
      [-5.12, 5.12],
      [-5.12, 5.12],
    ];
    expect(differentialEvolution(rastrigin, b, { seed: 42 })).toEqual(
      differentialEvolution(rastrigin, b, { seed: 42 })
    );
  });

  it('throws RangeError on empty or inverted bounds', () => {
    expect(() => differentialEvolution(sphere, [])).toThrow(RangeError);
    expect(() => differentialEvolution(sphere, [[1, 1]])).toThrow(RangeError);
    expect(() => differentialEvolution(sphere, [[2, -2]])).toThrow(RangeError);
  });

  it('treats non-finite objective values as +Infinity', () => {
    const r = differentialEvolution((x) => (x[0] < 0 ? NaN : (x[0] - 1) ** 2), [[-1, 2]], {
      seed: 3,
    });
    expect(Number.isFinite(r.fx)).toBe(true);
    expect(r.x[0]).toBeCloseTo(1, 3);
  });
});

describe('simulatedAnnealing', () => {
  it('finds the minimum of a 1-D parabola', () => {
    const r = simulatedAnnealing((x) => (x[0] - 3) ** 2, [0], { seed: 7, bounds: [[-10, 10]] });
    expect(r.x[0]).toBeCloseTo(3, 2);
  });

  it('is deterministic for a fixed seed', () => {
    const f = (x: number[]): number => sphere(x);
    expect(simulatedAnnealing(f, [2, 2], { seed: 5 })).toEqual(
      simulatedAnnealing(f, [2, 2], { seed: 5 })
    );
  });

  it('throws RangeError on empty x0', () => {
    expect(() => simulatedAnnealing(sphere, [])).toThrow(RangeError);
  });
});

describe('simulatedAnnealing defaults', () => {
  it('solves the sphere and Rosenbrock to tolerance with defaults', () => {
    for (const seed of [1, 2, 3]) {
      const s = simulatedAnnealing((x) => x[0] ** 2 + x[1] ** 2, [3, 3], { seed });
      expect(s.fx).toBeLessThan(1e-6);
      expect(s.converged).toBe(true);
      const r = simulatedAnnealing(
        (x) => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2,
        [-1.2, 1],
        { seed }
      );
      expect(r.fx).toBeLessThan(1e-3);
    }
  });
  it('does not claim convergence when the schedule was cut short', () => {
    const r = simulatedAnnealing((x) => x[0] ** 2, [3], { seed: 1, maxIter: 5 });
    expect(r.converged).toBe(false);
  });
});
