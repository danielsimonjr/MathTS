# @danielsimonjr/mathts-evaluator

Standalone compiler + evaluator for [MathTS](https://github.com/danielsimonjr/mathts) expressions.

A focused entry point over the evaluation half of
[`@danielsimonjr/mathts-expression`](https://www.npmjs.com/package/@danielsimonjr/mathts-expression).
The implementation is re-exported, not duplicated. Completes the
`parse -> compile -> evaluate` pipeline alongside
[`@danielsimonjr/mathts-parser`](https://www.npmjs.com/package/@danielsimonjr/mathts-parser).

## Install

```sh
npm install @danielsimonjr/mathts-evaluator
```

## What it exports

- `evaluate` — evaluate an expression string with the default wired math scope (`evaluate('2+3')` → `5`).
- `compileExpression(expr)` — compile a string with the same default wiring. `compileExpression('2+3')()` and `compileExpression('2+3').evaluate()` are both `5`.
- `compileExpression(parseFn, mathScope, expr)` — the factory form. It still takes the parse function and scope you pass.
- `compile` -- compile a parsed AST node against a math scope into an executable form.
- `createEvaluate` -- build an `evaluate(expr, scope?)` function from a `parse` function + math scope.
- `parse` — the same ready-to-call parser as `@danielsimonjr/mathts-parser`.
- Types: `CompiledExpression`, `Scope`.

This package does not import `@danielsimonjr/mathts-functions`. The default scope is arithmetic (`+`, `sin`, `sqrt`, `π`, …). It is the safe mode: `parse`, `typed`, `createUnit`, `resolve`, `chain`, `simplify`, and `derivative` are not reachable from an expression, including a nested `map` / `filter` callback expression. `evaluate('a = 1')` throws unless you pass `{ unsafe: true }`. An out-of-range numeric literal throws `SyntaxError: Numeric overflow`.

```ts
import { evaluate, compileExpression } from '@danielsimonjr/mathts-evaluator';

evaluate('2 + 3'); // 5
compileExpression('2+3')(); // 5
compileExpression('2+3').evaluate(); // 5
```

## License

MIT (c) Daniel Simon Jr.
