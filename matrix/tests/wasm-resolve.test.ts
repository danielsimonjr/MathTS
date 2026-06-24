/**
 * M2 regression: the AssemblyScript wasm must be co-located in dist/wasm and
 * resolvable package-relative (not via the old monorepo-only ../../../lib/wasm
 * path that broke once bundled/published). Requires `npm run build` first
 * (which runs scripts/copy-wasm.mjs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolvePackagedWasm } from '../src/backends/wasm/resolve.js';

describe('packaged wasm resolution (M2)', () => {
  it('resolves the co-located AS wasm to an existing file', async () => {
    const p = await resolvePackagedWasm(import.meta.url, 'mathts-as.wasm');
    expect(p, 'run `npm run build` in matrix/ first').toBeTruthy();
    expect(p).toMatch(/dist[\\/]wasm[\\/]mathts-as\.wasm$/);
    expect(existsSync(p as string)).toBe(true);
  });

  it('the resolved artifact is valid WebAssembly', async () => {
    const p = await resolvePackagedWasm(import.meta.url, 'mathts-as.wasm');
    const mod = await WebAssembly.compile(readFileSync(p as string));
    expect(mod).toBeInstanceOf(WebAssembly.Module);
  });

  it('returns null for a non-existent artifact (graceful)', async () => {
    expect(await resolvePackagedWasm(import.meta.url, 'does-not-exist.wasm')).toBeNull();
  });
});
