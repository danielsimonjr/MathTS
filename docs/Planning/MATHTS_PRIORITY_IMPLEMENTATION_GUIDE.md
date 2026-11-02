# MathTS Priority Implementation Guide

## Sprint-by-Sprint Implementation Details

This guide provides detailed TypeScript implementation patterns for the highest-priority MathTS components.

---

## Quick Reference: What To Build First

### Phase 1: Foundation (Critical Path)

1. **Expression Tree System** - All symbolic math depends on this
2. **Pattern Matching Engine** - Powers simplification, integration, solving
3. **Simplification Rules** - Makes output usable

### Phase 2: Differential geometry sketches (closed — out of scope)

The following were design sketches only. They are **not** a MathTS API and are **not** scheduled: `MetricTensor`, Christoffel symbols, and curvature tensors (`Riemann`, `Ricci`, `Einstein`). The shipped `@danielsimonjr/mathts-tensor` package covers rank-N dense tensors and contraction; it does not expose this differential-geometry layer.

4. ~~**Tensor Class**~~ — see `@danielsimonjr/mathts-tensor` (landed)
5. ~~**Metric Tensor**~~ — out of scope
6. ~~**Curvature Tensors**~~ — out of scope

### Phase 3: Analysis

7. **Symbolic Differentiation** - Extend existing
8. **Symbolic Integration** - Pattern-based
9. **Series & Limits** - Taylor, Laurent

---

## Key Design Decisions

### 1. Immutable Expression Trees

All expression nodes are immutable. Operations return new nodes.

```typescript
// ✅ Correct - returns new node
const simplified = expr.simplify();

// ❌ Wrong - don't mutate
expr.children.push(newChild); // Never do this
```

### 2. Canonical Forms

Expressions are automatically normalized:

- Addition terms sorted (numbers first, then alphabetically)
- Multiplication factors sorted
- Nested operations flattened (a + (b + c) → a + b + c)

### 3. Lazy Evaluation

Heavy computations (matrix inverses, large contractions) are cached:

```typescript
class CachedInverse {
  private _inverse?: SomeMatrixType;

  inverse(): SomeMatrixType {
    if (!this._inverse) {
      this._inverse = this.computeInverse();
    }
    return this._inverse;
  }
}
```

---

## Core Type Hierarchy

```
Expression (interface)
├── NumberLiteral       // 3, 1/2, 3.14159...
├── SymbolNode          // x, y, θ, μ
├── ConstantNode        // π, e, i, ∞
├── AddNode             // a + b + c (n-ary)
├── MultiplyNode        // a * b * c (n-ary)
├── PowerNode           // a^b
├── FunctionCallNode    // sin(x), log(y)
├── DerivativeNode      // d/dx f(x)
├── IntegralNode        // ∫ f(x) dx
├── MatrixNode          // [[a,b],[c,d]]
└── TensorNode          // T^{μν}_{ρσ}
```

---

## Implementation Checklist

### Week 1-2: Expression Nodes

- [ ] NumberLiteral with exact fractions
- [ ] SymbolNode with assumptions
- [ ] ConstantNode (π, e, i)
- [ ] AddNode (n-ary, auto-flatten)
- [ ] MultiplyNode (n-ary, auto-flatten)
- [ ] PowerNode
- [ ] FunctionCallNode

### Week 3-4: Pattern Matching

- [ ] Pattern base class
- [ ] PatternVar (capture variable)
- [ ] LiteralPattern (match exact value)
- [ ] AddPattern (commutative matching)
- [ ] MultiplyPattern (commutative matching)
- [ ] PowerPattern
- [ ] FunctionPattern

### Week 5-6: Simplification

- [ ] SimplificationRule interface
- [ ] 50+ algebraic rules
- [ ] 20+ trigonometric rules
- [ ] SimplificationEngine (bottom-up application)
- [ ] Canonical form normalization

### Week 7-8: Differentiation

- [ ] Power rule
- [ ] Product rule
- [ ] Quotient rule
- [ ] Chain rule
- [ ] Trigonometric derivatives
- [ ] Logarithmic derivatives
- [ ] Implicit differentiation

### Week 9-12: Tensor engine (MathTS `@danielsimonjr/mathts-tensor`)

- [x] Tensor class with index structure (shipped)
- [x] Index contraction (shipped)
- [x] Tensor products (shipped)
- [x] Symmetrization/antisymmetrization (as applicable to shipped API)
- [ ] ~~MetricTensor class~~ — out of scope
- [ ] ~~Christoffel symbols (first and second kind)~~ — out of scope
- [ ] ~~Covariant derivative~~ — out of scope
- [ ] ~~Riemann tensor~~ — out of scope
- [ ] ~~Ricci tensor and scalar~~ — out of scope
- [ ] ~~Einstein tensor~~ — out of scope

---

## Testing Strategy

### Unit Tests

Every expression type needs:

- Construction tests
- Evaluation tests
- Substitution tests
- LaTeX output tests
- Equality tests

### Property-Based Tests

- Associativity: (a + b) + c = a + (b + c)
- Commutativity: a + b = b + a
- Distributivity: a(b + c) = ab + ac
- Simplification idempotence: simplify(simplify(x)) = simplify(x)

### Integration Tests

- Complete derivations (Schwarzschild geodesics)
- Known results (Ricci scalar for standard metrics)
- Round-trip: parse → simplify → toLatex → parse

---

## Performance Considerations

### Expression Tree Memory

- Use interning for common subexpressions
- Pool small objects (NumberLiteral for 0, 1, -1)

### Pattern Matching

- Index patterns by root type for fast rejection
- Cache failed matches

### Tensor Computation

- Exploit symmetries (g*{μν} = g*{νμ})
- Skip zero components
- Use sparse representation for mostly-zero tensors

---

## Error Handling

```typescript
// Domain errors
class MathDomainError extends Error {
  constructor(
    public readonly operation: string,
    public readonly reason: string
  ) {
    super(`${operation}: ${reason}`);
  }
}

// Usage
if (base instanceof NumberLiteral && base.isZero()) {
  if (exponent instanceof NumberLiteral && exponent.evaluate({}) <= 0) {
    throw new MathDomainError('Power', '0^n undefined for n ≤ 0');
  }
}
```

---

## LaTeX Output Guidelines

### Fractions

```typescript
// Prefer \frac for simple fractions
'\\frac{1}{2}'; // Not 1/2

// Use inline for complex expressions
'\\left(x + y\\right) / z';
```

### Greek Letters

```typescript
const greekMap = {
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  // ... etc
};
```

### Tensor Indices

```typescript
// Contravariant (upper) indices
'T^{\\mu\\nu}';

// Covariant (lower) indices
'T_{\\mu\\nu}';

// Mixed indices
'T^{\\mu}{}_{\\nu}'; // Note the {} for spacing
```

---

## File Organization

```
packages/
├── symbolic/
│   ├── src/
│   │   ├── nodes/
│   │   │   ├── number.ts
│   │   │   ├── symbol.ts
│   │   │   ├── add.ts
│   │   │   ├── multiply.ts
│   │   │   ├── power.ts
│   │   │   └── function.ts
│   │   ├── pattern/
│   │   │   ├── types.ts
│   │   │   ├── matcher.ts
│   │   │   └── builder.ts
│   │   ├── simplify/
│   │   │   ├── rules.ts
│   │   │   ├── engine.ts
│   │   │   └── trig.ts
│   │   └── index.ts
│   └── tests/
│
├── tensor/
│   ├── src/
│   │   ├── tensor.ts
│   │   ├── metric.ts
│   │   ├── christoffel.ts
│   │   ├── curvature.ts
│   │   ├── covariant.ts
│   │   └── metrics/
│   │       ├── minkowski.ts
│   │       ├── schwarzschild.ts
│   │       ├── kerr.ts
│   │       └── flrw.ts
│   └── tests/
│
└── core/
    ├── src/
    │   ├── matrix/
    │   ├── complex/
    │   └── fraction/
    └── tests/
```

---

## Example: Schwarzschild workbook sample (not a shipped API)

The workbook samples under `docs/Architecture/Workbook/` demonstrate `.mtsw` metadata and cells. They are **not** backed by a `MetricTensor` / `CurvatureTensors` API in MathTS today.

```typescript
// Illustrative sketch only — these imports are not part of the public MathTS API.
import { symbol } from '@mathts/symbolic';

// Define coordinates
const t = symbol('t');
const r = symbol('r');
const θ = symbol('θ');
const φ = symbol('φ');

// Define parameters
const M = symbol('M'); // Mass
const G = symbol('G'); // Gravitational constant
const c = symbol('c'); // Speed of light

// Metric and curvature computation via a differential-geometry layer is out of scope
// for MathTS; use workbook expression cells or external tools for GR sketches.
```

---

_This guide will be updated as implementation progresses._
