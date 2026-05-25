import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
});
