# Algebra (symbolic computation)

MathTS supports symbolic computation via three activated factory functions:
`simplify`, `derivative`, and `rationalize`. These operate on expression trees
([AST nodes](expression_trees.md)) and return transformed trees that can be
further evaluated or converted to string/LaTeX.

```typescript
import { simplify, derivative, rationalize } from '@danielsimonjr/mathts-functions';
```

All three functions accept either a **string** or a **Node** (parsed AST) as input.

---

## simplify

Algebraically simplifies an expression:

```typescript
import { simplify, parse } from '@danielsimonjr/mathts-functions';

simplify('3 + 2 / 4').toString();           // '7 / 2'
simplify('2x + 3x').toString();             // '5 * x'
simplify('x^2 + x + 3 + x^2').toString();   // '2 * x ^ 2 + x + 3'
simplify('x * y * -x / (x ^ 2)').toString(); // '-y'
```

### Working with parsed trees

```typescript
const f = parse('2x + x');
const simplified = simplify(f);

simplified.toString();           // '3 * x'
simplified.evaluate({ x: 4 });  // 12
```

### Scope substitution

Pass a scope to substitute variable values during simplification:

```typescript
const f = parse('2x + x');

simplify(f, { x: 4 }).toString();               // '12'
simplify(f, { x: parse('y + z') }).toString();  // '3 * (y + z)'
```

### Options

`simplify(expr, scope?, options?)` accepts an options object:

| Option | Type | Default | Description |
|---|---|---|---|
| `exactFractions` | boolean | `true` | Simplify decimals to fractions when possible |
| `context` | object | permissive | Algebraic properties controlling which simplifications apply |

**Context example** — prevent commutative simplification:

```typescript
const expr = parse('x * y - y * x');

simplify(expr).toString();
// '0'  (commutative by default)

simplify(expr, {}, { context: { multiply: { commutative: false } } }).toString();
// 'x * y - y * x'  (order preserved)
```

### Note on simplification completeness

Simplification is undecidable in general. `simplify()` applies a set of rewrite rules
and may not find the most compact form. For guaranteed-safe simplifications over reals,
pass `{ context: simplify.realContext }`.

---

## derivative

Computes the symbolic derivative of an expression with respect to a variable:

```typescript
import { derivative, parse } from '@danielsimonjr/mathts-functions';

derivative('x^2', 'x').toString();          // '2 * x'
derivative('2 * x + 3', 'x').toString();    // '2'
derivative('sin(x)', 'x').toString();       // 'cos(x)'
derivative('x^2 * sin(x)', 'x').toString(); // '2 * x * sin(x) + x ^ 2 * cos(x)'
```

### Signature

```typescript
derivative(expr: string | Node, variable: string | SymbolNode, options?: {
  simplify?: boolean  // default: true
}): Node
```

The result is always a Node. Chain `.toString()` to get the string form, or `.evaluate(scope)`
to get a numeric value:

```typescript
const dfdx = derivative('x^3 + 2*x', 'x');  // 3 * x^2 + 2
dfdx.evaluate({ x: 4 });                     // 50
```

### Supported operations

Derivatives are implemented for: polynomials, `+`, `-`, `*`, `/`, `^`, `sin`, `cos`,
`tan`, `asin`, `acos`, `atan`, `exp`, `log`, `sqrt`, `abs`, and their compositions
via the chain rule.

---

## rationalize

Converts an expression to a rational form (ratio of two polynomials):

```typescript
import { rationalize } from '@danielsimonjr/mathts-functions';

rationalize('1/x + 1/y').toString();           // '(x + y) / (x * y)'
rationalize('(2x + 1) / (x^2 - 1)').toString(); // rational form
```

### Signature

```typescript
rationalize(expr: string | Node, scope?: Record<string, any>, detailed?: boolean): Node | {
  expression: Node;
  numerator: Node;
  denominator: Node;
  variables: string[];
}
```

When `detailed = true`, returns an object with the numerator and denominator split out.

---

## Combining symbolic and numeric evaluation

Symbolic operations compose naturally:

```typescript
const expr = parse('x^3 - 3*x^2 + 3*x - 1');

// Simplify first, then differentiate
const simplified = simplify(expr);
const d = derivative(simplified, 'x');

d.toString();               // '3 * x ^ 2 - 6 * x + 3'
d.evaluate({ x: 2 });      // 3  (which is (x-1)^2 evaluated at x=2)
```
