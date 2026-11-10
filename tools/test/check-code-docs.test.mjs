import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, repoRoot, runGate } from './check-code-docs.mjs';

const SCRIPT_CONFIG = new URL('./code-docs-gate.json', import.meta.url);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const UNDOCUMENTED = 'export function undocumented(): number {\n  return 3;\n}\n';

/** Runs a gate script as a child process and returns its exit code. */
function runScript(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], { stdio: 'pipe', ...options }).status;
}

/** Makes a git repository in a directory, with a test identity. */
function gitIn(dir) {
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  return git;
}

/** Makes a throwaway git repository with one documented export in `pkg/src`. */
function makeRepo(prefix = 'code-docs-gate-') {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const git = gitIn(root);
  mkdirSync(join(root, 'pkg', 'src'), { recursive: true });
  writeFileSync(
    join(root, 'pkg', 'src', 'a.ts'),
    '/** Returns one. */\nexport function one(): number {\n  return 1;\n}\n'
  );
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  return { root, git };
}

/** Adds an undocumented export to a repository and commits it. */
function inject(root, git) {
  writeFileSync(join(root, 'pkg', 'src', 'c.ts'), UNDOCUMENTED);
  git('add', '.');
  git('commit', '-q', '-m', 'inject');
}

/** Copies the gate script and its config into `tools/` of a repository and commits them. */
function installGate(root, git) {
  mkdirSync(join(root, 'tools'), { recursive: true });
  const script = join(root, 'tools', 'check-code-docs.mjs');
  copyFileSync(join(SCRIPT_DIR, 'check-code-docs.mjs'), script);
  copyFileSync(fileURLToPath(SCRIPT_CONFIG), join(root, 'tools', 'code-docs-gate.json'));
  git('add', '.');
  git('commit', '-q', '-m', 'gate');
  return script;
}

test('a missing config fails loudly', () => {
  assert.throws(
    () => loadConfig(join(tmpdir(), 'no-such-code-docs-gate.json')),
    /code-docs gate config/
  );
});

test('a config without a command is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'code-docs-gate-cfg-'));
  try {
    const path = join(dir, 'gate.json');
    writeFileSync(path, JSON.stringify({ args: ['docs', 'check'] }));
    assert.throws(() => loadConfig(path), /command/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the gate passes on a clean tree and fails on an injected undocumented export', () => {
  const { root, git } = makeRepo();
  try {
    const config = loadConfig(SCRIPT_CONFIG);
    assert.equal(runGate({ root, config, stdio: 'pipe' }), 0);
    inject(root, git);
    assert.equal(runGate({ root, config, stdio: 'pipe' }), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the script checks its own repository when it starts outside any repository', () => {
  const { root, git } = makeRepo();
  const outside = mkdtempSync(join(tmpdir(), 'code-docs-gate-cwd-'));
  try {
    const script = installGate(root, git);
    assert.equal(runScript(script, [], { cwd: outside }), 0);
    inject(root, git);
    assert.equal(runScript(script, [], { cwd: outside }), 1);
  } finally {
    rmSync(outside, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('the script checks its own repository when it starts inside a nested repository', () => {
  const { root, git } = makeRepo();
  try {
    const script = installGate(root, git);
    const nested = join(root, 'pkg', 'nested');
    mkdirSync(join(nested, 'src'), { recursive: true });
    writeFileSync(join(nested, 'src', 'bad.ts'), UNDOCUMENTED);
    const nestedGit = gitIn(nested);
    nestedGit('add', '.');
    nestedGit('commit', '-q', '-m', 'nested');
    assert.equal(realpathSync(repoRoot(nested)), realpathSync(nested));
    assert.equal(runScript(script, [], { cwd: nested }), 0);
    inject(root, git);
    assert.equal(runScript(script, [], { cwd: nested }), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the script runs the check when it starts through a link to its folder', () => {
  const { root, git } = makeRepo();
  const links = mkdtempSync(join(tmpdir(), 'code-docs-gate-link-'));
  try {
    inject(root, git);
    const link = join(links, 'gate');
    symlinkSync(SCRIPT_DIR, link, 'junction');
    const script = join(link, 'check-code-docs.mjs');
    assert.equal(runScript(script, [`--root=${root}`]), 1);
  } finally {
    rmSync(join(links, 'gate'), { force: true });
    rmSync(links, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('the gate passes on a clean tree when the repository path has a space', () => {
  const { root, git } = makeRepo('code docs gate ');
  try {
    const script = installGate(root, git);
    assert.equal(runScript(script, []), 0);
    assert.equal(runScript(script, [`--root=${root}`]), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
