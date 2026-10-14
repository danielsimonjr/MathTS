import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdown } from './create-dependency-graph.ts';

const stats = {
  totalTypeScriptFiles: 0,
  totalModules: 0,
  totalLinesOfCode: 0,
  totalExports: 0,
  totalClasses: 0,
  totalInterfaces: 0,
  totalFunctions: 0,
  totalTypeGuards: 0,
  totalEnums: 0,
  totalConstants: 0,
  totalReExports: 0,
  totalTypeOnlyImports: 0,
  runtimeCircularDeps: 0,
  typeOnlyCircularDeps: 0,
  unusedFilesCount: 0,
  unusedExportsCount: 0,
};

/** The document for an empty repo: only the fixed header, the section frames and the footer. */
function render() {
  return generateMarkdown([], {}, stats, { all: [], runtime: [], typeOnly: [] }, {});
}

test('the document still has its heading and frame', () => {
  // Control: without it, an empty string would satisfy every "does not contain" check below.
  const md = render();
  assert.match(md, /^# .+ - Dependency Graph\n/);
  assert.match(md, /comprehensive dependency graph/);
  assert.match(md, /\| Total Modules \| 0 \|/);
});

test('the document states no version', () => {
  // A version in a generated architecture document is state, and it goes stale at the next release.
  const md = render();
  assert.doesNotMatch(md, /\*\*Version\*\*/);
  assert.doesNotMatch(md, /\*Version\*/);
});

test('the document states no date', () => {
  // A regeneration on a new day would otherwise change the file with no change in the code.
  const md = render();
  assert.doesNotMatch(md, /Last Updated/);
  assert.doesNotMatch(md, /\b\d{4}-\d{2}-\d{2}\b/);
});
