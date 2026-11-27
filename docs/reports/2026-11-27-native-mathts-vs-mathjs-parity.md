# Native MathTS vs mathjs 15.3.0

Ground-truth parity of **native MathTS** (every workspace package except `@danielsimonjr/mathts-compat`) against the published **mathjs 15.3.0** ESM entry (`lib/esm/entry/mainAny.js` and the generated files it re-exports).

MathTS commit: [`6a5a640ef973`](https://github.com/danielsimonjr/MathTS/commit/6a5a640ef97324b676a0599f7b4e505b089924d5).
mathjs artifact: `npm pack mathjs@15.3.0` (registry tarball, not the GitHub tag archive; the tag omits the generated entry files).
Companion data: [exports-inventory.csv](2026-11-27-native-mathts-vs-mathjs-parity/exports-inventory.csv), [features-inventory.csv](2026-11-27-native-mathts-vs-mathjs-parity/features-inventory.csv), [summary.json](2026-11-27-native-mathts-vs-mathjs-parity/summary.json).

This review does not re-run the November 25 value differential. That harness compared **compat** `create(all)` with mathjs and lives in [2026-11-25-mathjs-parity-gap-analysis.md](2026-11-25-mathjs-parity-gap-analysis.md). A `native-full` row here means the symbol is on a public native export and this pass did not record a structural gap. It does not mean the function was executed against mathjs 15.3.0.

## Headline

| surface                                                                       | rows | native-full | native-partial | compat-only | missing | intentional-diff |
| ----------------------------------------------------------------------------- | ---: | ----------: | -------------: | ----------: | ------: | ---------------: |
| mathjs value exports (functions, classes, constants, core names, type guards) |  395 |         383 |              4 |           2 |       0 |                6 |
| `create*` factories                                                           |  371 |          50 |             63 |         258 |       0 |                0 |
| `*Dependencies` bundles                                                       |  371 |           0 |              0 |           0 |       0 |              371 |
| architecture features (separate checklist)                                    |   33 |          16 |              6 |           3 |       0 |                8 |

No mathjs **export name** is absent from both native MathTS and compat (`missing` = 0 on all three export surfaces). The gap that matters is **where** the feature lives.

The export walker recorded 2,450 distinct native symbols and 1,159 compat symbols. Per-package counts are in `summary.json`.

## Method

1. mathjs names are the static `export` bindings of `mainAny.js`: pure and impure generated values, `typeChecks.js`, `dependenciesAny.generated.js`, `factoriesAny.js`, plus `create`, `factory`, and `config`. That is **1137** names. Categories for value exports come from `src/expression/embeddedDocs/` (one file per documented function). Physical constants are the names passed to `unitFactory` / `numberFactory` in `src/type/unit/physicalConstants.js`. Node classes and numeric classes are retagged by name.
2. A native hit is a **value** export reachable from a public `package.json` `exports` entry of any workspace package other than `@danielsimonjr/mathts-compat`, including subpaths such as `@danielsimonjr/mathts-core/internal` and `@danielsimonjr/mathts-functions/evaluate`. `export *` and `export { … }` are followed through relative `.js` specifiers to the `.ts` source. `export type` is ignored.
3. A compat hit is the same walk of `compat/src/index.ts`.
4. Labels:
   - `native-full` — public native export (or a documented constant alias: `pi`→`PI`, `e`→`E`, `tau`→`TAU`, `phi`→`PHI`, `i`→`I`) and no structural gap recorded in this pass.
   - `native-partial` — public native export, with the gap written in the CSV `gap` column.
   - `compat-only` — no public native export; compat exports it. Internal source that is not on a package entry counts as not native.
   - `missing` — neither public surface exports it.
   - `intentional-diff` — the shape is a deliberate MathTS choice (module graph, sandbox, version string, keyword aliases).

## Value exports by category

| category           | mathjs names | native-full | native-partial | compat-only | missing | intentional-diff |
| ------------------ | -----------: | ----------: | -------------: | ----------: | ------: | ---------------: |
| algebra            |           20 |          20 |              0 |           0 |       0 |                0 |
| arithmetic         |           37 |          37 |              0 |           0 |       0 |                0 |
| bitwise            |            7 |           7 |              0 |           0 |       0 |                0 |
| class              |           15 |          15 |              0 |           0 |       0 |                0 |
| combinatorics      |            4 |           4 |              0 |           0 |       0 |                0 |
| complex            |            4 |           4 |              0 |           0 |       0 |                0 |
| constants          |           17 |          11 |              0 |           0 |       0 |                6 |
| construction       |           12 |          12 |              0 |           0 |       0 |                0 |
| core               |            4 |           0 |              4 |           0 |       0 |                0 |
| expression         |            5 |           5 |              0 |           0 |       0 |                0 |
| expression-node    |           16 |          16 |              0 |           0 |       0 |                0 |
| fraction           |            2 |           2 |              0 |           0 |       0 |                0 |
| geometry           |            2 |           2 |              0 |           0 |       0 |                0 |
| logical            |            5 |           5 |              0 |           0 |       0 |                0 |
| matrix             |           40 |          40 |              0 |           0 |       0 |                0 |
| numeric            |            1 |           1 |              0 |           0 |       0 |                0 |
| other              |           15 |          13 |              0 |           2 |       0 |                0 |
| physical-constants |           51 |          51 |              0 |           0 |       0 |                0 |
| probability        |           12 |          12 |              0 |           0 |       0 |                0 |
| relational         |           11 |          11 |              0 |           0 |       0 |                0 |
| set                |           10 |          10 |              0 |           0 |       0 |                0 |
| signal             |            2 |           2 |              0 |           0 |       0 |                0 |
| special            |            2 |           2 |              0 |           0 |       0 |                0 |
| statistics         |           13 |          13 |              0 |           0 |       0 |                0 |
| trigonometry       |           25 |          25 |              0 |           0 |       0 |                0 |
| type-guard         |           43 |          43 |              0 |           0 |       0 |                0 |
| units              |            2 |           2 |              0 |           0 |       0 |                0 |
| utils              |           18 |          18 |              0 |           0 |       0 |                0 |
| **total**          |          395 |         383 |              4 |           2 |       0 |                6 |

`native-full` on a function row means the short name (`add`, `simplify`, `fft`, `derivative`, …) is exported from a native package. Most of those implementations are the typed functions in `functions/src/typed/` or the activated factories in `functions/src/factories/`, not a proof of bit-identity with mathjs.

### Value-level gaps (the only ones)

| name                                            | status           | what is true                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `all`                                           | compat-only      | The factory map `create(all)` is the compat container. Native packages are imported by name.                                                                                                                                                                                                                                                                                                                                                         |
| `Index`                                         | compat-only      | mathjs `Index` is `createIndexClass` in `functions/src/type/matrix/MatrixIndex.ts` and is only stored on the functions factory scope. The native symbol `Index` is a different class (`tensor/src/named-index.ts`, named tensor axes). compat `named-symbols.ts` exports the mathjs class.                                                                                                                                                           |
| `config`                                        | native-partial   | `functions` `config()` writes one process-wide `DEFAULT_CONFIG`. Deprecated `epsilon` is translated only in `functions/src/core/function/config.ts` (the compat instance path), not in `functions/src/config-api.ts`. `runWithConfig` overlays last for the synchronous call only. The keys `number`, `matrix`, `precision`, `relTol`, `absTol`, `predictable`, `randomSeed`, `legacySubset`, and `numberFallback` do exist on `core/src/config.ts`. |
| `create`                                        | native-partial   | The core **root** `create` and `@danielsimonjr/mathts-typed-function` `create` build a typed-function instance. `@danielsimonjr/mathts-core/internal` `create(factories, scope)` only sorts and invokes factories. Neither builds `import`, events, or `expression.mathWithTransform`. That object is compat `create(all, config)`.                                                                                                                  |
| `factory`                                       | native-partial   | `factory(name, dependencies, fn)` is `core/src/factory.ts`, exported from `@danielsimonjr/mathts-core/internal` only.                                                                                                                                                                                                                                                                                                                                |
| `typed`                                         | native-partial   | Native `typed` is the typed-function instance (`mathTyped`). It is not a fresh `typed` per `create()` instance.                                                                                                                                                                                                                                                                                                                                      |
| `version`                                       | intentional-diff | `core` `VERSION` is the MathTS version, not `"15.3.0"`.                                                                                                                                                                                                                                                                                                                                                                                              |
| `_false`, `_true`, `_null`, `_NaN`, `_Infinity` | intentional-diff | mathjs export aliases of the config-aware constants whose real names are reserved words or globals. Native code uses the JavaScript values. compat re-exports the aliases.                                                                                                                                                                                                                                                                           |

Every other value name in the 395, including all 51 physical constants, the 16 AST node classes, `Chain` / `chain`, `Parser`, `ResultSet`, `Help`, `docs`, `reviver`, `replacer`, `DenseMatrix`, `SparseMatrix`, `FibonacciHeap`, `ImmutableDenseMatrix`, and `Spa`, is a public native export.

## Factories and dependency bundles

| category          | mathjs names | native-full | native-partial | compat-only | missing | intentional-diff |
| ----------------- | -----------: | ----------: | -------------: | ----------: | ------: | ---------------: |
| algebra           |           20 |           0 |              0 |          20 |       0 |                0 |
| arithmetic        |           39 |           0 |             28 |          11 |       0 |                0 |
| bitwise           |            7 |           0 |              0 |           7 |       0 |                0 |
| combinatorics     |            4 |           0 |              0 |           4 |       0 |                0 |
| complex           |            4 |           0 |              0 |           4 |       0 |                0 |
| constant-or-class |            1 |           1 |              0 |           0 |       0 |                0 |
| constants         |           18 |           0 |              0 |          18 |       0 |                0 |
| core              |            1 |           0 |              0 |           1 |       0 |                0 |
| expression        |           48 |          46 |              0 |           2 |       0 |                0 |
| fraction          |            2 |           0 |              0 |           2 |       0 |                0 |
| geometry          |            2 |           0 |              0 |           2 |       0 |                0 |
| json              |            2 |           0 |              0 |           2 |       0 |                0 |
| logical           |            5 |           0 |              0 |           5 |       0 |                0 |
| matrix            |           42 |           1 |              3 |          38 |       0 |                0 |
| numeric           |            1 |           0 |              0 |           1 |       0 |                0 |
| probability       |           12 |           0 |              0 |          12 |       0 |                0 |
| relational        |           12 |           0 |              6 |           6 |       0 |                0 |
| set               |           10 |           0 |              0 |          10 |       0 |                0 |
| signal            |            2 |           0 |              0 |           2 |       0 |                0 |
| special           |            2 |           0 |              0 |           2 |       0 |                0 |
| statistics        |           13 |           0 |              6 |           7 |       0 |                0 |
| string            |            5 |           0 |              0 |           5 |       0 |                0 |
| trigonometry      |           25 |           0 |             19 |           6 |       0 |                0 |
| type              |           79 |           2 |              1 |          76 |       0 |                0 |
| unit              |            2 |           0 |              0 |           2 |       0 |                0 |
| utils             |           13 |           0 |              0 |          13 |       0 |                0 |
| **total**         |          371 |          50 |             63 |         258 |       0 |                0 |

The 63 `native-partial` factories are the `#1570` aliases in `functions/src/factories/index.ts`: `export { factory_abs as createAbs, … }`. mathjs `createAbs` is a factory that receives a dependency scope. The native binding is the **already constructed function** (`createAbs === factory_abs`). Callers who tree-shake `createAbs` from mathjs do not get that shape from native MathTS.

The 50 `native-full` factories are real factory functions, mostly `create*Node` / `create*Transform` from `@danielsimonjr/mathts-expression` (46 expression factories).

The 258 `compat-only` factories are the mathjs `create*` graph that native does not re-export. The **values** those factories would build (`add`, `sin`, `simplify`, …) are already native under the short name. Shipping the factories again on native would duplicate the compat dependency graph.

All **371** `*Dependencies` bundles are `intentional-diff`. They exist so mathjs users can `create(addDependencies)`. Native MathTS is explicit ESM packages and does not publish those bundles. compat does, so a mathjs-style import graph still loads.

## Architecture checklist

These are the non-export features in the request. Status is from reading the implementation, not from the name table alone. Full gap text is in `features-inventory.csv`.

| feature                                                                                             | status                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `create(all)` dependency-injection container                                                        | intentional-diff (compat ships it)                                                                                                   |
| `factory()`                                                                                         | native-partial (internal subpath only)                                                                                               |
| `import()` with override, wrap, silent                                                              | compat-only (`importFactory` is native; the instance method is compat)                                                               |
| `config()` keys and `epsilon`                                                                       | native-partial (keys exist; epsilon and per-instance config do not on the public `config()`)                                         |
| `on('config')` / `off` / `once` / `emit`                                                            | compat-only (emitter is mixed onto compat instances; `#1568` keeps the names off the functions barrel)                               |
| `typed` extensibility                                                                               | native-partial                                                                                                                       |
| `reviver` / `replacer`                                                                              | native-full (export presence; JSON samples were not re-diffed)                                                                       |
| `chain()` / `Chain`                                                                                 | native-full                                                                                                                          |
| `help()` and embedded `docs`                                                                        | native-full                                                                                                                          |
| `version`                                                                                           | intentional-diff                                                                                                                     |
| `expression.mathWithTransform`                                                                      | native-partial (built inside `functions/src/factories/index.ts` and used by `evaluate`; the public object is on the compat instance) |
| 0-based calls vs 1-based expression indexes                                                         | intentional-diff (`expression/src/transform/*` is 1-based inside expressions; programmatic `subset` stays 0-based)                   |
| expression sandbox                                                                                  | intentional-diff (`expression/src/utils/customs.ts`; assignment and host-method access stay blocked)                                 |
| `bigint` as a numeric type                                                                          | native-full (`bigint` export; `config.number` includes `'bigint'`)                                                                   |
| `BigNumber`                                                                                         | intentional-diff (core decimal type, not decimal.js)                                                                                 |
| `Complex`, `Fraction`, `Unit` + `createUnit` / `to` / `toBest` / `splitUnit`, physical constants    | native-full (prefix tables were not line-diffed against mathjs `units.js`)                                                           |
| `DenseMatrix`, `SparseMatrix`, `ImmutableDenseMatrix`, `FibonacciHeap`, `Spa`, `Range`, `ResultSet` | native-full                                                                                                                          |
| mathjs `Index`                                                                                      | compat-only (see above; tensor `Index` is a homonym)                                                                                 |
| `PartitionedMap` / `ObjectWrappingMap`                                                              | native-partial (implemented in `core/src/map.ts`, exported from `@danielsimonjr/mathts-core/internal`, not from the core root)       |
| AST node classes                                                                                    | native-full (`expression` exports the classes and `create*` factories)                                                               |
| `Parser` scope and JSON                                                                             | native-partial (the class is public; `evaluate` still refuses assignment, so `parser.evaluate('x = 1')` is not mathjs behavior)      |
| mathjs CLI / REPL                                                                                   | intentional-diff (`workbook` ships `mtsw`, not a mathjs REPL)                                                                        |
| ESM / CJS / UMD and `mathjs/number`                                                                 | intentional-diff (native packages are ESM-only; there is no CJS, UMD, or number-only bundle)                                         |
| `ArgumentsError`, `DimensionError`, `IndexError`                                                    | native-full (`ArgumentsError` on functions; the other two on core)                                                                   |
| TypeScript types                                                                                    | intentional-diff (MathTS emits `.d.ts` from TypeScript source; it is not the mathjs `types/` bundle)                                 |

Expression transforms that mathjs installs on `mathWithTransform` (`map`, `filter`, `forEach`, `index`, `subset`, `sum`, `mean`, `std`, `variance`, `min`, `max`, `concat`, `range`, `diff`, `cumsum`, `row`, `column`, `print`, `nullish`, and the rest of `expression/src/transform/index.ts`) are public `create*Transform` factories on `@danielsimonjr/mathts-expression`. They are not a single native `expression.mathWithTransform` object.

## compat-only vs missing

**Missing from both surfaces: no mathjs export name.**

**compat-only, and not on any native entry:**

- `all`
- mathjs `Index` (tensor `Index` does not count)
- 258 `create*` factories (the short-name functions are native)
- instance `import()` and `on` / `off` / `once` / `emit` (these are instance properties, not lexical exports of mathjs `mainAny.js`, so they are on the architecture checklist rather than in the 1,137-row export file)

**intentional, and compat still ships them** so existing mathjs import sites keep working: all 371 `*Dependencies` bundles, `create(all)`, the underscored constant aliases, and the compat instance’s `expression.mathWithTransform`.

## What belongs in native MathTS

Keep these as native, which they already are: the function short names, the numeric classes, matrices (including `FibonacciHeap`, `Spa`, `ImmutableDenseMatrix`), the expression parser, AST classes, transforms, `help` / `docs`, `chain`, and the error classes.

Worth promoting into a native **package entry**, because the code is already in native source and only the export is missing:

1. **mathjs `Index`**, under a name that does not collide with tensor `Index` (or as `MatrixIndex` plus a compat alias). `subset` callers currently get the class only from compat.
2. **`epsilon` on the public `config()`**, by routing `functions/src/config-api.ts` through the translator in `functions/src/core/function/config.ts`. The singleton-vs-instance difference should stay documented rather than growing a second DI container.

Keep these **compat-only**. They are the mathjs container, not the native module graph:

- `create(all)`, `import()`, config events, and `expression.mathWithTransform` as one object
- the 371 dependency bundles
- the 258 `create*` factories that native does not already export as real factories
- a mathjs REPL binary, CJS, and UMD (native CLI remains `mtsw`; packages stay ESM)
- decimal.js-shaped `BigNumber` (core keeps its own decimal)

Fix the 63 `createAbs`-style aliases or stop treating them as mathjs factories. They are constructed functions. New tree-shaken factories belong on compat, next to the dependency bundles, not on the functions barrel.

Do not weaken the expression sandbox to match mathjs assignment. That difference is a security invariant (`expression/src/utils/customs.ts`).
