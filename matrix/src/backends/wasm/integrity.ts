/**
 * WASM integrity verification - SHA-384 manifest check.
 *
 * The shared runtime logic (`sha384OfBuffer` / `loadWasmManifest` /
 * `verifyWasmIntegrity`) is consolidated in
 * `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`) so `matrix`
 * and `functions` build on ONE copy — see docs/Architecture/duplicate-symbols.json.
 * matrix can't import from functions (that would invert the dep edge and create a
 * cycle), but both packages depend on core, so core/internal is a shared home
 * reachable from both without a cycle. This module re-exports it (plus the
 * `WasmManifest` type) to preserve the local `./integrity.js` import surface.
 *
 * SECURITY INVARIANT (CLAUDE.md #1): the SHA-384 hash-and-compare-before-
 * instantiate is unchanged — it now lives in core, byte-for-byte. Guarded by
 * matrix/tests/security/wasm-integrity.test.ts.
 */

export {
  sha384OfBuffer,
  loadWasmManifest,
  verifyWasmIntegrity,
  type WasmManifest,
} from '@danielsimonjr/mathts-core/internal';
