/**
 * Challenger round 3 for PR #1753, after commit cc311160 ("fix(docs): emit one
 * name per line in generated export indexes").
 *
 * cc311160 changes the generated reference's group lines from
 *
 *   **Arithmetic** (43): `abs`, `add`, ...
 *
 * to
 *
 *   **Arithmetic** (43):
 *   `abs`
 *   `add`
 *
 * It updates `parseReferenceIndex` to read the new form, but the two OTHER
 * readers of the same block were not touched:
 *
 *  - `tools/test/site-generators.test.mjs#countsFromReference` keeps the old
 *    `^\*\*(.+?)\*\* \(\d+\): ` (space + names on the same line) pattern, so it
 *    counts 0 groups while the generated file has 27, and the landing-page test
 *    fails with `'27' !== '0'`.
 *  - `docs/reference/functions.md` is what the landing page reads, so the
 *    shipped "Categories" stat is affected too until the reader is fixed.
 *
 * This regressed a previously-green required check: the same file passes at
 * 8baa9ddc and fails at cc311160 (verified locally). The test below pins the
 * generated format and the readers' agreement on it, without depending on a
 * build of the packages.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReferenceIndex, UNCATEGORIZED } from '../reference-index.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REFERENCE = join(repoRoot, 'docs', 'reference', 'functions.md');

/**
 * The independent counter used by site-generators.test.mjs's landing-page check,
 * copied verbatim from `countsFromReference` there. Kept local so this test
 * fails on its own terms even if that file is edited.
 */
function countsFromReference(referenceText) {
  const indexText = referenceText.split('## Complete export index')[1] ?? '';
  const exports = indexText.match(/\((\d+) exports\)/);
  assert.ok(exports, 'reference index has no "(N exports)" header');
  const section = indexText.split('### Functions by category')[1]?.split(/\n### /)[0] ?? '';
  const labels = [...section.matchAll(/^\*\*(.+?)\*\* \(\d+\): /gm)].map((m) => m[1]);
  return {
    exports: Number(exports[1]),
    groups: labels.length,
    categories: labels.filter((l) => l !== 'Other exports (uncategorized)').length,
  };
}

test('the independent counter agrees with parseReferenceIndex on the generated reference', () => {
  const text = readFileSync(REFERENCE, 'utf8');
  const independent = countsFromReference(text);
  const parsed = parseReferenceIndex(text, 'challenger');

  assert.ok(parsed.categoryCount > 0, 'parseReferenceIndex must find categories');
  assert.equal(
    independent.groups,
    parsed.domains.size,
    'the site-generators counter counts a different number of groups than parseReferenceIndex; ' +
      `the generated group heading no longer matches the counter's pattern (got ${independent.groups}, ` +
      `expected ${parsed.domains.size}). The landing-page test then compares '27' with '0'.`
  );
  assert.equal(
    independent.categories,
    parsed.categoryCount,
    'the independent category count must equal parseReferenceIndex.categoryCount'
  );
  assert.equal(
    independent.exports,
    parsed.exportTotal,
    'the independent export total must equal parseReferenceIndex.exportTotal'
  );
});

test('every group heading in the generated reference matches the site-generators pattern', () => {
  const text = readFileSync(REFERENCE, 'utf8');
  const section =
    text
      .split('## Complete export index')[1]
      ?.split('### Functions by category')[1]
      ?.split(/\n### /)[0] ?? '';
  const headings = section.split('\n').filter((line) => /^\*\*.+\*\* \(\d+\):/.test(line));
  assert.ok(headings.length > 0, 'the generated reference has no group headings');
  const sameLineNames = headings.filter((line) => /^\*\*.+\*\* \(\d+\): /.test(line));
  assert.equal(
    sameLineNames.length,
    headings.length,
    `the generator writes names on the following lines, but the shared counter in ` +
      `tools/test/site-generators.test.mjs only matches a space + names on the heading line; ` +
      `${headings.length - sameLineNames.length} of ${headings.length} headings are unreadable by it. ` +
      `Either keep the comma form, or update every reader (parseReferenceIndex and ` +
      `countsFromReference) together.`
  );
});

test('parseReferenceIndex still counts the catch-all group out of the category total', () => {
  const text = readFileSync(REFERENCE, 'utf8');
  const parsed = parseReferenceIndex(text, 'challenger');
  const catchAll = parsed.domains.get(UNCATEGORIZED) ?? [];
  assert.ok(catchAll.length > 0, 'the generated reference should carry an uncategorized group');
  assert.equal(
    parsed.categoryCount,
    parsed.domains.size - 1,
    'the catch-all group must not count as a category'
  );
});
