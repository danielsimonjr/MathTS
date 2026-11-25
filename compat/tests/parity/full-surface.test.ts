import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';
import { create, all } from 'mathjs';
import { sweepPool, sweepDocs, docsExamples, DOC_CONFIGS } from './sweep.js';
import { INTENTIONAL } from './intentional.js';
import { FUNCTION_ISSUE } from './issue-map.js';

/**
 * The full-instance differential harness from #1574: every instance function over an
 * argument pool, and every embedded-docs example under the default, `number:'BigNumber'`
 * and `matrix:'Array'` configs, compared with the mathjs 15.3.0 oracle by `typeOf` plus
 * `format(value, { precision: 14 })`. The sweep compares thrown error NAMES, not message
 * wording: the wording of the generic argument errors differs from mathjs across the whole
 * surface (tracked separately), and a name-level comparison still catches every
 * wrong-result and wrong-type divergence. The issue-level differential tests compare the
 * message prefixes.
 *
 * A case that is neither a match nor listed in `known-gaps.json` fails the run, and a
 * listed label that meanwhile matches fails too, so the gap list cannot rot. Later groups
 * delete their keys in the same commit as the fix; G21 fails CI while any key remains
 * except the `1585` intentional-divergence entries (which live in `intentional.ts`).
 */

const GAPS: Record<string, string[]> = JSON.parse(
  readFileSync(new URL('./known-gaps.json', import.meta.url), 'utf8')
) as Record<string, string[]>;
const ALL_GAPS = new Set(Object.values(GAPS).flat());

describe('full-surface differential harness (#1574)', () => {
  it('the compat instance exposes every function the oracle docs describe', async () => {
    const { perName } = await docsExamples();
    const missing: string[] = [];
    const compat = createCompat(compatAll, {});
    const oracle = create(all, {});
    for (const name of perName.keys()) {
      // Constants carry docs too; only functions are bound as callables.
      if (typeof (oracle as unknown as Record<string, unknown>)[name] !== 'function') continue;
      if (typeof (compat as unknown as Record<string, unknown>)[name] !== 'function')
        missing.push(name);
    }
    expect(missing, 'names with docs but no compat instance function').toEqual([]);
  });

  it('every embedded-docs example matches the oracle or a recorded gap', async () => {
    const { perName, total } = await docsExamples();
    expect(total).toBeGreaterThan(900);
    const { labels } = sweepDocs(perName);
    const unrecorded = [...labels].filter((l) => !ALL_GAPS.has(l));
    expect(unrecorded, 'doc example divergences not recorded in known-gaps.json').toEqual([]);
    // pickRandom docs are stochastic: the same label can match or diverge across
    // runs. Keep the labels in known-gaps.json so a mismatch stays recorded; do
    // not treat an accidental match as a stale gap.
    const stale = [...ALL_GAPS].filter(
      (l) => l.startsWith('{') && !labels.has(l) && !l.includes('pickRandom')
    );
    expect(stale, 'known-gaps.json lists doc labels that now match the oracle').toEqual([]);
  });

  it('every instance function matches the oracle over the argument pool or a recorded gap', () => {
    const { labels } = sweepPool();
    const unrecorded = [...labels].filter((l) => !ALL_GAPS.has(l));
    expect(unrecorded, 'pool divergences not recorded in known-gaps.json').toEqual([]);
    const stale = [...ALL_GAPS].filter((l) => !l.startsWith('{') && !labels.has(l));
    expect(stale, 'known-gaps.json lists pool labels that now match the oracle').toEqual([]);
  });

  it('the recorded gaps are grouped under the issue that owns each root cause', () => {
    for (const [issue, labels] of Object.entries(GAPS)) {
      expect(Array.isArray(labels), `known-gaps[${issue}] is a list`).toBe(true);
      for (const label of labels) {
        if (label.startsWith('{') || label.startsWith('[')) continue;
        const name = label.slice(0, label.indexOf(':'));
        expect(FUNCTION_ISSUE[name] ?? 'unassigned', `${label} grouped under ${issue}`).toBe(issue);
      }
    }
  });

  it('every doc example runs on every config', async () => {
    const { total } = await docsExamples();
    expect(DOC_CONFIGS.length).toBe(3);
    expect(total).toBeGreaterThan(900);
  });

  it('the intentional divergences hold (#1585)', () => {
    for (const entry of INTENTIONAL['1585'] ?? []) entry.assert();
  });
});
