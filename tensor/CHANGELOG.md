# @danielsimonjr/mathts-tensor

## 0.2.5

### Patch Changes

- Updated dependencies [779fcde]
- Updated dependencies [583817d]
- Updated dependencies [5f3b401]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-matrix@0.2.0

## 0.2.4

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [c041b4e]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-matrix@0.1.14

## 0.2.3

### Patch Changes

- `Tensor.matMul` now delegates to matrix's SIMD-WASM matmul (via `backendManager.multiply`) instead of a naive JS triple loop — 3.6–6.8× faster at 128²–512², results identical.
- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.1.13

## 0.2.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-matrix@0.1.12

## 0.2.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-matrix@0.1.11

## 0.2.0

### Minor Changes

- - **feat (GC8):** `tensorSvdWasm` / `tensorEigWasm` — async tensor decompositions
    routed through the AssemblyScript WASM kernels (same result as the sync variants,
    accelerated for large matricisations).

### Patch Changes

- @danielsimonjr/mathts-matrix@0.1.10

## 0.1.3

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.2

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## [Unreleased]

### Fixed

- De-flaked `contraction-sequence` perf tests: replaced wall-clock `elapsed` bounds (which flaked under CI load, e.g. 31161ms vs a 25000ms cap) with the per-test timeout as the hang guard plus a deterministic greedy-vs-exact algorithm-equivalence check.

## 0.1.1

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.
