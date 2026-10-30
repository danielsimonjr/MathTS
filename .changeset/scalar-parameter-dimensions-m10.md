---
'@danielsimonjr/mathts-functions': minor
---

Add `solveParameterDimensions`: solve the SI dimension of each unknown parameter of a scalar tree. The tree implies one linear equation set per SI component (`+` operands agree, transcendental arguments and non-literal exponents are dimensionless, the root equals `target`); the sets are solved exactly with `rationalNullspace` and the result is `solved`, `underdetermined`, or `inconsistent`. The implementation lives in `scalar-dimension.ts` with `inferScalarDimension` (see the M9 changeset).
