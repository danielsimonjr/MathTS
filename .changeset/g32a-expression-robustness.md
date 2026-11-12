---
'@danielsimonjr/mathts-expression': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-workbook': patch
---

Expression lexer and sandbox: `/* */` and `//` comments; `parse("1e")` and `evaluate("1e")` now throw `SyntaxError` (incomplete scientific notation); parenthesis nesting accepts 125 levels per docs; evaluate sanitizes results so host scope objects (e.g. `process`) are not returned by identity; object literals skip forbidden keys at runtime. `substitute` uses resolve + simplifyConstant with constant folding.
