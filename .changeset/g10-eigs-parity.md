---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-compat': patch
---

**`eigs` mathjs 15.3.0 quirks in compat only (#1561).** The public `eigs` of `@danielsimonjr/mathts-functions` is again the native `correctEigs` orthes/hqr2 route; mathjs precision semantics, non-unit eigenvector scale and magnitude-ordered values are exposed only on `create(all)` via a compat adapter on `eigsMathjsFactory` (lazy subpath `@danielsimonjr/mathts-functions/eigs-mathjs`). BREAKING (compat): `eigs` on the compat instance matches mathjs 15.3.0 including loose `precision` and eigenvector scaling; the native package export keeps unit-normalized vectors and ignores numeric-only precision.
