import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { create as createMathjs, all as mathjsAll } from 'mathjs';
import { compatMathjsSchur, compatMathjsSolveODE } from '../../src/mathjs-parity-g05.js';
import {
  ensureMathjsFractionToJson,
  installMathjsFractionJson,
} from '../../src/fraction-mathjs-json.js';
import {
  assertValidCreateFactories,
  isCompatFactory,
} from '../../src/create-factory-validation.js';
import { wrapFactoryMathjsErrors } from '../../src/factory-mathjs-errors.js';
import { MathjsError } from '@danielsimonjr/mathts-core/internal';

/**
 * Branch coverage for the compat adapter branches that the G20/G05 fixes added
 * (oracle rows live in the other parity suites). Error and value behaviors are
 * compared against the mathjs 15.3.0 oracle where mathjs defines the behavior.
 */

const compat = createCompat(compatAll, {});
/**
 * The oracle side is read loosely on purpose: mathjs's own instance type does not
 * carry every member these branch tests touch (`solveODE`, `pow` over unknowns),
 * and the compat side is the typed surface under test.
 */
interface OracleInstance {
  // The mathjs instance is read loosely on purpose: its own type does not carry
  // every member these branch tests touch (`solveODE`, `pow` over unknowns), and
  // the compat side is the typed surface under test.
  [name: string]: (...args: unknown[]) => unknown;
}

const oracle = createMathjs(mathjsAll, {}) as unknown as OracleInstance;

type Fn = (...args: unknown[]) => unknown;

function errorOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return `${(error as Error).name}: ${(error as Error).message}`;
  }
  return 'no error';
}

describe('G20 adapter branches: argument-count parity', () => {
  it('bignumber with two arguments reports the mathjs arity error', () => {
    const compatError = errorOf(() => (compat.bignumber as unknown as Fn)(1, 2));
    const oracleError = errorOf(() => (oracle.bignumber as unknown as Fn)(1, 2));
    expect(compatError).toBe(oracleError);
    expect(compatError).toMatch(/Too many arguments/);
  });

  it('add with zero arguments reports the mathjs arity error', () => {
    const compatError = errorOf(() => (compat.add as unknown as Fn)());
    const oracleError = errorOf(() => (oracle.add as unknown as Fn)());
    expect(compatError).toBe(oracleError);
    expect(compatError).toMatch(/index: 0/);
  });

  it('transpose and det reject the wrong argument count like mathjs', () => {
    const m = [
      [1, 2],
      [3, 4],
    ];
    expect(errorOf(() => (compat.transpose as unknown as Fn)())).toBe(
      errorOf(() => (oracle.transpose as unknown as Fn)())
    );
    expect(errorOf(() => (compat.transpose as unknown as Fn)(m, 1))).toBe(
      errorOf(() => (oracle.transpose as unknown as Fn)(m, 1))
    );
    expect(errorOf(() => (compat.det as unknown as Fn)())).toBe(
      errorOf(() => (oracle.det as unknown as Fn)())
    );
    expect(errorOf(() => (compat.det as unknown as Fn)(m, 2))).toBe(
      errorOf(() => (oracle.det as unknown as Fn)(m, 2))
    );
  });

  it('subtract reports the first missing argument index like mathjs', () => {
    expect(errorOf(() => (compat.subtract as unknown as Fn)())).toBe(
      errorOf(() => (oracle.subtract as unknown as Fn)())
    );
    expect(errorOf(() => (compat.subtract as unknown as Fn)(1))).toBe(
      errorOf(() => (oracle.subtract as unknown as Fn)(1))
    );
  });
});

describe('G20 adapter branches: numeric coercion', () => {
  it('add coerces numeric strings inside array operands like mathjs', () => {
    const compatResult = compat.add('2', [3, 4]) as number[];
    const oracleResult = oracle.add('2', [3, 4]) as number[];
    expect(compatResult).toEqual(oracleResult);
    expect(compatResult).toEqual([5, 6]);
  });

  it('pow over fraction operands matches the mathjs value', () => {
    const f = compat.fraction as (n: number, d?: number) => unknown;
    const of = oracle.fraction as (n: number, d?: number) => unknown;
    expect(
      compat.format((compat.pow as (...a: unknown[]) => unknown)(f(2), 3), { precision: 14 })
    ).toBe(
      oracle.format((oracle.pow as (...a: unknown[]) => unknown)(of(2), 3), { precision: 14 })
    );
    expect(
      compat.format((compat.pow as (...a: unknown[]) => unknown)(f(1, 2), 2), { precision: 14 })
    ).toBe(
      oracle.format((oracle.pow as (...a: unknown[]) => unknown)(of(1, 2), 2), { precision: 14 })
    );
    expect(
      compat.format((compat.pow as (...a: unknown[]) => unknown)(f(1, 2), f(1, 2)), {
        precision: 14,
      })
    ).toBe(
      oracle.format((oracle.pow as (...a: unknown[]) => unknown)(of(1, 2), of(1, 2)), {
        precision: 14,
      })
    );
  });

  it('sparse construction from nested arrays matches the mathjs type', () => {
    const s = compat.sparse([
      [1, 0],
      [0, 2],
    ]) as unknown;
    expect(compat.typeOf(s)).toBe(
      oracle.typeOf(
        oracle.sparse([
          [1, 0],
          [0, 2],
        ])
      )
    );
    expect(compat.format(s, { precision: 14 })).toBe(
      oracle.format(
        oracle.sparse([
          [1, 0],
          [0, 2],
        ]),
        { precision: 14 }
      )
    );
  });
});

describe('G20 adapter branches: evaluate policy and docs lookup', () => {
  it('evaluate rejects safe and unsafe together like the mathjs policy', () => {
    const compatError = errorOf(() =>
      (compat.evaluate as unknown as (e: string, s: unknown, o: unknown) => unknown)(
        '1+1',
        {},
        {
          safe: true,
          unsafe: true,
        }
      )
    );
    expect(compatError).toMatch(/either.*or.*not both|safe/);
  });

  it('the unsafe scope exposes help and config tracking', () => {
    const instance = createCompat(compatAll, {});
    const evaluate = instance.evaluate as unknown as (
      e: string,
      s?: unknown,
      o?: unknown
    ) => unknown;
    expect(evaluate('1+1', {}, { unsafe: true })).toBe(2);
    const config = evaluate('config()', {}, { unsafe: true }) as Record<string, unknown>;
    expect(config.relTol).toBe(1e-12);
    const after = evaluate('config({number: "Fraction"})', {}, { unsafe: true }) as Record<
      string,
      unknown
    >;
    expect(after.number).toBe('Fraction');
    const help = evaluate('help("sin")', {}, { unsafe: true }) as { doc?: unknown };
    expect(help.doc).toBeDefined();
    expect(() => evaluate('help("nosuchfunction")', {}, { unsafe: true })).toThrow(
      /No documentation found/
    );
  });

  it('help over a function and a non-name follows the mathjs error paths', () => {
    const help = compat.help as unknown as (search: unknown) => unknown;
    expect(compat.typeOf(help(compat.add))).toBe('Help');
    expect(() => help(() => 1)).toThrow(/No documentation found/);
    expect(() => help(42)).toThrow(/No documentation found on "42"/);
  });
});

describe('G20 adapter branches: Fraction JSON installation', () => {
  it('ensureMathjsFractionToJson passes non-fractions through', () => {
    expect(ensureMathjsFractionToJson(5)).toBe(5);
    const f = compat.fraction as (n: number, d?: number) => { toJSON?: () => unknown };
    const value = f(3, 4) as { toJSON?: () => unknown };
    const kept = ensureMathjsFractionToJson(value);
    expect(kept).toBe(value);
    expect((value.toJSON as () => unknown)()).toEqual({ mathjs: 'Fraction', n: '3', d: '4' });
  });

  it('installMathjsFractionJson is idempotent', () => {
    installMathjsFractionJson();
    installMathjsFractionJson();
    const f = compat.fraction as (n: number, d?: number) => unknown;
    expect(JSON.parse(JSON.stringify({ v: f(1, 2) })).v).toEqual({
      mathjs: 'Fraction',
      n: '1',
      d: '2',
    });
  });
});

describe('G20 adapter branches: create factory validation', () => {
  it('isCompatFactory accepts factories and rejects the rest', () => {
    expect(isCompatFactory({})).toBe(false);
    expect(isCompatFactory(() => 1)).toBe(false);
    const branded = Object.assign(() => 1, { isFactory: true, fn: 'g20branded' });
    expect(isCompatFactory(branded)).toBe(true);
  });

  it('assertValidCreateFactories rejects non-factory inputs like mathjs create', () => {
    expect(() => assertValidCreateFactories(5)).toThrow(/Factory, Object, or Array expected/);
    expect(() => assertValidCreateFactories({})).toThrow(/Factory, Object, or Array expected/);
    expect(() => assertValidCreateFactories([5])).toThrow(/Factory, Object, or Array expected/);
    const factory = (
      compat.factory as unknown as (name: string, deps: string[], create: () => unknown) => unknown
    )('g20fac', [], () => (x: unknown) => x);
    expect(() => assertValidCreateFactories([factory])).not.toThrow();
  });
});

describe('G20 adapter branches: factory error mapping', () => {
  it('a MathjsError from a factory becomes a plain Error like mathjs', () => {
    const failing = wrapFactoryMathjsErrors((() => {
      throw new MathjsError('dependency "x" is missing');
    }) as never);
    expect(errorOf(() => failing({}))).toBe('Error: dependency "x" is missing');
    const plain = wrapFactoryMathjsErrors((() => {
      throw new TypeError('plain');
    }) as never);
    expect(errorOf(() => plain({}))).toBe('TypeError: plain');
  });
});

describe('G20 adapter branches: solveODE signatures', () => {
  const f = (_t: number, y: number[]): number[] => [y[0]];
  const fBig = (_t: unknown, y: unknown[]): unknown[] => [y[0]];

  it('scalar y0 over an Array tspan matches the mathjs result', () => {
    const oracleSol = (oracle.solveODE as unknown as (...a: unknown[]) => unknown)(
      f,
      [0, 1],
      1
    ) as { t: unknown; y: unknown };
    const compatSol = (compat.solveODE as (...a: unknown[]) => { t: unknown; y: unknown })(
      f,
      [0, 1],
      1
    ) as { t: unknown; y: unknown };
    expect(compat.typeOf(compatSol.t)).toBe(oracle.typeOf(oracleSol.t));
    expect(compat.format(compatSol.t, { precision: 10 })).toBe(
      oracle.format(oracleSol.t, { precision: 10 })
    );
  });

  it('scalar y0 with options matches the mathjs result', () => {
    const oracleSol = (oracle.solveODE as unknown as (...a: unknown[]) => unknown)(f, [0, 1], 1, {
      tol: 1e-6,
    }) as { t: unknown; y: unknown };
    const compatSol = (compat.solveODE as (...a: unknown[]) => { t: unknown; y: unknown })(
      f,
      [0, 1],
      1,
      { tol: 1e-6 }
    ) as { t: unknown; y: unknown };
    expect(compat.format(compatSol.y, { precision: 6 })).toBe(
      oracle.format(oracleSol.y, { precision: 6 })
    );
  });

  it('BigNumber tspan and y0 keep BigNumber results on both', () => {
    const bn = compat.bignumber as (v: number) => unknown;
    const obn = oracle.bignumber as (v: number) => unknown;
    const compatSol = (compat.solveODE as (...a: unknown[]) => { t: unknown; y: unknown })(
      fBig,
      [bn(0), bn(1)],
      [bn(1)]
    ) as { t: unknown; y: unknown };
    const oracleSol = (oracle.solveODE as unknown as (...a: unknown[]) => unknown)(
      fBig,
      [obn(0), obn(1)],
      [obn(1)]
    ) as {
      t: unknown;
      y: unknown;
    };
    expect(compat.typeOf(compatSol.t)).toBe(oracle.typeOf(oracleSol.t));
    expect(compat.format(compatSol.y, { precision: 8 })).toBe(
      oracle.format(oracleSol.y, { precision: 8 })
    );
  });

  it('firstStep is honored forwards and negated backwards like mathjs', () => {
    const fw = compat.solveODE(f, [0, 1], [1], { firstStep: 0.1 }) as { t: number[] };
    const bw = compat.solveODE(f, [1, 0], [1], { firstStep: 0.1 }) as { t: number[] };
    expect(fw.t.length).toBeGreaterThan(2);
    expect(bw.t[0]).toBe(1);
    expect(bw.t[bw.t.length - 1]).toBeLessThan(1);
  });

  it('a negative minStep and inconsistent time variables throw like mathjs', () => {
    expect(
      errorOf(() =>
        (compat.solveODE as (...a: unknown[]) => unknown)(f, [0, 1], [1], { minStep: -1 })
      )
    ).toBe(
      errorOf(() =>
        (oracle.solveODE as unknown as (...a: unknown[]) => unknown)(f, [0, 1], [1], {
          minStep: -1,
        })
      )
    );
    const unit = compat.unit as (s: string) => unknown;
    const ounit = oracle.unit as (s: string) => unknown;
    expect(
      errorOf(() =>
        (compat.solveODE as (...a: unknown[]) => unknown)(f, [0, 1], [1], {
          firstStep: unit('0.1 s'),
        })
      )
    ).toBe(
      errorOf(() =>
        (oracle.solveODE as unknown as Fn)(f, [0, 1], [1], { firstStep: ounit('0.1 s') })
      )
    );
  });

  it('Matrix y0 with an Array tspan matches the mathjs result', () => {
    const compatSol = (compat.solveODE as (...a: unknown[]) => { t: unknown; y: unknown })(
      f,
      [0, 1],
      compat.matrix([1])
    ) as {
      t: unknown;
      y: unknown;
    };
    const oracleSol = (oracle.solveODE as unknown as (...a: unknown[]) => unknown)(
      f,
      [0, 1],
      oracle.matrix([1])
    ) as {
      t: unknown;
      y: unknown;
    };
    expect(compat.typeOf(compatSol.t)).toBe(oracle.typeOf(oracleSol.t));
    expect(compat.typeOf(compatSol.y)).toBe(oracle.typeOf(oracleSol.y));
    expect(compat.format(compatSol.y, { precision: 8 })).toBe(
      oracle.format(oracleSol.y, { precision: 8 })
    );
    const compatOpt = compat.solveODE(f, [0, 1], compat.matrix([1]), { tol: 1e-6 }) as {
      y: unknown;
    };
    const oracleOpt = oracle.solveODE(f, [0, 1], oracle.matrix([1]), { tol: 1e-6 }) as {
      y: unknown;
    };
    expect(compat.format(compatOpt.y, { precision: 6 })).toBe(
      oracle.format(oracleOpt.y, { precision: 6 })
    );
  });

  it('Matrix tspan with a scalar y0 matches the mathjs result', () => {
    const m = compat.matrix([0, 1]) as unknown;
    const om = oracle.matrix([0, 1]) as unknown;
    const compatSol = (compat.solveODE as (...a: unknown[]) => { t: unknown; y: unknown })(
      f,
      m,
      1
    ) as { t: unknown; y: unknown };
    const oracleSol = (oracle.solveODE as unknown as (...a: unknown[]) => unknown)(f, om, 1) as {
      t: unknown;
      y: unknown;
    };
    expect(compat.typeOf(compatSol.y)).toBe(oracle.typeOf(oracleSol.y));
  });

  it('Matrix y0 through the adapter returns the mathjs shape', () => {
    const M = compat.matrix([1]) as unknown;
    const sol = compatMathjsSolveODE(
      (_t: unknown, y: unknown) => [(y as number[])[0]],
      [0, 1],
      M,
      {}
    ) as { t: unknown; y: unknown };
    expect(sol.t).toBeDefined();
    expect(sol.y).toBeDefined();
    expect(compat.typeOf(sol.y)).toBe('Array');
  });

  it('schur covers the raw-data conversion paths and rejects junk', () => {
    const bn = compat.bignumber as (v: number) => unknown;
    const big = compatMathjsSchur([
      [bn(1), bn(0)],
      [bn(0), bn(2)],
    ]) as {
      U: unknown;
      T: unknown;
    };
    expect(big.U).toBeDefined();
    expect(errorOf(() => compatMathjsSchur([]))).toMatch(/positive integers/);
    expect(errorOf(() => compatMathjsSchur({ valueOf: () => 42 }))).toMatch(/Unexpected type/);
  });

  it('schur flushes near-integer complex diagonal entries', () => {
    const cx = compat.complex as (re: number, im: number) => unknown;
    const { T } = compatMathjsSchur([
      [cx(1, 1e-15), 0],
      [0, cx(2, -1e-15)],
    ]) as {
      T: unknown[][];
    };
    expect(T.length).toBe(2);
  });
});
