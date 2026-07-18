/**
 * WASM integrity verification — SHA-384 manifest check.
 *
 * The build pipeline writes a JSON manifest beside the .wasm artefact:
 *
 *   {
 *     "mathjs.wasm":    "sha384-<base64-of-binary-digest>",
 *     "mathjs-as.wasm": "sha384-<base64-of-binary-digest>"
 *   }
 *
 * At load time the runtime hashes the freshly read buffer with SHA-384
 * and compares against the manifest. A mismatch throws — preventing
 * silent code-injection if the .wasm artefact is tampered with on disk
 * or in transit (e.g. a CDN/MITM compromise).
 *
 * Browser path uses `crypto.subtle.digest('SHA-384', buf)`.
 * Node path uses `crypto.createHash('sha384').update(buf).digest()`.
 *
 * If the manifest is missing or has no entry for the given file, we
 * emit a console warning and fall through. This keeps existing
 * unsigned builds usable while making signed builds tamper-evident.
 */

// `WasmManifest` consolidated onto `@danielsimonjr/mathts-core/internal`'s
// byte-identical definition, formerly duplicated with
// `matrix/src/backends/wasm/integrity.ts` (see
// docs/Architecture/duplicate-symbols.json).
import type { WasmManifest } from '@danielsimonjr/mathts-core/internal';
export type { WasmManifest };

const ALGO = 'sha384';

/**
 * Compute the SHA-384 digest of a buffer and return base64 encoding,
 * prefixed with "sha384-" to match SRI conventions.
 */
export async function sha384OfBuffer(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

  let digest: Uint8Array;
  if (isNode) {
    const { createHash } = await import('crypto');
    const hash = createHash(ALGO);
    hash.update(bytes);
    digest = new Uint8Array(hash.digest());
  } else {
    // Browser / web worker — copy into a fresh ArrayBuffer so SharedArrayBuffer
    // backings are accepted by SubtleCrypto (which only takes ArrayBuffer).
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const out = await crypto.subtle.digest('SHA-384', copy);
    digest = new Uint8Array(out);
  }

  // Convert to base64 (works in both Node and browser).
  let binary = '';
  for (let i = 0; i < digest.length; i++) binary += String.fromCharCode(digest[i]);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(digest).toString('base64');
  return `sha384-${b64}`;
}

/**
 * Load the manifest sitting next to the .wasm artefact.
 *
 * @param wasmPath Resolved path or URL to the .wasm file.
 * @returns parsed manifest, or `null` if the manifest cannot be located.
 */
export async function loadWasmManifest(wasmPath: string): Promise<WasmManifest | null> {
  const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
  const manifestPath = wasmPath.replace(/[^/\\]+$/, 'wasm-manifest.json');

  try {
    if (isNode) {
      const fs = await import('fs');
      const { promisify } = await import('util');
      const readFile = promisify(fs.readFile);
      const text = await readFile(manifestPath, 'utf8');
      return JSON.parse(text) as WasmManifest;
    } else {
      const res = await fetch(manifestPath);
      if (!res.ok) return null;
      return (await res.json()) as WasmManifest;
    }
  } catch {
    return null;
  }
}

/**
 * Verify a freshly loaded WASM buffer against the manifest.
 *
 * @throws Error if the buffer's SHA-384 differs from the manifest entry.
 */
export async function verifyWasmIntegrity(
  buffer: ArrayBuffer | Uint8Array,
  wasmPath: string,
  options: { manifest?: WasmManifest | null; required?: boolean } = {}
): Promise<void> {
  const fileName = wasmPath.split(/[/\\]/).pop() || wasmPath;
  const manifest =
    options.manifest !== undefined ? options.manifest : await loadWasmManifest(wasmPath);

  if (!manifest) {
    if (options.required) {
      throw new Error(
        `WASM integrity check failed: no manifest at sibling of "${wasmPath}" (required)`
      );
    }
    // Soft warn so unsigned builds keep working.
    if (typeof console !== 'undefined') {
      console.warn(
        `[wasm-integrity] no manifest found beside "${wasmPath}"; ` +
          'skipping SHA-384 verification (set options.required=true to fail closed)'
      );
    }
    return;
  }

  const expected = manifest[fileName];
  if (!expected) {
    if (options.required) {
      throw new Error(`WASM integrity check failed: manifest has no entry for "${fileName}"`);
    }
    return;
  }

  const actual = await sha384OfBuffer(buffer);
  if (actual !== expected) {
    throw new Error(
      `WASM integrity check failed for "${fileName}": ` + `expected ${expected}, got ${actual}`
    );
  }
}
