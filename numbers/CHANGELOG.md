# @danielsimonjr/mathts-numbers

## 0.1.17

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
- Updated dependencies [a13ce7e]
  - @danielsimonjr/mathts-core@0.15.4

## 0.1.16

### Patch Changes

- Updated dependencies [57c8ffd]
  - @danielsimonjr/mathts-core@0.15.0

## 0.1.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0

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

- Initial release. Exposes the MathTS numeric types as a focused package that re-exports `Complex`, `Fraction`, and `BigNumber` (with their guards, constants, and types) from `@danielsimonjr/mathts-core` (pinned `0.1.3`). Not a copy.
