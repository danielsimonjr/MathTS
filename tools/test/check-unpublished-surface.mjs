// Check that every public workspace package whose built exports differ from the
// published npm tarball at the same version has a pending changeset that names it.
// A drift without a changeset publishes silently: the version PR that follows the
// next changeset would carry exports its version never shipped (or hide ones it did).
// The script never publishes; it only reads the registry (`npm pack <pkg>@<version>`,
// a download) and the local `dist/` of this checkout. #1573.
//
// Environment switches (used by the unit test; CI sets neither):
// - `CHECK_SURFACE_OFFLINE=1` — never touch the network. Packages are then checked
//   only when their tarball is available locally, via `CHECK_SURFACE_REGISTRY_DIR`.
// - `CHECK_SURFACE_REGISTRY_DIR=<dir>` — read published tarballs from `<dir>` instead
//   of `npm pack`. The directory holds one `.tgz` per package whose file name contains
//   `<unscoped-name>-<version>.tgz` (the layout `npm pack` itself produces).
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/**
 * Workspace package names mentioned in any pending changeset under `.changeset/*.md`.
 * @param {string} root repository root
 * @returns {Set<string>} package names, e.g. `@danielsimonjr/mathts-core`
 */
export function changesetNames(root) {
  const dir = join(root, '.changeset');
  const names = new Set();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const text = readFileSync(join(dir, file), 'utf8');
    for (const match of text.matchAll(/@?[\w./-]*mathts-[a-z0-9-]+/g)) {
      names.add(match[0].startsWith('@') ? match[0] : `@danielsimonjr/${match[0]}`);
    }
  }
  return names;
}

/**
 * Resolve the runtime entry a consumer imports for `.` from a package manifest.
 * @param {string} pkgDir absolute package directory (holds `package.json`)
 * @returns {string | null} absolute entry file path, or null when the manifest names none
 */
export function entryPathFor(pkgDir) {
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const dot =
    typeof manifest.exports === 'object' && manifest.exports !== null
      ? manifest.exports['.']
      : manifest.exports;
  const specifier =
    typeof dot === 'string'
      ? dot
      : typeof dot === 'object' && dot !== null
        ? (dot.import ?? dot.default ?? dot.require)
        : (manifest.main ?? manifest.module);
  return typeof specifier === 'string' ? join(pkgDir, specifier) : null;
}

/**
 * Import a built entry and collect its own export names, sorted.
 * @param {string} entryPath absolute path of the built ESM entry
 * @returns {Promise<string[]>}
 */
export async function collectExports(entryPath) {
  const mod = await import(pathToFileURL(entryPath).href);
  return Object.keys(mod).sort();
}

/**
 * Fetch the published tarball for one package version and extract it into
 * `<scratchDir>/tarball` (which must exist and be empty).
 * @param {string} name package name
 * @param {string} version version to fetch
 * @param {string} scratchDir directory holding an empty `tarball/` subdir to extract into
 * @param {boolean} offline true when the network is off-limits
 * @returns {Promise<'not-found' | 'unavailable' | { dir: string }>}
 *   `not-found` when the version is not on the registry (a new package — nothing to
 *   compare), `unavailable` when offline mode has no local tarball for it.
 */
export async function fetchPublishedTarball(name, version, scratchDir, offline) {
  const registryDir = process.env.CHECK_SURFACE_REGISTRY_DIR;
  const unscoped = name.split('/').pop();
  const tarballDir = join(scratchDir, 'tarball');
  let tgz;
  if (registryDir) {
    const hit = readdirSync(registryDir).find(
      (file) => file.includes(`${unscoped}-${version}.tgz`) && file.endsWith('.tgz')
    );
    if (!hit) return offline ? 'unavailable' : 'not-found';
    tgz = join(registryDir, hit);
  } else {
    if (offline) return 'unavailable';
    const packDir = mkdtempSync(join(tmpdir(), 'check-surface-pack-'));
    try {
      execFileSync('npm', ['pack', `${name}@${version}`, '--pack-destination', packDir], {
        cwd: repoRoot,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      tgz = join(packDir, `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`);
      if (!existsSync(tgz)) return 'not-found';
      execFileSync('tar', ['-xzf', tgz, '-C', join(scratchDir, 'tarball')]);
    } catch (error) {
      const message = String(error?.stderr ?? error);
      if (/E404|not found/i.test(message)) return 'not-found';
      throw new Error(`npm pack ${name}@${version} failed: ${message}`);
    } finally {
      rmSync(packDir, { recursive: true, force: true });
    }
    return { dir: tarballDir };
  }
  execFileSync('tar', ['-xzf', tgz, '-C', tarballDir]);
  return { dir: tarballDir };
}

/**
 * Compare one package's built exports with its published tarball at the same version.
 * @param {string} root repository root
 * @param {string} dir workspace directory of the package, relative to the root
 * @param {string} scratchDir directory holding an empty `tarball/` subdir to extract into
 * @param {boolean} offline true when the network is off-limits
 * @returns {Promise<{ verdict: 'ok' | 'drift' | 'skip', detail?: string }>}
 */
export async function checkPackage(root, dir, scratchDir, offline) {
  const pkgDir = join(root, dir);
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  if (manifest.private) return { verdict: 'skip', detail: 'private package' };
  const entry = entryPathFor(pkgDir);
  if (!entry || !existsSync(entry)) return { verdict: 'skip', detail: 'no built entry' };
  const built = await collectExports(entry);

  const result = await fetchPublishedTarball(manifest.name, manifest.version, scratchDir, offline);
  if (result === 'not-found') return { verdict: 'skip', detail: 'version not on the registry' };
  if (result === 'unavailable') return { verdict: 'skip', detail: 'no local tarball (offline)' };
  const publishedEntry = entryPathFor(join(result.dir, 'package'));
  if (!publishedEntry || !existsSync(publishedEntry)) {
    return { verdict: 'drift', detail: 'published tarball has no usable entry' };
  }
  const published = await collectExports(publishedEntry);

  const missing = built.filter((name) => !published.includes(name));
  const extra = published.filter((name) => !built.includes(name));
  if (!missing.length && !extra.length) return { verdict: 'ok' };
  const parts = [];
  if (missing.length) parts.push(`on HEAD but not in the tarball: ${missing.join(', ')}`);
  if (extra.length) parts.push(`in the tarball but not on HEAD: ${extra.join(', ')}`);
  return { verdict: 'drift', detail: parts.join('; ') };
}

/**
 * Check every public workspace package. Returns one failure line per drifted package
 * that no pending changeset names.
 * @param {string} [root] repository root; defaults to this checkout (tests pass a fixture)
 * @param {{ offline?: boolean }} [options]
 * @returns {Promise<{ failures: string[], skipped: string[] }>}
 */
export async function run(root = repoRoot, options = {}) {
  const offline = options.offline ?? process.env.CHECK_SURFACE_OFFLINE === '1';
  const changesets = changesetNames(root);
  const failures = [];
  const skipped = [];
  const scratch = mkdtempSync(join(tmpdir(), 'check-surface-'));
  mkdirSync(join(scratch, 'tarball'));
  // A published tarball's dist imports its dependencies by bare specifier. A symlink
  // to the repo's node_modules lets the extracted entry resolve them the way the real
  // package tree does, without installing anything into the temp dir.
  const repoModules = join(repoRoot, 'node_modules');
  if (existsSync(repoModules)) symlinkSync(repoModules, join(scratch, 'node_modules'), 'dir');
  try {
    let index = 0;
    for (const dir of workspaceDirs(root)) {
      // A fresh subdir per package: importing `tarball/package/dist/index.js` from the
      // same path twice would return Node's cached module of the first package.
      const pkgScratch = join(scratch, `pkg-${index++}`);
      mkdirSync(join(pkgScratch, 'tarball'), { recursive: true });
      const verdict = await checkPackage(root, dir, pkgScratch, offline);
      if (verdict.verdict === 'ok') continue;
      if (verdict.verdict === 'skip') {
        skipped.push(`${dir}: ${verdict.detail}`);
        continue;
      }
      const name = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')).name;
      if (changesets.has(name)) {
        skipped.push(`${dir}: drifted (${verdict.detail}), but a pending changeset names ${name}`);
        continue;
      }
      failures.push(
        `${name} (${dir}) differs from the published tarball at the same version — ${verdict.detail}. ` +
          'Add a changeset that names this package.'
      );
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return { failures, skipped };
}

async function main() {
  const { failures, skipped } = await run();
  for (const line of skipped) console.log(`skip: ${line}`);
  if (failures.length) {
    console.error(failures.join('\n'));
    console.error('Add a changeset for each drifted package (or publish the drift first).');
    process.exitCode = 1;
  } else {
    console.log('Every built export surface matches its published tarball, or has a changeset.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('check-unpublished-surface.mjs')) {
  await main();
}
