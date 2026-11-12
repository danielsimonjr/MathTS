#!/usr/bin/env node
/**
 * Sync root README function-layer version + export count from functions/package.json
 * and the generated reference index (same source as docs:landing).
 *
 *   node tools/sync-readme-functions-stats.mjs          # rewrite markers
 *   node tools/sync-readme-functions-stats.mjs --check   # exit 1 when stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const README = resolve(REPO, 'README.md');
const BEGIN = '<!-- BEGIN GENERATED FUNCTIONS STATS (tools/sync-readme-functions-stats.mjs) -->';
const END = '<!-- END GENERATED FUNCTIONS STATS -->';
const args = new Set(process.argv.slice(2));
const check = args.has('--check');

const version = JSON.parse(
  readFileSync(resolve(REPO, 'functions/package.json'), 'utf8')
).version;
const ref = readFileSync(resolve(REPO, 'docs/reference/functions.md'), 'utf8');
const [, indexText = ''] = ref.split('## Complete export index');
const exportTotal = Number((indexText.match(/\((\d+) exports\)/) ?? [])[1] ?? 0);
if (!exportTotal) {
  console.error('sync-readme-functions-stats: could not read export count from docs/reference/functions.md');
  process.exit(1);
}

const block = `${BEGIN}

The function layer (\`@danielsimonjr/mathts-functions\` ${version}) exposes **${exportTotal.toLocaleString('en-US')} exports** in
27 categories — arithmetic through CAS, special functions, statistics and hypothesis tests,
quadrature and optimisation, number theory, signal processing, linear algebra and geometry.
${END}`;

const text = readFileSync(README, 'utf8');
const re = new RegExp(
  `${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
);
if (!re.test(text)) {
  console.error('sync-readme-functions-stats: README is missing GENERATED FUNCTIONS STATS markers');
  process.exit(1);
}
const next = text.replace(re, block);
if (next === text) {
  console.log('sync-readme-functions-stats: README function stats already current');
  process.exit(0);
}
if (check) {
  console.error('sync-readme-functions-stats: README function stats are stale — run without --check');
  process.exit(1);
}
const tableRow = `| \`@danielsimonjr/mathts-functions\`      | ${exportTotal.toLocaleString('en-US')} exports in 27 categories; typed dispatch + \`evaluate()\` — see \`docs/reference/functions.md\` / [danielsimonjr.com/MathTS](https://danielsimonjr.com/MathTS/) |`;
const withTable = next.replace(
  /^\| `@danielsimonjr\/mathts-functions`\s+\|\s*[^|]+\|$/m,
  tableRow
);
const refLine = `| [\`docs/reference/functions.md\`](./docs/reference/functions.md)                         | Full typed-function export reference (${exportTotal.toLocaleString('en-US')} exports) with Accel column |`;
const finalText = withTable.replace(
  /^\| \[`docs\/reference\/functions\.md`\].*exports\) with Accel column \|$/m,
  refLine
);
writeFileSync(README, finalText);
console.log(`sync-readme-functions-stats: updated README (${version}, ${exportTotal} exports)`);
