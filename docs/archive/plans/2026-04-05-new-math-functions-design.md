# New Math Functions — Design Document

**Generated**: 2026-04-05
**Source**: mathjs WASM codebase analysis (72 functions implemented in WASM, not yet TypeScript APIs)

## Summary

MathTS has **100% coverage** of all mathjs factory functions (242/273 activated, 31 infrastructure). However, the mathjs fork's WASM layer contains **72 additional math functions** not present in the original mathjs or exposed as TypeScript APIs. These represent new capabilities that would differentiate MathTS from mathjs.

## New Function Categories

### 1. Numerical Methods (22 functions)

**Integration** (4): `trapezoidalRule`, `simpsonsRule`, `gaussLegendre`, `romberg`

- Definite integration of functions over intervals
- Gauss-Legendre is most accurate for smooth functions
- Romberg provides adaptive refinement

**Interpolation** (5): `lagrangeInterp`, `cubicSplineEval`, `hermiteInterp`, `pchipInterp`, `akimaInterp`

- Shape-preserving (PCHIP, Akima) vs smooth (cubic spline, Hermite)
- `polyFit` for least-squares polynomial fitting

**Differentiation** (6): `gradient`, `hessian`, `jacobian`, `laplacian`, `divergence`, `curl3D`

- Numerical derivatives of scalar and vector fields
- Essential for physics simulations and optimization

**Root-Finding** (6): `bisectionStep`, `newtonStep`, `secantStep`, `brentStep`, `halleyStep`, `mullerStep`

- Step-based API for iterative root finding
- Brent is most robust, Newton is fastest for smooth functions

### 2. Geometry (18 functions)

**Angles**: `angle2D`, `angle3D`
**Products**: `cross3D`, `dot3D`
**Areas**: `triangleArea`, `polygonArea`
**Spatial**: `convexHull`, `pointInPolygon`
**Transforms**: `rotateVector2D`, `rotateVector3D`, `reflectVector`, `projectVector`
**Distance**: `distance2D`, `distance3D`, `distanceND`, `distancePointToLine2D`
**Intersection**: `intersect2DInfiniteLines`, `intersect2DLines`

### 3. Probability Distributions (10 functions)

**Continuous**: `normalPDF`, `normalCDF`, `exponentialPDF`, `exponentialCDF`
**Discrete**: `bernoulli`, `binomial`, `poisson`, `geometric`
**Information**: `entropy`, `jsDivergence`

### 4. Special Functions (8 functions)

`erfc` (complementary error), `beta`, `gammainc` (incomplete gamma), `digamma`
`besselJ0`, `besselJ1`, `besselY0`, `besselY1` (Bessel functions of first and second kind)

### 5. Combinatorics (6 functions)

`doubleFactorial`, `fallingFactorial`, `risingFactorial`, `subfactorial`
`fibonacci`, `lucas` (number sequences)

### 6. Signal Processing (4 functions)

`crossCorrelation`, `autoCorrelation`, `groupDelay`, `unwrapPhase`

### 7. Statistics (4 functions)

`partitionSelect`, `selectMedian`, `selectMin`, `selectMax`
(O(n) selection algorithms — faster than sort-based approaches)

## Recommended Implementation Approach

### Option A: WASM-First (Recommended)

Wire the existing Rust WASM implementations through `RustWasmLoader` with JS fallback.

- Pros: Already implemented, tested in Rust, WASM-accelerated
- Cons: Needs JS fallback for each function

### Option B: TypeScript-First

Implement in pure TypeScript, add WASM acceleration later.

- Pros: No WASM dependency, works everywhere
- Cons: Slower, duplicates existing Rust code

### Option C: Hybrid

TypeScript implementations that optionally delegate to WASM when loaded.

- Pros: Best of both worlds
- Cons: Most code to write

**Recommendation: Option C** — TypeScript implementations with `RustWasmLoader` acceleration when available. This matches the existing pattern used by `fft-wasm.ts` and `eig-wasm.ts`.

## Priority Order

| Priority | Category                  | Functions | Effort | Value                           |
| -------- | ------------------------- | --------- | ------ | ------------------------------- |
| **1**    | Special Functions         | 8         | Low    | High — commonly requested       |
| **2**    | Probability Distributions | 10        | Medium | High — widely used              |
| **3**    | Numerical Integration     | 4         | Low    | High — essential for science    |
| **4**    | Interpolation             | 6         | Medium | High — data science/engineering |
| **5**    | Geometry (extended)       | 18        | Medium | Medium — 3D/game dev            |
| **6**    | Combinatorics (extended)  | 6         | Low    | Medium                          |
| **7**    | Root-Finding              | 6         | Medium | Medium — numerical methods      |
| **8**    | Differentiation           | 6         | Medium | Medium — calculus               |
| **9**    | Signal (extended)         | 4         | Low    | Low — niche                     |
| **10**   | Statistics (selection)    | 4         | Low    | Low — niche                     |

## Package Location

New functions should be added to `@danielsimonjr/mathts-functions`:

- TypeScript implementations in `functions/src/typed/` (new files per category)
- WASM wrappers alongside existing `fft-wasm.ts` pattern
- Factory activations in `functions/src/factories/index.ts`
- Tests in `functions/tests/`

## API Design

```typescript
// Special functions
import { erfc, beta, besselJ, digamma } from '@danielsimonjr/mathts-functions';
erfc(0.5); // complementary error function
beta(2, 3); // beta function
besselJ(0, 1.5); // J₀(1.5)
digamma(3); // ψ(3)

// Distributions
import { normalPDF, normalCDF, poisson } from '@danielsimonjr/mathts-functions';
normalPDF(0, 0, 1); // standard normal at x=0
normalCDF(1.96); // ≈ 0.975
poisson(3, 2.5); // P(X=3) with λ=2.5

// Numerical integration
import { integrate } from '@danielsimonjr/mathts-functions';
integrate(Math.sin, 0, Math.PI); // ≈ 2
integrate((x) => x ** 2, 0, 1, { method: 'gauss' }); // ≈ 0.333

// Interpolation
import { interpolate } from '@danielsimonjr/mathts-functions';
const f = interpolate([0, 1, 2, 3], [0, 1, 4, 9], { method: 'cubic-spline' });
f(1.5); // interpolated value

// Root-finding
import { findRoot } from '@danielsimonjr/mathts-functions';
findRoot((x) => x ** 2 - 2, 1, 2); // ≈ 1.414 (√2)
findRoot(Math.cos, 1, 2, { method: 'brent' }); // ≈ π/2
```
