#!/usr/bin/env node
/**
 * Sync root README function-layer version + export count from functions/package.json
 * and the generated reference index (same source as docs:landing).
 *
 *   node tools/sync-readme-functions-stats.mjs          # rewrite markers
 *   node tools/sync-readme-functions-stats.mjs --check   # exit 1 when stale
 *
 * The generated block, the package table row, and the reference-index row are one
 * replacement. `--check` fails when any of the three still carries an old count.
 * Applying the same inputs twice yields the same text.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '<!-- BEGIN GENERATED FUNCTIONS STATS (tools/sync-readme-functions-stats.mjs) -->';
const END = '<!-- END GENERATED FUNCTIONS STATS -->';

/**
 * Rewrite the generated stats block, the package table row, and the reference-index row.
 * @param {string} text
 * @param {string} version
 * @param {number} exportTotal
 */
export function applyReadmeStats(text, version, exportTotal) {
  const count = exportTotal.toLocaleString('en-US');
  const block = `${BEGIN}

The function layer (\`@danielsimonjr/mathts-functions\` ${version}) exposes **${count} exports** in
27 categories — arithmetic through CAS, special functions, statistics and hypothesis tests,
quadrature and optimisation, number theory, signal processing, linear algebra and geometry.
${END}`;
  const re = new RegExp(
    `${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  );
  if (!re.test(text)) {
    throw new Error('README is missing GENERATED FUNCTIONS STATS markers');
  }
  const tableRe = /^\| `@danielsimonjr\/mathts-functions`\s+\|[^|]+\|$/m;
  const refRe =
    /^\| \[`docs\/reference\/functions\.md`\]\([^)]+\)\s+\|[^|]*exports\) with Accel column\s*\|$/m;
  if (!tableRe.test(text) || !refRe.test(text)) {
    throw new Error('README is missing the functions table row or the reference-index row');
  }
  const tableRow = `| \`@danielsimonjr/mathts-functions\`      | ${count} exports in 27 categories; typed dispatch + \`evaluate()\` — see \`docs/reference/functions.md\` / [danielsimonjr.com/MathTS](https://danielsimonjr.com/MathTS/) |`;
  const refLine = `| [\`docs/reference/functions.md\`](./docs/reference/functions.md)                         | Full typed-function export reference (${count} exports) with Accel column    |`;
  return text.replace(re, block).replace(tableRe, tableRow).replace(refRe, refLine);
}

/** Prettier is what CI's format check accepts. The count lines have to match it. */
function formatReadme(text) {
  const prettier = resolve(REPO, 'node_modules/prettier/bin/prettier.cjs');
  const run = spawnSync(process.execPath, [prettier, '--stdin-filepath', 'README.md'], {
    input: text,
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    throw new Error(run.stderr || 'prettier failed');
  }
  return run.stdout;
}

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const repo = REPO;
  const readmePath = flag(args, '--readme') ?? resolve(repo, 'README.md');
  const versionFile = flag(args, '--version-file') ?? resolve(repo, 'functions/package.json');
  const reference = flag(args, '--reference') ?? resolve(repo, 'docs/reference/functions.md');
  const version = JSON.parse(readFileSync(versionFile, 'utf8')).version;
  const ref = readFileSync(reference, 'utf8');
  const [, indexText = ''] = ref.split('## Complete export index');
  const exportTotal = Number((indexText.match(/\((\d+) exports\)/) ?? [])[1] ?? 0);
  if (!exportTotal) {
    console.error(
      'sync-readme-functions-stats: could not read export count from docs/reference/functions.md'
    );
    process.exit(1);
  }
  let text;
  try {
    text = readFileSync(readmePath, 'utf8');
  } catch (err) {
    console.error(`sync-readme-functions-stats: ${err.message}`);
    process.exit(1);
  }
  let finalText;
  try {
    finalText = formatReadme(applyReadmeStats(text, version, exportTotal));
    const again = formatReadme(applyReadmeStats(finalText, version, exportTotal));
    if (again !== finalText) {
      console.error('sync-readme-functions-stats: replacement is not deterministic');
      process.exit(1);
    }
  } catch (err) {
    console.error(`sync-readme-functions-stats: ${err.message}`);
    process.exit(1);
  }
  if (finalText === text) {
    console.log('sync-readme-functions-stats: README function stats already current');
    process.exit(0);
  }
  if (check) {
    console.error(
      'sync-readme-functions-stats: README function stats are stale — run without --check'
    );
    process.exit(1);
  }
  writeFileSync(readmePath, finalText);
  console.log(`sync-readme-functions-stats: updated README (${version}, ${exportTotal} exports)`);
}
