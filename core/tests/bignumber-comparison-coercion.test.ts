/**
 * BigNumber comparison methods must coerce plain-number / string arguments, exactly like the
 * arithmetic methods (add/mul) and `gt` already do. Before this was fixed, `equals`/`lessThan`/
 * `lessThanOrEqual`/`greaterThan`/`greaterThanOrEqual`/`compareTo` passed the raw argument to the
 * static comparator, which read `undefined._sign` on a plain number and returned garbage — so
 * `bignumber(8).lessThanOrEqual(3)` returned `true`. This silently broke every factory-layer
 * consumer that compares a BigNumber against a number literal (isPrime, quantiles, etc.).
 */
import { describe, it, expect } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (v: string | number): BigNumber =>
  typeof v === 'number' ? BigNumber.fromNumber(v) : BigNumber.parse(v);

describe('BigNumber comparison methods coerce number/string arguments', () => {
  it('lessThan / lessThanOrEqual with a number argument', () => {
    expect(bn(8).lessThan(3)).toBe(false);
    expect(bn(2).lessThan(3)).toBe(true);
    expect(bn(8).lessThanOrEqual(3)).toBe(false);
    expect(bn(3).lessThanOrEqual(3)).toBe(true);
  });

  it('greaterThan / greaterThanOrEqual with a number argument', () => {
    expect(bn(8).greaterThan(3)).toBe(true);
    expect(bn(2).greaterThan(3)).toBe(false);
    expect(bn(8).greaterThanOrEqual(3)).toBe(true);
    expect(bn('0.3').greaterThanOrEqual(0)).toBe(true);
  });

  it('equals with a number argument', () => {
    expect(bn(8).equals(8)).toBe(true);
    expect(bn(8).equals(0)).toBe(false);
    expect(bn(8).mod(2).equals(0)).toBe(true); // the isPrime evenness check
  });

  it('compareTo / compare with a number argument return -1/0/1', () => {
    expect(bn(8).compareTo(3)).toBe(1);
    expect(bn(2).compareTo(3)).toBe(-1);
    expect(bn(3).compareTo(3)).toBe(0);
    expect(bn(2).compare(3)).toBe(-1);
  });

  it('agrees with the BigNumber-argument form (regression baseline stays correct)', () => {
    expect(bn(8).lessThanOrEqual(bn(3))).toBe(false);
    expect(bn(8).equals(bn(0))).toBe(false);
    expect(bn(8).mod(2).equals(bn(0))).toBe(true);
  });

  it('accepts a string argument too', () => {
    expect(bn(8).lessThan('10')).toBe(true);
    expect(bn(8).equals('8')).toBe(true);
  });
});
