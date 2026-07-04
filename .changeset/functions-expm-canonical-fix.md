---
'@danielsimonjr/mathts-functions': patch
---

Fix the canonical `expm` (matrix exponential), which was **completely broken** — it threw on every input. The public `expm` was the factory-Padé implementation, which was instantiated inside the window where `factoryScope.multiply` is temporarily bound to `multiplyScalar` (for `det`'s scalar-element LU), so it captured a scalar-only multiply and threw `Unexpected type of argument in function multiplyScalar` on any matrix; it also lacked an `Array` signature, throwing `A.size is not a function` on a raw `number[][]`. The canonical `expm` now routes to the native, backend-accelerated `matrixExpm` (DenseMatrix/Array dispatch) — the same implementation that was already tested under the non-canonical name. The dead factory `expm.ts` (272 LOC) was removed. This is part of B2 (route factory matrix ops through the native `DenseMatrix` path).
