/**
 * Find test files that read or execute repository Markdown / docs paths at runtime.
 * Used by docs-only-ci-guard to ensure every consumer is listed in docs-only-manifest.json.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repoRoot } from '../test/workspaces.mjs';

/** @typedef {{ file: string, reasons: string[] }} Consumer */

const RUNTIME_PATTERNS = [
  { re: /readFileSync\s*\([^)]*\.md/, reason: 'readFileSync(.md)' },
  { re: /readFileSync\s*\([^)]*README/, reason: 'readFileSync(README)' },
  { re: /readFileSync\s*\([^)]*['"`]docs\//, reason: 'readFileSync(docs/)' },
  { re: /fileURLToPath\s*\(\s*new URL\s*\([^)]*\.md/, reason: 'URL(.md)' },
  { re: /\bextractFences\b/, reason: 'extractFences' },
  { re: /\bsweepDocs\b/, reason: 'sweepDocs' },
  { re: /\bdocsExamples\b/, reason: 'docsExamples' },
  { re: /\bmarkdownFiles\b/, reason: 'markdownFiles' },
  { re: /\bfenceProblems\b/, reason: 'fenceProblems' },
  { re: /\bderiveAsyncExports\b/, reason: 'deriveAsyncExports' },
  { re: /['"`]docs\/(api|reference)\//, reason: 'docs/api or reference path' },
  { re: /resolve\([^)]*docs[^)]*\.md/, reason: 'resolve(docs/*.md)' },
];

const SCAN_ROOTS = ['tests', 'core/tests', 'functions/tests', 'expression/tests', 'compat/tests', 'matrix/tests', 'parallel/tests', 'evaluator/tests', 'parser/tests', 'units/tests', 'workbook/tests', 'plot/tests', 'tensor/tests', 'autograd/tests', 'gpu/tests', 'packages'];

const IGNORE = new Set([
  'tools/test/docs-only-ci-guard.test.mjs',
  'tools/test/classify-pr-changes.test.mjs',
]);

/** Recursively scan a directory for `*.test.ts` / `*.test.mjs` files that read Markdown at runtime. */
function walkTests(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      walkTests(path, out);
      continue;
    }
    if (!/\.test\.(ts|mjs)$/.test(ent.name)) continue;
    const rel = relative(repoRoot, path).replaceAll('\\', '/');
    if (IGNORE.has(rel)) continue;
    const text = readFileSync(path, 'utf8');
    const reasons = RUNTIME_PATTERNS.filter(({ re }) => re.test(text)).map((p) => p.reason);
    if (reasons.length) out.push({ file: rel, reasons });
  }
}

/** Return every test file that matches {@link RUNTIME_PATTERNS}, sorted by path. */
export function discoverMdConsumers() {
  const out = /** @type {Consumer[]} */ ([]);
  for (const root of SCAN_ROOTS) {
    walkTests(join(repoRoot, root), out);
  }
  walkTests(join(repoRoot, 'tools/test'), out);
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

function readManifest() {
  return JSON.parse(readFileSync(join(repoRoot, 'tools/ci/docs-only-manifest.json'), 'utf8'));
}

/** Vitest paths listed in `tools/ci/docs-only-manifest.json` (including filtered parity entries). */
export function manifestVitestFiles() {
  const manifest = readManifest();
  const set = new Set();
  for (const entry of manifest.vitest) {
    if (typeof entry === 'string') set.add(entry);
    else set.add(entry.file);
  }
  return set;
}

/** Manifest `excludedConsumers` paths (full CI only; not run on docs-only PRs). */
function manifestExcludedConsumers() {
  const manifest = readManifest();
  return new Set((manifest.excludedConsumers ?? []).map((e) => e.file));
}

/** Manifest `nodeTest` paths run via `node --test` on docs-only PRs. */
function manifestNodeTestFiles() {
  const manifest = readManifest();
  return new Set(manifest.nodeTest ?? []);
}

/** Test files that read Markdown but are not covered by the docs-only manifest. */
export function uncoveredMdConsumers() {
  const allowed = manifestVitestFiles();
  const excluded = manifestExcludedConsumers();
  const nodeTests = manifestNodeTestFiles();
  return discoverMdConsumers()
    .map((c) => c.file)
    .filter((file) => !allowed.has(file) && !excluded.has(file) && !nodeTests.has(file));
}