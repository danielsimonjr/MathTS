# @danielsimonjr/mathts-numbers

## 0.2.0

### Minor Changes

- b95de8a: **Breaking:** Node 20 is dropped (`engines.node` >=22.12); packed-consumer contract (#886, #888, #890, #893, #905, #912, #914, #916, #930).
  
  Every package sets `engines.node` to `>=22.12`, and CI tests 22.x and 24.x.
  
  Every `exports` entry gains a `default` condition equal to `import`, so `require()` of the ES build works at run time on Node >= 22.12 (`mathts-wasm` has top-level await and stays import-only). Node 22.12 prints an `ExperimentalWarning` for it; 22.13 and later do not. On Node 22.11 and earlier, `require()` reports `ERR_REQUIRE_ESM`; use `import()`. TypeScript accepts the `require()` of these packages from CommonJS under `moduleResolution: nodenext`; `node16` reports TS1471. Issue #736 closed docs-only because its acceptance allowed documenting ESM-only; the `default` condition is the `require(esm)` fix.
  
  Published `.d.ts` files name no Node, workerpool, DOM or WebGPU global, so strict `tsc` with no `@types/node` passes. The `mathts-gpu` handle types are the WebGPU global types when the consumer has them, and interfaces of the package when it has not. `mathts-workerpool` ships a `browser` build (the worker is one classic script), so a bundler pulls no Node builtin into `mathts-compat`. README code fences carry a runtime tag. `functions/evaluate` is not a size saving; use `mathts-expression` for a small bundle.

### Patch Changes

- Updated dependencies [2635bbb]
- Updated dependencies [aa76758]
- Updated dependencies [799b0fe]
- Updated dependencies [b95de8a]
  - @danielsimonjr/mathts-core@0.28.0

## 0.1.29

### Patch Changes

- e7939a7: `new BigNumber(x)` and `BigNumber.from(x)` now construct working instances (fixes runtime/type mismatch from a private constructor erased in JS). Export `bignumber` from core and `@danielsimonjr/mathts-numbers`. A second constructor argument throws; `new BigNumber(existing)` copies and `BigNumber.from(existing)` keeps the same instance. Internal values use a private token so `new BigNumber(1, 2)` cannot set the coefficient.
- a07bf29: Packaging P2 (dogfood G29): ship LICENSE in tarballs, homepage/bugs links, `exports['./package.json']`, honest `sideEffects`, JS source maps from tsdown, and workerpool types that typecheck without `@types/node` (via updated `@danielsimonjr/workerpool` patch).
- Updated dependencies [ef236dc]
- Updated dependencies [adcebad]
- Updated dependencies [17f64da]
- Updated dependencies [b5f036d]
- Updated dependencies [7247de3]
- Updated dependencies [e7939a7]
- Updated dependencies [a07bf29]
- Updated dependencies [ca97716]
  - @danielsimonjr/mathts-core@0.27.0

## 0.1.28

### Patch Changes

- Updated dependencies [2f73d66]
  - @danielsimonjr/mathts-core@0.26.0

## 0.1.27

### Patch Changes

- Updated dependencies [42f3c97]
  - @danielsimonjr/mathts-core@0.25.0

## 0.1.26

### Patch Changes

- Updated dependencies [e7a003e]
  - @danielsimonjr/mathts-core@0.24.0

## 0.1.25

### Patch Changes

- Updated dependencies [3628d5a]
  - @danielsimonjr/mathts-core@0.23.0

## 0.1.24

### Patch Changes

- Updated dependencies [09b4dde]
- Updated dependencies [ac4212b]
- Updated dependencies [2a6c91d]
- Updated dependencies [0de3d7a]
- Updated dependencies [2fd73e8]
  - @danielsimonjr/mathts-core@0.22.0

## 0.1.23

### Patch Changes

- Updated dependencies [3652c57]
  - @danielsimonjr/mathts-core@0.21.0

## 0.1.22

### Patch Changes

- Updated dependencies [9f5a065]
- Updated dependencies [83d8074]
- Updated dependencies [d7daec0]
- Updated dependencies [19c4ba7]
- Updated dependencies [11c4559]
- Updated dependencies [a6cf17a]
- Updated dependencies [2fd47ee]
- Updated dependencies [9009676]
- Updated dependencies [b1bdef8]
- Updated dependencies [b2a24a0]
- Updated dependencies [1f52df2]
- Updated dependencies [2fd47ee]
  - @danielsimonjr/mathts-core@0.20.0

## 0.1.21

### Patch Changes

- Updated dependencies [61426de]
  - @danielsimonjr/mathts-core@0.19.0

## 0.1.20

### Patch Changes

- Updated dependencies [15adc89]
  - @danielsimonjr/mathts-core@0.18.0

## 0.1.19

### Patch Changes

- Updated dependencies [f31f5ee]
  - @danielsimonjr/mathts-core@0.17.0

## 0.1.18

### Patch Changes

- Updated dependencies [5b7ca6d]
  - @danielsimonjr/mathts-core@0.16.0

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
