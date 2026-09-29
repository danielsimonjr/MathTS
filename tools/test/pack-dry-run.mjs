#!/usr/bin/env node
/**
 * Dry-run pack of every published workspace package.
 *
 *   node tools/test/pack-dry-run.mjs --tool=npm
 *   bun tools/test/pack-dry-run.mjs --tool=bun
 *
 * `--tool=npm` runs `npm pack --dry-run --json` (the npm CLI; needs Node).
 * `--tool=bun` runs `bun pm pack --dry-run` (Bun's packer).
 *
 * Fails when a tarball would ship tests, env files, credential-like paths, or
 * is missing `package.json` / `README.md` / `dist/index.js` (the wasm package
 * ships `build/mathts.js` instead of `dist/index.js`). Source maps are allowed.
 *
 * Run after `bun run build` so `dist/` exists. A missing dist fails the check:
 * the dry-run would otherwise describe an empty publish.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

const tool = process.argv.find((a) => a.startsWith('--tool='))?.split('=')[1] ?? 'npm';
if (tool !== 'npm' && tool !== 'bun') {
  console.error(`pack-dry-run: unknown --tool=${tool} (expected npm or bun)`);
  process.exit(2);
}

/** Paths that must not appear in a published tarball. */
const FORBIDDEN = [
  /(^|\/)tests?\//,
  /(^|\/)__tests__\//,
  /\.test\.(c|m)?[jt]s$/,
  /(^|\/)\.env($|\.)/,
  /(^|\/)\.npmrc$/,
  /id_rsa/,
  /credentials\.json$/,
  /\.pem$/,
  /(^|\/)secrets?(\.|\/)/,
  /node_modules\//,
];

/**
 * @param {string} dir workspace directory relative to the repo root
 * @param {string} name package name
 * @returns {{ files: {path: string, size: number}[], unpackedSize: number }}
 */
function dryRun(dir, name) {
  const cwd = join(repoRoot, dir);
  if (tool === 'npm') {
    const stdout = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd,
      encoding: 'utf8',
    });
    const parsed = JSON.parse(stdout);
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    return {
      files: entry.files.map((f) => ({ path: f.path, size: f.size })),
      unpackedSize: entry.unpackedSize,
    };
  }
  const stdout = execFileSync('bun', ['pm', 'pack', '--dry-run', '--ignore-scripts'], {
    cwd,
    encoding: 'utf8',
  });
  return parseBunPack(stdout, name);
}

/**
 * Bun prints a listing, not JSON. Keep lines that look like packed paths.
 * Unpacked size is the sum of sizes when Bun prints `path (N bytes)`, else 0
 * and the script still checks the path list.
 * @param {string} stdout
 * @param {string} name
 */
function parseBunPack(stdout, name) {
  const files = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    // bun 1.4: "packed 2.26KB package.json" / "packed 266B dist/index.js"
    const packed = trimmed.match(/^packed\s+(\S+)\s+(\S+)$/);
    if (!packed) continue;
    files.push({ path: packed[2], size: parseBunSize(packed[1]) });
  }
  if (files.length === 0) {
    throw new Error(`${name}: bun pm pack produced no file list:\n${stdout}`);
  }
  return { files, unpackedSize: files.reduce((n, f) => n + f.size, 0) };
}

/**
 * @param {string} text sizes such as `266B`, `2.26KB`, `1.5MB`
 * @returns {number}
 */
function parseBunSize(text) {
  const m = text.match(/^([0-9.]+)(B|KB|MB|GB)$/i);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === 'GB') return Math.round(n * 1024 * 1024 * 1024);
  if (unit === 'MB') return Math.round(n * 1024 * 1024);
  if (unit === 'KB') return Math.round(n * 1024);
  return Math.round(n);
}

const problems = [];
const rows = [];

for (const dir of workspaceDirs()) {
  const pkgPath = join(repoRoot, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.private) continue;
  const entryJs = pkg.name.endsWith('mathts-wasm') ? 'build/mathts.js' : 'dist/index.js';
  if (!existsSync(join(repoRoot, dir, entryJs))) {
    problems.push(`${pkg.name}: ${entryJs} is missing; build before packing`);
    continue;
  }
  let packed;
  try {
    packed = dryRun(dir, pkg.name);
  } catch (err) {
    problems.push(`${pkg.name}: pack failed: ${err instanceof Error ? err.message : err}`);
    continue;
  }
  const paths = packed.files.map((f) => f.path);
  for (const file of paths) {
    for (const re of FORBIDDEN) {
      if (re.test(file)) problems.push(`${pkg.name}: forbidden path ${file}`);
    }
  }
  for (const required of ['package.json', 'README.md', entryJs]) {
    if (!paths.includes(required)) problems.push(`${pkg.name}: tarball is missing ${required}`);
  }
  rows.push({ name: pkg.name, files: paths.length, bytes: packed.unpackedSize });
  console.log(`ok   ${pkg.name}  ${paths.length} files  ${packed.unpackedSize} bytes unpacked`);
}

console.log(`pack-dry-run (${tool}): ${rows.length} packages`);
if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
