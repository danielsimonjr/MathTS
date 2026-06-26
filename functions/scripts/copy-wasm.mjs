/**
 * Post-build step: co-locate the wasm artifacts inside the published `functions`
 * package so WasmLoader can resolve them package-relative (dist/wasm/), in both
 * the monorepo and the installed layout. Without this the loader fell back to
 * JS because the wasm was never bundled.
 *
 * As of the Rust→AS migration Phase 3a, the functions loader DEFAULTS to the
 * AssemblyScript binary (`mathts-as.wasm`); the Rust binary (`mathts.wasm`) is
 * still copied so `MATHTS_WASM_BACKEND=rust` and the Rust differential test
 * (tests/diff-wasm-rust.test.mjs) keep working until Phase 5 removes Rust.
 *
 * Sources:
 *   AS  : <repo>/matrix/dist/wasm/mathts-as.wasm  (built by `npm run build:wasm`,
 *         co-located by matrix/scripts/copy-wasm.mjs — the same artifact matrix uses)
 *         fallback: <repo>/assembly/build/mathts.wasm
 *   Rust: <repo>/lib/wasm/mathts.wasm             (built by `npm run build:wasm:rust`)
 * Dest:   functions/dist/wasm/  (+ a regenerated SHA-384 wasm-manifest.json
 *         covering whichever binaries were copied — verified at load).
 *
 * If a wasm hasn't been built, that binary is skipped (consumers use the JS
 * fallback). A missing AS binary is a warning, since AS is now the default.
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

// Rust binary source.
const rustSrc = join(repoRoot, 'lib', 'wasm', 'mathts.wasm');

mkdirSync(outDir, { recursive: true });

const copied = [];

if (asSrc) {
  const dest = join(outDir, 'mathts-as.wasm');
  copyFileSync(asSrc, dest);
  copied.push('mathts-as.wasm');
} else {
  console.warn(
    `[copy-wasm] AS wasm not found (looked in matrix/dist/wasm + assembly/build) — ` +
      `run \`npm run build:wasm\` first. The functions package defaults to AS; ` +
      `without it consumers fall back to JS.`,
  );
}

if (existsSync(rustSrc)) {
  copyFileSync(rustSrc, join(outDir, 'mathts.wasm'));
  copied.push('mathts.wasm');
} else {
  console.warn(
    `[copy-wasm] Rust wasm not built at ${rustSrc} — run \`npm run build:wasm:rust\` ` +
      `to enable MATHTS_WASM_BACKEND=rust. Skipping (AS default is unaffected).`,
  );
}

if (copied.length === 0) {
  console.warn('[copy-wasm] no wasm artifacts copied; consumers will use the JS fallback.');
  process.exit(0);
}

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
