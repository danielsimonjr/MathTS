#!/usr/bin/env node
/**
 * esbuild `platform: 'neutral'` bundle smoke for browser-facing package entries.
 * Fails when a static or literal dynamic import pulls an unresolved Node built-in.
 */
import { buildSync } from 'esbuild';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from './workspaces.mjs';

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

/**
 * Keep esbuild entry imports referenced so oxlint does not flag generated fixtures.
 * @param {string} importLine
 */
function neutralEntrySource(importLine) {
  const named = importLine.match(/import\s*\{([^}]+)\}\s*from/);
  if (named) {
    const bindings = named[1].split(',').map((part) => {
      const bits = part.trim().split(/\s+as\s+/i);
      return bits[bits.length - 1].trim();
    });
    return `${importLine}\nvoid ${bindings.join(' + ')};\n`;
  }
  return `${importLine}\n`;
}

let failed = 0;
for (const { label, importLine, outfile } of CASES) {
  const entry = join(FIXTURES, `neutral-${label}.mjs`);
  writeFileSync(entry, neutralEntrySource(importLine));
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
    });
    const bytes = statSync(outfile).size;
    const bundled = readFileSync(outfile, 'utf8');
    const staticNode = bundled.match(
      /(?:from|import)\s*["'](?:node:|fs|crypto|util|path|os|module|worker_threads)["']/
    );
    if (staticNode) {
      failed++;
      console.error(`FAIL ${label}: static Node builtin in bundle (${staticNode[0]})`);
      continue;
    }
    console.log(`ok   ${label}: neutral bundle ${bytes} bytes`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${label}:`);
    for (const e of err.errors ?? []) console.error(`  ${e.text}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
