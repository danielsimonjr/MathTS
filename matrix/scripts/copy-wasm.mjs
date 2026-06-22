/**
 * Post-build step: co-locate the AssemblyScript WASM artifact inside the
 * published matrix package so the loaders can resolve it package-relative
 * (see src/backends/wasm/resolve.ts). Also generates a co-located SHA-384
 * integrity manifest so verifyWasmIntegrity passes for the shipped binary.
 *
 * Source: <repo>/assembly/build/mathts.wasm  (built by `npm run build:wasm`)
 * Dest:   matrix/dist/wasm/mathts-as.wasm  (+ wasm-manifest.json)
 *
 * If the AS wasm hasn't been built, this is a no-op (consumers fall back to JS).
 */
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // matrix/scripts
const matrixRoot = dirname(here); // matrix/
const repoRoot = dirname(matrixRoot); // mathts/

const srcWasm = join(repoRoot, 'assembly', 'build', 'mathts.wasm');
const outDir = join(matrixRoot, 'dist', 'wasm');
const destWasm = join(outDir, 'mathts-as.wasm');
const destManifest = join(outDir, 'wasm-manifest.json');

if (!existsSync(srcWasm)) {
  console.warn(
    `[copy-wasm] AS wasm not built at ${srcWasm} — run \`npm run build:wasm\` first. ` +
      `Skipping; consumers will use the JS fallback.`,
  );
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(srcWasm, destWasm);

const buf = readFileSync(destWasm);
const digest = createHash('sha384').update(buf).digest('base64');
writeFileSync(destManifest, JSON.stringify({ 'mathts-as.wasm': `sha384-${digest}` }, null, 2) + '\n');

console.log(
  `[copy-wasm] ${srcWasm} -> ${destWasm} (${buf.length} bytes); manifest sha384 written`,
);
