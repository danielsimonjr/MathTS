/**
 * WASM artifact availability check for the cross-package WASM test suites.
 *
 * Several suites under `tests/wasm/` exercise `WasmLoader`, which reads a
 * compiled `.wasm` binary from `lib/wasm/`. That binary is produced by
 * `npm run build:wasm` (AssemblyScript) or `npm run build:wasm:rust` and is
 * NOT committed to the repo. On a fresh checkout the binary is absent, so
 * those suites would fail with an opaque `ENOENT ... mathts.wasm`.
 *
 * To keep a fresh checkout's test run honest, suites that genuinely require
 * the artifact use {@link wasmArtifactAvailable} to switch to `describe.skip`
 * and emit a loud, single warning via {@link warnWasmArtifactsMissing} so a
 * contributor can tell an environmental skip from a real failure.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Path to the AssemblyScript WASM binary that `WasmLoader` loads by default
 * in Node. Mirrors `getDefaultWasmPath()` in
 * `matrix/src/backends/WasmLoader.ts` — kept relative-to-repo-root so the
 * check is independent of the test runner's current working directory.
 */
const WASM_BINARY_PATHS = [
  // Default (Rust-after-cutover) and AssemblyScript binary names.
  '../../lib/wasm/mathts.wasm',
  '../../lib/wasm/mathts-as.wasm',
].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));

/**
 * True when at least one compiled `.wasm` artifact is present on disk.
 * When false, WASM-dependent suites should skip rather than fail.
 */
export function wasmArtifactAvailable(): boolean {
  return WASM_BINARY_PATHS.some((p) => existsSync(p));
}

let warned = false;

/**
 * Emit a single loud warning explaining why WASM suites were skipped.
 * Safe to call from multiple suites — only the first call prints.
 *
 * @param skippedSuiteCount - number of suites being skipped by the caller
 */
export function warnWasmArtifactsMissing(skippedSuiteCount: number): void {
  if (warned) return;
  warned = true;
  console.warn(
    `\n[WASM] WASM artifacts not built — run \`npm run build:wasm\` ` +
      `(or \`npm run build:wasm:rust\`). ` +
      `Skipping ${skippedSuiteCount} WASM-dependent test suite(s) ` +
      `(lib/wasm/mathts.wasm is absent).\n`
  );
}
