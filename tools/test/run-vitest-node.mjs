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
 *    a separate snapshot path in `plot`). On Node 24+ `functions` runs first as one unsharded
 *    process with `--maxWorkers` equal to machine parallelism (CI Test 24.x: 234 s). On Node 22
 *    it is four `--shard=k/4` runs mixed with the other packages at the same concurrency (do
 *    not fill every slot with shards first: that serializes the rest of the suite). Every test
 *    file still runs exactly once.
 * 2. `vitest run` with the root `vitest.config.ts` (`tests/integration`, `tests/wasm`).
 * 3. The standalone Node test scripts of packages without a vitest config (`assembly`): every
 *    `node <file>` command in its `test` and `test:diff` scripts.
 *
 * After `functions`, remaining items run CONCURRENTLY, capped by RUN_VITEST_NODE_CONCURRENCY
 * (default 4 on CI). Those vitest children get `--maxWorkers` so
 * `concurrency × workers ≤ os.availableParallelism()`. Each child's output is captured to a
 * temp file and printed inside its `::group::` when the batch completes, in item order, with
 * stdout drain so CI pipes never truncate the summary.
 *
 * Prerequisite: `bun run build:wasm && bun run build`.
 */
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
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
const machineCpus = availableParallelism();
const vitestWorkersPerItem = Math.max(1, Math.floor(machineCpus / concurrency));
const nodeMajor = Number.parseInt(process.versions.node, 10);
const shardFunctions = nodeMajor < 24;

/**
 * Vitest worker flags so total worker slots stay within machine parallelism.
 * @returns {string[]}
 */
function vitestWorkerArgs() {
  return [`--maxWorkers=${vitestWorkersPerItem}`];
}

/**
 * Writes to stdout and waits for drain when the pipe buffer is full (CI captures stdout).
 * @param {string} text
 * @returns {Promise<void>}
 */
function writeStdout(text) {
  if (!text) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const ok = process.stdout.write(text, (err) => (err ? reject(err) : undefined));
    if (ok) resolve();
    else process.stdout.once('drain', resolve);
  });
}

/**
 * One unit of work: a command run with the current Node binary in a working directory.
 * @typedef {{ label: string, cwd: string, args: string[], isVitest: boolean }} Item
 */

/**
 * Collects every work item of the suite, in the deterministic order the summary prints.
 * @returns {Item[]}
 */
function collectItems() {
  const workerFlags = vitestWorkerArgs();
  /** @type {Item[]} */
  const items = [];
  for (const dir of workspaceDirs()) {
    const cwd = join(repoRoot, dir);
    if (existsSync(join(cwd, 'vitest.config.ts'))) {
      if (dir === 'functions' && shardFunctions) {
        for (let shard = 1; shard <= FUNCTION_SHARDS; shard++) {
          items.push({
            label: `vitest ${dir} (shard ${shard}/${FUNCTION_SHARDS})`,
            cwd,
            args: [vitestBin, 'run', `--shard=${shard}/${FUNCTION_SHARDS}`, ...workerFlags],
            isVitest: true,
          });
        }
      } else if (dir === 'functions') {
        items.push({
          label: `vitest ${dir}`,
          cwd,
          args: [vitestBin, 'run', `--maxWorkers=${machineCpus}`],
          isVitest: true,
        });
      } else {
        items.push({
          label: `vitest ${dir}`,
          cwd,
          args: [vitestBin, 'run', ...workerFlags],
          isVitest: true,
        });
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
      items.push({
        label: `${dir}: no vitest config and no node test scripts`,
        cwd,
        args: [],
        isVitest: false,
      });
      continue;
    }
    for (const file of nodeFiles) {
      items.push({
        label: `node ${dir}/${file}`,
        cwd,
        args: [file],
        isVitest: false,
      });
    }
  }
  items.push({
    label: 'vitest root (tests/integration, tests/wasm)',
    cwd: repoRoot,
    args: [vitestBin, 'run', ...workerFlags],
    isVitest: true,
  });
  return items;
}

/**
 * Runs one item, capturing its output to a file.
 * @param {Item} item
 * @param {string} logPath where the child's stdout+stderr is captured
 * @returns {Promise<{ status: number | string, durationMs: number }>}
 */
async function runItem(item, logPath) {
  if (item.args.length === 0) {
    return { status: 'no test command', durationMs: 0 };
  }
  const started = performance.now();
  const out = openSync(logPath, 'w');
  try {
    const child = spawn(process.execPath, item.args, {
      cwd: item.cwd,
      stdio: ['ignore', out, out],
    });
    const status = await new Promise((resolve) => {
      child.on('error', (err) => resolve(`spawn error: ${err.message}`));
      child.on('close', (code) => resolve(code));
    });
    return { status, durationMs: performance.now() - started };
  } finally {
    closeSync(out);
  }
}

/**
 * Human-readable duration for summary output.
 * @param {number} ms
 */
function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

console.log(
  `[runtime-probe] runner process.version=${process.version} typeof Bun=${typeof globalThis.Bun} ` +
    `cpus=${machineCpus} concurrency=${concurrency} vitestWorkersPerItem=${vitestWorkersPerItem} ` +
    `shardFunctions=${shardFunctions}`
);

const items = collectItems();
const tempDir = mkdtempSync(join(tmpdir(), 'run-vitest-node-'));
/** @type {{ label: string, ok: boolean, status: number | string, durationMs: number }[]} */
const results = new Array(items.length);
/**
 * Node 24+: `functions` first (one process, all CPUs), then the rest at concurrency.
 * Node 22: every item in one pool so shards overlap short packages (workflow wall is max(22,24)).
 */
const isFunctionsItem = (item) => item.label.startsWith('vitest functions');
const functionIdx = items.map((_, i) => i).filter((i) => isFunctionsItem(items[i]));
const restIdx = items.map((_, i) => i).filter((i) => !isFunctionsItem(items[i]));
const allIdx = items.map((_, i) => i);
const suiteStarted = performance.now();

async function runIndices(indices, phaseConcurrency) {
  let next = 0;
  async function worker() {
    while (next < indices.length) {
      const i = indices[next++];
      const { status, durationMs } = await runItem(items[i], join(tempDir, `item-${i}.log`));
      results[i] = { label: items[i].label, ok: status === 0, status, durationMs };
    }
  }
  const n = Math.min(phaseConcurrency, indices.length);
  if (n > 0) await Promise.all(Array.from({ length: n }, () => worker()));
}

if (shardFunctions) {
  await runIndices(allIdx, concurrency);
} else {
  await runIndices(functionIdx, 1);
  await runIndices(restIdx, concurrency);
}
const suiteMs = performance.now() - suiteStarted;

for (let i = 0; i < items.length; i++) {
  await writeStdout(`\n::group::${items[i].label} (node ${process.version})\n`);
  const body = readFileSync(join(tempDir, `item-${i}.log`), 'utf8');
  await writeStdout(body);
  if (!body.endsWith('\n')) await writeStdout('\n');
  await writeStdout('::endgroup::\n');
}
rmSync(tempDir, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok).length;

await writeStdout(
  `\nrun-vitest-node summary (node ${process.version}, wall ${formatDuration(suiteMs)}):\n`
);
const labelWidth = Math.max(...results.map((r) => r.label.length), 'label'.length);
await writeStdout(`${'status'.padEnd(6)} ${'time'.padStart(8)}  ${'item'.padEnd(labelWidth)}\n`);
await writeStdout(`${'-'.repeat(6)} ${'-'.repeat(8)}  ${'-'.repeat(labelWidth)}\n`);
for (const r of results) {
  const status = r.ok ? 'ok' : 'FAIL';
  const suffix = r.ok ? '' : ` (exit ${r.status})`;
  await writeStdout(
    `${status.padEnd(6)} ${formatDuration(r.durationMs).padStart(8)}  ${r.label}${suffix}\n`
  );
}
for (const r of results) {
  await writeStdout(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.label}${r.ok ? '' : ` (exit ${r.status})`}\n`);
}
await writeStdout(`run-vitest-node: ${results.length - failed} passed, ${failed} failed\n`);

process.exitCode = failed > 0 ? 1 : 0;
