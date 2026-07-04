---
'@danielsimonjr/mathts-functions': patch
---

`qz` / `realSchur`: deflate converged complex-conjugate 2×2 blocks. The shifted-QR iteration could only deflate one real eigenvalue at a time, so for a pencil with complex eigenvalue pairs the block counter never decreased and the loop always ran its full 8000-iteration cap after converging (~1s for a 4×4, ~350ms of pure no-op steps for a 2×2 rotation). It now deflates a trailing 2×2 block whose eigenvalues are complex (and stops when the remaining top block is itself a complex pair — the real Schur form cannot reduce it further), cutting the pathological cases to milliseconds. Deflation tolerances also gained an absolute fallback scale so zero-diagonal blocks (pure imaginary spectra) can deflate at all. This was the root cause of the intermittent `gap-qz` vitest-timeout failure under parallel full-suite load.
