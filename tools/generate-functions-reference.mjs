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
const BEGIN = '<!-- BEGIN GENERATED EXPORT INDEX (tools/generate-functions-reference.mjs) -->';
const END = '<!-- END GENERATED EXPORT INDEX -->';

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

const doc = readFileSync(DOC, 'utf8');
const bi = doc.indexOf(BEGIN);
const ei = doc.indexOf(END);
if (bi === -1 || ei === -1) {
  // First run: append the generated block at the end of the file.
  const next = `${doc.replace(/\s*$/, '')}\n\n## Complete export index\n\n${out}\n`;
  finish(doc, next);
} else {
  const next = doc.slice(0, bi) + out + doc.slice(ei + END.length);
  finish(doc, next);
}

function finish(prev, next) {
  const check = process.argv.includes('--check');
  if (next === prev) {
    console.log('functions.md export index is up to date.');
    return;
  }
  if (check) {
    // Report what's missing for a useful CI failure.
    const documented = new Set([...prev.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]));
    const missing = Object.keys(mod).filter((n) => !documented.has(n));
    console.error('functions.md export index is STALE. Run `npm run docs:functions`.');
    if (missing.length) console.error(`Undocumented exports (${missing.length}): ${missing.join(', ')}`);
    process.exit(1);
  }
  writeFileSync(DOC, next);
  console.log(`Wrote functions.md export index (${Object.keys(mod).length} exports).`);
}
