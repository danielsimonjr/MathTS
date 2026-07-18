# @danielsimonjr/mathts-units

## 0.1.13

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0

## 0.1.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.11.0

## 0.1.11

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0

## 0.1.10

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0

## 0.1.9

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0

## 0.1.8

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0

## 0.1.7

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0

## 0.1.6

### Patch Changes

- Updated dependencies [779fcde]
  - @danielsimonjr/mathts-core@0.5.0

## 0.1.5

### Patch Changes

- 82bb0b1: **BREAKING (Unit merge complete): one `Unit`.** The former standalone core `Unit` class (the canonical-value subset in `core/src/types/unit.ts`) is retired; `@danielsimonjr/mathts-core`'s `Unit` is now the single, feature-complete merged implementation, and `functions` `unit()`/`to()`/`toBest()`/arithmetic+comparison operators all return that one class (the `to`/`toBest` operator dual-flavor branching is gone).

  Caller migration:

  - Unit arithmetic is at the operator level — use `add`/`subtract`/`multiply`/`divide` from `@danielsimonjr/mathts-functions`, not `unit.add(…)`/`.sub`/`.mul`/`.div`. `u1 / u2` of the same dimension returns a plain dimensionless number (mathjs parity).
  - `unit.equalBase(other)` replaces `unit.dimensionsEqual(other)`; dimensions are a 9-element exponent array, not a struct; `unit.formatUnits()`/`unit.toString()` replace `.notation`.
  - Temperature offsets apply on conversion (`new Unit(20,'degC').value === 20`; `.to('K')` → `293.15 K`); `°C`/`°F`/`°` are accepted.
  - `DimensionMismatchError`/`UnitParseError` are still thrown and exported; `Unit`/`isUnitValue`/`DIMENSIONLESS`/`dim`/`Dimensions`/`UnitDef` keep their import paths. New `UnitInstance` type export for type position.

  Also corrects `eV` to the exact 2019-SI value `1.602176634e-19` J.

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0

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
