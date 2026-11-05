#!/usr/bin/env node
/**
 * Generate the static MathTS function-reference landing site (the sibling of
 * https://danielsimonjr.com/mathjs/) from the curated reference document.
 *
 *   node tools/generate-landing-site.mjs [--out=docs/landing] [--tests=N]
 *
 * Inputs (read-only):
 *   docs/reference/functions.md   curated `## <Domain>` tables (signature, description,
 *                                 types, acceleration) + the generated export index block,
 *                                 whose "**Domain** (n): `a`, `b`" lines are the
 *                                 authoritative category membership.
 *   functions/package.json        version shown in the hero.
 *
 * Outputs:
 *   <out>/index.html                 hero stats, search box, one card per category
 *   <out>/functions/<slug>.html      one card per function in that category
 *
 * The pages are single self-contained HTML files (inline CSS, no CDN) so the
 * folder can be copied verbatim to a static host, e.g. danielsimonjr.com/mathts/.
 * Re-run after `bun run docs:functions`; the pre-existing output is overwritten.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const OUT = resolve(REPO, String(args.out ?? 'docs/landing'));
const TESTS = args.tests ? Number(args.tests) : null;

const GITHUB = 'https://github.com/danielsimonjr/MathTS';
const NPM = 'https://www.npmjs.com/package/@danielsimonjr/mathts-functions';
const DOCS = `${GITHUB}/blob/main/docs/reference/functions.md`;

const doc = readFileSync(resolve(REPO, 'docs/reference/functions.md'), 'utf8');
const version = JSON.parse(readFileSync(resolve(REPO, 'functions/package.json'), 'utf8')).version;

// ---------------------------------------------------------------------------
// 1. Category membership from the generated index block.
// ---------------------------------------------------------------------------
const [curatedText, indexText = ''] = doc.split('## Complete export index');
const exportTotal = Number((indexText.match(/\((\d+) exports\)/) ?? [])[1] ?? 0);

/** @type {Map<string, string[]>} domain -> names (index order) */
const domains = new Map();
const fnSection = indexText.split('### Functions by category')[1]?.split(/\n### /)[0] ?? '';
for (const m of fnSection.matchAll(/^\*\*(.+?)\*\* \((\d+)\): (.+)$/gm)) {
  const names = [...m[3].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
  domains.set(m[1], names);
}

// ---------------------------------------------------------------------------
// 2. Signatures / descriptions / columns from the curated tables.
// ---------------------------------------------------------------------------
/** @type {Map<string, {sigs: string[], desc: string, extra: Record<string,string>, domain: string}>} */
const info = new Map();
/** @type {Map<string, string>} domain -> intro paragraph */
const intros = new Map();

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));

let section = null;
let header = null;
let introBuf = [];
let introDone = false;
let inCode = false;
for (const line of curatedText.split('\n')) {
  if (line.trimStart().startsWith('```')) {
    inCode = !inCode;
    continue;
  }
  if (inCode) continue;
  const h2 = line.match(/^## (.+)/);
  if (h2) {
    section = h2[1].trim();
    header = null;
    introBuf = [];
    introDone = false;
    continue;
  }
  if (!section) continue;
  if (line.startsWith('### ')) {
    header = null;
    continue;
  }
  if (line.startsWith('|')) {
    const cells = splitRow(line);
    if (/^-+$/.test(cells[0].replace(/\s/g, '').replace(/:/g, '-'))) continue; // separator
    if (!header) {
      header = cells.map((c) => c.toLowerCase());
      introDone = true;
      continue;
    }
    const sigs = [...cells[0].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (!sigs.length) continue;
    const extra = {};
    header.forEach((h, i) => {
      if (i >= 2 && cells[i]) extra[h] = cells[i];
    });
    const desc = cells[1] ?? '';
    for (const sig of sigs) {
      const name = sig.match(/^([A-Za-z_$][\w$]*)/)?.[1];
      if (!name) continue;
      const cur = info.get(name);
      if (cur) {
        if (!cur.sigs.includes(sig)) cur.sigs.push(sig);
      } else info.set(name, { sigs: [sig], desc, extra, domain: section });
    }
    continue;
  }
  if (!introDone) {
    if (line.trim() === '' && introBuf.length) introDone = true;
    else if (line.trim() && !line.startsWith('>') && !line.startsWith('<!--'))
      introBuf.push(line.trim());
    if (introDone || introBuf.length) intros.set(section, introBuf.join(' '));
  }
}

// 2b. Prose fallback: for a name with no table row, the first paragraph of the
// curated text that mentions it in backticks (outside code fences and tables).
/** @type {Map<string, string>} */
const prose = new Map();
{
  const paras = [];
  let buf = [];
  let fence = false;
  for (const line of curatedText.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      fence = !fence;
      continue;
    }
    if (fence || line.startsWith('|') || line.startsWith('#') || line.startsWith('<!--')) {
      if (buf.length) paras.push(buf.join(' '));
      buf = [];
      continue;
    }
    if (line.trim() === '') {
      if (buf.length) paras.push(buf.join(' '));
      buf = [];
    } else buf.push(line.trim().replace(/^[-*]\s+/, ''));
  }
  if (buf.length) paras.push(buf.join(' '));
  for (const para of paras) {
    for (const m of para.matchAll(/`([A-Za-z_$][\w$]*)(?:\([^`]*\))?`/g)) {
      if (!prose.has(m[1]))
        prose.set(m[1], para.length > 320 ? para.slice(0, 317).replace(/\s+\S*$/, '') + '…' : para);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. HTML helpers.
// ---------------------------------------------------------------------------
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
/** Minimal inline markdown: `code`, **bold**, [text](url), and HTML-escape the rest. */
const md = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])[_*]([^_*`<>]+)[_*](?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
      /^https?:/.test(u) ? `<a href="${u}">${t}</a>` : t
    );
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const fmtInt = (n) => n.toLocaleString('en-US');

const CSS_VARS = `:root {
  --bg: #0d1117; --surface: #161b22; --border: #30363d;
  --text: #e6edf3; --text2: #8b949e; --accent: #58a6ff;
  --green: #3fb950; --purple: #bc8cff; --orange: #d29922;
  --pink: #f778ba; --red: #f85149; --code-bg: #1c2128;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
a { color: var(--accent); }
code { background: var(--code-bg); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9rem; }
.search-box { width: 100%; padding: 0.75rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 1rem; margin: 1.5rem 0; }
.search-box:focus { outline: none; border-color: var(--accent); }
footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--text2); font-size: 0.85rem; text-align: center; }`;

const INDEX_CSS = `${CSS_VARS}
.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
header { border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; margin-bottom: 2rem; }
h1 { font-size: 2rem; font-weight: 600; }
h1 span { color: var(--accent); }
.subtitle { color: var(--text2); margin-top: 0.5rem; }
.stats { display: flex; gap: 2rem; margin-top: 1rem; flex-wrap: wrap; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.5rem; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.85rem; color: var(--text2); }
.install { margin-top: 1.25rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; }
.install code { font-size: 0.95rem; padding: 0.5rem 0.9rem; border: 1px solid var(--border); }
.install a { font-size: 0.9rem; }
.categories { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem; }
.cat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; transition: border-color 0.2s; }
.cat-card:hover { border-color: var(--accent); }
.cat-card a { color: var(--text); text-decoration: none; }
.cat-title { font-size: 1.1rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.cat-count { background: var(--accent); color: var(--bg); font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 12px; font-weight: 700; white-space: nowrap; }
.cat-desc { color: var(--text2); font-size: 0.85rem; margin-top: 0.5rem; }
.cat-funcs { color: var(--text2); font-size: 0.8rem; margin-top: 0.75rem; font-family: monospace; }`;

const PAGE_CSS = `${CSS_VARS}
.container { max-width: 960px; margin: 0 auto; padding: 2rem; }
header { border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 2rem; }
h1 { font-size: 1.75rem; font-weight: 600; }
h1 span { color: var(--accent); }
.breadcrumb { font-size: 0.85rem; color: var(--text2); margin-bottom: 0.5rem; }
.breadcrumb a { color: var(--accent); text-decoration: none; }
.cat-desc { color: var(--text2); margin-top: 0.5rem; }
.func-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
.func-card:target { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.func-name { font-size: 1.15rem; font-weight: 700; color: var(--accent); font-family: monospace; }
.func-desc { margin: 0.5rem 0; color: var(--text); }
.func-section { margin-top: 0.75rem; }
.func-section-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--text2); letter-spacing: 0.05em; margin-bottom: 0.25rem; }
.example { background: var(--code-bg); padding: 0.5rem 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.85rem; margin-top: 0.25rem; color: var(--green); white-space: pre-wrap; }
.meta { display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.85rem; margin-top: 0.5rem; }
.meta .k { color: var(--text2); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; margin-right: 0.35rem; }
.types { color: var(--purple); font-family: monospace; }
.accel { color: var(--orange); font-family: monospace; }
.undocumented { color: var(--text2); font-style: italic; }
.prose { color: var(--text2); }`;

const today = new Date().toISOString().slice(0, 10);
const footer = `<footer>
  <p>Generated ${today} from <a href="${DOCS}">docs/reference/functions.md</a> · <a href="${GITHUB}">GitHub</a> · <a href="${NPM}">npm</a></p>
</footer>`;

// ---------------------------------------------------------------------------
// 4. Category pages.
// ---------------------------------------------------------------------------
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(resolve(OUT, 'functions'), { recursive: true });

const categories = [];
let documentedFns = 0;
for (const [domain, names] of domains) {
  if (!names.length) continue;
  const file = `${slug(domain)}.html`;
  const intro = intros.get(domain) ?? '';
  const cards = names
    .map((name) => {
      const f = info.get(name);
      if (f || prose.has(name)) documentedFns++;
      const sigs = f?.sigs ?? [`${name}(…)`];
      const fromProse = !f && prose.get(name);
      const desc = f
        ? md(f.desc)
        : fromProse
          ? `<span class="prose">${md(fromProse)}</span>`
          : '<span class="undocumented">Listed in the export index; see the source for details.</span>';
      const meta = [];
      if (f?.extra.types)
        meta.push(
          `<span><span class="k">Types</span><span class="types">${md(f.extra.types)}</span></span>`
        );
      if (f?.extra.accel && f.extra.accel !== '—')
        meta.push(
          `<span><span class="k">Accel</span><span class="accel">${md(f.extra.accel)}</span></span>`
        );
      return `<div class="func-card" id="${esc(name)}" data-name="${esc(name.toLowerCase())}">
  <div class="func-name">${esc(name)}</div>
  <div class="func-desc">${desc}</div>
  <div class="func-section">
    <div class="func-section-title">Syntax</div>
    <div class="example">${sigs.map(esc).join('\n')}</div>
  </div>${meta.length ? `\n  <div class="meta">${meta.join('')}</div>` : ''}
</div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(domain)} — MathTS Reference</title>
<style>
${PAGE_CSS}
</style>
</head>
<body>
<div class="container">
<header>
  <div class="breadcrumb"><a href="../index.html">MathTS Reference</a> &rsaquo; ${esc(domain)}</div>
  <h1><span>${esc(domain)}</span> (${names.length})</h1>
  ${intro ? `<p class="cat-desc">${md(intro)}</p>` : ''}
</header>

<input type="text" class="search-box" id="search" placeholder="Filter ${esc(domain)}..." oninput="filterFuncs()">
${cards}

${footer}
</div>
<script>
function filterFuncs() {
  const q = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.func-card').forEach(card => {
    card.style.display = (!q || card.dataset.name.includes(q) || card.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
}
</script>
</body>
</html>
`;
  writeFileSync(resolve(OUT, 'functions', file), html);
  categories.push({ domain, names, file, intro });
}

// ---------------------------------------------------------------------------
// 5. Index page.
// ---------------------------------------------------------------------------
const totalFns = categories.reduce((s, c) => s + c.names.length, 0);
const stats = [
  [fmtInt(totalFns), 'Functions'],
  [String(categories.length), 'Categories'],
  ...(TESTS ? [[fmtInt(TESTS), 'Tests Passing']] : []),
  [`v${version}`, 'functions Version'],
];
const cardsHtml = categories
  .map(({ domain, names, file, intro }) => {
    const sample =
      names.slice(0, 12).join(', ') +
      (names.length > 12 ? `, ... (+${names.length - 12} more)` : '');
    return `  <div class="cat-card" data-names="${esc(names.join(' '))}">
    <a href="functions/${file}">
      <div class="cat-title">${esc(domain)} <span class="cat-count">${names.length}</span></div>
      <div class="cat-desc">${intro ? md(intro.length > 160 ? intro.slice(0, 157).replace(/\s+\S*$/, '') + '…' : intro) : ''}</div>
      <div class="cat-funcs">${esc(sample)}</div>
    </a>
  </div>`;
  })
  .join('\n');

const index = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MathTS Function Reference</title>
<meta name="description" content="Complete API reference for every mathematical function in MathTS, the TypeScript rewrite of mathjs with WASM, WebWorker and WebGPU acceleration.">
<style>
${INDEX_CSS}
</style>
</head>
<body>
<div class="container">
<header>
  <h1><span>MathTS</span> Function Reference</h1>
  <p class="subtitle">Complete API reference for all mathematical functions in the TypeScript rewrite of mathjs — signatures, accepted types, and the acceleration tier (WASM, WebWorker, WebGPU) each one uses.</p>
  <div class="stats">
${stats.map(([v, l]) => `    <div class="stat"><div class="stat-value">${esc(v)}</div><div class="stat-label">${esc(l)}</div></div>`).join('\n')}
  </div>
  <div class="install">
    <code>npm install @danielsimonjr/mathts-functions</code>
    <a href="${GITHUB}#readme">Getting started</a>
    <a href="${GITHUB}/blob/main/docs/migration-guide.md">Migrating from mathjs</a>
  </div>
</header>

<input type="text" class="search-box" id="search" placeholder="Search functions... (e.g. besselJ, tanhSinh, lombScargle)" oninput="filterCards()">

<div class="categories" id="categories">
${cardsHtml}
</div>

${footer}
</div>

<script>
function filterCards() {
  const q = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.cat-card').forEach(card => {
    const names = card.dataset.names.toLowerCase();
    card.style.display = (!q || names.includes(q)) ? '' : 'none';
  });
}
</script>
</body>
</html>
`;
writeFileSync(resolve(OUT, 'index.html'), index);

console.log(
  `landing site: ${categories.length} categories, ${totalFns} functions (${documentedFns} with curated rows, ${totalFns - documentedFns} index-only), ${exportTotal} exports in the barrel → ${OUT}`
);
