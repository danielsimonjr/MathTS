import { describe, it, expect } from 'vitest';
import { solve } from '@danielsimonjr/mathts-functions';

/**
 * The reproduction of #884, written as a user of the published package writes it (import by
 * package name, so the built `dist` is what runs).
 */
const solveWithOptions = solve as unknown as (
  equation: string,
  variable: string,
  options?: { numeric?: boolean; range?: [number, number] }
) => Array<number | string | { re: number; im: number }> & { period?: string };

describe('#884 solve("sin(x)=0") returns the exact solution set', () => {
  it('replays the repro of the issue: two exact roots, not 63 floats', () => {
    // console.log(r.length, r[0], r[1], r[2]) printed
    //   63 -97.3893722612836 -94.2477796076938 -91.10618695310264
    const r = solveWithOptions('sin(x)=0', 'x');
    expect([r.length, r[0], r[1], r[2]]).toEqual([2, '0', 'pi', undefined]);
  });

  it('names the period of the solution set', () => {
    expect(solveWithOptions('sin(x)=0', 'x').period).toBe('2*pi');
  });

  it('runs the numeric scan only with { numeric: true, range }', () => {
    const scanned = solveWithOptions('sin(x)=0', 'x', { numeric: true, range: [-10, 10] });
    expect(scanned).toHaveLength(7);
    expect(scanned.every((v) => typeof v === 'number')).toBe(true);
    expect(() => solveWithOptions('sin(x)=0', 'x', { numeric: true })).toThrow(/range/);
  });

  it('keeps the #719 polynomial results (x^2-2 radicals, x^2+1 complex)', () => {
    expect(solveWithOptions('x^2-2', 'x')).toEqual(['-sqrt(2)', 'sqrt(2)']);
    const imaginary = solveWithOptions('x^2+1', 'x');
    expect(imaginary).toHaveLength(2);
    expect(imaginary.map((root) => String(root)).sort()).toEqual(['-i', 'i']);
  });
});
