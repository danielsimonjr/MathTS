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

// ===========================================================================
// Source-instance coverage: `expectSame` runs both sides through the compat
// package entry (the built `dist`), so the adapter code in
// `src/mathjs-parity-g06.ts` needs its own rows against a source-built
// instance. The oracle is the same mathjs 15.3.0 instance.
// ===========================================================================

import { create as createOracle, all as oracleAll } from 'mathjs';
import { all as srcAll } from '../../src/index.js';
import { show } from './oracle.js';

type Lib = Record<string, (...args: unknown[]) => unknown> & {
  typeOf(value: unknown): string;
  format(value: unknown, options: { precision: number }): string;
};

const firstClause = (message: string): string => {
  const i = message.indexOf(':');
  return i === -1 ? message : message.slice(0, i + 1);
};

function outcomeOf(
  L: Lib,
  run: (l: Lib) => unknown
): { value: string } | { error: string; message: string } {
  try {
    return { value: show(L as never, run(L)) };
  } catch (e) {
    const err = e as Error;
    return { error: err.name, message: firstClause(err.message) };
  }
}

/** Compare a source-built compat instance with the mathjs oracle, like `expectSame`. */
function srcMatches(
  label: string,
  config: Record<string, unknown>,
  run: (L: Lib) => unknown
): void {
  const oracle = createOracle(oracleAll, config) as unknown as Lib;
  const src = createCompat(srcAll, config) as unknown as Lib;
  expect(outcomeOf(src, run), label).toEqual(outcomeOf(oracle, run));
}

const call = (L: Lib, name: string, ...args: unknown[]): unknown => L[name](...args);

describe('G06 #1554 — src-instance pinv (scalar and matrix paths)', () => {
  it('keeps BigNumber / Fraction / Complex scalars', () => {
    srcMatches('src pinv(bignumber)', {}, (L) => call(L, 'pinv', call(L, 'bignumber', '2.5')));
    srcMatches('src pinv(fraction)', {}, (L) => call(L, 'pinv', call(L, 'fraction', 1, 3)));
    srcMatches('src pinv(complex)', {}, (L) => call(L, 'pinv', call(L, 'complex', 1, 2)));
  });

  it('scalar zero / boolean / string / bigint rows', () => {
    srcMatches('src pinv(0)', {}, (L) => call(L, 'pinv', 0));
    srcMatches('src pinv(false)', {}, (L) => call(L, 'pinv', false));
    srcMatches('src pinv(true)', {}, (L) => call(L, 'pinv', true));
    srcMatches('src pinv("2")', {}, (L) => call(L, 'pinv', '2'));
    srcMatches('src pinv(2n)', {}, (L) => call(L, 'pinv', 2n));
    srcMatches('src pinv(complex zero)', {}, (L) => call(L, 'pinv', call(L, 'complex', 0, 0)));
  });

  it('square invertible, singular, and non-square matrix rows', () => {
    srcMatches('src pinv(square)', {}, (L) =>
      call(L, 'pinv', [
        [1, 2],
        [3, 4],
      ])
    );
    srcMatches('src pinv(singular square)', {}, (L) =>
      call(L, 'pinv', [
        [1, 2],
        [2, 4],
      ])
    );
    srcMatches('src pinv(row vector)', {}, (L) => call(L, 'pinv', [[1, 2]]));
    srcMatches('src pinv([[0,1]]) throws', {}, (L) => call(L, 'pinv', [[0, 1]]));
  });

  it('vector and zero-matrix rows', () => {
    srcMatches('src pinv([1,2])', {}, (L) => call(L, 'pinv', [1, 2]));
    srcMatches('src pinv([5])', {}, (L) => call(L, 'pinv', [5]));
    srcMatches('src pinv([0,0])', {}, (L) => call(L, 'pinv', [0, 0]));
    srcMatches('src pinv([[0,0]])', {}, (L) => call(L, 'pinv', [[0, 0]]));
  });

  it('tall and wide 2-D matrix rows', () => {
    srcMatches('src pinv([[1],[0]])', {}, (L) => call(L, 'pinv', [[1], [0]]));
    srcMatches('src pinv(dense [[1,2]])', {}, (L) => call(L, 'pinv', call(L, 'matrix', [[1, 2]])));
  });

  it('multi-argument calls keep the native arity rejection', () => {
    srcMatches('src pinv(1, 2)', {}, (L) => call(L, 'pinv', 1, 2));
    srcMatches('src bernoulli(2, 3)', {}, (L) => call(L, 'bernoulli', 2, 3));
  });

  it('higher-dimensional input throws the mathjs RangeError', () => {
    srcMatches('src pinv(3-D)', {}, (L) => call(L, 'pinv', [[[1], [2]]]));
  });

  it('DenseMatrix / SparseMatrix inputs (own and foreign)', () => {
    srcMatches('src pinv(own dense)', {}, (L) => call(L, 'pinv', call(L, 'matrix', [1, 2])));
    srcMatches('src pinv(own sparse)', {}, (L) => call(L, 'pinv', call(L, 'sparse', [[0, 1]])));
    srcMatches('src pinv(own dense 2x2)', {}, (L) =>
      call(
        L,
        'pinv',
        call(L, 'matrix', [
          [1, 2],
          [3, 4],
        ])
      )
    );
    const oracle = createOracle(oracleAll, {}) as unknown as Lib;
    const src = createCompat(srcAll, {}) as unknown as Lib;
    const foreign = call(oracle, 'matrix', [1, 2]);
    expect(show(src as never, call(src, 'pinv', foreign))).toBe(
      show(oracle as never, call(oracle, 'pinv', foreign))
    );
  });

  it('a Complex matrix element delegates to the native pinv', () => {
    srcMatches('src pinv(complex entry)', {}, (L) =>
      call(L, 'pinv', [[call(L, 'complex', 1, 2), 1]])
    );
  });
});

describe('G06 #1554 — src-instance bernoulli (every index type)', () => {
  it('number indexes, including the overflow rows', () => {
    srcMatches('src bernoulli(0)', {}, (L) => call(L, 'bernoulli', 0));
    srcMatches('src bernoulli(1)', {}, (L) => call(L, 'bernoulli', 1));
    srcMatches('src bernoulli(3)', {}, (L) => call(L, 'bernoulli', 3));
    srcMatches('src bernoulli(4)', {}, (L) => call(L, 'bernoulli', 4));
    srcMatches('src bernoulli(12)', {}, (L) => call(L, 'bernoulli', 12));
    srcMatches('src bernoulli(200)', {}, (L) => call(L, 'bernoulli', 200));
    srcMatches('src bernoulli(1000)', {}, (L) => call(L, 'bernoulli', 1000));
  });

  it('bigint and Fraction indexes', () => {
    srcMatches('src bernoulli(0n)', {}, (L) => call(L, 'bernoulli', 0n));
    srcMatches('src bernoulli(1n)', {}, (L) => call(L, 'bernoulli', 1n));
    srcMatches('src bernoulli(2n)', {}, (L) => call(L, 'bernoulli', 2n));
    srcMatches('src bernoulli(3n)', {}, (L) => call(L, 'bernoulli', 3n));
    srcMatches('src bernoulli(fraction(0))', {}, (L) =>
      call(L, 'bernoulli', call(L, 'fraction', 0))
    );
    srcMatches('src bernoulli(fraction(5))', {}, (L) =>
      call(L, 'bernoulli', call(L, 'fraction', 5))
    );
    srcMatches('src bernoulli(fraction(12))', {}, (L) =>
      call(L, 'bernoulli', call(L, 'fraction', 12))
    );
  });

  it('BigNumber indexes, including a non-default precision', () => {
    srcMatches('src bernoulli(bignumber(1))', {}, (L) =>
      call(L, 'bernoulli', call(L, 'bignumber', 1))
    );
    srcMatches('src bernoulli(bignumber(3))', {}, (L) =>
      call(L, 'bernoulli', call(L, 'bignumber', 3))
    );
    srcMatches('src bernoulli(bignumber(12))', {}, (L) =>
      call(L, 'bernoulli', call(L, 'bignumber', 12))
    );
    srcMatches('src bernoulli(bignumber(12)) [precision 40]', { precision: 40 }, (L) =>
      call(L, 'bernoulli', call(L, 'bignumber', 12))
    );
  });

  it('non-integer and negative indexes throw the mathjs RangeError', () => {
    srcMatches('src bernoulli(0.5)', {}, (L) => call(L, 'bernoulli', 0.5));
    srcMatches('src bernoulli(-2)', {}, (L) => call(L, 'bernoulli', -2));
    srcMatches('src bernoulli(fraction(1,3))', {}, (L) =>
      call(L, 'bernoulli', call(L, 'fraction', 1, 3))
    );
  });

  it('a string index converts like mathjs', () => {
    srcMatches('src bernoulli("2")', {}, (L) => call(L, 'bernoulli', '2'));
  });
});

describe('G06 #1554 — src-instance compare and unaryPlus', () => {
  it('compare throws the mathjs Complex and mixed-type errors', () => {
    srcMatches('src compare(complex, 1)', {}, (L) =>
      call(L, 'compare', call(L, 'complex', 1, 2), 1)
    );
    srcMatches('src compare(1, complex)', {}, (L) =>
      call(L, 'compare', 1, call(L, 'complex', 1, 2))
    );
    srcMatches('src compare(bignumber, fraction)', {}, (L) =>
      call(L, 'compare', call(L, 'bignumber', 2), call(L, 'fraction', 1, 3))
    );
    srcMatches('src compare(fraction, bignumber)', {}, (L) =>
      call(L, 'compare', call(L, 'fraction', 1, 3), call(L, 'bignumber', 2))
    );
  });

  it('compare keeps the operand type on the supported pairs', () => {
    srcMatches('src compare(bignumber, number)', {}, (L) =>
      call(L, 'compare', call(L, 'bignumber', 2), 3)
    );
    srcMatches('src compare(fraction, number)', {}, (L) =>
      call(L, 'compare', call(L, 'fraction', 1, 3), 1)
    );
    srcMatches('src compare(number, number)', {}, (L) => call(L, 'compare', 2, 3));
    const oracle = createOracle(oracleAll, {}) as unknown as Lib;
    const src = createCompat(srcAll, {}) as unknown as Lib;
    const foreign = call(oracle, 'bignumber', 0.5);
    expect(show(src as never, call(src, 'compare', foreign, -0.5))).toBe(
      show(oracle as never, call(oracle, 'compare', foreign, -0.5))
    );
  });

  it('unaryPlus keeps the operand type and honors config.number', () => {
    srcMatches('src unaryPlus(fraction)', {}, (L) =>
      call(L, 'unaryPlus', call(L, 'fraction', 2, 3))
    );
    srcMatches('src unaryPlus(bignumber)', {}, (L) =>
      call(L, 'unaryPlus', call(L, 'bignumber', 2))
    );
    srcMatches('src unaryPlus(complex)', {}, (L) => call(L, 'unaryPlus', call(L, 'complex', 1, 2)));
    srcMatches('src unaryPlus(true)', {}, (L) => call(L, 'unaryPlus', true));
    srcMatches('src unaryPlus(true) [BigNumber]', BIG, (L) => call(L, 'unaryPlus', true));
    srcMatches('src unaryPlus("2") [BigNumber]', BIG, (L) => call(L, 'unaryPlus', '2'));
    srcMatches('src unaryPlus("5 cm")', {}, (L) => call(L, 'unaryPlus', '5 cm'));
    srcMatches('src unaryPlus("abc")', {}, (L) => call(L, 'unaryPlus', 'abc'));
    srcMatches('src unaryPlus(unit)', {}, (L) => call(L, 'unaryPlus', call(L, 'unit', '5 cm')));
  });
});
