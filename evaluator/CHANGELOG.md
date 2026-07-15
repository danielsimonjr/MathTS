# @danielsimonjr/mathts-evaluator

## 0.1.14

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-expression@0.6.4

## 0.1.13

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-expression@0.6.3

## 0.1.12

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-expression@0.6.2

## 0.1.11

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-expression@0.6.1

## 0.1.10

### Patch Changes

- Updated dependencies [fd3e417]
  - @danielsimonjr/mathts-expression@0.6.0

## 0.1.9

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0
  - @danielsimonjr/mathts-expression@0.5.3

## 0.1.8

### Patch Changes

- Updated dependencies [598e72d]
- Updated dependencies [ce8f929]
  - @danielsimonjr/mathts-expression@0.5.0

## 0.1.7

### Patch Changes

- Updated dependencies [779fcde]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-expression@0.4.5

## 0.1.6

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-expression@0.4.3

## 0.1.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-expression@0.4.2

## 0.1.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-expression@0.4.1

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

- Initial release. Exposes the MathTS compiler + evaluator as a focused package that re-exports `compile`, `createEvaluate`, and `compileExpression` (and the `CompiledExpression` / `Scope` types) from `@danielsimonjr/mathts-expression` (pinned `0.2.2`). Completes the parse -> compile -> evaluate pipeline alongside `@danielsimonjr/mathts-parser`. Not a copy.
