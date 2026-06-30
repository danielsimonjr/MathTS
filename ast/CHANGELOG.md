# @danielsimonjr/mathts-ast

## 0.1.3

### Patch Changes

- Fix stale `@danielsimonjr/mathts-expression` dependency range (`^0.2.4` → `^0.4.0`) so the re-export ships the current expression package.


## 0.1.2

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.1

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS expression AST as a focused package that re-exports the 16 node constructor factories (and their types) from `@danielsimonjr/mathts-expression` (pinned `0.2.2`). Not a copy.
