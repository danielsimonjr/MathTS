/**
 * Dogfood #1206 — qr returns Q and R with one entry type.
 *
 * Every entry of Q and R has the entry type of the input: BigNumber for a BigNumber matrix,
 * Complex for a matrix with a Complex entry (also when other entries are BigNumber), number
 * otherwise. A skipped Householder step (zero column) and the zeros below the diagonal of R
 * follow the same rule.
 */

import { describe, it, expect } from 'vitest';
import {
  qr as qrFn,
  matrix,
  bignumber as bignumberFn,
  complex as complexFn,
  multiplyScalar,
  addScalar,
} from '../src/factories/index.js';

const qr = qrFn as (x: unknown) => { Q: unknown; R: unknown };
const bn = bignumberFn as (x: unknown) => unknown;
const cx = complexFn as (re: number, im?: number) => unknown;

type Kind = 'number' | 'BigNumber' | 'Complex';

function kindOf(v: unknown): string {
  if (typeof v === 'number') return 'number';
  return (v as { type?: string; constructor: { name: string } }).type ?? v!.constructor.name;
}

function expectAll(data: unknown, kind: Kind): void {
  for (const row of data as unknown[][]) for (const v of row) expect(kindOf(v)).toBe(kind);
}

function check(input: unknown[][], kind: Kind, storage: 'dense' | 'sparse' = 'dense'): void {
  const r = qr(matrix(input, storage)) as { Q: { valueOf(): unknown }; R: { valueOf(): unknown } };
  expectAll(r.Q.valueOf(), kind);
  expectAll(r.R.valueOf(), kind);
  const a = qr(input);
  expectAll(a.Q, kind);
  expectAll(a.R, kind);
}

describe('#1206 qr entry types', () => {
  it('BigNumber matrix: all entries BigNumber', () => {
    check(
      [
        [1, 2, 3],
        [2, 4, 6],
        [3, 6, 9],
      ].map((r) => r.map((x) => bn(x))),
      'BigNumber'
    );
  });

  it('BigNumber zero matrix: all entries BigNumber', () => {
    check(
      [
        [0, 0],
        [0, 0],
      ].map((r) => r.map((x) => bn(x))),
      'BigNumber'
    );
  });

  it('Complex zero matrix: all entries Complex', () => {
    check(
      [
        [cx(0, 0), cx(0, 0)],
        [cx(0, 0), cx(0, 0)],
      ],
      'Complex'
    );
  });

  it('Complex matrix with a zero first column: all entries Complex', () => {
    check(
      [
        [cx(0, 0), cx(1, 0)],
        [cx(0, 0), cx(2, 0)],
      ],
      'Complex'
    );
  });

  it('mixed number/Complex matrix: all entries Complex', () => {
    const s = 2 ** -19;
    const e = 3e-10;
    check(
      [
        [1 * s, 1 * s, 1 * s],
        [1 * s, cx((1 + e) * s, 0), 1 * s],
        [1 * s, 1 * s, (1 + e) * s],
      ],
      'Complex'
    );
  });

  it('mixed BigNumber/Complex matrix: all entries Complex', () => {
    check(
      [
        [bn(1), cx(2, 1)],
        [bn(3), 4],
      ],
      'Complex'
    );
  });

  it('sparse BigNumber input: all entries BigNumber', () => {
    check(
      [
        [0, 2],
        [0, 4],
      ].map((r) => r.map((x) => bn(x))),
      'BigNumber',
      'sparse'
    );
  });

  it('number matrix stays number', () => {
    check(
      [
        [0, 1],
        [0, 2],
      ],
      'number'
    );
  });

  it('Complex matrix with an entry of another type: the zeros below the diagonal stay Complex', () => {
    // No promotion rule applies to a string entry, so the entries stay as they are. The zeros
    // below the diagonal of R follow R[0][0], as before #1206.
    const r = qr([
      [cx(0, 0), '2', cx(1, 0)],
      [cx(0, 0), cx(0, 0), '3'],
      [cx(0, 0), cx(0, 0), cx(0, 0)],
    ]) as { R: unknown[][] };
    for (let i = 1; i < 3; i++)
      for (let j = 0; j < i; j++) expect(kindOf(r.R[i][j])).toBe('Complex');
  });

  it('Q * R reconstructs a BigNumber and a Complex input', () => {
    const mul = multiplyScalar as (a: unknown, b: unknown) => unknown;
    const add = addScalar as (a: unknown, b: unknown) => unknown;
    const toC = (v: unknown): { re: number; im: number } =>
      typeof v === 'number'
        ? { re: v, im: 0 }
        : kindOf(v) === 'Complex'
          ? (v as { re: number; im: number })
          : { re: Number(v), im: 0 };
    const inputs: unknown[][][] = [
      [
        [bn(1), bn(2)],
        [bn(3), bn(4)],
      ],
      [
        [cx(1, 1), cx(2, 0)],
        [3, cx(4, -1)],
      ],
      [
        [bn(1), cx(2, 1)],
        [bn(3), 4],
      ],
    ];
    for (const input of inputs) {
      const r = qr(input) as { Q: unknown[][]; R: unknown[][] };
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const got = toC(add(mul(r.Q[i][0], r.R[0][j]), mul(r.Q[i][1], r.R[1][j])));
          const want = toC(input[i][j]);
          expect(Math.abs(got.re - want.re)).toBeLessThan(1e-12);
          expect(Math.abs(got.im - want.im)).toBeLessThan(1e-12);
        }
    }
  });
});
