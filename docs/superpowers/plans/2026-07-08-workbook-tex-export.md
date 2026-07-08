# Workbook LaTeX Export Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `mtsw export --format tex` — render a `.mtsw` notebook to a standalone (or `--fragment`) LaTeX document, using the expression package's `.toTex()` for equations and `plot.toTikZ()` for chart cells, mirroring the existing `toHTML` document exporter.

**Architecture:** A new `workbook/src/tex.ts` (`toTeX(doc, {parse, fragment})`) parallels `workbook/src/html.ts`. A new `markdownToTex` in `workbook/src/markdown.ts` mirrors `markdownToHtml` (shared href-allowlist, single-pass LaTeX escaping). `buildRenderDoc` + the workbook `renderChart` adapter become format-aware: charts render to SVG (html) or a TikZ **fragment** (tex, via plot's `format:'tikz', tikz:{standalone:false}`). `cli.ts`'s `exportCommand` accepts `--format tex` + `--fragment`. The existing HTML export path is untouched (its tests stay green).

**Tech Stack:** TypeScript (ESM, ES2022), tsup, vitest. Consumes the shipped `@danielsimonjr/mathts-plot` 0.2.0 (`toTikZ`/`format`) and `@danielsimonjr/mathts-expression` (`.toTex()` via the injected `parse`).

## Global Constraints

- ESM-only: all relative imports end in `.js`; `strict: true`; eslint-zero across `src` AND `tests` (no `any`, no `@ts-nocheck`, no blanket disables).
- Files kebab-case; types PascalCase; functions/vars camelCase.
- **The existing HTML export is untouched behavior:** `workbook/tests/svg.test.ts` and `workbook/tests/export.test.ts` (and all other workbook tests) MUST stay green unchanged.
- **Never-throws / degrade-loudly:** the exporter never crashes on bad cell content; a parse-failed equation falls back to the escaped source; an unresolved chart shows a note (mirrors the HTML path).
- **No cycle:** the shared `texEscape` lives in `markdown.ts` (so `tex.ts → markdown.ts` is one-directional; `tex.ts` must NOT be imported by `markdown.ts`). DGT must report 0 cycles + 0 dormant.
- **Do NOT manually edit workbook's `plot` dependency range** — `changeset version` auto-bumps it when plot releases 0.2.0. Tests import plot's BUILT `dist/`, so `npx turbo build --filter=@danielsimonjr/mathts-plot` before running workbook tests.
- Tests: `import { describe, it, expect } from 'vitest';` explicitly.
- Commit footer on every commit:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- Never `--no-verify`/skip hooks. Pre-commit hook is SLOW (60–300s+, runs docs:deps): `git commit` timeout ~540000 ms; if it times out, check `git log -1` BEFORE retrying (usually landed); only retry if HEAD didn't advance; never amend. If the hook regenerates `docs/Architecture/*`, `git add docs/Architecture/` into the same commit. Push directly to `main`; verify each push with `git ls-remote origin -h refs/heads/main` (L==R).
- Scope: workbook LaTeX export ONLY. Do NOT change the plot package (Plan 1 shipped it). Do NOT edit `.github/workflows/*`.

## File Structure

```
workbook/src/
  markdown.ts   MODIFY — + markdownToTex(src) + texEscape(s) (single-pass); extract sanitizeHrefRaw (shared, keeps markdownToHtml byte-identical)
  tex.ts        NEW — toTeX(doc, {parse, fragment}) + renderCellTex + renderEquationTex + PREAMBLE (→ html.ts types, markdown.ts helpers)
  svg.ts        MODIFY — renderChart(spec, xRaw, yRaw, format='svg'): tikz path requests a fragment
  html.ts       MODIFY — RenderCell gains `chartTikz?: string`
  cli.ts        MODIFY — buildRenderDoc(wb, byId, format='svg'); exportCommand accepts --format tex + --fragment
workbook/tests/
  markdown-tex.test.ts   NEW — markdownToTex subset + escaping
  tex.test.ts            NEW — toTeX cell mapping + standalone/fragment
  export-tex.test.ts     NEW — CLI export --format tex + --fragment
```

---

### Task 1: `markdownToTex` + `texEscape` (+ shared href allowlist)

**Files:**

- Modify: `workbook/src/markdown.ts`
- Test: `workbook/tests/markdown-tex.test.ts`

**Interfaces:**

- Produces: `markdownToTex(src: string): string` and `texEscape(s: string): string` (both exported); internal `sanitizeHrefRaw(href): string | null`.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test** — `workbook/tests/markdown-tex.test.ts`

````ts
import { describe, it, expect } from 'vitest';
import { markdownToTex, texEscape } from '../src/markdown.js';

describe('texEscape', () => {
  it('escapes LaTeX specials in a single pass (no double-escape of backslash)', () => {
    expect(texEscape('a_b % 50% & $x$ #1 {y}')).toBe('a\\_b \\% 50\\% \\& \\$x\\$ \\#1 \\{y\\}');
    expect(texEscape('a\\b')).toBe('a\\textbackslash{}b'); // not a\textbackslash\{\}b
    expect(texEscape('x^2 ~n')).toBe('x\\textasciicircum{}2 \\textasciitilde{}n');
  });
});

describe('markdownToTex', () => {
  it('headings map to sectioning', () => {
    expect(markdownToTex('# Title')).toContain('\\section*{Title}');
    expect(markdownToTex('## Sub')).toContain('\\subsection*{Sub}');
  });
  it('bold/italic/code inline', () => {
    const out = markdownToTex('**b** *i* `c`');
    expect(out).toContain('\\textbf{b}');
    expect(out).toContain('\\emph{i}');
    expect(out).toContain('\\texttt{c}');
  });
  it('fenced code → lstlisting (raw, not escaped)', () => {
    const out = markdownToTex('```\na_b := 1\n```');
    expect(out).toContain('\\begin{lstlisting}');
    expect(out).toContain('a_b := 1'); // raw inside listing
    expect(out).toContain('\\end{lstlisting}');
  });
  it('lists', () => {
    expect(markdownToTex('- one\n- two')).toContain('\\begin{itemize}');
    expect(markdownToTex('1. a\n2. b')).toContain('\\begin{enumerate}');
  });
  it('escapes specials in prose', () => {
    expect(markdownToTex('cost is 50% of $x')).toContain('50\\% of \\$x');
  });
  it('safe link → \\href; unsafe scheme dropped to text', () => {
    expect(markdownToTex('[go](https://example.com)')).toContain('\\href{https://example.com}{go}');
    const bad = markdownToTex('[x](javascript:alert(1))');
    expect(bad).not.toContain('javascript');
    expect(bad).toContain('x');
  });
});
````

- [ ] **Step 2: Run to verify it fails** — `npx vitest run workbook/tests/markdown-tex.test.ts` → FAIL (`markdownToTex`/`texEscape` not exported).

- [ ] **Step 3: Edit `workbook/src/markdown.ts`.**

3a. **Extract the href allowlist** so both renderers share it (keeps `markdownToHtml` byte-identical). Replace the existing `sanitizeHref` with a raw extractor + a thin HTML wrapper:

```ts
/** The allowlist decision, returning the raw safe href (unescaped) or null. */
function sanitizeHrefRaw(href: string): string | null {
  const h = href.trim();
  let probe = h.replace(/&amp;/g, '&');
  try {
    probe = decodeURIComponent(probe);
  } catch {
    // malformed escape — inspect the raw form
  }
  probe = probe.trim().toLowerCase();
  if (probe.startsWith('//')) return null;
  if (probe.startsWith('http://') || probe.startsWith('https://') || probe.startsWith('mailto:'))
    return h;
  if (
    probe.startsWith('/') ||
    probe.startsWith('./') ||
    probe.startsWith('../') ||
    probe.startsWith('#')
  )
    return h;
  if (/^[a-z][a-z0-9+.-]*:/.test(probe)) return null;
  return null;
}

/** HTML: allowlisted href, quote-escaped for an attribute (or null to drop). */
function sanitizeHref(href: string): string | null {
  const raw = sanitizeHrefRaw(href);
  return raw === null ? null : raw.replace(/"/g, '&quot;');
}
```

(The existing `inline`/`markdownToHtml` keep calling `sanitizeHref` unchanged — output identical.)

3b. **Add `texEscape`** (single-pass replacer — a sequential escaper would double-escape backslashes):

```ts
/** Escape LaTeX specials in a single pass (an escape's own backslash/braces are never re-scanned). */
export function texEscape(s: string): string {
  return s.replace(/[\\&%$#_{}~^]/g, (c) => {
    switch (c) {
      case '\\':
        return '\\textbackslash{}';
      case '~':
        return '\\textasciitilde{}';
      case '^':
        return '\\textasciicircum{}';
      default:
        return `\\${c}`;
    }
  });
}
```

3c. **Add `markdownToTex`** (mirror `markdownToHtml`'s block/inline structure; escape prose with `texEscape`, keep fenced code raw inside `lstlisting`):

````ts
function inlineTex(text: string): string {
  // Escape first, then apply inline markers to the escaped text (markers are ASCII, unaffected by texEscape).
  let s = texEscape(text);
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => `\\texttt{${code}}`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}');
  s = s.replace(/\*([^*]+)\*/g, '\\emph{$1}');
  s = s.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const raw = sanitizeHrefRaw(href);
    return raw ? `\\href{${texEscape(raw)}}{${label}}` : label;
  });
  return s;
}

/** Minimal Markdown → LaTeX, same subset + safety discipline as markdownToHtml. */
export function markdownToTex(src: string): string {
  if (!src) return '';
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  const SEC = ['\\section*', '\\subsection*', '\\subsubsection*', '\\paragraph'];
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(`\\begin{lstlisting}\n${buf.join('\n')}\n\\end{lstlisting}`);
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push('\\par\\noindent\\rule{\\linewidth}{0.4pt}\\par');
      i++;
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      const lvl = Math.min(h[1].length, 4);
      out.push(`${SEC[lvl - 1]}{${inlineTex(h[2].trim())}}`);
      i++;
      continue;
    }
    if (UL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL.test(lines[i])) {
        items.push(`  \\item ${inlineTex(lines[i].replace(UL, ''))}`);
        i++;
      }
      out.push(`\\begin{itemize}\n${items.join('\n')}\n\\end{itemize}`);
      continue;
    }
    if (OL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL.test(lines[i])) {
        items.push(`  \\item ${inlineTex(lines[i].replace(OL, ''))}`);
        i++;
      }
      out.push(`\\begin{enumerate}\n${items.join('\n')}\n\\end{enumerate}`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !isBlockStart(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(inlineTex(para.join(' ')));
  }
  return out.join('\n\n');
}
````

(`HR`, `HEADING`, `UL`, `OL`, `isBlockStart` already exist in markdown.ts and are reused.)

- [ ] **Step 4: Run to verify it passes** — `npx vitest run workbook/tests/markdown-tex.test.ts` → PASS. Then run the EXISTING markdown/html tests to confirm no regression from the `sanitizeHref` extraction: `npx vitest run workbook/` → GREEN (svg.test.ts, export.test.ts, etc. unchanged). `cd workbook && npx tsc --noEmit` → 0. `cd workbook && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add workbook/src/markdown.ts workbook/tests/markdown-tex.test.ts docs/Architecture/
git commit -m "feat(workbook): markdownToTex + texEscape (shared href allowlist)"
```

---

### Task 2: Format-aware chart rendering (`renderChart` + `RenderCell.chartTikz` + `buildRenderDoc`)

**Files:**

- Modify: `workbook/src/svg.ts` (renderChart gains a format param), `workbook/src/html.ts` (RenderCell += chartTikz), `workbook/src/cli.ts` (buildRenderDoc gains a format param)
- Test: `workbook/tests/svg.test.ts` (extend — a tikz case) + reuse existing

**Interfaces:**

- Consumes: `line`/`scatter`/`bar` from `@danielsimonjr/mathts-plot` (already imported in svg.ts) — now with `{ format: 'tikz', tikz: { standalone: false } }` for the tikz path.
- Produces:
  - `renderChart(spec: ChartSpec, xRaw: unknown, yRaw: unknown, format?: 'svg' | 'tikz'): string` (default `'svg'` — backward compatible).
  - `RenderCell.chartTikz?: string` (html.ts).
  - `buildRenderDoc(workbook, byId, format?: 'svg' | 'tikz')` (cli.ts) — sets `chartSvg` for svg (unchanged default) or `chartTikz` for tikz.

- [ ] **Step 1: Add a failing test** to `workbook/tests/svg.test.ts` (do NOT change existing cases):

```ts
describe('renderChart tikz format', () => {
  it('emits a tikzpicture fragment (no <svg>, no standalone documentclass)', () => {
    const out = renderChart({ type: 'line', title: 'T' }, [0, 1, 2], [0, 1, 4], 'tikz');
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('documentclass'); // fragment, embeddable
  });
  it('default format is still svg (backward compatible)', () => {
    expect(renderChart({ type: 'line' }, [0, 1], [0, 1])).toMatch(/^<svg/);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run workbook/tests/svg.test.ts` → FAIL (renderChart ignores the 4th arg → returns SVG).

- [ ] **Step 3a: Rebuild plot dist first** (svg.ts imports plot's built dist): `npx turbo build --filter=@danielsimonjr/mathts-plot`.

- [ ] **Step 3b: Edit `workbook/src/svg.ts`** — add the `format` param to `renderChart`:

```ts
/** Render an SVG (default) or embeddable TikZ chart from a spec plus raw x/y data. */
export function renderChart(
  spec: ChartSpec,
  xRaw: unknown,
  yRaw: unknown,
  format: 'svg' | 'tikz' = 'svg'
): string {
  const xs = toNums(xRaw);
  const ys = toNums(yRaw);
  const opts =
    format === 'tikz'
      ? {
          title: spec.title,
          xLabel: spec.xLabel,
          yLabel: spec.yLabel,
          format: 'tikz' as const,
          tikz: { standalone: false },
        }
      : { title: spec.title, xLabel: spec.xLabel, yLabel: spec.yLabel };
  if (spec.type === 'scatter') return scatter(xs, ys, opts);
  if (spec.type === 'bar') return bar(xs, ys, opts);
  return line(xs, ys, opts);
}
```

(This assumes the current `renderChart` already coerces via `toNums` and delegates to plot's `line`/`scatter`/`bar` — the Plan-0 adapter shape. Keep `toNums`/`coerce`/`ChartSpec` exactly as they are.)

- [ ] **Step 3c: Edit `workbook/src/html.ts`** — add to the `RenderCell` interface (beside `chartSvg`):

```ts
  /** For `chart` cells in a TeX export: pre-rendered embeddable TikZ. */
  chartTikz?: string;
```

- [ ] **Step 3d: Edit `workbook/src/cli.ts`** — make `buildRenderDoc` format-aware. Change its signature and the chart-cell block (cli.ts ~527, ~546, ~567):

```ts
function buildRenderDoc(
  workbook: Workbook,
  byId: Map<string, CellResult> | null,
  format: 'svg' | 'tikz' = 'svg'
): RenderDoc {
```

In the `visualization` branch, replace the two `renderChart(...)` calls so the rendered string lands on the format-appropriate field:

```ts
const rendered = renderChart(
  { type: spec?.type, title: spec?.title, xLabel: spec?.x?.label, yLabel: spec?.y?.label },
  lookup(spec?.x?.data),
  lookup(spec?.y?.data),
  format
);
if (format === 'tikz') rc.chartTikz = rendered;
else rc.chartSvg = rendered;
```

and the catch-branch placeholder:

```ts
const placeholder = renderChart({}, [], [], format);
if (format === 'tikz') rc.chartTikz = placeholder;
else rc.chartSvg = placeholder;
```

The existing `toHTML(buildRenderDoc(workbook, byId), { parse })` call at cli.ts:632 stays as-is (format defaults to `'svg'`) — HTML export unchanged.

- [ ] **Step 4: Run to verify it passes** — `npx vitest run workbook/tests/svg.test.ts` → PASS (new + existing). Full `npx vitest run workbook/` → GREEN (export.test.ts's HTML path unchanged). `cd workbook && npx tsc --noEmit` → 0. `cd workbook && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add workbook/src/svg.ts workbook/src/html.ts workbook/src/cli.ts workbook/tests/svg.test.ts docs/Architecture/
git commit -m "feat(workbook): format-aware renderChart + chartTikz (svg default unchanged)"
```

---

### Task 3: `toTeX` document exporter

**Files:**

- Create: `workbook/src/tex.ts`
- Test: `workbook/tests/tex.test.ts`

**Interfaces:**

- Consumes: `RenderDoc`/`RenderCell` (type-only, from `./html.js`), `markdownToTex`/`texEscape` (from `./markdown.js`), an injected `parse` (for equation `.toTex()`), and each chart cell's `chartTikz`.
- Produces: `toTeX(doc: RenderDoc, options?: { parse?: (expr: string) => unknown; fragment?: boolean }): string`.

- [ ] **Step 1: Write the failing test** — `workbook/tests/tex.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { toTeX } from '../src/tex.js';
import type { RenderDoc } from '../src/html.js';
import { parse } from '@danielsimonjr/mathts-functions';

const doc = (cells: RenderDoc['cells'], title?: string): RenderDoc => ({ title, cells });

describe('toTeX', () => {
  it('standalone: preamble + document + maketitle', () => {
    const out = toTeX(doc([{ type: 'markdown', content: 'Hello **world**' }], 'My Notebook'), {
      parse,
    });
    expect(out).toContain('\\documentclass{article}');
    expect(out).toContain('\\usepackage{tikz}');
    expect(out).toContain('\\title{My Notebook}');
    expect(out).toContain('\\begin{document}');
    expect(out).toContain('\\maketitle');
    expect(out).toContain('\\textbf{world}');
    expect(out.trimEnd().endsWith('\\end{document}')).toBe(true);
  });
  it('fragment: no preamble/documentclass', () => {
    const out = toTeX(doc([{ type: 'markdown', content: 'x' }]), { parse, fragment: true });
    expect(out).not.toContain('\\documentclass');
    expect(out).not.toContain('\\begin{document}');
  });
  it('equation → \\[ .toTex() \\]', () => {
    const out = toTeX(doc([{ type: 'equation', content: 'sin(x)^2' }]), { parse });
    expect(out).toContain('\\[');
    expect(out).toContain('\\sin'); // from expression .toTex()
    expect(out).toContain('\\]');
  });
  it('equation parse failure → escaped-source fallback, no throw', () => {
    const out = toTeX(doc([{ type: 'equation', content: 'a %% b' }]), { parse });
    expect(out).toContain('\\['); // still emits a display-math block
    expect(() => toTeX(doc([{ type: 'equation', content: ')(' }]), { parse })).not.toThrow();
  });
  it('code → lstlisting, output → verbatim, error → red', () => {
    const ok = toTeX(doc([{ type: 'code', content: 'a := 1', output: '1' }]));
    expect(ok).toContain('\\begin{lstlisting}');
    expect(ok).toContain('\\begin{verbatim}');
    const err = toTeX(doc([{ type: 'code', content: 'boom', error: 'kaboom' }]));
    expect(err).toContain('\\textcolor{red}');
  });
  it('test → colored PASS/FAIL/ERROR line', () => {
    expect(toTeX(doc([{ type: 'test', content: 't', passed: true }]))).toContain(
      '\\textcolor{green!60!black}{[PASS]}'
    );
    expect(toTeX(doc([{ type: 'test', content: 't', passed: false }]))).toContain(
      '\\textcolor{red}{[FAIL]}'
    );
    expect(toTeX(doc([{ type: 'test', content: 't', error: 'e' }]))).toContain('[ERROR]');
  });
  it('chart → embeds chartTikz in a center env', () => {
    const out = toTeX(
      doc([{ type: 'chart', content: '', chartTikz: '\\begin{tikzpicture}\\end{tikzpicture}' }])
    );
    expect(out).toContain('\\begin{center}');
    expect(out).toContain('\\begin{tikzpicture}');
  });
  it('escapes specials in prose/data', () => {
    expect(toTeX(doc([{ type: 'data', content: '', output: '50% & $x' }]))).toContain(
      '\\begin{verbatim}'
    );
    expect(toTeX(doc([{ type: 'markdown', content: 'cost 50%' }]))).toContain('50\\%');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run workbook/tests/tex.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create `workbook/src/tex.ts`**

```ts
/**
 * Assemble a RenderDoc into one self-contained LaTeX document (or a fragment
 * for \input) — the TeX analog of html.ts's toHTML. Markdown prose via
 * markdownToTex, equations via the injected parser's .toTex(), code via
 * listings, tests as colored status lines, charts as embedded TikZ. All plain
 * text is LaTeX-escaped; never throws.
 */

import type { RenderDoc, RenderCell } from './html.js';
import { markdownToTex, texEscape } from './markdown.js';

export interface ToTexOptions {
  /** Parser for equation expressions (e.g. the functions package `parse`). */
  parse?: (expr: string) => unknown;
  /** Emit only the cell bodies (for \input) instead of a standalone document. */
  fragment?: boolean;
}

const PREAMBLE = [
  '\\documentclass{article}',
  '\\usepackage{amsmath}',
  '\\usepackage{tikz}',
  '\\usepackage{listings}',
  '\\usepackage{xcolor}',
  '\\usepackage[margin=1in]{geometry}',
  '\\usepackage{hyperref}',
].join('\n');

function renderEquationTex(content: string, parse?: (expr: string) => unknown): string {
  if (parse) {
    try {
      const node = parse(content) as { toTex(): string };
      return `\\[ ${node.toTex()} \\]`;
    } catch {
      /* fall through to escaped source */
    }
  }
  return `\\[ ${texEscape(content)} \\]`;
}

function renderCellTex(cell: RenderCell, parse?: (expr: string) => unknown): string {
  switch (cell.type) {
    case 'markdown':
      return markdownToTex(cell.content);
    case 'equation':
      return renderEquationTex(cell.content, parse);
    case 'code': {
      const cap = cell.id ? `\\textit{${texEscape(cell.id)}}\\\\\n` : '';
      const src = `\\begin{lstlisting}\n${cell.content}\n\\end{lstlisting}`;
      let res = '';
      if (cell.error !== undefined)
        res = `\n\n\\textcolor{red}{\\texttt{${texEscape(cell.error)}}}`;
      else if (cell.output !== undefined)
        res = `\n\n\\begin{verbatim}\n${cell.output}\n\\end{verbatim}`;
      return `${cap}${src}${res}`;
    }
    case 'test': {
      const label = `\\texttt{${texEscape(cell.content)}}`;
      if (cell.error !== undefined)
        return `\\textcolor{orange}{[ERROR]} ${label} --- ${texEscape(cell.error)}`;
      if (cell.passed === true) return `\\textcolor{green!60!black}{[PASS]} ${label}`;
      if (cell.passed === false) return `\\textcolor{red}{[FAIL]} ${label}`;
      return `\\textcolor{gray}{[NOT RUN]} ${label}`;
    }
    case 'data': {
      const val = cell.error !== undefined ? cell.error : (cell.output ?? '');
      const cap = cell.id ? `\\textit{${texEscape(cell.id)}}\\\\\n` : '';
      return `${cap}\\begin{verbatim}\n${val}\n\\end{verbatim}`;
    }
    case 'chart': {
      const chart = cell.chartTikz ?? '% no chart';
      const note = cell.note ? `\n\n\\textit{${texEscape(cell.note)}}` : '';
      return `\\begin{center}\n${chart}\n\\end{center}${note}`;
    }
    default:
      return `\\begin{verbatim}\n${cell.content}\n\\end{verbatim}`;
  }
}

/** Render a document structure to a standalone (or fragment) LaTeX string. Never throws. */
export function toTeX(doc: RenderDoc, options: ToTexOptions = {}): string {
  const body = doc.cells.map((c) => renderCellTex(c, options.parse)).join('\n\n');
  if (options.fragment) return body;
  const meta: string[] = [];
  if (doc.title) meta.push(`\\title{${texEscape(doc.title)}}`);
  if (doc.author) meta.push(`\\author{${texEscape(doc.author)}}`);
  const maketitle = doc.title ? '\\maketitle\n' : '';
  return [PREAMBLE, ...meta, '\\begin{document}', `${maketitle}${body}`, '\\end{document}'].join(
    '\n'
  );
}
```

> Documented v1 limitation (note in the CHANGELOG, do not add code for it): `lstlisting`/`verbatim` bodies are emitted raw, so cell source/output containing a literal `\end{lstlisting}`/`\end{verbatim}` line would break compilation — acceptable for v1 (same class of limitation as any verbatim renderer).

- [ ] **Step 4: Run to verify it passes** — `npx vitest run workbook/tests/tex.test.ts` → PASS (8). (Rebuild functions if the `parse`/`.toTex()` import errors: `npx turbo build --filter=@danielsimonjr/mathts-functions`.) Full `npx vitest run workbook/` → GREEN. `cd workbook && npx tsc --noEmit` → 0. `cd workbook && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add workbook/src/tex.ts workbook/tests/tex.test.ts docs/Architecture/
git commit -m "feat(workbook): toTeX document exporter (equations/code/test/data/chart)"
```

---

### Task 4: CLI `mtsw export --format tex` + `--fragment`

**Files:**

- Modify: `workbook/src/cli.ts` (exportCommand + the `toTeX` import + the flag whitelist)
- Test: `workbook/tests/export-tex.test.ts`

**Interfaces:**

- Consumes: `toTeX` (from `./tex.js`), `buildRenderDoc(..., 'tikz')` (Task 2), `parse`.
- Produces: `exportCommand` accepts `--format tex` (renders `.tex` via `toTeX`) and a `--fragment` flag; `--format html` (and default) is unchanged.

- [ ] **Step 1: Write the failing test** — `workbook/tests/export-tex.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { exportCommand } from '../src/cli.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MTSW = `metadata:
  title: T
cells:
  - id: eq
    type: equation
    content: sin(x)^2
  - id: note
    type: markdown
    content: "cost is 50%"
`;

function writeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mtsw-tex-'));
  const f = join(dir, 'wb.mtsw');
  writeFileSync(f, MTSW, 'utf-8');
  return f;
}

describe('mtsw export --format tex', () => {
  it('emits a standalone LaTeX document to stdout', async () => {
    const r = await exportCommand([writeTmp(), '--format', 'tex', '--no-run']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('\\documentclass{article}');
    expect(r.stdout).toContain('\\[');
    expect(r.stdout).toContain('50\\%');
    expect(r.stdout).toContain('\\end{document}');
  });
  it('--fragment omits the preamble', async () => {
    const r = await exportCommand([writeTmp(), '--format', 'tex', '--fragment', '--no-run']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toContain('\\documentclass');
  });
  it('rejects an unknown format', async () => {
    const r = await exportCommand([writeTmp(), '--format', 'pdf', '--no-run']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/format/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run workbook/tests/export-tex.test.ts` → FAIL (`--format tex` rejected by the current `format !== 'html'` guard).

- [ ] **Step 3: Edit `workbook/src/cli.ts`.**

3a. Add the import (beside `import { toHTML } from './html';`):

```ts
import { toTeX } from './tex';
```

3b. Add `--fragment` to the value-flag/known-flag handling if the CLI validates flags (there's a flag list near the top — `'-f','--format','-t','--template','-c','--cell'`). `--fragment` is a BOOLEAN flag (like `--no-run`/`--json`), so it does NOT go in the value-flag list; ensure the arg parser treats it as boolean (it will, if unknown boolean flags are tolerated — verify `args.includes('--fragment')` works without being consumed as a value). If the CLI rejects unknown flags, add `--fragment` to the boolean-flag allowlist.
3c. Rewrite the format guard + render dispatch in `exportCommand` (replace the `if (format !== 'html') ...` line and the `const html = toHTML(...)` block):

```ts
const format = flagValue(args, '--format') ?? 'html';
if (format !== 'html' && format !== 'tex') {
  return fail([`Unknown format '${format}' (supported: html, tex)`]);
}
// ...(unchanged: file read, parse, runReport → byId)...

const fragment = args.includes('--fragment');
const rendered =
  format === 'tex'
    ? toTeX(buildRenderDoc(workbook, byId, 'tikz'), { parse, fragment })
    : toHTML(buildRenderDoc(workbook, byId), { parse });
const bytes = Buffer.byteLength(rendered, 'utf-8');
const outPath = flagValue(args, '-o') ?? flagValue(args, '--output');
```

Then in the write/stdout block, use `rendered` instead of `html` (rename the variable throughout the tail of the function: `writeFileAtomic(outPath, rendered)`, `return { stdout: rendered, ... }`). Update the usage string to `mtsw export <file> [--format html|tex] [--fragment] [-o out] [--no-run]`.

- [ ] **Step 4: Run to verify it passes** — `npx vitest run workbook/tests/export-tex.test.ts` → PASS (3). Full `npx vitest run workbook/` → GREEN (existing `export.test.ts` HTML path unchanged: `--format html`/default still calls `toHTML(buildRenderDoc(workbook, byId), {parse})`). `cd workbook && npx tsc --noEmit` → 0. `cd workbook && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add workbook/src/cli.ts workbook/tests/export-tex.test.ts docs/Architecture/
git commit -m "feat(workbook): mtsw export --format tex + --fragment"
```

---

### Task 5: Docs + changeset + DGT gate

**Files:**

- Modify: `CHANGELOG.md`; create `.changeset/workbook-tex-export.md`; regen `docs/Architecture/*`.

- [ ] **Step 1: CHANGELOG** — add under `## [Unreleased]` in root `CHANGELOG.md`:

```markdown
### Added — Workbook LaTeX export (`mtsw export --format tex`)

`mtsw export` now renders a notebook to a standalone (or `--fragment`) LaTeX
document, alongside the existing HTML export: markdown → LaTeX (`markdownToTex`),
equations → the expression package's `.toTex()` (`\[ … \]`), code → `listings`,
tests → colored pass/fail lines, data → `verbatim`, and charts → embedded TikZ
via `plot.toTikZ()` (a `tikzpicture` fragment). New `workbook/src/tex.ts`
(`toTeX`) mirrors the HTML `toHTML`. Only `\usepackage{tikz}` + standard packages
required. Known v1 limit: `lstlisting`/`verbatim` bodies are raw (a literal
`\end{…}` in cell content would need escaping).
```

- [ ] **Step 2: Changeset** — `.changeset/workbook-tex-export.md`:

```markdown
---
'@danielsimonjr/mathts-workbook': minor
---

Add `mtsw export --format tex` (+ `--fragment`): render a notebook to standalone/fragment LaTeX — equations via expression `.toTex()`, charts via `plot.toTikZ()`, markdown via a new `markdownToTex`. HTML export unchanged.
```

(`@danielsimonjr/mathts-workbook` is in the changeset `ignore` list → versions but does NOT publish. No plot changeset — plot is unchanged by this plan.)

- [ ] **Step 3: Full gate + graph regen.**

```bash
npm run build            # all packages incl workbook build green
npm run typecheck        # 0 errors
cd workbook && npx tsc --noEmit && npx eslint src tests && cd ..   # 0, 0
npm run build:wasm && npm run docs:deps    # regenerate the dependency graph
npx vitest run workbook/                    # full workbook suite GREEN (html tests unchanged + new tex tests)
```

Assert in the DGT output: **0 circular dependencies** (esp. no `markdown.ts ↔ tex.ts` cycle — `tex.ts → markdown.ts` only); `workbook` reachable; **0 NEW orphaned/dormant** files (tex.ts is reachable via cli.ts's exportCommand; markdownToTex/texEscape via tex.ts). Confirm `workbook → plot` edge still present and no `plot`-side change. Fix any failure at root (RFL Rule 2).

- [ ] **Step 4: Commit + push (NO publish — npm auth is the maintainer's step).**

```bash
git add CHANGELOG.md .changeset/workbook-tex-export.md docs/Architecture/ docs/reference/ 2>/dev/null
git commit -m "docs(workbook): LaTeX export CHANGELOG + changeset + graph regen"
git push origin main
git ls-remote origin -h refs/heads/main   # must equal local HEAD (L==R)
```

Release note for the maintainer: this ships in the SAME `changeset version`/`publish` run as plot 0.2.0 — workbook (ignored) versions internally; plot 0.2.0 publishes. No separate release action needed for workbook.

---

## Self-Review

**1. Spec coverage.** Every Plan-2 spec item maps to a task: `markdownToTex` (same subset/discipline) → Task 1; format-aware `renderChart`/`buildRenderDoc` + `chartTikz` → Task 2; `toTeX` cell mapping (markdown/equation/code/test/data/chart, standalone+fragment) → Task 3; `--format tex`/`--fragment` CLI → Task 4; DGT gate + changeset (workbook minor, ignored) → Task 5. HTML path untouched (svg.test.ts/export.test.ts stay green) — asserted in Tasks 1,2,4. Plot NOT changed (Plan 1) — asserted in Task 5 gate. `.toTex()` verified available this session (`parse('sin(x)^2').toTex()` → `{\sin\left( x\right)}^{2}`).

**2. Placeholder scan.** No TBD/vague steps — every code step has a complete body; the one flagged limitation (raw `lstlisting`/`verbatim`) is documented, not deferred code. Task 4 Step 3b notes a conditional (`--fragment` boolean-flag allowlist) with the concrete check to verify — a real instruction, not hand-waving.

**3. Type consistency.** `renderChart(spec, x, y, format?)` (Task 2) is called with `format` by `buildRenderDoc` (Task 2) and defaults `'svg'` for the unchanged `toHTML` path. `RenderCell.chartTikz?` (Task 2) is written by `buildRenderDoc` (Task 2, tikz path) and read by `renderCellTex` (Task 3). `toTeX(doc, {parse, fragment})` (Task 3) is called by `exportCommand` (Task 4) with exactly those options. `markdownToTex`/`texEscape` (Task 1) are imported by `tex.ts` (Task 3). `buildRenderDoc(wb, byId, format)` third param consistent across Tasks 2 and 4. No name drift.

**Known contingency (flagged, not a gap):** Task 4 Step 3b — if the CLI's arg parser rejects unrecognized boolean flags, `--fragment` must be added to its boolean-flag allowlist (the concrete location and check are given). If the parser tolerates unknown booleans (likely, since `--no-run`/`--json` are handled by `args.includes`), no allowlist change is needed. Either way the test in Task 4 catches it.
