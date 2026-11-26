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
 * Workspace order lists short packages before `functions`. The runner must still *start*
 * `functions` first. Node 22 shards it 4 ways; Node 24+ runs one unsharded process with
 * `--maxWorkers` equal to machine CPUs.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_RUNNER = join(HERE, 'run-vitest-node.mjs');
const REAL_WORKSPACES = join(HERE, 'workspaces.mjs');
const nodeMajor = Number.parseInt(process.versions.node, 10);

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'run-vitest-node-schedule-'));
  mkdirSync(join(root, 'tools', 'test'), { recursive: true });
  copyFileSync(REAL_RUNNER, join(root, 'tools', 'test', 'run-vitest-node.mjs'));
  copyFileSync(REAL_WORKSPACES, join(root, 'tools', 'test', 'workspaces.mjs'));

  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', private: true, workspaces: ['core', 'functions'] }, null, 2)}\n`
  );
  for (const name of ['core', 'functions']) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(
      join(root, name, 'package.json'),
      `${JSON.stringify({ name: `@fixture/${name}`, version: '1.0.0', scripts: { test: 'vitest run' } }, null, 2)}\n`
    );
    writeFileSync(join(root, name, 'vitest.config.ts'), 'export default {};\n');
  }

  const argvLog = join(root, 'argv.log');
  writeFileSync(argvLog, '');
  mkdirSync(join(root, 'node_modules', 'vitest'), { recursive: true });
  writeFileSync(
    join(root, 'node_modules', 'vitest', 'vitest.mjs'),
    [
      "import { appendFileSync } from 'node:fs';",
      `appendFileSync(${JSON.stringify(argvLog)}, JSON.stringify(process.argv.slice(2)) + '\\n');`,
      '',
    ].join('\n')
  );
  chmodSync(join(root, 'node_modules', 'vitest', 'vitest.mjs'), 0o755);

  return { root, argvLog, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function runRunner(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'tools', 'test', 'run-vitest-node.mjs')], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: { ...process.env, RUN_VITEST_NODE_CONCURRENCY: '4' },
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
  });
}

function workerCapFrom(argv) {
  for (const arg of argv) {
    const inline = /^--(?:maxWorkers|max-workers)=(\d+)$/.exec(arg);
    if (inline) return Number(inline[1]);
  }
  return undefined;
}

test('functions starts first with the Node-major worker layout', async () => {
  const { root, argvLog, cleanup } = makeFixture();
  try {
    await runRunner(root);
    const argvs = readFileSync(argvLog, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    if (nodeMajor < 24) {
      assert.ok(argvs.length >= 5, `expected core + 4 shards + root, got ${argvs.length}`);
      const shardArgvs = argvs.filter((argv) => argv.some((a) => String(a).startsWith('--shard=')));
      assert.equal(shardArgvs.length, 4, 'Node 22 must spawn four functions shards');
      assert.ok(
        shardArgvs.every((argv) => workerCapFrom(argv) === 1),
        'Node 22 shards use the per-item worker cap'
      );
    } else {
      assert.equal(argvs.length, 3, 'functions + core + root');
      const first = argvs[0];
      assert.equal(
        first.some((a) => String(a).startsWith('--shard=')),
        false,
        `Node 24+ must not shard functions; got ${JSON.stringify(first)}`
      );
      assert.equal(workerCapFrom(first), availableParallelism());
    }
  } finally {
    cleanup();
  }
});
