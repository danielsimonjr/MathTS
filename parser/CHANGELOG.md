# @danielsimonjr/mathts-parser

## 0.1.10

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0
  - @danielsimonjr/mathts-expression@0.5.3

## 0.1.9

### Patch Changes

- Updated dependencies [598e72d]
- Updated dependencies [ce8f929]
  - @danielsimonjr/mathts-expression@0.5.0

## 0.1.8

### Patch Changes

- Updated dependencies [779fcde]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-expression@0.4.5

## 0.1.7

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-expression@0.4.3

## 0.1.6

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-expression@0.4.2

## 0.1.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-expression@0.4.1

## 0.1.4

### Patch Changes

- Fix stale `@danielsimonjr/mathts-expression` dependency range (`^0.2.4` → `^0.4.0`) so the re-export ships the current expression package.

## 0.1.3

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.2

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.1

### Patch Changes

- Also re-export `createParser` (the `math.parser()` instance factory), now that `@danielsimonjr/mathts-expression@0.2.2` exposes it from its public entry. Re-pinned the expression dependency to `0.2.2`.

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS parser as a focused package that re-exports
  the parser surface from `@danielsimonjr/mathts-expression`: the `parse` function
  factory (`createParse`), the `Parser` class factory (`createParserClass`), the
  AST node constructors produced by parsing, and the operator/keyword metadata the
  parser relies on, plus the associated TypeScript types. The implementation is not
  duplicated — it is re-exported — so the parser stays in lockstep with
  `expression` (pinned to `0.2.1`).
