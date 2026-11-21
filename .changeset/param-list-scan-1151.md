---
'@danielsimonjr/mathts-functions': patch
---

One balanced scan reads the parameter list of a callback and of a worker closure. A default value with a parenthesis no longer cuts the list. A rest parameter after a default value keeps the full callback arguments in `map`, `forEach`, `filter`, and the `map` and `forEach` methods of a Matrix and of a SparseMatrix. A default value counts as a parameter, so `matrix([5, 6]).map((a, s = 1 / 2) => a * s)` gives `[0, 6]`, as in mathjs. `validateClosureSource` reads a rest parameter, the own name of a function expression and a comment in the list. It rejects `this`, `super`, `import`, `export`, `from`, `as`, the spread of an outer name, a method, a generator and a destructured parameter. It reads each name with the Unicode rule. (Refs #1151)
