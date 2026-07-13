// Post-build step for @danielsimonjr/mathts-workerpool.
//
// tsup's dts step (rollup-plugin-dts) does NOT preserve triple-slash
// `/// <reference path="..." />` directives from src/index.ts when bundling
// dist/index.d.ts — it silently drops them, leaving bare `from 'workerpool'`
// imports with nothing backing them for a published consumer (see
// src/workerpool.d.ts's doc comment for the full root-cause writeup).
//
// This script ships a real fix for that: copy the ambient shim into dist/ as
// a standalone file, then prepend a triple-slash reference to dist/index.d.ts
// pointing at it. Consumers with `skipLibCheck: false` get real types for
// `workerpool` without needing a tsconfig `paths` override of their own.
//
// IMPORTANT: this must run strictly AFTER tsup's dts step, not via tsup's
// `--onSuccess` hook — that fires right after the JS (ESM) build, before the
// separate async DTS build even starts, and the DTS step's own output-folder
// handling clobbers anything written in between. Invoke this via `&&` after
// the whole `tsup ... --dts` command in package.json's `build` script.
import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcShim = path.join(pkgRoot, 'src', 'workerpool.d.ts');
const distShim = path.join(pkgRoot, 'dist', 'workerpool.d.ts');
const distIndex = path.join(pkgRoot, 'dist', 'index.d.ts');

if (!existsSync(srcShim)) {
  throw new Error(`postbuild: expected ambient shim at ${srcShim}`);
}
if (!existsSync(distIndex)) {
  throw new Error(
    `postbuild: expected ${distIndex} to already exist (run after tsup's dts step, not via --onSuccess)`
  );
}
copyFileSync(srcShim, distShim);

const reference = '/// <reference path="./workerpool.d.ts" />\n';
const current = readFileSync(distIndex, 'utf8');
if (!current.startsWith(reference)) {
  writeFileSync(distIndex, reference + current);
}
