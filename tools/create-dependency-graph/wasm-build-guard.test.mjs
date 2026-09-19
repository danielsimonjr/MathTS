import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWasmBuildOutputs } from './create-dependency-graph.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundle = join(repoRoot, 'functions', 'dist', 'wasm', 'mathts-as.wasm');

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'wasm-guard-'));
  mkdirSync(join(root, 'functions', 'dist', 'wasm'), { recursive: true });
  return root;
}

test('fails when the WASM bundle is missing', () => {
  const root = tempRoot();
  try {
    const msg = checkWasmBuildOutputs(root);
    assert.ok(msg, 'expected an error message');
    assert.match(msg, /missing or unreadable/);
    assert.match(msg, /No files were written/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails when the file is not a valid wasm module', () => {
  const root = tempRoot();
  try {
    writeFileSync(join(root, 'functions', 'dist', 'wasm', 'mathts-as.wasm'), 'not wasm');
    assert.match(checkWasmBuildOutputs(root) ?? '', /missing or unreadable/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails when the module lacks the AssemblyScript __new export', () => {
  const root = tempRoot();
  try {
    // Minimal empty wasm module: magic + version, no exports.
    const empty = Uint8Array.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    writeFileSync(join(root, 'functions', 'dist', 'wasm', 'mathts-as.wasm'), empty);
    assert.match(checkWasmBuildOutputs(root) ?? '', /no `__new` export/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('passes on the real built bundle', { skip: !existsSync(bundle) && 'bundle not built' }, () => {
  const root = tempRoot();
  try {
    copyFileSync(bundle, join(root, 'functions', 'dist', 'wasm', 'mathts-as.wasm'));
    assert.equal(checkWasmBuildOutputs(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
