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

- `parse` — ready-to-call parser (string → AST) with a default wired instance.
- `createParse` — factory for the `parse` function. Call it with no argument for the default parse. Pass a math scope (for example `create(all)` from `@danielsimonjr/mathts-compat`) to bind symbols to that scope.
- `createParserClass` — factory for the `Parser` class (stateful, scope-aware).
- `createParser` — factory for the `parser()` instance (a `Parser` with its own scope).
- AST node constructors produced by parsing: `createNode`, `createConstantNode`,
  `createOperatorNode`, `createSymbolNode`, `createFunctionNode`, … and the rest.
- Operator/keyword metadata: `keywords`, `properties`, `getPrecedence`,
  `getAssociativity`, `isAssociativeWith`, `getOperator`.
- The associated TypeScript types (AST node types, parser/operator types).

`parse(expr)` is ready to call. It does not import `@danielsimonjr/mathts-functions`. `createParse` is still the factory: pass your own scope when you are not using the default instance.

The default parser is the sandboxed arithmetic parser. A literal outside IEEE-754 range throws `SyntaxError: Numeric overflow`. Evaluating that tree with `evaluate` (from `@danielsimonjr/mathts-expression` or `@danielsimonjr/mathts-evaluator`) rejects assignment unless you pass `{ unsafe: true }`.

```ts node
import { parse, createParse } from '@danielsimonjr/mathts-parser';
const ast = parse('2 + 3');
```

## License

MIT © Daniel Simon Jr.
