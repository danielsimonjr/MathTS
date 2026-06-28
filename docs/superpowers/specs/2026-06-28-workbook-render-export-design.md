# Workbook Render + Export — Design (Slices 6 & 7)

> Built on the headless Workbook CLI (slices 1–5). Adds MathTS-native rendering
> generators and a self-contained HTML export. Zero external runtime deps.

## Goal

Let the CLI turn a `.mtsw` into a finished, self-contained HTML document —
rendered math (equations), embedded code + outputs, self-verifying test badges,
and charts — so a document can be *completed* via the CLI alone (the GUI is
presentation on top). Drives `examples/lightspeed.mtsw` → `lightspeed.html`.

## Principle

Rendering lives in MathTS as generators, not in external libraries:
- **Math → MathML** (`toMathML`): browsers typeset MathML natively → self-contained, no fonts/JS/deps. (SVG math typesetting from scratch ≈ reimplementing MathJax; rejected. MathML is a structural AST→AST map.)
- **Charts → SVG** (`toSVG`): tractable; MathTS computes the data, we draw the plot.
- **Document → HTML/CSS** (`toHTML`/`toCSS`): assemble cells, inline everything.

## Architecture

```
expression/src/toMathML.ts   (NEW)  toMathML(node|src) -> MathML string   [Slice 6]
workbook/src/markdown.ts     (NEW)  minimal markdown -> HTML (escaped)    [Slice 6]
workbook/src/svg-chart.ts    (NEW)  renderChart(spec) -> inline SVG       [Slice 7]
workbook/src/html.ts         (NEW)  toHTML(workbook,opts), toCSS()        [Slice 6/7]
workbook/src/cli.ts          export command (`mtsw export`)               [Slice 6/7]
workbook/src/parser.ts       support `equation` (S6) + `chart` (S7) cells
```

Security invariant (new, do not regress): **all user-authored content
(cell text, markdown, symbol names, error messages, metadata) is HTML-escaped
before embedding.** The export turns an untrusted `.mtsw` into HTML; an
unescaped `<script>` in a markdown cell must render as text, never execute.
Numeric chart data is coerced to numbers (NaN/Infinity dropped), never
interpolated as raw strings into SVG.

---

## Slice 6 — math + document HTML export

### `toMathML(input: string | Node): string` (expression package)

**Equation authoring UX (explicit):** an `equation` cell's content is **MathTS
expression syntax** (e.g. `c = 1 / sqrt(eps0 * mu0)`), *not* raw LaTeX. It is
parsed and rendered to typeset math via `toMathML`. This is the MathTS-native
equivalent of "LaTeX equations" — the output looks typeset; the source is MathTS.

**Precedence-aware grouping (critical).** Rendering must reuse the engine's
existing precedence machinery — the `calculateNecessaryParentheses` helper +
precedence table already used by `OperatorNode._toTex` (`expression/src/node/`
and `utils/`). When an operator's child has lower precedence than the parent (and
isn't already a `ParenthesisNode` / implicitly grouped by `mfrac`/`msqrt`/`msup`),
wrap it in `<mrow><mo>(</mo>…<mo>)</mo></mrow>`. This makes `a+b*c`, `(a+b)*c`,
`-x^2` (= `unaryMinus(pow(x,2))`), and `1/sqrt(a*b)` all render correctly. Do NOT
hand-roll a new precedence model — mirror/import the proven one.

Recursive walk keyed on `node.type` (the base `Node` exposes `get type()`):

| Node | MathML |
|---|---|
| `ConstantNode` (number) | plain → `<mn>value</mn>`; **scientific** (`8.854e-12`) → `<mrow><mn>8.854</mn><mo>×</mo><msup><mn>10</mn><mn>-12</mn></msup></mrow>` (detect exponent via the number's string form; negative mantissa → leading `<mo>-</mo>`) |
| `ConstantNode` (bigint) | `<mn>value</mn>` |
| `ConstantNode` (string) | `<mtext>escaped</mtext>` |
| `ConstantNode` (boolean) | `<mi>true\|false</mi>` |
| `ConstantNode` (Complex/Fraction/Unit/other) | `<mtext>escaped formatted value</mtext>` (via the crash-proof formatter) |
| `AssignmentNode` (`c = rhs`) | `<mrow> lhs <mo>=</mo> rhs </mrow>` (simple symbol LHS; array/object-pattern LHS → `<mtext>escaped source</mtext>` fallback) |
| `SymbolNode` | `<mi>glyph</mi>` — **full** Greek map (α…ω, Γ…Ω: `lambda→λ`, `mu→μ`, `nu→ν`, `pi→π`, `epsilon→ε`, `theta→θ`, `Omega→Ω`, …); `name_sub` (one underscore) → `<msub><mi>base</mi><mn-or-mi>sub</></msub>` (numeric sub → `<mn>`, else `<mi>`, multi-char ok) |
| `OperatorNode` `divide`/`/` (binary) | `<mfrac><mrow>a</mrow><mrow>b</mrow></mfrac>` |
| `OperatorNode` `pow`/`^` | `<msup><mrow>base</mrow><mrow>exp</mrow></msup>` |
| `OperatorNode` binary (`+ - *` …) | `<mrow> a <mo>op</mo> b </mrow>`; implicit `*` → invisible-times `<mo>&#x2062;</mo>` |
| `OperatorNode` unary (`-x`,`+x`) | `<mrow><mo>op</mo> operand</mrow>` |
| `OperatorNode` relational chains (`=`,`<`,…) | `<mrow> a <mo>op</mo> b </mrow>` |
| `FunctionNode` `sqrt` | `<msqrt>arg</msqrt>` |
| `FunctionNode` `nthRoot(x,n)` | `<mroot><mrow>x</mrow><mrow>n</mrow></mroot>` |
| `FunctionNode` `abs(x)` | `<mrow><mo>\|</mo>x<mo>\|</mo></mrow>` |
| `FunctionNode` (generic) | `<mi>fn</mi><mo>&#x2061;</mo><mrow><mo>(</mo>args…<mo>)</mo></mrow>` |
| `ParenthesisNode` | `<mrow><mo>(</mo>content<mo>)</mo></mrow>` |
| anything else | `<mtext>escaped source</mtext>` (graceful fallback, never throws) |

- Wrapper: `toMathML(src)` returns `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">…</math>` (attributes quoted).
- All text nodes escaped. The function NEVER throws (parse failure → `<math …><merror><mtext>escaped src</mtext></merror></math>`, `merror` INSIDE `math`), mirroring the crash-proof formatter.
- Exported from `expression/src/index.ts`; re-exported by workbook for convenience.

### `equation` cell (parser)

Add `equation` to `SUPPORTED_CELL_TYPES`. An equation cell is **display-only**
(not executed — like markdown): the executor skips it (no result). Its content
is a MathTS expression string; the export renders it via `toMathML`. (Authors
can also reference computed values in surrounding markdown.)

### `markdown.ts` — minimal markdown → HTML (escaped)

Small, dependency-free subset sufficient for notebook prose: ATX headings
(`#`..`######`), paragraphs, `**bold**`, `*italic*`, `` `code` ``, fenced code
```` ``` ````, unordered/ordered lists, links `[t](url)`, horizontal rules.

**Escaping order (XSS-safe):** escape ALL text to HTML entities first (so no raw
tag can ever survive), THEN apply inline markers via regex on the escaped text;
code spans/fences wrap already-escaped content in `<code>`/`<pre>` (no
re-escaping → `&` shows once). Unknown syntax passes through as escaped text.

**Link href sanitization (strict allowlist, not a denylist):** `sanitizeHref(raw)`
— trim, then percent-decode and lowercase a copy for inspection; ACCEPT only if
it (a) starts with `http://`, `https://`, or `mailto:`, or (b) is relative
starting with `/`, `./`, `../`, or `#`. REJECT everything else — protocol-relative
`//host`, `javascript:`/`data:`/`vbscript:`/`file:`, any scheme not allowlisted,
and any href containing control/whitespace chars after decode. Rejected → render
the link text only (no `<a>`). (Denylists miss case/whitespace/encoding tricks;
allowlist is the safe default.) Not CommonMark-complete — documented.

### `html.ts` — `toHTML(workbook, options?)` + `toCSS()`

Assemble one self-contained HTML5 document:
- `<html lang="en">`, `<head>`: `<meta charset="utf-8">`, `<meta name="viewport">`, title (escaped metadata.title), inlined `<style>` from `toCSS()`.
- **Browser-support honesty:** MathML Core is supported by all modern browsers (Chromium ≥109, Firefox, Safari). The file opens self-contained with no network requests; very old browsers degrade to unstyled tokens. Documented in README — claim "modern browsers", not "anywhere".
- Body: document title + metadata (author/description/tags, escaped); then each cell in order:
  - `markdown` → `markdown.ts` output.
  - `equation` → `toMathML(content)`.
  - `code` → a `<figure class=cell-code>`: the source (escaped, in `<pre><code>`), plus its output (from the cell's cached/just-run result) rendered via the formatter (escaped) in `<div class=cell-output>`. Errors → `<div class=cell-error>` (escaped).
  - `test` → pass/fail badge (`✓`/`✗`) + the assertion source (escaped).
  - `data` → formatted value (escaped).
  - `chart` (Slice 7) → inline SVG.
- `toCSS()` returns a small static stylesheet (typography, code blocks, badges, output boxes). No external fonts (system stack).
- `options`: `{ run?: boolean }` — when true (default for the CLI), run the workbook first so outputs are fresh; otherwise use cached outputs in the file.

### `mtsw export <file> [--format html] [-o out.html]`

- Parse → (run for fresh outputs) → `toHTML` → write (atomic) to `-o` path, or stdout if no `-o`.
- `--format` defaults to `html` (only format now; future: md/pdf). Unknown format → error.
- `--no-run` to skip execution (render cached outputs only).
- `--json` envelope: `{ command:'export', ok, data:{ path?, bytes }, problems }`.
- Human errors → stderr, exit mirrors ok. Atomic write via `writeFileAtomic` (tmp + rename + cleanup — already implemented, fs-atomic.ts).

**Execution model / limits (honest).** `export` with `run` reuses the existing
executor — the SAME model as `mtsw run` (slices 1–5). MathTS `evaluate()` is
**synchronous**, so a pathological cell (e.g. a runaway recursive function
assignment) blocks until it finishes; a JS timer cannot interrupt sync code
without a worker thread. This is a **pre-existing** property of `run`, not new to
`export`. Mitigation: `--no-run` renders cached outputs without executing.
True sandboxed-execution timeouts (worker-thread abort) are deferred to a
separate hardening slice — documented, not silently assumed away.

---

## Slice 7 — charts

### `chart` cell (parser)

Add `chart` to `SUPPORTED_CELL_TYPES`. A chart cell's content is a small YAML/JSON
spec (parsed with the hardened YAML loader):
```yaml
type: line            # line | scatter | bar
title: "ν vs 1/λ"
x: { label: "1/λ (1/m)", data: someCellId }   # data = a cell id whose output is a number[] OR an inline number[]
y: { label: "ν (Hz)",   data: anotherCellId }
```
`depends_on` lists the data cells. Display-only (not "executed" as an expression),
but it READS dependency outputs at export time to get the series.

### `svg-chart.ts` — `renderChart(spec, resolved): string`

- **Data coercion (explicit):** resolve `x.data`/`y.data` to `number[]`. Accept a `number[]` directly; a `Unit[]` → map via `.toNumeric()` (and, if the spec omits a label, suffix the unit to the axis label); a Matrix/nested array → flatten; anything else (object, string, errored cell, mismatched x/y lengths) → treat as invalid. Coerce each element to a finite number; drop non-finite `(x,y)` pairs.
- Compute linear scales (min/max → pixel), draw axes + ticks + labels (escaped), and the series (`line`→`<polyline>`, `scatter`→`<circle>`, `bar`→`<rect>`). Fixed viewBox; responsive `width="100%"`. **Explicit colors** (not theme-dependent): dark axes/text, a defined series color, light plot background — legible on any page background.
- Title/labels escaped. Empty/all-invalid data → a centered `<text>`"no data" placeholder (no misaligned axes), never throws. A data cell that errored → placeholder + a note in the figure caption.
- Returns an `<svg>` string embedded inline by `html.ts`.

### Export wiring

`html.ts` renders `chart` cells by resolving their `depends_on` outputs (from the
run/cached results) and calling `renderChart`. Document the case where a data
cell errored (chart shows the "no data" placeholder + a note).

### Document upgrade

Enhance `examples/lightspeed.mtsw`: add `equation` cells for `c = 1/√(ε₀μ₀)` and
`c = λν` (rendered math), and a `chart` cell (e.g. a small sweep showing
`λ·ν` constant across HeNe-region wavelengths, or ε₀-sensitivity of c). Export to
`examples/lightspeed.html` and verify it opens self-contained with rendered math
+ chart. Keep the `test` cells (still self-verifying).

---

## Testing

- `toMathML`: unit tests per node type (constant, symbol+Greek, fraction via `/`, `^`, `sqrt`, nested `1/sqrt(a*b)`, function call, parenthesis, assignment `c = …`); escaping (a symbol/string with `<`); never-throws on garbage input.
- `markdown.ts`: headings/bold/italic/code/lists/links; **XSS**: `<script>`, `javascript:` href, raw `<` all escaped/neutralized.
- `html.ts`: snapshot-ish structural assertions (contains `<math`, the escaped title, a code figure, a test badge); escaping of a malicious markdown/code cell; `run:false` uses cached output.
- `svg-chart.ts`: line/scatter/bar produce `<svg>` with expected element counts; non-finite data dropped; empty data → placeholder; label escaping.
- `cli export`: `--json` envelope ok/fail; writes a file with `-o`; stdout without; `--no-run`; unknown `--format` errors; atomicity (no temp residue).
- E2E: `mtsw export examples/lightspeed.mtsw -o tmp.html` → file contains `<math`, an `<svg`, the c value, both test badges; exit 0.

Gate per slice: full vitest suite + `tsc --noEmit` (workbook + expression) + NUL scan + the export E2E smoke.

## Acceptance

1. `toMathML('1/sqrt(eps0*mu0)')` → MathML with `<mfrac>`+`<msqrt>`; exported and browser-renderable.
2. `mtsw export examples/lightspeed.mtsw -o lightspeed.html` → one self-contained file: rendered equations (MathML), embedded code+outputs, ✓ test badges, an inline SVG chart; opens offline with no external requests.
3. All user content escaped (XSS tests pass). No external runtime deps added.
4. Existing 233 tests stay green; slices add tests.

## Out of scope / deferred

PDF/markdown/ipynb export; SVG math typesetting; interactive (JS) charts;
CommonMark completeness; multi-series/legends/log-scale charts; theming.
