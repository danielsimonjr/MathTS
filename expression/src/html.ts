/**
 * Assemble a generic document structure into one self-contained HTML5 file —
 * markdown prose, MathML equations, embedded code + outputs, test badges, and
 * (pre-rendered) charts, with an inlined stylesheet (no external requests).
 *
 * Operates on a plain `RenderDoc` (not the workbook's `Workbook` type) to avoid
 * a dependency inversion. `parse` is injected by the caller (the assembled
 * `parse` lives in the functions package) to render equation expressions; cell
 * outputs are pre-formatted strings supplied by the caller. All user content is
 * HTML-escaped before embedding.
 */

import { toMathML, mathMLError } from './toMathML.js';
import { markdownToHtml } from './markdown.js';

export interface RenderCell {
  type: string; // markdown | equation | code | test | data | chart
  content: string;
  id?: string;
  /** Pre-formatted output string (the caller formats values); omitted if none. */
  output?: string;
  error?: string;
  /** For `test` cells: whether the assertion passed. */
  passed?: boolean;
  /** For `chart` cells: pre-rendered inline SVG. */
  chartSvg?: string;
  /** Optional diagnostic note (e.g. a chart whose data didn't resolve). */
  note?: string;
}

export interface RenderDoc {
  title?: string;
  author?: string;
  description?: string;
  tags?: string[];
  cells: RenderCell[];
}

export interface ToHtmlOptions {
  /** Parser for equation expressions (e.g. the functions package `parse`). */
  parse?: (expr: string) => unknown;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderEquation(content: string, parse?: (expr: string) => unknown): string {
  let math: string;
  if (!parse) {
    math = mathMLError(content);
  } else {
    try {
      math = toMathML(parse(content));
    } catch {
      math = mathMLError(content);
    }
  }
  return `<figure class="cell cell-eq">${math}</figure>`;
}

function renderCell(cell: RenderCell, parse?: (expr: string) => unknown): string {
  const cap = cell.id ? `<figcaption>${esc(cell.id)}</figcaption>` : '';
  switch (cell.type) {
    case 'markdown':
      return `<section class="cell cell-md">${markdownToHtml(cell.content)}</section>`;
    case 'equation':
      return renderEquation(cell.content, parse);
    case 'code': {
      const src = `<pre class="src"><code>${esc(cell.content)}</code></pre>`;
      let res = '';
      if (cell.error !== undefined) res = `<div class="cell-error">${esc(cell.error)}</div>`;
      else if (cell.output !== undefined) res = `<div class="cell-output">${esc(cell.output)}</div>`;
      return `<figure class="cell cell-code">${cap}${src}${res}</figure>`;
    }
    case 'test': {
      const err = cell.error;
      let badge: string;
      let cls: string;
      if (err !== undefined) {
        badge = '⚠';
        cls = 'err';
      } else if (cell.passed === true) {
        badge = '✓';
        cls = 'pass';
      } else if (cell.passed === false) {
        badge = '✗';
        cls = 'fail';
      } else {
        badge = '○'; // never run / no cached result
        cls = 'nrun';
      }
      const note = err !== undefined ? ` <span class="note">${esc(err)}</span>` : '';
      return `<figure class="cell cell-test ${cls}"><span class="badge">${badge}</span> <code>${esc(cell.content)}</code>${note}</figure>`;
    }
    case 'data': {
      const val = cell.error !== undefined ? esc(cell.error) : esc(cell.output ?? '');
      return `<figure class="cell cell-data">${cap}<pre><code>${val}</code></pre></figure>`;
    }
    case 'chart': {
      // Note is a <p>, not a second <figcaption> (a <figure> permits only one).
      const note = cell.note ? `<p class="note">⚠ ${esc(cell.note)}</p>` : '';
      return `<figure class="cell cell-chart">${cap}${cell.chartSvg ?? '<p class="note">no chart</p>'}${note}</figure>`;
    }
    default:
      return `<figure class="cell"><pre><code>${esc(cell.content)}</code></pre></figure>`;
  }
}

/** A small static stylesheet (explicit colors, system fonts — no external assets). */
export function toCSS(): string {
  return [
    ':root{--fg:#1a1a2e;--muted:#5a5a72;--bg:#fff;--code-bg:#f4f4f8;--border:#e0e0ea;--accent:#2a4d8f;--pass:#1a7f37;--fail:#cf222e;}',
    '*{box-sizing:border-box}',
    'body{margin:0;color:var(--fg);background:var(--bg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
    'main{max-width:48rem;margin:0 auto;padding:2rem 1.25rem}',
    'header{border-bottom:2px solid var(--border);margin-bottom:1.5rem;padding-bottom:1rem}',
    '.doc-title{margin:0 0 .25rem;font-size:1.9rem}',
    '.doc-meta,.doc-desc{color:var(--muted);margin:.15rem 0}',
    '.tag{display:inline-block;background:var(--code-bg);border:1px solid var(--border);border-radius:1rem;padding:.05rem .55rem;font-size:.8rem;margin-right:.3rem}',
    '.cell{margin:1.1rem 0}',
    'h1,h2,h3,h4{line-height:1.25}',
    'code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
    'pre{background:var(--code-bg);border:1px solid var(--border);border-radius:6px;padding:.7rem .9rem;overflow:auto}',
    '.cell-code{border-left:3px solid var(--accent);padding-left:.9rem}',
    '.cell-code figcaption{color:var(--muted);font-size:.8rem;font-family:ui-monospace,monospace;margin-bottom:.2rem}',
    '.cell-output{background:#fafaff;border:1px solid var(--border);border-radius:6px;padding:.5rem .9rem;margin-top:.4rem;white-space:pre-wrap}',
    '.cell-error{background:#fff0f0;border:1px solid #f3c0c0;color:var(--fail);border-radius:6px;padding:.5rem .9rem;margin-top:.4rem}',
    '.cell-eq{text-align:center;margin:1.3rem 0}',
    'math{font-size:1.15rem}',
    '.cell-test{display:flex;align-items:center;gap:.5rem;font-size:.95rem}',
    '.cell-test .badge{font-weight:700;width:1.4rem;height:1.4rem;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff}',
    '.cell-test.pass .badge{background:var(--pass)}',
    '.cell-test.fail .badge{background:var(--fail)}',
    '.cell-test.err .badge{background:#9a6700}',
    '.cell-test.nrun .badge{background:#8a8a9a}',
    '.cell-test .note{color:var(--fail);font-size:.85rem}',
    '.cell-chart{text-align:center}',
    '.note{color:var(--muted)}',
  ].join('');
}

/** Render a generic document structure to a self-contained HTML5 string. */
export function toHTML(doc: RenderDoc, options: ToHtmlOptions = {}): string {
  const title = doc.title ?? 'Workbook';
  const headerBits = [`<h1 class="doc-title">${esc(title)}</h1>`];
  if (doc.author) headerBits.push(`<p class="doc-meta">by ${esc(doc.author)}</p>`);
  if (doc.description) headerBits.push(`<p class="doc-desc">${esc(doc.description)}</p>`);
  if (doc.tags && doc.tags.length) {
    headerBits.push(
      `<p class="doc-tags">${doc.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</p>`
    );
  }
  const body = doc.cells.map((c) => renderCell(c, options.parse)).join('\n');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<style>${toCSS()}</style>`,
    '</head>',
    '<body>',
    '<main>',
    `<header>${headerBits.join('')}</header>`,
    body,
    '</main>',
    '</body>',
    '</html>',
  ].join('\n');
}
