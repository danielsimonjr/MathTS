import { describe, expect, it } from 'vitest';
import { type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat } from '../../src/index.js';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';

/**
 * G06 — the compat instance keeps BigNumber / Fraction / Complex results for
 * `pinv`, `bernoulli`, `unaryPlus`, and `compare` (#1554). Every row is the
 * captured mathjs 15.3.0 behavior from the issue; `expectSame` compares the
 * compat instance with the oracle. Direct calls and `evaluate` calls are both
 * covered: the `evaluate` rows run under `number: 'BigNumber'`, where the
 * mathjs expression layer turns the numeric literals into BigNumbers.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;

const BIG = { number: 'BigNumber' } as const;

/**
 * `expectSame` with the typed instance at the one cast choke point per file
 * (the repo's typed-dispatch convention for tests).
 */
function same(
  label: string,
  config: Record<string, unknown> | undefined,
  run: (L: Instance) => unknown
): void {
  expectSame(label, config, run as unknown as (L: Record<string, unknown>) => unknown);
}

describe('G06 #1554 — pinv keeps the input numeric type', () => {
  it('pinv(bignumber(2.5)) is BigNumber 0.4', () => {
    same('pinv(bignumber(2.5))', {}, (L: Instance) => L.pinv(L.bignumber('2.5')));
  });

  it('pinv(fraction(1,3)) is Fraction 3/1', () => {
    same('pinv(fraction(1,3))', {}, (L: Instance) => L.pinv(L.fraction(1, 3)));
  });

  it('pinv(complex(1,2)) is Complex 0.2 - 0.4i', () => {
    same('pinv(complex(1,2))', {}, (L: Instance) => L.pinv(L.complex(1, 2)));
  });

  it('pinv(4) is number 0.25 on the default config', () => {
    same('pinv(4)', {}, (L: Instance) => L.pinv(4));
  });

  it('pinv of a Fraction matrix keeps Fraction entries', () => {
    same('pinv([[fraction(1,2), 1]])', {}, (L: Instance) =>
      L.pinv([[L.fraction(1, 2), L.fraction(1)]])
    );
  });
});

describe('G06 #1554 — bernoulli keeps the input type', () => {
  it('bernoulli(fraction(12)) is Fraction -691/2730', () => {
    same('bernoulli(fraction(12))', {}, (L: Instance) => L.bernoulli(L.fraction(12)));
  });

  it('bernoulli(bignumber(12)) is BigNumber', () => {
    same('bernoulli(bignumber(12))', {}, (L: Instance) => L.bernoulli(L.bignumber(12)));
  });

  it('bernoulli(4) stays number on the default config', () => {
    same('bernoulli(4)', {}, (L: Instance) => L.bernoulli(4));
  });

  it('bernoulli(2n) is Fraction 1/6', () => {
    same('bernoulli(2n)', {}, (L: Instance) => L.bernoulli(2n));
  });

  it('bernoulli(0.5) throws the mathjs RangeError', () => {
    same('bernoulli(0.5)', {}, (L: Instance) => L.bernoulli(0.5));
  });
});

describe('G06 #1554 — unaryPlus keeps the type / honors config.number', () => {
  it('unaryPlus(Fraction) is the Fraction', () => {
    same('unaryPlus(fraction(2,3))', {}, (L: Instance) => L.unaryPlus(L.fraction(2, 3)));
  });

  it('unaryPlus(true) is number 1 on the default config', () => {
    same('unaryPlus(true)', {}, (L: Instance) => L.unaryPlus(true));
  });

  it('unaryPlus(true) is BigNumber 1 on the BigNumber config (direct call)', () => {
    same('unaryPlus(true) [BigNumber]', BIG, (L: Instance) => L.unaryPlus(true));
  });

  it('unaryPlus("2") is BigNumber 2 on the BigNumber config (direct call)', () => {
    same('unaryPlus("2") [BigNumber]', BIG, (L: Instance) => L.unaryPlus('2'));
  });

  it('evaluate("+true") is BigNumber 1 under BigNumber config', () => {
    same('evaluate(+true)', BIG, (L: Instance) => L.evaluate('+true'));
  });

  it('evaluate("+\\"2\\"") is BigNumber 2 under BigNumber config', () => {
    same('evaluate(+"2")', BIG, (L: Instance) => L.evaluate('+"2"'));
  });

  it('unaryPlus(bignumber(2)) is the BigNumber', () => {
    same('unaryPlus(bignumber(2))', {}, (L: Instance) => L.unaryPlus(L.bignumber(2)));
  });
});

describe('G06 #1554 — compare honors config.number and mixed types', () => {
  it('evaluate("compare(2, 3)") is BigNumber -1 under BigNumber config', () => {
    same('evaluate(compare(2, 3))', BIG, (L: Instance) => L.evaluate('compare(2, 3)'));
  });

  it('compare(bignumber(2), 3) is BigNumber -1 on the default config', () => {
    same('compare(bignumber(2), 3)', {}, (L: Instance) => L.compare(L.bignumber(2), 3));
  });

  it('compare(fraction(1,3), 1) matches the mathjs type', () => {
    same('compare(fraction(1,3), 1)', {}, (L: Instance) => L.compare(L.fraction(1, 3), 1));
  });

  it('evaluate("compare(2, 3)") is number -1 on the default config', () => {
    same('evaluate(compare(2, 3))', {}, (L: Instance) => L.evaluate('compare(2, 3)'));
  });

  it('compare(fraction(1,3), fraction(1,2)) stays Fraction-typed like mathjs', () => {
    same('compare(fraction, fraction)', {}, (L: Instance) =>
      L.compare(L.fraction(1, 3), L.fraction(1, 2))
    );
  });

  it('compare(complex, 1) throws the mathjs ordering error', () => {
    same('compare(complex, 1)', {}, (L: Instance) => L.compare(L.complex(1, 2), 1));
  });
});

describe('G06 #1554 — BigNumber-config evaluate rows from the issue', () => {
  const { compat } = pair(BIG) as unknown as { compat: Instance };

  it('evaluate("pinv(4)") is BigNumber 0.25', () => {
    const v = compat.evaluate('pinv(4)');
    expect(compat.typeOf(v)).toBe('BigNumber');
    expect(compat.format(v, { precision: 14 })).toBe('0.25');
  });

  it('evaluate("bernoulli(4)") is BigNumber -0.033333333333333', () => {
    const v = compat.evaluate('bernoulli(4)');
    expect(compat.typeOf(v)).toBe('BigNumber');
    expect(compat.format(v, { precision: 14 })).toBe('-0.033333333333333');
  });
});
