/**
 * Post-build step: co-locate the wasm artifacts inside the published `functions`
 * package so WasmLoader can resolve them package-relative (dist/wasm/), in both
 * the monorepo and the installed layout. Without this the loader fell back to
 * JS because the wasm was never bundled.
 *
 * AssemblyScript is the sole WASM backend. The functions loader loads the
 * AssemblyScript binary (`mathts-as.wasm`); the legacy native WASM toolchain
 * was removed (migration complete 2026-06-26).
 *
 * Sources:
 *   AS  : <repo>/matrix/dist/wasm/mathts-as.wasm  (built by `npm run build:wasm`,
 *         co-located by matrix/scripts/copy-wasm.mjs — the same artifact matrix uses)
 *         fallback: <repo>/assembly/build/mathts.wasm
 * Dest:   functions/dist/wasm/  (+ a regenerated SHA-384 wasm-manifest.json
 *         covering the copied binary — verified at load).
 *
 * A missing AS wasm FAILS the build, for the reason given in
 * matrix/scripts/copy-wasm.mjs: a warn-and-exit-0 let Turbo cache a wasm-less dist.
 */
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // functions/scripts
const pkgRoot = dirname(here); // functions/
const repoRoot = dirname(pkgRoot); // mathts/
const outDir = join(pkgRoot, 'dist', 'wasm');

// AS binary source: prefer the matrix-co-located artifact (the one matrix ships
// and loads), fall back to the raw AssemblyScript build output.
const asCandidates = [
  join(repoRoot, 'matrix', 'dist', 'wasm', 'mathts-as.wasm'),
  join(repoRoot, 'assembly', 'build', 'mathts.wasm'),
];
const asSrc = asCandidates.find(existsSync) ?? null;

if (!asSrc) {
  console.error(
    `[copy-wasm] AS wasm not found (looked in matrix/dist/wasm + assembly/build). ` +
      `Build through turbo (\`bun run build\` from the repo root) or run ` +
      `\`bun run build:wasm\` first.`,
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(asSrc, join(outDir, 'mathts-as.wasm'));
const copied = ['mathts-as.wasm'];

// Regenerate a SHA-384 manifest covering exactly the binaries we copied, so
// verifyWasmIntegrity passes for whichever one the loader selects.
const manifest = {};
for (const name of copied) {
  const buf = readFileSync(join(outDir, name));
  manifest[name] = `sha384-${createHash('sha384').update(buf).digest('base64')}`;
}
writeFileSync(join(outDir, 'wasm-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(
  `[copy-wasm] copied ${copied.join(', ')} to ${outDir}; manifest sha384 written (${copied.length})`,
);
