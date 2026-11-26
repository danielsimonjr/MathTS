import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { create as createMathjs, all as mathjsAll } from 'mathjs';

/**
 * Second branch-coverage pass for the adapter surfaces the G20/G05 fixes added:
 * chain edge cases, solveODE BigNumber options, the `predictable` fraction-power
 * fallbacks, the unsafe-scope expression bindings and the Fraction-aware
 * `format`/`print` wrappers. Values and errors are compared against the mathjs
 * 15.3.0 oracle where mathjs defines the behavior.
 */

const compat = createCompat(compatAll, {});
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

describe('G20 chain edge cases', () => {
  it('calling the Chain constructor without new throws like mathjs', () => {
    const Chain = compat.Chain as unknown as { call(v: unknown): unknown };
    const compatError = errorOf(() => Chain.call(2));
    const oracleError = errorOf(() =>
      (oracle.Chain as unknown as { call(v: unknown): unknown }).call(2)
    );
    expect(compatError).toBe(oracleError);
    expect(compatError).toMatch(/new operator/);
  });

  it('an unknown property on a chain is undefined like mathjs', () => {
    const compatValue = (compat.chain(2) as unknown as Record<string, unknown>).g20Nope;
    const oracleValue = (oracle.chain(2) as unknown as Record<string, unknown>).g20Nope;
    expect(compatValue).toBe(oracleValue);
    expect(compatValue).toBeUndefined();
  });

  it('an imported function becomes a lazy chain method like mathjs', () => {
    const compatImport = compat.import as unknown as (
      o: Record<string, unknown>,
      o2?: unknown
    ) => void;
    const oracleImport = oracle.import as unknown as (
      o: Record<string, unknown>,
      o2?: unknown
    ) => void;
    const fn = (x: unknown) => (x as number) + 1;
    compatImport({ g20chainfn: fn }, { override: true });
    oracleImport({ g20chainfn: fn }, { override: true });
    expect(compat.chain(1).g20chainfn(4).done()).toBe(2);
    expect(
      (oracle.chain(1) as { g20chainfn(v: number): { done(): number } }).g20chainfn(4).done()
    ).toBe(2);
  });
});

describe('G20 solveODE BigNumber options', () => {
  const f = (_t: number, y: number[]): number[] => [y[0]];
  const fBig = (_t: unknown, y: unknown[]): unknown[] => [y[0]];
  const bn = compat.bignumber as (v: number) => unknown;
  const obn = oracle.bignumber as (v: number) => unknown;

  it('BigNumber run with firstStep keeps BigNumber results on both', () => {
    const compatSol = (compat.solveODE as (...a: unknown[]) => { t: unknown; y: unknown })(
      fBig,
      [bn(0), bn(1)],
      [bn(1)],
      { firstStep: bn(0.1) }
    );
    const oracleSol = oracle.solveODE(fBig, [obn(0), obn(1)], [obn(1)], {
      firstStep: obn(0.1),
    }) as { t: unknown; y: unknown };
    expect(compat.typeOf(compatSol.t)).toBe(oracle.typeOf(oracleSol.t));
    expect(compat.format(compatSol.y, { precision: 6 })).toBe(
      oracle.format(oracleSol.y, { precision: 6 })
    );
  });

  it('backwards BigNumber run with firstStep matches the mathjs direction', () => {
    const compatSol = (compat.solveODE as (...a: unknown[]) => { t: unknown[] })(
      fBig,
      [bn(1), bn(0)],
      [bn(1)],
      { firstStep: bn(0.1) }
    );
    const oracleSol = oracle.solveODE(fBig, [obn(1), obn(0)], [obn(1)], {
      firstStep: obn(0.1),
    }) as { t: unknown[] };
    expect(compat.format(compatSol.t, { precision: 6 })).toBe(
      oracle.format(oracleSol.t, { precision: 6 })
    );
  });

  it('Matrix tspan with a scalar y0 and options matches the mathjs result', () => {
    const m = compat.matrix([0, 1]) as unknown;
    const om = oracle.matrix([0, 1]) as unknown;
    const compatSol = (compat.solveODE as (...a: unknown[]) => { t: unknown; y: unknown })(
      f,
      m,
      1,
      { tol: 1e-6 }
    );
    const oracleSol = (oracle.solveODE as unknown as Fn)(f, om, 1, { tol: 1e-6 }) as {
      t: unknown;
      y: unknown;
    };
    expect(compat.typeOf(compatSol.y)).toBe(oracle.typeOf(oracleSol.y));
    expect(compat.format(compatSol.y, { precision: 6 })).toBe(
      oracle.format(oracleSol.y, { precision: 6 })
    );
  });
});

describe('G20 predictable fraction-power fallbacks', () => {
  it('pow(-8, 1/3) under predictable matches the mathjs behavior', () => {
    const p = createCompat(compatAll, { predictable: true });
    const po = createMathjs(mathjsAll, { predictable: true });
    const f = p.fraction as (n: number, d?: number) => unknown;
    const of = po.fraction as (n: number, d?: number) => unknown;
    expect(errorOf(() => (p.pow as (...a: unknown[]) => unknown)(-8, f(1, 3)))).toBe(
      errorOf(() => (po.pow as (...a: unknown[]) => unknown)(-8, of(1, 3)))
    );
    expect(errorOf(() => (p.pow as (...a: unknown[]) => unknown)(-8, 1 / 3))).toBe(
      errorOf(() => (po.pow as (...a: unknown[]) => unknown)(-8, 1 / 3))
    );
  });

  it('pow(-2, Infinity) under predictable is NaN like mathjs', () => {
    const p = createCompat(compatAll, { predictable: true });
    const po = createMathjs(mathjsAll, { predictable: true });
    expect(p.format(p.pow(-2, Infinity), { precision: 14 })).toBe(
      po.format(po.pow(-2, Infinity), { precision: 14 })
    );
  });
});

describe('G20 unsafe-scope expression bindings', () => {
  it('evaluate() inside the unsafe scope reads and updates the config', () => {
    const evaluate = compat.evaluate as unknown as (e: string, s?: unknown, o?: unknown) => unknown;
    const inner = evaluate('evaluate("config()")', {}, { unsafe: true }) as Record<string, unknown>;
    expect(inner.relTol).toBe(1e-12);
    const updated = evaluate(
      'evaluate("config({number: \\"BigNumber\\"})")',
      {},
      { unsafe: true }
    ) as Record<string, unknown>;
    expect(updated.number).toBe('BigNumber');
  });

  it('help() inside the unsafe scope resolves a function reference', () => {
    const evaluate = compat.evaluate as unknown as (e: string, s?: unknown, o?: unknown) => unknown;
    const help = evaluate('help(sin)', {}, { unsafe: true }) as { doc?: { name?: string } };
    expect(help.doc?.name).toBe('sin');
  });
});

describe('G20 Fraction-aware format and print wrappers', () => {
  it('format accepts a numeric precision argument like mathjs', () => {
    expect(compat.format(1 / 3, 5)).toBe(oracle.format(1 / 3, 5));
  });

  it('format accepts a BigNumber precision like mathjs', () => {
    const bn = compat.bignumber as (v: number) => unknown;
    const obn = oracle.bignumber as (v: number) => unknown;
    expect(compat.format(1 / 3, bn(6))).toBe(oracle.format(1 / 3, obn(6)));
    expect(compat.format(1 / 3, { precision: bn(7) })).toBe(
      oracle.format(1 / 3, { precision: obn(7) })
    );
  });

  it('a unit on the default config formats without ratio promotion', () => {
    const unit = compat.unit as (s: string) => unknown;
    const ounit = oracle.unit as (s: string) => unknown;
    expect(compat.format(unit('5.5 cm'), { precision: 14 })).toBe(
      oracle.format(ounit('5.5 cm'), { precision: 14 })
    );
  });

  it('string over a Fraction array matches the mathjs rendering', () => {
    const f = compat.fraction as (n: number, d?: number) => unknown;
    const of = oracle.fraction as (n: number, d?: number) => unknown;
    expect(JSON.stringify(compat.string([f(1, 2), f(3, 4)]))).toBe(
      JSON.stringify(oracle.string([of(1, 2), of(3, 4)]))
    );
  });

  it('print with a dotted template placeholder matches the mathjs output', () => {
    const compatOut = (compat.print as unknown as Fn)('v={{a.b}}', { a: { b: 5 } });
    const oracleOut = (oracle.print as unknown as Fn)('v={{a.b}}', { a: { b: 5 } });
    expect(compatOut).toBe(oracleOut);
  });

  it('print with a non-string first argument reports the mathjs error', () => {
    const compatError = errorOf(() => (compat.print as unknown as Fn)(5));
    const oracleError = errorOf(() => (oracle.print as unknown as Fn)(5));
    expect(compatError).toBe(oracleError);
    expect(compatError).toMatch(/expected: string or boolean/);
  });
});
