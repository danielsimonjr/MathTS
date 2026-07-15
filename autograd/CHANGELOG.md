# @danielsimonjr/mathts-autograd

## 0.3.7

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-tensor@0.2.10

## 0.3.6

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-tensor@0.2.9

## 0.3.5

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0
  - @danielsimonjr/mathts-tensor@0.2.6

## 0.3.4

### Patch Changes

- Updated dependencies [779fcde]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-tensor@0.2.5

## 0.3.3

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-tensor@0.2.4

## 0.3.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-tensor@0.2.2

## 0.3.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-tensor@0.2.1

## 0.3.0

### Minor Changes

- - **feat (GC9):** `TapedTensor.pow(taped, taped)` — variable-exponent reverse-mode AD.
  - **feat (GC15):** JAX-style `grad` / `valueAndGrad` / `derivative` / `jacobian` —
    ergonomic autodiff over plain numbers / Float64Arrays (function written in
    AD-aware TapedTensor ops).

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-tensor@0.2.0

## 0.2.0

### Minor Changes

- 522d18a: Expand the differentiable elementwise op surface for both AD modes.

  Reverse-mode `TapedTensor` gains the extended transcendentals: `sinh`, `cosh`,
  `tanh`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`, `log2`, `log10`,
  `log1p`, `expm1`, `cbrt`, `sign`, and the binary `atan2`.

  Forward-mode `DualTensor` (previously `add`/`sub`/`mul`/`scale` only) is brought
  to full parity with reverse-mode: `divide`, `exp`, `log`, `sin`, `cos`, `tan`,
  `sqrt`, `square`, `pow`, `reciprocal`, `abs`, plus all of the extended set above
  and `atan2`.

  Every op is validated against its closed-form derivative; reverse-mode ops also
  cross-check against central finite differences. Additive and backward-compatible.

## 0.1.3

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.2

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.1

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.
