import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';
import { create, all } from 'mathjs';
import { sweepPool } from './sweep.js';

/**
 * Adversarial probes for G18 / #1585 (the "keep the more accurate values" decision).
 *
 * Every `it` below encodes a real finding: it fails on `cursor/g18-intentional-divergences-959e`
 * because the branch either (a) leaves a divergent input undocumented, (b) overstates an
 * accuracy/behaviour claim in `docs/api/compat.md` or `intentional.ts`, or (c) leaves the parity
 * harness structurally unable to see the divergence it is meant to record. None of these are
 * fixed here — this file is the challenger's evidence, not the builder's patch.
 *
 * Reference values are from mpmath (`mp.dps = 60`):
 *   zeta(-3)      = 0.0083333333333333333333...  (= 1/120 exactly)
 *   zeta(1+2i)    = 0.59816556976238173670 - 0.35185474521784529049i
 *   zeta(4)       = pi^4/90 = 1.08232323371113819151600369654116790277...
 *   zeta(0.5+2i)  = 0.4405456503408342... - 0.3116463384357446...i
 */

const L = createCompat(compatAll, {});
const O = create(all, {});
const B = createCompat(compatAll, { number: 'BigNumber' });
const OB = create(all, { number: 'BigNumber' });

const arr = (v: unknown): string =>
  JSON.stringify((v as { toArray(): unknown[] }).toArray().map(String));

describe('g18 adversarial: zeta claims vs high-precision references', () => {
  // F1: the docs say compat's zeta(-3) is "the exact value 1/120 to full double precision".
  // It is neither exact nor full double precision: it is 1.9e-14 relatively off (~87 ulps),
  // because the value is reconstructed through the reflection formula, not from 1/120.
  // Still far better than mathjs (rel.err ~1e-2), so the *decision* is fine; the *wording*
  // ("to full double precision") is false. `toBeCloseTo(1/120, 15)` in intentional.ts passes
  // only because it tolerates an absolute error of 5e-16, which is ~3x the real error bound.
  it('F1: zeta(-3) is NOT "the exact value 1/120 to full double precision"', () => {
    const v = L.zeta(-3) as number;
    const relErr = Math.abs(v - 1 / 120) / (1 / 120);
    // "full double precision" means the nearest double, i.e. rel.err <= 1 ulp ~ 2.2e-16.
    // Actual: 1.94e-14. This assertion is the doc's own claim, and it is false.
    expect(relErr).toBeLessThan(Number.EPSILON); // EXPECTED to fail: actual 1.94e-14
    const doc = readFileSync(new URL('../../../docs/api/compat.md', import.meta.url), 'utf8');
    // The sentence the assertion above is testing actually exists in the doc:
    expect(doc).toMatch(/exact value `1\/120` to full\s+double precision/);
  });

  // F2: the differential harness never calls zeta with ONE argument. `sweepPool` derives a
  // function's call width from `Math.max(oracleFn.length, 1)` and, when that is > 1, only ever
  // tries two-argument calls. The mathjs zeta declares length 2 (`number`, `BigNumber`,
  // `Complex` overloads), so the pool sweep probes `zeta(a, b)` (which throws "Too many
  // arguments") and never `zeta(a)`. That is why known-gaps.json has ZERO `zeta:` one-argument
  // labels even though zeta(-3), zeta(-2), zeta(-1), zeta(0.5), zeta(bignumber(4)), ... all
  // diverge. The "every instance function matches the oracle over the argument pool" test is
  // therefore blind to the entire unary zeta surface.
  it('F2: the pool sweep never probes unary zeta, so its divergences are unrecorded', () => {
    expect(O.zeta.length).toBe(2); // oracle declares 2 -> sweep only does 2-arg calls
    // zeta(-3) is a pool value and does diverge:
    expect((L.zeta(-3) as number).toPrecision(14)).not.toBe((O.zeta(-3) as number).toPrecision(14));
    // ...yet no `zeta: (number -3)` label is produced, because zeta is never called with 1 arg:
    const { labels } = sweepPool();
    expect([...labels].filter((l) => l.startsWith('zeta: ('))).toEqual([]); // observed: []
    // A unary label that WOULD exist if the harness probed one argument:
    expect(labels.has('zeta: (number -3)')).toBe(true); // EXPECTED to fail
  });

  // F3: symbolicEqual is undocumented as divergent in the DEFAULT (number) config. #1585 only
  // documents the BigNumber `x*y`/`y*x` case, but compat's exact-polynomial-identity test makes
  // many more pairs "true" than mathjs in number mode (and it is not recorded in known-gaps.json).
  it('F3: symbolicEqual diverges silently for polynomial identities (default number config)', () => {
    const pairs: [string, string][] = [
      ['(x+y)^2', 'x^2+2*x*y+y^2'],
      ['x^2-y^2', '(x-y)*(x+y)'],
    ];
    for (const [a, b] of pairs) {
      const expr = `symbolicEqual("${a}", "${b}")`;
      expect(L.evaluate(expr)).toBe(O.evaluate(expr)); // EXPECTED to fail: true vs false
    }
  });

  // F4: zeta(Fraction) returns a Complex (im = 0) where mathjs throws a TypeError. A real-valued
  // Fraction silently becomes a Complex, and the divergence is neither documented nor recorded.
  it('F4: zeta(Fraction) returns Complex where mathjs throws', () => {
    expect(() => O.zeta(O.fraction(4, 1) as never)).toThrow(); // oracle: TypeError
    const v = L.zeta(L.fraction(4, 1) as never) as unknown as { re: number; im: number };
    expect(L.typeOf(v)).toBe('Complex'); // silent type confusion for a real input
    expect(() => L.zeta(L.fraction(4, 1) as never)).toThrow(); // EXPECTED to fail (compat returns a value)
  });

  // F5: zeta(bigint) returns a BigNumber where mathjs returns a number. Undocumented.
  it('F5: zeta(bigint) type diverges (compat BigNumber, mathjs number)', () => {
    expect(L.typeOf(L.zeta(2n as never))).toBe(O.typeOf(O.zeta(2n as never))); // EXPECTED to fail: BigNumber vs number
  });

  // F6: zeta(NaN) and the trivial zeros are silent divergences: zeta(NaN) is NaN in compat but 1
  // in mathjs; zeta(-2) is exactly 0 in compat but ~2.7e-11 in mathjs. Both are "more accurate"
  // (NaN and 0 are the mathematically correct values) but neither appears in intentional.ts or
  // known-gaps.json — the docs claim exhaustive coverage of the "more accurate" zeta cases.
  it('F6: zeta(NaN) and zeta(-2) diverge silently', () => {
    expect(Object.is(L.zeta(NaN), O.zeta(NaN))).toBe(true); // EXPECTED to fail: NaN vs 1
    expect(L.zeta(-2)).toBe(O.zeta(-2)); // EXPECTED to fail: 0 vs ~2.7e-11
  });

  // F9: the doc claims mathjs "returns NaN + NaNi for complex arguments in the critical strip".
  // That is false: mathjs only returns NaN on the line Re(s) == 1. The critical strip
  // (0 < Re < 1) is finite in mathjs — zeta(0.5+2i) = 0.4405... - 0.3116...i. The compat source
  // itself says so (functions/src/special/zeta.ts: "the simple pole is only at the POINT s = 1,
  // not the whole line Re = 1"). A doc that says "critical strip" describes the wrong set.
  it('F9: mathjs is finite on the critical strip; only Re(s)==1 is NaN', () => {
    const strip = O.zeta(O.complex(0.5, 2)) as { re: number; im: number };
    // The doc's claim, asserted against mathjs: "NaN + NaNi for complex arguments in the strip".
    expect(Number.isNaN(strip.re)).toBe(true); // EXPECTED to fail: 0.4405... is finite
    const doc = readFileSync(new URL('../../../docs/api/compat.md', import.meta.url), 'utf8');
    expect(doc).toMatch(/NaN \+ NaNi`? for complex arguments in the critical strip/);
  });
});

describe('g18 adversarial: BigNumber zeta(4) precision and range semantics', () => {
  // F8: intentional.ts does not verify that compat's BigNumber zeta(4) is CLOSER to pi^4/90; it
  // only asserts `expect(v.toString()).not.toBe(theirs.toString())`. Any difference passes,
  // including a value that is worse than mathjs or outright wrong. The "more accurate" claim is
  // asserted nowhere in the registered decision.
  it('F8: the intentional zeta(bignumber(4)) assertion is inequality-only (no accuracy check)', () => {
    const src = readFileSync(new URL('./intentional.ts', import.meta.url), 'utf8');
    // The entry that owns the zeta(bignumber(4)) claim exists:
    expect(src).toMatch(/zeta\(L\.bignumber\(4\)\)/);
    // It must check a reference value (pi^4/90 = 1.0823232337111...) within a tolerance, not
    // merely `expect(v).not.toBe(theirs)`. It does not: the entry's only assertion is `!==`.
    // So a source change that made compat's BigNumber zeta(4) *worse* than mathjs would still
    // pass the registered "more accurate" decision. This assertion is the missing check.
    expect(src).toMatch(/zeta\(L\.bignumber\(4\)\)[\s\S]{0,400}1\.08232/); // EXPECTED to fail
  });

  // F10: the range claim "range('4:10') includes 10, like number mode" is true only through the
  // expression parser, where mathjs's range *transform* appends includeEnd=true. It is false for
  // the function itself: `B.range('4:10')` returns [4..9] in compat AND mathjs. Worse, compat and
  // mathjs disagree on the EXPLICIT includeEnd path (`range('4:10', true)`), which #1585 does not
  // document: compat returns [4..10], mathjs BigNumber returns [4..9].
  it('F10: the range function itself excludes the end; only evaluate() includes it', () => {
    // (a) The doc says "Compat returns a matrix that includes the end value ... matching mathjs's
    // own number mode" for `range("4:10")`. That is true only through `evaluate()`: the expression
    // parser uses mathjs's `range` *transform*, which appends includeEnd=true. The FUNCTION
    // `range('4:10')` excludes the end in compat, exactly as in mathjs.
    expect(arr(B.range('4:10'))).toBe(arr(OB.range('4:10'))); // passes: both exclude 10
    expect(arr(B.range('4:10'))).toBe(JSON.stringify(['4', '5', '6', '7', '8', '9', '10'])); // EXPECTED to fail
  });

  it('F10b: explicit includeEnd=true diverges in BigNumber mode, undocumented', () => {
    // #1585 documents only the implicit (evaluate) path. On the explicit path the two libraries
    // disagree: compat honours includeEnd=true, mathjs 15.3.0 BigNumber ignores it.
    expect(arr(B.range('4:10', true))).toBe(arr(OB.range('4:10', true))); // EXPECTED to fail: [4..10] vs [4..9]
  });
});

describe('g18 adversarial: decision bookkeeping', () => {
  // F7: known-gaps.json still lists the exact cases G18 calls "intentional" — they were not moved
  // out of it (plan Step 3: "Register the cases in intentional.ts and remove them from
  // known-gaps.json"). They sit under the `unassigned` key, so the builder test's
  // `expect(Object.keys(gaps)).not.toContain('1585')` is vacuous: no key named `1585` ever
  // existed, and the labels remain. The sweepDocs harness requires these labels to stay in
  // known-gaps (intentional.ts is not consulted by sweepDocs), so the plan step is in direct
  // tension with full-surface.test.ts — the double registration is unavoidable as written.
  it('F7: known-gaps.json still holds the #1585 cases the builder claims it dropped', () => {
    const gaps = JSON.parse(
      readFileSync(new URL('./known-gaps.json', import.meta.url), 'utf8')
    ) as Record<string, string[]>;
    const flat = new Set(Object.values(gaps).flat());
    const stillListed = [
      '{} zeta(4)',
      '{"number":"BigNumber"} zeta(4)',
      '{"matrix":"Array"} zeta(4)',
      '{} zeta(0.2)',
      '{"number":"BigNumber"} symbolicEqual("x*y","y*x")',
    ];
    for (const label of stillListed) {
      // The builder's test only checks `Object.keys(gaps)`, i.e. the issue KEY, never the labels:
      expect(Object.keys(gaps)).not.toContain('1585'); // vacuous: no such key exists
      // …while the label that #1585 "owns" is still present:
      expect(flat.has(label)).toBe(false); // EXPECTED to fail: label is still there
    }
  });
});
