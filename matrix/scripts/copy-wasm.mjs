/**
 * Post-build step: co-locate the AssemblyScript WASM artifact inside the
 * published matrix package so the loaders can resolve it package-relative
 * (see src/backends/wasm/resolve.ts). Also generates a co-located SHA-384
 * integrity manifest so verifyWasmIntegrity passes for the shipped binary.
 *
 * Source: <repo>/assembly/build/mathts.wasm  (built by `npm run build:wasm`)
 * Dest:   matrix/dist/wasm/mathts-as.wasm  (+ wasm-manifest.json)
 *
 * A missing AS wasm FAILS the build. It used to warn and exit 0, which let Turbo
 * cache a wasm-less dist and replay it on every later build, even after the wasm
 * existed (the tests then failed on the absent artifact). turbo.json now orders
 * this build after @danielsimonjr/mathts-wasm#build, so a missing binary here
 * means that build did not produce one. The runtime JS fallback for consumers is
 * unaffected; this only stops a package from being built without its binary.
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
  console.error(
    `[copy-wasm] AS wasm not built at ${srcWasm}. Build through turbo ` +
      `(\`bun run build\` from the repo root) or run \`bun run build:wasm\` first.`,
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(srcWasm, destWasm);

const buf = readFileSync(destWasm);
const digest = createHash('sha384').update(buf).digest('base64');
writeFileSync(destManifest, JSON.stringify({ 'mathts-as.wasm': `sha384-${digest}` }, null, 2) + '\n');

console.log(
  `[copy-wasm] ${srcWasm} -> ${destWasm} (${buf.length} bytes); manifest sha384 written`,
);
