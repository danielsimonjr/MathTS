#!/usr/bin/env node
/**
 * Generate (and CI-check) the complete export index for the MathTS API docs so the
 * reference docs cannot silently drift behind each package's export surface.
 *
 *   node tools/generate-functions-reference.mjs          # rewrite the indexes
 *   node tools/generate-functions-reference.mjs --check  # fail if any is stale (CI)
 *
 * Covered docs (each gets a generated "Complete export index" block; only the block
 * between the BEGIN/END markers is generated — the curated prose/tables above it are
 * left untouched):
 *   - functions: docs/reference/functions.md (+ functions.html mirror) AND docs/api/functions.md
 *   - compat / core / matrix / parallel: docs/api/<pkg>.md
 *
 * To cover a new package, add a row to TARGETS.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const BEGIN = '<!-- BEGIN GENERATED EXPORT INDEX (tools/generate-functions-reference.mjs) -->';
const END = '<!-- END GENERATED EXPORT INDEX -->';
// functions.html is a self-rendering page: it embeds the raw markdown in a
// <script id="md" type="text/markdown"> block and renders it client-side. Keep that
// embedded copy in sync (each non-blank line indented 6 spaces to match the
// surrounding HTML, as the page dedents before rendering).
const MD_OPEN = '<script id="md" type="text/markdown">';
const MD_CLOSE = '</script>';

/** Packages whose export index is generated into an API doc. `refDoc`/`html` are the
 *  functions-only canonical reference + its self-rendering html mirror. Paths are
 *  relative to the repo root; `pkg` names the workspace whose dist/index.js is read. */
const TARGETS = [
  {
    pkg: 'functions',
    apiDoc: 'docs/api/functions.md',
    refDoc: 'docs/reference/functions.md',
    html: 'docs/reference/functions.html',
  },
  { pkg: 'compat', apiDoc: 'docs/api/compat.md' },
  { pkg: 'core', apiDoc: 'docs/api/core.md' },
  { pkg: 'matrix', apiDoc: 'docs/api/matrix.md' },
  { pkg: 'parallel', apiDoc: 'docs/api/parallel.md' },
];

const norm = (s) => s.replace(/\r\n/g, '\n');
const fmt = (arr) => arr.slice().sort((a, b) => a.localeCompare(b));
const code = (arr) => fmt(arr).map((n) => `\`${n}\``).join(', ');
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;

/** Build the generated BEGIN..END export-index block for one package's module object. */
function buildIndexBlock(mod, pkg) {
  // Category membership from any exported `typed<Category>` namespace objects
  // (functions groups its dispatchers this way; other packages have none).
  const memberCategory = new Map();
  const CATEGORY_NS = Object.keys(mod)
    .filter((k) => /^typed[A-Z]/.test(k) && mod[k] && typeof mod[k] === 'object')
    .sort();
  for (const ns of CATEGORY_NS) {
    const label = ns.replace(/^typed/, '');
    for (const member of Object.keys(mod[ns])) {
      if (!memberCategory.has(member)) memberCategory.set(member, label);
    }
  }

  const classes = [];
  const constants = [];
  const factoryShadows = [];
  const byCategory = new Map(); // label -> string[]
  const uncategorizedFns = [];

  for (const name of Object.keys(mod)) {
    if (/^typed[A-Z]/.test(name) && typeof mod[name] === 'object') continue; // namespace objects
    const val = mod[name];
    if (name.startsWith('factory_')) {
      factoryShadows.push(name);
      continue;
    }
    if (typeof val === 'function') {
      const isClass =
        PASCAL.test(name) && val.prototype && Object.getOwnPropertyNames(val.prototype).length > 1;
      if (isClass) classes.push(name);
      else if (memberCategory.has(name)) {
        const cat = memberCategory.get(name);
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat).push(name);
      } else uncategorizedFns.push(name);
    } else {
      constants.push(name); // numbers, Units (physical constants), objects
    }
  }

  const total = Object.keys(mod).length;
  let out = `${BEGIN}\n\n`;
  out += `> **Generated** — do not edit by hand. Run \`npm run docs:functions\` after\n`;
  out += `> adding or removing a public export. Complete index of every public name in\n`;
  out += `> \`@danielsimonjr/mathts-${pkg}\` (${total} exports).\n\n`;

  if (byCategory.size) {
    out += `### Functions by category\n\n`;
    for (const cat of [...byCategory.keys()].sort()) {
      out += `**${cat}** (${byCategory.get(cat).length}): ${code(byCategory.get(cat))}\n\n`;
    }
    if (uncategorizedFns.length) {
      out += `**Factory / uncategorized** (${uncategorizedFns.length}): ${code(uncategorizedFns)}\n\n`;
    }
  } else if (uncategorizedFns.length) {
    out += `### Functions (${uncategorizedFns.length})\n\n${code(uncategorizedFns)}\n\n`;
  }
  if (constants.length) out += `### Constants & values (${constants.length})\n\n${code(constants)}\n\n`;
  if (classes.length) out += `### Classes & types (${classes.length})\n\n${code(classes)}\n\n`;
  if (factoryShadows.length) {
    out += `### Factory-shadowed (\`factory_*\`, ${factoryShadows.length})\n\n`;
    out += `These duplicate a typed export under a \`factory_\` prefix.\n\n${code(factoryShadows)}\n\n`;
  }
  if (CATEGORY_NS.length) {
    out += `### Namespace aggregates (${CATEGORY_NS.length})\n\n`;
    out += `Per-category objects bundling the functions above.\n\n${code(CATEGORY_NS)}\n\n`;
  }
  out += `${END}`;
  return { block: out, total };
}

/** Splice the block between BEGIN/END markers, or append it under a heading on first run. */
function spliceIndex(docText, block) {
  const bi = docText.indexOf(BEGIN);
  const ei = docText.indexOf(END);
  return bi === -1 || ei === -1
    ? `${docText.replace(/\s*$/, '')}\n\n## Complete export index\n\n${block}\n`
    : docText.slice(0, bi) + block + docText.slice(ei + END.length);
}

/** Replace the body of `<script id="md" …>…</script>` with `md` (6-space indented). */
function embedMarkdown(htmlRaw, md) {
  const h = norm(htmlRaw);
  const open = h.indexOf(MD_OPEN);
  if (open === -1) throw new Error(`functions.html: cannot find ${MD_OPEN}`);
  const bodyStart = open + MD_OPEN.length;
  const close = h.indexOf(MD_CLOSE, bodyStart);
  if (close === -1) throw new Error(`functions.html: cannot find ${MD_CLOSE} after the md block`);
  const indented = norm(md)
    .replace(/\s+$/, '')
    .split('\n')
    .map((l) => (l === '' ? '' : '      ' + l))
    .join('\n');
  return `${h.slice(0, bodyStart)}\n${indented}\n    ${h.slice(close)}`;
}

// --- Build the desired content for every tracked doc file ------------------------
const jobs = []; // { file, prev, next, label, isMd }
for (const t of TARGETS) {
  const mod = await import(pathToFileURL(resolve(REPO, t.pkg, 'dist', 'index.js')).href);
  const { block, total } = buildIndexBlock(mod, t.pkg);
  const docPaths = [t.refDoc, t.apiDoc].filter(Boolean);
  let mdForHtml = null;
  for (const rel of docPaths) {
    const file = resolve(REPO, rel);
    const prev = readFileSync(file, 'utf8');
    const next = spliceIndex(prev, block);
    jobs.push({ file, prev, next, label: `${rel} export index (${total} exports)`, isMd: true });
    if (rel === t.refDoc) mdForHtml = next;
  }
  if (t.html && mdForHtml) {
    const file = resolve(REPO, t.html);
    const prev = readFileSync(file, 'utf8');
    jobs.push({ file, prev, next: embedMarkdown(prev, mdForHtml), label: `${t.html} embedded markdown`, isMd: false });
  }
}

const check = process.argv.includes('--check');
const stale = jobs.filter((j) => norm(j.next) !== norm(j.prev));

if (check) {
  if (!stale.length) {
    console.log(`All ${jobs.length} generated doc blocks are up to date.`);
    process.exit(0);
  }
  for (const j of stale) {
    console.error(`${j.label} is STALE. Run \`npm run docs:functions\`.`);
    if (j.isMd) {
      const documented = new Set([...j.prev.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]));
      // undocumented names appear in the regenerated content but not the on-disk file
      const wanted = new Set([...j.next.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]));
      const missing = [...wanted].filter((n) => !documented.has(n));
      if (missing.length) console.error(`  Undocumented names (${missing.length}): ${missing.join(', ')}`);
    }
  }
  process.exit(1);
}

for (const j of jobs) {
  if (norm(j.next) === norm(j.prev)) {
    console.log(`${j.label} is up to date.`);
    continue;
  }
  const eol = j.prev.includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(j.file, eol === '\r\n' ? norm(j.next).replace(/\n/g, '\r\n') : norm(j.next));
  console.log(`Wrote ${j.label}.`);
}
