# Parsing and evaluation

MathTS provides three levels of API for working with expressions, each trading convenience
for control:

| API | Use when |
|---|---|
| `evaluate(expr, scope?)` | One-shot evaluation — simplest |
| `parse(expr)` | Inspect or transform the AST before evaluating |
| `compileExpr(expr)` | Compile once, evaluate many times with different scopes |

All three are exported from `@danielsimonjr/mathts-functions`:

```typescript
import { evaluate, parse, compileExpr } from '@danielsimonjr/mathts-functions';
```

---

## evaluate

The simplest entry point. Parses and evaluates an expression in one call.

```typescript
evaluate(expr: string, scope?: Record<string, any>): any
```

All registered math functions are available in expression strings, including the full function library: arithmetic, trigonometry, statistics, signal processing, special functions (`erfc`, `beta`, `gammainc`, `digamma`, Bessel functions), probability distributions (`normalPDF`, `normalCDF`, `poissonPMF`, etc.), combinatorics (`fibonacci`, `lucas`, `subfactorial`, etc.), and geometry functions.

Examples:

```typescript
evaluate('2 + 3');                        // 5
evaluate('sin(pi / 2)');                  // 1
evaluate('sqrt(-4)');                     // Complex { re: 0, im: 2 }
evaluate('a * b', { a: 3, b: 4 });        // 12
evaluate('erfc(1)');                      // ~0.1573
evaluate('normalPDF(0)');                 // ~0.3989
evaluate('fibonacci(10)');               // 55
evaluate('beta(2, 3)');                   // ~0.0833
```

### Scope

The optional scope is a plain object with variable bindings. Variables assigned inside
the expression are written back to the scope:

```typescript
const scope = { a: 3, b: 4 };
evaluate('c = a + b', scope);   // 7
scope.c;                        // 7
```

### Multi-statement expressions

Separate statements with `;` or newlines. Statements ending with `;` are suppressed from
the result; statements on their own line are included:

```typescript
evaluate('a = 3; b = 4; a + b');    // 7  (assignments suppressed)
evaluate('a = 3
b = 4
a + b');    // [3, 4, 7]  (all visible)
```

---

## parse

Parses an expression string into an AST node without evaluating it. Useful for inspection,
transformation, or deferred evaluation.

```typescript
parse(expr: string): Node
```

Example:

```typescript
const node = parse('2 + x');
node.toString();          // '2 + x'
node.toTex();             // '2+x'
node.type;                // 'OperatorNode'
```

The returned node is the root of an [expression tree](expression_trees.md). You can
traverse, filter, and transform the tree before evaluating.

Evaluate a parsed node by compiling it manually (see [Expression trees](expression_trees.md)),
or pass it to `simplify` or `derivative` for symbolic operations.

---

## compileExpr

Compiles an expression into a reusable `CompiledExpression`. More efficient than `evaluate`
when the same expression is evaluated many times with different variable bindings.

```typescript
compileExpr(expr: string): CompiledExpression

interface CompiledExpression {
  evaluate(scope?: Record<string, any>): any;
}
```

Example:

```typescript
const compiled = compileExpr('x^2 + y');
compiled.evaluate({ x: 2, y: 1 });    // 5
compiled.evaluate({ x: 3, y: 2 });    // 11
compiled.evaluate({ x: 10, y: 0 });   // 100
```

The expression is parsed and compiled once. Each `evaluate()` call only runs the
pre-compiled evaluation function against the provided scope.

### When to use compileExpr vs evaluate

```typescript
// Prefer evaluate for one-off calculations:
evaluate('sin(pi / 4)');

// Prefer compileExpr for repeated evaluation (e.g., plotting, simulation):
const f = compileExpr('sin(x) * cos(y)');
for (let x = 0; x < 100; x++) {
  for (let y = 0; y < 100; y++) {
    grid[x][y] = f.evaluate({ x: x / 10, y: y / 10 });
  }
}
```

---

## Error handling

All three functions throw descriptive errors on invalid input:

```typescript
try {
  evaluate('2 +');
} catch (err) {
  console.error(err.message);   // 'Unexpected end of expression'
}

try {
  evaluate('unknownFn(3)');
} catch (err) {
  console.error(err.message);   // 'Undefined symbol unknownFn'
}
```

---

## Evaluating multiple expressions with a shared scope

Use a shared scope object to maintain state across multiple `evaluate` calls:

```typescript
const scope: Record<string, any> = {};

evaluate('a = 5', scope);
evaluate('b = a * 2', scope);    // 10
evaluate('a + b', scope);        // 15

scope.a;   // 5
scope.b;   // 10
```

This is the equivalent of mathjs's `math.parser()` — without requiring a class instance.
