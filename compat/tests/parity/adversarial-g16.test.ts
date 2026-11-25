import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Adversarial probes for the G16 version-parity change (#1581, PR #1720).
 *
 * The change makes `version` report the emulated mathjs version (`"15.3.0"`) on the
 * instance, the named export, and the expression scope, and adds a `compatVersion` named
 * export. These cases probe the version-visible paths the change does *not* cover, against
 * the pinned 15.3.0 oracle. Each `it` below fails on the PR head; none is skipped.
 */

type L = ReturnType<typeof createCompat> & ReturnType<typeof create>;

const oracle = create(all) as unknown as L;

const compat = (): L => createCompat(compatAll) as unknown as L;

describe('G16 — the version is visible on every path mathjs exposes it', () => {
  // F1. `help('version')` is a version-visible path: mathjs renders the value in the doc
  // example (`version` → `"15.3.0"`). Compat's `Help` evaluates each doc example through the
  // module-level `evaluate` of `@danielsimonjr/mathts-functions`, whose scope has no
  // `version` binding, so the same example renders `Error: Undefined symbol "version"`.
  // The value now matches on the instance and `evaluate`, but the `help` rendering still
  // diverges, and no `known-gaps.json` label records it (the doc-example sweep evaluates the
  // example text directly, never through `Help.toString()`).
  it('help("version") renders the version value, as mathjs does', () => {
    expect(String(compat().help('version'))).toBe(String(oracle.help('version')));
  });

  // F1b. The same defect under every config the parity harness covers.
  for (const config of [{}, { number: 'BigNumber' }, { matrix: 'Array' }] as const) {
    it(`help("version") matches the oracle under ${JSON.stringify(config)}`, () => {
      const c = createCompat(compatAll, config) as unknown as L;
      const o = create(all, config) as unknown as L;
      expect(String(c.help('version'))).toBe(String(o.help('version')));
    });
  }

  // F2. A scope binding whose value is explicitly `undefined` hides the instance constant in
  // mathjs: it resolves to `undefined`. Compat reads the same binding as "not present" and
  // throws `Undefined symbol "version"`. The divergence is general to the expression layer
  // (`evaluate('pi', { pi: undefined })` throws as well), but `version` is one of the paths
  // G16 claims to make match, so the gap is recorded here.
  it('an explicit undefined scope binding resolves, as mathjs does', () => {
    const scope = { version: undefined };
    expect(compat().evaluate('version', scope)).toBe(oracle.evaluate('version', scope));
  });
});
