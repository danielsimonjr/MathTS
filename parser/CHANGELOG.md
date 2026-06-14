# @danielsimonjr/mathts-parser

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS parser as a focused package that re-exports
  the parser surface from `@danielsimonjr/mathts-expression`: the `parse` function
  factory (`createParse`), the `Parser` class factory (`createParserClass`), the
  AST node constructors produced by parsing, and the operator/keyword metadata the
  parser relies on, plus the associated TypeScript types. The implementation is not
  duplicated — it is re-exported — so the parser stays in lockstep with
  `expression` (pinned to `0.2.1`).
