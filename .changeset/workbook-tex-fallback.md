---
'@danielsimonjr/mathts-workbook': patch
---

Fix the `.tex` exporter's equation parse-failure fallback: it wrapped text-mode escape macros in display math (`\[ ... \]`), which fails to compile when the source contains `\`, `^`, or `~`. The fallback now renders unparseable source in text mode via `\texttt{...}`.
