# @danielsimonjr/mathts-parser

Standalone expression parser for [MathTS](https://github.com/danielsimonjr/mathts).

This package is a focused entry point over the parser that lives in
[`@danielsimonjr/mathts-expression`](https://www.npmjs.com/package/@danielsimonjr/mathts-expression).
It re-exports the parser surface so you can install and consume just the parser
(mirroring the other MathTS packages — `expression`, `matrix`, `parallel`,
`functions`, …). The implementation is not duplicated; it is re-exported.

## Install

```sh
npm install @danielsimonjr/mathts-parser
```

## What it exports

- `createParse` — factory for the `parse` function (string → AST).
- `createParserClass` — factory for the `Parser` class (stateful, scope-aware).
- AST node constructors produced by parsing: `createNode`, `createConstantNode`,
  `createOperatorNode`, `createSymbolNode`, `createFunctionNode`, … and the rest.
- Operator/keyword metadata: `keywords`, `properties`, `getPrecedence`,
  `getAssociativity`, `isAssociativeWith`, `getOperator`.
- The associated TypeScript types (AST node types, parser/operator types).

These are MathTS **factory functions**: wire them into a MathTS instance via
`create()` / `typed-function`, exactly as you would when importing them from
`@danielsimonjr/mathts-expression`.

```ts
import { createParse, createParserClass } from '@danielsimonjr/mathts-parser';
```

## License

MIT © Daniel Simon Jr.
