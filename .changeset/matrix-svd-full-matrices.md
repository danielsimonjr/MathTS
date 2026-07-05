---
'@danielsimonjr/mathts-matrix': minor
---

B-4: `svd`'s `fullMatrices` option now works. It was accepted in `SVDOptions` (destructured with a claimed default of `true`) but **ignored** — factors were always thin. With `fullMatrices: true`, the thin factor is completed to a square orthonormal basis (U → m×m for tall inputs, V → n×n for wide ones) via modified Gram-Schmidt with re-orthogonalization, numpy `full_matrices=True` style, so the rectangular-Σ reconstruction `A = U·Σ·Vᵀ` holds exactly. The default is now honestly `false` (thin — the library's actual long-standing behavior, so no output shapes change for existing callers). The two `it.skip` tests blocked on this (tall 3×2, wide 4×6) are unskipped with orthonormality pins — the SVD suite has no skips left.
