---
'@danielsimonjr/mathts-functions': minor
---

Add `frontToLatexTable` and `frontToJson` for scored Pareto-front export (PySR M15). The table is one `tabular` (complexity, loss, score, equation) whose equation cells are `scalarToTex` in math mode (a bare `\cdot` does not compile in a `tabular` cell) and whose loss and score use `toPrecision(precision)`, default 6. The JSON report is `{ schemaVersion: 1, rows: [{ complexity, loss, score, key, tex }] }`; a non-finite `loss` or `score` is written as `'Infinity'`, `'-Infinity'` or `'NaN'` so it survives `JSON.stringify` (an exact fit scores `Infinity`, which JSON would turn into `null`, the linear-scale value). Also exports the types `FrontJson`, `FrontJsonNumber`, `FrontJsonRow` and `FrontLatexTableOptions`.
