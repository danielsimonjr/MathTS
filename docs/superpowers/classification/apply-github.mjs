#!/usr/bin/env node
/**
 * Apply pkg:* and family:* labels plus idempotent classification comments.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const MARKER = '<!-- CURSOR_PARITY_CLASSIFICATION_v1 -->';
const classData = JSON.parse(
  readFileSync(new URL('classification.json', import.meta.url), 'utf8'),
);

const FAMILY_COLOR = 'bfd4f2';
const familyDesc = (slug) =>
  `Parity classification family: ${slug} (see docs/superpowers/classification/families.md)`;

const dupNotes = {
  1707: 'Duplicate scope with #1708 (astype/argmax/argsort rows).',
  1708: 'Duplicate scope with #1707 (astype/argmax/argsort rows).',
  1693: 'Overlaps #1688 on fitlm/LinearModel (P0).',
  1688: 'Overlaps #1693 on fitlm/LinearModel (P0).',
};

const familiesUsed = new Set();
for (const e of classData.classifications) {
  familiesUsed.add(e.primary_family);
  for (const s of e.secondary_families) familiesUsed.add(s);
}

console.log(`Creating ${familiesUsed.size} family labels if missing...`);
for (const slug of [...familiesUsed].sort()) {
  const name = `family:${slug}`;
  try {
    execSync(
      `gh label create "${name}" --color "${FAMILY_COLOR}" --description "${familyDesc(slug).replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' },
    );
    console.log(`  created ${name}`);
  } catch {
    /* exists */
  }
}

let commented = 0;
let labelled = 0;

for (const e of classData.classifications) {
  const labels = [
    e.package_label,
    `family:${e.primary_family}`,
    ...e.secondary_families.map((s) => `family:${s}`),
  ];
  execSync(`gh issue edit ${e.issue} --add-label "${labels.join(',')}"`, {
    stdio: 'pipe',
  });
  labelled++;

  const second =
    e.secondary_families.length > 0
      ? e.secondary_families.map((s) => `\`${s}\``).join(', ')
      : '—';
  const dup = dupNotes[e.issue] ? `\n\n**Duplicate/overlap:** ${dupNotes[e.issue]}` : '';
  const body = `${MARKER}
**Parity classification (adjudicated)**

| Field | Value |
|-------|-------|
| Package | \`${e.package}\` (${e.package_label}) |
| Primary family | \`${e.primary_family}\` |
| Secondary families | ${second} |
| Confidence | ${e.confidence} |
| Implementation | ${e.implementation_location} |

${e.rationale}${dup}
`;

  const existing = execSync(
    `gh api repos/danielsimonjr/MathTS/issues/${e.issue}/comments --jq '.[] | select(.body | contains("${MARKER}")) | .id'`,
    { encoding: 'utf8' },
  ).trim();

  writeFileSync('/tmp/parity-comment.md', body);
  if (existing) {
    const id = existing.split('\n')[0];
    writeFileSync(
      '/tmp/parity-comment-payload.json',
      JSON.stringify({ body }),
    );
    execSync(
      `gh api -X PATCH repos/danielsimonjr/MathTS/issues/comments/${id} --input /tmp/parity-comment-payload.json`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`gh issue comment ${e.issue} --body-file /tmp/parity-comment.md`, {
      stdio: 'inherit',
    });
  }
  commented++;
  if (e.issue % 10 === 0) console.log(`  through #${e.issue}`);
}

console.log(`Done: ${labelled} issues labelled, ${commented} comments upserted.`);