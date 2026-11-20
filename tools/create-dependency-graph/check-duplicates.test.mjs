import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-duplicates.mjs');

// `bun run docs:deps` writes duplicate-symbols.json and no commit holds it, so a new checkout has
// none. The gate must say what to run instead of printing an ENOENT stack.
test('--no-regen without duplicate-symbols.json stops with the docs:deps instruction', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-dup-'));
  const arch = join(root, 'docs', 'Architecture');
  mkdirSync(arch, { recursive: true });
  const baseline = join(arch, 'duplicate-baseline.json');
  writeFileSync(baseline, '{}');
  try {
    const r = spawnSync(process.execPath, [SCRIPT, '--no-regen'], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.match(r.stderr, /duplicate-symbols\.json not found/);
    assert.match(r.stderr, /run `bun run docs:deps` first/);
    assert.doesNotMatch(r.stderr, /ENOENT/);
  } finally {
    unlinkSync(baseline);
    rmdirSync(arch);
    rmdirSync(join(root, 'docs'));
    rmdirSync(root);
  }
});
