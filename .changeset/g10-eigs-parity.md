---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-compat': patch
---

**`eigs` mathjs 15.3.0 quirks in compat only (#1561).** The public `eigs` of `@danielsimonjr/mathts-functions` stays the native `correctEigs` orthes/hqr2 route. The mathjs 15.3.0 factory port (precision collapse, non-unit eigenvector scale, magnitude-ordered values) lives in `compat/src/mathjs-eigs/` and is bound on `create(all)` via `compat/src/eigs-mathjs.ts`. Native `eig` Rayleigh-refines a small eigenvalue beside a 1e15 diagonal (mpmath: exactly 5). BREAKING (compat): instance `eigs` matches mathjs 15.3.0 including loose `precision`; the native package export keeps unit-normalized vectors and ignores numeric-only precision.
