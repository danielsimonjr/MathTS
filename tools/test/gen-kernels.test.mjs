// Tests for functions/scripts/gen-kernels.mjs: the --check mode and the static guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'functions/scripts/gen-kernels.mjs');
const GENERATED = join(ROOT, 'functions/src/geometry/kernels.generated.ts');

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

/** A copy of the script and its output in a temporary functions/ tree. */
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'gen-kernels-'));
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'src/geometry'), { recursive: true });
  cpSync(SCRIPT, join(dir, 'scripts/gen-kernels.mjs'));
  cpSync(GENERATED, join(dir, 'src/geometry/kernels.generated.ts'));
  return {
    dir,
    script: join(dir, 'scripts/gen-kernels.mjs'),
    generated: join(dir, 'src/geometry/kernels.generated.ts'),
  };
}

test('--check passes on the committed file', () => {
  const r = run(SCRIPT, ['--check']);
  assert.equal(r.status, 0, r.stderr);
});

test('--check fails on a hand-edited copy and the write mode restores it', () => {
  const box = sandbox();
  try {
    const original = readFileSync(box.generated);
    writeFileSync(box.generated, original.toString('utf8').replace('a0 + b0', 'b0 + a0'));
    const failed = run(box.script, ['--check']);
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /out of date/);
    assert.equal(run(box.script, []).status, 0);
    assert.deepEqual(readFileSync(box.generated), original);
    assert.equal(run(box.script, ['--check']).status, 0);
  } finally {
    rmSync(box.dir, { recursive: true, force: true });
  }
});

test('an unknown argument fails and writes nothing', () => {
  const box = sandbox();
  try {
    writeFileSync(box.generated, 'stale');
    const r = run(box.script, ['--chek']);
    assert.equal(r.status, 2);
    assert.equal(readFileSync(box.generated, 'utf8'), 'stale');
  } finally {
    rmSync(box.dir, { recursive: true, force: true });
  }
});

test('the static guard flags spread, map, arrow and destructuring', async () => {
  const { staticGuard, generate, KERNEL_NAMES } = await import(pathToFileURL(SCRIPT).href);
  assert.deepEqual(staticGuard(generate()), []);
  for (const token of ['...', '.map(', '=>', 'const [']) {
    assert.equal(staticGuard(`x ${token} y`).length, 1, token);
  }
  for (const name of KERNEL_NAMES) {
    assert.match(generate(), new RegExp(`export function ${name}\\(`));
  }
  assert.equal(KERNEL_NAMES.length, 24);
});
