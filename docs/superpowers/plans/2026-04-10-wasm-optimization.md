# WASM Optimization Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add Rust WASM implementations for 32 high-value functions, wiring them through the existing RustWasmLoader with JS fallbacks.

**Pattern:** Each function gets a `#[no_mangle] pub unsafe extern "C" fn` in Rust, plus a TS wrapper that tries Rust first, falls back to JS.

---

### Task 1: Special Functions (8 Rust functions)
- besselI, besselJ, besselK, besselY (general order)
- betainc, ellipticE, ellipticK, lambertW, fresnelC, fresnelS

### Task 2: Signal Processing (9 Rust functions)
- dct, idct, dst, idst, dwt
- hilbertTransform, spectrogram, periodogram
- lowpassFilter, highpassFilter, bandpassFilter

### Task 3: Numerical Methods (12 Rust functions)
- minimize (Nelder-Mead), leastSquares, curvefit (LM)
- stiffODESolver, cond, rank
- bezierCurve, bspline, loess, griddata, rbfInterpolate

### Task 4: Geometry (3 Rust functions)
- delaunayTriangulation, voronoiDiagram, kdTree
