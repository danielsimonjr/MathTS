# @danielsimonjr/mathts-expression API Reference

Expression parsing, AST, compilation, and evaluation for MathTS — a
mathjs-lineage parser plus a standalone tree-walking compiler/evaluator and a
security-validating high-level `evaluate`.

## Installation

```bash
npm install @danielsimonjr/mathts-expression
```

## Overview

The package exposes **two parallel evaluation paths**, both from the package
root:

1. **Factory-injected (mathjs-style) path** — `createParse`, `createNode`, the
   `create*Node` AST factories, `createParser`, `createHelpClass`, and the
   `transform/*` factories. These are `FactoryFunction<Deps, T>` values: a
   _host_ (e.g. `functions/src/factories/index.ts`) must supply the listed
   dependencies before a live `parse` / Node class exists. Not directly callable
   standalone.
2. **Standalone compiler/evaluator path** — `compile`, `createEvaluate`,
   `compileExpression` — plain functions requiring only a parsed `MathNode` and
   a flat `mathScope`. This is what `workbook`'s executor and other lightweight
   consumers use (no DI bootstrapping needed).

> The package exports **no plain top-level `parse` / `evaluate` function** — only
> the DI factories and the standalone-path builders. A consumer either
> bootstraps the full factory graph, or parses via a bootstrapped `parse` and
> then uses the standalone `compile` / `createEvaluate`.

## Security Sandbox

This is the load-bearing security surface of the package. **Every**
property / method / index access in the compiler routes through four helpers in
`expression/src/utils/customs.ts`:

| Function          | Signature                          | Guarantee                                                                                                    |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `getSafeProperty` | `(object, prop) => unknown`        | Reads only when `isSafeProperty` passes; throws on inherited / dangerous props                               |
| `setSafeProperty` | `(object, prop, value) => unknown` | Same whitelist for writes; blocks `__proto__` / `constructor` pollution                                      |
| `isSafeProperty`  | `(object, prop) => boolean`        | The whitelist predicate                                                                                      |
| `getSafeMethod`   | `(object, method) => unknown`      | Rejects "ghosted" (own-property-shadowed) methods; whitelists only `toString` / `valueOf` / `toLocaleString` |
| `isSafeMethod`    | `(object, method) => boolean`      | Method whitelist predicate                                                                                   |
| `isPlainObject`   | `(object) => boolean`              | Plain-object check                                                                                           |

Direct `obj[name]` access anywhere in `expression/src/` is a sandbox bypass.
Regression-guarded by `expression/tests/security/sandbox.test.ts`.

A **second, independent** layer is `evaluator/evaluate.ts`'s `validateAst` — an
AST-shape rejection before compile (see [`createEvaluate`](#compilation--evaluation)).
The two layers are complementary: `validateAst` blocks whole classes of
dangerous nodes/calls up front; the safe-property helpers block dangerous
property access at the leaf level even when `compile()` is used directly.

## Parsing

`createParse: FactoryFunction<ParseDependencies, ParseFunction>` — dependencies:
`typed`, `numeric`, `config`, and all 15 Node constructors. Produces the typed
`parse`:

```typescript
parse(expr: string, options?: { nodes?: Record<string, NodeConstructor> }): MathNode
parse(expr: string[], options?): MathNode[]  // also accepts Array | Matrix
```

Tokenizer helpers are hung off `parse`: `parse.isAlpha`,
`.isValidLatinOrGreek`, `.isValidMathSymbol`, `.isWhitespace`,
`.isDecimalMark`, `.isDigitDot`, `.isDigit`. The parser also registers
`typed.addConversion({from: 'string', to: 'Node', convert: parse})`.

## AST Node Hierarchy

Every node type is exported as a `create<Name>Node` factory
(`FactoryFunction<Deps, NodeCtor>`), not a plain class. A node instance's shape
is the `MathNode` type alias.

### Node (base)

`createNode` (dep: `mathWithTransform`). Instance methods:

| Method                         | Signature                         | Description                                    |
| ------------------------------ | --------------------------------- | ---------------------------------------------- |
| `evaluate`                     | `(scope?) => unknown`             | `this.compile().evaluate(scope)`               |
| `compile`                      | `() => CompiledExpression`        | Pre-compile the subtree                        |
| `forEach`                      | `(cb) => void`                    | Shallow child iteration                        |
| `map`                          | `(cb) => Node`                    | Map children → new Node                        |
| `traverse`                     | `(cb) => void`                    | Deep traversal                                 |
| `transform`                    | `(cb) => Node`                    | Deep transform                                 |
| `filter`                       | `(cb) => Node[]`                  | Collect matching nodes                         |
| `clone` / `cloneDeep`          | `() => Node`                      | Shallow / deep copy                            |
| `equals`                       | `(other) => boolean`              | Structural equality                            |
| `toString`                     | `(options?) => string`            | Source rendering                               |
| `toHTML`                       | `(options?) => string`            | HTML rendering                                 |
| `toTex`                        | `(options?) => string`            | LaTeX rendering                                |
| `toMarkdown`                   | `(options?: {inline?}) => string` | Wraps `toTex` in `$…$` / `$$…$$`               |
| `toDOT`                        | `(options?: {name?}) => string`   | Graphviz digraph of the AST (never throws)     |
| `toMathML`                     | `() => string`                    | MathML (never throws — degrades to `<merror>`) |
| `toJSON`                       | `() => object`                    | Serialize                                      |
| `getIdentifier` / `getContent` | `() => ...`                       | Node metadata                                  |

> `toDOT` and `toMarkdown` are **expression-AST** Node methods — they belong to
> this package, not to `plot`.

### Node subclasses

| Node                     | Constructor                                     | Own fields                                                                |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------- |
| `ConstantNode`           | `new (value: unknown)`                          | `value`                                                                   |
| `SymbolNode`             | `new (name: string)`                            | `name`                                                                    |
| `OperatorNode`           | `new (op, fn, args, implicit?, isPercentage?)`  | `op`, `fn`, `args`, `implicit`, `isPercentage`; `isUnary()`, `isBinary()` |
| `FunctionNode`           | `new (fn: MathNode \| string, args, optional?)` | `fn`, `args`, `optional`; getter `name`                                   |
| `AccessorNode`           | `new (object, index, optionalChaining?)`        | `object`, `index` (IndexNode), `optionalChaining`                         |
| `AssignmentNode`         | `new (object, index \| null, value?)`           | `object`, `index`, `value`                                                |
| `ArrayNode`              | (`create*Node`)                                 | `items`                                                                   |
| `BlockNode`              | (`create*Node`)                                 | `blocks: {node, visible}[]`                                               |
| `ConditionalNode`        | (`create*Node`)                                 | `condition`, `trueExpr`, `falseExpr`                                      |
| `FunctionAssignmentNode` | (`create*Node`)                                 | `name`, `params: string[]`, `expr`                                        |
| `IndexNode`              | (`create*Node`)                                 | `dimensions`; `isObjectProperty()`, `getObjectProperty()`                 |
| `ObjectNode`             | (`create*Node`)                                 | `properties: Record<string, MathNode>`                                    |
| `ParenthesisNode`        | (`create*Node`)                                 | `content`                                                                 |
| `RangeNode`              | (`create*Node`)                                 | `start`, `end`, `step?`                                                   |
| `RelationalNode`         | (`create*Node`)                                 | `params[]`, `conditionals: string[]`                                      |

All node classes carry a duck-typed `isXxxNode: boolean` discriminant; the
standalone compiler dispatches on these flags rather than `instanceof`.

## Compilation / Evaluation

| Function            | Signature                                                                     | Description                                                                      |
| ------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `compile`           | `(node: MathNode, mathScope: Record<string, unknown>) => CompiledExpression`  | Pre-compiles the tree into an arity-specialized closure                          |
| `createEvaluate`    | `(parseFn, mathScope) => evaluate`                                            | Returns an `evaluate(expr, scope?, options?)` that runs `validateAst` by default |
| `compileExpression` | `(parseFn, mathScope, expr, options?: EvaluateOptions) => CompiledExpression` | Same validation, reusable compiled expression                                    |

`CompiledExpression = { evaluate(scope?: Record<string, unknown> \| Scope): unknown }`.

`Scope` is Map-like: `{ has(key), get(key), set(key, value) }`; a plain
`Record` scope is wrapped by `ObjectWrappingMap`.

**`validateAst`** (run by `createEvaluate` unless `options.unsafe === true`)
rejects `AssignmentNode`, `FunctionAssignmentNode`, and calls to a
forbidden-function blocklist: `import`, `createUnit`, `evaluate`, `parse`,
`compile`, `simplify`, `derivative`, `help`, `chain`.

`EvaluateOptions = { unsafe?: boolean }`.

## Operators & Precedence

`expression/src/operators.ts`:

| Export              | Signature                                                 | Description                                       |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `properties`        | `OperatorGroup[]`                                         | Ordered (increasing precedence) operator maps     |
| `getPrecedence`     | `(node, parenthesis, implicit, parent) => number \| null` | Node precedence                                   |
| `getAssociativity`  | `(node, parenthesis) => 'left' \| 'right' \| null`        | Node associativity                                |
| `isAssociativeWith` | `(nodeA, nodeB, parenthesis) => boolean \| null`          | Cross-node associativity                          |
| `getOperator`       | `(fn: string) => string \| null`                          | Function name → operator symbol (`'add'` → `'+'`) |

## MathML Helpers

`mathMLDocument`, `mathMLError`, `escapeMathML`, `toMathMLSymbol` — used
alongside each node's `.toMathML()` method.

## Other Exports

| Export            | Description                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `keywords`        | `Set<string>` of reserved parser identifiers (currently `{'end'}`)                                                             |
| `embeddedDocs`    | Embedded documentation table                                                                                                   |
| `createHelpClass` | Factory (dep `evaluate`) → `Help` instances with `doc`, `toString()`, `toJSON()`, `valueOf()`                                  |
| `createParser`    | Factory (deps `typed` + `Parser`) → stateful `math.parser()`: `.evaluate(expr)`, `.get(name)`, `.set(name, value)`, `.clear()` |

**Transform factories** (`create*Transform`, all re-exported): `createAndTransform`,
`createOrTransform`, `createNullishTransform`, `createBitAndTransform`,
`createBitOrTransform`, `createMapTransform`, `createFilterTransform`,
`createForEachTransform`, `createMapSlicesTransform`, `createIndexTransform`,
`createSubsetTransform`, `createConcatTransform`, `createRangeTransform`,
`createColumnTransform`, `createRowTransform`, `createMaxTransform`,
`createMinTransform`, `createMeanTransform`, `createSumTransform`,
`createStdTransform`, `createVarianceTransform`, `createQuantileSeqTransform`,
`createCumSumTransform`, `createDiffTransform`, `createPrintTransform`. Each
shifts a base function's index/dim convention from 0-based (JS) to 1-based
(expression language) or adds laziness.

## Types

`CompiledExpression`, `Scope`, `TypedFunction`, `TypedFunctionConstructor`,
`OperatorGroup`, `OperatorProperty`, `EvaluateOptions`, `MathNode`.

## Example

```typescript
import { compile } from '@danielsimonjr/mathts-expression';

// Given a parsed MathNode `ast` and a flat math scope:
const compiled = compile(ast, mathScope);
const result = compiled.evaluate({ x: 2, y: 3 });
```

## See Also

- `@danielsimonjr/mathts-parser` — parser + operator metadata re-export
- `@danielsimonjr/mathts-ast` — node constructors re-export
- `@danielsimonjr/mathts-evaluator` — `compile` / `evaluate` re-export
