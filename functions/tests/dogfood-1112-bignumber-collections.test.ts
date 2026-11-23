import { describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import {
  quantileSeq,
  bignumber,
  fraction,
  matrix,
  sparse,
  unit,
  solveODE,
} from '../src/factories/index.js';
import { multiply } from '../src/index.js';

type Any = (...a: unknown[]) => unknown;
const q = quantileSeq as Any;
const B = bignumber as Any;
const U = unit as Any;
const F = fraction as Any;
const isBig = (v: unknown): boolean => !!v && (v as { isBigNumber?: boolean }).isBigNumber === true;
const isUnitBig = (v: unknown): boolean =>
  !!v && (v as { isUnit?: boolean }).isUnit === true && isBig((v as { value: unknown }).value);
const str = (v: unknown): string => String(v);

// Oracle for every row: mathjs 15.2.0, unless the row says otherwise.
describe('bignumber converts collections and Units (#1112)', () => {
  it('maps an Array element by element, at any depth', () => {
    const r = B([
      [1, '2'],
      [true, B(3)],
    ]) as unknown[][];
    expect(r.flat().every(isBig)).toBe(true);
    expect(r.map((row) => row.map(str))).toEqual([
      ['1', '2'],
      ['1', '3'],
    ]);
    expect(B([])).toEqual([]);
  });
  it('maps a dense and a sparse Matrix and keeps the storage', () => {
    const d = B(matrix([1, 2])) as { isMatrix: boolean; toArray(): unknown[] };
    expect(d.isMatrix).toBe(true);
    expect(d.toArray().every(isBig)).toBe(true);
    // A sparse Matrix converts its stored values; an implicit zero stays the number 0.
    const s = B(
      (sparse as Any)([
        [1, 0],
        [0, 2],
      ])
    ) as {
      storage(): string;
      toJSON(): { values: unknown[] };
      toArray(): unknown[][];
    };
    expect(s.storage()).toBe('sparse');
    expect(s.toJSON().values.every(isBig)).toBe(true);
    expect(s.toArray().map((row) => row.map(Number))).toEqual([
      [1, 0],
      [0, 2],
    ]);
  });
  it('converts the value of a Unit and keeps the unit', () => {
    const u = B(U(5, 'cm'));
    expect(isUnitBig(u)).toBe(true);
    expect(str(u)).toBe('5 cm');
    expect((B([U(5, 'cm')]) as unknown[]).every(isUnitBig)).toBe(true);
  });
  it('converts a Fraction at the BigNumber precision, a bigint without loss, null to 0', () => {
    expect(str(B(F(1, 3)))).toBe(
      '0.3333333333333333333333333333333333333333333333333333333333333333'
    );
    expect(str(B(2n ** 70n))).toBe('1180591620717411303424');
    expect(str(B(null))).toBe('0');
  });
  it('keeps the scalar results', () => {
    expect(str(B(0.1 + 0.2))).toBe('0.30000000000000004');
    expect(str(B('1.5'))).toBe('1.5');
    expect(str(B(true))).toBe('1');
    const b = B(7);
    expect(B(b)).toBe(b);
  });
});

describe('quantileSeq with a BigNumber N or probability returns one type (#1112)', () => {
  const m = [U(1, 'm'), U(2, 'm'), U(3, 'm')];
  it('Unit data with a BigNumber N gives Units of BigNumber', () => {
    const r = q(m, B(3)) as unknown[];
    expect(r.every(isUnitBig)).toBe(true);
    expect(r.map(str)).toEqual(['1.5 m', '2 m', '2.5 m']);
  });
  it('Unit data with a BigNumber probability gives a Unit of BigNumber', () => {
    // 0.5 lands on an element (no interpolation); 0.25 interpolates.
    expect(isUnitBig(q(m, B(0.5)))).toBe(true);
    expect(str(q(m, B(0.5)))).toBe('2 m');
    expect(isUnitBig(q(m, B(0.25)))).toBe(true);
    expect(str(q(m, B(0.25)))).toBe('1.5 m');
  });
  it('bigint data with a BigNumber N gives BigNumbers', () => {
    const r = q([1n, 2n, 3n], B(3)) as unknown[];
    expect(r.every(isBig)).toBe(true);
    expect(r.map(str)).toEqual(['1.5', '2', '2.5']);
  });
  it('mixed number and BigNumber data with a BigNumber N gives BigNumbers', () => {
    const r = q([1, B(2), 3], B(3)) as unknown[];
    expect(r.every(isBig)).toBe(true);
  });
  it('Fraction data with a BigNumber N gives BigNumbers (mathjs throws; MathTS converts)', () => {
    const r = q([F(1), F(2), F(3)], B(3)) as unknown[];
    expect(r.every(isBig)).toBe(true);
    expect(r.map(str)).toEqual(['1.5', '2', '2.5']);
  });
  it('a number N keeps the element types', () => {
    expect((q([1, 2, 3], 3) as unknown[]).every((v) => typeof v === 'number')).toBe(true);
    expect((q(m, 3) as { value: unknown }[]).every((v) => typeof v.value === 'number')).toBe(true);
  });
});

describe('solveODE with BigNumber input (#1112)', () => {
  const f = (_t: unknown, y: unknown): unknown => (multiply as Any)(-1, y);
  // The independent stability polynomial of Dormand–Prince on y' = -y.
  function expectTrajectory(t: unknown[], y: unknown[][]): void {
    let expected = new BigNumber(1);
    for (let i = 1; i < t.length; i++) {
      const z = new BigNumber(str(t[i - 1])).sub(new BigNumber(str(t[i])));
      let stability = new BigNumber(1).div(600);
      for (const denominator of [120, 24, 6, 2, 1, 1]) {
        stability = stability.mul(z).add(new BigNumber(1).div(denominator));
      }
      expected = expected.mul(stability);
      expect(new BigNumber(str(y[i][0])).sub(expected).abs().lt('1e-60')).toBe(true);
    }
  }
  it('RK45 on y′ = −y with a BigNumber y0 returns BigNumber steps', () => {
    const r = (solveODE as Any)(f, [0, 1], [B(1)]) as { t: unknown[]; y: unknown[][] };
    expect(r.t.length).toBe(6);
    expect(isBig(r.t[5])).toBe(true);
    expect(str(r.t[5])).toBe('1');
    expect(isBig(r.y[5][0])).toBe(true);
    expectTrajectory(r.t, r.y);
  });
  it('RK45 with a BigNumber tspan returns the same result', () => {
    const r = (solveODE as Any)(f, [B(0), B(1)], [1]) as { t: unknown[]; y: unknown[][] };
    expect(r.t.length).toBe(6);
    expectTrajectory(r.t, r.y);
  });
});
