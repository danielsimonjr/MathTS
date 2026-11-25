#!/usr/bin/env node
/**
 * Classify a pull request diff as docs-only or not. Used by .github/workflows/ci.yml.
 * Docs-only means every changed path is an allowlisted documentation path; anything else
 * (src, tests, tools, .github, lockfiles, tsconfig, bundle locks, assembly, etc.) is code.
 */
import { readFileSync } from 'node:fs';

/** Return whether a changed path counts as documentation-only for CI skipping. */
export function isDocsOnlyPath(filePath) {
  const path = filePath.replace(/\\/g, '/').trim();
  if (!path) return false;

  if (
    path.startsWith('.changeset/') ||
    path.startsWith('.github/workflows/') ||
    path.startsWith('tools/ci/')
  ) {
    return false;
  }

  return path.endsWith('.md');
}

/** Return whether every changed path in the pull request is documentation-only. */
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
  if (process.stdin.isTTY) return [];
  return readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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