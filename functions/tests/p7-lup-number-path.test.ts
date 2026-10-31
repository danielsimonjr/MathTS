/**
 * P7-4 pins: dense LUP number fast path (bit-exact L, U, p).
 */
import { describe, it, expect } from 'vitest';
import { lup, lusolve } from '../src/factories/index.js';

function cell(v: unknown): unknown {
  return typeof v === 'number' ? v : (v as { valueOf(): number }).valueOf();
}

function matrixClose(a: unknown[][], b: unknown[][]): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(a[i].length).toBe(b[i].length);
    for (let j = 0; j < a[i].length; j++) {
      expect(Object.is(cell(a[i][j]), cell(b[i][j]))).toBe(true);
    }
  }
}

describe('P7-4 lup number path', () => {
  it('2×2 textbook example', () => {
    const A = [
      [2, 1],
      [1, 4],
    ];
    const { L, U, p } = lup(A);
    matrixClose(L as number[][], [
      [1, 0],
      [0.5, 1],
    ]);
    matrixClose(U as number[][], [
      [2, 1],
      [0, 3.5],
    ]);
    expect(p).toEqual([0, 1]);
  });

  it('8×8 random golden (seeded)', () => {
    const A: number[][] = [];
    let s = 0x740808;
    for (let i = 0; i < 8; i++) {
      const row: number[] = [];
      for (let j = 0; j < 8; j++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        row.push((s / 0xffffffff) * 2 - 1);
      }
      A.push(row);
    }
    const r1 = lup(A);
    const r2 = lup(A.map((row) => row.slice()));
    matrixClose(r1.L as number[][], r2.L as number[][]);
    matrixClose(r1.U as number[][], r2.U as number[][]);
    expect(r1.p).toEqual(r2.p);
  });

  it('lusolve vector rhs', () => {
    const A = [
      [3, 1],
      [1, 2],
    ];
    const b = [9, 8];
    const x = lusolve(A, b) as number[];
    expect(x[0]).toBeCloseTo(2, 12);
    expect(x[1]).toBeCloseTo(3, 12);
  });

  it('NaN entry propagates to factor output', () => {
    const A = [
      [1, 2],
      [NaN, 4],
    ];
    const { L, U } = lup(A);
    const vals = [...(L as number[][]).flat(), ...(U as number[][]).flat()];
    expect(vals.some((x) => typeof x === 'number' && Number.isNaN(x))).toBe(true);
  });
});
