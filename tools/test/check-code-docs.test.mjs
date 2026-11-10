import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, listPaths, runGate } from './check-code-docs.mjs';

const SCRIPT_CONFIG = new URL('./code-docs-gate.json', import.meta.url);

/** Makes a throwaway git repository with one documented export in `pkg/src` and one undocumented export outside it. */
function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'code-docs-gate-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  mkdirSync(join(root, 'pkg', 'src'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(
    join(root, 'pkg', 'src', 'a.ts'),
    '/** Returns one. */\nexport function one(): number {\n  return 1;\n}\n'
  );
  writeFileSync(
    join(root, 'scripts', 'b.ts'),
    'export function notInScope(): number {\n  return 2;\n}\n'
  );
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  return { root, git };
}

/** The repository config with the include patterns replaced, so the test runs the same command. */
function fixtureConfig(root) {
  const config = { ...loadConfig(SCRIPT_CONFIG), include: [':(glob)*/src/**'] };
  const path = join(root, 'gate.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}

test('a missing config fails loudly', () => {
  assert.throws(
    () => loadConfig(join(tmpdir(), 'no-such-code-docs-gate.json')),
    /code-docs gate config/
  );
});

test('a config without include patterns is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'code-docs-gate-cfg-'));
  try {
    const path = join(dir, 'gate.json');
    writeFileSync(path, JSON.stringify({ command: ['repo-tools'], args: [] }));
    assert.throws(() => loadConfig(path), /include/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the path list holds tracked files that match the include patterns only', () => {
  const { root } = makeRepo();
  try {
    assert.deepEqual(listPaths(root, [':(glob)*/src/**']), ['pkg/src/a.ts']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the gate passes on a clean tree and fails on an injected undocumented export', () => {
  const { root, git } = makeRepo();
  try {
    const config = loadConfig(fixtureConfig(root));
    assert.equal(runGate({ root, config, stdio: 'pipe' }), 0);

    writeFileSync(
      join(root, 'pkg', 'src', 'c.ts'),
      'export function undocumented(): number {\n  return 3;\n}\n'
    );
    git('add', 'pkg/src/c.ts');
    git('commit', '-q', '-m', 'inject');
    assert.notEqual(runGate({ root, config, stdio: 'pipe' }), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
