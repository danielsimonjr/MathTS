/**
 * Generate the SHA-384 integrity manifest for the built AssemblyScript WASM
 * artifacts. Run as the final step of `asbuild` so the manifest can never drift
 * from the binary it describes (drift caused every AS wasm load to fail
 * integrity → JS fallback, silently disabling acceleration and reddening the
 * live-load test suite).
 *
 * Writes build/wasm-manifest.json next to the artifacts it hashes.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'build');
const artifacts = ['mathts-debug.wasm', 'mathts.wasm'];

const manifest = {};
for (const name of artifacts) {
  const file = join(buildDir, name);
  if (!existsSync(file)) {
    console.warn(`[gen-wasm-manifest] missing ${file} — skipping`);
    continue;
  }
  manifest[name] = 'sha384-' + createHash('sha384').update(readFileSync(file)).digest('base64');
}

const out = join(buildDir, 'wasm-manifest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`[gen-wasm-manifest] wrote ${basename(out)} for ${Object.keys(manifest).join(', ')}`);
