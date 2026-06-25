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
  wasmFile: string,
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
