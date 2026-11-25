#!/usr/bin/env node
/**
 * Run the WHOLE MathTS test suite under vitest on real Node — concurrently.
 *
 * `bun run test` executes every package script on the Bun runtime (`[run] bun = true`), so it
 * never proves that the tests pass on the Node versions that consumers use. This script runs on
 * the Node that starts it and spawns every child with `process.execPath`, so each test process
 * is that same Node:
 *
 * 1. `vitest run` in every workspace package that has a `vitest.config.ts`. The package config
 *    supplies the vitest equivalent of its Bun-only setup (`define` for `__PKG_VERSION__`, and
 *    a separate snapshot path in `plot`). The `functions` package — by far the slowest
 *    (316-499 s alone) — is split across FUNCTION_SHARDS concurrent runs with vitest
 *    `--shard=k/N`, so every test file still runs exactly once.
 * 2. `vitest run` with the root `vitest.config.ts` (`tests/integration`, `tests/wasm`).
 * 3. The standalone Node test scripts of packages without a vitest config (`assembly`): every
 *    `node <file>` command in its `test` and `test:diff` scripts.
 *
 * The items run CONCURRENTLY, capped by RUN_VITEST_NODE_CONCURRENCY (default 4 — the vCPU
 * count of the GitHub `ubuntu-latest` runner; each capped child keeps vitest's own default
 * worker pool). Coverage job's OOM history (SIGABRT under Turbo at full concurrency) was with
 * coverage instrumentation across every package at once; plain vitest children at 4 are well
 * inside the 16 GB of the runner. Each child's output is captured to a temp file and printed
 * inside its `::group::` when the batch completes, in item order, so the log stays readable.
 *
 * The script refuses to run under Bun. It exits 1 when any step fails, and it prints one summary
 * line per step. Prerequisite: `bun run build:wasm && bun run build`.
 */
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

if (typeof globalThis.Bun !== 'undefined') {
  console.error('run-vitest-node: this script must run on Node, not Bun.');
  process.exit(1);
}

const vitestBin = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
const FUNCTION_SHARDS = 4;
const concurrency = Math.max(
  1,
  Number.parseInt(process.env.RUN_VITEST_NODE_CONCURRENCY ?? '', 10) || 4
);

/**
 * One unit of work: a command run with the current Node binary in a working directory.
 * @typedef {{ label: string, cwd: string, args: string[] }} Item
 */

/**
 * Collects every work item of the suite, in the deterministic order the summary prints.
 * @returns {Item[]}
 */
function collectItems() {
  /** @type {Item[]} */
  const items = [];
  for (const dir of workspaceDirs()) {
    const cwd = join(repoRoot, dir);
    if (existsSync(join(cwd, 'vitest.config.ts'))) {
      if (dir === 'functions') {
        for (let shard = 1; shard <= FUNCTION_SHARDS; shard++) {
          items.push({
            label: `vitest ${dir} (shard ${shard}/${FUNCTION_SHARDS})`,
            cwd,
            args: [vitestBin, 'run', `--shard=${shard}/${FUNCTION_SHARDS}`],
          });
        }
      } else {
        items.push({ label: `vitest ${dir}`, cwd, args: [vitestBin, 'run'] });
      }
      continue;
    }
    const scripts = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).scripts ?? {};
    const nodeFiles = [scripts.test, scripts['test:diff']]
      .filter(Boolean)
      .flatMap((script) => script.split('&&').map((part) => part.trim()))
      .filter((part) => /^node \S+$/.test(part))
      .map((part) => part.slice('node '.length));
    if (nodeFiles.length === 0) {
      items.push({ label: `${dir}: no vitest config and no node test scripts`, cwd, args: [] });
      continue;
    }
    for (const file of nodeFiles) items.push({ label: `node ${dir}/${file}`, cwd, args: [file] });
  }
  items.push({
    label: 'vitest root (tests/integration, tests/wasm)',
    cwd: repoRoot,
    args: [vitestBin, 'run'],
  });
  return items;
}

/**
 * Runs one item, capturing its output to a file.
 * @param {Item} item
 * @param {string} logPath where the child's stdout+stderr is captured
 * @returns {Promise<number | string>} exit code, or the spawn-error message
 */
async function runItem(item, logPath) {
  if (item.args.length === 0) return 'no test command'; // matches the old `status: 'none'` failure
  const out = openSync(logPath, 'w');
  try {
    const child = spawn(process.execPath, item.args, {
      cwd: item.cwd,
      stdio: ['ignore', out, out],
    });
    return await new Promise((resolve) => {
      child.on('error', (err) => resolve(`spawn error: ${err.message}`));
      child.on('close', (code) => resolve(code));
    });
  } finally {
    closeSync(out);
  }
}

console.log(
  `[runtime-probe] runner process.version=${process.version} typeof Bun=${typeof globalThis.Bun}`
);

const items = collectItems();
const tempDir = mkdtempSync(join(tmpdir(), 'run-vitest-node-'));
/** @type {{ label: string, ok: boolean, status: number | string }[]} */
const results = new Array(items.length);
let next = 0;

async function worker() {
  while (next < items.length) {
    const i = next++;
    const status = await runItem(items[i], join(tempDir, `item-${i}.log`));
    results[i] = { label: items[i].label, ok: status === 0, status };
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));

// Print every item's captured output inside its own group, in item order.
for (let i = 0; i < items.length; i++) {
  console.log(`\n::group::${items[i].label} (node ${process.version})`);
  process.stdout.write(readFileSync(join(tempDir, `item-${i}.log`), 'utf8'));
  console.log('::endgroup::');
}
rmSync(tempDir, { recursive: true, force: true });

console.log(`\nrun-vitest-node summary (node ${process.version}):`);
for (const r of results)
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.label}${r.ok ? '' : ` (exit ${r.status})`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`run-vitest-node: ${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
