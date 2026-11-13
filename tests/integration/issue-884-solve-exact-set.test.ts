import { describe, it, expect } from 'vitest';
import { solve, solveExact } from '@danielsimonjr/mathts-functions';
import type { ExactSolution } from '@danielsimonjr/mathts-functions';

/**
 * The reproduction of #884, written as a user of the published package writes it (import by
 * package name, so the built `dist` is what runs). The calls use the shipped types: no cast.
 */

describe('#884 a periodic solution set is not a finite list', () => {
  it('replays the repro of the issue: solve names solveExact, it does not return 63 floats', () => {
    // console.log(r.length, r[0], r[1], r[2]) printed
    //   63 -97.3893722612836 -94.2477796076938 -91.10618695310264
    expect(() => solve('sin(x)=0', 'x')).toThrow(/solveExact/);
  });

  it('solveExact returns the two principal roots and the period', () => {
    const solution: ExactSolution = solveExact('sin(x)=0', 'x');
    expect(solution).toEqual({ roots: ['0', 'pi'], period: '2*pi' });
  });

  it('the solution set survives JSON and structuredClone', () => {
    const solution = solveExact('sin(x)=0', 'x');
    expect(JSON.parse(JSON.stringify(solution))).toEqual(solution);
    expect(structuredClone(solution)).toEqual(solution);
    expect(solveExact('exp(x)=2', 'x')).toEqual({ roots: ['log(2)'], period: null });
  });

  it('runs the numeric scan only with { numeric: true, range }', () => {
    const scanned = solve('sin(x)=0', 'x', { numeric: true, range: [-10, 10] });
    expect(scanned).toHaveLength(7);
    expect(scanned.every((v) => typeof v === 'number')).toBe(true);
    expect(() => solve('sin(x)=0', 'x', { numeric: true })).toThrow(/range/);
  });

  it('does not read a periodic function as a polynomial', () => {
    // sin(2*pi*x) is zero at every integer and half-integer, so a sampled polynomial test
    // returned [] for the first call and [0] for the third.
    expect(solveExact('sin(2*pi*x)=0', 'x')).toEqual({ roots: ['0', '1/2'], period: '1' });
    expect(solveExact('cos(2*pi*x)=1', 'x')).toEqual({ roots: ['0'], period: '1' });
    expect(() => solve('sin(2*pi*x)=x', 'x')).toThrow(/numeric: true/);
  });

  it('puts no rounded digit in an exact root', () => {
    expect(solveExact('sin(pi*x)=0', 'x').roots).toEqual(['0', '1']);
    expect(() => solve('sin(x)=sqrt(2)/3', 'x')).toThrow(/sqrt\(2\)\/3|0\.4714/);
    expect(() => solveExact('sin(x)=sqrt(2)/3', 'x')).toThrow(/no exact text/);
    expect(solve('sin(x)=2', 'x')).toEqual([]);
  });

  it('gives exact text for an offset that is a fraction of pi', () => {
    expect(solveExact('2*sin(3*x+pi/4)=1', 'x')).toEqual({
      roots: ['-pi/36', '7*pi/36'],
      period: '2*pi/3',
    });
  });

  it('keeps the #719 polynomial results (x^2-2 radicals, x^2+1 complex)', () => {
    expect(solve('x^2-2', 'x')).toEqual(['-sqrt(2)', 'sqrt(2)']);
    const imaginary = solve('x^2+1', 'x');
    expect(imaginary).toHaveLength(2);
    expect(imaginary.map((root) => String(root)).sort()).toEqual(['-i', 'i']);
  });

  it('gives the right roots at any size, and no integer for a root that is not one', () => {
    expect(solve('x^2-1e12', 'x')).toEqual([-1e6, 1e6]);
    expect(solve('x^2-1e-18', 'x')).toEqual([-1e-9, 1e-9]);
    expect(solve('x-1e-10', 'x')).toEqual([1e-10]);
    expect(solve('x-1.000000001', 'x')).toEqual([1.000000001]);
  });

  it('throws for an identity, and gives [] only for an equation with no root', () => {
    expect(() => solve('x^2-x^2', 'x')).toThrow(/identity/);
    expect(() => solve('0*x', 'x')).toThrow(/identity/);
    expect(solve('1=2', 'x')).toEqual([]);
  });

  it('names the degree limit for a polynomial that is too high', () => {
    expect(() => solve('x^1001=1', 'x')).toThrow(/degree above 1000/);
  });
});
