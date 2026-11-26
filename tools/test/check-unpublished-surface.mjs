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
 * Extract YAML frontmatter between the opening and closing `---` at the top of a file.
 * @param {string} text full file text
 * @returns {string | null} frontmatter body, or null when absent or invalid
 */
export function extractChangesetFrontmatter(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(1, i).join('\n');
  }
  return null;
}

/**
 * Workspace package names mentioned in pending changeset frontmatter under `.changeset/*.md`.
 * @param {string} root repository root
 * @returns {Set<string>} package names, e.g. `@danielsimonjr/mathts-core`
 */
export function changesetNames(root) {
  const dir = join(root, '.changeset');
  const names = new Set();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const text = readFileSync(join(dir, file), 'utf8');
    const frontmatter = extractChangesetFrontmatter(text);
    if (!frontmatter) continue;
    for (const line of frontmatter.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^(['"]?)(@?[^'":\s]+)\1\s*:/);
      if (!match) continue;
      const pkg = match[2];
      names.add(pkg.startsWith('@') ? pkg : `@danielsimonjr/${pkg}`);
    }
  }
  return names;
}

/**
 * Normalise `package.json` `exports` to a map of subpath → condition value.
 * @param {unknown} exportsField manifest `exports`
 * @param {string | undefined} main fallback main
 * @param {string | undefined} module fallback module
 * @returns {Record<string, string | object>}
 */
export function exportSubpathMap(exportsField, main, module) {
  if (typeof exportsField === 'string') return { '.': exportsField };
  if (exportsField && typeof exportsField === 'object') {
    return { .../** @type {Record<string, string | object>} */ (exportsField) };
  }
  const fallback = module ?? main;
  if (typeof fallback === 'string') return { '.': fallback };
  return {};
}

/**
 * Resolve the runtime ESM entry file for one export subpath.
 * @param {string} pkgDir absolute package directory (holds `package.json`)
 * @param {string} subpath export key, e.g. `.` or `./evaluate`
 * @param {Record<string, string | object>} map from {@link exportSubpathMap}
 * @returns {string | null} absolute entry file path, or null when not a JS entry
 */
export function entryPathForSubpath(pkgDir, subpath, map) {
  const value = map[subpath];
  if (value === undefined) return null;
  const specifier =
    typeof value === 'string'
      ? value
      : typeof value === 'object' && value !== null
        ? /** @type {{ import?: string; default?: string; require?: string }} */ (value).import ??
          /** @type {{ import?: string; default?: string; require?: string }} */ (value).default ??
          /** @type {{ import?: string; default?: string; require?: string }} */ (value).require
        : null;
  if (typeof specifier !== 'string') return null;
  if (specifier.endsWith('package.json')) return null;
  return join(pkgDir, specifier);
}

/**
 * True when a subpath or its entry files are worker scripts. Those entries need a
 * Worker global this checker does not provide, so a *both-sides* import failure is
 * not a surface regression. Non-worker subpaths must still fail when both imports fail.
 * @param {string} subpath
 * @param {string | null} builtEntry
 * @param {string | null} publishedEntry
 */
export function isWorkerLikeEntry(subpath, builtEntry, publishedEntry) {
  const haystacks = [subpath, builtEntry, publishedEntry].filter(
    (value) => typeof value === 'string' && value.length > 0
  );
  return haystacks.some((value) =>
    /(^|[\\/])worker(\.|$|[\\/])|\.worker(\.|$|[\\/])/i.test(value.replace(/\\/g, '/'))
  );
}

/**
 * Resolve the runtime entry a consumer imports for `.` from a package manifest.
 * @param {string} pkgDir absolute package directory (holds `package.json`)
 * @returns {string | null} absolute entry file path, or null when the manifest names none
 */
export function entryPathFor(pkgDir) {
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const map = exportSubpathMap(manifest.exports, manifest.main, manifest.module);
  return entryPathForSubpath(pkgDir, '.', map);
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
      if (/E404|ETARGET|not found|notarget|No matching version/i.test(message)) return 'not-found';
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
 * Compare built and published export subpaths and each comparable JS entry's export names.
 * @param {string} builtPkgDir absolute built package tree (workspace package dir)
 * @param {string} publishedPkgDir absolute extracted `package/` dir from the tarball
 * @returns {Promise<string | null>} drift detail, or null when surfaces match
 */
export async function compareAllExportSubpaths(builtPkgDir, publishedPkgDir) {
  const builtManifest = JSON.parse(readFileSync(join(builtPkgDir, 'package.json'), 'utf8'));
  const publishedManifest = JSON.parse(
    readFileSync(join(publishedPkgDir, 'package.json'), 'utf8')
  );
  const builtMap = exportSubpathMap(
    builtManifest.exports,
    builtManifest.main,
    builtManifest.module
  );
  const publishedMap = exportSubpathMap(
    publishedManifest.exports,
    publishedManifest.main,
    publishedManifest.module
  );
  const builtKeys = Object.keys(builtMap).sort();
  const publishedKeys = Object.keys(publishedMap).sort();
  const parts = [];

  const keysOnlyOnBuilt = builtKeys.filter((key) => !publishedKeys.includes(key));
  const keysOnlyOnPublished = publishedKeys.filter((key) => !builtKeys.includes(key));
  if (keysOnlyOnBuilt.length) {
    parts.push(`export subpaths on HEAD but not in the tarball: ${keysOnlyOnBuilt.join(', ')}`);
  }
  if (keysOnlyOnPublished.length) {
    parts.push(
      `export subpaths in the tarball but not on HEAD: ${keysOnlyOnPublished.join(', ')}`
    );
  }

  for (const key of builtKeys) {
    if (!publishedKeys.includes(key)) continue;
    const builtEntry = entryPathForSubpath(builtPkgDir, key, builtMap);
    const publishedEntry = entryPathForSubpath(publishedPkgDir, key, publishedMap);
    if (!builtEntry && !publishedEntry) continue;
    if (!builtEntry || !publishedEntry) {
      parts.push(`${key}: export condition shape differs between HEAD and tarball`);
      continue;
    }
    if (!existsSync(builtEntry)) {
      parts.push(`${key}: built entry missing at ${builtEntry}`);
      continue;
    }
    if (!existsSync(publishedEntry)) {
      parts.push(`${key}: published entry missing at ${publishedEntry}`);
      continue;
    }
    let built;
    let published;
    try {
      built = await collectExports(builtEntry);
    } catch (error) {
      const builtMessage = error instanceof Error ? error.message : String(error);
      try {
        await collectExports(publishedEntry);
        parts.push(`${key}: failed to import built entry (${builtMessage})`);
      } catch (publishedError) {
        if (isWorkerLikeEntry(key, builtEntry, publishedEntry)) {
          // Worker entries skip when both sides fail in this checker.
          continue;
        }
        const publishedMessage =
          publishedError instanceof Error ? publishedError.message : String(publishedError);
        parts.push(
          `${key}: failed to import built entry (${builtMessage}) and published entry (${publishedMessage})`
        );
      }
      continue;
    }
    try {
      published = await collectExports(publishedEntry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      parts.push(`${key}: failed to import published entry (${message})`);
      continue;
    }
    const missing = built.filter((name) => !published.includes(name));
    const extra = published.filter((name) => !built.includes(name));
    if (!missing.length && !extra.length) continue;
    if (missing.length) {
      parts.push(`${key}: on HEAD but not in the tarball: ${missing.join(', ')}`);
    }
    if (extra.length) {
      parts.push(`${key}: in the tarball but not on HEAD: ${extra.join(', ')}`);
    }
  }

  return parts.length ? parts.join('; ') : null;
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

  const result = await fetchPublishedTarball(manifest.name, manifest.version, scratchDir, offline);
  if (result === 'not-found') return { verdict: 'skip', detail: 'version not on the registry' };
  if (result === 'unavailable') return { verdict: 'skip', detail: 'no local tarball (offline)' };

  const publishedPkgDir = join(result.dir, 'package');
  const drift = await compareAllExportSubpaths(pkgDir, publishedPkgDir);
  if (!drift) return { verdict: 'ok' };
  return { verdict: 'drift', detail: drift };
}

/**
 * Check every public workspace package. Returns one failure line per drifted package
 * that no pending changeset names.
 * @param {string} [root] repository root; defaults to this checkout (tests pass a fixture)
 * @param {{ offline?: boolean }} [options]
 * @returns {Promise<{ failures: string[], skipped: string[], compared: number }>}
 */
export async function run(root = repoRoot, options = {}) {
  const offline = options.offline ?? process.env.CHECK_SURFACE_OFFLINE === '1';
  const changesets = changesetNames(root);
  const failures = [];
  const skipped = [];
  let compared = 0;
  let registryUnavailableSkips = 0;
  let privateSkips = 0;
  const scratch = mkdtempSync(join(tmpdir(), 'check-surface-'));
  mkdirSync(join(scratch, 'tarball'));
  const repoModules = join(repoRoot, 'node_modules');
  if (existsSync(repoModules)) symlinkSync(repoModules, join(scratch, 'node_modules'), 'dir');
  try {
    let index = 0;
    for (const dir of workspaceDirs(root)) {
      const pkgScratch = join(scratch, `pkg-${index++}`);
      mkdirSync(join(pkgScratch, 'tarball'), { recursive: true });
      const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
      const name = manifest.name;
      const verdict = await checkPackage(root, dir, pkgScratch, offline);
      if (verdict.verdict === 'ok') {
        compared++;
        continue;
      }
      if (verdict.verdict === 'skip') {
        skipped.push(`${dir}: ${verdict.detail}`);
        if (verdict.detail === 'private package') {
          privateSkips++;
        } else if (
          verdict.detail === 'version not on the registry' ||
          verdict.detail === 'no local tarball (offline)'
        ) {
          registryUnavailableSkips++;
        }
        continue;
      }
      compared++;
      if (changesets.has(name)) {
        skipped.push(`${dir}: drifted (${verdict.detail}), but a pending changeset names ${name}`);
        continue;
      }
      failures.push(
        `${name} (${dir}) differs from the published tarball at the same version — ${verdict.detail}. ` +
          'Add a changeset that names this package.'
      );
    }
    if (compared === 0) {
      const comparableSkips = skipped.length - privateSkips;
      const everyComparableSkipIsRegistryUnavailable =
        comparableSkips > 0 && registryUnavailableSkips === comparableSkips;
      if (!everyComparableSkipIsRegistryUnavailable) {
        failures.push(
          'No workspace package was compared against a published tarball at the same version ' +
            '(every package was skipped or the workspace is empty). Re-run after `bun run build`, ' +
            'or fix skip reasons above.'
        );
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return { failures, skipped, compared };
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