import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import {
  sha384OfBuffer,
  verifyWasmIntegrity,
  loadWasmManifest,
} from '../../src/backends/wasm/integrity.js';

/**
 * Integrity test for matrix's copy of the WASM SHA-384 manifest mechanism.
 *
 * Mirrors functions/tests/security/wasm-integrity.test.ts. matrix can't
 * import the helper from functions (functions depends on matrix, that
 * would create a cycle), so matrix has its own copy at
 * matrix/src/backends/wasm/integrity.ts — and therefore needs its own
 * regression test to lock the contract in.
 *
 * The tests construct a temp dir with:
 *   - fake.wasm  (some bytes — not a real WASM module, that's fine; the
 *                 integrity check operates on the buffer hash)
 *   - wasm-manifest.json  (records the canonical sha384 for fake.wasm)
 *
 * Then verify:
 *   1. Untampered buffer matches  → resolves
 *   2. Tampered buffer fails the check  → throws
 *   3. Manifest loader returns the parsed JSON
 *   4. Missing manifest soft-warns by default but fails closed with required
 */

let dir = '';
const original = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0xde, 0xad]);
const wasmPath = () => join(dir, 'fake.wasm');

describe('matrix wasm integrity (SHA-384 manifest)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'mathts-matrix-int-'));
    writeFileSync(wasmPath(), original);
    const expected = await sha384OfBuffer(original);
    writeFileSync(
      join(dir, 'wasm-manifest.json'),
      JSON.stringify({ 'fake.wasm': expected }, null, 2)
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads the sibling manifest', async () => {
    const m = await loadWasmManifest(wasmPath());
    expect(m).not.toBeNull();
    expect(m!['fake.wasm']).toMatch(/^sha384-/);
  });

  it('accepts an untampered buffer', async () => {
    await expect(verifyWasmIntegrity(original, wasmPath())).resolves.toBeUndefined();
  });

  it('rejects a tampered buffer', async () => {
    const tampered = new Uint8Array(original);
    tampered[5] ^= 0xff;
    await expect(verifyWasmIntegrity(tampered, wasmPath())).rejects.toThrow(
      /WASM integrity check failed/
    );
  });

  it('soft-warns and continues when no manifest is present', async () => {
    const noManifestDir = mkdtempSync(join(tmpdir(), 'mathts-matrix-noman-'));
    try {
      const p = join(noManifestDir, 'orphan.wasm');
      writeFileSync(p, original);
      await expect(verifyWasmIntegrity(original, p)).resolves.toBeUndefined();
    } finally {
      rmSync(noManifestDir, { recursive: true, force: true });
    }
  });

  it('fails closed when {required: true} and manifest is missing', async () => {
    const noManifestDir = mkdtempSync(join(tmpdir(), 'mathts-matrix-req-'));
    try {
      const p = join(noManifestDir, 'orphan.wasm');
      writeFileSync(p, original);
      await expect(verifyWasmIntegrity(original, p, { required: true })).rejects.toThrow(
        /no manifest/
      );
    } finally {
      rmSync(noManifestDir, { recursive: true, force: true });
    }
  });

  it('soft-returns when the manifest exists but lacks an entry for this file', async () => {
    // Manifest is present (passed explicitly) but has no key for the file →
    // non-required path returns without throwing.
    await expect(
      verifyWasmIntegrity(original, wasmPath(), { manifest: { 'other.wasm': 'sha384-xyz' } })
    ).resolves.toBeUndefined();
  });

  it('fails closed when {required: true} and the manifest lacks an entry', async () => {
    await expect(
      verifyWasmIntegrity(original, wasmPath(), {
        manifest: { 'other.wasm': 'sha384-xyz' },
        required: true,
      })
    ).rejects.toThrow(/no entry for/);
  });

  it('uses an explicitly supplied manifest (manifest option short-circuits disk load)', async () => {
    const expected = await sha384OfBuffer(original);
    await expect(
      verifyWasmIntegrity(original, wasmPath(), { manifest: { 'fake.wasm': expected } })
    ).resolves.toBeUndefined();
  });
});

/**
 * The integrity helpers branch on `process.versions?.node` to pick the Node
 * vs browser code path. Under vitest's node env only the Node arm runs. Here we
 * stub `process` so the helpers take the BROWSER arm (crypto.subtle.digest +
 * btoa for hashing, fetch for the manifest). Node 24 provides a WebCrypto
 * `crypto.subtle` and `btoa` globally, so the browser hashing path produces the
 * same digest — we assert Node and browser hashes agree.
 */
describe('matrix wasm integrity — browser code paths (process spoofed)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sha384OfBuffer browser path (crypto.subtle + btoa) matches the Node digest', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const nodeDigest = await sha384OfBuffer(bytes);
    // Force the browser arm: process.versions.node must be undefined.
    vi.stubGlobal('process', { ...process, versions: { ...process.versions, node: undefined } });
    const browserDigest = await sha384OfBuffer(bytes);
    expect(browserDigest).toBe(nodeDigest);
    expect(browserDigest).toMatch(/^sha384-/);
  });

  it('loadWasmManifest browser path fetches and parses the manifest JSON', async () => {
    const manifest = { 'x.wasm': 'sha384-abc' };
    vi.stubGlobal('process', { ...process, versions: { ...process.versions, node: undefined } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => manifest }) as unknown as Response)
    );
    const m = await loadWasmManifest('/some/path/x.wasm');
    expect(m).toEqual(manifest);
  });

  it('loadWasmManifest browser path returns null on a non-ok fetch', async () => {
    vi.stubGlobal('process', { ...process, versions: { ...process.versions, node: undefined } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as unknown as Response));
    const m = await loadWasmManifest('/missing/path/y.wasm');
    expect(m).toBeNull();
  });
});
