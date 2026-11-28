/**
 * Durable mathjs v15.3.0 mocha oracle harness (#1785).
 *
 * Canonical loader: `compat/scripts/mathjs-unit-oracle-loader.mjs` redirects
 * `defaultInstance.js`, `create.js`, `factory.js`, and public error modules to
 * `compat/dist/index.js`. Redirecting only `defaultInstance.js` leaves mathjs
 * error classes on the import path and breaks `assert.throws(fn, ArgumentsError)`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const compatRoot = join(repoRoot, 'compat');
const scripts = join(compatRoot, 'scripts');
const distIndex = join(compatRoot, 'dist/index.js');
const mathjsRoot = process.env.MATHJS_SOURCE_ROOT ?? '/tmp/mathjs-15.3.0';

function loadManifest(name: string): { files: string[]; expected: Record<string, number> } {
  return JSON.parse(readFileSync(join(scripts, name), 'utf8')) as {
    files: string[];
    expected: Record<string, number>;
  };
}

function runOracle(suite: 'matrix' | 'unit1784'): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [join(scripts, 'run-mathjs-unit-oracle.mjs'), suite], {
    cwd: repoRoot,
    env: { ...process.env, MATHTS_COMPAT_DIST: distIndex },
    encoding: 'utf8',
    maxBuffer: 25 * 1024 * 1024,
  });
}

describe('mathjs matrix oracle harness (#1785)', () => {
  it('pins the canonical loader and matrix manifest (29 files)', () => {
    expect(readFileSync(join(scripts, 'mathjs-unit-oracle-loader.mjs'), 'utf8')).toContain(
      '/src/error/ArgumentsError.js'
    );
    const matrix = loadManifest('mathjs-matrix-oracle-files.json');
    expect(matrix.files).toHaveLength(29);
    expect(matrix.expected).toEqual({ passing: 820, pending: 4, failing: 0 });
  });

  it('pins the unit #1784 oracle manifest (8 files, 204 passing)', () => {
    const unit = loadManifest('mathjs-unit-oracle-1784-files.json');
    expect(unit.files).toHaveLength(8);
    expect(unit.expected.passing).toBe(204);
    expect(unit.expected.failing).toBe(0);
  });

  const oracleReady = existsSync(distIndex) && existsSync(join(mathjsRoot, 'package.json'));

  (oracleReady ? it : it.skip)(
    'mocha matrix oracle (canonical loader) matches 820 / 4 pending / 0 failing',
    () => {
      const result = runOracle('matrix');
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    },
    120_000
  );

  (oracleReady ? it : it.skip)(
    'mocha unit oracle (#1784) matches pinned passing tally',
    () => {
      const result = runOracle('unit1784');
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    },
    120_000
  );
});
