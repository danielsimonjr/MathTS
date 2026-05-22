# WASM Optimization Evaluation — All 349 Typed Functions

**Generated**: 2026-04-10
**Method**: RLM static analysis of computation weight (loops, math ops, array ops)

## Status

**Implementation complete as of 2026-04-10.**

| Work Item                 | Status |
| ------------------------- | ------ |
| 32 high-value functions   | DONE   |
| 40 medium-value functions | DONE   |
| 8 review bugs fixed       | DONE   |
| Total Rust WASM exports   | ~1,100 |

## Summary

| Category              | Count   | Description                                      |
| --------------------- | ------- | ------------------------------------------------ |
| **High-value WASM**   | 76      | Heavy computation, significant speedup from WASM |
| **Medium-value WASM** | 60      | Moderate computation, some benefit               |
| **Low-value WASM**    | 142     | Lightweight, JS is fast enough                   |
| **Not suitable**      | 71      | String/expression manipulation, can't WASM       |
| **Total**             | **349** |                                                  |

## Already in Rust WASM (partial coverage)

5 high-value functions already have Rust equivalents:
| TS Function | Rust Equivalent | Category |
|-------------|----------------|----------|
| `findRoot` | `bisectionStep`, `newtonStep`, `brentStep` | numeric |
| `linsolve` | `luSolve`, `sparseLuSolve` | algebra |
| `nintegrate` | `simpsonsRule`, `trapezoidalRule`, `gaussLegendre` | numeric |
| `solveODESystem` | `rk45Step`, `rk23Step` | numeric |
| `fft2d` | `fft2d` | signal |

## Priority 1: High-Value WASM Candidates (32 functions — need Rust)

### Numerical Methods (12)

| Function                          | Loops | Math | Lines | Speedup Estimate |
| --------------------------------- | ----- | ---- | ----- | ---------------- |
| `minimize` (Nelder-Mead)          | 15+   | 20+  | 80    | 5-10x            |
| `curvefit` (Levenberg-Marquardt)  | 10+   | 15+  | 90    | 5-10x            |
| `leastSquares` (normal equations) | 5+    | 10+  | 40    | 3-5x             |
| `stiffODESolver` (implicit Euler) | 10+   | 5+   | 50    | 3-5x             |
| `cond` (condition number)         | 5+    | 5+   | 30    | 2-3x             |
| `rank` (SVD-based)                | 5+    | 3+   | 25    | 2-3x             |
| `bezierCurve` (De Casteljau)      | 3+    | 2+   | 25    | 2-3x             |
| `bspline` (De Boor)               | 3+    | 2+   | 30    | 2-3x             |
| `loess` (local regression)        | 10+   | 10+  | 60    | 5-10x            |
| `griddata` (scattered interp)     | 5+    | 5+   | 40    | 3-5x             |
| `rbfInterpolate` (RBF)            | 5+    | 5+   | 35    | 3-5x             |
| `maximize` (delegates)            | —     | —    | 5     | same as minimize |

### Signal Processing (9)

| Function                          | Loops | Math | Lines | Speedup Estimate |
| --------------------------------- | ----- | ---- | ----- | ---------------- |
| `dct` / `idct`                    | 2+    | 5+   | 30    | 3-5x             |
| `dst` / `idst`                    | 2+    | 5+   | 30    | 3-5x             |
| `dwt` (wavelet)                   | 3+    | 3+   | 40    | 3-5x             |
| `hilbertTransform`                | 2+    | 3+   | 25    | 2-3x             |
| `spectrogram` (STFT)              | 5+    | 5+   | 50    | 5-10x            |
| `periodogram` (PSD)               | 3+    | 3+   | 30    | 3-5x             |
| `lowpass/highpass/bandpassFilter` | 3+    | 5+   | 40    | 3-5x             |

### Geometry (3)

| Function                   | Loops | Math | Lines | Speedup Estimate |
| -------------------------- | ----- | ---- | ----- | ---------------- |
| `delaunayTriangulation`    | 10+   | 5+   | 80    | 5-10x            |
| `voronoiDiagram`           | 5+    | 3+   | 40    | 3-5x             |
| `kdTree` + nearestNeighbor | 5+    | 3+   | 60    | 3-5x             |

### Special Functions (8)

| Function                           | Math Ops | Lines | Speedup Estimate |
| ---------------------------------- | -------- | ----- | ---------------- |
| `besselI/J/K/Y` (general order)    | 20+      | 40+   | 3-5x             |
| `betainc` (incomplete beta)        | 15+      | 30    | 3-5x             |
| `ellipticE/K` (elliptic integrals) | 10+      | 25    | 2-3x             |
| `lambertW`                         | 10+      | 15    | 2-3x             |
| `fresnelC/S`                       | 10+      | 20    | 2-3x             |

## Priority 2: Medium-Value WASM Candidates (60 functions)

These have moderate computation and would see 1.5-3x speedup. Includes:

- Array arithmetic (add, subtract, multiply — Float64Array paths)
- Statistical aggregations (mean, std, variance — array reductions)
- Trigonometric array operations
- Interpolation methods (linearInterp, cubicSpline, pchipInterp)
- Distribution PDFs/CDFs with iterative computation
- Graph algorithms (Dijkstra, Tarjan, Prim)
- PCA (eigendecomposition of covariance matrix)

## Not Suitable for WASM (71 functions)

These work with expression strings, AST trees, or delegate to the expression parser:

- All CAS functions (integrate, limit, taylor, laplace, solve, etc.)
- Expression manipulation (expand, factor, collect, substitute, etc.)
- String-based operations (variables, apart, together, trig transforms)

These must remain in TypeScript.

## Recommended Implementation Order

| Phase | Functions                       | Effort    | Speedup | Priority                                 |
| ----- | ------------------------------- | --------- | ------- | ---------------------------------------- |
| **1** | Special functions (8)           | 2-3 days  | 3-5x    | High — called in inner loops             |
| **2** | Signal processing (9)           | 3-5 days  | 3-10x   | High — FFT-related hot paths             |
| **3** | Numerical methods (12)          | 1-2 weeks | 5-10x   | High — optimization/fitting              |
| **4** | Geometry algorithms (3)         | 2-3 days  | 5-10x   | Medium — Delaunay is complex             |
| **5** | Array arithmetic (15)           | 2-3 days  | 2-3x    | Medium — already partially in Rust       |
| **6** | Statistics + distributions (12) | 3-5 days  | 2-3x    | Medium                                   |
| **7** | Graph algorithms (5)            | 2-3 days  | 2-3x    | Low — not compute-bound for small graphs |
| **8** | Interpolation (6)               | 2-3 days  | 2-3x    | Low — already fast in JS                 |

## Architecture Pattern

Each WASM-accelerated function should follow the existing pattern:

```typescript
export function myFunction(args) {
  // Try Rust WASM first
  if (rustWasmLoader.isLoaded) {
    try {
      return rustWasmAccelerated(args);
    } catch {
      /* fall through */
    }
  }
  // JS fallback (always available)
  return jsImplementation(args);
}
```

The Rust implementations go in `wasm-rust/crates/mathts-wasm/src/` alongside existing modules.
The TS wrappers go in the existing typed function files with conditional WASM dispatch.
