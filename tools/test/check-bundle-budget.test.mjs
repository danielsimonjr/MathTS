import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import { exceedsTolerance } from './check-bundle-budget.mjs';

test('exceedsTolerance uses max of bytes and ratio', () => {
  const tol = { bytes: 512, ratio: 0.01 };
  assert.equal(exceedsTolerance(10_000, 10_400, tol), false);
  assert.equal(exceedsTolerance(10_000, 10_600, tol), true);
  assert.equal(exceedsTolerance(1000, 1600, tol), true);
});

test('esbuild fixture tree-shake detects sentinel of other export', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
  writeFileSync(
    join(dir, 'mod.js'),
    `export function alpha() { return 1; }
export const sentinelUnique = 'SENTINEL_XYZ';
`
  );
  const fixture = `import { alpha } from './mod.js';\nvoid alpha;\n`;
  const full = buildSync({
    entryPoints: [join(dir, 'mod.js')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  }).outputFiles[0].text.length;
  const partial = buildSync({
    stdin: { contents: fixture, loader: 'js', resolveDir: dir },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  }).outputFiles[0].text;
  assert.ok(partial.length < full * 0.8);
  assert.equal(partial.includes('SENTINEL_XYZ'), false);
});
