import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The Node vitest runner captures every item's output to a temp file and prints all of it
 * at the end (`::group::` per item), then prints a summary and one `run-vitest-node: N
 * passed, M failed` line, then sets the exit code.
 *
 * On CI that dump is megabytes (the four `functions` shards alone carry ~9,000 test lines),
 * and stdout is a pipe (GitHub Actions captures it). These tests pin the two properties that
 * make the log usable there:
 *
 *   1. the summary is present no matter how much output precedes it;
 *   2. a failing item's `FAIL ...` line and the child's own last lines are present, so a red
 *      job can be diagnosed.
 *
 * They run the REAL script against a throwaway repository (`repoRoot` is derived from the
 * script's own location), with a stub `node_modules/vitest/vitest.mjs` that emits a large
 * fixed body instead of running tests, so the whole check takes about a second.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_RUNNER = join(HERE, 'run-vitest-node.mjs');
const REAL_WORKSPACES = join(HERE, 'workspaces.mjs');

/** Bytes the stub vitest prints; two items of this size far exceed a pipe buffer. */
const STUB_BYTES = 1 << 20;

/**
 * Builds a throwaway repo whose only test package is a stub vitest.
 * @param {{ exitCode: number }} options
 * @returns {{ root: string, cleanup: () => void }}
 */
function makeFixture({ exitCode }) {
  const root = mkdtempSync(join(tmpdir(), 'run-vitest-node-fixture-'));

  mkdirSync(join(root, 'tools', 'test'), { recursive: true });
  copyFileSync(REAL_RUNNER, join(root, 'tools', 'test', 'run-vitest-node.mjs'));
  copyFileSync(REAL_WORKSPACES, join(root, 'tools', 'test', 'workspaces.mjs'));

  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', private: true, workspaces: ['pkg'] }, null, 2)}\n`
  );

  // A workspace package with a vitest config: the runner turns it into one `vitest pkg` item.
  mkdirSync(join(root, 'pkg'), { recursive: true });
  writeFileSync(
    join(root, 'pkg', 'package.json'),
    `${JSON.stringify({ name: '@fixture/pkg', version: '1.0.0', scripts: { test: 'vitest run' } }, null, 2)}\n`
  );
  writeFileSync(join(root, 'pkg', 'vitest.config.ts'), 'export default {};\n');

  // The stub replaces the real vitest binary the runner spawns. It prints a large body whose
  // LAST line is a marker, so a partially written dump is visible to the assertions.
  mkdirSync(join(root, 'node_modules', 'vitest'), { recursive: true });
  const stub = join(root, 'node_modules', 'vitest', 'vitest.mjs');
  writeFileSync(
    stub,
    [
      'const line = "x".repeat(1023) + "\\n";',
      `const total = ${STUB_BYTES};`,
      'for (let written = 0; written < total; written += line.length) process.stdout.write(line);',
      'console.log("STUB-VITEST-LAST-LINE");',
      `process.exit(${exitCode});`,
      '',
    ].join('\n')
  );
  chmodSync(stub, 0o755);

  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/**
 * Runs the fixture's runner with stdout captured through a PIPE, as CI does.
 * @param {string} root
 * @returns {Promise<{ code: number | null, out: string }>}
 */
function runThroughPipe(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'tools', 'test', 'run-vitest-node.mjs')], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, RUN_VITEST_NODE_CONCURRENCY: '2' },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out }));
  });
}

test('the summary survives megabytes of captured output on a pipe', async () => {
  const { root, cleanup } = makeFixture({ exitCode: 0 });
  try {
    const { code, out } = await runThroughPipe(root);
    assert.equal(code, 0, 'both stub items exit 0, so the runner must exit 0');
    // Two items x 1 MiB. The summary and the final line are printed AFTER the dump.
    assert.match(
      out,
      /run-vitest-node summary/,
      `the summary must be in the captured output (saw ${out.length} bytes)`
    );
    assert.match(out, /run-vitest-node: 2 passed, 0 failed/);
    assert.match(out, /STUB-VITEST-LAST-LINE/, 'the end of an item dump must not be truncated');
  } finally {
    cleanup();
  }
});

test('a failing item is visible, and the run fails, after a large dump on a pipe', async () => {
  const { root, cleanup } = makeFixture({ exitCode: 1 });
  try {
    const { code, out } = await runThroughPipe(root);
    assert.equal(code, 1, 'a failing item must fail the run');
    assert.match(
      out,
      /FAIL vitest pkg \(exit 1\)/,
      `the failing item must be named in the summary (saw ${out.length} bytes)`
    );
    assert.match(out, /run-vitest-node: 0 passed, 2 failed/);
    assert.match(out, /STUB-VITEST-LAST-LINE/, 'the child output of a failing item must survive');
  } finally {
    cleanup();
  }
});
