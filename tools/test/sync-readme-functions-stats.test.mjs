import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { applyReadmeStats } from '../sync-readme-functions-stats.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const sample = `# Title

<!-- BEGIN GENERATED FUNCTIONS STATS (tools/sync-readme-functions-stats.mjs) -->

The function layer (\`@danielsimonjr/mathts-functions\` 0.1.0) exposes **9 exports** in
27 categories — arithmetic through CAS, special functions, statistics and hypothesis tests,
quadrature and optimisation, number theory, signal processing, linear algebra and geometry.
<!-- END GENERATED FUNCTIONS STATS -->

| \`@danielsimonjr/mathts-functions\`      | 9 exports in 27 categories; typed dispatch + \`evaluate()\` — see \`docs/reference/functions.md\` / [danielsimonjr.com/MathTS](https://danielsimonjr.com/MathTS/) |
| [\`docs/reference/functions.md\`](./docs/reference/functions.md)                         | Full typed-function export reference (9 exports) with Accel column |
`;

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
  const once = applyReadmeStats(sample, '0.84.0', 1380);
  const twice = applyReadmeStats(once, '0.84.0', 1380);
  assert.equal(twice, once);
  assert.match(once, /mathts-functions` 0\.84\.0/);
  assert.match(once, /\*\*1,380 exports\*\*/);
  assert.match(once, /\| 1,380 exports in 27 categories/);
  assert.match(once, /reference \(1,380 exports\)/);
  assert.doesNotMatch(once, /0\.1\.0/);
  assert.doesNotMatch(once, /\*\*9 exports\*\*/);
});

test('--check fails when the table row lags the generated block', () => {
  const dir = mkdtempSync(join(tmpdir(), 'readme-stats-'));
  const readme = join(dir, 'README.md');
  const drifted = sample.replace('| 9 exports in 27 categories', '| 1 exports in 27 categories');
  writeFileSync(readme, drifted);
  const pkg = join(dir, 'pkg.json');
  writeFileSync(pkg, JSON.stringify({ version: '0.1.0' }));
  const ref = join(dir, 'functions.md');
  writeFileSync(ref, '## Complete export index\n\n(9 exports)\n');
  const run = spawnSync(
    process.execPath,
    [
      join(HERE, '..', 'sync-readme-functions-stats.mjs'),
      '--check',
      '--readme',
      readme,
      '--version-file',
      pkg,
      '--reference',
      ref,
    ],
    { encoding: 'utf8' }
  );
  assert.notEqual(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stderr, /stale/);
  assert.equal(readFileSync(readme, 'utf8'), drifted);
});
