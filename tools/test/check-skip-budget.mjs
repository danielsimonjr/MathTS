#!/usr/bin/env node
/**
 * Skip budget: fail when a test suite skips more tests than its committed baseline.
 *
 * A skipped test passes silently. Nine WASM-tier suites once looked for their binary at a
 * deleted path and skipped themselves on every machine, CI included, for months: 57 tests
 * that never ran while every gate stayed green. This check turns that class of rot into a
 * failure. It reads the output of `bun run test` (turbo-prefixed `bun test` and vitest
 * summaries, then the root vitest run) and compares each suite's not-run count
 * (skipped + todo) with tools/test/skip-baseline.json.
 *
 * It fails when a suite
 *   - skips MORE than its baseline (something stopped running),
 *   - skips FEWER than its baseline (lower the baseline in the same change, so the
 *     ratchet stays tight and the freed budget cannot be spent silently later),
 *   - is in the baseline but printed no summary (silence is not success), or
 *   - printed a summary but is not in the baseline (register new suites).
 *
 * Usage:
 *   bun run test 2>&1 | tee test-output.log
 *   node tools/test/check-skip-budget.mjs test-output.log
 *   node tools/test/check-skip-budget.mjs test-output.log --update   # rewrite the baseline
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_SUITE = '(root vitest)';
const baselinePath = join(dirname(fileURLToPath(import.meta.url)), 'skip-baseline.json');

const args = process.argv.slice(2);
const logPath = args.find((a) => !a.startsWith('--'));
const update = args.includes('--update');
if (!logPath) {
  console.error('usage: check-skip-budget.mjs <test-output.log> [--update]');
  process.exit(2);
}

// eslint-disable-next-line no-control-regex -- strips ANSI colour escapes from captured output
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
const lines = stripAnsi(readFileSync(logPath, 'utf8')).split(/\r?\n/);

/** suite -> { summarized, notRun } */
const suites = new Map();
const suite = (name) => {
  if (!suites.has(name)) suites.set(name, { summarized: false, notRun: 0 });
  return suites.get(name);
};

for (const raw of lines) {
  const prefixed = raw.match(/^(@[^:\s]+):test: ?(.*)$/);
  const name = prefixed ? prefixed[1] : ROOT_SUITE;
  const text = prefixed ? prefixed[2] : raw;

  // vitest: "Tests  4922 passed | 53 skipped (4975)", "Tests  3 failed | 10 passed (13)"
  const vitest = text.match(/^\s*Tests\s+(.*\(\d+\))\s*$/);
  if (vitest) {
    const s = suite(name);
    s.summarized = true;
    for (const [, n] of vitest[1].matchAll(/(\d+) (?:skipped|todo)/g)) s.notRun += Number(n);
    continue;
  }
  if (!prefixed) continue; // `bun test` summaries only ever appear under a turbo prefix

  // bun test: "Ran 932 tests across 52 files.", " 4 skip", " 1 todo"
  if (/^\s*Ran \d+ tests? across \d+ files?\b/.test(text)) {
    suite(name).summarized = true;
    continue;
  }
  const bun = text.match(/^\s*(\d+) (skip|todo)\s*$/);
  if (bun) suite(name).notRun += Number(bun[1]);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const unsummarized = new Set(Object.keys(baseline.unsummarized ?? {}));
const observed = [...suites].filter(([name, s]) => s.summarized && !unsummarized.has(name));

if (update) {
  baseline.suites = Object.fromEntries(
    observed.map(([name, s]) => [name, s.notRun]).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`check-skip-budget: baseline rewritten for ${observed.length} suites`);
  process.exit(0);
}

const problems = [];
const expected = new Map(Object.entries(baseline.suites));
for (const [name, s] of observed) {
  if (!expected.has(name)) {
    problems.push(`${name}: ${s.notRun} not run, but the suite is not in skip-baseline.json`);
    continue;
  }
  const budget = expected.get(name);
  if (s.notRun > budget) {
    problems.push(`${name}: ${s.notRun} tests not run, budget ${budget}`);
  } else if (s.notRun < budget) {
    problems.push(
      `${name}: ${s.notRun} tests not run, budget ${budget}; lower its baseline to ${s.notRun}`
    );
  }
}
for (const name of expected.keys()) {
  if (!suites.get(name)?.summarized) problems.push(`${name}: printed no test summary`);
}

const notRun = observed.reduce((sum, [, s]) => sum + s.notRun, 0);
if (problems.length > 0) {
  for (const p of problems) console.error(`check-skip-budget: ${p}`);
  console.error(
    `check-skip-budget: FAIL (${problems.length} problem(s)). If a change in skips is ` +
      'intended, run with --update and commit tools/test/skip-baseline.json.'
  );
  process.exit(1);
}
console.log(
  `check-skip-budget: OK (${observed.length} suites, ${notRun} tests not run, all within budget)`
);
