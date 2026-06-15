# @danielsimonjr/mathts-autograd

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

