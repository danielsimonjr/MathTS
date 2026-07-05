# @danielsimonjr/mathts-linalg

## 0.1.6

### Patch Changes

- Updated dependencies [779fcde]
- Updated dependencies [583817d]
- Updated dependencies [5f3b401]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-matrix@0.2.0

## 0.1.5

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [c041b4e]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-matrix@0.1.14

## 0.1.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-matrix@0.1.12

## 0.1.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-matrix@0.1.11

## 0.1.2

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.1

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS linear-algebra decompositions as a focused package that re-exports eigen / SVD / QR / LU / Cholesky / Schur / pseudo-inverse and the matrix functions (expm/logm/sqrtm) -- with their result/option types -- from `@danielsimonjr/mathts-matrix` (pinned `0.1.4`). Not a copy.
