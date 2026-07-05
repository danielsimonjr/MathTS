/**
 * Robustly locate a packaged `.wasm` artifact across both the monorepo-source
 * layout and the published-package layout (Node only).
 *
 * The historical loader hard-coded `../../../lib/wasm/<file>` relative to
 * `import.meta.url`, which only resolved correctly for the monorepo source
 * layout and pointed outside the package once published — so `functions` never
 * loaded the wasm and always fell back to JS. This walks up from the calling
 * module's directory probing `<dir>/wasm/<file>` and `<dir>/dist/wasm/<file>`
 * at each level, matching bundled dist, unbundled dist, and monorepo source.
 *
 * Mirrors matrix/src/backends/wasm/resolve.ts.
 *
 * @returns absolute path to the artifact, or `null` if not found.
 */
export async function resolvePackagedWasm(
  metaUrl: string,
  wasmFile: string
): Promise<string | null> {
  const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
  if (!isNode) return null;

  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const { existsSync } = await import('node:fs');

  let dir = dirname(fileURLToPath(metaUrl));
  for (let depth = 0; depth < 8; depth++) {
    const candidates = [join(dir, 'wasm', wasmFile), join(dir, 'dist', 'wasm', wasmFile)];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Canonical fallback location for the packaged wasm when {@link resolvePackagedWasm}
 * finds nothing: `<packageRoot>/dist/wasm/<wasmFile>`, with the package root found
 * by walking up from `metaUrl` to the nearest `package.json`. This replaces the
 * historical `../../../lib/wasm/<file>` fabrication, which was only correct for the
 * pre-bundling source layout — from a bundled `dist/` it resolved OUTSIDE the repo
 * (the misleading `…/Github/lib/wasm/…` ENOENTs), and `<repo-root>/lib/wasm` no
 * longer exists in any layout (asc outputs to `assembly/build/`; package builds copy
 * to `dist/wasm/`). The returned path is where the binary SHOULD be, so the
 * missing-binary warning tells the user exactly what to build.
 *
 * In browser mode (no filesystem) it returns the bundle-relative `./wasm/<file>`
 * URL — correct for a served `dist/`, which is the only layout browsers see.
 */
export async function defaultWasmLocation(
  metaUrl: string,
  wasmFile: string,
  opts?: { browser?: boolean }
): Promise<string> {
  if (opts?.browser) {
    return new URL(`./wasm/${wasmFile}`, metaUrl).href;
  }
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const { existsSync } = await import('node:fs');

  let dir = dirname(fileURLToPath(metaUrl));
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(join(dir, 'package.json'))) {
      return join(dir, 'dist', 'wasm', wasmFile);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // No package root found (exotic embedding): fall back to meta-relative wasm/.
  return join(dirname(fileURLToPath(metaUrl)), 'wasm', wasmFile);
}
