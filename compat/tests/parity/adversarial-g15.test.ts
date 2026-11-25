import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { create, all, type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Adversarial probes for the G15 fraction-format / string / ConstantNode.toString PR
 * (#1579, #1586) on top of `cursor/g15-fraction-format-c076`.
 *
 * Every oracle case below is a real divergence from the pinned mathjs 15.3.0 oracle that the PR's
 * own `compat/tests/parity/g15-fraction-format.test.ts` does not cover. Each `it` prints the
 * oracle and compat values and then asserts they are equal, so every one of them fails on the PR
 * head.
 *
 * Findings:
 *   F1  SparseMatrix.toString()/format() of a Fraction zero now prints `0/1` (oracle `0`): a
 *       regression, because the base printed `0` and matched the oracle. The sparse matrix stores
 *       the structural zero as a Fraction(0/1), and the new core `format` renders every Fraction
 *       as a ratio.
 *   F2  `string(fraction)` / `format(fraction, { fraction: 'decimal' })` / `.toString()` for a
 *       period longer than 1000 digits falls back to `n/d` where mathjs prints the full recurring
 *       period (mathjs caps at 2000 digits). The PR routes `string` through `toString`, so this
 *       shows up as a new wrong `string` value.
 *   F3  `string(fraction)` for a terminating expansion longer than 15 decimal places prints every
 *       digit where mathjs truncates to 15 (`0.000000953674316`). The PR claims `string` parity
 *       but only tests 1/3.
 *   F4a The changeset ships a BREAKING change to native `core` (and the shared `format`) as a
 *       `patch`, against the repo convention (a BREAKING change on a 0.x package is a `minor`).
 *   F4b The changeset omits `@danielsimonjr/mathts-expression`, whose published
 *       `ConstantNode.toString` behavior changes; the G15 plan names `expression`.
 *   F5  The PR's own `print(fraction(2))` case only compares `message.split(':')[0]`, so the
 *       real message divergence (`expected: string or boolean` vs `expected: string`) passes.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;

const oracle = (config: Record<string, unknown> = {}) => create(all, config) as unknown as Instance;
const compat = (config: Record<string, unknown> = {}) =>
  createCompat(compatAll, config) as unknown as Instance;

/** Run `fn` on both instances and return the two string outcomes (ok text or thrown error text). */
function both(fn: (l: Instance) => unknown, config: Record<string, unknown> = {}) {
  const run = (l: Instance): string => {
    try {
      const v = fn(l);
      return typeof v === 'string' ? v : String(v);
    } catch (e) {
      return 'ERR ' + (e as Error).name + ': ' + (e as Error).message;
    }
  };
  return { o: run(oracle(config)), c: run(compat(config)) };
}

describe('G15 adversarial: Fraction zero inside a SparseMatrix (regression)', () => {
  it('F1 SparseMatrix.toString() prints a structural Fraction zero as `0`, like mathjs', () => {
    const { o, c } = both((l) => String(l.sparse([[l.fraction(0)]] as never)));
    expect(c, `oracle=${JSON.stringify(o)} compat=${JSON.stringify(c)}`).toBe(o);
    expect(o).toBe('[[0]]');
  });

  it('F1 SparseMatrix.format() reports density 0 and no stored cells for a Fraction zero', () => {
    const { o, c } = both((l) => l.format(l.sparse([[l.fraction(0)]] as never)));
    expect(c, `oracle=${JSON.stringify(o)} compat=${JSON.stringify(c)}`).toBe(o);
    expect(o).toContain('density: 0');
  });

  it('F1 a mixed sparse row prints `[[2/1, 0]]`, not `[[2/1, 0/1]]`', () => {
    const { o, c } = both((l) => String(l.sparse([[l.fraction(2), l.fraction(0)]] as never)));
    expect(c, `oracle=${JSON.stringify(o)} compat=${JSON.stringify(c)}`).toBe(o);
  });
});

describe('G15 adversarial: string(Fraction) beyond the PR test set', () => {
  it('F2 string(fraction(1, 1019)) prints the recurring period, not `1/1019`', () => {
    // 1/1019 has period 1018; mathjs caps its period at 2000 digits, so it prints the full
    // `0.(...)` form. compat falls back to `n/d` at 1000 digits.
    const { o, c } = both((l) => l.string(l.fraction(1, 1019)));
    expect(c.length, `compat=${c}`).toBe(o.length);
    expect(c, `oracle starts ${o.slice(0, 20)}`).toBe(o);
  });

  it('F2 format(fraction(1, 1019), { fraction: "decimal" }) prints the recurring period', () => {
    const { o, c } = both((l) => l.format(l.fraction(1, 1019), { fraction: 'decimal' }));
    expect(c.length, `compat=${c}`).toBe(o.length);
  });

  it('F3 string(fraction(1, 2 ** 20)) truncates the terminating expansion at 15 decimals', () => {
    // mathjs fraction.js caps a non-repeating expansion at `dec = 15` digits.
    const { o, c } = both((l) => l.string(l.fraction(1, 2 ** 20)));
    expect(c, `oracle=${JSON.stringify(o)} compat=${JSON.stringify(c)}`).toBe(o);
    expect(o).toBe('0.000000953674316');
  });

  it('F3 string(fraction(1, 2 ** 40)) truncates the terminating expansion at 15 decimals', () => {
    const { o, c } = both((l) => l.string(l.fraction(1, 2 ** 40)));
    expect(c, `oracle=${JSON.stringify(o)} compat=${JSON.stringify(c)}`).toBe(o);
  });
});

describe('G15 adversarial: the PR test compares error messages too weakly', () => {
  it('F5 print(fraction(2)) throws the mathjs message (`string or boolean`)', () => {
    const { o, c } = both((l) => l.print(l.fraction(2)));
    // The PR's parity test compares `message.split(':')[0]`, which hides this divergence.
    expect(c, `oracle=${o} compat=${c}`).toBe(o);
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const changesetDir = join(repoRoot, '.changeset');

function g15Changeset(): string {
  const name = readdirSync(changesetDir).find(
    (f) => f.endsWith('.md') && f.includes('fraction-format')
  );
  expect(name, 'the G15 changeset exists').toBeTruthy();
  return readFileSync(join(changesetDir, name as string), 'utf8');
}

describe('G15 adversarial: changeset bump type and package coverage', () => {
  it('F4a a BREAKING core change is a minor changeset, not a patch', () => {
    const text = g15Changeset();
    expect(text).toContain('BREAKING');
    const coreLine = text
      .split('\n')
      .find((line) => line.startsWith("'@danielsimonjr/mathts-core':"));
    expect(coreLine, 'the changeset names core').toBeTruthy();
    // A breaking change on a 0.x package is a minor bump, per the repo convention
    // (docs/audit/2026-10-22-issues-final.md).
    expect(coreLine, `changeset line: ${JSON.stringify(coreLine)}`).toContain('minor');
  });

  it('F4b the changeset names @danielsimonjr/mathts-expression, whose ConstantNode.toString changes', () => {
    const text = g15Changeset();
    expect(text).toContain("'@danielsimonjr/mathts-expression'");
  });
});
