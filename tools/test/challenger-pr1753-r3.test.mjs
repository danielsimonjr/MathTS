/**
 * Challenger round 3 for PR #1753, in its post-fix form.
 *
 * Commit cc311160 moved the generated export index from
 *   **Arithmetic** (43): `abs`, `add`, ...
 * to one name per following line, and updated parseReferenceIndex. The other
 * reader of the same block — `countsFromReference` in
 * tools/test/site-generators.test.mjs — kept a pattern that required a space and
 * the names on the heading line, so Compile & Lint failed `'27' !== '0'`
 * (reproduced locally and in CI job 139553398268). 8595066e fixed that reader.
 *
 * The bug this file guards against is reader drift: one parser of the generated
 * block updated, another left behind. Rather than hard-code either the old or the
 * new shape (which is how the drift slipped through), these tests read the ACTUAL
 * counter pattern out of tools/test/site-generators.test.mjs and require it to
 * agree with parseReferenceIndex on the real generated file. A future format
 * change that updates one reader and not the other fails here, naming the cause.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReferenceIndex, UNCATEGORIZED } from '../reference-index.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REFERENCE = join(repoRoot, 'docs', 'reference', 'functions.md');
const SITE_TEST = join(repoRoot, 'tools', 'test', 'site-generators.test.mjs');

/**
 * The group-heading regex that `countsFromReference` in site-generators.test.mjs
 * uses, read from that file's source so this guard cannot go stale the way a
 * copied literal would. Throws when the line it is extracted from is renamed.
 */
function siteCounterPattern() {
  const source = readFileSync(SITE_TEST, 'utf8');
  const m = source.match(/const labels = \[\.\.\.section\.matchAll\(\/(.+?)\/([a-z]*)\)\]/);
  assert.ok(
    m,
    "could not find countsFromReference's matchAll regex in site-generators.test.mjs; " +
      'update this guard if that helper was renamed'
  );
  return new RegExp(m[1], m[2].includes('g') ? 'gm' : 'm');
}

const sectionOf = (text) =>
  text
    .split('## Complete export index')[1]
    ?.split('### Functions by category')[1]
    ?.split(/\n### /)[0] ?? '';

test('the site-generators counter and parseReferenceIndex agree on the generated reference', () => {
  const text = readFileSync(REFERENCE, 'utf8');
  const parsed = parseReferenceIndex(text, 'challenger');
  const labels = [...sectionOf(text).matchAll(siteCounterPattern())].map((m) => m[1]);

  assert.ok(parsed.categoryCount > 0, 'parseReferenceIndex must find categories');
  assert.equal(
    labels.length,
    parsed.domains.size,
    'site-generators.test.mjs counts a different number of groups than parseReferenceIndex ' +
      `(${labels.length} vs ${parsed.domains.size}); one reader was changed without the other. ` +
      'The landing-page test then compares two different counts.'
  );
  assert.equal(
    labels.filter((l) => l !== UNCATEGORIZED).length,
    parsed.categoryCount,
    'the catch-all group must be excluded from the category count by BOTH readers'
  );
});

test('the export total header is readable by both readers', () => {
  const text = readFileSync(REFERENCE, 'utf8');
  const parsed = parseReferenceIndex(text, 'challenger');
  const indexText = text.split('## Complete export index')[1] ?? '';
  const header = indexText.match(/\((\d+) exports\)/);
  assert.ok(header, 'the generated index has no "(N exports)" header');
  assert.equal(Number(header[1]), parsed.exportTotal);
});

test('parseReferenceIndex still counts the catch-all group out of the category total', () => {
  const parsed = parseReferenceIndex(readFileSync(REFERENCE, 'utf8'), 'challenger');
  const catchAll = parsed.domains.get(UNCATEGORIZED) ?? [];
  assert.ok(catchAll.length > 0, 'the generated reference should carry an uncategorized group');
  assert.equal(
    parsed.categoryCount,
    parsed.domains.size - 1,
    'the catch-all group must not count as a category'
  );
});
