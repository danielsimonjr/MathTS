#!/usr/bin/env node
/**
 * Inject `/// <reference types="@webgpu/types" />` into an emitted `.d.ts`.
 *
 * Why this exists: packages that expose WebGPU types (`GPUDevice`, `GPUBuffer`,
 * …) in their public surface emit `.d.ts` files that reference those globals.
 * `@webgpu/types` is a *scoped* package, NOT a DefinitelyTyped `@types/*` one,
 * so TypeScript does **not** auto-include it — a consumer would get
 * `Cannot find name 'GPUDevice'`. A triple-slash reference in the source is
 * stripped by tsup's dts bundler, so we re-add it to the build output.
 *
 * Usage: node tools/inject-webgpu-types-ref.mjs <path/to/index.d.ts>
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REF = '/// <reference types="@webgpu/types" />';

const target = process.argv[2];
if (!target) {
  console.error('usage: inject-webgpu-types-ref.mjs <file.d.ts>');
  process.exit(2);
}
if (!existsSync(target)) {
  console.error(`inject-webgpu-types-ref: no such file: ${target}`);
  process.exit(1);
}

const src = readFileSync(target, 'utf8');

if (src.includes(REF)) {
  process.exit(0); // already present — idempotent
}

// Only inject where it is actually needed.
if (!/\bGPU[A-Z]\w*/.test(src)) {
  process.exit(0);
}

writeFileSync(target, `${REF}\n${src}`);
console.log(`inject-webgpu-types-ref: added to ${target}`);
