---
'@danielsimonjr/mathts-functions': patch
---

Make the public `fft` / `ifft` **~137× faster** (n=2¹⁸: 14,889 ms → 108 ms). No API change,
same f64 results.

**Correction to 0.20.1.** That release claimed "the public `fft()` was the slowest FFT in the
library" and quoted 2987 ms → 521 ms. Those numbers were real but they were measured on
`functions/src/signal/fft.ts` — which is **not** the public export. It backs the convolution
paths, so speeding it up was worth doing, but it is not what `import { fft } from
'@danielsimonjr/mathts-functions'` gives you. The public `fft` is the mathjs-derived _factory_
function, and it was far worse than 2987 ms.

**The real bug: its power-of-2 fast path was dead code.** `_fft` guarded on
`len === undefined`, meaning "top-level call only" — but `_ndFft` _always_ passes `len` for
1-D input (`_fft(arr, size[0])`). The condition could never be true, so every call fell through
to a recursive Cooley-Tukey built out of array spreads (`[..._fft(even), ..._fft(odd)]`) doing
its scalar arithmetic through typed-function dispatch on Complex objects.

The guard now says what it meant (`length === arr.length`), and the fast path routes to the flat
`Float64Array` core rather than to the AssemblyScript WASM kernel — which is itself ~6× _slower_
than that core (1039 ms vs 170 ms at n=2²⁰), so the "fast path" was a pessimisation stacked on
dead code.

Measured through the public export, n=2¹⁸: **14,889 ms → 108 ms**.

Non-power-of-2 (chirp-z) and non-f64 element types (BigNumber, Fraction, Unit) are untouched —
`complexToInterleaved` returns `null` for those and they keep their exact semantics. Pinned by
`functions/tests/fft-factory-correctness.test.ts` (naive-DFT oracle, complex input, Parseval,
ifft round-trip) and `tests/benchmark/fft-factory-surface.test.ts`.
