---
'@danielsimonjr/mathts-parallel': patch
---

`ComputePool` honours its per-op thresholds (`thresholdByOp`) for every method, and a partial override keeps the other defaults.

- **`unary` (`sin`, `cos`, `tan`, `exp`, `log`, `abs`, `sqrt`, `negate`, `square`), `elementwise` (`add`, `subtract`, `multiply`, `divide`), `scale` and `matmul` passed nothing to the worker pool.** The pool checks only the global `thresholdElements` (50,000). So once a pool was initialized, the `'never'` entries of these ops governed nothing: arrays of 50,000+ elements went to the workers, which the repo's own benchmarks measured at 0.12–0.65× the inline speed. And `matmul: 4_096` did not parallelize below 50,000. The bitwise family had the same bug (WS-2 addendum). These methods now apply their entry.
- **`thresholdByOp` is merged per op, in the constructor and in `updateConfig`.** A shallow config spread replaced the whole map, so the documented `thresholdByOp: { matmul: 1_024 }` silently dropped every other default. Set an op to `undefined` to send it to `thresholdElements`.
