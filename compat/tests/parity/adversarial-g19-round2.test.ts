import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import * as mathFunctions from '@danielsimonjr/mathts-functions';

/**
 * Round-2 adversarial probes for the `afd6d7a1` follow-up on #1725 (G19 / #1589).
 *
 * That commit closed the round-1 challenger PR by delegating compat `zpk2tf` to a live mathjs
 * instance and wrapping compat `add`/`subtract`/`multiply`/`divide`/`dotMultiply` with complex.js
 * semantics, and it REVERTED the native `functions/src/signal/zpk2tf.ts` polynomial fix. The
 * compat numbers now match the oracle, but at three costs this file pins. Every `it` fails on
 * `afd6d7a1`; none is skipped.
 */

type Compat = ReturnType<typeof createCompat>;
type Fns = typeof mathFunctions;

const compat = () => createCompat(compatAll, {}) as unknown as Compat;

/** `a` is mathjs's own `Complex` class: the value a compat call now returns. */
function isForeignComplex(v: unknown): boolean {
  const c = v as { re?: unknown; im?: unknown; constructor?: { name?: string } };
  if (!c || typeof c !== 'object' || typeof c.re !== 'number') return false;
  const core = compat().complex(1, 2) as object; // a MathTS core Complex
  return Object.getPrototypeOf(v) !== Object.getPrototypeOf(core);
}

/**
 * R1 — P0: compat `zpk2tf` now returns mathjs `Complex` objects, which compat cannot consume.
 *
 * `bindOracleZpk2tf` calls `create(all, config).zpk2tf(...)` on every call and returns that
 * instance's result untouched. Its coefficient entries are mathjs's `Complex`, not the MathTS core
 * `Complex`, so every compat operation rejects them: `add`, `multiply`, and even `evaluate` with
 * the value in scope throw `unexpected type [object Object]`. The oracle itself multiplies them
 * (`multiply(o[0][1], 2)` is `-6`), so this is a compat-only break of the documented workflow
 * (design coefficients, then use them).
 */
describe('R1: compat zpk2tf returns a foreign Complex that compat cannot consume', () => {
  it('the returned coefficient is not the MathTS core Complex', () => {
    const r = compat().zpk2tf([1, 2], [-1, -2], 1) as unknown[][];
    expect(isForeignComplex(r[0][1]), 'zpk2tf coefficient must be a MathTS core Complex').toBe(false);
  });

  it('compat add/multiply accept the returned coefficient (the oracle does)', () => {
    const c = compat();
    const r = c.zpk2tf([1, 2], [-1, -2], 1) as unknown[][];
    const coeff = r[0][1];
    expect(() => c.multiply(coeff as never, 2), 'compat multiply must accept its own result').not.toThrow();
    expect(() => c.add(coeff as never, 1), 'compat add must accept its own result').not.toThrow();
  });

  it('the result survives an evaluate scope, as any other compat Complex does', () => {
    const c = compat();
    const r = c.zpk2tf([1, 2], [-1, -2], 1) as unknown[][];
    expect(() => c.evaluate('x + 1', { x: r[0][1] }), 'a compat value must be usable in a scope').not.toThrow();
  });

  it('a zpk2tf -> freqz pipeline accepts the coefficients directly', () => {
    const c = compat();
    const r = c.zpk2tf([1, 2], [-1, -2], 1) as unknown[][];
    // `zpk2tf`'s own See also is `freqz`; passing the numerator/denominator through is the point.
    expect(() => c.freqz(r[0] as never, r[1] as never, 4), 'freqz must accept zpk2tf output').not.toThrow();
  });
});

/**
 * R2 — P1: the native `functions` package lost the 2-D fix and is back to the #1589 bug.
 *
 * `afd6d7a1` deleted `mulComplexJS`/`addComplexJS` and restored `multiply(num[i], k)` in
 * `functions/src/signal/zpk2tf.ts`, so `@danielsimonjr/mathts-functions` (a published package)
 * again returns all-NaN rows for the issue's own repro. The G19 plan requires `functions` and
 * `compat` patch changesets and describes the fix as the polynomial product; the follow-up
 * changeset drops `functions` and says "native critical packages are unchanged", which is false:
 * they are reverted. The compat surface matches only because it delegates to mathjs.
 */
describe('R2: the native functions zpk2tf still has the #1589 bug', () => {
  it('native zpk2tf of the issue repro matches the oracle shape', () => {
    const r = (mathFunctions.zpk2tf as Fns['zpk2tf'])(
      mathFunctions.matrix([[1, 2], [3, 4]]) as never,
      mathFunctions.matrix([[5, 6], [7, 8]]) as never
    ) as unknown as { re: number; im: number }[][];
    // Oracle: [[1, Infinity + Infinityi, Infinity + Infinityi], [1, NaN + NaNi, Infinity + Infinityi]]
    const got = r.map((row) => row.map((c) => [c.re, c.im]));
    expect(got, 'native zpk2tf must match the oracle on the #1589 repro').toEqual([
      [
        [1, 0],
        [Infinity, Infinity],
        [Infinity, Infinity],
      ],
      [
        [1, 0],
        [NaN, NaN],
        [Infinity, Infinity],
      ],
    ]);
  });

  it('native zpk2tf keeps the 1-D result (the plan pins this)', () => {
    const r = (mathFunctions.zpk2tf as Fns['zpk2tf'])([1, 2], [-1, -2], 1) as unknown as {
      re: number;
      im: number;
    }[][];
    expect(r.map((row) => row.map((c) => c.re))).toEqual([
      [1, -3, 2],
      [1, 3, 2],
    ]);
  });

  it('native freqz and multiply still diverge from the oracle on a non-finite Complex', () => {
    // These are the F1/F2 root causes from round 1; the follow-up fixed them only in compat.
    const h = (mathFunctions.freqz as Fns['freqz'])([1], [Infinity], 1).h as unknown as {
      re: number;
      im: number;
    }[];
    expect([h[0].re, h[0].im], 'oracle freqz([1],[Infinity],1).h[0] is 0').toEqual([0, 0]);
    const m = (mathFunctions.multiply as Fns['multiply'])(
      mathFunctions.complex(NaN, NaN) as never,
      2
    ) as unknown as { re: number; im: number };
    expect([m.re, m.im], 'oracle multiply(complex(NaN,NaN),2) is Infinity + Infinityi').toEqual([
      Infinity,
      Infinity,
    ]);
  });
});

/**
 * R3 — P0: compat now imports mathjs at runtime, so its published dist bundles a devDependency
 * and gains a static `node:module` import.
 *
 * `compat/src/mathjs-oracle-zpk2tf.ts` imports `{ create, all } from 'mathjs'`, but `mathjs` is a
 * devDependency of `compat`, not a dependency. tsdown bundles it into `compat/dist/index.js`
 * (188 KB -> 1.34 MB) together with `createRequire` from `node:module`, which the repo's own
 * dist-browser-safety gate forbids. `tools/test/smoke-dist-node.mjs` fails on this commit and
 * passes on the parent. `esbuild --platform=browser` cannot resolve `node:module`.
 *
 * The test reads the built dist the same way the gate does, so it is deterministic and needs no
 * bundle tool.
 */
describe('R3: compat dist bundles mathjs and a static node: module import', () => {
  const DIST = new URL('../../dist/index.js', import.meta.url);

  async function distText(): Promise<string> {
    const { readFile } = await import('node:fs/promises');
    return readFile(DIST, 'utf8');
  }

  it('the built compat entry has no static Node builtin import', async () => {
    const source = await distText();
    expect(source, 'compat/dist/index.js must not import node:module (browser gate)').not.toMatch(
      /from\s*["']node:/
    );
  });

  it('the built compat entry does not bundle the mathjs devDependency', async () => {
    const source = await distText();
    expect(
      source.includes('mathjs/lib/'),
      'compat/dist/index.js must not bundle mathjs (a devDependency)'
    ).toBe(false);
  });
});
