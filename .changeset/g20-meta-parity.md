---
'@danielsimonjr/mathts-compat': patch
---

Fix meta-API parity with mathjs 15.3.0: Chain JSON/`fromJSON`, `format` default precision, instance `create(config)`, stricter `create` factory validation, lazy factory `import`, reviver errors on truncated tags, and Fraction bare `JSON.stringify` string `n`/`d` (#1575). Also align the too-few-arguments error index of `add`/`subtract`/`transpose`/`det` with mathjs, add the `solveODE` `function, Array, Matrix[, Object]` signatures, and make a `new`-less `Chain` call throw the mathjs `SyntaxError`.
