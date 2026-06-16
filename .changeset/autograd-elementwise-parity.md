---
'@danielsimonjr/mathts-autograd': minor
---

Expand the differentiable elementwise op surface for both AD modes.

Reverse-mode `TapedTensor` gains the extended transcendentals: `sinh`, `cosh`,
`tanh`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`, `log2`, `log10`,
`log1p`, `expm1`, `cbrt`, `sign`, and the binary `atan2`.

Forward-mode `DualTensor` (previously `add`/`sub`/`mul`/`scale` only) is brought
to full parity with reverse-mode: `divide`, `exp`, `log`, `sin`, `cos`, `tan`,
`sqrt`, `square`, `pow`, `reciprocal`, `abs`, plus all of the extended set above
and `atan2`.

Every op is validated against its closed-form derivative; reverse-mode ops also
cross-check against central finite differences. Additive and backward-compatible.
