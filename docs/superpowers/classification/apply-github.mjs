#!/usr/bin/env node
/**
 * Apply pkg:* and family:* labels plus idempotent classification comments.
 *
 * Usage: node apply-github.mjs [--dry-run]
 *
 * - Creates missing pkg:* and family:* labels only
 * - ADD labels (never removes any)
 * - Upserts ONE classification comment per issue (marker-based; no duplicates)
 * - Does not change title, body, assignees, or state
 * - Paces writes (~1/sec) and retries 403/429 with backoff
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { REPO, ghRetry, isAlreadyExists, parseArgs } from './gh-util.mjs';

const MARKER = '<!-- CURSOR_PARITY_CLASSIFICATION_v1 -->';
const FAMILY_COLOR = 'bfd4f2';
const PKG_COLOR = '1d76db';
const { dryRun } = parseArgs(process.argv);

const classData = JSON.parse(readFileSync(new URL('classification.json', import.meta.url), 'utf8'));

const familyDesc = (slug) => `Parity classification family: ${slug}`;
const pkgDesc = (slug) => `MathTS package that owns the work: ${slug}`;

const dupNotes = {
  1707: 'Duplicate scope with #1708 (astype/argmax/argsort rows).',
  1708: 'Duplicate scope with #1707 (astype/argmax/argsort rows).',
  1693: 'Overlaps #1688 on fitlm/LinearModel (P0).',
  1688: 'Overlaps #1693 on fitlm/LinearModel (P0).',
};

const familiesUsed = new Set();
const packagesUsed = new Set();
for (const e of classData.classifications) {
  familiesUsed.add(e.primary_family);
  for (const s of e.secondary_families) familiesUsed.add(s);
  packagesUsed.add(e.package_label);
}

function commentBody(e) {
  const second =
    e.secondary_families.length > 0 ? e.secondary_families.map((s) => `\`${s}\``).join(', ') : '—';
  const dup = dupNotes[e.issue] ? `\n\n**Duplicate/overlap:** ${dupNotes[e.issue]}` : '';
  return `${MARKER}
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
}

function wantedLabels(e) {
  return [
    e.package_label,
    `family:${e.primary_family}`,
    ...e.secondary_families.map((s) => `family:${s}`),
  ];
}

async function listLabelNames() {
  const raw = await ghRetry(['label', 'list', '-R', REPO, '--limit', '500', '--json', 'name']);
  return new Set(JSON.parse(raw).map((l) => l.name));
}

async function createLabel(name, color, description) {
  try {
    await ghRetry(
      ['label', 'create', name, '-R', REPO, '--color', color, '--description', description],
      { isWrite: true }
    );
    return 'created';
  } catch (err) {
    if (isAlreadyExists(err)) return 'exists';
    throw err;
  }
}

async function findClassificationComments(issue) {
  const raw = await ghRetry(['api', `repos/${REPO}/issues/${issue}/comments?per_page=100`]);
  const comments = JSON.parse(raw);
  return comments.filter((c) => typeof c.body === 'string' && c.body.includes(MARKER));
}

async function main() {
  console.log(
    dryRun
      ? 'DRY RUN: no GitHub writes will be made.'
      : `Applying classification to ${classData.classifications.length} issues on ${REPO}.`
  );

  const existing = await listLabelNames();
  const familyNames = [...familiesUsed].sort().map((s) => `family:${s}`);
  const pkgNames = [...packagesUsed].sort();

  const missingFamilies = familyNames.filter((n) => !existing.has(n));
  const missingPkgs = pkgNames.filter((n) => !existing.has(n));
  console.log(
    `Labels: ${pkgNames.length} pkg:* (${missingPkgs.length} missing), ${familyNames.length} family:* (${missingFamilies.length} missing).`
  );

  let created = 0;
  let already = 0;
  const toCreate = [
    ...missingPkgs.map((name) => ({
      name,
      color: PKG_COLOR,
      description: pkgDesc(name.slice('pkg:'.length)),
    })),
    ...missingFamilies.map((name) => ({
      name,
      color: FAMILY_COLOR,
      description: familyDesc(name.slice('family:'.length)),
    })),
  ];

  if (dryRun) {
    for (const l of toCreate) console.log(`  would create ${l.name}`);
    if (toCreate.length === 0) console.log('  no labels to create');
  } else {
    for (const l of toCreate) {
      const status = await createLabel(l.name, l.color, l.description);
      if (status === 'created') {
        created++;
        console.log(`  created ${l.name}`);
      } else {
        already++;
        console.log(`  exists ${l.name}`);
      }
    }
    already += pkgNames.length - missingPkgs.length;
    already += familyNames.length - missingFamilies.length;
  }

  let labelled = 0;
  let commentsCreated = 0;
  let commentsUpdated = 0;
  let commentWarnings = 0;

  for (const e of classData.classifications) {
    const labels = wantedLabels(e);
    if (dryRun) {
      console.log(`  would add labels on #${e.issue}: ${labels.join(', ')}`);
      console.log(`  would upsert classification comment on #${e.issue}`);
      labelled++;
      commentsCreated++;
      continue;
    }

    await ghRetry(['issue', 'edit', String(e.issue), '-R', REPO, '--add-label', labels.join(',')], {
      isWrite: true,
    });
    labelled++;

    const matches = await findClassificationComments(e.issue);
    const body = commentBody(e);
    writeFileSync('/tmp/parity-comment.md', body);
    if (matches.length > 0) {
      if (matches.length > 1) {
        commentWarnings++;
        console.error(
          `  warning: #${e.issue} has ${matches.length} classification comments; updating id ${matches[0].id} only`
        );
      }
      writeFileSync('/tmp/parity-comment-payload.json', JSON.stringify({ body }));
      await ghRetry(
        [
          'api',
          '-X',
          'PATCH',
          `repos/${REPO}/issues/comments/${matches[0].id}`,
          '--input',
          '/tmp/parity-comment-payload.json',
        ],
        { isWrite: true }
      );
      commentsUpdated++;
    } else {
      await ghRetry(
        ['issue', 'comment', String(e.issue), '-R', REPO, '--body-file', '/tmp/parity-comment.md'],
        { isWrite: true }
      );
      commentsCreated++;
    }
    if (e.issue % 10 === 0) {
      console.log(
        `  through #${e.issue} (labelled ${labelled}, comments +${commentsCreated}/~${commentsUpdated})`
      );
    }
  }

  console.log(
    `${dryRun ? 'DRY RUN would have: ' : 'Done: '}${created} labels created, ${labelled} issues labelled, ${commentsCreated} comments created, ${commentsUpdated} comments updated, ${commentWarnings} duplicate-comment warnings.`
  );
}

main().catch((err) => {
  console.error(err.stderr ? String(err.stderr) : err);
  if (err.ghArgs) console.error('gh args:', err.ghArgs.join(' '));
  process.exit(1);
});
