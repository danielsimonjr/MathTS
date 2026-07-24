/**
 * Packaged `.wasm` artifact resolution.
 *
 * `resolvePackagedWasm` and `defaultWasmLocation` are consolidated in
 * `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`) — shared
 * byte-for-byte with functions (see docs/Architecture/duplicate-symbols.json).
 * matrix can't import from functions (cycle), but both depend on core, so
 * core/internal is a shared home reachable from both without a cycle. Each caller
 * injects its own `import.meta.url`, so resolution stays relative to this package.
 */

export { resolvePackagedWasm, defaultWasmLocation } from '@danielsimonjr/mathts-core/internal';
