import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { join } from 'node:path';
import { repoRoot, workspaceMathtsClosure } from './workspaces.mjs';

describe('workspaceMathtsClosure', () => {
  it('closes functions dependencies through the workspace graph', () => {
    const closure = workspaceMathtsClosure(['functions'], repoRoot);
    const mustHave = [
    'core',
    'expression',
    'functions',
    'gpu',
    'matrix',
    'packages/workerpool',
    'parallel',
  ];
    for (const dir of mustHave) {
      assert.ok(closure.includes(dir), `expected ${dir} in closure, got ${closure.join(', ')}`);
    }
    assert.ok(!closure.includes('linalg'), 'linalg is not reachable from functions');
  });
});
