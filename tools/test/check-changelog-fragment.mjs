#!/usr/bin/env node
/**
 * Changelog-fragment gate. Every PR that changes release-relevant code records
 * its changelog entry as a `changelog-fragments/*.md` fragment instead of
 * editing `CHANGELOG.md` directly (see `changelog-fragments/README.md`): the
 * top of `[Unreleased]` is one line, so parallel PRs that hand-edit it conflict
 * and force re-merges and full CI reruns.
 *
 * The gate passes when the changed files include at least one fragment. A
 * direct `CHANGELOG.md` edit still passes while in-flight PRs transition (the
 * release assembler leaves such edits in place). A docs-only PR passes with no
 * fragment: every changed path is markdown, `docs/`, `.changeset/`,
 * `changelog-fragments/` (its own README included), `.github/` or a repo
 * metadata dotfile.
 *
 *   node tools/test/check-changelog-fragment.mjs --pr 1721     CI (gh CLI)
 *   node tools/test/check-changelog-fragment.mjs --files a,b   explicit list
 *   node tools/test/check-changelog-fragment.mjs --base origin/main
 *
 * In CI `--pr` needs `GH_TOKEN` and `GH_REPO` (the gh CLI reads both); it runs
 * `gh pr diff --name-only`. The exit code is 0 when the PR satisfies the rule.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** A changed path that carries no release-relevant change. */
const DOC_PATTERNS = [
  /\.md$/i,
  /^docs\//,
  /^\.changeset\//,
  /^changelog-fragments\//,
  /^\.github\//,
  /^LICENSE/,
  /^\.gitignore$/,
  /^\.gitattributes$/,
  /^\.editorconfig$/,
  /^\.prettierignore$/,
  /^\.npmignore$/,
  /^\.dropboxignore$/,
  /^bun\.lock$/,
  /^CODEOWNERS$/,
];

/**
 * Is true when every changed path is documentation, release admin or repo
 * metadata, so the PR needs no changelog fragment.
 * @param {string[]} files
 */
export function isDocsOnly(files) {
  return files.length > 0 && files.every((file) => DOC_PATTERNS.some((p) => p.test(file)));
}

/**
 * Classify a PR's changed files against the fragment rule.
 * @param {string[]} files
 * @returns {{ ok: boolean, reason: string }}
 */
export function classify(files) {
  if (files.includes('CHANGELOG.md')) {
    return {
      ok: true,
      reason:
        'direct CHANGELOG.md edit (accepted while in-flight PRs transition; new work uses changelog-fragments/)',
    };
  }
  if (
    files.some(
      (file) => /^changelog-fragments\/[^/]+\.md$/.test(file) && !file.endsWith('README.md')
    )
  ) {
    return { ok: true, reason: 'changelog fragment found' };
  }
  if (isDocsOnly(files)) return { ok: true, reason: 'docs-only change, no fragment required' };
  return {
    ok: false,
    reason:
      'no changelog fragment: add a changelog-fragments/YYYY-MM-DD-<slug>.md file (format in changelog-fragments/README.md). A direct CHANGELOG.md edit is still accepted while in-flight PRs transition.',
  };
}

/** The fragment rule's failure message, pinned by the test so the instruction cannot rot. */
export const FRAGMENT_INSTRUCTION = classify([]).reason;

/** Returns the argument that follows a flag, or undefined when it is not given. */
function flagValue(args, flag) {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
}

/**
 * Changed files of one pull request, through the gh CLI.
 * @param {string} pr number
 * @returns {string[]}
 */
function prFiles(pr) {
  const out = execFileSync('gh', ['pr', 'diff', String(pr), '--name-only'], {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Changed files between a base ref and HEAD, through git.
 * @param {string} base
 * @returns {string[]}
 */
function baseFiles(base) {
  const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Is true when this file is the script that node started, also through a link or a junction. */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
  } catch {
    return false;
  }
}

export function main(args) {
  const files = args.includes('--files')
    ? String(flagValue(args, '--files') ?? '')
        .split(/[,\n]/)
        .map((f) => f.trim())
        .filter(Boolean)
    : args.includes('--pr')
      ? prFiles(flagValue(args, '--pr'))
      : args.includes('--base')
        ? baseFiles(String(flagValue(args, '--base')))
        : null;
  if (files === null) {
    console.error('Give one of --pr <number>, --files <list> or --base <ref>.');
    return 2;
  }
  if (files.length === 0) {
    console.error('No changed files resolved; refusing to pass an empty diff.');
    return 2;
  }
  const verdict = classify(files);
  if (verdict.ok) {
    console.log(`OK: ${verdict.reason}.`);
    return 0;
  }
  console.error(`FAIL: ${verdict.reason}`);
  return 1;
}

if (isEntryPoint()) {
  process.exit(main(process.argv.slice(2)));
}
