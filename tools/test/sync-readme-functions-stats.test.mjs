import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { applyInlineStats, applyReadmeStats } from '../sync-readme-functions-stats.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const TOOL = join(HERE, '..', 'sync-readme-functions-stats.mjs');

const sample = `# Title

<!-- BEGIN GENERATED FUNCTIONS STATS (tools/sync-readme-functions-stats.mjs) -->

The function layer (\`@danielsimonjr/mathts-functions\` 0.1.0) exposes **9 exports** in
27 categories — arithmetic through CAS, special functions, statistics and hypothesis tests,
quadrature and optimisation, number theory, signal processing, linear algebra and geometry.
<!-- END GENERATED FUNCTIONS STATS -->

| \`@danielsimonjr/mathts-functions\`      | 9 exports in 27 categories; typed dispatch + \`evaluate()\` — see \`docs/reference/functions.md\` / [danielsimonjr.com/MathTS](https://danielsimonjr.com/MathTS/) |
| [\`docs/reference/functions.md\`](./docs/reference/functions.md)                         | Full typed-function export reference (9 exports) with Accel column |
`;

const gettingStarted = `Provides <!-- fn:exports -->9<!-- /fn --> exports in <!-- fn:categories -->1<!-- /fn --> categories.

| Package | Purpose |
| --- | --- |
| \`pkg\` | <!-- fn:exports -->9<!-- /fn --> exports with type dispatch |
`;

/** A reference with two named categories and the catch-all group: 2 categories, not 3. */
const reference = `## Complete export index

> Complete index (1380 exports).

### Functions by category

**Arithmetic** (1): \`add\`

**Statistics** (1): \`mean\`

**Other exports (uncategorized)** (1): \`odd\`

### Constants & values (1)

\`pi\`
`;

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'readme-stats-'));
  const paths = {};
  for (const [name, content] of Object.entries(files)) {
    paths[name] = join(dir, name);
    writeFileSync(paths[name], content);
  }
  return paths;
}

function runTool(paths, extra = []) {
  return spawnSync(
    process.execPath,
    [
      TOOL,
      ...extra,
      '--readme',
      paths['README.md'],
      '--getting-started',
      paths['getting-started.md'],
      '--version-file',
      paths['package.json'],
      '--reference',
      paths['functions.md'],
    ],
    { encoding: 'utf8' }
  );
}

test('version-packages runs README function stats sync after changeset version', () => {
  const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const script = rootPkg.scripts['version-packages'];
  assert.match(script, /changeset version/);
  assert.match(script, /sync:readme-functions-stats/);
  assert.match(script, /bun install --lockfile-only/);
  const syncIdx = script.indexOf('sync:readme-functions-stats');
  const versionIdx = script.indexOf('changeset version');
  const lockIdx = script.indexOf('bun install --lockfile-only');
  assert.ok(versionIdx < syncIdx, 'sync must run after changeset version');
  assert.ok(syncIdx < lockIdx, 'lock refresh must run after README sync');
});

test('applyReadmeStats is deterministic and updates every count site', () => {
  const once = applyReadmeStats(sample, '0.84.0', 1380, 26);
  const twice = applyReadmeStats(once, '0.84.0', 1380, 26);
  assert.equal(twice, once);
  assert.match(once, /mathts-functions` 0\.84\.0/);
  assert.match(once, /\*\*1,380 exports\*\* in\n26 categories/);
  assert.match(once, /\| 1,380 exports in 26 categories/);
  assert.match(once, /reference \(1,380 exports\)/);
  assert.doesNotMatch(once, /0\.1\.0/);
  assert.doesNotMatch(once, /\*\*9 exports\*\*/);
  assert.doesNotMatch(once, /27 categories/);
});

test('applyInlineStats rewrites every marker and is deterministic', () => {
  const once = applyInlineStats(gettingStarted, 1380, 26);
  assert.equal(applyInlineStats(once, 1380, 26), once);
  assert.equal(once.match(/<!-- fn:exports -->1,380<!-- \/fn -->/g)?.length, 2);
  assert.match(once, /<!-- fn:categories -->26<!-- \/fn -->/);
  assert.doesNotMatch(once, />9</);
});

test('applyInlineStats fails when a kind of marker is missing', () => {
  assert.throws(
    () => applyInlineStats('No markers here, 1,381 exports.\n', 1380, 26),
    /missing an <!-- fn:exports --> or <!-- fn:categories --> marker/
  );
  assert.throws(
    () => applyInlineStats('<!-- fn:exports -->9<!-- /fn --> only.\n', 1380, 26),
    /missing/
  );
});

test('the tool derives the count and the category count, and a second run changes nothing', () => {
  const paths = fixture({
    'README.md': sample,
    'getting-started.md': gettingStarted,
    'package.json': JSON.stringify({ version: '0.1.0' }),
    'functions.md': reference,
  });
  const first = runTool(paths);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const readme = readFileSync(paths['README.md'], 'utf8');
  const doc = readFileSync(paths['getting-started.md'], 'utf8');
  // 1380 exports; "Arithmetic" and "Statistics" are the categories, the catch-all is not.
  assert.match(readme, /\*\*1,380 exports\*\* in\n2 categories/);
  assert.match(doc, /<!-- fn:categories -->2<!-- \/fn -->/);
  assert.match(doc, /<!-- fn:exports -->1,380<!-- \/fn -->/);
  const again = runTool(paths, ['--check']);
  assert.equal(again.status, 0, again.stdout + again.stderr);
});

test('--check fails when the table row lags the generated block', () => {
  const drifted = sample.replace('| 9 exports in 27 categories', '| 1 exports in 27 categories');
  const paths = fixture({
    'README.md': drifted,
    'getting-started.md': gettingStarted,
    'package.json': JSON.stringify({ version: '0.1.0' }),
    'functions.md': reference,
  });
  const run = runTool(paths, ['--check']);
  assert.notEqual(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stderr, /stale/);
  assert.equal(readFileSync(paths['README.md'], 'utf8'), drifted);
});

test('--check fails when only getting-started.md is stale', () => {
  const current = fixture({
    'README.md': sample,
    'getting-started.md': gettingStarted,
    'package.json': JSON.stringify({ version: '0.1.0' }),
    'functions.md': reference,
  });
  assert.equal(runTool(current).status, 0);
  const stale = readFileSync(current['getting-started.md'], 'utf8').replace(
    '<!-- fn:exports -->1,380<!-- /fn --> exports with',
    '<!-- fn:exports -->1,326<!-- /fn --> exports with'
  );
  writeFileSync(current['getting-started.md'], stale);
  const run = runTool(current, ['--check']);
  assert.notEqual(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stderr, /stale in .*getting-started\.md/);
  assert.equal(readFileSync(current['getting-started.md'], 'utf8'), stale);
});

test('the tool fails loudly when the reference has no category block', () => {
  const paths = fixture({
    'README.md': sample,
    'getting-started.md': gettingStarted,
    'package.json': JSON.stringify({ version: '0.1.0' }),
    'functions.md': '## Complete export index\n\n(9 exports)\n',
  });
  const run = runTool(paths, ['--check']);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /no "\(N exports\)" header or no "### Functions by category" block/);
  assert.equal(readFileSync(paths['README.md'], 'utf8'), sample);
});

test('the tool fails when getting-started.md has no markers', () => {
  const paths = fixture({
    'README.md': sample,
    'getting-started.md': 'No markers, 1,326 exports.\n',
    'package.json': JSON.stringify({ version: '0.1.0' }),
    'functions.md': reference,
  });
  const run = runTool(paths, ['--check']);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /getting-started\.md: missing an <!-- fn:exports -->/);
});
