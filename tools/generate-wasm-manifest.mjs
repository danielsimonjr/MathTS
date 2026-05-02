#!/usr/bin/env node
/**
 * generate-wasm-manifest.mjs
 *
 * Walk a directory, hash every *.wasm file with SHA-384, and write a
 * `wasm-manifest.json` that pairs filename -> "sha384-<base64>".
 *
 * Usage:
 *   node tools/generate-wasm-manifest.mjs <dir-with-wasm-files> [...moreDirs]
 *
 * Example:
 *   node tools/generate-wasm-manifest.mjs assembly/build functions/lib/wasm
 *
 * The runtime loaders in functions/src/wasm/WasmLoader.ts and
 * assembly/src/bindings/wasm-loader.ts will automatically discover the
 * resulting `wasm-manifest.json` in the same directory as the .wasm
 * payload and reject any tampered binary before instantiation.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

function sha384b64(buf) {
  return 'sha384-' + createHash('sha384').update(buf).digest('base64')
}

function makeManifestForDir(dir) {
  const entries = readdirSync(dir)
  const out = {}
  for (const name of entries) {
    if (!name.endsWith('.wasm')) continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (!stat.isFile()) continue
    const buf = readFileSync(full)
    out[name] = sha384b64(buf)
  }
  return out
}

const dirs = process.argv.slice(2)
if (dirs.length === 0) {
  console.error('Usage: node tools/generate-wasm-manifest.mjs <dir> [...]')
  process.exit(1)
}

for (const dir of dirs) {
  const manifest = makeManifestForDir(dir)
  if (Object.keys(manifest).length === 0) {
    console.warn(`[wasm-manifest] no .wasm files in ${dir}; skipping`)
    continue
  }
  const target = join(dir, 'wasm-manifest.json')
  writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`[wasm-manifest] wrote ${target} (${Object.keys(manifest).length} files)`)
}
