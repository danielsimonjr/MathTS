#!/usr/bin/env node
/**
 * esbuild `platform: 'neutral'` bundle smoke for browser-facing package entries.
 * Fails when a static or literal dynamic import pulls an unresolved Node built-in.
 */
import { buildSync } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from './workspaces.mjs';

// workerpool's npm entry still embeds Node paths; browser apps load `dist/workerpool.js`
// and ship `dist/worker.js` separately. Bundling stays honest about that boundary.
const BROWSER_EXTERNALS = ['workerpool', 'workerpool/wasm'];

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
mkdirSync(FIXTURES, { recursive: true });

/** @type {{ label: string, importLine: string, outfile: string }[]} */
const CASES = [
  {
    label: 'core',
    importLine: "import { Complex } from '@danielsimonjr/mathts-core';",
    outfile: '/tmp/mathts-neutral-core.js',
  },
  {
    label: 'matrix',
    importLine: "import { DenseMatrix } from '@danielsimonjr/mathts-matrix';",
    outfile: '/tmp/mathts-neutral-matrix.js',
  },
  {
    label: 'functions-evaluate-subpath',
    importLine: "import { evaluate } from '@danielsimonjr/mathts-functions/evaluate';",
    outfile: '/tmp/mathts-neutral-functions-evaluate.js',
  },
  {
    label: 'functions-barrel-evaluate',
    importLine: "import { evaluate } from '@danielsimonjr/mathts-functions';",
    outfile: '/tmp/mathts-neutral-functions-barrel.js',
  },
];

let failed = 0;
for (const { label, importLine, outfile } of CASES) {
  const entry = join(FIXTURES, `neutral-${label}.mjs`);
  writeFileSync(entry, `${importLine}\nvoid 0;\n`);
  try {
    buildSync({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      outfile,
      absWorkingDir: repoRoot,
      logLevel: 'silent',
      conditions: ['browser', 'import', 'default'],
      mainFields: ['browser', 'module', 'main'],
      external: BROWSER_EXTERNALS,
    });
    const bytes = statSync(outfile).size;
    console.log(`ok   ${label}: neutral bundle ${bytes} bytes`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${label}:`);
    for (const e of err.errors ?? []) console.error(`  ${e.text}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
