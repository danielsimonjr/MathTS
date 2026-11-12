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
- `compileExpression` — compile a string with the same default wiring (`compileExpression('2+3').evaluate()` → `5`).
- `compile` -- compile a parsed AST node against a math scope into an executable form.
- `createEvaluate` -- build an `evaluate(expr, scope?)` function from a `parse` function + math scope.
- Types: `CompiledExpression`, `Scope`.

```ts
import { evaluate, compileExpression } from '@danielsimonjr/mathts-evaluator';

evaluate('2 + 3'); // 5
compileExpression('2+3').evaluate(); // 5
```

## License

MIT (c) Daniel Simon Jr.
