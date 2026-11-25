import { describe, it, expect, beforeAll } from 'vitest';
import { create, all } from 'mathjs';
import { Fraction, Unit as CoreUnit } from '@danielsimonjr/mathts-core';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Adversarial probes for G03 (#1551), against the builder branch
 * `cursor/g03-fraction-sign-fields-6c42` (commit 3958373e).
 *
 * The builder ported the `isPositive` / `isNegative` Fraction signatures from the
 * fraction.js field names `.s`/`.n` to the MathTS `Fraction` API, and touched `isInteger`,
 * `fix` and the `predictable`-mode `pow` **numeric** shortcut. These are the divergences
 * from the mathjs 15.3.0 oracle that the branch still has, in the same area. Each `it` is a
 * real failing test on 3958373e; nothing here is fixed. Where a case is pre-existing (it
 * also fails on the parent commit `c6d0432b`) the block says so.
 *
 * Comparison rule (the plan's own): `typeOf` + `format(value, { precision: 14 })`, or the
 * thrown error name.
 */

type L = ReturnType<typeof createCompat> & ReturnType<typeof create>;

const oracle = create(all) as unknown as L;
const compat = () => createCompat(compatAll) as unknown as L;

function show(lib: L, v: unknown): string {
  try {
    return lib.typeOf(v) + ' ' + lib.format(v, { precision: 14 });
  } catch {
    return lib.typeOf(v) + ' ' + String(v);
  }
}

function outcome(lib: L, fn: (l: L) => unknown): { ok: boolean; text: string } {
  try {
    return { ok: true, text: show(lib, fn(lib)) };
  } catch (e) {
    return { ok: false, text: (e as Error).name };
  }
}

// ---------------------------------------------------------------------------
// F1 — Unit.typeConverters.BigNumber still reads the fraction.js fields .s/.n/.d
// ---------------------------------------------------------------------------
//
// `core/src/types/unit/Unit.ts` `typeConverters.BigNumber` is:
//
//     if (fx?.isFraction) {
//       return new BigNumber(String(fx.n)).div(String(fx.d)).times(String(fx.s));
//     }
//
// `fx.isFraction` is true on a MathTS `Fraction` (it carries the mathjs marker via
// defineTypeMarkers), but `fx.n` / `fx.d` / `fx.s` are all `undefined`, so the converter
// builds `new BigNumber('undefined')` and throws. This is the exact class of bug the
// builder fixed in isPositive/isNegative/isInteger/fix/pow, on a Fraction-typed value,
// left un-fixed. It is the same root cause #1551 is about, and the plan's "grep
// functions/src for x.s / x.n on values typed as Fraction and fix every hit" step misses
// it because it lives in `core`. mathjs 15.3.0's converter reads fraction.js's `.n`/`.d`/
// `.s` (which do exist there) and returns 1/3 as a BigNumber. Pre-existing: identical on
// the parent commit.
describe('F1: Unit BigNumber converter still reads .s/.n/.d on a Fraction (#1551 missed hit)', () => {
  it('Unit.typeConverters.BigNumber(fraction(1,3)) matches mathjs', () => {
    const run = (l: L) =>
      l.Unit.typeConverters.BigNumber(
        l.fraction(1, 3) as unknown as Parameters<typeof l.Unit.typeConverters.BigNumber>[0]
      );
    expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
  });

  it('Unit.typeConverters.BigNumber(fraction(-5,2)) matches mathjs', () => {
    const run = (l: L) =>
      l.Unit.typeConverters.BigNumber(
        l.fraction(-5, 2) as unknown as Parameters<typeof l.Unit.typeConverters.BigNumber>[0]
      );
    expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
  });

  it('Unit._getNumberConverter("BigNumber")(fraction(1,3)) matches mathjs', () => {
    const run = (l: L) =>
      l.Unit._getNumberConverter('BigNumber')(
        l.fraction(1, 3) as unknown as Parameters<ReturnType<typeof l.Unit._getNumberConverter>>[0]
      ) as unknown;
    expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
  });
});

// ---------------------------------------------------------------------------
// F2 — pow(Fraction, Fraction): the exact-type and negative-root cases
// ---------------------------------------------------------------------------
//
// The builder changed `.d`/`.n` -> `denominator`/`numerator` in the **numeric** predictable
// shortcut of `_pow(x: number, y: number)`. The *separate* `'Fraction, Fraction'` signature
// still guards the exact root behind `y.denominator === 1n` and otherwise drops to
// `_pow(x.valueOf(), y.valueOf())`, i.e. a plain-double power. So a Fraction base loses its
// exact type where mathjs keeps it (`pow(fraction(4), fraction(1,2))` is `Fraction 2/1` in
// mathjs, `number 2` here), and a negative Fraction base under an odd-root Fraction
// exponent, which mathjs returns as a `Complex` principal root, comes back `NaN`
// (`pow(fraction(-8), fraction(1,3))`). Pre-existing: identical on the parent commit; the
// `Fraction, Fraction` pair is not in the sweep pool, so `known-gaps.json` has no entry.
describe('F2: pow(Fraction, Fraction) exact type and negative root', () => {
  const CASES: [string, (l: L) => unknown][] = [
    [
      'pow(fraction(4), fraction(1,2)) exact Fraction',
      (l) => l.pow(l.fraction(4), l.fraction(1, 2)),
    ],
    [
      'pow(fraction(9,4), fraction(1,2)) exact Fraction',
      (l) => l.pow(l.fraction(9, 4), l.fraction(1, 2)),
    ],
    [
      'pow(fraction(27), fraction(2,3)) exact Fraction',
      (l) => l.pow(l.fraction(27), l.fraction(2, 3)),
    ],
    [
      'pow(fraction(-8), fraction(1,3)) principal Complex root',
      (l) => l.pow(l.fraction(-8), l.fraction(1, 3)),
    ],
    [
      'pow(fraction(-8), fraction(2,3)) principal Complex root',
      (l) => l.pow(l.fraction(-8), l.fraction(2, 3)),
    ],
  ];

  for (const [label, run] of CASES) {
    it(`${label} matches mathjs 15.3.0`, () => {
      expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
    });
  }

  it('pow(fraction(4), fraction(1,2)) keeps the Fraction type', () => {
    const c = compat();
    const o = oracle;
    expect(c.typeOf(c.pow(c.fraction(4), c.fraction(1, 2)))).toBe(
      o.typeOf(o.pow(o.fraction(4), o.fraction(1, 2)))
    );
  });
});

// ---------------------------------------------------------------------------
// F3 — pow in `predictable` mode with a Fraction base and Fraction exponent
// ---------------------------------------------------------------------------
//
// In `predictable` mode mathjs throws "Result of pow is non-rational and cannot be
// expressed as a fraction" whenever the Fraction power has no exact root. The builder's
// new test / changeset claim the predictable-mode pow fraction path is fixed, but that fix
// only reaches the **number** base path (`pow(-8, 1/3)` now correctly gives -2). A
// Fraction base or exponent still returns `number NaN` (or a wrong number) instead of the
// mathjs error, and the exact-root cases still lose the Fraction type. Pre-existing; the
// Fraction x Fraction pair is absent from the sweep pool.
describe('F3: pow in predictable mode with a Fraction base or exponent', () => {
  const cfg = { predictable: true };
  const c = () => createCompat(compatAll, cfg) as unknown as L;
  const o = create(all, cfg) as unknown as L;

  it('predictable pow(fraction(-8), fraction(1,3)) throws the mathjs error', () => {
    const run = (l: L) => l.pow(l.fraction(-8), l.fraction(1, 3));
    expect(outcome(c(), run)).toEqual(outcome(o, run));
  });

  it('predictable pow(-8, fraction(1,3)) throws the mathjs error', () => {
    const run = (l: L) => l.pow(-8, l.fraction(1, 3));
    expect(outcome(c(), run)).toEqual(outcome(o, run));
  });

  it('predictable pow(fraction(4), fraction(1,2)) stays an exact Fraction', () => {
    const run = (l: L) => l.pow(l.fraction(4), l.fraction(1, 2));
    expect(outcome(c(), run)).toEqual(outcome(o, run));
  });
});

// ---------------------------------------------------------------------------
// F4 — the builder's source-scan guard is vacuous for a multi-line signature
// ---------------------------------------------------------------------------
//
// `functions/tests/fraction-sign-fields.test.ts` only inspects source *lines* that START
// with a `Fraction:` key and then looks for `.s`/`.n`/`.d` on that SAME line. Every real
// Fraction signature in the guarded files is written across several lines, so
// re-introducing the exact bug the guard exists to prevent passes the scan. It is also
// blind to `x['s']`. This test copies the guard's two regexes verbatim and asserts that it
// catches the multi-line shapes. It does not, so the guard cannot protect the fix.
describe('F4: the source-scan guard catches multi-line Fraction signatures', () => {
  // Shared with functions/tests/fraction-sign-fields.test.ts (multiline-aware).
  const scanModule = new URL('../helpers/fraction-signature-field-scan.ts', import.meta.url).href;
  let scanFractionFieldReads: (source: string) => string[];

  beforeAll(async () => {
    ({ scanFractionFieldReads } = await import(scanModule));
  });

  const blockBody = [
    '      Fraction: function (x: FractionType): boolean {',
    '        // the fraction.js field names, back again',
    '        return x.s > 0n && x.n > 0n;',
    '      },',
  ].join('\n');
  const arrowBody = ['      Fraction: (x: FractionType): boolean =>', '        x.s > 0n,'].join(
    '\n'
  );
  const bracketRead = [
    '      Fraction: function (x: FractionType): boolean {',
    "        return x['s'] > 0n;",
    '      },',
  ].join('\n');

  it('flags each multi-line shape of the original #1551 bug', () => {
    expect(scanFractionFieldReads(blockBody).length).toBeGreaterThan(0);
    expect(scanFractionFieldReads(arrowBody).length).toBeGreaterThan(0);
    expect(scanFractionFieldReads(bracketRead).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Isolation — patching a compat instance must not mutate native Unit converters
// ---------------------------------------------------------------------------
describe('compat Unit converter patch does not mutate native Unit', () => {
  const third = new Fraction(1n, 3n);
  const nativeShared = factory_mathjsCompat.constructors.Unit as {
    typeConverters: { BigNumber: (x: unknown) => unknown };
  };

  function converterThrows(convert: (x: unknown) => unknown): boolean {
    try {
      convert(third);
      return false;
    } catch {
      return true;
    }
  }

  it('leaves core Unit.typeConverters.BigNumber identity and throw-on-Fraction unchanged', () => {
    const before = CoreUnit.typeConverters.BigNumber;
    const threwBefore = converterThrows(before);
    createCompat(compatAll);
    expect(CoreUnit.typeConverters.BigNumber).toBe(before);
    expect(converterThrows(CoreUnit.typeConverters.BigNumber)).toBe(threwBefore);
  });

  it('leaves functions factory_mathjsCompat Unit converters unchanged', () => {
    const before = nativeShared.typeConverters.BigNumber;
    const convertersBefore = nativeShared.typeConverters;
    const threwBefore = converterThrows(before);
    createCompat(compatAll);
    expect(nativeShared.typeConverters).toBe(convertersBefore);
    expect(nativeShared.typeConverters.BigNumber).toBe(before);
    expect(converterThrows(nativeShared.typeConverters.BigNumber)).toBe(threwBefore);
  });

  it('compat instance converter still matches mathjs after isolation', () => {
    const run = (l: L) =>
      l.Unit.typeConverters.BigNumber(
        l.fraction(1, 3) as unknown as Parameters<typeof l.Unit.typeConverters.BigNumber>[0]
      );
    expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
  });
});
