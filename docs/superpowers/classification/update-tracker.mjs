#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const MARKER_START = '<!-- PARITY_CLASSIFICATION_INDEX_START -->';
const MARKER_END = '<!-- PARITY_CLASSIFICATION_INDEX_END -->';

const classData = JSON.parse(
  readFileSync(new URL('classification.json', import.meta.url), 'utf8'),
);

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

const current = execSync(
  'gh issue view 1714 --json body --jq .body',
  { encoding: 'utf8' },
);

let body;
if (current.includes(MARKER_START)) {
  const re = new RegExp(
    `${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`,
    'm',
  );
  body = current.replace(re, index);
} else {
  body = `${current.trim()}\n\n${index}`;
}

writeFileSync('/tmp/issue-1714-body.md', body);
execSync('gh issue edit 1714 --body-file /tmp/issue-1714-body.md');
console.log('Updated tracker #1714 classification index.');