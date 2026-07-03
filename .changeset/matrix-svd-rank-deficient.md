---
'@danielsimonjr/mathts-matrix': patch
---

Fix SVD for exactly-rank-deficient matrices. `svd([[1,2],[2,4]])` returned σ₁ = √5 instead of 5 with a wrong `V` (no reconstruction) — corrupting `pinv` / `lowRankApprox` / `norm2` / `cond` on singular inputs. The bidiagonal Golub-Reinsch `handleZero` never folded the superdiagonal into the diagonal for a trailing/isolated exact-zero singular value. Now, when a zero singular value is detected, the decomposition is recomputed with a robust one-sided Jacobi SVD (with null-space basis completion so `U`/`V` stay orthonormal); the fast Golub-Reinsch path is unchanged for the full-rank common case. Exact reconstruction + orthonormal factors across 2×2 / 3×3 / wide / tall / zero, symmetric and non-symmetric.
