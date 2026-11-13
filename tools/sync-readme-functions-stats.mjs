#!/usr/bin/env node
/**
 * Sync the function-layer version, export count and category count from
 * functions/package.json and the generated reference index (same source as docs:landing,
 * read through tools/reference-index.mjs) into two documents:
 *   - the root README: a generated block, the package table row and the reference-index row;
 *   - docs/getting-started.md: the inline `<!-- fn:exports -->` and `<!-- fn:categories -->`
 *     markers (each closed by `<!-- /fn -->`).
 *
 *   node tools/sync-readme-functions-stats.mjs          # rewrite markers
 *   node tools/sync-readme-functions-stats.mjs --check   # exit 1 when stale
 *   options: --readme PATH --getting-started PATH --version-file PATH --reference PATH
 *
 * `--check` fails when any marked place in either document still carries an old count.
 * Applying the same inputs twice yields the same text.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReferenceIndex } from './reference-index.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '<!-- BEGIN GENERATED FUNCTIONS STATS (tools/sync-readme-functions-stats.mjs) -->';
const END = '<!-- END GENERATED FUNCTIONS STATS -->';

/**
 * Rewrite the generated stats block, the package table row, and the reference-index row.
 * @param {string} text
 * @param {string} version
 * @param {number} exportTotal
 * @param {number} categoryCount
 */
export function applyReadmeStats(text, version, exportTotal, categoryCount) {
  const count = exportTotal.toLocaleString('en-US');
  const block = `${BEGIN}

The function layer (\`@danielsimonjr/mathts-functions\` ${version}) exposes **${count} exports** in
${categoryCount} categories — arithmetic through CAS, special functions, statistics and hypothesis tests,
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
  const tableRow = `| \`@danielsimonjr/mathts-functions\`      | ${count} exports in ${categoryCount} categories; typed dispatch + \`evaluate()\` — see \`docs/reference/functions.md\` / [danielsimonjr.com/MathTS](https://danielsimonjr.com/MathTS/) |`;
  const refLine = `| [\`docs/reference/functions.md\`](./docs/reference/functions.md)                         | Full typed-function export reference (${count} exports) with Accel column    |`;
  return text.replace(re, block).replace(tableRe, tableRow).replace(refRe, refLine);
}

const INLINE_MARKER = /(<!-- fn:(exports|categories) -->)[^<]*(<!-- \/fn -->)/g;

/**
 * Rewrite every inline count marker: `<!-- fn:exports -->1,381<!-- /fn -->` and
 * `<!-- fn:categories -->27<!-- /fn -->`. The document needs at least one marker of each kind.
 * @param {string} text
 * @param {number} exportTotal
 * @param {number} categoryCount
 */
export function applyInlineStats(text, exportTotal, categoryCount) {
  const value = { exports: exportTotal.toLocaleString('en-US'), categories: String(categoryCount) };
  const kinds = new Set([...text.matchAll(INLINE_MARKER)].map((m) => m[2]));
  if (!kinds.has('exports') || !kinds.has('categories')) {
    throw new Error('missing an <!-- fn:exports --> or <!-- fn:categories --> marker');
  }
  return text.replace(INLINE_MARKER, (_, open, kind, close) => `${open}${value[kind]}${close}`);
}

/** Prettier is what CI's format check accepts. The count lines have to match it. */
function formatMarkdown(text, path) {
  const prettier = resolve(REPO, 'node_modules/prettier/bin/prettier.cjs');
  const run = spawnSync(process.execPath, [prettier, '--stdin-filepath', basename(path)], {
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
  const gettingStartedPath =
    flag(args, '--getting-started') ?? resolve(repo, 'docs/getting-started.md');
  const versionFile = flag(args, '--version-file') ?? resolve(repo, 'functions/package.json');
  const reference = flag(args, '--reference') ?? resolve(repo, 'docs/reference/functions.md');
  const version = JSON.parse(readFileSync(versionFile, 'utf8')).version;
  let exportTotal;
  let categoryCount;
  try {
    ({ exportTotal, categoryCount } = parseReferenceIndex(
      readFileSync(reference, 'utf8'),
      reference
    ));
  } catch (err) {
    console.error(`sync-readme-functions-stats: ${err.message}`);
    process.exit(1);
  }

  /** @type {Array<[string, (text: string) => string]>} */
  const targets = [
    [readmePath, (t) => applyReadmeStats(t, version, exportTotal, categoryCount)],
    [gettingStartedPath, (t) => applyInlineStats(t, exportTotal, categoryCount)],
  ];
  /** @type {Array<[string, string]>} path and new text of each document that is stale */
  const stale = [];
  for (const [path, apply] of targets) {
    let text;
    let finalText;
    try {
      text = readFileSync(path, 'utf8');
      finalText = formatMarkdown(apply(text), path);
      if (formatMarkdown(apply(finalText), path) !== finalText) {
        console.error(`sync-readme-functions-stats: replacement is not deterministic in ${path}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`sync-readme-functions-stats: ${path}: ${err.message}`);
      process.exit(1);
    }
    if (finalText !== text) stale.push([path, finalText]);
  }
  if (!stale.length) {
    console.log('sync-readme-functions-stats: function stats already current');
    process.exit(0);
  }
  const names = stale.map(([path]) => path).join(', ');
  if (check) {
    console.error(
      `sync-readme-functions-stats: function stats are stale in ${names} — run without --check`
    );
    process.exit(1);
  }
  for (const [path, finalText] of stale) writeFileSync(path, finalText);
  console.log(
    `sync-readme-functions-stats: updated ${names} (${version}, ${exportTotal} exports, ${categoryCount} categories)`
  );
}
