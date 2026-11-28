import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { create as createMathjs, all as mathjsAll } from 'mathjs';

describe('mathjs #1788 relational relTol', () => {
  it('equal honors instance relTol via activated factory_equal', () => {
    const math = create(all);
    expect(math.equal(1, 0.991)).toBe(false);
    math.config({ relTol: 1e-2 });
    expect(math.equal(1, 0.991)).toBe(true);
  });

  it('compare honors instance relTol for scalar numbers', () => {
    const math = create(all);
    math.config({ relTol: 1e-2 });
    expect(math.compare(1, 0.991)).toBe(0);
  });

  it('unequal inverts equal within relTol', () => {
    const math = create(all);
    math.config({ relTol: 1e-2 });
    expect(math.unequal(1, 0.991)).toBe(false);
  });

  it('equal and unequal accept foreign mathjs Fraction scalars', () => {
    const math = create(all);
    const ref = createMathjs(mathjsAll);
    const f = ref.fraction(1, 3);
    expect(math.equal(f, math.fraction(1, 3))).toBe(true);
    expect(math.unequal(f, 1)).toBe(true);
  });

  it('compareNatural handles bigint versus number ties like mathjs', () => {
    const math = create(all);
    const ref = createMathjs(mathjsAll);
    expect(math.compareNatural(2n, 2)).toBe(ref.compareNatural(2n, 2));
    expect(math.compareNatural(2n, 1)).toBe(1);
  });
});

describe('mathjs #1788 statistics', () => {
  it('std returns NaN when input contains NaN', () => {
    const math = create(all);
    expect(math.std([NaN])).toBeNaN();
  });

  it('sum of empty array is zero', () => {
    const math = create(all);
    expect(math.sum([])).toBe(0);
  });

  it('mean rejects incompatible units with mathjs message', () => {
    const math = create(all);
    expect(() => math.mean(math.unit('5 m'), math.unit('3 kg'))).toThrow(/Units do not match/);
  });

  it('median(A, dim) is rejected', () => {
    const math = create(all);
    expect(() => math.median([1, 2, 3], 0)).toThrow(/median\(A, dim\) is not yet supported/);
  });

  it('mode throws when called with no arguments', () => {
    const math = create(all);
    expect(() => (math.mode as unknown as () => unknown)()).toThrow(
      /requires one or more parameters/
    );
  });

  it('corr rejects non-collection first arguments', () => {
    const math = create(all);
    expect(() => math.corr('2', 0)).toThrow(
      /Unexpected type of argument in function corr.*Array or Matrix/
    );
  });

  it('quantileSeq promotes numeric results when probabilities are BigNumber', () => {
    const math = create(all);
    const lst = [3.7, 2.7, 3.3, 1.3, 2.2, 3.1];
    const qs = math.quantileSeq(lst, [math.bignumber(0.5)]);
    expect(qs[0].constructor).toBe(math.BigNumber);
  });

  it('median returns a Fraction for two rational inputs', () => {
    const math = create(all);
    const a = math.fraction(1, 3);
    const b = math.fraction(1, 2);
    const m = math.median([a, b]) as { toString(): string };
    expect(m.toString()).toBe(math.fraction(5, 12).toString());
  });
});
