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

- `compile` -- compile a parsed AST node against a math scope into an executable form.
- `createEvaluate` -- build an `evaluate(expr, scope?)` function from a `parse` function + math scope.
- `compileExpression` -- compile an expression string directly.
- Types: `CompiledExpression`, `Scope`.

```ts
import { createEvaluate } from '@danielsimonjr/mathts-evaluator';
import { createParse } from '@danielsimonjr/mathts-parser';
// wire createParse into your math scope, then:
// const evaluate = createEvaluate(parse, mathScope);
// evaluate('2 + 3'); // 5
```

## License

MIT (c) Daniel Simon Jr.
