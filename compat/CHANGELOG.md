# @danielsimonjr/mathts-compat

## 0.6.0

### Minor Changes

- 799b0fe: Compat output matches mathjs for `toString` and scalar trig (#889, #891, #892, #737).
  
  Breaking, visible output changes:
  
  - `Fraction#toString` prints the repeating decimal (`1/3` is now `0.(3)`, `1/2` is `0.5`). `format()` still prints the ratio (`1/3`), and a whole value prints without a denominator (`format(fraction(4, 2))` is `2`, not `2/1`).
  - `Matrix#toString` (matrix package, and the compat dense and sparse matrices) prints the nested-array form through `format()`: `[[1, 2], [3, 4]]` for 2-D, nested brackets for 3-D and more. Entries use `format()`: a Fraction entry prints `1/3` and a string entry prints quoted. The sparse matrix no longer prints the `Sparse Matrix [n x m]` listing from `toString`.
  - `Complex#toString` prints `NaN` when a part is NaN and `Infinity` when a part is infinite, as mathjs does (`log(-Infinity)` prints `Infinity`).
  - The compat instance type has no string index signature: `MathInstance` is the functions namespace plus the compat members. Code that read `math[name]` as `unknown` needs a cast.
  
  Workbook cells keep the ratio form for a Fraction result (`1/3`).
  
  Compat scalar `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `exp` and `log` take a number fast path.
  
  Documented exception: `asin(NaN)`, `acos(NaN)` and `log(NaN)` return a real `NaN` (mathjs returns Complex `NaN`); the printed text is the same.
- b95de8a: **Breaking:** Node 20 is dropped (`engines.node` >=22.12); packed-consumer contract (#886, #888, #890, #893, #905, #912, #914, #916, #930).
  
  Every package sets `engines.node` to `>=22.12`, and CI tests 22.x and 24.x.
  
  Every `exports` entry gains a `default` condition equal to `import`, so `require()` of the ES build works at run time on Node >= 22.12 (`mathts-wasm` has top-level await and stays import-only). Node 22.12 prints an `ExperimentalWarning` for it; 22.13 and later do not. On Node 22.11 and earlier, `require()` reports `ERR_REQUIRE_ESM`; use `import()`. TypeScript accepts the `require()` of these packages from CommonJS under `moduleResolution: nodenext`; `node16` reports TS1471. Issue #736 closed docs-only because its acceptance allowed documenting ESM-only; the `default` condition is the `require(esm)` fix.
  
  Published `.d.ts` files name no Node, workerpool, DOM or WebGPU global, so strict `tsc` with no `@types/node` passes. The `mathts-gpu` handle types are the WebGPU global types when the consumer has them, and interfaces of the package when it has not. `mathts-workerpool` ships a `browser` build (the worker is one classic script), so a bundler pulls no Node builtin into `mathts-compat`. README code fences carry a runtime tag. `functions/evaluate` is not a size saving; use `mathts-expression` for a small bundle.

### Patch Changes

- aa76758: `evaluate('0.75 inch')` and `unit(0.75, 'inch')` store one exact value, and `60 mile/hour` agrees on both paths (#955). The `sin(200 grad)` result moves to the exact value, which is closer to sin(π) = 0.
- 69f09cc: Public factories resolve their own default dependencies. `createParse()` and `createEvaluate()` run with no argument (#883, #924). `createParse(create(all))` builds the AST node constructors on the caller's math scope (#924). The string-to-Node converter on the shared typed instance belongs to `functions`: `createParse` registers none, so `parse` works in every load order (#937). `simplify` tests nodes by their structure, so a node from another parse simplifies like an own node (#937). Caller-supplied dependencies always win. The nodes of `createParse(create(all))` hide the same denylisted names as `math.evaluate` (`import`, `createUnit`, `parse`, ...), and parse reads a config accessor such as compat's `math.config` on each call, so `number: 'BigNumber'` holds. `create(all).typed` has every member of `mathTyped` (`addConversion`, `find`, ...).
- Updated dependencies [59581d0]
- Updated dependencies [a66847e]
- Updated dependencies [9f2eefa]
- Updated dependencies [3e0fb02]
- Updated dependencies [e6a651b]
- Updated dependencies [9188123]
- Updated dependencies [e422aa3]
- Updated dependencies [9f3f5d6]
- Updated dependencies [2635bbb]
- Updated dependencies [2635bbb]
- Updated dependencies [aa76758]
- Updated dependencies [531b343]
- Updated dependencies [9188123]
- Updated dependencies [efa8b4f]
- Updated dependencies [69f09cc]
- Updated dependencies [ece9539]
- Updated dependencies [a1e3395]
- Updated dependencies [799b0fe]
- Updated dependencies [cee43ac]
- Updated dependencies [f89e84d]
- Updated dependencies [2635bbb]
- Updated dependencies [9188123]
- Updated dependencies [203ff66]
- Updated dependencies [b5e7dd8]
- Updated dependencies [b95de8a]
- Updated dependencies [9188123]
  - @danielsimonjr/mathts-functions@0.86.0
  - @danielsimonjr/mathts-matrix@0.11.0
  - @danielsimonjr/mathts-parallel@0.11.0
  - @danielsimonjr/mathts-core@0.28.0

## 0.5.0

### Minor Changes

- 0badf5b: Add mathjs instance methods (`import`, `typed`, `compile`), matrix `subset` via factory bridge, JSON reviver for Unit/BigNumber, and honest migration guide gap table (dogfood G16).
- 39e08ef: Real scalar `log`, `pow`, `nthRoot`, `acosh`, `atanh`, `asin`, and `acos` now match mathjs complex promotion when `predictable` is false. Previously these returned `NaN` for many out-of-domain reals. `predictable: true` preserves real-only `Math.*` results. Compat inverse-trig shims delegate to functions instead of calling `Math.asin` directly.

### Patch Changes

- 17f64da: Fraction `toString` uses decimal form when the denominator is a power of ten (`0.1`), and `toJSON` emits numeric `n` and `d` when they are safe integers. `size` returns a Matrix when `config.matrix` is `Matrix`, including for native dense matrices, and that matrix stringifies as `[2, 3]`. `createUnit` replaces an existing unit only when `{ override: true }` is passed. Unit conversions keep exact rational scales, so `1 L` is `1000 mL`.
- b5f036d: Publish public call overloads generated from the live typed-function signatures (add, abs, sqrt, exp, log, trig, mean, variance, std, det, evaluate), keep them in sync with a failing check, fix `Unit` as a type via interface merge, and stop referencing `@webgpu/types` so consumers resolve WebGPU names from the TypeScript DOM lib.
- 43e2715: G26 dogfood: faster number sort/median, blocked GEMM, packed `lusolve`, compat scalar fast path, wasm sin policy band, SVD README note.
- a07bf29: Packaging P2 (dogfood G29): ship LICENSE in tarballs, homepage/bugs links, `exports['./package.json']`, honest `sideEffects`, JS source maps from tsdown, and workerpool types that typecheck without `@types/node` (via updated `@danielsimonjr/workerpool` patch).
- Updated dependencies [ef236dc]
- Updated dependencies [a85e335]
- Updated dependencies [adcebad]
- Updated dependencies [e4900c1]
- Updated dependencies [17f64da]
- Updated dependencies [e47134f]
- Updated dependencies [0421fec]
- Updated dependencies [8d727a1]
- Updated dependencies [b5f036d]
- Updated dependencies [e817055]
- Updated dependencies [43e2715]
- Updated dependencies [d3313ec]
- Updated dependencies [6c0194b]
- Updated dependencies [0badf5b]
- Updated dependencies [e51c0d5]
- Updated dependencies [7247de3]
- Updated dependencies [25f7ffa]
- Updated dependencies [e7939a7]
- Updated dependencies [5e692c5]
- Updated dependencies [72df4ec]
- Updated dependencies [c4daa21]
- Updated dependencies [a07bf29]
- Updated dependencies [93c6e56]
- Updated dependencies [064c834]
- Updated dependencies [39e08ef]
- Updated dependencies [ca97716]
- Updated dependencies [5a0b2e1]
  - @danielsimonjr/mathts-core@0.27.0
  - @danielsimonjr/mathts-functions@0.85.0
  - @danielsimonjr/mathts-matrix@0.10.1
  - @danielsimonjr/mathts-parallel@0.10.1

## 0.4.52

### Patch Changes

- Updated dependencies [dca8981]
  - @danielsimonjr/mathts-functions@0.84.0

## 0.4.51

### Patch Changes

- Updated dependencies [52e586e]
- Updated dependencies [2f73d66]
- Updated dependencies [ff20f7c]
- Updated dependencies [be1a7de]
  - @danielsimonjr/mathts-functions@0.83.0
  - @danielsimonjr/mathts-core@0.26.0
  - @danielsimonjr/mathts-parallel@0.10.0
  - @danielsimonjr/mathts-matrix@0.10.0

## 0.4.50

### Patch Changes

- Updated dependencies [7dbceb5]
  - @danielsimonjr/mathts-functions@0.82.0

## 0.4.49

### Patch Changes

- Updated dependencies [47dac0f]
- Updated dependencies [790360f]
  - @danielsimonjr/mathts-functions@0.81.0

## 0.4.48

### Patch Changes

- 2b8dc33: Add or correct the doc comments of exported symbols, so the published declarations describe them. `create` in compat now carries its own doc comment. The change is to comments only: the emitted JavaScript is unchanged.
- Updated dependencies [2b8dc33]
  - @danielsimonjr/mathts-functions@0.80.1
  - @danielsimonjr/mathts-matrix@0.9.6

## 0.4.47

### Patch Changes

- Updated dependencies [685a2b4]
  - @danielsimonjr/mathts-functions@0.80.0

## 0.4.46

### Patch Changes

- Updated dependencies [2c631ff]
- Updated dependencies [2c631ff]
- Updated dependencies [2c631ff]
  - @danielsimonjr/mathts-functions@0.79.0
  - @danielsimonjr/mathts-parallel@0.9.0
  - @danielsimonjr/mathts-matrix@0.9.5

## 0.4.45

### Patch Changes

- Updated dependencies [e898069]
  - @danielsimonjr/mathts-functions@0.78.0

## 0.4.44

### Patch Changes

- Updated dependencies [42f3c97]
  - @danielsimonjr/mathts-core@0.25.0
  - @danielsimonjr/mathts-functions@0.77.3
  - @danielsimonjr/mathts-matrix@0.9.4
  - @danielsimonjr/mathts-parallel@0.8.4

## 0.4.43

### Patch Changes

- Updated dependencies [e7a003e]
  - @danielsimonjr/mathts-core@0.24.0
  - @danielsimonjr/mathts-functions@0.77.2
  - @danielsimonjr/mathts-matrix@0.9.3
  - @danielsimonjr/mathts-parallel@0.8.3

## 0.4.42

### Patch Changes

- Updated dependencies [3628d5a]
  - @danielsimonjr/mathts-core@0.23.0
  - @danielsimonjr/mathts-functions@0.77.1
  - @danielsimonjr/mathts-matrix@0.9.2
  - @danielsimonjr/mathts-parallel@0.8.2

## 0.4.41

### Patch Changes

- Updated dependencies [22cb17e]
  - @danielsimonjr/mathts-functions@0.77.0

## 0.4.40

### Patch Changes

- Updated dependencies [5fa92f7]
  - @danielsimonjr/mathts-functions@0.76.0

## 0.4.39

### Patch Changes

- Updated dependencies [c491a7e]
- Updated dependencies [c4ba088]
  - @danielsimonjr/mathts-functions@0.75.0

## 0.4.38

### Patch Changes

- Updated dependencies [05ef781]
- Updated dependencies [3e0e278]
- Updated dependencies [ed1ab85]
  - @danielsimonjr/mathts-functions@0.74.0

## 0.4.37

### Patch Changes

- Updated dependencies [09b4dde]
- Updated dependencies [ac4212b]
- Updated dependencies [6e3a978]
- Updated dependencies [2a6c91d]
- Updated dependencies [2979fc5]
- Updated dependencies [e53b514]
- Updated dependencies [0de3d7a]
- Updated dependencies [c042500]
- Updated dependencies [2fd73e8]
  - @danielsimonjr/mathts-core@0.22.0
  - @danielsimonjr/mathts-functions@0.73.0
  - @danielsimonjr/mathts-matrix@0.9.1
  - @danielsimonjr/mathts-parallel@0.8.1

## 0.4.36

### Patch Changes

- Updated dependencies [8a731dc]
- Updated dependencies [b8d55ee]
- Updated dependencies [b8d55ee]
- Updated dependencies [cb18d71]
- Updated dependencies [67e132f]
- Updated dependencies [1de5cfb]
- Updated dependencies [4245556]
- Updated dependencies [80433ef]
- Updated dependencies [d296f2b]
- Updated dependencies [9f8c4e7]
- Updated dependencies [f312049]
- Updated dependencies [ccb51a6]
- Updated dependencies [b8d55ee]
- Updated dependencies [b8d55ee]
- Updated dependencies [fa0d39c]
- Updated dependencies [b8d55ee]
- Updated dependencies [b8d55ee]
- Updated dependencies [3cb9f92]
  - @danielsimonjr/mathts-functions@0.72.0

## 0.4.35

### Patch Changes

- 78f8a1c: `create()` wraps each function with the instance config on first access instead of wrapping all of them up front. Wrappers are memoized (`math.add === math.add`), `Object.keys(math)` is unchanged, and a frozen instance keeps working (the wrapper is served from a closure when the property cannot be redefined).
- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
  - @danielsimonjr/mathts-functions@0.71.0
  - @danielsimonjr/mathts-core@0.21.1
  - @danielsimonjr/mathts-matrix@0.9.0
  - @danielsimonjr/mathts-parallel@0.8.0

## 0.4.34

### Patch Changes

- Updated dependencies [3652c57]
  - @danielsimonjr/mathts-core@0.21.0
  - @danielsimonjr/mathts-functions@0.70.1
  - @danielsimonjr/mathts-matrix@0.8.1
  - @danielsimonjr/mathts-parallel@0.7.1

## 0.4.33

### Patch Changes

- 18f655b: Isolate compat `create(all, config)` from the process-wide functions config via a synchronous `runWithConfig` overlay and a config proxy on the activated factory graph. Fixes audit I-9 (#425).
- Updated dependencies [b1da434]
- Updated dependencies [45d691e]
- Updated dependencies [fa4e463]
- Updated dependencies [c5e752a]
- Updated dependencies [cbabf22]
- Updated dependencies [c7ef24d]
- Updated dependencies [5ec27a9]
- Updated dependencies [8ed70e9]
- Updated dependencies [8b5cac4]
- Updated dependencies [71f8c3c]
- Updated dependencies [c467f72]
- Updated dependencies [2761c87]
- Updated dependencies [1f0c509]
- Updated dependencies [0b085aa]
- Updated dependencies [1203b0f]
- Updated dependencies [ab33deb]
- Updated dependencies [e2be2c7]
- Updated dependencies [156e4ea]
- Updated dependencies [4f8bceb]
- Updated dependencies [a24444b]
- Updated dependencies [9f5a065]
- Updated dependencies [83d8074]
- Updated dependencies [c987ee5]
- Updated dependencies [ec7dcdb]
- Updated dependencies [d7daec0]
- Updated dependencies [7e71f31]
- Updated dependencies [e59fe83]
- Updated dependencies [c4f28d5]
- Updated dependencies [234726f]
- Updated dependencies [a01adf3]
- Updated dependencies [e591145]
- Updated dependencies [3f2d4e5]
- Updated dependencies [af7733a]
- Updated dependencies [19c4ba7]
- Updated dependencies [bcfcff4]
- Updated dependencies [3b240fb]
- Updated dependencies [11c4559]
- Updated dependencies [58fdd7a]
- Updated dependencies [914b9b1]
- Updated dependencies [8e16768]
- Updated dependencies [61d46ad]
- Updated dependencies [9dc97c5]
- Updated dependencies [1806a0a]
- Updated dependencies [37c0fd4]
- Updated dependencies [a6cf17a]
- Updated dependencies [55f6b3a]
- Updated dependencies [d8b1733]
- Updated dependencies [6e7532e]
- Updated dependencies [2fd47ee]
- Updated dependencies [c45524e]
- Updated dependencies [81b76ea]
- Updated dependencies [3400f59]
- Updated dependencies [bf374b0]
- Updated dependencies [0400aa1]
- Updated dependencies [18f655b]
- Updated dependencies [66d5896]
- Updated dependencies [ef55d67]
- Updated dependencies [8b0192c]
- Updated dependencies [5b9bf24]
- Updated dependencies [d305864]
- Updated dependencies [fbd543e]
- Updated dependencies [5dfc421]
- Updated dependencies [936f37e]
- Updated dependencies [e6fd1c2]
- Updated dependencies [f5ffe00]
- Updated dependencies [9ee55f8]
- Updated dependencies [9009676]
- Updated dependencies [d18eed3]
- Updated dependencies [bc74de0]
- Updated dependencies [0c02ffe]
- Updated dependencies [b1bdef8]
- Updated dependencies [468a9d1]
- Updated dependencies [b2a24a0]
- Updated dependencies [1f52df2]
- Updated dependencies [adfa43f]
- Updated dependencies [b802c14]
- Updated dependencies [5b79083]
- Updated dependencies [0902acd]
- Updated dependencies [2fd47ee]
- Updated dependencies [35ef447]
- Updated dependencies [55f6b3a]
- Updated dependencies [01e3d57]
- Updated dependencies [67406a8]
- Updated dependencies [974167d]
- Updated dependencies [5179cec]
- Updated dependencies [fc6c32b]
- Updated dependencies [2b8c5b9]
- Updated dependencies [b24e3ec]
- Updated dependencies [654984e]
- Updated dependencies [f915105]
- Updated dependencies [b540dfd]
- Updated dependencies [58a5ec7]
- Updated dependencies [760114e]
  - @danielsimonjr/mathts-functions@0.70.0
  - @danielsimonjr/mathts-matrix@0.8.0
  - @danielsimonjr/mathts-parallel@0.7.0
  - @danielsimonjr/mathts-core@0.20.0

## 0.4.32

### Patch Changes

- Updated dependencies [61426de]
  - @danielsimonjr/mathts-core@0.19.0
  - @danielsimonjr/mathts-functions@0.69.1
  - @danielsimonjr/mathts-matrix@0.7.9
  - @danielsimonjr/mathts-parallel@0.6.11

## 0.4.31

### Patch Changes

- Updated dependencies [02984be]
  - @danielsimonjr/mathts-functions@0.69.0

## 0.4.30

### Patch Changes

- Updated dependencies [15adc89]
  - @danielsimonjr/mathts-core@0.18.0
  - @danielsimonjr/mathts-functions@0.68.2
  - @danielsimonjr/mathts-matrix@0.7.8
  - @danielsimonjr/mathts-parallel@0.6.10

## 0.4.29

### Patch Changes

- Updated dependencies [f31f5ee]
  - @danielsimonjr/mathts-core@0.17.0
  - @danielsimonjr/mathts-functions@0.68.1
  - @danielsimonjr/mathts-matrix@0.7.7
  - @danielsimonjr/mathts-parallel@0.6.9

## 0.4.28

### Patch Changes

- Updated dependencies [75416dc]
  - @danielsimonjr/mathts-functions@0.68.0

## 0.4.27

### Patch Changes

- Updated dependencies [c9229ac]
  - @danielsimonjr/mathts-functions@0.67.0

## 0.4.26

### Patch Changes

- Updated dependencies [4f6365f]
- Updated dependencies [5b7ca6d]
- Updated dependencies [dad40d9]
- Updated dependencies [07fd902]
- Updated dependencies [8b87618]
  - @danielsimonjr/mathts-functions@0.66.0
  - @danielsimonjr/mathts-core@0.16.0
  - @danielsimonjr/mathts-matrix@0.7.6
  - @danielsimonjr/mathts-parallel@0.6.8

## 0.4.25

### Patch Changes

- 8b0f960: Two type fixes, with no runtime change.
  
  - **`chain()` now type-checks.** `chain(3).add(4).multiply(2).done()` failed to compile: the `Chain` index signature returned `Chain | unknown`, which is `unknown`. `Chain` is now `ChainMethods & ChainUnwrap`, so every function name returns the next `Chain` and `done()`/`valueOf()` still return `unknown`.
  - **`MathJSConfig` declares every key `config()` returns.** The returned object is the merged functions runtime config, but the type listed only five keys, so reading `relTol`, `absTol`, `numberFallback`, `predictable` or `legacySubset` did not compile. `number` also accepts `'bigint'`, which the runtime config supports.
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
  - @danielsimonjr/mathts-matrix@0.7.5
  - @danielsimonjr/mathts-functions@0.65.0
  - @danielsimonjr/mathts-core@0.15.5
  - @danielsimonjr/mathts-parallel@0.6.7

## 0.4.24

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
- Updated dependencies [a13ce7e]
  - @danielsimonjr/mathts-core@0.15.4
  - @danielsimonjr/mathts-functions@0.64.3
  - @danielsimonjr/mathts-matrix@0.7.4
  - @danielsimonjr/mathts-parallel@0.6.6

## 0.4.23

### Patch Changes

- 593c70e: The published `.d.ts` files no longer import from `typed-function`, which neither package declares as a dependency. Consumers with `skipLibCheck: false` got TS7016 errors (138 in matrix, 39 in compat), because the import resolved to an untyped `typed-function@4.2.2` copy hoisted by other packages. The typed-function exports now use the `TypedFunction` type that `@danielsimonjr/mathts-core` re-exports, so the declarations resolve through a declared dependency.
- Updated dependencies [593c70e]
  - @danielsimonjr/mathts-matrix@0.7.3

## 0.4.22

### Patch Changes

- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
  - @danielsimonjr/mathts-core@0.15.0
  - @danielsimonjr/mathts-functions@0.64.1
  - @danielsimonjr/mathts-matrix@0.7.2
  - @danielsimonjr/mathts-parallel@0.6.5

## 0.4.21

### Patch Changes

- Updated dependencies [8789126]
  - @danielsimonjr/mathts-functions@0.64.0

## 0.4.20

### Patch Changes

- Updated dependencies [104a1c9]
- Updated dependencies [0592f7b]
  - @danielsimonjr/mathts-core@0.14.1
  - @danielsimonjr/mathts-functions@0.63.0

## 0.4.18

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.61.0

## 0.4.17

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.60.0

## 0.4.16

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.59.0

## 0.4.15

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.58.0

## 0.4.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.57.0

## 0.4.13

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.56.0

## 0.4.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.55.0

## 0.4.11

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.54.0

## 0.4.10

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.53.0

## 0.4.9

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.52.0

## 0.4.8

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.51.0

## 0.4.7

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.50.0

## 0.4.6

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.49.0

## 0.4.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.48.0

## 0.4.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.47.0

## 0.4.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.46.0

## 0.4.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.7.0
  - @danielsimonjr/mathts-functions@0.45.0

## 0.4.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.44.0

## 0.4.0

### Minor Changes

- Resolve the deduplication campaign's final decisions: a compat compatibility correction and an internal WasmLoader consolidation.

  **compat (behavior change):** `zeros(n)` and `ones(n)` with a single argument now return a length-`n` **vector** (`[0,0,0]` / `[1,1,1]`), matching mathjs, instead of an `n×n` square matrix. Two-argument `zeros(r, c)` / `ones(r, c)` continue to return an `r×c` matrix. compat's purpose is mathjs compatibility, and the previous square result diverged from mathjs (`math.zeros(3)` is a size-`[3]` vector) — this was a bug. Anyone relying on `zeros(n)` returning a square must now pass `zeros(n, n)`.

  **core / functions / matrix (internal, no runtime behavior change):** the shared WASM-loader logic — the SHA-384 integrity verification (`sha384OfBuffer` / `verifyWasmIntegrity` / `loadWasmManifest`) and packaged-binary resolution (`resolvePackagedWasm` / `defaultWasmLocation`) — was byte-identical in `functions` and `matrix` and is now single-sourced in `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`), with each package injecting its own binary/manifest path. The SHA-384 verify-before-instantiate security invariant is preserved byte-for-byte (Node `crypto.createHash('sha384')` / browser `crypto.subtle.digest('SHA-384')`, mismatch throws), node built-ins stay behind lazy dynamic `import()`, and core's browser-safe `.` entry is unaffected. The per-package `WasmLoader` class stays local (distinct AS allocation models).

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0
  - @danielsimonjr/mathts-functions@0.43.2
  - @danielsimonjr/mathts-matrix@0.6.3
  - @danielsimonjr/mathts-parallel@0.6.3

## 0.3.32

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0
  - @danielsimonjr/mathts-functions@0.43.1
  - @danielsimonjr/mathts-matrix@0.6.2
  - @danielsimonjr/mathts-parallel@0.6.2

## 0.3.31

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.43.0
  - @danielsimonjr/mathts-core@0.11.0
  - @danielsimonjr/mathts-matrix@0.6.1
  - @danielsimonjr/mathts-parallel@0.6.1

## 0.3.30

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.42.0

## 0.3.29

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.41.0

## 0.3.28

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.6.0
  - @danielsimonjr/mathts-functions@0.40.1

## 0.3.27

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.40.0

## 0.3.26

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.39.0

## 0.3.25

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.38.0

## 0.3.24

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.5.0
  - @danielsimonjr/mathts-functions@0.37.1

## 0.3.23

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @danielsimonjr/mathts-functions@0.37.0
  - @danielsimonjr/mathts-matrix@0.4.6

## 0.3.22

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.36.0

## 0.3.21

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.35.0

## 0.3.20

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.34.0

## 0.3.19

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.33.0

## 0.3.18

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.32.0

## 0.3.17

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.31.0

## 0.3.16

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.30.0

## 0.3.15

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.29.0

## 0.3.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.28.0

## 0.3.13

### Patch Changes

- Updated dependencies [1174c41]
  - @danielsimonjr/mathts-functions@0.27.0

## 0.3.12

### Patch Changes

- Updated dependencies [199da08]
  - @danielsimonjr/mathts-functions@0.26.0

## 0.3.11

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-functions@0.25.0
  - @danielsimonjr/mathts-parallel@0.6.0
  - @danielsimonjr/mathts-matrix@0.4.5

## 0.3.10

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-functions@0.24.0
  - @danielsimonjr/mathts-matrix@0.4.4
  - @danielsimonjr/mathts-parallel@0.5.1

## 0.3.9

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-functions@0.23.0
  - @danielsimonjr/mathts-parallel@0.5.0
  - @danielsimonjr/mathts-matrix@0.4.3

## 0.3.8

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-functions@0.22.0
  - @danielsimonjr/mathts-parallel@0.4.0
  - @danielsimonjr/mathts-matrix@0.4.2

## 0.3.7

### Patch Changes

- Updated dependencies [ea044c4]
  - @danielsimonjr/mathts-functions@0.21.0
  - @danielsimonjr/mathts-matrix@0.4.1

## 0.3.6

### Patch Changes

- Updated dependencies [b7784ef]
  - @danielsimonjr/mathts-functions@0.20.0

## 0.3.5

### Patch Changes

- Updated dependencies [abbe883]
  - @danielsimonjr/mathts-functions@0.19.0
  - @danielsimonjr/mathts-matrix@0.4.0

## 0.3.4

### Patch Changes

- Updated dependencies [7c53d7f]
  - @danielsimonjr/mathts-functions@0.18.0

## 0.3.3

### Patch Changes

- Updated dependencies [b78b8bc]
- Updated dependencies [2353e0a]
- Updated dependencies [908f19b]
- Updated dependencies [4b4ccd6]
  - @danielsimonjr/mathts-matrix@0.3.0
  - @danielsimonjr/mathts-functions@0.17.0

## 0.3.2

### Patch Changes

- Updated dependencies [557e27f]
  - @danielsimonjr/mathts-functions@0.16.0

## 0.3.1

### Patch Changes

- Updated dependencies [86f786e]
  - @danielsimonjr/mathts-functions@0.15.0

## 0.3.0

### Minor Changes

- 1df691c: **GC12 — `config()` now drives behavior + compat uses the real functions types.**

  - functions gains a `config()` accessor (`config-api.ts`): read the global runtime config, or pass a partial to merge it. Functions read this shared object live at call time (e.g. `identity`/`range`'s `config.matrix === 'Array'` return-type switch, `zeta`'s `config.relTol`), so `config({ matrix: 'Array' })` genuinely changes results. It is process-global (the functions surface is a singleton), not per-instance like mathjs `create()`.
  - compat's `config()` was **inert** (mutated a private object nothing read); it now forwards to `functions.config`, so `math.config({ matrix: 'Array' })` drives the functions surface, and `create(all, { … })` seeds it.
  - Deleted `compat/src/functions.d.ts` — an outdated ambient `declare module` stub (21 functions) whose own header said "until the functions package has proper .d.ts files." It was **shadowing** the real, complete functions types, so `import * as F` saw an empty namespace (even `F.zeta`/`F.cbrt` were invisible). compat now type-checks against the real 829-export surface. This closes GC12's "widen functions.d.ts" at root cause.

  Config is now process-global: a `delegation` test that asserted per-instance isolation was updated to reflect this (isolation was only ever "true" because config did nothing).

### Patch Changes

- Updated dependencies [1df691c]
- Updated dependencies [f2211c8]
  - @danielsimonjr/mathts-functions@0.14.0

## 0.2.11

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0
  - @danielsimonjr/mathts-functions@0.13.2
  - @danielsimonjr/mathts-matrix@0.2.2

## 0.2.10

### Patch Changes

- Updated dependencies [598e72d]
- Updated dependencies [ce8f929]
  - @danielsimonjr/mathts-functions@0.13.0

## 0.2.9

### Patch Changes

- Updated dependencies [779fcde]
- Updated dependencies [583817d]
- Updated dependencies [538c672]
- Updated dependencies [5f3b401]
  - @danielsimonjr/mathts-functions@0.12.0
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-matrix@0.2.0
  - @danielsimonjr/mathts-parallel@0.3.2

## 0.2.8

### Patch Changes

- Updated dependencies [dc14440]
- Updated dependencies [18871e1]
  - @danielsimonjr/mathts-functions@0.11.0

## 0.2.7

### Patch Changes

- Updated dependencies [dfb1b25]
- Updated dependencies [23642f2]
  - @danielsimonjr/mathts-functions@0.10.0

## 0.2.6

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [c041b4e]
- Updated dependencies [c041b4e]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-functions@0.9.0
  - @danielsimonjr/mathts-matrix@0.1.14

## 0.2.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.8.0

## 0.2.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.1
  - @danielsimonjr/mathts-functions@0.7.0

## 0.2.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.6.0

## 0.2.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-functions@0.5.0
  - @danielsimonjr/mathts-matrix@0.1.12

## 0.2.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-functions@0.4.0
  - @danielsimonjr/mathts-matrix@0.1.11

## 0.2.0

### Minor Changes

- - **feat (GC12):** fluent `chain` API — `math.chain(3).add(4).multiply(2).done()`.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @danielsimonjr/mathts-functions@0.3.0
  - @danielsimonjr/mathts-parallel@0.3.0
  - @danielsimonjr/mathts-matrix@0.1.10

## 0.1.9

### Patch Changes

- `add`/`subtract`/`multiply` are now variadic (mathjs parity): they fold over all arguments instead of dropping the 3rd+ operand. Previously `add(1, 2, 3)` returned `3` and `multiply(2, 3, 4)` returned `6`. Matrix operands and 2-arg calls are unchanged.
- Repin to `@danielsimonjr/mathts-core@^0.1.5` and `@danielsimonjr/mathts-functions@^0.2.8`.

## 0.1.8

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.7

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.6

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.5` (special-function fixes) for the matched set.

## Unreleased

### Tests

- Raise vitest line coverage of `compat/src/**` to 100% (`shims.ts` 159/159 lines, up from 95%). Added 19 tests across two new files:
  - `tests/coverage-gaps.test.ts` — factory pass-through (same `Fraction`/`BigNumber`/`DenseMatrix`/`SparseMatrix` instance returned unchanged), empty `sparse()` constructor, `det()` edge cases (0x0 empty matrix returns 1, `TypeError` on `SparseMatrix` input, 4x4 singular matrix returns 0 via the LU pivot-underflow path), and `size()` on matrix objects.
  - `tests/delegation.test.ts` — `create(all)` builds a mathjs-compatible instance whose arithmetic/statistics/rounding/type-creation surface delegates to the core types and functions ops, with per-instance config isolation.
- Add a `test:coverage` npm script to `compat/package.json` for parity with sibling packages.

## 0.1.5

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.4` (which now ships type declarations) to keep the matched MathTS set on one version.

## 0.1.4

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.3` to keep the matched MathTS package set on a single `expression`/`functions` version.

## 0.1.3

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.

## 0.1.1

### Patch Changes

- e771b4e: Fix all pre-existing build, typecheck, and configuration issues across the monorepo.

  ### assembly/ (WASM)
  - Fix AssemblyScript build: prefix 114 bare math calls with `Math.`, fix abort path in asconfig.json
  - Add 6 missing inverse trig methods to Complex class (asin, acos, atan, asinh, acosh, atanh)
  - Fix complex_pow calling wrong method (pow → powReal for f64 args)

  ### expression/
  - Enable build: fix broken types.ts import, create tsconfig.json, restore build script
  - Copy shared mathjs utils into package, fix 60+ import paths
  - Export missing types (CompiledExpression, StringOptions), clean up unused @ts-expect-error directives

  ### parallel/ + matrix/ + compat/
  - Fix typecheck failures caused by workerpool shipping raw .ts sources
  - Create workerpool type stub (parallel/types/workerpool.d.ts) with full declarations
  - Redirect workerpool resolution via tsconfig paths in all affected packages

  ### All packages
  - Add @types/node to all 7 workspace package devDependencies
  - Add vitest.config.ts to 5 packages missing local test configs
  - Fix missing beforeAll/afterAll imports in ParallelMatrix tests

- Updated dependencies [e771b4e]
  - @danielsimonjr/mathts-core@0.1.1
  - @danielsimonjr/mathts-matrix@0.1.1
  - @danielsimonjr/mathts-functions@0.1.1
  - @danielsimonjr/mathts-parallel@0.1.1
