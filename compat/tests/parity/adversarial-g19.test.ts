import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { pair, show } from './oracle.js';
import { docsExamples, sweepDocs, outcome, DOC_CONFIGS } from './sweep.js';
import { ALL_GAPS } from './known-gaps/index.js';

/**
 * Adversarial probes for the G19 `zpk2tf` 2-D PR (#1589, head `cd3b24d4`).
 *
 * The PR's own claim is narrow: `zpk2tf(matrix([[1,2],[3,4]]), matrix([[5,6],[7,8]]))` must match
 * the mathjs 15.3.0 oracle, and 1-D results must not change. That part holds — the polynomial
 * product is bit-exact over a finite fuzz (557 cases, 0 mismatches; non-finite 1-D/2-D sweep,
 * 512 cases, 0 mismatches) and large orders (20/30/40) match bit for bit.
 *
 * These tests are the cases the PR does NOT cover. Every `it` below is a real failing test on
 * `cd3b24d4`; none is skipped. Each groups under the root cause it exposes.
 */

type L = ReturnType<typeof createCompat> & ReturnType<typeof create>;

const oracle = create(all, {}) as unknown as L;

function lib(): L {
  return createCompat(compatAll, {}) as unknown as L;
}

/** `typeOf` + precision-14 format, or the thrown error name and message prefix. */
function outcomeOf(run: (l: L) => unknown): { ok: boolean; text: string } {
  const l = lib();
  try {
    return { ok: true, text: show(l, run(l)) };
  } catch (e) {
    const err = e as Error;
    return { ok: false, text: `${err.name}: ${err.message.slice(0, 90)}` };
  }
}

function oracleOf(run: (l: L) => unknown): { ok: boolean; text: string } {
  try {
    return { ok: true, text: show(oracle, run(oracle)) };
  } catch (e) {
    const err = e as Error;
    return { ok: false, text: `${err.name}: ${err.message.slice(0, 90)}` };
  }
}

/**
 * F1 — `freqz` shares the PR's root cause and was missed.
 *
 * The PR documents the cause precisely: mathjs resolves Complex `x*y` and `x+y` through
 * complex.js `mul`/`add`, which treat a NaN part as infinite, while compat propagates plain IEEE
 * NaN. `freqz` (the `See also` of `zpk2tf`, and the same `dependencies` list) builds its response
 * from `multiply(b[j], Complex(cos, sin))` and `add(sum, …)` and then `divide(num, den)` — the
 * exact primitives the PR left unchanged. The PR fixed the semantics *inside* `zpk2tf` instead of
 * in `multiply`/`add`, so every other caller, `freqz` first, still diverges on a non-finite
 * coefficient: the oracle returns `Infinity + Infinityi` (or `0`) where compat returns `NaN + NaNi`.
 */
describe('F1: freqz keeps the complex.js semantics divergence the PR fixed only inside zpk2tf', () => {
  const CASES: [string, (l: L) => unknown][] = [
    // Oracle: h = [0] — the infinite denominator makes the quotient 0 (complex.js div: finite/Inf = 0).
    [
      'freqz([1], [Infinity], 1)',
      (l) => (l.freqz as (b: unknown, a: unknown, w: unknown) => unknown)([1], [Infinity], 1),
    ],
    // Oracle: h = [Infinity + Infinityi] — a NaN coefficient reads as infinite in the product.
    [
      'freqz([NaN], [1], 1)',
      (l) => (l.freqz as (b: unknown, a: unknown, w: unknown) => unknown)([NaN], [1], 1),
    ],
    [
      'freqz([Infinity], [1], 1)',
      (l) => (l.freqz as (b: unknown, a: unknown, w: unknown) => unknown)([Infinity], [1], 1),
    ],
    // A zero denominator: every bin is infinite in the oracle; compat mixes NaN into re.
    [
      'freqz([1, 2], [0, 0], 4)',
      (l) => (l.freqz as (b: unknown, a: unknown, w: unknown) => unknown)([1, 2], [0, 0], 4),
    ],
  ];

  for (const [label, run] of CASES) {
    it(`${label} matches the oracle`, () => {
      expect(outcomeOf(run), label).toEqual(oracleOf(run));
    });
  }
});

/**
 * F2 — the root-cause fix is a private copy, so the public Complex arithmetic still diverges.
 *
 * `functions/src/signal/zpk2tf.ts` now carries private `mulComplexJS`/`addComplexJS` helpers (and
 * drops `multiply`/`add` from its destructured parameters). The public `multiply`, `add`,
 * `subtract`, `divide` and `dotMultiply` of the compat instance are unchanged, so the same
 * non-finite operands give the mathjs result at one entry point and a different result at
 * another. That is a defect in the fix's placement, not only in `freqz`: any user expression that
 * multiplies a non-finite Complex still gets IEEE NaN where mathjs gives `Infinity + Infinityi`.
 */
describe('F2: the complex.js mul/add semantics were not moved to the shared primitive', () => {
  const CASES: [string, (l: L) => unknown][] = [
    [
      'multiply(complex(NaN, NaN), 2)',
      (l) =>
        (l.multiply as (a: unknown, b: unknown) => unknown)(
          (l.complex as (r: number, i: number) => unknown)(NaN, NaN),
          2
        ),
    ],
    [
      'multiply(complex(Infinity, Infinity), 2)',
      (l) =>
        (l.multiply as (a: unknown, b: unknown) => unknown)(
          (l.complex as (r: number, i: number) => unknown)(Infinity, Infinity),
          2
        ),
    ],
    [
      'add(complex(Infinity, Infinity), complex(Infinity, Infinity))',
      (l) =>
        (l.add as (a: unknown, b: unknown) => unknown)(
          (l.complex as (r: number, i: number) => unknown)(Infinity, Infinity),
          (l.complex as (r: number, i: number) => unknown)(Infinity, Infinity)
        ),
    ],
    [
      'subtract(complex(NaN, NaN), 1)',
      (l) =>
        (l.subtract as (a: unknown, b: unknown) => unknown)(
          (l.complex as (r: number, i: number) => unknown)(NaN, NaN),
          1
        ),
    ],
    [
      'dotMultiply(complex(NaN, NaN), complex(NaN, NaN))',
      (l) =>
        (l.dotMultiply as (a: unknown, b: unknown) => unknown)(
          (l.complex as (r: number, i: number) => unknown)(NaN, NaN),
          (l.complex as (r: number, i: number) => unknown)(NaN, NaN)
        ),
    ],
  ];

  for (const [label, run] of CASES) {
    it(`${label} matches the oracle`, () => {
      expect(outcomeOf(run), label).toEqual(oracleOf(run));
    });
  }
});

/**
 * F3 — `zpk2tf` accepts a BigNumber or Fraction gain that mathjs rejects.
 *
 * mathjs's `zpk2tf` has only `Array,Array,number` / `Array,Array` (and the Matrix pairs); a
 * BigNumber or Fraction third argument throws `TypeError: Unexpected type of argument … index: 2`.
 * The compat typed surface carries the broader conversion set (`number or string or boolean or
 * bigint or Fraction or BigNumber`), so `zpk2tf([1], [-1], bignumber(2))` silently converts and
 * returns `[[2, -2], [1, 1]]`. The PR's CHANGELOG says `zpk2tf` "Matched mathjs 15.3.0 polynomial
 * product behavior"; this signature-level divergence is reachable and untouched.
 */
describe('F3: zpk2tf gain type acceptance diverges from the oracle', () => {
  const CASES: [string, (l: L) => unknown][] = [
    [
      'zpk2tf([1], [-1], bignumber(2))',
      (l) =>
        (l.zpk2tf as (z: unknown, p: unknown, k: unknown) => unknown)(
          [1],
          [-1],
          (l.bignumber as (v: unknown) => unknown)(2)
        ),
    ],
    [
      'zpk2tf([1], [-1], fraction(1, 3))',
      (l) =>
        (l.zpk2tf as (z: unknown, p: unknown, k: unknown) => unknown)(
          [1],
          [-1],
          (l.fraction as (n: number, d: number) => unknown)(1, 3)
        ),
    ],
    [
      'zpk2tf([1, 2], [-1], bignumber(3))',
      (l) =>
        (l.zpk2tf as (z: unknown, p: unknown, k: unknown) => unknown)(
          [1, 2],
          [-1],
          (l.bignumber as (v: unknown) => unknown)(3)
        ),
    ],
  ];

  for (const [label, run] of CASES) {
    it(`${label} matches the oracle (which throws)`, () => {
      // Assert the oracle's outcome explicitly, so a future oracle bump that accepts these does not
      // leave this test passing for the wrong reason.
      expect(oracleOf(run).ok, `${label}: the 15.3.0 oracle must reject this gain`).toBe(false);
      expect(outcomeOf(run), label).toEqual(oracleOf(run));
    });
  }
});

/**
 * F4 — a listed `zpk2tf` doc label that meanwhile matches must fail the harness.
 *
 * `full-surface.test.ts` is supposed to fail on such a stale key ("a listed label that meanwhile
 * matches fails too, so the gap list cannot rot"), but a shared-instance sweep used to let
 * `config({number: "Fraction"})` leak into later `zpk2tf` examples. `sweepDocs` now uses a fresh
 * pair per example and skips stateful `config` docs.
 *
 * Two assertions: (a) a clean, single-config sweep of the zpk2tf examples matches the oracle;
 * (b) the shared oracle must not change behavior because a doc example reconfigured it.
 */
describe('F4: zpk2tf known-gaps entries are stale, and the sweep masks it via config()', () => {
  it('every recorded zpk2tf doc-example gap still diverges on a clean instance', async () => {
    const { perName } = await docsExamples();
    const examples = perName.get('zpk2tf') ?? [];
    expect(examples.length, 'the oracle carries zpk2tf doc examples').toBeGreaterThan(0);

    // Each config on its own fresh pair, in the documented label form `{config} expr`.
    const stillDiverging = new Set<string>();
    for (const config of DOC_CONFIGS) {
      const { mathjs, compat } = pair(config);
      for (const example of examples) {
        const o = outcome(mathjs as never, () => (mathjs as unknown as L).evaluate(example));
        const c = outcome(compat as never, () => (compat as unknown as L).evaluate(example));
        if (JSON.stringify(o) !== JSON.stringify(c))
          stillDiverging.add(`${JSON.stringify(config)} ${example}`);
      }
    }

    const recorded = [...ALL_GAPS].filter((l) => l.startsWith('{') && l.includes('zpk2tf('));
    const stale = recorded.filter((l) => !stillDiverging.has(l));
    expect(stale, 'known-gaps/ lists zpk2tf doc labels that now match the oracle').toEqual([]);
    expect(
      stillDiverging.size,
      'zpk2tf doc examples must not diverge on a clean instance after #1589'
    ).toBe(0);
  });

  it('the config() doc example reconfigures the shared oracle and so flips a zpk2tf doc example', async () => {
    const { perName } = await docsExamples();
    const expr = 'zpk2tf([1, 2], [-1, -2], 1)';
    const freshOutcome = () => {
      const { mathjs } = pair({});
      return outcome(mathjs as never, () => (mathjs as unknown as L).evaluate(expr));
    };
    const before = freshOutcome();
    // `sweepDocs` evaluates each doc example on a fresh pair (and skips stateful `config` docs).
    for (const example of perName.get('config') ?? []) {
      const { mathjs } = pair({});
      outcome(mathjs as never, () => (mathjs as unknown as L).evaluate(example));
    }
    const after = freshOutcome();
    expect(after, 'a doc example must not leak its reconfiguration into a later example').toEqual(
      before
    );
  });

  it('sweepDocs does not report a zpk2tf doc label that a clean per-config sweep does not', async () => {
    const { perName } = await docsExamples();
    // Only `config` + `zpk2tf`: the leakage this test pins, without a 900-example full-surface sweep.
    const subset = new Map(
      [...perName.entries()].filter(([name]) => name === 'zpk2tf' || name === 'config')
    );
    const { labels: shared } = sweepDocs(subset);
    const sharedZpk = [...shared].filter((l) => l.startsWith('{') && l.includes('zpk2tf('));
    // A clean per-config sweep, which is what the harness means to measure.
    const clean = new Set<string>();
    for (const config of DOC_CONFIGS) {
      const { mathjs, compat } = pair(config);
      for (const example of perName.get('zpk2tf') ?? []) {
        const o = outcome(mathjs as never, () => (mathjs as unknown as L).evaluate(example));
        const c = outcome(compat as never, () => (compat as unknown as L).evaluate(example));
        if (JSON.stringify(o) !== JSON.stringify(c))
          clean.add(`${JSON.stringify(config)} ${example}`);
      }
    }
    const phantom = sharedZpk.filter((l) => !clean.has(l));
    expect(
      phantom,
      'sweepDocs reports zpk2tf labels a clean sweep does not (config() leakage)'
    ).toEqual([]);
  }, 120_000);
});
