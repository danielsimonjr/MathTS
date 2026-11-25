---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

**`eigs` precision and eigenvector scaling (#1561).** The public `eigs` is the mathjs factory itself: the faithful mathjs 15.3.0 port (balance → Hessenberg → shifted QR → back-substitution eigenvectors) runs first and keeps its result when every eigenpair passes a scale-free residual check; graded, defective and non-converging input takes the previous robust solver. The `correctEigs` native bypass is gone from the public path. BREAKING: `eigs` eigenvectors are no longer unit-normalized and loose `precision` options now take effect; the native-solver value order (real part ascending) is the factory order (absolute value ascending), which is the mathjs 15.3.0 order.
