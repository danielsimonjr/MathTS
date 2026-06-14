# @danielsimonjr/mathts-ast

Standalone AST node constructors for [MathTS](https://github.com/danielsimonjr/mathts) expressions.

A focused entry point over the AST nodes in
[`@danielsimonjr/mathts-expression`](https://www.npmjs.com/package/@danielsimonjr/mathts-expression).
The implementation is re-exported, not duplicated. Useful for tooling that builds,
walks, transforms, or pretty-prints expression trees without pulling in the evaluator.

## Install

```sh
npm install @danielsimonjr/mathts-ast
```

## What it exports

The 16 AST node constructor factories: `createNode`, `createConstantNode`,
`createOperatorNode`, `createSymbolNode`, `createFunctionNode`, `createIndexNode`,
`createAccessorNode`, `createArrayNode`, `createAssignmentNode`, `createBlockNode`,
`createConditionalNode`, `createFunctionAssignmentNode`, `createObjectNode`,
`createParenthesisNode`, `createRangeNode`, `createRelationalNode` -- plus the
associated TypeScript types. These are MathTS factory functions; wire them via
`create()` / `typed-function` as from `@danielsimonjr/mathts-expression`.

## License

MIT (c) Daniel Simon Jr.
