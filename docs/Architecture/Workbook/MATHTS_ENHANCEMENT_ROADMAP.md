# MathTS Enhancement Roadmap: Achieving Mathematica/Maple Parity

**Version**: 1.0.0
**Author**: Daniel Simon Jr. (@danielsimonjr)
**Date**: December 2025
**Purpose**: Transform MathTS into a world-class scientific computing platform for the MTSW Scientific Workbook

---

## Executive Summary

This document outlines a comprehensive roadmap to enhance MathTS from its current mathjs foundation to a powerful scientific computing platform comparable to Mathematica and Maple. The enhancements are organized into tiers based on implementation complexity and UPTF research priorities.

The goal is to power the **MathTS Scientific Workbook (.mtsw)** format—a YAML-based, reactive, Three.js-visualized scientific computing environment for theoretical physics research.

---

## Current State Analysis

### What mathjs Provides (Foundation)

| Category              | Functions                                                                                                                   | Status      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Arithmetic**        | abs, add, cbrt, ceil, cube, divide, exp, floor, gcd, hypot, lcm, log, mod, multiply, norm, pow, round, sign, sqrt, subtract | ✅ Complete |
| **Algebra**           | derivative, lsolve, lup, lusolve, lyap, qr, rationalize, schur, simplify, slu, sylvester, usolve                            | ✅ Basic    |
| **Matrix**            | concat, cross, det, diag, dot, eigs, expm, fft, identity, inv, kron, pinv, reshape, trace, transpose                        | ✅ Good     |
| **Statistics**        | corr, cumsum, mad, max, mean, median, min, mode, prod, quantileSeq, std, sum, variance                                      | ✅ Basic    |
| **Trigonometry**      | All standard trig and hyperbolic functions                                                                                  | ✅ Complete |
| **Complex**           | arg, conj, im, re                                                                                                           | ✅ Basic    |
| **Special Functions** | erf, zeta, gamma, factorial                                                                                                 | ⚠️ Limited  |

### Critical Gaps for Maple/Mathematica Parity

| Category                   | Gap                                                                   | Priority           |
| -------------------------- | --------------------------------------------------------------------- | ------------------ |
| **Symbolic Engine**        | Pattern matching, simplification rules, CAS                           | 🔴 Critical        |
| **Tensor Algebra**         | Einstein notation, index contraction, covariant derivatives           | 🔴 Critical        |
| **Calculus**               | Symbolic integration, series expansion, limits, multivariate calculus | 🔴 Critical        |
| **Differential Equations** | ODE/PDE solvers (symbolic + numeric), DAE support                     | 🔴 Critical        |
| **Special Functions**      | Bessel, elliptic, hypergeometric, orthogonal polynomials              | 🟡 High            |
| **Optimization**           | Constrained/unconstrained, global optimization, LP/QP                 | 🟡 High            |
| **Number Theory**          | Primes, factorization, modular arithmetic, Diophantine                | 🟢 Medium          |
| **Graph Theory**           | Graphs, networks, algorithms                                          | 🟢 Medium          |
| **Differential Geometry**  | Manifolds, curvature, geodesics                                       | 🔴 Critical (UPTF) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MathTS Scientific Workbook                           │
│              (YAML-based reactive notebook with Three.js viz)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           @danielsimonjr/mathts-workbook                                   │
│    YAML Parser │ Cell Executor │ Dependency Graph │ Export Engine            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌───────────────────┐    ┌─────────────────────┐    ┌───────────────────────┐
│   @mathts/viz     │    │  @mathts/symbolic   │    │   @mathts/export      │
│                   │    │                     │    │                       │
│ • Three.js 3D     │    │ • Expression Trees  │    │ • LaTeX Generation    │
│ • D3.js 2D        │    │ • Pattern Matching  │    │ • PDF Export          │
│ • WebGPU Render   │    │ • Simplification    │    │ • Jupyter Compat      │
│ • Animation       │    │ • Equation Solving  │    │ • Code Generation     │
└───────────────────┘    └─────────────────────┘    └───────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            @mathts/tensor                                    │
│    Einstein Notation │ Index Algebra │ Metric Tensors │ Curvature Tensors   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            @danielsimonjr/mathts-core                                      │
│   Matrix │ Complex │ BigNumber │ Fraction │ Unit │ Expression │ Functions   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
            │  Pure TS    │   │   WASM      │   │   WebGPU    │
            │  Backend    │   │   Backend   │   │   Backend   │
            │  (fallback) │   │  (SIMD)     │   │  (GPU)      │
            └─────────────┘   └─────────────┘   └─────────────┘
```

---

## Enhancement Tiers

### Tier 1: Core Symbolic Engine (Critical for Everything)

The symbolic engine is the foundation—without it, nothing else can work properly for a CAS.

#### 1.1 Expression Tree System

```typescript
// @mathts/symbolic/expression.ts

/**
 * Base expression node - all mathematical expressions derive from this
 */
interface Expression {
  type: ExpressionType;
  evaluate(scope: Scope): number | Complex | Matrix | Expression;
  simplify(rules?: SimplificationRules): Expression;
  differentiate(variable: Symbol): Expression;
  integrate(variable: Symbol): Expression;
  substitute(map: Map<Symbol, Expression>): Expression;
  toLatex(): string;
  toMathML(): string;
  equals(other: Expression): boolean;
  freeVariables(): Set<Symbol>;
  boundVariables(): Set<Symbol>;
}

enum ExpressionType {
  // Atoms
  NUMBER,
  SYMBOL,
  CONSTANT, // π, e, i, ∞

  // Operators
  ADD,
  MULTIPLY,
  POWER,
  DIVIDE,

  // Functions
  FUNCTION_CALL,
  DERIVATIVE,
  INTEGRAL,
  LIMIT,
  SUM,
  PRODUCT,

  // Structures
  MATRIX,
  TENSOR,
  LIST,
  SET,

  // Relations
  EQUATION,
  INEQUALITY,
}
```

#### 1.2 Pattern Matching Engine

```typescript
// @mathts/symbolic/patterns.ts

/**
 * Pattern matching for symbolic manipulation
 * Essential for simplification, integration, and equation solving
 */
interface Pattern {
  match(expr: Expression): MatchResult | null;
  substitute(bindings: Map<Symbol, Expression>): Expression;
}

// Example patterns for integration
const integrationPatterns: TransformRule[] = [
  // ∫ x^n dx = x^(n+1)/(n+1) for n ≠ -1
  {
    pattern: new IntegralPattern(new PowerPattern(Symbol('x'), PatternVar('n')), Symbol('x')),
    condition: (bindings) => !bindings.get('n').equals(Constant(-1)),
    transform: (bindings) => {
      const n = bindings.get('n');
      const x = bindings.get('x');
      return new Divide(new Power(x, new Add(n, Constant(1))), new Add(n, Constant(1)));
    },
  },

  // ∫ e^(ax) dx = e^(ax)/a
  {
    pattern: new IntegralPattern(new Exp(new Multiply(PatternVar('a'), Symbol('x'))), Symbol('x')),
    transform: (bindings) => {
      const a = bindings.get('a');
      return new Divide(new Exp(new Multiply(a, Symbol('x'))), a);
    },
  },

  // ∫ sin(x) dx = -cos(x)
  // ∫ cos(x) dx = sin(x)
  // ... hundreds more
];
```

#### 1.3 Simplification Engine

```typescript
// @mathts/symbolic/simplify.ts

/**
 * Multi-pass simplification with configurable rule sets
 */
class SimplificationEngine {
  private rules: SimplificationRule[];

  // Algebraic simplification (default)
  static algebraic(): SimplificationEngine;

  // Trigonometric simplification
  static trigonometric(): SimplificationEngine;

  // Logarithmic simplification
  static logarithmic(): SimplificationEngine;

  // Full simplification (expensive)
  static full(): SimplificationEngine;

  simplify(expr: Expression, options?: SimplifyOptions): Expression;
}

// Core simplification rules
const algebraicRules: SimplificationRule[] = [
  // x + 0 = x
  { pattern: Add(PatternVar('x'), Constant(0)), result: PatternVar('x') },

  // x * 1 = x
  { pattern: Multiply(PatternVar('x'), Constant(1)), result: PatternVar('x') },

  // x * 0 = 0
  { pattern: Multiply(PatternVar('x'), Constant(0)), result: Constant(0) },

  // x^0 = 1 (x ≠ 0)
  {
    pattern: Power(PatternVar('x'), Constant(0)),
    condition: (b) => !b.get('x').equals(Constant(0)),
    result: Constant(1),
  },

  // x^1 = x
  { pattern: Power(PatternVar('x'), Constant(1)), result: PatternVar('x') },

  // x - x = 0
  { pattern: Subtract(PatternVar('x'), PatternVar('x')), result: Constant(0) },

  // x / x = 1 (x ≠ 0)
  {
    pattern: Divide(PatternVar('x'), PatternVar('x')),
    condition: (b) => !b.get('x').equals(Constant(0)),
    result: Constant(1),
  },

  // (x^a)^b = x^(a*b)
  {
    pattern: Power(Power(PatternVar('x'), PatternVar('a')), PatternVar('b')),
    result: Power(PatternVar('x'), Multiply(PatternVar('a'), PatternVar('b'))),
  },

  // log(e^x) = x
  { pattern: Log(Exp(PatternVar('x'))), result: PatternVar('x') },

  // e^(log(x)) = x (x > 0)
  {
    pattern: Exp(Log(PatternVar('x'))),
    condition: (b) => b.get('x').isPositive(),
    result: PatternVar('x'),
  },

  // ... hundreds more rules
];
```

#### 1.4 Equation Solver

```typescript
// @mathts/symbolic/solve.ts

/**
 * Symbolic equation solver supporting various equation types
 */
class EquationSolver {
  /**
   * Solve equation for variable
   * @param equation Equation or expression (assumed = 0)
   * @param variable Variable to solve for
   * @returns Array of solutions
   */
  solve(equation: Expression | Equation, variable: Symbol, options?: SolveOptions): Expression[];

  /**
   * Solve system of equations
   */
  solveSystem(
    equations: (Expression | Equation)[],
    variables: Symbol[],
    options?: SolveOptions
  ): Map<Symbol, Expression>[];

  /**
   * Solve inequality
   */
  solveInequality(inequality: Inequality, variable: Symbol): Interval | Union<Interval>;
}

interface SolveOptions {
  domain: 'real' | 'complex' | 'integer' | 'rational';
  maxDegree: number; // For polynomial equations
  numeric: boolean; // Fall back to numeric if symbolic fails
  assumptions: Assumption[];
}
```

---

### Tier 2: Advanced Calculus (@mathts/calculus)

#### 2.1 Symbolic Integration

```typescript
// @mathts/calculus/integrate.ts

/**
 * Symbolic integration with multiple algorithms
 */
class Integrator {
  /**
   * Indefinite integral
   */
  integrate(expr: Expression, variable: Symbol, options?: IntegrateOptions): Expression;

  /**
   * Definite integral
   */
  definiteIntegral(
    expr: Expression,
    variable: Symbol,
    lower: Expression,
    upper: Expression,
    options?: IntegrateOptions
  ): Expression;

  /**
   * Multiple integral
   */
  multipleIntegral(expr: Expression, bounds: IntegrationBound[]): Expression;

  /**
   * Line integral
   */
  lineIntegral(vectorField: VectorField, curve: ParametricCurve): Expression;

  /**
   * Surface integral
   */
  surfaceIntegral(vectorField: VectorField, surface: ParametricSurface): Expression;
}

// Integration algorithms
enum IntegrationMethod {
  RISCH, // Risch algorithm (most general)
  HEURISTIC, // Heuristic pattern matching
  PARTIAL_FRACTIONS, // For rational functions
  TRIGONOMETRIC, // Trig substitution
  INTEGRATION_BY_PARTS,
  RESIDUE, // Complex contour integration
}
```

#### 2.2 Series and Limits

```typescript
// @mathts/calculus/series.ts

/**
 * Series expansion and manipulation
 */
class SeriesEngine {
  /**
   * Taylor/Maclaurin series
   */
  taylor(expr: Expression, variable: Symbol, point: Expression, order: number): PowerSeries;

  /**
   * Laurent series (complex analysis)
   */
  laurent(
    expr: Expression,
    variable: Symbol,
    point: Expression,
    positiveTerms: number,
    negativeTerms: number
  ): LaurentSeries;

  /**
   * Fourier series
   */
  fourier(expr: Expression, variable: Symbol, period: Expression, terms: number): FourierSeries;

  /**
   * Asymptotic expansion
   */
  asymptotic(
    expr: Expression,
    variable: Symbol,
    direction: 'infinity' | '-infinity' | Expression
  ): AsymptoticSeries;
}

/**
 * Limit computation
 */
class LimitEngine {
  /**
   * Compute limit
   */
  limit(
    expr: Expression,
    variable: Symbol,
    point: Expression,
    direction?: 'left' | 'right' | 'both'
  ): Expression;

  /**
   * L'Hôpital's rule application
   */
  lhopital(
    numerator: Expression,
    denominator: Expression,
    variable: Symbol,
    point: Expression
  ): Expression;
}
```

#### 2.3 Vector Calculus

```typescript
// @mathts/calculus/vector.ts

/**
 * Vector calculus operations
 */
class VectorCalculus {
  /**
   * Gradient of scalar field
   */
  gradient(scalarField: Expression, coordinates: CoordinateSystem): VectorField;

  /**
   * Divergence of vector field
   */
  divergence(vectorField: VectorField, coordinates: CoordinateSystem): Expression;

  /**
   * Curl of vector field
   */
  curl(vectorField: VectorField, coordinates: CoordinateSystem): VectorField;

  /**
   * Laplacian of scalar field
   */
  laplacian(scalarField: Expression, coordinates: CoordinateSystem): Expression;

  /**
   * Vector Laplacian
   */
  vectorLaplacian(vectorField: VectorField, coordinates: CoordinateSystem): VectorField;
}

enum CoordinateSystem {
  CARTESIAN,
  POLAR,
  CYLINDRICAL,
  SPHERICAL,
  GENERAL_CURVILINEAR,
}
```

---

### Tier 3: Tensor Algebra (@mathts/tensor) — UPTF Critical

This is the heart of the UPTF project.

#### 3.1 Tensor Core

```typescript
// @mathts/tensor/tensor.ts

/**
 * Abstract index notation tensor
 * Supports Einstein summation convention
 */
class Tensor {
  readonly rank: [number, number]; // [contravariant, covariant]
  readonly dimensions: number;

  constructor(components: NDArray | Expression[][][][], indexStructure: IndexStructure);

  /**
   * Index access with Einstein notation
   * g.at('μν') returns g_{μν}
   * g.at('^μν') returns g^{μν}
   */
  at(indices: string): Expression;

  /**
   * Contract indices
   * T.contract('α', 'β') contracts T^{αβ}_{αγ} → T^β_γ
   */
  contract(upper: string, lower: string): Tensor;

  /**
   * Raise index using metric
   */
  raiseIndex(index: string, metric: MetricTensor): Tensor;

  /**
   * Lower index using metric
   */
  lowerIndex(index: string, metric: MetricTensor): Tensor;

  /**
   * Tensor product
   */
  tensorProduct(other: Tensor): Tensor;

  /**
   * Symmetrize over indices
   */
  symmetrize(indices: string[]): Tensor;

  /**
   * Antisymmetrize over indices
   */
  antisymmetrize(indices: string[]): Tensor;

  /**
   * Trace over pair of indices
   */
  trace(index1: string, index2: string): Tensor;
}
```

#### 3.2 Einstein Notation Parser

```typescript
// @mathts/tensor/einstein.ts

/**
 * Parse Einstein notation expressions
 *
 * Examples:
 *   "g_{μν}" → metric tensor, both indices down
 *   "Γ^α_{βγ}" → Christoffel symbol, one up two down
 *   "R^ρ_{σμν}" → Riemann tensor
 *   "T^{μν}" → stress-energy tensor, both up
 */
class EinsteinParser {
  parse(notation: string): TensorExpression;

  /**
   * Evaluate tensor expression with Einstein summation
   * Automatically contracts repeated indices
   */
  evaluate(expr: string, context: TensorContext): Tensor | Expression;
}

// Examples of Einstein expressions:
// "g^{μα} g_{αν}" → δ^μ_ν (Kronecker delta)
// "Γ^α_{βγ} - Γ^α_{γβ}" → torsion tensor
// "∂_μ g_{αβ}" → partial derivative of metric
```

#### 3.3 Metric Tensors and Christoffel Symbols

```typescript
// @mathts/tensor/metric.ts

/**
 * Metric tensor with automatic Christoffel computation
 */
class MetricTensor extends Tensor {
  /**
   * Create from line element
   * ds² = g_{μν} dx^μ dx^ν
   */
  static fromLineElement(lineElement: Expression, coordinates: Symbol[]): MetricTensor;

  /**
   * Create from explicit components
   */
  static fromComponents(components: Expression[][], coordinates: Symbol[]): MetricTensor;

  /**
   * Get inverse metric g^{μν}
   */
  inverse(): MetricTensor;

  /**
   * Compute Christoffel symbols of the first kind
   * Γ_{αβγ} = (1/2)(∂_β g_{αγ} + ∂_γ g_{αβ} - ∂_α g_{βγ})
   */
  christoffelFirst(): ChristoffelSymbol;

  /**
   * Compute Christoffel symbols of the second kind
   * Γ^α_{βγ} = g^{αδ} Γ_{δβγ}
   */
  christoffelSecond(): ChristoffelSymbol;

  /**
   * Determinant of metric
   */
  determinant(): Expression;

  /**
   * Signature (p, q) where p = positive eigenvalues, q = negative
   */
  signature(): [number, number];
}

// Pre-defined metrics
const MinkowskiMetric = MetricTensor.fromComponents(
  [
    [-1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ],
  [Symbol('t'), Symbol('x'), Symbol('y'), Symbol('z')]
);

function SchwarzschildMetric(M: Expression): MetricTensor {
  const r = Symbol('r'),
    t = Symbol('t'),
    θ = Symbol('θ'),
    φ = Symbol('φ');
  const rs = Multiply(2, Divide(G, Multiply(c, c)), M); // Schwarzschild radius
  const f = Subtract(1, Divide(rs, r));

  return MetricTensor.fromComponents(
    [
      [Multiply(-1, f), 0, 0, 0],
      [0, Divide(1, f), 0, 0],
      [0, 0, Power(r, 2), 0],
      [0, 0, 0, Multiply(Power(r, 2), Power(Sin(θ), 2))],
    ],
    [t, r, θ, φ]
  );
}
```

#### 3.4 Curvature Tensors

```typescript
// @mathts/tensor/curvature.ts

/**
 * Riemann curvature tensor and derived quantities
 */
class CurvatureTensors {
  private metric: MetricTensor;
  private christoffel: ChristoffelSymbol;

  constructor(metric: MetricTensor) {
    this.metric = metric;
    this.christoffel = metric.christoffelSecond();
  }

  /**
   * Riemann curvature tensor
   * R^ρ_{σμν} = ∂_μ Γ^ρ_{νσ} - ∂_ν Γ^ρ_{μσ} + Γ^ρ_{μλ}Γ^λ_{νσ} - Γ^ρ_{νλ}Γ^λ_{μσ}
   */
  riemann(): RiemannTensor;

  /**
   * Ricci tensor
   * R_{μν} = R^ρ_{μρν}
   */
  ricci(): RicciTensor;

  /**
   * Ricci scalar
   * R = g^{μν} R_{μν}
   */
  ricciScalar(): Expression;

  /**
   * Einstein tensor
   * G_{μν} = R_{μν} - (1/2) g_{μν} R
   */
  einstein(): EinsteinTensor;

  /**
   * Weyl tensor (conformal tensor)
   */
  weyl(): WeylTensor;

  /**
   * Kretschmann scalar
   * K = R^{αβγδ} R_{αβγδ}
   */
  kretschmann(): Expression;
}
```

#### 3.5 Covariant Derivatives

```typescript
// @mathts/tensor/derivative.ts

/**
 * Covariant derivative operations
 */
class CovariantDerivative {
  private connection: Connection;

  /**
   * Covariant derivative of scalar
   * ∇_μ φ = ∂_μ φ
   */
  ofScalar(scalar: Expression, index: string): Tensor;

  /**
   * Covariant derivative of contravariant vector
   * ∇_μ V^ν = ∂_μ V^ν + Γ^ν_{μρ} V^ρ
   */
  ofContravariantVector(vector: Tensor, index: string): Tensor;

  /**
   * Covariant derivative of covariant vector
   * ∇_μ V_ν = ∂_μ V_ν - Γ^ρ_{μν} V_ρ
   */
  ofCovariantVector(vector: Tensor, index: string): Tensor;

  /**
   * Covariant derivative of general tensor
   */
  of(tensor: Tensor, index: string): Tensor;

  /**
   * Lie derivative
   */
  lie(tensor: Tensor, vectorField: Tensor): Tensor;
}
```

---

### Tier 4: Special Functions (@mathts/special)

#### 4.1 Bessel Functions

```typescript
// @mathts/special/bessel.ts

/**
 * Bessel functions of all kinds
 */
namespace Bessel {
  // Bessel function of first kind J_n(x)
  function J(n: number | Expression, x: Expression): Expression;

  // Bessel function of second kind Y_n(x)
  function Y(n: number | Expression, x: Expression): Expression;

  // Modified Bessel function of first kind I_n(x)
  function I(n: number | Expression, x: Expression): Expression;

  // Modified Bessel function of second kind K_n(x)
  function K(n: number | Expression, x: Expression): Expression;

  // Spherical Bessel functions j_n(x), y_n(x)
  function sphericalJ(n: number, x: Expression): Expression;
  function sphericalY(n: number, x: Expression): Expression;

  // Hankel functions H^(1)_n(x), H^(2)_n(x)
  function hankel1(n: number | Expression, x: Expression): Expression;
  function hankel2(n: number | Expression, x: Expression): Expression;

  // Airy functions Ai(x), Bi(x)
  function airyAi(x: Expression): Expression;
  function airyBi(x: Expression): Expression;
}
```

#### 4.2 Orthogonal Polynomials

```typescript
// @mathts/special/orthogonal.ts

/**
 * Classical orthogonal polynomials
 */
namespace OrthogonalPolynomials {
  // Legendre polynomials P_n(x)
  function legendre(n: number, x: Expression): Expression;

  // Associated Legendre polynomials P^m_n(x)
  function associatedLegendre(n: number, m: number, x: Expression): Expression;

  // Spherical harmonics Y^m_l(θ, φ)
  function sphericalHarmonic(l: number, m: number, theta: Expression, phi: Expression): Expression;

  // Chebyshev polynomials T_n(x), U_n(x)
  function chebyshevT(n: number, x: Expression): Expression;
  function chebyshevU(n: number, x: Expression): Expression;

  // Hermite polynomials H_n(x)
  function hermite(n: number, x: Expression): Expression;

  // Laguerre polynomials L_n(x)
  function laguerre(n: number, x: Expression): Expression;

  // Associated Laguerre polynomials L^α_n(x)
  function associatedLaguerre(n: number, alpha: number | Expression, x: Expression): Expression;

  // Jacobi polynomials P^(α,β)_n(x)
  function jacobi(n: number, alpha: number, beta: number, x: Expression): Expression;

  // Gegenbauer polynomials C^λ_n(x)
  function gegenbauer(n: number, lambda: number | Expression, x: Expression): Expression;
}
```

#### 4.3 Hypergeometric Functions

```typescript
// @mathts/special/hypergeometric.ts

/**
 * Hypergeometric functions
 */
namespace Hypergeometric {
  // Gauss hypergeometric function 2F1(a,b;c;z)
  function F21(a: Expression, b: Expression, c: Expression, z: Expression): Expression;

  // Confluent hypergeometric function 1F1(a;b;z)
  function F11(a: Expression, b: Expression, z: Expression): Expression;

  // Generalized hypergeometric function pFq
  function pFq(p: Expression[], q: Expression[], z: Expression): Expression;

  // Kummer function M(a,b,z)
  function kummerM(a: Expression, b: Expression, z: Expression): Expression;

  // Tricomi function U(a,b,z)
  function tricomiU(a: Expression, b: Expression, z: Expression): Expression;

  // Whittaker functions M_κ,μ(z), W_κ,μ(z)
  function whittakerM(kappa: Expression, mu: Expression, z: Expression): Expression;
  function whittakerW(kappa: Expression, mu: Expression, z: Expression): Expression;
}
```

#### 4.4 Elliptic Functions

```typescript
// @mathts/special/elliptic.ts

/**
 * Elliptic integrals and functions
 */
namespace Elliptic {
  // Complete elliptic integral of first kind K(k)
  function K(k: Expression): Expression;

  // Complete elliptic integral of second kind E(k)
  function E(k: Expression): Expression;

  // Complete elliptic integral of third kind Π(n,k)
  function Pi(n: Expression, k: Expression): Expression;

  // Incomplete elliptic integrals F(φ,k), E(φ,k), Π(n,φ,k)
  function incompleteF(phi: Expression, k: Expression): Expression;
  function incompleteE(phi: Expression, k: Expression): Expression;
  function incompletePi(n: Expression, phi: Expression, k: Expression): Expression;

  // Jacobi elliptic functions sn, cn, dn
  function sn(u: Expression, k: Expression): Expression;
  function cn(u: Expression, k: Expression): Expression;
  function dn(u: Expression, k: Expression): Expression;

  // Weierstrass elliptic function ℘(z)
  function weierstrass(z: Expression, g2: Expression, g3: Expression): Expression;

  // Jacobi theta functions θ_i(z,q)
  function theta1(z: Expression, q: Expression): Expression;
  function theta2(z: Expression, q: Expression): Expression;
  function theta3(z: Expression, q: Expression): Expression;
  function theta4(z: Expression, q: Expression): Expression;
}
```

---

### Tier 5: Differential Equations (@mathts/ode)

#### 5.1 ODE Solvers

```typescript
// @mathts/ode/solve.ts

/**
 * Ordinary Differential Equation solvers
 */
class ODESolver {
  /**
   * Symbolic ODE solver
   * Attempts to find closed-form solutions
   */
  solveSymbolic(
    equation: DifferentialEquation,
    dependent: Symbol,
    independent: Symbol,
    initialConditions?: InitialConditions
  ): Expression | null;

  /**
   * Numeric ODE solver
   * Various methods available
   */
  solveNumeric(
    equation: DifferentialEquation | SystemOfODEs,
    initialConditions: InitialConditions,
    tSpan: [number, number],
    options?: ODEOptions
  ): ODESolution;

  /**
   * Classify ODE type
   */
  classify(equation: DifferentialEquation): ODEClassification;
}

interface ODEOptions {
  method:
    | 'RK45' // Dormand-Prince (default)
    | 'RK23' // Bogacki-Shampine
    | 'DOP853' // High-order Dormand-Prince
    | 'BDF' // Backward differentiation (stiff problems)
    | 'RADAU' // Implicit Runge-Kutta (stiff problems)
    | 'LSODA'; // Automatic stiff/non-stiff detection

  rtol: number; // Relative tolerance
  atol: number; // Absolute tolerance
  maxStep: number;
  dense: boolean; // Dense output interpolation
}

enum ODEClassification {
  FIRST_ORDER_LINEAR,
  FIRST_ORDER_SEPARABLE,
  FIRST_ORDER_EXACT,
  FIRST_ORDER_BERNOULLI,
  FIRST_ORDER_RICCATI,
  SECOND_ORDER_LINEAR_CONSTANT,
  SECOND_ORDER_EULER,
  SECOND_ORDER_BESSEL,
  HIGHER_ORDER_LINEAR,
  NONLINEAR,
}
```

#### 5.2 PDE Solvers

```typescript
// @mathts/pde/solve.ts

/**
 * Partial Differential Equation support
 */
class PDESolver {
  /**
   * Symbolic PDE solver for special cases
   */
  solveSymbolic(
    equation: PartialDifferentialEquation,
    dependent: Symbol,
    independents: Symbol[],
    boundaryConditions?: BoundaryConditions
  ): Expression | null;

  /**
   * Method of characteristics
   */
  characteristics(equation: FirstOrderPDE, initialCurve: ParametricCurve): Expression;

  /**
   * Separation of variables
   */
  separateVariables(equation: PartialDifferentialEquation): SeparatedSolution | null;

  /**
   * Finite Element Method solver
   */
  fem(
    equation: PartialDifferentialEquation,
    domain: Mesh,
    boundaryConditions: BoundaryConditions,
    options?: FEMOptions
  ): FEMSolution;
}
```

---

### Tier 6: Optimization (@mathts/optimize)

```typescript
// @mathts/optimize/optimize.ts

/**
 * Optimization algorithms
 */
class Optimizer {
  /**
   * Unconstrained minimization
   */
  minimize(
    objective: Expression | ((x: number[]) => number),
    x0: number[],
    options?: MinimizeOptions
  ): OptimizationResult;

  /**
   * Constrained optimization
   */
  minimizeConstrained(
    objective: Expression,
    constraints: Constraint[],
    x0: number[],
    options?: ConstrainedOptions
  ): OptimizationResult;

  /**
   * Linear programming
   */
  linprog(
    c: number[], // Objective coefficients
    A_ub?: number[][], // Inequality constraint matrix
    b_ub?: number[], // Inequality bounds
    A_eq?: number[][], // Equality constraint matrix
    b_eq?: number[], // Equality values
    bounds?: [number, number][]
  ): LPResult;

  /**
   * Quadratic programming
   */
  quadprog(
    H: number[][], // Quadratic term
    f: number[], // Linear term
    A?: number[][], // Inequality constraints
    b?: number[],
    Aeq?: number[][], // Equality constraints
    beq?: number[]
  ): QPResult;

  /**
   * Global optimization
   */
  globalMinimize(
    objective: Expression | Function,
    bounds: [number, number][],
    options?: GlobalOptions
  ): OptimizationResult;

  /**
   * Root finding
   */
  findRoot(
    func: Expression | ((x: number) => number),
    bracket?: [number, number],
    x0?: number,
    method?: 'brentq' | 'newton' | 'secant' | 'bisection'
  ): number;
}
```

---

### Tier 7: Visualization Engine (@mathts/viz)

#### 7.1 Three.js Integration

```typescript
// @mathts/viz/three.ts

/**
 * Three.js-based scientific visualization
 */
class ScientificScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  /**
   * Plot 3D surface z = f(x, y)
   */
  plotSurface(
    func: (x: number, y: number) => number,
    xRange: [number, number],
    yRange: [number, number],
    options?: SurfaceOptions
  ): THREE.Mesh;

  /**
   * Plot parametric surface
   */
  plotParametricSurface(
    parameterization: {
      x: (u: number, v: number) => number;
      y: (u: number, v: number) => number;
      z: (u: number, v: number) => number;
    },
    uRange: [number, number],
    vRange: [number, number],
    options?: SurfaceOptions
  ): THREE.Mesh;

  /**
   * Plot vector field
   */
  plotVectorField(field: VectorField, domain: Box3D, options?: VectorFieldOptions): THREE.Group;

  /**
   * Plot geodesic on manifold
   */
  plotGeodesic(
    metric: MetricTensor,
    initialPoint: number[],
    initialVelocity: number[],
    parameterRange: [number, number],
    options?: GeodesicOptions
  ): THREE.Line;

  /**
   * Visualize tensor field
   */
  plotTensorField(tensor: Tensor, domain: Box3D, options?: TensorVizOptions): THREE.Group;

  /**
   * Animate time evolution
   */
  animate(updater: (t: number) => void, duration: number, options?: AnimationOptions): Animation;
}

interface SurfaceOptions {
  colorMap: 'viridis' | 'plasma' | 'inferno' | 'magma' | 'coolwarm' | 'rainbow';
  wireframe: boolean;
  opacity: number;
  resolution: [number, number];
  lighting: 'physical' | 'basic' | 'none';
}
```

---

## Implementation Phases

### Phase 1: Foundation (Months 1-3)

**Sprint 1-2: Expression Tree System**

- Implement base `Expression` interface and all node types
- Expression builder utilities
- LaTeX and MathML output
- Basic evaluation

**Sprint 3-4: Pattern Matching**

- Pattern AST
- Matching algorithm
- Substitution engine
- Rule application framework

**Sprint 5-6: Basic Simplification**

- Algebraic simplification rules (100+ rules)
- Canonical form normalization
- Polynomial arithmetic

### Phase 2: Symbolic Math (Months 4-6)

**Sprint 7-8: Equation Solving**

- Linear equation solver
- Polynomial solver (up to degree 4 symbolic, numeric for higher)
- System of equations
- Inequality solver

**Sprint 9-10: Differentiation & Integration**

- Symbolic differentiation (complete)
- Integration by parts, substitution
- Partial fractions
- Pattern-based integration (80% of common integrals)

**Sprint 11-12: Series & Limits**

- Taylor/Laurent series
- Limit computation
- Asymptotic analysis

### Phase 3: Tensor Engine (Months 7-9) — UPTF Priority

**Sprint 13-14: Tensor Core**

- Tensor class with index structure
- Einstein notation parser
- Index contraction
- Tensor products

**Sprint 15-16: Metric & Connection**

- Metric tensor implementation
- Christoffel symbol computation
- Index raising/lowering
- Covariant derivative

**Sprint 17-18: Curvature**

- Riemann tensor
- Ricci tensor and scalar
- Einstein tensor
- Weyl tensor

### Phase 4: Differential Equations (Months 10-11)

**Sprint 19-20: ODE Solvers**

- First-order ODE classification and solving
- Second-order linear ODEs
- Numeric integrators (RK45, BDF)

**Sprint 21-22: PDE Support**

- Method of characteristics
- Separation of variables
- Basic FEM for simple domains

### Phase 5: Special Functions (Months 12-13)

**Sprint 23-24: Core Special Functions**

- Bessel functions (all types)
- Orthogonal polynomials
- Elliptic functions
- Hypergeometric functions

### Phase 6: Visualization (Months 14-15)

**Sprint 25-26: Three.js Integration**

- Scene setup and management
- Surface plotting
- Vector field visualization
- Geodesic visualization

**Sprint 27-28: Animation & Export**

- Time evolution animation
- Screenshot/video export
- glTF export for sharing

### Phase 7: Workbook Integration (Months 16-18)

**Sprint 29-30: YAML Runtime**

- Cell parsing and execution
- Dependency graph
- Reactive updates

**Sprint 31-32: UI Components**

- Monaco editor integration
- KaTeX/MathJax rendering
- Cell output rendering

**Sprint 33-36: Polish & Documentation**

- Documentation site
- Example notebooks
- Performance optimization
- Test coverage

---

## Function Inventory: Mathematica/Maple Parity Checklist

### Arithmetic & Elementary (Tier 0 - Already Done ✅)

| Function    | mathjs | MathTS | Notes |
| ----------- | ------ | ------ | ----- |
| `abs`       | ✅     | ✅     |       |
| `add`       | ✅     | ✅     |       |
| `subtract`  | ✅     | ✅     |       |
| `multiply`  | ✅     | ✅     |       |
| `divide`    | ✅     | ✅     |       |
| `pow`       | ✅     | ✅     |       |
| `sqrt`      | ✅     | ✅     |       |
| `cbrt`      | ✅     | ✅     |       |
| `nthRoot`   | ✅     | ✅     |       |
| `exp`       | ✅     | ✅     |       |
| `log`       | ✅     | ✅     |       |
| `log10`     | ✅     | ✅     |       |
| `log2`      | ✅     | ✅     |       |
| `gcd`       | ✅     | ✅     |       |
| `lcm`       | ✅     | ✅     |       |
| `mod`       | ✅     | ✅     |       |
| `round`     | ✅     | ✅     |       |
| `floor`     | ✅     | ✅     |       |
| `ceil`      | ✅     | ✅     |       |
| `sign`      | ✅     | ✅     |       |
| `factorial` | ✅     | ✅     |       |

### Trigonometry (Tier 0 - Already Done ✅)

| Function                  | mathjs | MathTS | Notes |
| ------------------------- | ------ | ------ | ----- |
| `sin`, `cos`, `tan`       | ✅     | ✅     |       |
| `asin`, `acos`, `atan`    | ✅     | ✅     |       |
| `sinh`, `cosh`, `tanh`    | ✅     | ✅     |       |
| `asinh`, `acosh`, `atanh` | ✅     | ✅     |       |
| `sec`, `csc`, `cot`       | ✅     | ✅     |       |
| `asec`, `acsc`, `acot`    | ✅     | ✅     |       |
| `sech`, `csch`, `coth`    | ✅     | ✅     |       |

### Matrix Operations (Tier 0 - Mostly Done)

| Function      | mathjs | MathTS | Notes           |
| ------------- | ------ | ------ | --------------- |
| `matrix`      | ✅     | ✅     |                 |
| `det`         | ✅     | ✅     |                 |
| `inv`         | ✅     | ✅     |                 |
| `transpose`   | ✅     | ✅     |                 |
| `trace`       | ✅     | ✅     |                 |
| `eigs`        | ✅     | ✅     |                 |
| `lup`         | ✅     | ✅     |                 |
| `qr`          | ✅     | ✅     |                 |
| `svd`         | ❌     | 🔄     | **Need to add** |
| `cholesky`    | ❌     | 🔄     | **Need to add** |
| `nullSpace`   | ❌     | 🔄     | **Need to add** |
| `columnSpace` | ❌     | 🔄     | **Need to add** |
| `rank`        | ❌     | 🔄     | **Need to add** |
| `condition`   | ❌     | 🔄     | **Need to add** |
| `matrixExp`   | ✅     | ✅     | `expm`          |
| `matrixLog`   | ❌     | 🔄     | **Need to add** |
| `matrixPow`   | ✅     | ✅     |                 |

### Symbolic (Tier 1 - New)

| Function       | mathjs | MathTS | Notes                     |
| -------------- | ------ | ------ | ------------------------- |
| `simplify`     | ✅     | 🔄     | Enhance significantly     |
| `expand`       | ❌     | 🔄     | **New**                   |
| `factor`       | ❌     | 🔄     | **New**                   |
| `collect`      | ❌     | 🔄     | **New**                   |
| `apart`        | ❌     | 🔄     | Partial fractions         |
| `together`     | ❌     | 🔄     | Combine fractions         |
| `cancel`       | ❌     | 🔄     | Cancel common factors     |
| `trigSimplify` | ❌     | 🔄     | **New**                   |
| `powSimplify`  | ❌     | 🔄     | **New**                   |
| `logSimplify`  | ❌     | 🔄     | **New**                   |
| `substitute`   | ❌     | 🔄     | **New**                   |
| `solve`        | ❌     | 🔄     | **New** - symbolic solver |
| `solveSystem`  | ❌     | 🔄     | **New**                   |

### Calculus (Tier 2 - Partial/New)

| Function            | mathjs | MathTS | Notes              |
| ------------------- | ------ | ------ | ------------------ |
| `derivative`        | ✅     | ✅     | Works, enhance     |
| `integrate`         | ❌     | 🔄     | **New** - symbolic |
| `definiteIntegral`  | ❌     | 🔄     | **New**            |
| `partialDerivative` | ❌     | 🔄     | **New**            |
| `gradient`          | ❌     | 🔄     | **New**            |
| `divergence`        | ❌     | 🔄     | **New**            |
| `curl`              | ❌     | 🔄     | **New**            |
| `laplacian`         | ❌     | 🔄     | **New**            |
| `limit`             | ❌     | 🔄     | **New**            |
| `series`            | ❌     | 🔄     | **New**            |
| `taylor`            | ❌     | 🔄     | **New**            |
| `fourierSeries`     | ❌     | 🔄     | **New**            |
| `fourierTransform`  | ❌     | 🔄     | **New** - symbolic |
| `laplaceTransform`  | ❌     | 🔄     | **New**            |
| `inverseLaplace`    | ❌     | 🔄     | **New**            |

### Tensor Algebra (Tier 3 - New)

| Function              | mathjs | MathTS | Notes   |
| --------------------- | ------ | ------ | ------- |
| `tensor`              | ❌     | 🔄     | **New** |
| `tensorContract`      | ❌     | 🔄     | **New** |
| `tensorProduct`       | ❌     | 🔄     | **New** |
| `metricTensor`        | ❌     | 🔄     | **New** |
| `christoffel`         | ❌     | 🔄     | **New** |
| `riemann`             | ❌     | 🔄     | **New** |
| `ricci`               | ❌     | 🔄     | **New** |
| `ricciScalar`         | ❌     | 🔄     | **New** |
| `einstein`            | ❌     | 🔄     | **New** |
| `weyl`                | ❌     | 🔄     | **New** |
| `covariantDerivative` | ❌     | 🔄     | **New** |
| `lieDerivative`       | ❌     | 🔄     | **New** |

### Special Functions (Tier 4 - Partial/New)

| Function            | mathjs | MathTS | Notes   |
| ------------------- | ------ | ------ | ------- |
| `gamma`             | ✅     | ✅     |         |
| `lgamma`            | ✅     | ✅     |         |
| `beta`              | ❌     | 🔄     | **New** |
| `digamma`           | ❌     | 🔄     | **New** |
| `polygamma`         | ❌     | 🔄     | **New** |
| `erf`               | ✅     | ✅     |         |
| `erfc`              | ❌     | 🔄     | **New** |
| `erfi`              | ❌     | 🔄     | **New** |
| `besselJ`           | ❌     | 🔄     | **New** |
| `besselY`           | ❌     | 🔄     | **New** |
| `besselI`           | ❌     | 🔄     | **New** |
| `besselK`           | ❌     | 🔄     | **New** |
| `airyAi`            | ❌     | 🔄     | **New** |
| `airyBi`            | ❌     | 🔄     | **New** |
| `legendreP`         | ❌     | 🔄     | **New** |
| `sphericalHarmonic` | ❌     | 🔄     | **New** |
| `hermiteH`          | ❌     | 🔄     | **New** |
| `laguerreL`         | ❌     | 🔄     | **New** |
| `chebyshevT`        | ❌     | 🔄     | **New** |
| `chebyshevU`        | ❌     | 🔄     | **New** |
| `ellipticK`         | ❌     | 🔄     | **New** |
| `ellipticE`         | ❌     | 🔄     | **New** |
| `ellipticPi`        | ❌     | 🔄     | **New** |
| `jacobiSN`          | ❌     | 🔄     | **New** |
| `weierstrass`       | ❌     | 🔄     | **New** |
| `hypergeometric2F1` | ❌     | 🔄     | **New** |
| `zeta`              | ✅     | ✅     |         |
| `polylog`           | ❌     | 🔄     | **New** |

### Differential Equations (Tier 5 - Partial/New)

| Function    | mathjs | MathTS | Notes                  |
| ----------- | ------ | ------ | ---------------------- |
| `dsolve`    | ❌     | 🔄     | **New** - symbolic ODE |
| `solveODE`  | ✅     | ✅     | Numeric only           |
| `dsolvePDE` | ❌     | 🔄     | **New**                |
| `odeSystem` | ❌     | 🔄     | **New**                |

### Optimization (Tier 6 - New)

| Function       | mathjs | MathTS | Notes   |
| -------------- | ------ | ------ | ------- |
| `minimize`     | ❌     | 🔄     | **New** |
| `maximize`     | ❌     | 🔄     | **New** |
| `findRoot`     | ❌     | 🔄     | **New** |
| `linprog`      | ❌     | 🔄     | **New** |
| `quadprog`     | ❌     | 🔄     | **New** |
| `leastSquares` | ❌     | 🔄     | **New** |
| `curveFit`     | ❌     | 🔄     | **New** |

---

## Dependencies & Technology Stack

### Core Dependencies

```json
{
  "dependencies": {
    "typed-function": "workspace:*", // Your TS port
    "workerpool": "workspace:*", // Your TS port
    "assemblyscript": "^0.27.0", // WASM compilation
    "decimal.js": "^10.4.0", // Arbitrary precision
    "fraction.js": "^4.3.0", // Exact fractions
    "complex.js": "^2.1.0", // Complex numbers
    "three": "^0.160.0", // 3D visualization
    "d3": "^7.8.0", // 2D visualization
    "yaml": "^2.3.0", // YAML parsing
    "katex": "^0.16.0", // LaTeX rendering
    "monaco-editor": "^0.44.0" // Code editor
  }
}
```

### Build & Development

```json
{
  "devDependencies": {
    "@assemblyscript/loader": "^0.27.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "esbuild": "^0.19.0",
    "@webgpu/types": "^0.1.0"
  }
}
```

---

## Completed Milestones

### AssemblyScript WASM Backend (COMPLETE ✅)

**Completed**: April 2026  
**Branch**: `master` (commit range: `e88cd9460` – `55dea0d71`)

AssemblyScript is the sole WASM backend, compiled with `asc`. The modules live in `assembly/src/`.

| Metric             | Value                           |
| ------------------ | ------------------------------- |
| Source modules     | 63 AssemblyScript modules       |
| Exported functions | 826 exports                     |
| Binary size        | 669 KB (`lib/wasm/mathjs.wasm`) |
| Workspace          | `assembly/`                     |
| Speed vs JS        | 2–55x (operation-dependent)     |

**Built-in coverage**:

- Dense linear algebra (LU, QR, SVD, eigs)
- FFT and signal processing
- Statistical distributions
- Portable math primitives

**Performance highlights** (measured against JS fallback):

- Matrix multiply 200×200: **7.4x faster** (20ms → 2.7ms)
- Dot product 1000 elements: **27.6x faster** (0.05ms → 0.002ms)
- Determinant 100×100: **6.9x faster** (1.5ms → 0.2ms)

---

## Planned Iterations

### Iteration 2: Benchmark Visualization (Planned)

Add an in-workbook benchmark overlay panel to the MTSW ISE that displays real-time JS vs WASM timing comparisons per operation:

- Per-cell execution time with backend annotation (JS / WASM / WebGPU)
- Sparkline history showing timing variance across re-evaluations
- Export benchmark report as `.csv` or embed in `.mtsw` metadata

### Iteration 5: WebGPU Exploration (Planned)

Extend the backend stack by adding WebGPU compute shaders for very large matrices (>100,000 elements):

- Leverage existing `GPUBackend.ts` scaffolding
- Target matrix multiply speedup: 50–200x over JS for 1024×1024+
- Requires Chrome 113+ / Edge 113+; JS fallback always available
- Add a runtime backend selector to allow `backend=webgpu`

---

## Success Metrics

### Functional Parity Metrics

| Metric               | Target | Measurement                                    |
| -------------------- | ------ | ---------------------------------------------- |
| Core Functions       | 200+   | Count of implemented functions                 |
| Symbolic Integration | 80%    | Success rate on standard integral tables       |
| ODE Solving          | 90%    | Success rate on ODE classification tests       |
| Special Functions    | 50+    | Functions with full numeric + symbolic support |
| Tensor Operations    | 100%   | UPTF requirement coverage                      |

### Performance Metrics

| Operation                           | Target | Baseline         |
| ----------------------------------- | ------ | ---------------- |
| Matrix multiply (1000x1000)         | <50ms  | ~200ms (pure JS) |
| Eigenvalue decomposition (500x500)  | <100ms | ~500ms           |
| Symbolic simplification (100 terms) | <10ms  | N/A              |
| Tensor contraction (rank 4)         | <5ms   | N/A              |

### Quality Metrics

| Metric             | Target          |
| ------------------ | --------------- |
| Test Coverage      | >90%            |
| Documentation      | 100% public API |
| TypeScript Strict  | Enabled         |
| Bundle Size (core) | <500KB          |

---

## Conclusion

This roadmap transforms MathTS from a mathjs port into a legitimate scientific computing platform capable of supporting serious theoretical physics research. The phased approach prioritizes:

1. **Foundation first** — Symbolic engine enables everything else
2. **UPTF alignment** — Tensor algebra is a priority, not an afterthought
3. **Incremental value** — Each phase delivers usable functionality
4. **Performance aware** — WASM/WebGPU from the start, not bolted on

The end goal: a TypeScript-native, web-first alternative to Mathematica/Maple that powers beautiful, reactive scientific workbooks for the UPTF and beyond.

---

_Document Version: 1.0.0_
_Last Updated: December 2025_
