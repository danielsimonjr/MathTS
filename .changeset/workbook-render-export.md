---
"@danielsimonjr/mathts-expression": minor
"@danielsimonjr/mathts-workbook": minor
---

MathTS-native rendering generators + self-contained HTML export for the Workbook.

**`@danielsimonjr/mathts-expression` — new rendering generators (zero external deps), alongside the node `.toTex()`/`.toHTML()` serializers:**
- `toMathML(node)` + a `Node.toMathML()` method — render an expression AST to a self-contained `<math>` element (browsers typeset MathML natively). Precedence-aware grouping, scientific-notation numbers (`8.85e-12` → mantissa × 10⁻¹²), full Greek-letter map, subscripts, fractions/powers/roots/abs, assignments, chained relationals; all text escaped; never throws (`<merror>` fallback).
- `markdownToHtml(src)` — a minimal, dependency-free Markdown subset. XSS-safe: escape-first, then inline markers; link hrefs pass a strict protocol allowlist (http/https/mailto/relative only).
- `toHTML(doc, { parse })` + `toCSS()` — assemble a generic `{ cells, metadata }` document into one self-contained HTML5 file (inlined stylesheet, no external requests); equations rendered via the injected parser + `toMathML`, code/data outputs embedded, test pass/fail/not-run badges. All user content HTML-escaped.

**`@danielsimonjr/mathts-workbook`:**
- **`mtsw export <file> [--format html] [-o out.html] [--no-run] [--json]`** — render a notebook to a self-contained HTML document. Runs the workbook first (or `--no-run` for cached outputs), maps results to the generic render doc, writes atomically (or stdout). A whole-run failure (e.g. a dependency cycle) fails loudly instead of emitting a misleading empty document.
- New **`equation`** cell type — display-only; content is MathTS expression syntax, rendered to MathML at export.

Reviewed (Adam/Eve on the spec; code-reviewer on the diff): XSS/escaping completeness, href allowlist (no bypass), ReDoS-free regexes, and crash-proofing all verified; fixed the silent dependency-cycle export, chained-relational rendering, and the never-run test badge. Tests: expression 1966; functions render 19; workbook 240. Known limits (documented): MathML needs a modern browser; export shares `run`'s synchronous execution model (no hard timeout — `--no-run` mitigates); minimal (not CommonMark) markdown.
