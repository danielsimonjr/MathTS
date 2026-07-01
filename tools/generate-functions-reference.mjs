#!/usr/bin/env node
/**
 * GC2 — generate (and CI-check) the complete export index in
 * docs/reference/functions.md so the reference cannot silently drift behind the
 * `@danielsimonjr/mathts-functions` export surface.
 *
 *   node tools/generate-functions-reference.mjs          # rewrite the index
 *   node tools/generate-functions-reference.mjs --check  # fail if stale (CI)
 *
 * Only the block between the BEGIN/END markers is generated; the curated prose
 * above it is left untouched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const DOC = resolve(REPO, 'docs', 'reference', 'functions.md');
const HTML = resolve(REPO, 'docs', 'reference', 'functions.html');
// The hand-curated per-package API doc: its highlight tables + examples are curated
// prose, but the same generated export index is appended so it cannot drift behind
// the export surface (the whole point — it had frozen at "158 exports" while the real
// count grew to 800+).
const API_DOC = resolve(REPO, 'docs', 'api', 'functions.md');
const BEGIN = '<!-- BEGIN GENERATED EXPORT INDEX (tools/generate-functions-reference.mjs) -->';
const END = '<!-- END GENERATED EXPORT INDEX -->';
// functions.html is a self-rendering page: it embeds the raw markdown in a
// <script id="md" type="text/markdown"> block and renders it client-side. Keep
// that embedded copy in sync with functions.md (each non-blank line indented 6
// spaces to match the surrounding HTML, as the page dedents before rendering).
const MD_OPEN = '<script id="md" type="text/markdown">';
const MD_CLOSE = '</script>';

const mod = await import(pathToFileURL(resolve(REPO, 'functions', 'dist', 'index.js')).href);

// Category membership from the exported `typed<Category>` namespace objects.
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

const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const classes = [];
const constants = [];
const factoryShadows = [];
const byCategory = new Map(); // label -> string[]
const uncategorizedFns = [];

for (const name of Object.keys(mod)) {
  if (name.startsWith('typed') && /^typed[A-Z]/.test(name) && typeof mod[name] === 'object') {
    continue; // the namespace objects themselves aren't part of the index
  }
  const val = mod[name];
  if (name.startsWith('factory_')) {
    factoryShadows.push(name);
    continue;
  }
  if (typeof val === 'function') {
    // A class if PascalCase with a non-trivial prototype (Complex, Unit, …).
    const isClass =
      PASCAL.test(name) && val.prototype && Object.getOwnPropertyNames(val.prototype).length > 1;
    if (isClass) {
      classes.push(name);
    } else if (memberCategory.has(name)) {
      const cat = memberCategory.get(name);
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(name);
    } else {
      uncategorizedFns.push(name);
    }
  } else {
    constants.push(name); // numbers, Units (physical constants), objects
  }
}

const fmt = (arr) => arr.slice().sort((a, b) => a.localeCompare(b));
const code = (arr) => fmt(arr).map((n) => `\`${n}\``).join(', ');

let out = `${BEGIN}\n\n`;
out += `> **Generated** — do not edit by hand. Run \`npm run docs:functions\` after\n`;
out += `> adding or removing a public export. Complete index of every public name in\n`;
out += `> \`@danielsimonjr/mathts-functions\` (${Object.keys(mod).length} exports).\n\n`;

out += `### Functions by category\n\n`;
for (const cat of [...byCategory.keys()].sort()) {
  out += `**${cat}** (${byCategory.get(cat).length}): ${code(byCategory.get(cat))}\n\n`;
}

if (uncategorizedFns.length) {
  out += `**Factory / uncategorized** (${uncategorizedFns.length}): ${code(uncategorizedFns)}\n\n`;
}
out += `### Constants & values (${constants.length})\n\n${code(constants)}\n\n`;
out += `### Classes & types (${classes.length})\n\n${code(classes)}\n\n`;
out += `### Factory-shadowed (\`factory_*\`, ${factoryShadows.length})\n\n`;
out += `These duplicate a typed export under a \`factory_\` prefix.\n\n${code(factoryShadows)}\n\n`;
out += `### Namespace aggregates (${CATEGORY_NS.length})\n\n`;
out += `Per-category objects bundling the functions above.\n\n${code(CATEGORY_NS)}\n\n`;
out += `${END}`;

// Compare/emit line-ending-agnostically: on a Windows checkout the on-disk files
// may be CRLF (git autocrlf) while generated content is LF, which would otherwise
// report a false "stale" and churn line endings on every run.
const norm = (s) => s.replace(/\r\n/g, '\n');
const check = process.argv.includes('--check');

// --- functions.md: splice the regenerated export index into place ---
const doc = readFileSync(DOC, 'utf8');
const bi = doc.indexOf(BEGIN);
const ei = doc.indexOf(END);
const mdNext =
  bi === -1 || ei === -1
    ? `${doc.replace(/\s*$/, '')}\n\n## Complete export index\n\n${out}\n` // first run: append
    : doc.slice(0, bi) + out + doc.slice(ei + END.length);
const mdStale = norm(mdNext) !== norm(doc);

// --- functions.html: re-embed the up-to-date markdown into its <script id="md"> ---
const html = readFileSync(HTML, 'utf8');
const htmlNext = embedMarkdown(html, mdNext);
const htmlStale = norm(htmlNext) !== norm(html);

// --- docs/api/functions.md: splice/append the same generated index below the curated prose ---
const apiDoc = readFileSync(API_DOC, 'utf8');
const abi = apiDoc.indexOf(BEGIN);
const aei = apiDoc.indexOf(END);
const apiNext =
  abi === -1 || aei === -1
    ? `${apiDoc.replace(/\s*$/, '')}\n\n## Complete export index\n\n${out}\n` // first run: append
    : apiDoc.slice(0, abi) + out + apiDoc.slice(aei + END.length);
const apiStale = norm(apiNext) !== norm(apiDoc);

if (check) {
  if (!mdStale && !htmlStale && !apiStale) {
    console.log('functions.md + functions.html + api/functions.md are up to date.');
    process.exit(0);
  }
  for (const [stale, file, label] of [
    [mdStale, doc, 'docs/reference/functions.md'],
    [apiStale, apiDoc, 'docs/api/functions.md'],
  ]) {
    if (!stale) continue;
    const documented = new Set([...file.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]));
    const missing = Object.keys(mod).filter((n) => !documented.has(n));
    console.error(`${label} export index is STALE. Run \`npm run docs:functions\`.`);
    if (missing.length) console.error(`  Undocumented exports (${missing.length}): ${missing.join(', ')}`);
  }
  if (htmlStale) {
    console.error('functions.html embedded markdown is STALE. Run `npm run docs:functions`.');
  }
  process.exit(1);
}

writeIfStale(DOC, doc, mdNext, mdStale, `functions.md export index (${Object.keys(mod).length} exports)`);
writeIfStale(HTML, html, htmlNext, htmlStale, 'functions.html embedded markdown');
writeIfStale(API_DOC, apiDoc, apiNext, apiStale, `api/functions.md export index (${Object.keys(mod).length} exports)`);

/** Replace the body of `<script id="md" type="text/markdown">…</script>` with `md`,
 *  indenting each non-blank line 6 spaces to match the page (it dedents at render). */
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

/** Write `next` to `file` preserving the original file's dominant EOL; no-op if unchanged. */
function writeIfStale(file, prev, next, stale, label) {
  if (!stale) {
    console.log(`${label} is up to date.`);
    return;
  }
  const eol = prev.includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(file, eol === '\r\n' ? norm(next).replace(/\n/g, '\r\n') : norm(next));
  console.log(`Wrote ${label}.`);
}
