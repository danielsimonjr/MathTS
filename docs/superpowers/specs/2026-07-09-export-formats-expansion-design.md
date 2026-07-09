# Export-Formats Expansion — Design Spec

**Date:** 2026-07-09
**Status:** Approved (brainstorming → design), pending implementation plan.

## Goal

Round out MathTS's output/serialization surface with the formats a scientific
library is expected to emit but currently lacks: rasterized/print chart output
(PNG/PDF), Markdown-embeddable math, Graphviz DOT for both expression trees and
notebook graphs, and machine-readable (JSON) + print (PDF) workbook exports.

## Context — current export surface (verified 2026-07-09)

- **expression `Node`** (`expression/src/node/Node.ts`, one base factory object):
  `.toString()`, `.toTex()`, `.toHTML()`, `.toMathML()` — the "dotted serializer"
  family, each `public` calling a `_toX()` per-node override.
- **plot** (`@danielsimonjr/mathts-plot`, zero-render-dep pure strings): SVG (default)
  - TikZ (`format:'tikz'` / `toTikZ()`). Package `exports` currently only `"."`.
- **workbook** (`workbook/src/`): `toHTML(doc)`+`toCSS()`, `toTeX(doc)`,
  `serializeWorkbook()`/`importWorkbook()` (`.mtsw`), `toMermaid(graph)`,
  `formatResult(value)`. CLI: `mtsw export --format html|tex [--fragment]`,
  `mtsw graph -f mermaid`, `mtsw describe --json` (static model, no execution).

## Architecture validation (DGT, verified 2026-07-09)

`npm run docs:deps`: **0 circular dependencies**, 1017 reachable files. Package edges:

```
expression → core
plot       → core, functions, expression
workbook   → core, expression, functions, plot
```

**Key finding driving the design:** workbook already depends on plot, and plot is
gaining a LaTeX→PDF compile primitive for its own TikZ→PDF chart route. plot does
**not** depend on workbook, so placing that primitive in plot and reusing it from
workbook's `.toPDF` creates **no new dependency edge and no cycle**. There is no
existing `toDOT`/`digraph`/`graphviz` or shell-out facility anywhere in package
source — all additions are greenfield, nothing is duplicated.

## Global constraints (bind every task)

- Commit footer, exactly, on every commit:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK`
- Never `--no-verify` / `--no-gpg-sign` / skip hooks. Pre-commit hook is slow (allow ~540000ms).
- **plot** gets a **minor** bump (new `./render` subpath = new feature) → publishes (next is 0.3.0).
- **expression** gets a **minor** bump (new `.toMarkdown`/`.toDOT` node methods) → publishes.
- **workbook** stays changeset-**ignored** (versions internally, does NOT publish).
- TDD strict; no dead code; DGT gate every task (**0 cycles, 0 new dormant**).
- **Never-throw is preserved** for chart builders and expression serializers. The new
  file/PDF bridges are _explicitly_ throwing async I/O APIs (documented as such).
- Verify each push L==R (`git ls-remote origin -h refs/heads/main` == local HEAD).
- Tests import built `dist/` — rebuild a dependency (turbo) before downstream vitest.

## Components

### 1. plot — Node-only render bridge (`plot/src/render-file.ts`)

Exposed as a **separate** package entry so `node:child_process`/`node:fs` never
enter the browser-safe `"."` bundle. Add to `plot/package.json` `exports`:

```json
"./render": { "import": "./dist/render-file.js", "types": "./dist/render-file.d.ts" }
```

and add `src/render-file.ts` to the tsup build entry list.

**Error type:**

```ts
export class PlotRenderError extends Error {
  constructor(
    message: string,
    readonly missingTool?: string
  ) {
    super(message);
    this.name = 'PlotRenderError';
  }
}
```

**API (all async, Node-only):**

```ts
export interface RenderOptions {
  tool?: string;
  timeoutMs?: number;
  density?: number;
  background?: string;
}

/** SVG string → file. Ext of outPath decides target: .svg (write through),
 *  .png / .pdf (convert via rsvg-convert, else resvg, on PATH). Throws
 *  PlotRenderError naming the tool to install if none is found. */
export function renderToFile(svg: string, outPath: string, opts?: RenderOptions): Promise<void>;

/** Standalone LaTeX/TikZ source → PDF via pdflatex, else tectonic, on PATH.
 *  outPath must end in .pdf. Compiles in an OS temp dir; cleans up aux files.
 *  Throws PlotRenderError naming the tool to install if none is found. This is
 *  the SHARED primitive workbook.toPDF reuses. */
export function latexToPdf(texSource: string, outPath: string, opts?: RenderOptions): Promise<void>;
```

**Tool detection:** honor `opts.tool` first; else probe the known candidates on
PATH (`where` on win32 / `which` elsewhere, or a `--version` spawn). Converters:
SVG→PNG/PDF `rsvg-convert` (preferred) or `resvg`; LaTeX→PDF `pdflatex` (preferred)
or `tectonic`. `density` applies to PNG (DPI); `background` to PNG (default transparent).

The chart _builders_ (`line`, `plot`, `toTikZ`, …) are unchanged and stay never-throw.

### 2. expression `Node` — `.toMarkdown()` + `.toDOT()`

Both defined once on the base factory object in `Node.ts` (no per-node `_toX`).

```ts
/** Markdown-embeddable math. Display (block) by default; inline on request.
 *  Thin wrapper over toTex() — inherits toTex's behavior (every concrete node
 *  implements it), adds no new failure mode. */
toMarkdown(options?: { inline?: boolean } & StringOptions): string {
  const tex = this.toTex(options);
  return options?.inline ? '$' + tex + '$' : '$$\n' + tex + '\n$$';
}

/** Graphviz digraph of the AST subtree rooted at this node. One DOT node per AST
 *  node (label = node type + a value for leaves), parent→child edges. Never throws. */
toDOT(options?: { name?: string }): string;
```

`toDOT` walks with the existing `traverse((node, path, parent) => …)`, assigning
each node a stable id (`n0, n1, …` in traversal order via a `Map<Node,string>`),
and emits `parent_id -> child_id` edges from the `parent` argument. Node label:
`"<Type>"` plus a value where meaningful — `ConstantNode` value, `SymbolNode` name,
`OperatorNode` op, `FunctionNode` fn name. **Labels are DOT-escaped** (`\` → `\\`,
`"` → `\"`, newline → `\n`). Output shape:

```
digraph AST {
  n0 [label="OperatorNode: +"];
  n1 [label="SymbolNode: x"];
  n2 [label="ConstantNode: 2"];
  n0 -> n1;
  n0 -> n2;
}
```

`options.name` overrides the graph name (default `AST`).

### 3. workbook — `toPDF(doc)` + `mtsw export --format pdf`

New `workbook/src/pdf.ts`:

```ts
import { latexToPdf } from '@danielsimonjr/mathts-plot/render';
export interface ToPdfOptions {
  parse?: (expr: string) => unknown;
  tool?: string;
  timeoutMs?: number;
}
/** Render a workbook doc to a PDF file: toTeX(standalone) → latexToPdf. Charts
 *  render as native vector TikZ (no rasterization). Async; throws on missing LaTeX. */
export function toPDF(doc: RenderDoc, outPath: string, options?: ToPdfOptions): Promise<void> {
  return latexToPdf(toTeX(doc, { parse: options?.parse, fragment: false }), outPath, options);
}
```

CLI `exportCommand`: accept `--format pdf`. PDF is binary → **require `-o <file.pdf>`**
(error clearly if `-o` is missing for pdf). Runs the notebook (same path as html/tex),
builds the tikz-flavored `RenderDoc`, calls `toPDF`. Requires plot ≥ the version that
adds `./render` (bump workbook's plot dep).

### 4. workbook — `mtsw export --format json`

Emit the **executed** run report (distinct from `describe --json`, which is static).
`exportCommand` for `--format json`: run `executor.runReport()` → serialize
`RunResult` as JSON: `{ ok, cells: [{ id, type, status, output, error }] }`, where each
`output` is passed through `formatResult(output)` (crash-proof string, same discipline
as the html/tex exporters — `output` is `unknown` and may be a Matrix/Complex/Unit that
is not natively JSON-serializable). Writes to `-o` or stdout.

### 5. workbook — `toDOT(graph)` + `mtsw graph -f dot`

`workbook/src/graph.ts`, sibling of `toMermaid` (cell ids are validated identifiers →
safe verbatim; no cell content in output):

```ts
export function toDOT(graph: DependencyGraph): string {
  const lines = ['digraph deps {'];
  for (const id of graph.nodes.keys()) lines.push(`  ${id} [label="${id}"];`);
  for (const [id, node] of graph.nodes)
    for (const dep of node.dependencies) lines.push(`  ${dep} -> ${id};`);
  lines.push('}');
  return lines.join('\n');
}
```

`graphCommand`: accept `-f dot` alongside the existing `-f mermaid`.

## Error handling

- expression `.toDOT`, plot chart builders, workbook `toDOT(graph)`: **never throw**
  (pure string; `.toDOT` reads only `node.type` + known value fields with fallbacks).
  `.toMarkdown` adds no failure mode beyond `toTex`'s own.
- plot `renderToFile`/`latexToPdf` and workbook `toPDF`: **explicitly throw**
  `PlotRenderError` (missing tool → message names what to install: e.g. "rsvg-convert not
  found; install librsvg" / "no LaTeX engine found; install TeX Live or tectonic"), or
  the underlying spawn error on a non-zero compile. This is a deliberate, documented
  exception to plot's never-throw rule — I/O and missing external tools must surface.
- CLI: `--format pdf` without `-o` → clear usage error; unknown `--format` → the existing
  "supported: html, tex, json, pdf" error (updated list).

## Testing (TDD)

- **expression:** oracle strings — `parse('2*x+1').toDOT()` equals a fixed digraph;
  `.toMarkdown()` / `{inline:true}` equal fixed `$$…$$` / `$…$`; DOT-escaping of a
  string-literal node with quotes/backslashes.
- **workbook:** `toDOT(graph)` snapshot on a known 3-cell graph; `export --format json`
  shape assertions (ok flag, per-cell status/output/error) on a notebook with a passing
  test cell, a failing test cell, and an error cell; `--format pdf` without `-o` errors.
- **plot render bridge:** tool-detect test — if the converter/LaTeX engine is absent on
  the machine, assert `renderToFile`/`latexToPdf` reject with `PlotRenderError` naming the
  tool; if present, assert a real non-empty file is written (`.svg` passthrough is always
  testable with no external tool). `toPDF` likewise (skip-real-compile if no LaTeX, but
  always assert the missing-tool error path and that it calls through to `latexToPdf`).
- **DGT** after each package: 0 cycles, 0 new dormant; `render-file.ts` reachable via the
  new `./render` entry (so it is not counted dormant).

## Out of scope (YAGNI)

- Bundling a WASM rasterizer or JS PDF writer (explicitly rejected — external-tool bridge
  chosen to preserve plot's zero-dependency guarantee).
- PNG for the _workbook_ (workbook PDF is vector via TikZ; PNG stays a plot-chart concern).
- `.toDOT` layout/styling options beyond labels; streaming/large-graph handling.
- Browser-side PDF (the render bridge is Node-only by design).

## Execution order (one subagent-driven plan)

Grouped by package, ordered by dependency:

1. **expression** — `.toMarkdown` + `.toDOT` (independent; minor bump).
2. **plot** — `render-file.ts` bridge + `./render` export + `latexToPdf`/`renderToFile` (minor bump).
3. **workbook** — `toDOT(graph)` + `graph -f dot`; `export --format json`; `toPDF` +
   `export --format pdf` (consumes plot's `latexToPdf`, so after step 2).

Then: root CHANGELOG per task, changesets (plot minor, expression minor, workbook patch —
ignored), DGT gate, final whole-branch review, release (plot + expression publish; workbook
versions internally).
