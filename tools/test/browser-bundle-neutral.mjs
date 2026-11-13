#!/usr/bin/env node
/**
 * esbuild `platform: 'neutral'` bundle smoke for browser-facing package entries.
 * Fails when a static or literal dynamic import pulls an unresolved Node built-in.
 */
import { buildSync } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './workspaces.mjs';

/** Each bundle goes to a new temporary folder; the script writes no file in the repository. */
const OUT = mkdtempSync(join(tmpdir(), 'mathts-neutral-'));

/** @type {{ label: string, importLine: string }[]} */
const CASES = [
  {
    label: 'core',
    importLine: "import { Complex } from '@danielsimonjr/mathts-core';",
  },
  {
    label: 'matrix',
    importLine: "import { DenseMatrix } from '@danielsimonjr/mathts-matrix';",
  },
  {
    label: 'functions-evaluate-subpath',
    importLine: "import { evaluate } from '@danielsimonjr/mathts-functions/evaluate';",
  },
  {
    label: 'functions-barrel-evaluate',
    importLine: "import { evaluate } from '@danielsimonjr/mathts-functions';",
  },
];

/**
 * Keep the entry imports referenced, so the bundle keeps the imported modules.
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
for (const { label, importLine } of CASES) {
  const outfile = join(OUT, `mathts-neutral-${label}.js`);
  try {
    buildSync({
      stdin: {
        contents: neutralEntrySource(importLine),
        resolveDir: repoRoot,
        sourcefile: `neutral-${label}.mjs`,
        loader: 'js',
      },
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
rmSync(OUT, { recursive: true, force: true });
process.exit(failed > 0 ? 1 : 0);
