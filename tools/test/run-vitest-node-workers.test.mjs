import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `tools/test/run-vitest-node.mjs` runs up to RUN_VITEST_NODE_CONCURRENCY items at once and
 * shards `functions` into 4 vitest processes. Every item it spawns is a `vitest run` that,
 * without an explicit worker cap, starts `availableParallelism()` worker processes of its own.
 *
 * On the 4-vCPU GitHub runner that is 4 concurrent items x 4 workers = 16 workers on 4 cores
 * (and 4 `functions` shards x 4 workers = 16 more for that package alone). Measured on this
 * 4-core box: `functions` unsharded takes 250 s; the four shards run concurrently take 229 s
 * — about 8% instead of the ~4x the sharding is there to buy. CI shows the same: one 178-file
 * shard took 356-403 s against 438 s for all 710 files unsharded.
 *
 * The invariant this pins: the runner must bound the TOTAL worker slots it creates, so that
 * `concurrency x per-item workers` stays within the machine's parallelism.
 *
 * The check runs the real script against a throwaway repo with a stub vitest that records the
 * argv it was given, so it never starts a real test run.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_RUNNER = join(HERE, 'run-vitest-node.mjs');
const REAL_WORKSPACES = join(HERE, 'workspaces.mjs');

/** Packages in the fixture: enough items that the concurrency cap is reached. */
const PACKAGES = ['p1', 'p2', 'p3', 'p4'];
const CONCURRENCY = 4;

/**
 * Builds a throwaway repo whose workspace packages each run the recording stub vitest.
 * @returns {{ root: string, argvLog: string, cleanup: () => void }}
 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'run-vitest-node-workers-'));
  mkdirSync(join(root, 'tools', 'test'), { recursive: true });
  copyFileSync(REAL_RUNNER, join(root, 'tools', 'test', 'run-vitest-node.mjs'));
  copyFileSync(REAL_WORKSPACES, join(root, 'tools', 'test', 'workspaces.mjs'));

  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', private: true, workspaces: PACKAGES }, null, 2)}\n`
  );
  for (const name of PACKAGES) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(
      join(root, name, 'package.json'),
      `${JSON.stringify({ name: `@fixture/${name}`, version: '1.0.0', scripts: { test: 'vitest run' } }, null, 2)}\n`
    );
    writeFileSync(join(root, name, 'vitest.config.ts'), 'export default {};\n');
  }

  // The stub appends its argv to a shared log, one JSON array per line.
  const argvLog = join(root, 'argv.log');
  writeFileSync(argvLog, '');
  mkdirSync(join(root, 'node_modules', 'vitest'), { recursive: true });
  const stub = join(root, 'node_modules', 'vitest', 'vitest.mjs');
  writeFileSync(
    stub,
    [
      "import { appendFileSync } from 'node:fs';",
      `appendFileSync(${JSON.stringify(argvLog)}, JSON.stringify(process.argv.slice(2)) + '\\n');`,
      '',
    ].join('\n')
  );
  chmodSync(stub, 0o755);

  return { root, argvLog, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** Runs the fixture's runner, discarding stdout. */
function runRunner(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'tools', 'test', 'run-vitest-node.mjs')], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: { ...process.env, RUN_VITEST_NODE_CONCURRENCY: String(CONCURRENCY) },
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
  });
}

/** Reads the worker cap from one argv of the stub (undefined when the runner passed none). */
function workerCapFrom(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--maxWorkers' || arg === '--max-workers') {
      const next = argv[i + 1];
      return next === undefined ? Number.NaN : Number(next);
    }
    const inline = /^--(?:maxWorkers|max-workers)=(\d+)$/.exec(arg);
    if (inline) return Number(inline[1]);
    // `--no-file-parallelism` runs one file at a time, i.e. a cap of 1.
    if (arg === '--no-file-parallelism') return 1;
  }
  return undefined;
}

test('the runner bounds total vitest workers to the machine parallelism', async () => {
  const { root, argvLog, cleanup } = makeFixture();
  try {
    await runRunner(root);
    const argvs = readFileSync(argvLog, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    // One item per package, plus the root suite the runner always appends — no duplicates,
    // no gaps. (The `functions` sharding is covered by the shard partition check: vitest's
    // `--shard=k/N` splits the collected specs by path hash, so the four runs partition every
    // test file exactly once.)
    assert.equal(argvs.length, PACKAGES.length + 1, 'every fixture package plus the root must run');

    const cpus = availableParallelism();
    for (const argv of argvs) {
      const cap = workerCapFrom(argv);
      assert.equal(
        typeof cap,
        'number',
        `every spawned vitest must carry an explicit worker cap; got argv ${JSON.stringify(argv)}`
      );
      assert.ok(
        Number.isFinite(cap) && cap >= 1,
        `bad worker cap ${cap} in ${JSON.stringify(argv)}`
      );
      const slots = CONCURRENCY * cap;
      assert.ok(
        slots <= cpus,
        `${CONCURRENCY} concurrent items x ${cap} workers = ${slots} worker slots on ${cpus} CPUs`
      );
    }
  } finally {
    cleanup();
  }
});
