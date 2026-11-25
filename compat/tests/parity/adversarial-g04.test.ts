import { describe, it, expect } from 'vitest';
import { create as createOracle, all as oracleAll } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Adversarial differential tests for G04 (unit equality), run against the mathjs 15.3.0
 * oracle. Per the challenger policy of Nov 25 (Daniel, 12:08 PM CT), the CRITICAL native
 * libraries (typed-function, core, matrix, functions, workerpool, gpu, parallel) are NOT
 * changed to match mathjs: every mathjs-matching behavior must come from `compat/`
 * (wrappers, compat factories, adapters). These tests therefore assert the behavior a
 * *consumer of `@danielsimonjr/mathts-compat`* must see, and they fail whenever a unit
 * comparison reaches a native path that still diverges from mathjs 15.3.0.
 *
 * The comparison shape matches the parity harnesses: `typeOf` plus
 * `format(value, { precision: 14 })`, or the thrown error name and message. Every case is
 * differential (compat vs oracle), so nothing here is pinned from memory.
 */

type OracleInstance = ReturnType<typeof createOracle>;
type CompatInstance = ReturnType<typeof createCompat> & OracleInstance;
type Instance = CompatInstance;

const CONFIGS: [string, Record<string, unknown>][] = [
  ['default', {}],
  ['number: BigNumber', { number: 'BigNumber' }],
  ['number: Fraction', { number: 'Fraction' }],
];

function show(L: Instance, v: unknown): string {
  return L.typeOf(v) + ' ' + L.format(v, { precision: 14 });
}

function outcome(L: Instance, run: () => unknown): string {
  try {
    return show(L, run());
  } catch (e) {
    const err = e as Error;
    return 'throws ' + err.name + ': ' + err.message;
  }
}

/** Run `fn` against the oracle and the compat instance of one config and return both outcomes. */
function both(config: Record<string, unknown>, fn: (L: Instance) => unknown) {
  const oracle = createOracle(oracleAll, config) as unknown as Instance;
  const compat = createCompat(compatAll, config) as unknown as Instance;
  return {
    oracle: outcome(oracle, () => fn(oracle)),
    compat: outcome(compat, () => fn(compat)),
  };
}

describe('G04 adversarial: Unit equality through the compat layer', () => {
  // F1. `50 cm == 0.5 m` with BigNumber values must be true, as in mathjs. The builder's
  // fix lives only in `functions/src/typed/*`, which the policy forbids changing; a
  // compat-layer implementation must deliver it. At origin/main it is still false.
  for (const [name, config] of CONFIGS) {
    it(`F1 equal(unit(bignumber(50),'cm'), unit(bignumber(0.5),'m')) is true [${name}]`, () => {
      const { oracle, compat } = both(config, (L) =>
        L.equal(L.unit(L.bignumber(50), 'cm'), L.unit(L.bignumber(0.5), 'm'))
      );
      expect(compat).toBe(oracle);
      expect(compat).toBe('boolean true');
    });

    it(`F1 unequal(unit(bignumber(50),'cm'), unit(bignumber(0.5),'m')) is false [${name}]`, () => {
      const { oracle, compat } = both(config, (L) =>
        L.unequal(L.unit(L.bignumber(50), 'cm'), L.unit(L.bignumber(0.5), 'm'))
      );
      expect(compat).toBe(oracle);
      expect(compat).toBe('boolean false');
    });

    it(`F1 equal(unit(bignumber(1),'m'), unit(bignumber(100),'cm')) is true [${name}]`, () => {
      const { oracle, compat } = both(config, (L) =>
        L.equal(L.unit(L.bignumber(1), 'm'), L.unit(L.bignumber(100), 'cm'))
      );
      expect(compat).toBe(oracle);
      expect(compat).toBe('boolean true');
    });
  }

  // F2. A dimension mismatch across the whole relational family must throw mathjs's
  // `Cannot compare units with different base`. `equal`/`unequal`/`equalScalar` return a
  // boolean today (no throw) and the ordering family throws its own wording
  // `Cannot compare units with different dimensions`.
  it('F2 equal(1 m, 1 s) throws "Cannot compare units with different base"', () => {
    const { oracle, compat } = both({}, (L) => L.equal(L.unit(1, 'm'), L.unit(1, 's')));
    expect(compat).toBe(oracle);
    expect(compat).toContain('Cannot compare units with different base');
  });

  it('F2 unequal(1 m, 1 s) throws "Cannot compare units with different base"', () => {
    const { oracle, compat } = both({}, (L) => L.unequal(L.unit(1, 'm'), L.unit(1, 's')));
    expect(compat).toBe(oracle);
    expect(compat).toContain('Cannot compare units with different base');
  });

  it('F2 equalScalar(1 m, 1 s) throws "Cannot compare units with different base"', () => {
    const { oracle, compat } = both({}, (L) => L.equalScalar(L.unit(1, 'm'), L.unit(1, 's')));
    expect(compat).toBe(oracle);
    expect(compat).toContain('Cannot compare units with different base');
  });

  for (const fn of ['larger', 'smaller', 'largerEq', 'smallerEq', 'compare'] as const) {
    it(`F2 ${fn}(1 m, 1 s) throws "Cannot compare units with different base"`, () => {
      const { oracle, compat } = both({}, (L) =>
        (L[fn] as (...a: unknown[]) => unknown)(L.unit(1, 'm'), L.unit(1, 's'))
      );
      expect(compat).toBe(oracle);
      expect(compat).toContain('Cannot compare units with different base');
    });
  }

  // F3. deepEqual of two Units must match mathjs: a scalar Unit pair throws
  // `Cannot convert "<string>" to a number` (mathjs compares the string forms numerically),
  // while an Array of Units of equal measured quantity is [true].
  it('F3 deepEqual(unit(1 m), unit(1 m)) throws "Cannot convert ... to a number"', () => {
    const { oracle, compat } = both({}, (L) => L.deepEqual(L.unit(1, 'm'), L.unit(1, 'm')));
    expect(compat).toBe(oracle);
    expect(compat).toContain('Cannot convert');
  });

  it('F3 deepEqual([unit(1 m)], [unit(100 cm)]) is true', () => {
    const { oracle, compat } = both({}, (L) => L.deepEqual([L.unit(1, 'm')], [L.unit(100, 'cm')]));
    expect(compat).toBe(oracle);
    expect(compat).toBe('boolean true');
  });

  // F4. Ordering a Complex-valued Unit must throw, exactly as mathjs: there is no ordering
  // relation for complex numbers. Today compat reduces the Complex to its modulus (Number()),
  // so `compare` returns 1 and `larger` returns true instead of throwing.
  for (const fn of ['larger', 'smaller', 'largerEq', 'smallerEq', 'compare'] as const) {
    it(`F4 ${fn}(unit(3+4i m), unit(1+1i m)) throws "No ordering relation is defined for complex numbers"`, () => {
      const { oracle, compat } = both({}, (L) =>
        (L[fn] as (...a: unknown[]) => unknown)(
          L.unit(L.complex(3, 4), 'm'),
          L.unit(L.complex(1, 1), 'm')
        )
      );
      expect(compat).toBe(oracle);
      expect(compat).toContain('No ordering relation is defined for complex numbers');
    });
  }

  // F5. `compare` of two Units must return the value's own type, as mathjs does: a BigNumber
  // for BigNumber values and a Fraction for Fraction values. Compat returns a plain number.
  it('F5 compare(unit(bignumber(1) m), unit(bignumber(2) m)) returns a BigNumber', () => {
    const { oracle, compat } = both({ number: 'BigNumber' }, (L) =>
      L.compare(L.unit(L.bignumber(1), 'm'), L.unit(L.bignumber(2), 'm'))
    );
    expect(compat).toBe(oracle);
    expect(compat.startsWith('BigNumber')).toBe(true);
  });

  it('F5 compare(unit(fraction(1,2) m), unit(fraction(1,4) m)) returns a Fraction', () => {
    const { oracle, compat } = both({ number: 'Fraction' }, (L) =>
      L.compare(L.unit(L.fraction(1, 2), 'm'), L.unit(L.fraction(1, 4), 'm'))
    );
    expect(compat).toBe(oracle);
    expect(compat.startsWith('Fraction')).toBe(true);
  });

  // F6. A Unit whose value is Complex must compare by Complex equality, not by modulus:
  // `3+4i m` and `5+0i m` share the modulus 5 but are NOT equal. Today compat returns true.
  it('F6 equal(unit(3+4i m), unit(5+0i m)) is false (modulus collision)', () => {
    const { oracle, compat } = both({}, (L) =>
      L.equal(L.unit(L.complex(3, 4), 'm'), L.unit(L.complex(5, 0), 'm'))
    );
    expect(compat).toBe(oracle);
    expect(compat).toBe('boolean false');
  });

  it('F6 equal(unit(1+2i m), unit(1+2i m)) is true', () => {
    const { oracle, compat } = both({}, (L) =>
      L.equal(L.unit(L.complex(1, 2), 'm'), L.unit(L.complex(1, 2), 'm'))
    );
    expect(compat).toBe(oracle);
    expect(compat).toBe('boolean true');
  });

  // F7. A comparison between a BigNumber Unit value and a Fraction Unit value must throw the
  // mathjs implicit-conversion error, not return a boolean.
  it('F7 equal(unit(bignumber(0.1) m), unit(fraction(1,10) m)) throws the implicit-conversion error', () => {
    const { oracle, compat } = both({}, (L) =>
      L.equal(L.unit(L.bignumber('0.1'), 'm'), L.unit(L.fraction(1, 10), 'm'))
    );
    expect(compat).toBe(oracle);
    expect(compat).toContain('Cannot implicitly convert');
  });

  // F8. A Fraction Unit value compared with a number Unit value follows mathjs's
  // tolerance/rounding rule: 1/3 m equals 0.3333333333333333 m (true), and a number that is
  // not exactly representable as a Fraction throws the loss-of-precision error.
  it('F8 equal(unit(fraction(1,3) m), unit(0.3333333333333333 m)) is true', () => {
    const { oracle, compat } = both({}, (L) =>
      L.equal(L.unit(L.fraction(1, 3), 'm'), L.unit(0.3333333333333333, 'm'))
    );
    expect(compat).toBe(oracle);
    expect(compat).toBe('boolean true');
  });

  it('F8 equal(unit(fraction(1,3) m), unit(0.3333333334 m)) throws the loss-of-precision error', () => {
    const { oracle, compat } = both({}, (L) =>
      L.equal(L.unit(L.fraction(1, 3), 'm'), L.unit(0.3333333334, 'm'))
    );
    expect(compat).toBe(oracle);
    expect(compat).toContain('loss of precision');
  });
});
