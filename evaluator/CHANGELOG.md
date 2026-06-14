# @danielsimonjr/mathts-evaluator

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS compiler + evaluator as a focused package that re-exports `compile`, `createEvaluate`, and `compileExpression` (and the `CompiledExpression` / `Scope` types) from `@danielsimonjr/mathts-expression` (pinned `0.2.2`). Completes the parse -> compile -> evaluate pipeline alongside `@danielsimonjr/mathts-parser`. Not a copy.
