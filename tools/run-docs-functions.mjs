#!/usr/bin/env node
/**
 * Run `tools/generate-functions-reference.mjs` on Bun with the define that
 * tsdown injects at build time. Root `tsconfig.json` `paths` can still point
 * `@danielsimonjr/mathts-core` (and plot/workbook) at `src/`, where
 * `__PKG_VERSION__` is otherwise a free identifier (ReferenceError).
 *
 *   bun tools/run-docs-functions.mjs
 *   bun tools/run-docs-functions.mjs --check
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  process.execPath.includes('bun') ? process.execPath : 'bun',
  [
    '--tsconfig-override=tsconfig.base.json',
    '--define',
    '__PKG_VERSION__:"0.0.0-source"',
    'tools/generate-functions-reference.mjs',
    ...process.argv.slice(2),
  ],
  { cwd: repo, stdio: 'inherit' }
);
process.exit(result.status === null ? 1 : result.status);
