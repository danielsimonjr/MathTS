import { describe, it, expect } from 'vitest';
import {
  motzkin,
  narayana,
  schroder,
  delannoy,
  pell,
  tribonacci,
  eulerianNumber,
  lahNumber,
  integerPartitionsGen,
  compositionsGen,
  grayCode,
  binomialMod,
} from '../src/numbertheory/sequences.js';
import { partitions } from '../src/typed/combinatorics.js';

describe('integer sequences', () => {
  it('Motzkin, Schroder, Pell, tribonacci', () => {
    expect(motzkin(5)).toBe(21);
    expect(motzkin(6)).toBe(51);
    expect(schroder(4)).toBe(90);
    expect(pell(6)).toBe(70);
    expect(tribonacci(8)).toBe(24);
  });
  it('Narayana and Delannoy', () => {
    expect(narayana(4, 2)).toBe(6);
    expect(delannoy(3, 3)).toBe(63);
    expect(delannoy(2, 2)).toBe(13);
  });
  it('Eulerian and Lah numbers', () => {
    expect(eulerianNumber(4, 1)).toBe(11);
    expect(eulerianNumber(4, 2)).toBe(11);
    let total = 0;
    for (let k = 0; k < 4; k++) total += eulerianNumber(4, k);
    expect(total).toBe(24);
    expect(lahNumber(3, 2)).toBe(6);
    expect(lahNumber(4, 2)).toBe(36);
  });
});

describe('enumerators', () => {
  it('integer partitions in descending lexicographic order', () => {
    expect(integerPartitionsGen(4)).toEqual([[4], [3, 1], [2, 2], [2, 1, 1], [1, 1, 1, 1]]);
  });
  it('partition count agrees with partitions()', () => {
    for (let n = 0; n <= 12; n++) {
      expect(integerPartitionsGen(n).length).toBe(Number(partitions(n)));
    }
  });
  it('compositions of 3', () => {
    expect(compositionsGen(3).length).toBe(4);
    expect(compositionsGen(3)).toEqual([[1, 1, 1], [1, 2], [2, 1], [3]]);
  });
  it('Gray code of 3 bits', () => {
    expect(grayCode(3)).toEqual([0, 1, 3, 2, 6, 7, 5, 4]);
  });
  it('binomial coefficient mod a prime (Lucas)', () => {
    expect(binomialMod(10n, 3n, 7n)).toBe(1n);
    expect(binomialMod(10n, 11n, 7n)).toBe(0n);
    expect(binomialMod(1000n, 500n, 13n)).toBe(
      (() => {
        let c = 1n;
        for (let i = 1n; i <= 500n; i++) c = (c * (1000n - 500n + i)) / i;
        return c % 13n;
      })()
    );
  });
});
