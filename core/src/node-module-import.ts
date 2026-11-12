/**
 * Runtime `import()` with a non-literal module specifier so browser bundlers
 * (esbuild `platform: 'neutral'`, Vite, etc.) do not try to resolve Node
 * built-ins from reachable ESM graph roots.
 */
export function importModule(specifier: string): Promise<Record<string, unknown>> {
  return import(specifier) as Promise<Record<string, unknown>>;
}
