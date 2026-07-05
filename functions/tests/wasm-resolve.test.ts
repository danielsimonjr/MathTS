/**
 * M2 regression: the AssemblyScript wasm must be co-located in dist/wasm and
 * resolvable package-relative (not via the old monorepo-only ../../../lib/wasm
 * path that broke once bundled/published). Requires `npm run build` first
 * (which runs scripts/copy-wasm.mjs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolvePackagedWasm, defaultWasmLocation } from '../src/wasm/resolve.js';

describe('packaged wasm resolution (functions copy)', () => {
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

describe('defaultWasmLocation — the fallback path when no packaged wasm exists (B-3)', () => {
  // The old fallback fabricated `../../../lib/wasm/<file>` relative to the LOADER
  // file — correct only for the pre-2026-06 source layout. From a bundled dist/
  // it resolved OUTSIDE the repo (observed: `…\Github\lib\wasm\mathts-as.wasm` in
  // the 2026-07-04 flake-hunt ENOENT), and `<repo-root>/lib/wasm` no longer exists
  // in ANY layout (asc outputs to assembly/build/; packages copy to dist/wasm/).
  // The replacement walks to the package root (package.json) and names the real
  // canonical location, so a missing-binary warning is actionable.
  it('points at <pkgRoot>/dist/wasm/<file> from a dist-bundled meta URL', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join, sep } = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const pkg = mkdtempSync(join(tmpdir(), 'wasmloc-'));
    try {
      writeFileSync(join(pkg, 'package.json'), '{"name":"x"}');
      mkdirSync(join(pkg, 'dist'), { recursive: true });
      const metaUrl = pathToFileURL(join(pkg, 'dist', 'index.js')).href;
      const loc = await defaultWasmLocation(metaUrl, 'mathts-as.wasm');
      expect(loc).toBe(join(pkg, 'dist', 'wasm', 'mathts-as.wasm'));
      expect(loc.split(sep)).not.toContain('lib');
    } finally {
      rmSync(pkg, { recursive: true, force: true });
    }
  });

  it('points at <pkgRoot>/dist/wasm/<file> from a deep source meta URL too', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const pkg = mkdtempSync(join(tmpdir(), 'wasmloc-'));
    try {
      writeFileSync(join(pkg, 'package.json'), '{"name":"x"}');
      mkdirSync(join(pkg, 'src', 'backends'), { recursive: true });
      const metaUrl = pathToFileURL(join(pkg, 'src', 'backends', 'WasmLoader.ts')).href;
      const loc = await defaultWasmLocation(metaUrl, 'mathts-as.wasm');
      expect(loc).toBe(join(pkg, 'dist', 'wasm', 'mathts-as.wasm'));
    } finally {
      rmSync(pkg, { recursive: true, force: true });
    }
  });

  it('browser mode returns the bundle-relative ./wasm/ URL (dist is what browsers see)', async () => {
    const loc = await defaultWasmLocation(
      'https://cdn.example/pkg/dist/index.js',
      'mathts-as.wasm',
      {
        browser: true,
      }
    );
    expect(loc).toBe('https://cdn.example/pkg/dist/wasm/mathts-as.wasm');
  });
});
