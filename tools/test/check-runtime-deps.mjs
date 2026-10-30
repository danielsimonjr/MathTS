#!/usr/bin/env node
/**
 * Lock runtime dependency names and specs for every workspace manifest plus the root.
 *
 *   node tools/test/check-runtime-deps.mjs
 *   node tools/test/check-runtime-deps.mjs --write
 *
 * Unlike check-published-deps.mjs (registry shape only), this fails when any
 * `dependencies`, `peerDependencies`, or `optionalDependencies` entry is added,
 * removed, or retargeted. devDependencies are intentionally unlocked.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

const LOCK_PATH = join(repoRoot, 'tools/test/runtime-deps-lock.json');
const FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];
const writeMode = process.argv.includes('--write');

/**
 * @param {string} [root] repository root; defaults to this checkout (tests pass a fixture)
 * @returns {string[]} repo-relative package.json paths (root first).
 */
export function runtimeManifestPaths(root = repoRoot) {
  return ['package.json', ...workspaceDirs(root).map((dir) => `${dir}/package.json`)];
}

/**
 * @param {string} relPath repo-relative path to a package.json
 * @param {string} [root] repository root
 */
export function readRuntimeDepFields(relPath, root = repoRoot) {
  const pkg = JSON.parse(readFileSync(join(root, relPath), 'utf8'));
  /** @type {Record<string, Record<string, string>>} */
  const out = {};
  for (const field of FIELDS) {
    /** @type {Record<string, string>} */
    const section = {};
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      section[name] = String(spec);
    }
    out[field] = section;
  }
  return out;
}

/**
 * @param {string} [root] repository root
 * @returns {Record<string, Record<string, Record<string, string>>>}
 */
export function collectRuntimeDepsLock(root = repoRoot) {
  /** @type {Record<string, Record<string, Record<string, string>>>} */
  const lock = {};
  for (const rel of runtimeManifestPaths(root)) {
    lock[rel] = readRuntimeDepFields(rel, root);
  }
  return lock;
}

/**
 * @param {Record<string, Record<string, Record<string, string>>>} actual
 * @param {Record<string, Record<string, Record<string, string>>>} expected
 * @returns {string[]}
 */
export function diffRuntimeDeps(actual, expected) {
  const problems = [];
  const paths = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const rel of [...paths].sort()) {
    const a = actual[rel];
    const e = expected[rel];
    if (!a) {
      problems.push(`missing manifest in lock: ${rel}`);
      continue;
    }
    if (!e) {
      problems.push(`unexpected manifest in tree: ${rel}`);
      continue;
    }
    for (const field of FIELDS) {
      const aSec = a[field] ?? {};
      const eSec = e[field] ?? {};
      const names = new Set([...Object.keys(aSec), ...Object.keys(eSec)]);
      for (const name of [...names].sort()) {
        if (!(name in eSec)) {
          problems.push(`${rel} ${field}.${name} added (spec "${aSec[name]}")`);
        } else if (!(name in aSec)) {
          problems.push(`${rel} ${field}.${name} removed (was "${eSec[name]}")`);
        } else if (aSec[name] !== eSec[name]) {
          problems.push(`${rel} ${field}.${name} spec changed: "${eSec[name]}" -> "${aSec[name]}"`);
        }
      }
    }
  }
  return problems;
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const actual = collectRuntimeDepsLock();
  if (writeMode) {
    writeFileSync(LOCK_PATH, `${JSON.stringify(actual, null, 2)}\n`);
    console.log(`Wrote ${LOCK_PATH}`);
    process.exit(0);
  }
  if (!existsSync(LOCK_PATH)) {
    console.error(`FAIL: missing ${LOCK_PATH} — run with --write once.`);
    process.exit(1);
  }
  const expected = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  const problems = diffRuntimeDeps(actual, expected);
  if (problems.length > 0) {
    console.error(`FAIL: ${problems.length} runtime dependency drift(s):`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('Update tools/test/runtime-deps-lock.json in the same PR when deliberate.');
    process.exit(1);
  }
  console.log(`OK: runtime dependency lock matches ${runtimeManifestPaths().length} manifest(s).`);
}
