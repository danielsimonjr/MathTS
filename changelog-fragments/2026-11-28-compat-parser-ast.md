### Fixed

- Expression parse/compile parity (#1786): deep-wrap parsed AST nodes so nested subexpressions compile against the instance `mathWithTransform`; route `node.evaluate` through the same factory compile path as `node.compile`.
- `evaluate` returns a matrix when given a matrix of expression strings; nullish coalescing and inline transform callbacks resolve symbols correctly.
- Instance `typed` registers the `identifier` type and converts `bigint` to mathjs `Fraction` for custom signatures.
