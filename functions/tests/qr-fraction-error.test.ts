import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { factory_sign, qr } from '../src/factories/index.js';

function asRows(x: unknown): unknown[][] {
  if (Array.isArray(x)) return x as unknown[][];
  return (x as { valueOf(): unknown[][] }).valueOf();
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number((v as { valueOf(): unknown }).valueOf());
}

function matmul(a: unknown[][], b: unknown[][]): number[][] {
  const m = a.length;
  const p = b.length;
  const n = b[0]!.length;
  const out: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += num(a[i]![k]) * num(b[k]![j]);
      row.push(s);
    }
    out.push(row);
  }
  return out;
}

function transpose(a: unknown[][]): unknown[][] {
  return a[0]!.map((_, j) => a.map((row) => row[j]));
}

describe('qr Fraction input', () => {
  it('computes Q and R so that Q*R reconstructs a Fraction matrix', () => {
    const A = [
      [new Fraction(1, 1), new Fraction(1, 1)],
      [new Fraction(1, 1), new Fraction(2, 1)],
    ];
    const { Q, R } = qr(A) as { Q: unknown; R: unknown };
    const qrProd = matmul(asRows(Q), asRows(R));
    expect(qrProd[0]![0]).toBeCloseTo(1, 12);
    expect(qrProd[0]![1]).toBeCloseTo(1, 12);
    expect(qrProd[1]![0]).toBeCloseTo(1, 12);
    expect(qrProd[1]![1]).toBeCloseTo(2, 12);
  });

  it('accepts a mixed Fraction / number matrix', () => {
    const A = [
      [new Fraction(1, 2), 1],
      [2, 3],
    ];
    const { Q, R } = qr(A) as { Q: unknown; R: unknown };
    const qrProd = matmul(asRows(Q), asRows(R));
    expect(qrProd[0]![0]).toBeCloseTo(0.5, 12);
    expect(qrProd[0]![1]).toBeCloseTo(1, 12);
    expect(qrProd[1]![0]).toBeCloseTo(2, 12);
    expect(qrProd[1]![1]).toBeCloseTo(3, 12);
  });

  it('keeps Q roughly orthonormal on a Fraction matrix', () => {
    const A = [
      [new Fraction(3, 2), new Fraction(1, 3)],
      [new Fraction(1, 4), new Fraction(5, 6)],
    ];
    const { Q } = qr(A) as { Q: unknown };
    const q = asRows(Q);
    const qtq = matmul(asRows(transpose(q)), q);
    expect(qtq[0]![0]).toBeCloseTo(1, 10);
    expect(qtq[1]![1]).toBeCloseTo(1, 10);
    expect(qtq[0]![1]).toBeCloseTo(0, 10);
    expect(qtq[1]![0]).toBeCloseTo(0, 10);
  });
});

describe('sign Fraction', () => {
  it('uses numerator / sign(), not the mathjs n/s fields', () => {
    expect(num(factory_sign(new Fraction(3, 2)))).toBe(1);
    expect(num(factory_sign(new Fraction(-5, 7)))).toBe(-1);
    expect(num(factory_sign(new Fraction(0, 1)))).toBe(0);
  });
});
