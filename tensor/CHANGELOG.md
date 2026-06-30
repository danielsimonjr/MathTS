# @danielsimonjr/mathts-tensor

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
