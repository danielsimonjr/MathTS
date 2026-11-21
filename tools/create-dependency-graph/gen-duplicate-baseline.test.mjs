import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'gen-duplicate-baseline.mjs');

// `bun run docs:deps` writes duplicate-symbols.json and no commit holds it, so a new checkout has
// none. The generator must say what to run instead of printing an ENOENT stack.
test('without duplicate-symbols.json the generator stops with the docs:deps instruction', () => {
  const root = mkdtempSync(join(tmpdir(), 'gen-dup-'));
  mkdirSync(join(root, 'docs', 'Architecture'), { recursive: true });
  try {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.match(r.stderr, /duplicate-symbols\.json not found/);
    assert.match(r.stderr, /run `bun run docs:deps` first/);
    assert.doesNotMatch(r.stderr, /ENOENT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
