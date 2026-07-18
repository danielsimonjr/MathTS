/**
 * WASM integrity verification — SHA-384 manifest check.
 *
 * The shared runtime logic (`sha384OfBuffer` / `loadWasmManifest` /
 * `verifyWasmIntegrity`) is now consolidated in
 * `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`) so `functions`
 * and `matrix` build on ONE copy — see docs/Architecture/duplicate-symbols.json.
 * This module re-exports it (plus the `WasmManifest` type) to preserve the local
 * `./integrity.js` import surface used by WasmLoader.ts.
 *
 * SECURITY INVARIANT (CLAUDE.md #1): the SHA-384 hash-and-compare-before-
 * instantiate is unchanged — it now lives in core, byte-for-byte. Guarded by
 * functions/tests/security/wasm-integrity.test.ts.
 */

export {
  sha384OfBuffer,
  loadWasmManifest,
  verifyWasmIntegrity,
  type WasmManifest,
} from '@danielsimonjr/mathts-core/internal';
