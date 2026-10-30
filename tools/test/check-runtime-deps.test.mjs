import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffRuntimeDeps } from './check-runtime-deps.mjs';

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
