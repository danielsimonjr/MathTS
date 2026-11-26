---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-plot': patch
'@danielsimonjr/mathts-workbook': patch
---

Match mathjs 15.3.0 `toTex` unit names and boolean-operator spacing on the compat instance (#1577, #1578).

Compat wraps parse output with a thin `toTex` adapter: `Unit.UNITS` / `isValuelessUnit` follow the mathjs 15.3.0 oracle (not core's wider table), bare unit symbols honor the `math[name] === undefined` guard, and boolean operators join with no space (`true\wedgefalse`, `\negtrue`, `true\veebarfalse`). Native MathTS expression output is unchanged.

**Native bug (good idea):** `VERSION` in `core` / `plot` / `workbook` is a tsdown `__PKG_VERSION__` define. Bun `docs:functions` can still evaluate `src/` (root tsconfig `paths`), where the identifier was undefined and the pre-commit hook aborted. Source execution now reads the same global the bun-test preload already sets, and `docs:functions` injects `--define`.
