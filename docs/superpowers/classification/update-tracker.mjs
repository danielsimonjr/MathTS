#!/usr/bin/env node
/**
 * Edit only the #1714 body: insert or replace the classification index
 * between PARITY_CLASSIFICATION_INDEX markers. Idempotent.
 *
 * Usage: node update-tracker.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { REPO, ghRetry, parseArgs } from './gh-util.mjs';

const MARKER_START = '<!-- PARITY_CLASSIFICATION_INDEX_START -->';
const MARKER_END = '<!-- PARITY_CLASSIFICATION_INDEX_END -->';
const { dryRun } = parseArgs(process.argv);

const classData = JSON.parse(readFileSync(new URL('classification.json', import.meta.url), 'utf8'));

const byPkg = new Map();
for (const e of classData.classifications) {
  const pkg = e.package.replace('@danielsimonjr/mathts-', '');
  if (!byPkg.has(pkg)) byPkg.set(pkg, new Map());
  const famMap = byPkg.get(pkg);
  const fam = e.primary_family;
  if (!famMap.has(fam)) famMap.set(fam, []);
  famMap.get(fam).push(e.issue);
}

let index = `${MARKER_START}\n## Classification index (package → family → issues)\n\n`;
const pkgs = [...byPkg.keys()].sort();
for (const pkg of pkgs) {
  index += `### pkg:${pkg}\n\n`;
  const famMap = byPkg.get(pkg);
  const fams = [...famMap.keys()].sort();
  for (const fam of fams) {
    const issues = famMap.get(fam).sort((a, b) => a - b);
    const links = issues
      .map((n) => `[#${n}](https://github.com/danielsimonjr/MathTS/issues/${n})`)
      .join(', ');
    index += `- **\`${fam}\`:** ${links}\n`;
  }
  index += '\n';
}
index += `${MARKER_END}\n`;

async function main() {
  const current = await ghRetry([
    'issue',
    'view',
    '1714',
    '-R',
    REPO,
    '--json',
    'body',
    '--jq',
    '.body',
  ]);

  let body;
  if (current.includes(MARKER_START)) {
    const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, 'm');
    if (!re.test(current)) {
      throw new Error('Found start marker on #1714 but could not replace the block');
    }
    body = current.replace(re, index);
  } else {
    body = `${current.trim()}\n\n${index}`;
  }

  writeFileSync('/tmp/issue-1714-body.md', body);
  if (dryRun) {
    console.log('DRY RUN: wrote proposed #1714 body to /tmp/issue-1714-body.md (not applied).');
    const start = body.indexOf(MARKER_START);
    const end = body.indexOf(MARKER_END);
    console.log(body.slice(start, end + MARKER_END.length));
    return;
  }

  await ghRetry(['issue', 'edit', '1714', '-R', REPO, '--body-file', '/tmp/issue-1714-body.md'], {
    isWrite: true,
  });
  console.log('Updated tracker #1714 classification index.');
}

main().catch((err) => {
  console.error(err.stderr ? String(err.stderr) : err);
  if (err.ghArgs) console.error('gh args:', err.ghArgs.join(' '));
  process.exit(1);
});
