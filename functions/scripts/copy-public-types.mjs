#!/usr/bin/env node
/** Copy `functions/types/*.d.ts` into `dist/types/` and fix consumer-relative imports in emitted d.ts. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(ROOT, 'types');
const outDir = join(ROOT, 'dist', 'types');
const bridge = join(ROOT, 'dist', 'typed', 'public-type-exports.d.ts');

mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(srcDir)) {
  if (!name.endsWith('.d.ts')) continue;
  copyFileSync(join(srcDir, name), join(outDir, name));
}

if (existsSync(bridge)) {
  const text = readFileSync(bridge, 'utf8').replaceAll('../../types/', '../types/');
  writeFileSync(bridge, text);
}
