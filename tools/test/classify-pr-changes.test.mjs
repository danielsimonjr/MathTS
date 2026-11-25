import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDocsOnlyChange, isDocsOnlyPath } from '../ci/classify-pr-changes.mjs';

test('markdown anywhere is documentation', () => {
  assert.equal(isDocsOnlyPath('README.md'), true);
  assert.equal(isDocsOnlyPath('CHANGELOG.md'), true);
  assert.equal(isDocsOnlyPath('.github/PULL_REQUEST_TEMPLATE.md'), true);
  assert.equal(isDocsOnlyPath('core/README.md'), true);
});

test('docs tree and changesets are documentation', () => {
  assert.equal(isDocsOnlyPath('docs/Architecture/OVERVIEW.md'), true);
  assert.equal(isDocsOnlyPath('docs/benchmarks/wasm-public-call.json'), true);
  assert.equal(isDocsOnlyPath('.changeset/brave-lions.md'), true);
});

test('license-like basenames are documentation', () => {
  assert.equal(isDocsOnlyPath('LICENSE'), true);
  assert.equal(isDocsOnlyPath('packages/foo/LICENSE.txt'), true);
});

test('code paths are not documentation', () => {
  for (const path of [
    'core/src/index.ts',
    'functions/tests/foo.test.ts',
    'tools/test/ci-step.mjs',
    '.github/workflows/ci.yml',
    'package.json',
    'bun.lock',
    'tsconfig.base.json',
    'assembly/src/index.ts',
    'tools/test/export-lock.json',
    'tools/test/bundle-budget.json',
    'vitest.config.ts',
  ]) {
    assert.equal(isDocsOnlyPath(path), false, path);
  }
});

test('mixed diffs are not docs-only', () => {
  assert.equal(isDocsOnlyChange(['README.md', 'core/src/a.ts']), false);
  assert.equal(isDocsOnlyChange(['docs/foo.md', 'package.json']), false);
});

test('markdown-only diffs are docs-only', () => {
  assert.equal(isDocsOnlyChange(['README.md', 'CHANGELOG.md', 'docs/foo.md']), true);
  assert.equal(isDocsOnlyChange(['.changeset/patch.md']), true);
});

test('empty diff is not docs-only', () => {
  assert.equal(isDocsOnlyChange([]), false);
});