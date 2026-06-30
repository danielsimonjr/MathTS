# @danielsimonjr/mathts-statistics

## 0.1.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.3.0

## 0.1.3

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.2

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.1

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.5` (special-function fixes) for the matched set.

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS statistics functions as a focused package that re-exports the 23 `statistics` typed-function operations from `@danielsimonjr/mathts-functions` (pinned `0.2.4`). Not a copy.
