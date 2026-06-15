# @danielsimonjr/mathts-tensor

## [Unreleased]

### Fixed

- De-flaked `contraction-sequence` perf tests: replaced wall-clock `elapsed` bounds (which flaked under CI load, e.g. 31161ms vs a 25000ms cap) with the per-test timeout as the hang guard plus a deterministic greedy-vs-exact algorithm-equivalence check.

## 0.1.1

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.

