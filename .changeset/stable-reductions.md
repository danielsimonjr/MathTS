---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-parallel': minor
---

**Numerical accuracy: `sum` / `mean` were ~46,000× less accurate than NumPy. Fixed.**

`sum` accumulated naively (`s += x`), so its error grew as **O(n)·ε**. NumPy uses pairwise
summation, whose error grows as **O(log n)·ε**. Measured on 1e6 copies of `0.1` (exact answer
100000):

| accumulation              | relative error                      |
| ------------------------- | ----------------------------------- |
| naive (what shipped)      | **1.3e-11**                         |
| **pairwise (now)**        | **2.9e-16** — identical to `np.sum` |
| `fsum` (new, compensated) | **0** — exact                       |

`mean`, `std`, and `variance` all inherit `sum`'s error, so this was the single largest accuracy
defect in the library. Pairwise costs the _same number of additions_ — measured 1.03× **faster**
than the naive loop (eight independent accumulators break the serial dependency chain). There was
no trade here; the naive version was simply worse.

**`norm(x, 2)` no longer overflows or underflows — and NumPy still does.** The obvious
`sqrt(Σxᵢ²)` squares before it adds, so it dies well inside the representable range. MathTS now
uses LAPACK's `dnrm2` scaling:

```ts
norm([1e200, 1e200, 1e200, 1e200], 2); // 2e200    (np.linalg.norm: inf)
norm([1e-200, 1e-200, 1e-200, 1e-200], 2); // 2e-200   (naive squaring: 0 — silently wrong)
```

The underflow case is the dangerous one: a plausible `0` rather than an obvious `inf`.

**New: `fsum(x)`** — exactly-rounded summation (Neumaier), the equivalent of Python's `math.fsum`.
Pairwise cannot recover a value catastrophic cancellation has already destroyed:

```ts
sum([1e16, 1, -1e16]); // 0  (np.sum gives 0.0 too — the 1 is annihilated by the 1e16)
fsum([1e16, 1, -1e16]); // 1  (exact)
```

~2–4× slower, so it is opt-in. Reach for it when the result is a small difference of large terms.

**`@danielsimonjr/mathts-core`** now exports the primitives directly: `pairwiseSum`, `neumaierSum`,
`norm2`.

**`@danielsimonjr/mathts-parallel`** gains a dependency on `core` for these primitives, and its
`ComputePool.sum` / `.norm` sequential paths use them (0 new cycles).
