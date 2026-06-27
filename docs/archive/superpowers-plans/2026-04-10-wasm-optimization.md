# WASM Optimization Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add AssemblyScript WASM implementations for 32 high-value functions, wiring them through the existing WASM loader with JS fallbacks.

**Pattern:** Each function gets an exported AssemblyScript kernel, plus a TS wrapper that tries WASM first, falls back to JS.

---

### Task 1: Special Functions (8 WASM functions)

- besselI, besselJ, besselK, besselY (general order)
- betainc, ellipticE, ellipticK, lambertW, fresnelC, fresnelS

### Task 2: Signal Processing (9 WASM functions)

- dct, idct, dst, idst, dwt
- hilbertTransform, spectrogram, periodogram
- lowpassFilter, highpassFilter, bandpassFilter

### Task 3: Numerical Methods (12 WASM functions)

- minimize (Nelder-Mead), leastSquares, curvefit (LM)
- stiffODESolver, cond, rank
- bezierCurve, bspline, loess, griddata, rbfInterpolate

### Task 4: Geometry (3 WASM functions)

- delaunayTriangulation, voronoiDiagram, kdTree
