# @danielsimonjr/mathts-units

## 0.1.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0

## 0.1.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0

## 0.1.2

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.1

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS units / dimensional-analysis system as a focused package that re-exports the `Unit` class, the unit registry, SI prefixes, and the dimensional-analysis errors/types from `@danielsimonjr/mathts-core` (pinned `0.1.3`). Not a copy.
