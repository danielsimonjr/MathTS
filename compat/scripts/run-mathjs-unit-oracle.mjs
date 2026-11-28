#!/usr/bin/env node
/**
 * Run a pinned mathjs v15.3.0 mocha file list against compat `dist/index.js`.
 *
 * Usage:
 *   MATHTS_COMPAT_DIST=/path/to/compat/dist/index.js \
 *     node compat/scripts/run-mathjs-unit-oracle.mjs matrix|unit1784
 *
 * Requires `mathjs@15.3.0` sources (default: /tmp/mathjs-15.3.0 with mocha installed).
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const suite = process.argv[2];
if (suite !== 'matrix' && suite !== 'unit1784') {
  console.error('Usage: node run-mathjs-unit-oracle.mjs <matrix|unit1784>');
  process.exit(2);
}

const manifestName = suite === 'matrix' ? 'mathjs-matrix-oracle-files.json' : 'mathjs-unit-oracle-1784-files.json';
const manifest = JSON.parse(readFileSync(join(here, manifestName), 'utf8'));

const compatDist = process.env.MATHTS_COMPAT_DIST;
if (!compatDist) {
  console.error('MATHTS_COMPAT_DIST must point at compat/dist/index.js');
  process.exit(2);
}

const mathjsRoot = process.env.MATHJS_SOURCE_ROOT ?? '/tmp/mathjs-15.3.0';
const mocha = join(mathjsRoot, 'node_modules/mocha/bin/mocha.js');
const register = join(here, 'mathjs-unit-oracle-register.mjs');

const result = spawnSync(
  process.execPath,
  ['--import', register, mocha, ...manifest.files],
  {
    cwd: mathjsRoot,
    env: { ...process.env, MATHTS_COMPAT_DIST: compatDist },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  }
);

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const passing = Number(out.match(/(\d+) passing/)?.[1] ?? NaN);
const pending = Number(out.match(/(\d+) pending/)?.[1] ?? 0);
const failing = Number(out.match(/(\d+) failing/)?.[1] ?? 0);

const exp = manifest.expected;
let ok = result.status === 0;
if (Number.isFinite(passing)) {
  if (passing !== exp.passing || pending !== exp.pending || failing !== exp.failing) {
    ok = false;
    console.error(
      `[oracle ${suite}] tally mismatch: got ${passing}/${pending}/${failing}, ` +
        `expected ${exp.passing}/${exp.pending}/${exp.failing}`
    );
  }
}

process.exit(ok ? 0 : 1);