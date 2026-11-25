#!/usr/bin/env node
/**
 * Classify a pull request diff as docs-only or not. Used by .github/workflows/ci.yml.
 * Docs-only means every changed path is an allowlisted documentation path; anything else
 * (src, tests, tools, .github, lockfiles, tsconfig, bundle locks, assembly, etc.) is code.
 */
import { basename } from 'node:path';

/** Basenames (case-sensitive) treated as license / policy docs at any directory depth. */
const LICENSE_LIKE = new Set([
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'COPYING',
  'COPYING.md',
  'NOTICE',
  'NOTICE.md',
  'AUTHORS',
  'AUTHORS.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'PATENTS',
  'TRADEMARK',
]);

/**
 * @param {string} filePath
 * @returns {boolean}
 */
export function isDocsOnlyPath(filePath) {
  const path = filePath.replace(/\\/g, '/').trim();
  if (!path) return true;

  if (path.endsWith('.md')) return true;
  if (path.startsWith('docs/')) return true;
  if (path.startsWith('.changeset/') && path.endsWith('.md')) return true;
  if (LICENSE_LIKE.has(basename(path))) return true;

  return false;
}

/**
 * @param {string[]} paths
 * @returns {boolean}
 */
export function isDocsOnlyChange(paths) {
  const files = paths.map((p) => p.trim()).filter(Boolean);
  if (files.length === 0) return false;
  return files.every(isDocsOnlyPath);
}

function readChangedPaths() {
  const fromEnv = process.env.CHANGED_FILES?.trim();
  if (fromEnv) {
    return fromEnv.split('\n').filter(Boolean);
  }
  const chunks = [];
  process.stdin.setEncoding('utf8');
  for (const chunk of process.stdin) chunks.push(chunk);
  return chunks.join('').split('\n').filter((line) => line.trim());
}

function main() {
  const event = process.env.GITHUB_EVENT_NAME ?? '';
  if (event && event !== 'pull_request') {
    process.stdout.write('docs_only=false\n');
    return;
  }

  const paths = readChangedPaths();
  const docsOnly = isDocsOnlyChange(paths);
  process.stdout.write(`docs_only=${docsOnly}\n`);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('tools/ci/classify-pr-changes.mjs')) {
  main();
}