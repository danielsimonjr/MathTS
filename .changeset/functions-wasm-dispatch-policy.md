---
'@danielsimonjr/mathts-functions': patch
---

After `loadWasm()`, a function runs its AssemblyScript kernel only where that measured faster, and repeated WASM calls no longer grow memory without bound.

- **A measured dispatch policy (`src/wasm/policy.ts`).** `tools/benchmark/wasm/opt-in.bench.ts` timed every public function that reaches a WASM bridge with the tier off and on (Node 22, reps interleaved, two runs). Loading made many of them slower, so those keep their JavaScript path even when the module is loaded:
  - `welchPSD`/`bartlettPSD`: 4.0–4.6× slower
  - `resultant`, `discriminant`, `newtonInterp`, `lagrangeInterp`: about 4×
  - `chirpZTransform`: 3.3×
  - `polymul`: 2.7×
  - bitwise ops: 2.4–3.3×
  - `goertzel`: 1.7×
  - `cubicSpline`, `polynomialQuotient`: about 1.4×
  - `tan`, `atan`, `cot`, `exp`, `log2`, `expm1`, `sinh`, `tanh`, the Bessel/Airy/elliptic/Carlson functions and `erfc`: no faster, or up to 1.6× slower

  WASM stays on where both runs measured it faster:
  - `abs`, `log10` from 1K; `sin` 1K–131K; `log1p` 1K–16K
  - `cos`, `atanh`, `log` from 16K; `sec` 16K–1M
  - fused chains (`fuseUnaryChain`, 0.36–0.77×)
  - `polyFit`/`chebyshevFit`/`legendreFit` (0.34–0.67×)
  - `lgamma` and the sort behind `parallelStatMedian`/`parallelStatQuantile` from 1M elements

- **Bounded WASM memory.** The binary uses the stub runtime, which never frees, so every managed-ABI call left its inputs and result on the heap for good: 200 calls grew memory by 99 MiB (`lgamma`, 16K values) to 403 MiB (`welchPSD`, 65K samples), heading for the 4 GiB limit, where every call would fall back to JS. The bridges now call the binary's new `heap_reset` once each call has copied its results out.
