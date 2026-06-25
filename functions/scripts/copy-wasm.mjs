/**
 * Post-build step: co-locate the wasm artifact inside the published `functions`
 * package so WasmLoader can resolve it package-relative (dist/wasm/), in both
 * the monorepo and the installed layout. Without this the loader fell back to
 * JS because the wasm was never bundled.
 *
 * Source: <repo>/lib/wasm/mathts.wasm  (Rust backend, built by `npm run build:wasm:rust`)
 *         + wasm-manifest.json (SHA-384 integrity, checked at load).
 * Dest:   functions/dist/wasm/
 *
 * If the wasm hasn't been built, this is a no-op (consumers use the JS fallback).
 */
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // functions/scripts
const pkgRoot = dirname(here); // functions/
const repoRoot = dirname(pkgRoot); // mathts/
const srcDir = join(repoRoot, 'lib', 'wasm');
const outDir = join(pkgRoot, 'dist', 'wasm');

const files = ['mathts.wasm', 'wasm-manifest.json'];
const srcWasm = join(srcDir, 'mathts.wasm');
if (!existsSync(srcWasm)) {
  console.warn(
    `[copy-wasm] Rust wasm not built at ${srcWasm} — run \`npm run build:wasm:rust\` first. ` +
      `Skipping; consumers will use the JS fallback.`,
  );
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
let copied = 0;
for (const f of files) {
  const src = join(srcDir, f);
  if (existsSync(src)) {
    copyFileSync(src, join(outDir, f));
    copied++;
  }
}
console.log(`[copy-wasm] copied ${copied} file(s) to ${outDir}`);
