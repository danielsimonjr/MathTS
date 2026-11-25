---
'@danielsimonjr/mathts-compat': patch
---

Match mathjs 15.3.0 `toTex` unit names and boolean-operator spacing on the compat instance (#1577, #1578).

Compat wraps parse output with a thin `toTex` adapter: `Unit.UNITS` / `isValuelessUnit` follow the mathjs 15.3.0 oracle (not core's wider table), bare unit symbols honor the `math[name] === undefined` guard, and boolean operators join with no space (`true\wedgefalse`, `\negtrue`, `true\veebarfalse`). Native MathTS expression output is unchanged.