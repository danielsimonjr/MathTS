#!/usr/bin/env node
/**
 * Skip budget: fail when a test suite skips more tests than its committed baseline.
 *
 * A skipped test passes silently. Nine WASM-tier suites once looked for their binary at a
 * deleted path and skipped themselves on every machine, CI included, for months: 57 tests
 * that never ran while every gate stayed green. This check turns that class of rot into a
 * failure. It reads the output of `bun run test` (each package's `bun test` or vitest
 * summary, then the root vitest run) and compares each suite's not-run count
 * (skipped + todo) with tools/test/skip-baseline.json.
 *
 * Turbo labels a task's output in one of two ways. In a terminal it prefixes every line
 * (`@scope/pkg:test: ...`). On GitHub Actions it prints no prefixes and wraps each task's
 * output in `::group::@scope/pkg:test` ... `::endgroup::` instead. Both are read. On
 * GitHub Actions `bun test` also opens a group per test file inside the task's group, so
 * groups are tracked as a stack; its summary follows the last file's `::endgroup::`.
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
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT_SUITE = '(root vitest)';

// eslint-disable-next-line no-control-regex -- strips ANSI colour escapes from captured output
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

/**
 * Each suite's test summary in a `bun run test` log: suite -> { summarized, notRun }.
 * A package suite is the package's `test` task; everything outside a turbo task is the
 * root vitest run.
 */
export function parseSuites(log) {
  const suites = new Map();
  const suite = (name) => {
    if (!suites.has(name)) suites.set(name, { summarized: false, notRun: 0 });
    return suites.get(name);
  };

  /**
   * Open `::group::`s, outermost first. A turbo task's group is `{ pkg, task }`; a group
   * a tool opened inside it (bun test: one per test file) is `null`.
   */
  let groups = [];
  for (const raw of stripAnsi(log).split(/\r?\n/)) {
    const open = raw.match(/^(?:::group::|##\[group\])(.*)$/);
    if (open) {
      const turboTask = open[1].match(/^(@[^:\s]+):(\S+)\s*$/);
      // Turbo never nests task groups, so a task's group starts a fresh stack.
      if (turboTask) groups = [{ pkg: turboTask[1], task: turboTask[2] }];
      else groups.push(null);
      continue;
    }
    if (/^(?:::endgroup::|##\[endgroup\])\s*$/.test(raw)) {
      groups.pop();
      continue;
    }

    const prefixed = raw.match(/^(@[^:\s]+):([^:\s]+): ?(.*)$/);
    const task = prefixed ? { pkg: prefixed[1], task: prefixed[2] } : (groups[0] ?? null);
    if (task && task.task !== 'test') continue; // a build's output holds no test summary
    const name = task ? task.pkg : ROOT_SUITE;
    const text = prefixed ? prefixed[3] : raw;

    // vitest: "Tests  4922 passed | 53 skipped (4975)", "Tests  3 failed | 10 passed (13)"
    const vitest = text.match(/^\s*Tests\s+(.*\(\d+\))\s*$/);
    if (vitest) {
      const s = suite(name);
      s.summarized = true;
      for (const [, n] of vitest[1].matchAll(/(\d+) (?:skipped|todo)/g)) s.notRun += Number(n);
      continue;
    }
    if (!task) continue; // `bun test` summaries only ever appear inside a package's task

    // bun test: "Ran 932 tests across 52 files.", " 4 skip", " 1 todo"
    if (/^\s*Ran \d+ tests? across \d+ files?\b/.test(text)) {
      suite(name).summarized = true;
      continue;
    }
    const bun = text.match(/^\s*(\d+) (skip|todo)\s*$/);
    if (bun) suite(name).notRun += Number(bun[1]);
  }
  return suites;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();

function main() {
  const baselinePath = join(dirname(fileURLToPath(import.meta.url)), 'skip-baseline.json');

  const args = process.argv.slice(2);
  const logPath = args.find((a) => !a.startsWith('--'));
  const update = args.includes('--update');
  if (!logPath) {
    console.error('usage: check-skip-budget.mjs <test-output.log> [--update]');
    process.exit(2);
  }

  const suites = parseSuites(readFileSync(logPath, 'utf8'));

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
}
