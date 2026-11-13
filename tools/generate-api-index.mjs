#!/usr/bin/env node
/**
 * Generate the static API index page (published at /api/ next to the function
 * reference). One entry per package page in docs/api/, read from each file's first
 * level-one heading and its first prose paragraph.
 *
 *   node tools/generate-api-index.mjs --out=<dir> [--api-dir=docs/api]
 *
 * Output: <out>/index.html. Every entry links to the page on GitHub, because the
 * pages use relative links to the rest of the repository that do not resolve on a
 * static host. The script fails when --out is missing, when the directory holds no
 * page, or when a page has no level-one heading.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
if (typeof args.out !== 'string' || !args.out) {
  throw new Error('api-index: --out=<dir> is required');
}
const OUT = resolve(REPO, args.out);
const API_DIR = resolve(REPO, String(args['api-dir'] ?? 'docs/api'));
const GITHUB_BLOB = 'https://github.com/danielsimonjr/MathTS/blob/main/docs/api';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** First paragraph after the level-one heading, one line, at most 240 characters. */
function summarize(lines) {
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (out.length) break;
      continue;
    }
    if (/^(#|>|<!--|\||```|[-*] )/.test(t)) {
      if (out.length) break;
      continue;
    }
    out.push(t);
  }
  const text = out.join(' ').replace(/`/g, '');
  return text.length > 240 ? `${text.slice(0, 237).replace(/\s+\S*$/, '')}…` : text;
}

const pages = readdirSync(API_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .sort();
if (!pages.length) {
  throw new Error(`api-index: no package pages in ${API_DIR}`);
}

const entries = pages.map((file) => {
  const lines = readFileSync(join(API_DIR, file), 'utf8').split('\n');
  const h1 = lines.findIndex((l) => /^# /.test(l));
  if (h1 < 0) {
    throw new Error(`api-index: ${file} has no level-one heading`);
  }
  return {
    file,
    title: lines[h1].replace(/^# /, '').trim(),
    summary: summarize(lines.slice(h1 + 1)),
  };
});

const items = entries
  .map(
    (e) => `  <li class="entry">
    <a class="title" href="${GITHUB_BLOB}/${esc(e.file)}">${esc(e.title)}</a>
    <p class="summary">${esc(e.summary)}</p>
    <span class="file">docs/api/${esc(e.file)}</span>
  </li>`
  )
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MathTS API Index</title>
<meta name="description" content="Index of the per-package API reference for MathTS.">
<style>
:root { --bg: #0d1117; --surface: #161b22; --border: #30363d; --text: #e6edf3; --text2: #8b949e; --accent: #58a6ff; }
:root[data-theme="light"] { --bg: #ffffff; --surface: #f6f8fa; --border: #d0d7de; --text: #1f2328; --text2: #59636e; --accent: #0969da; }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { --bg: #ffffff; --surface: #f6f8fa; --border: #d0d7de; --text: #1f2328; --text2: #59636e; --accent: #0969da; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
.container { max-width: 960px; margin: 0 auto; padding: 2rem 16px; }
h1 { font-size: 1.75rem; font-weight: 600; }
a { color: var(--accent); }
.nav { font-size: 0.9rem; margin-top: 0.5rem; }
.intro { color: var(--text2); margin: 1rem 0 1.5rem; }
ul { list-style: none; }
.entry { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 0.75rem; }
.title { font-weight: 600; font-size: 1.05rem; }
.summary { color: var(--text); font-size: 0.92rem; margin-top: 0.25rem; }
.file { color: var(--text2); font-family: monospace; font-size: 0.8rem; }
footer { margin-top: 2rem; color: var(--text2); font-size: 0.85rem; }
</style>
</head>
<body>
<div class="container">
<header>
  <h1>MathTS API Index</h1>
  <p class="nav"><a href="../">Function reference</a> · <a href="https://github.com/danielsimonjr/MathTS#readme">Getting started</a></p>
  <p class="intro">Per-package API reference for the public MathTS packages. Each entry opens the page in the repository, where the export lists and usage notes are kept.</p>
</header>
<ul>
${items}
</ul>
<footer>
  <p>Generated from <a href="https://github.com/danielsimonjr/MathTS/tree/main/docs/api">docs/api</a> · ${entries.length} packages</p>
</footer>
</div>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
console.log(
  `api index: ${entries.length} packages (${basename(API_DIR)}/) → ${join(OUT, 'index.html')}`
);
