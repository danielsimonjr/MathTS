---
"@danielsimonjr/mathts-expression": minor
"@danielsimonjr/mathts-workbook": minor
---

MathTS-native rendering generators + self-contained HTML export for the Workbook.

**`@danielsimonjr/mathts-expression` — MathML serialization, alongside the node `.toTex()`/`.toHTML()` serializers (zero external deps):**
- **`Node.toMathML()`** — a per-node serializer method that mirrors `.toTex()`/`.toHTML()` (each node implements `_toMathML()`, helpers in `utils/mathml.ts`), returning a MathML fragment; `mathMLDocument(node)` wraps it in a self-contained `<math>` element (browsers typeset MathML natively) and `mathMLError(src)` reports a parse failure. Precedence-aware grouping, scientific-notation numbers (`8.85e-12` → mantissa × 10⁻¹²), full Greek map, subscripts, fractions/powers/roots/abs, prefix **and postfix** unary ops (`5!`), assignments, chained relationals; all text escaped; never throws (`<merror>` fallback).

**`@danielsimonjr/mathts-workbook` — document rendering + self-contained HTML export:**
- Document/chart/markdown renderers (kept here, where the `.mtsw` document model is): `toHTML(doc)` + `toCSS()` assemble a `{ cells, metadata }` document into one self-contained HTML5 file (inlined stylesheet, no external requests; equations via the expression `Node.toMathML()`, code/data outputs, test badges, inline SVG charts); `renderChart(spec, x, y)` → inline SVG (line/scatter/bar; coerces `Unit[]`/`Matrix`, "no data" placeholder); `markdownToHtml(src)` → a minimal XSS-safe Markdown subset (strict href allowlist). All user content HTML-escaped.
- **`mtsw export <file> [--format html] [-o out.html] [--no-run] [--json]`** — render a notebook to a self-contained HTML document. Runs the workbook first (or `--no-run` for cached outputs), writes atomically (or stdout). A whole-run failure (e.g. a dependency cycle) fails loudly instead of emitting a misleading empty document.
- New display-only cell types: **`equation`** (MathTS expression syntax → MathML) and **`visualization`** (a small YAML chart spec — `type`/`title`/`x`/`y` with data referencing dependency cell outputs or inline arrays → inline SVG at export).

Reviewed (Adam/Eve on the spec; code-reviewer on the diff): XSS/escaping completeness, href allowlist (no bypass), ReDoS-free regexes, and crash-proofing all verified; fixed the silent dependency-cycle export, chained-relational rendering, and the never-run test badge. Tests: expression 1966; functions render 19; workbook 240. Known limits (documented): MathML needs a modern browser; export shares `run`'s synchronous execution model (no hard timeout — `--no-run` mitigates); minimal (not CommonMark) markdown.
