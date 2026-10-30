import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectRuntimeDepsLock, diffRuntimeDeps } from './check-runtime-deps.mjs';

function fixtureWorkspace(manifests) {
  const root = mkdtempSync(join(tmpdir(), 'runtime-deps-'));
  for (const [rel, pkg] of Object.entries(manifests)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), JSON.stringify(pkg));
  }
  return root;
}

test('diffRuntimeDeps reports added, removed, and retargeted specs', () => {
  const expected = {
    'pkg/package.json': {
      dependencies: { left: '1.0.0' },
      peerDependencies: {},
      optionalDependencies: {},
    },
  };
  const actual = {
    'pkg/package.json': {
      dependencies: { left: '2.0.0', right: '0.1.0' },
      peerDependencies: {},
      optionalDependencies: {},
    },
  };
  const problems = diffRuntimeDeps(actual, expected);
  assert.match(problems.join('\n'), /spec changed/);
  assert.match(problems.join('\n'), /right.*added/);
});

test('diffRuntimeDeps flags a manifest missing from the lock', () => {
  const problems = diffRuntimeDeps(
    { 'new/package.json': { dependencies: {}, peerDependencies: {}, optionalDependencies: {} } },
    {}
  );
  assert.match(problems.join('\n'), /unexpected manifest in tree/);
});

test('collectRuntimeDepsLock reads runtime fields only, from every workspace manifest', () => {
  const root = fixtureWorkspace({
    'package.json': { workspaces: ['a', 'packages/*'], dependencies: { zod: '^3.0.0' } },
    'a/package.json': {
      dependencies: { left: '1.0.0' },
      peerDependencies: { react: '>=18' },
      devDependencies: { vitest: '^5.0.0' },
    },
    'packages/b/package.json': { optionalDependencies: { fsevents: '2.3.0' } },
  });
  try {
    const lock = collectRuntimeDepsLock(root);
    assert.deepEqual(Object.keys(lock), [
      'package.json',
      'a/package.json',
      'packages/b/package.json',
    ]);
    assert.deepEqual(lock['package.json'].dependencies, { zod: '^3.0.0' });
    assert.deepEqual(lock['a/package.json'].peerDependencies, { react: '>=18' });
    assert.deepEqual(lock['packages/b/package.json'].optionalDependencies, { fsevents: '2.3.0' });
    assert.equal(JSON.stringify(lock).includes('vitest'), false, 'devDependencies stay unlocked');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a dependency added to a manifest after the lock was written is reported', () => {
  const manifests = {
    'package.json': { workspaces: ['a'] },
    'a/package.json': { dependencies: { left: '1.0.0' } },
  };
  const root = fixtureWorkspace(manifests);
  const lockedRoot = fixtureWorkspace(manifests);
  try {
    const expected = collectRuntimeDepsLock(lockedRoot);
    assert.deepEqual(diffRuntimeDeps(collectRuntimeDepsLock(root), expected), []);
    writeFileSync(
      join(root, 'a/package.json'),
      JSON.stringify({ dependencies: { left: '1.0.0', evil: '^1.0.0' } })
    );
    const problems = diffRuntimeDeps(collectRuntimeDepsLock(root), expected);
    assert.match(problems.join('\n'), /a\/package\.json dependencies\.evil added/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(lockedRoot, { recursive: true, force: true });
  }
});
