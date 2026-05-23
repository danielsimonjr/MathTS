# MathTS Priority Implementation Guide

## Sprint-by-Sprint Implementation Details

This guide provides detailed TypeScript implementation patterns for the highest-priority MathTS components.

---

## Quick Reference: What To Build First

### Phase 1: Foundation (Critical Path)

1. **Expression Tree System** - All symbolic math depends on this
2. **Pattern Matching Engine** - Powers simplification, integration, solving
3. **Simplification Rules** - Makes output usable

### Phase 2: UPTF Core

4. **Tensor Class** - Einstein notation, contraction, products
5. **Metric Tensor** - Christoffel computation
6. **Curvature Tensors** - Riemann, Ricci, Einstein

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

Heavy computations (Christoffel symbols, matrix inverses) are cached:

```typescript
class MetricTensor {
  private _inverse?: MetricTensor;

  inverse(): MetricTensor {
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

### Week 9-12: Tensor Engine

- [ ] Tensor class with index structure
- [ ] Index contraction
- [ ] Tensor products
- [ ] Symmetrization/antisymmetrization
- [ ] MetricTensor class
- [ ] Christoffel symbols (first and second kind)
- [ ] Covariant derivative
- [ ] Riemann tensor
- [ ] Ricci tensor and scalar
- [ ] Einstein tensor

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

## Example: Complete Schwarzschild Derivation

```typescript
import { MetricTensor, CurvatureTensors } from '@mathts/tensor';
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

// Create Schwarzschild metric
const metric = MetricTensor.schwarzschild(M, G, c);

// Compute curvature
const curvature = new CurvatureTensors(metric);

// Get Ricci scalar (should be 0 for vacuum solution)
const R = curvature.ricciScalar();
console.log('Ricci scalar:', R.toLatex()); // Should simplify to 0

// Get Kretschmann scalar
const K = curvature.kretschmann();
console.log('Kretschmann:', K.toLatex());
// Should give: 48G²M² / (c⁴r⁶)

// Compute Einstein tensor (should be 0 for vacuum)
const G_tensor = curvature.einstein();
for (let μ = 0; μ < 4; μ++) {
  for (let ν = 0; ν < 4; ν++) {
    const component = G_tensor.at([μ, ν]);
    if (!component.isZero()) {
      console.log(`G_${μ}${ν} = ${component.toLatex()}`);
    }
  }
}
```

---

_This guide will be updated as implementation progresses._
