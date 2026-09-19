#!/usr/bin/env node
/**
 * Registry-only dependency guard for the PUBLISHED workspace packages.
 *
 * Every non-private workspace package.json must declare its runtime dependencies with
 * specs that the npm registry can resolve. The script fails (exit 1) when a published
 * manifest has one of these specs in `dependencies`, `peerDependencies` or
 * `optionalDependencies`:
 *   - a git or hosted-git spec: `github:`, `gitlab:`, `bitbucket:`, `gist:`, `git:`,
 *     `git+ssh:`, `git+https:`, a URL that ends in `.git`, or the `owner/repo` shorthand;
 *   - a local spec: `file:`, `link:`, `portal:`;
 *   - a tarball URL (`http:` / `https:`).
 *
 * Why: npm 10 (bundled with Node 20 and 22) crashes while it prepares a git dependency
 * ("git dep preparation failed ... Cannot read properties of null (reading 'edgesOut')").
 * mathts-core 0.15.1 declared `"typed-function": "github:danielsimonjr/typed-function"`,
 * so `npm install @danielsimonjr/mathts-core` failed for every npm 10 user.
 * Use the registry package instead, with an `npm:` alias when the import name must not change.
 *
 * `workspace:` specs are allowed: `bun publish` and `changeset publish` rewrite them to versions.
 *
 * Run it with `node` (never `bun run`): `node tools/test/check-published-deps.mjs`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/** Dependency fields that npm installs for a consumer. */
const FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

/**
 * Classify a dependency spec.
 * @param {string} spec the version spec from package.json.
 * @returns {string | null} the reason the spec is not registry-resolvable, or null when it is.
 */
export function badSpecReason(spec) {
  const s = spec.trim();
  if (/^(github|gitlab|bitbucket|gist):/i.test(s)) return 'hosted-git spec';
  if (/^git(\+[a-z]+)?:/i.test(s)) return 'git URL';
  if (/^(file|link|portal):/i.test(s)) return 'local path spec';
  if (/^https?:/i.test(s)) return /\.git(#.*)?$/i.test(s) ? 'git URL' : 'tarball URL';
  // `owner/repo` or `owner/repo#ref` is the npm shorthand for a GitHub dependency.
  if (/^[\w.-]+\/[\w.-]+(#.*)?$/.test(s)) return 'GitHub shorthand';
  // Semver ranges, dist-tags, `npm:` aliases and `workspace:` specs are registry specs.
  return null;
}

/**
 * Check every published workspace manifest.
 * @returns {string[]} one message per bad spec; empty when all specs are registry specs.
 */
export function findBadSpecs() {
  const problems = [];
  for (const dir of workspaceDirs()) {
    const pkg = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
    if (pkg.private) continue;
    for (const field of FIELDS) {
      for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
        const reason = badSpecReason(String(spec));
        if (reason) problems.push(`${dir}/package.json ${field}.${name} = "${spec}" (${reason})`);
      }
    }
  }
  return problems;
}

const problems = findBadSpecs();
if (problems.length > 0) {
  console.error(`FAIL: ${problems.length} non-registry dependency spec(s) in published manifests:`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('npm 10 cannot install a package with a git dependency. Use a registry version.');
  process.exit(1);
}
console.log(`OK: every published workspace manifest uses registry dependency specs (${workspaceDirs().length} workspaces checked).`);
