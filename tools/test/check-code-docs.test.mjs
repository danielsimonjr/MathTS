import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, listPaths, repoRoot, runGate } from './check-code-docs.mjs';

const SCRIPT_CONFIG = new URL('./code-docs-gate.json', import.meta.url);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const UNDOCUMENTED = 'export function undocumented(): number {\n  return 3;\n}\n';

/** Runs the gate script as a child process and returns its exit code. */
function runScript(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], { stdio: 'pipe', ...options }).status;
}

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

    writeFileSync(join(root, 'pkg', 'src', 'c.ts'), UNDOCUMENTED);
    git('add', 'pkg/src/c.ts');
    git('commit', '-q', '-m', 'inject');
    assert.equal(runGate({ root, config, stdio: 'pipe' }), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the repository include patterns leave declaration files out', () => {
  const { root, git } = makeRepo();
  try {
    writeFileSync(join(root, 'pkg', 'src', 'types.d.ts'), 'export function declared(): number;\n');
    git('add', '.');
    git('commit', '-q', '-m', 'declaration');
    assert.deepEqual(listPaths(root, loadConfig(SCRIPT_CONFIG).include), ['pkg/src/a.ts']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the script checks the whole repository when it starts in a subfolder', () => {
  const { root, git } = makeRepo();
  try {
    const configPath = fixtureConfig(root);
    mkdirSync(join(root, 'pkg', 'nested', 'src'), { recursive: true });
    writeFileSync(
      join(root, 'pkg', 'nested', 'src', 'ok.ts'),
      '/** Is one. */\nexport const ok = 1;\n'
    );
    writeFileSync(join(root, 'pkg', 'src', 'c.ts'), UNDOCUMENTED);
    git('add', '.');
    git('commit', '-q', '-m', 'inject');
    const cwd = join(root, 'pkg');
    assert.equal(realpathSync(repoRoot(cwd)), realpathSync(root));
    const script = join(SCRIPT_DIR, 'check-code-docs.mjs');
    assert.equal(runScript(script, [`--config=${configPath}`], { cwd }), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the script runs the check when it starts through a link to its folder', () => {
  const { root, git } = makeRepo();
  const links = mkdtempSync(join(tmpdir(), 'code-docs-gate-link-'));
  try {
    const configPath = fixtureConfig(root);
    writeFileSync(join(root, 'pkg', 'src', 'c.ts'), UNDOCUMENTED);
    git('add', '.');
    git('commit', '-q', '-m', 'inject');
    const link = join(links, 'gate');
    symlinkSync(SCRIPT_DIR, link, 'junction');
    const script = join(link, 'check-code-docs.mjs');
    assert.equal(runScript(script, [`--config=${configPath}`, `--root=${root}`]), 1);
  } finally {
    rmSync(join(links, 'gate'), { force: true });
    rmSync(links, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('the gate passes on a clean tree when the temporary folder has a space in its path', () => {
  const { root } = makeRepo();
  const spaced = mkdtempSync(join(tmpdir(), 'code docs gate '));
  try {
    const configPath = fixtureConfig(root);
    const script = join(SCRIPT_DIR, 'check-code-docs.mjs');
    const env = { ...process.env, TEMP: spaced, TMP: spaced, TMPDIR: spaced };
    assert.equal(runScript(script, [`--config=${configPath}`, `--root=${root}`], { env }), 0);
  } finally {
    rmSync(spaced, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});
