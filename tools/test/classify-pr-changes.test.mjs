import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDocsOnlyChange, isDocsOnlyPath } from '../ci/classify-pr-changes.mjs';

test('markdown anywhere is documentation', () => {
  assert.equal(isDocsOnlyPath('README.md'), true);
  assert.equal(isDocsOnlyPath('CHANGELOG.md'), true);
  assert.equal(isDocsOnlyPath('.github/PULL_REQUEST_TEMPLATE.md'), true);
  assert.equal(isDocsOnlyPath('core/README.md'), true);
});

test('docs tree markdown is documentation, but non-markdown assets and changesets are not', () => {
  assert.equal(isDocsOnlyPath('docs/Architecture/OVERVIEW.md'), true);
  assert.equal(isDocsOnlyPath('docs/benchmarks/wasm-public-call.json'), false);
  assert.equal(isDocsOnlyPath('docs/diagram.png'), false);
  assert.equal(isDocsOnlyPath('docs/guide.mdx'), false);
  assert.equal(isDocsOnlyPath('.changeset/brave-lions.md'), false);
});

test('non-markdown license files are not documentation-only', () => {
  assert.equal(isDocsOnlyPath('LICENSE'), false);
  assert.equal(isDocsOnlyPath('packages/foo/LICENSE.txt'), false);
  assert.equal(isDocsOnlyPath('LICENSE.md'), true);
});

test('code and workflow paths are not documentation', () => {
  for (const path of [
    '',
    'core/src/index.ts',
    'functions/tests/foo.test.ts',
    'tools/test/ci-step.mjs',
    'tools/ci/classify-pr-changes.mjs',
    'tools/ci/README.md',
    '.github/workflows/ci.yml',
    '.github/workflows/README.md',
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
  assert.equal(isDocsOnlyChange(['docs/foo.md', '.changeset/patch.md']), false);
});

test('markdown-only diffs are docs-only', () => {
  assert.equal(isDocsOnlyChange(['README.md', 'CHANGELOG.md', 'docs/foo.md']), true);
});

test('empty diff is not docs-only', () => {
  assert.equal(isDocsOnlyChange([]), false);
});