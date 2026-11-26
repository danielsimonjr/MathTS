#!/usr/bin/env node
/**
 * Assemble `changelog-fragments/*.md` into the root `CHANGELOG.md` `[Unreleased]`
 * section, newest first, then delete the fragments it consumed.
 *
 * Feature and fix PRs no longer edit `CHANGELOG.md` by hand: they drop one
 * fragment file (see `changelog-fragments/README.md`), and the release version
 * PR assembles them (`bun run version-packages` runs this script after
 * `changeset version`). A direct `CHANGELOG.md` edit is still accepted while
 * in-flight PRs transition, and the assembler leaves such edits in place.
 *
 * Filename order is the assembly order, descending, so `YYYY-MM-DD-<slug>.md`
 * sorts newest first. The fragment body is inserted verbatim, which is why a
 * fragment carries its own `### <Type>` heading.
 *
 *   node tools/release/assemble-changelog.mjs            merge + delete fragments
 *   node tools/release/assemble-changelog.mjs --check    exit 1 when fragments are pending
 *   node tools/release/assemble-changelog.mjs --dry-run  print the merged result, write nothing
 *
 * `--changelog <file>` and `--fragments <dir>` point it at a fixture.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from '../test/workspaces.mjs';

const UNRELEASED_HEADING = /^## \[Unreleased]\s*$/;

/**
 * List the pending fragment files, newest (highest filename) first.
 * `README.md` documents the format and is never a fragment.
 * @param {string} dir
 * @returns {string[]}
 */
export function pendingFragments(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .reverse();
}

/**
 * Split a changelog into the text before the `[Unreleased]` body, the body, and
 * the text after it. The body starts on the line after the first
 * `## [Unreleased]` heading and runs to the next `## ` heading.
 * @param {string} text
 * @returns {{ before: string, body: string, after: string }}
 * @throws Error when the file has no `## [Unreleased]` heading
 */
export function splitUnreleased(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => UNRELEASED_HEADING.test(line));
  if (start < 0) throw new Error('CHANGELOG.md has no `## [Unreleased]` heading');
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## ')) end += 1;
  return {
    before: `${lines.slice(0, start + 1).join('\n')}\n`,
    body: lines.slice(start + 1, end).join('\n'),
    after: `${lines.slice(end).join('\n')}`,
  };
}

/**
 * Merge fragment bodies, newest first, above the existing `[Unreleased]` body.
 * Pure: reads nothing and writes nothing, so the tests can pin it.
 * @param {string} changelog text of CHANGELOG.md
 * @param {string[]} fragments fragment file contents, already in assembly order
 * @returns {string} the new CHANGELOG.md text
 */
export function mergeFragments(changelog, fragments) {
  if (fragments.length === 0) return changelog;
  const { before, body, after } = splitUnreleased(changelog);
  const existing = body.replace(/^\n+/, '').replace(/\s+$/, '');
  const incoming = fragments.map((text) => text.replace(/^\n+/, '').replace(/\s+$/, ''));
  const merged = [...incoming, existing].filter((part) => part.length > 0).join('\n\n');
  return `${before}\n${merged}\n\n${after}`;
}

function flagValue(args, flag) {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
}

/**
 * Merge pending fragments into CHANGELOG.md, or report them, and return the exit code.
 * @param {string[]} args
 */
export function main(args) {
  const root = resolve(flagValue(args, '--root') ?? repoRoot);
  const changelogPath = resolve(flagValue(args, '--changelog') ?? join(root, 'CHANGELOG.md'));
  const fragmentsDir = resolve(flagValue(args, '--fragments') ?? join(root, 'changelog-fragments'));
  const fragments = pendingFragments(fragmentsDir);
  if (fragments.length === 0) {
    console.log('No changelog fragments pending; CHANGELOG.md is current.');
    return 0;
  }
  if (args.includes('--check')) {
    console.error(`${fragments.length} changelog fragment(s) pending in ${fragmentsDir}:`);
    for (const name of fragments) console.error(`  ${name}`);
    return 1;
  }
  const changelog = readFileSync(changelogPath, 'utf8');
  const merged = mergeFragments(
    changelog,
    fragments.map((name) => readFileSync(join(fragmentsDir, name), 'utf8'))
  );
  if (args.includes('--dry-run')) {
    process.stdout.write(merged);
    return 0;
  }
  writeFileSync(changelogPath, merged);
  for (const name of fragments) rmSync(join(fragmentsDir, name));
  console.log(`Assembled ${fragments.length} fragment(s) into CHANGELOG.md, newest first.`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
