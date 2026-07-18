/**
 * Packaged `.wasm` artifact resolution.
 *
 * `resolvePackagedWasm` and `defaultWasmLocation` are consolidated in
 * `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`) — shared
 * byte-for-byte with matrix (see docs/Architecture/duplicate-symbols.json). Each
 * caller injects its own `import.meta.url`, so resolution stays relative to this
 * package. `resolveBrowserWasm` is functions-specific (the browser HEAD-probe
 * walk-up) and stays local.
 */

export { resolvePackagedWasm, defaultWasmLocation } from '@danielsimonjr/mathts-core/internal';

/**
 * Browser counterpart to `resolvePackagedWasm`: mirrors its Node `existsSync`
 * walk-up, but since browsers have no filesystem, existence is probed with a
 * `fetch(..., { method: 'HEAD' })` at each candidate URL.
 *
 * Root cause (2026-07-13 WASM-dead-in-browser investigation): the browser loader
 * previously took a SINGLE relative-URL guess — `./wasm/<file>` next to the
 * running module. That guess is only correct when the executing module and the
 * wasm binary are literal siblings post-bundling (tsup's single-file
 * `dist/index.js` next to `dist/wasm/`). Any other layout — including this repo's
 * own `*.browser.test.ts` harness, which runs directly against unbundled `src/`
 * via Vite — resolves to a URL that 404s, so the whole WASM tier silently fell
 * back to JS for every browser consumer.
 *
 * This walks up from the calling module's URL (same two relative shapes Node
 * checks: `wasm/<file>` and `dist/wasm/<file>`) and returns the first candidate
 * that responds ok to a HEAD request. Falls back to the original single-hop guess
 * if nothing is found within 8 levels.
 */
export async function resolveBrowserWasm(metaUrl: string, wasmFile: string): Promise<string> {
  let dir = new URL('.', metaUrl);
  for (let depth = 0; depth < 8; depth++) {
    const candidates = [new URL(`wasm/${wasmFile}`, dir), new URL(`dist/wasm/${wasmFile}`, dir)];
    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate.href, { method: 'HEAD' });
        if (res.ok) return candidate.href;
      } catch {
        // Network error / candidate unreachable — try the next one.
      }
    }
    const parent = new URL('../', dir);
    if (parent.href === dir.href) break;
    dir = parent;
  }
  return new URL(`./wasm/${wasmFile}`, metaUrl).href;
}
