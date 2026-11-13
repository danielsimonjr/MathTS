/**
 * Repository and package facts that the site generators put in their pages.
 *
 * Both generators read them from `package.json` files, so no generator holds a
 * repository URL, a package name or a branch name as a literal.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root of the repository. */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The package whose name and version the site shows. A generator flag overrides it. */
export const DEFAULT_VERSION_FILE = 'functions/package.json';

/** The package.json whose `repository` field gives the GitHub links. A flag overrides it. */
export const DEFAULT_REPO_FILE = 'package.json';

/** Branch that the generated "blob" and "tree" links point at. A generator flag overrides it. */
export const DEFAULT_REF = 'main';

/** Base of an npm package page. */
export const NPM_PACKAGE_PAGE = 'https://www.npmjs.com/package/';

/**
 * Normalize the `repository` field of a package.json to a plain https URL.
 * `git+https://host/owner/repo.git`, `https://host/owner/repo` and the object form
 * `{ url }` all give `https://host/owner/repo`.
 *
 * @param {string} packageJsonPath
 * @returns {string}
 * @throws {Error} when the field is missing or is not an https URL
 */
export function repositoryUrl(packageJsonPath) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (typeof raw !== 'string' || !raw) {
    throw new Error(`site-config: ${packageJsonPath} has no "repository" field`);
  }
  const url = raw.replace(/^git\+/, '').replace(/\.git$/, '');
  if (!/^https:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+$/.test(url)) {
    throw new Error(
      `site-config: "repository" in ${packageJsonPath} is not an https URL (got ${raw})`
    );
  }
  return url;
}

/**
 * Name and version of a package, for the hero of the function reference.
 *
 * @param {string} packageJsonPath
 * @returns {{ name: string, version: string }}
 * @throws {Error} when the name is missing or the version is not semver
 */
export function packageIdentity(packageJsonPath) {
  const { name, version } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (typeof name !== 'string' || !name) {
    throw new Error(`site-config: no name in ${packageJsonPath}`);
  }
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`site-config: no semver version in ${packageJsonPath}`);
  }
  return { name, version };
}

/**
 * Command line: print the package name and version as `package=<name>` and
 * `version=<semver>` lines, the format of a GitHub Actions step output. The Site workflow
 * appends them to `$GITHUB_OUTPUT`, so it never repeats the path or the values.
 *
 *   node tools/site-config.mjs [--version-file=PATH]
 */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--version-file='));
  const file = resolve(REPO, arg ? arg.slice('--version-file='.length) : DEFAULT_VERSION_FILE);
  const { name, version } = packageIdentity(file);
  console.log(`package=${name}\nversion=${version}`);
}
