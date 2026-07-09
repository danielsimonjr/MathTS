import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractShippedClaims, extractOpenTodoArtifacts, cmpSemver } from './roadmap-check.mjs';

test('extractShippedClaims pulls pkg@version from the Recently shipped section only', () => {
  const md = [
    '## Near-term',
    '- foo@9.9.9 (should be ignored — not in Recently shipped)',
    '## Recently shipped',
    '- plot@0.3.0 and `@danielsimonjr/mathts-expression@0.6.0`',
    '- functions@0.16.1',
    '## Out of scope',
    '- bar@1.0.0 (ignored)',
  ].join('\n');
  const claims = extractShippedClaims(md);
  const map = Object.fromEntries(claims.map((c) => [c.pkg, c.version]));
  assert.equal(map['@danielsimonjr/mathts-plot'], '0.3.0');
  assert.equal(map['@danielsimonjr/mathts-expression'], '0.6.0');
  assert.equal(map['@danielsimonjr/mathts-functions'], '0.16.1');
  assert.equal(map['@danielsimonjr/mathts-foo'], undefined); // outside the section
  assert.equal(map['@danielsimonjr/mathts-bar'], undefined);
});

test('extractShippedClaims returns [] when no Recently shipped section', () => {
  assert.deepEqual(extractShippedClaims('# Roadmap\n## Near-term\n- x@1.0.0'), []);
});

test('extractOpenTodoArtifacts finds backticked file paths in unchecked items only', () => {
  const md = [
    '- [ ] add `workbook/src/ipynb.ts` for notebook export',
    '- [x] done `workbook/src/pdf.ts` already shipped',
    '- [ ] a plain item with `justAToken` and `--format json` (no path)',
    '- [ ] nested `docs/Architecture/foo.json` path',
  ].join('\n');
  const arts = extractOpenTodoArtifacts(md).map((a) => a.path);
  assert.ok(arts.includes('workbook/src/ipynb.ts'));
  assert.ok(arts.includes('docs/Architecture/foo.json'));
  assert.ok(!arts.includes('workbook/src/pdf.ts')); // checked item, skipped
  assert.ok(!arts.includes('justAToken')); // not path-like
  assert.ok(!arts.includes('--format json'));
});

test('cmpSemver orders correctly', () => {
  assert.equal(cmpSemver('0.3.0', '0.2.0'), 1);
  assert.equal(cmpSemver('0.16.1', '0.16.1'), 0);
  assert.equal(cmpSemver('0.5.3', '0.6.0'), -1);
  assert.equal(cmpSemver('1.0.0', '0.99.99'), 1);
});
