# @danielsimonjr/mathts-parser

## 0.1.27

### Patch Changes

- 45d691e: Drop the unused `typed-function` dependency (upstream 4.x was never imported by these re-export packages).
- b1bdef8: Replace `export type *` barrels with named type re-exports (tree-sitter-typescript 0.23.2) and drop `@inline` on private AssemblyScript sort helpers so `repo-tools clones` reports `parseErrors=0`.
- Updated dependencies [5ec27a9]
- Updated dependencies [71f8c3c]
- Updated dependencies [9f5a065]
- Updated dependencies [45d691e]
- Updated dependencies [83d8074]
- Updated dependencies [d7daec0]
- Updated dependencies [4594b6c]
- Updated dependencies [540691c]
- Updated dependencies [dc47a4b]
- Updated dependencies [af7733a]
- Updated dependencies [19c4ba7]
- Updated dependencies [11c4559]
- Updated dependencies [49a347a]
- Updated dependencies [48becfb]
- Updated dependencies [a6cf17a]
- Updated dependencies [cdec291]
- Updated dependencies [6e7532e]
- Updated dependencies [2fd47ee]
- Updated dependencies [b1bdef8]
- Updated dependencies [b2a24a0]
- Updated dependencies [1f52df2]
- Updated dependencies [2fd47ee]
- Updated dependencies [da5e661]
- Updated dependencies [cbc9119]
  - @danielsimonjr/mathts-expression@0.11.0
  - @danielsimonjr/mathts-core@0.20.0

## 0.1.26

### Patch Changes

- Updated dependencies [61426de]
  - @danielsimonjr/mathts-core@0.19.0
  - @danielsimonjr/mathts-expression@0.10.3

## 0.1.25

### Patch Changes

- Updated dependencies [15adc89]
  - @danielsimonjr/mathts-core@0.18.0
  - @danielsimonjr/mathts-expression@0.10.2

## 0.1.24

### Patch Changes

- Updated dependencies [f31f5ee]
  - @danielsimonjr/mathts-core@0.17.0
  - @danielsimonjr/mathts-expression@0.10.1

## 0.1.23

### Patch Changes

- Updated dependencies [75416dc]
  - @danielsimonjr/mathts-expression@0.10.0

## 0.1.22

### Patch Changes

- Updated dependencies [6e751af]
- Updated dependencies [5b7ca6d]
  - @danielsimonjr/mathts-expression@0.9.0
  - @danielsimonjr/mathts-core@0.16.0

## 0.1.21

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
- Updated dependencies [a13ce7e]
  - @danielsimonjr/mathts-core@0.15.4
  - @danielsimonjr/mathts-expression@0.8.1

## 0.1.20

### Patch Changes

- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
  - @danielsimonjr/mathts-core@0.15.0
  - @danielsimonjr/mathts-expression@0.8.0

## 0.1.18

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0
  - @danielsimonjr/mathts-expression@0.6.7

## 0.1.17

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0
  - @danielsimonjr/mathts-expression@0.6.6

## 0.1.16

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.11.0
  - @danielsimonjr/mathts-expression@0.6.5

## 0.1.15

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-expression@0.6.4

## 0.1.14

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-expression@0.6.3

## 0.1.13

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-expression@0.6.2

## 0.1.12

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-expression@0.6.1

## 0.1.11

### Patch Changes

- Updated dependencies [fd3e417]
  - @danielsimonjr/mathts-expression@0.6.0

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
