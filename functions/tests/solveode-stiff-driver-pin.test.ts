/**
 * Pins for shared `_linearlyImplicitDriver` used by `rosenbrockSolve` and `rodasSolve`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rosenbrockSolve, rodasSolve } from '../src/numeric/solveODE.js';

const golden = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures/stiff-driver-golden.json'),
    'utf8'
  )
) as {
  rosenbrock: { t: number[]; y: number[][] };
  rodas: { t: number[]; y: number[][] };
};

const stiffScalar = (_t: unknown, y: unknown): number[] => [-1000 * (y as number[])[0]];

describe('rosenbrockSolve driver pins', () => {
  it('requires numeric tspan', () => {
    expect(() => rosenbrockSolve(stiffScalar, ['a', 1], [1])).toThrow(
      'The "Rosenbrock" stiff method requires numeric tspan'
    );
  });

  it('requires plain-number y0', () => {
    expect(() => rosenbrockSolve(stiffScalar, [0, 1], [1, 'x'])).toThrow(
      'The "Rosenbrock" stiff method requires plain-number state (y0)'
    );
  });

  it('matches golden t/y on a fixed stiff problem', () => {
    const sol = rosenbrockSolve(stiffScalar, [0, 0.001], [1], { tol: 1e-6, firstStep: 1e-4 });
    expect(sol.t).toEqual(golden.rosenbrock.t);
    expect(sol.y).toEqual(golden.rosenbrock.y);
  });

  it('counts f evaluations in a predictable way', () => {
    let calls = 0;
    const f = (t: unknown, y: unknown): number[] => {
      calls++;
      return stiffScalar(t, y);
    };
    rosenbrockSolve(f, [0, 0.001], [1], { tol: 1e-6, firstStep: 1e-4 });
    expect(calls).toBe(156);
  });
});

describe('rodasSolve driver pins', () => {
  it('requires numeric tspan', () => {
    expect(() => rodasSolve(stiffScalar, [0, 'z'], [1])).toThrow(
      'The "RODAS" stiff method requires numeric tspan'
    );
  });

  it('requires plain-number y0', () => {
    expect(() => rodasSolve(stiffScalar, [0, 1], [null])).toThrow(
      'The "RODAS" stiff method requires plain-number state (y0)'
    );
  });

  it('matches golden t/y on a fixed stiff problem', () => {
    const sol = rodasSolve(stiffScalar, [0, 0.001], [1], { tol: 1e-6, firstStep: 1e-4 });
    expect(sol.t).toEqual(golden.rodas.t);
    expect(sol.y).toEqual(golden.rodas.y);
  });

  it('counts f evaluations in a predictable way', () => {
    let calls = 0;
    const f = (t: number, y: number[]): number[] => {
      calls++;
      return stiffScalar(t, y);
    };
    rodasSolve(f, [0, 0.001], [1], { tol: 1e-6, firstStep: 1e-4 });
    expect(calls).toBe(80);
  });
});
