---
'@danielsimonjr/mathts-matrix': patch
---

Unify matrix backend thresholds in `DEFAULT_CONFIG` (`multiply` WASM 256, `gpu.enabled` false) and derive `DEFAULT_EXTENDED_HINTS` from that table so `setConfig` cannot restore stale multiply threshold 500. Public `DenseMatrix.multiply` and `lu`/`qr`/`cholesky` remain JavaScript; WASM GEMM stays on `backendManager` / `Tensor.matMul`.

**Tests:** `matrix/tests/config.test.ts` — `getRecommendedBackend(200000)` now `'wasm'` (oracle: `gpu.enabled` false and no GPU backend registered); GPU element threshold expects `DEFAULT_BACKEND_HINTS.gpuThreshold` instead of 100000; added `getRecommendedBackend(300, 'multiply') === 'wasm'` so 500 cannot creep back.

**Expectation changes (independent oracle cited in test):**

- `config.test.ts` GPU threshold: `DEFAULT_BACKEND_HINTS.gpuThreshold` (65536), not legacy 100000.
- `config.test.ts` large-data recommendation: `'wasm'`, not `'gpu'` — registry has no GPU backend.

Fixes #424.
