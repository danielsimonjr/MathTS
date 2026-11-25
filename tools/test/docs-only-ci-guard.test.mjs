import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverMdConsumers, manifestVitestFiles, uncoveredMdConsumers } from '../ci/discover-md-consumers.mjs';

test('every test file that consumes Markdown at runtime is in docs-only-manifest.json', () => {
  const uncovered = uncoveredMdConsumers();
  if (uncovered.length) {
    const detail = discoverMdConsumers()
      .filter((c) => uncovered.includes(c.file))
      .map((c) => `  - ${c.file} (${c.reasons.join(', ')})`)
      .join('\n');
    assert.fail(
      `Add each file to tools/ci/docs-only-manifest.json (vitest list) or extend discovery exclusions with justification:\n${detail}`
    );
  }
  assert.ok(manifestVitestFiles().size >= 8);
});

test('docs-only manifest entries exist on disk', () => {
  for (const file of manifestVitestFiles()) {
    assert.ok(file.endsWith('.test.ts'), file);
  }
});