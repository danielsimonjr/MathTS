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
