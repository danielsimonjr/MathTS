import { describe, expect, it } from 'vitest';
import { simplify } from '../src/factories/index.js';

const simplifyExpr = simplify as (...args: unknown[]) => { toString(): string };

describe('simplify of distinct linear sums (#1314)', () => {
  it('preserves each distinct symbol and its order in a long sum', () => {
    const input = Array.from({ length: 200 }, (_, i) => `x${i}`).join(' + ');
    expect(simplifyExpr(input).toString()).toBe(input);
  });

  it('preserves the built-in grouping and resolves the scope', () => {
    expect(simplifyExpr('x + (y + z)').toString()).toBe('x + y + z');
    expect(simplifyExpr('x + y + z', { y: 0 }).toString()).toBe('x + z');
    expect(simplifyExpr('x + x + y').toString()).toBe('2 * x + y');
  });

  it('applies explicitly supplied rules to distinct symbols', () => {
    expect(simplifyExpr('x + y', ['n1 + n2 -> n1']).toString()).toBe('x');
  });
});
