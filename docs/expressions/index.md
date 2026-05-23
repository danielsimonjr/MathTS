# Expressions

MathTS includes a full expression parser and evaluator aimed at end users: mathematicians,
engineers, students, and anyone who needs to evaluate math without writing TypeScript.

The expression system lives in `@danielsimonjr/mathts-expression` (parser, AST, compiler) and is
wired to the full activated math scope in `@danielsimonjr/mathts-functions` (functions, constants).

```typescript
import { evaluate } from '@danielsimonjr/mathts-functions';

evaluate('sqrt(3^2 + 4^2)'); // 5
evaluate('sin(pi / 4)'); // 0.7071067811865476
evaluate('x^2 + 1', { x: 3 }); // 10
```

## Key differences from mathjs

- `evaluate()` is a standalone function, not a method on a `math` object.
- The compiler is a **tree-walking interpreter** - no code generation, no unsafe evaluation.
- Scope is fully isolated from the JavaScript environment.
- Import from `@danielsimonjr/mathts-functions`, not `mathjs`.

## In this section

- [Syntax](syntax.md) - operators, functions, variables, arrays, objects, ranges.
- [Parsing and evaluation](parsing.md) - `evaluate()`, `parse()`, `compileExpr()`.
- [Expression trees](expression_trees.md) - AST node types, traversal, custom evaluation.
- [Algebra](algebra.md) - symbolic computation: `simplify`, `derivative`, `rationalize`.
- [Security](security.md) - the safety model; what is and is not sandboxed.
