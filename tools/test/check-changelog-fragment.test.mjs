import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, isDocsOnly } from './check-changelog-fragment.mjs';

test('a changelog fragment passes; the fragments README alone is docs-only, not a fragment', () => {
  assert.equal(classify(['changelog-fragments/2026-11-25-my-fix.md']).ok, true);
  assert.equal(classify(['src/x.ts', 'changelog-fragments/2026-11-25-my-fix.md']).ok, true);
  assert.equal(classify(['changelog-fragments/README.md']).ok, true, 'docs-only');
  assert.equal(classify(['changelog-fragments/README.md', 'src/x.ts']).ok, false);
});

test('a direct CHANGELOG.md edit still passes (transitional path)', () => {
  const verdict = classify(['CHANGELOG.md', 'functions/src/typed/signal.ts']);
  assert.equal(verdict.ok, true);
  assert.match(verdict.reason, /transition/);
});

test('docs-only changes need no fragment', () => {
  assert.equal(isDocsOnly(['README.md']), true);
  assert.equal(isDocsOnly(['docs/api/functions.md', 'docs/reports/data.json']), true);
  assert.equal(isDocsOnly(['.changeset/compat-patch.md']), true);
  assert.equal(isDocsOnly(['.github/workflows/ci.yml']), true);
  assert.equal(isDocsOnly(['LICENSE']), true);
  assert.equal(isDocsOnly(['subdir/NOTES.md']), true);
  assert.equal(isDocsOnly([]), false, 'an empty diff is not docs-only');
});

test('code, test and tool changes require a fragment', () => {
  for (const file of [
    'functions/src/typed/signal.ts',
    'compat/tests/parity/oracle.ts',
    'tools/test/check-bundle-budget.mjs',
    'core/package.json',
    'matrix/vitest.config.ts',
    'bundle-budget.json',
  ]) {
    const verdict = classify([file]);
    assert.equal(verdict.ok, false, file);
    assert.match(verdict.reason, /changelog-fragments/);
  }
  assert.equal(classify(['README.md', 'functions/src/index.ts']).ok, false);
});

test('the failure message carries the full instruction', () => {
  const reason = classify(['core/src/index.ts']).reason;
  assert.match(reason, /changelog-fragments\/README\.md/);
  assert.match(reason, /direct CHANGELOG\.md edit/);
});
