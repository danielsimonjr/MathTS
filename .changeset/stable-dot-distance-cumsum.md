---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-parallel': minor
---

Numerically stable `dot`, `distance`, and `cumsum` (NumPy/SciPy accuracy audit follow-up)

Three new stable primitives in `@danielsimonjr/mathts-core` (`core/src/numeric/stable.ts`),
wired into the public reduction paths so every caller inherits the fix:

- **`pairwiseDot(a, b)`** — pairwise (cascade) dot product. The naive `Σ aᵢ·bᵢ` loop carries
  O(n)·ε error; measured ~18× worse than `np.dot` on an ill-conditioned dot (large mean × small
  factor, n = 10⁶). `dot` (both the `number[]` and `Float64Array` paths) now sums pairwise —
  at NumPy parity for the same flop count.
- **`scaledDistance(a, b)`** — BLAS `dnrm2`-scaled Euclidean distance. `distance` was
  `sqrt(Σ(aᵢ−bᵢ)²)`, which **overflows to `Infinity`** for large inputs and **silently flushes
  to `0`** for tiny ones (NumPy's `linalg.norm` has the same bug). Now scales on the largest
  _difference_ seen: `‖[1e200]×4 − 0‖ = 2e200` and `‖[1e-200]×4 − 0‖ = 2e-200`, both exact,
  where naive squaring (and NumPy) get `inf`/`0`.
- **`neumaierCumsum(xs, out)`** — Neumaier-compensated cumulative sum. A prefix scan is inherently
  sequential (pairwise doesn't apply), so `np.cumsum` accumulates naively and its tail drifts
  O(n)·ε (relErr ~1.3e-11 over 10⁶ terms). `cumsum` now carries a running compensation — exact
  prefixes for a few extra flops per element, a strict improvement over NumPy.

Fixed on **every layer a consumer can reach**, not just the typed one: the public `distance` and
`cumsum` a caller imports resolve to the mathjs _factory_ implementations (`geometry/distance.ts`,
`statistics/cumsum.ts`), which were separate naive code paths from the typed `parallelStat*` ones —
the same "wrong layer" trap that first bit `sum`. Both now route flat plain-number inputs through
the stable primitives (retiring two naive WASM scans that carried the overflow bug); the generic
`BigNumber`/`Complex`/multi-dim paths are unchanged. The compat-registry `dot` (`matrix/dot.ts`
`_denseDot`) gets a plain-1D-numeric pairwise fast path too.

No API removals; `dot`/`distance`/`cumsum` signatures and results are unchanged in the safe range.
