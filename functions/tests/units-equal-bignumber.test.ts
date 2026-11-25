/**
 * Root-cause regression: typed `equal` / `compare` of Units must compare normalized
 * values with value semantics, not reference equality or number coercion (#1552).
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;

const equal = math.equal as unknown as Fn;
const compare = math.compare as unknown as Fn;
const larger = math.larger as unknown as Fn;
const unit = math.unit as unknown as (...a: unknown[]) => unknown;
const bignumber = math.bignumber as unknown as (x: unknown) => unknown;
const complex = math.complex as unknown as (re: number, im?: number) => unknown;

describe('Unit equality compares BigNumber values semantically', () => {
  it("equal(unit(bignumber(50),'cm'), unit(bignumber(0.5),'m')) is true", () => {
    expect(equal(unit(bignumber(50), 'cm'), unit(bignumber(0.5), 'm'))).toBe(true);
  });

  it('compare orders BigNumber-valued units by BigNumber.compare', () => {
    expect(compare(unit(bignumber(2), 'm'), unit(bignumber(1), 'm'))).toBe(1);
    expect(compare(unit(bignumber(1), 'm'), unit(bignumber(2), 'm'))).toBe(-1);
  });
});

describe('Unit ordering rejects Complex-valued units', () => {
  const left = unit(complex(3, 4), 'm');
  const right = unit(complex(1, 1), 'm');

  it('compare throws', () => {
    expect(() => compare(left, right)).toThrow(
      /No ordering relation is defined for complex numbers/
    );
  });

  it('larger throws', () => {
    expect(() => larger(left, right)).toThrow(
      /No ordering relation is defined for complex numbers/
    );
  });
});

describe('Unit equality uses absolute SI (offset and prefixes)', () => {
  const smaller = math.smaller as unknown as Fn;
  const smallerEq = math.smallerEq as unknown as Fn;
  const largerEq = math.largerEq as unknown as Fn;
  const unequal = math.unequal as unknown as Fn;
  const compareNatural = math.compareNatural as unknown as Fn;
  const fraction = math.fraction as unknown as (...a: unknown[]) => unknown;

  it('0 degC equals 32 degF and 273.15 K', () => {
    expect(equal(unit(0, 'degC'), unit(32, 'degF'))).toBe(true);
    expect(equal(unit(0, 'degC'), unit(273.15, 'K'))).toBe(true);
    expect(unequal(unit(0, 'degC'), unit(32, 'degF'))).toBe(false);
    expect(compare(unit(0, 'degC'), unit(32, 'degF'))).toBe(0);
    expect(compareNatural(unit(0, 'degC'), unit(32, 'degF'))).toBe(0);
  });

  it('0 degC is not equal to 0 degF', () => {
    expect(equal(unit(0, 'degC'), unit(0, 'degF'))).toBe(false);
    expect(larger(unit(0, 'degC'), unit(0, 'degF'))).toBe(true);
    expect(smaller(unit(0, 'degC'), unit(0, 'degF'))).toBe(false);
  });

  it('prefix and BigNumber SI stay exact through toSI', () => {
    expect(equal(unit(bignumber(1), 'km'), unit(bignumber(1000), 'm'))).toBe(true);
    expect(equal(unit(fraction(50, 1), 'cm'), unit(fraction(1, 2), 'm'))).toBe(true);
    expect(equal(unit(bignumber(0), 'degC'), unit(bignumber(32), 'degF'))).toBe(true);
  });

  it('0.1 m + 0.2 m equals 0.3 m (relTol of scalar equal)', () => {
    const add = math.add as unknown as Fn;
    expect(equal(add(unit(0.1, 'm'), unit(0.2, 'm')), unit(0.3, 'm'))).toBe(true);
    expect(smallerEq(unit(0.3, 'm'), add(unit(0.1, 'm'), unit(0.2, 'm')))).toBe(true);
    expect(largerEq(unit(0.3, 'm'), add(unit(0.1, 'm'), unit(0.2, 'm')))).toBe(true);
  });
});
