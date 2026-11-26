### Changed

- **`eigs` mathjs 15.3.0 quirks live in compat only (#1561):** Public native `eigs` stays `correctEigs` (matrix `eig`). The mathjs 15.3.0 factory port lives in `compat/src/mathjs-eigs/` and is bound on `create(all)` so `@danielsimonjr/mathts-functions` is not the home of mathjs quirks. BREAKING (compat): instance `eigs` matches mathjs 15.3.0 including loose `precision`; native `eigs` keeps unit-normalized vectors and the real-part value order.

### Fixed

- **native bug — symmetric `eig` at huge scale (#1561):** Rayleigh-quotient refinement after hqr2 recovers a small eigenvalue beside a 1e15 diagonal (mpmath: exactly 5; was 4.992). Runs only when the spectrum already spans ≥1e6 and a real eigenvalue is ≤1e-6 of the spectral radius, so clustered/repeated spectra and `eigenvectors: false` on ordinary matrices keep the previous path. `matrix/src/operations/eig.ts`.
