/**
 * WASM artifact availability check for the cross-package WASM test suites.
 *
 * The suites under `tests/wasm/` exercise matrix's `WasmLoader`, whose default
 * `load()` resolves the AssemblyScript binary package-relative — in this repo
 * `matrix/dist/wasm/mathts-as.wasm`, the co-located copy of the raw build output
 * `assembly/build/mathts.wasm` made by matrix's build. The build GUARANTEES that
 * binary (turbo orders `matrix#build` after the wasm build, and matrix's
 * copy-wasm step exits non-zero when it is missing), so its absence means a
 * broken or skipped build — not an environment to tolerate.
 *
 * Suites that need it may still gate on {@link wasmArtifactAvailable} (so a
 * missing binary does not cascade into a wall of opaque `ENOENT`s), but must
 * pair that with a non-skipping presence test that fails with
 * {@link WASM_ARTIFACT_MISSING_MESSAGE}, so absence is a failure, never a
 * silent skip.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Path to the AssemblyScript binary that matrix's `WasmLoader.load()` resolves
 * by default in Node (`resolvePackagedWasm` → `<matrix>/dist/wasm/`). Kept
 * relative to this file so the check is independent of the runner's cwd.
 */
export const WASM_ARTIFACT_PATH = fileURLToPath(
  new URL('../../matrix/dist/wasm/mathts-as.wasm', import.meta.url)
);

/** Actionable failure message for a missing binary (see the module doc). */
export const WASM_ARTIFACT_MISSING_MESSAGE =
  `AS wasm binary not found at ${WASM_ARTIFACT_PATH}. ` +
  'The build guarantees it — run `bun run build` from the repo root.';

/** True when the AS binary matrix's `WasmLoader` loads by default is on disk. */
export function wasmArtifactAvailable(): boolean {
  return existsSync(WASM_ARTIFACT_PATH);
}

let warned = false;

/**
 * Emit a single loud warning explaining why WASM suites were skipped.
 * Safe to call from multiple suites — only the first call prints. (The skip is
 * never the whole story: the presence test described above fails the run.)
 *
 * @param skippedSuiteCount - number of suites being skipped by the caller
 */
export function warnWasmArtifactsMissing(skippedSuiteCount: number): void {
  if (warned) return;
  warned = true;
  console.warn(
    `\n[WASM] ${WASM_ARTIFACT_MISSING_MESSAGE} ` +
      `Skipping ${skippedSuiteCount} WASM-dependent test suite(s).\n`
  );
}
