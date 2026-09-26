---
'@danielsimonjr/mathts-wasm': minor
---

Repeated calls no longer grow linear memory for good. The binary uses the stub runtime, which never frees.

- **New export `heap_reset()`.** It rolls the stub runtime's bump allocator back to the heap start. A host that makes repeated managed-ABI calls can call it when no allocation is live, which bounds memory by the largest single call. It is safe because no module state lives on the heap: every module-level binding is a scalar constant. The `functions` bridges call it after each managed call.
- **The decomposition kernels allocate nothing when given scratch.**
  - `matrix_lu_decompose` eliminates in `u_out` instead of an internal n×n copy, which leaked 32 KiB per 64×64 call.
  - `matrix_determinant` drops a permutation array it never read.
  - `matrix_inverse` solves in place in `result`, and keeps the row permutation in `work` when `work` has n·n + n entries.
  - `matrix_qr_decompose` takes an optional sixth argument `v_work` (length m) for its Householder vector.

  Callers that pass the old arguments get the same results, and the kernels then allocate as before. The arithmetic is unchanged: 30/30 decomposition diff checks pass against the reference.
