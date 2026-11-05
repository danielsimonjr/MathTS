# Plan: Dependency reduction

**Status:** planning only. This file is the contract for DR-1 through DR-13. It changes no runtime source.
**Tree reviewed:** `30afc17b` (`main`, `SR-17: Walkthrough and example` #602). Re-read a cited file if `main` has moved. Paths were checked on that commit. Line numbers are not used, because they move.
**Goal:** fewer third-party packages on the published graph and on the repo tools, with behavior parity. Each sprint is one small pull request against `main`. A later sprint does not depend on a symbol that only an earlier sprint adds, except where the section says the earlier package must already be gone.
**Out of scope:** merging, releasing, tagging, publishing, force-push, rebase, amend, and `--no-verify`. Setting `RELEASES_ENABLED`. Rewriting `core`'s `SeededRng` (`core/src/numeric/rng.ts`). Editing the seed-7 pin in `functions/tests/scalar-search.test.ts` (`PINNED_ROWS` and the planted-law assertions that name seed 7).

## How this inventory was taken

Every `package.json` in the repo was read, including `tools/*/package.json` and the private root. `node_modules` was not trusted. Locked versions are the strings in `bun.lock`. Unpacked sizes and licenses are the npm registry records for those locked versions (`dist.unpackedSize`, `license`). `javascript-natural-sort@0.7.1` publishes no `unpackedSize`.

Workspace edges (`workspace:*` and the thin re-export packages) are MathTS itself. They are not third-party dependencies and they are not sprints.

The published graph has **11** third-party runtime packages. `js-yaml` is a twelfth name: it is a dependency of `tools/create-dependency-graph` and a root `devDependency`, and it is not a dependency of any published package. Dev tooling is listed after the runtime table.

### The 11 runtime packages

| Package                         | Locked        | Declared by                                                                                          | Decision                                                  |
| ------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `escape-latex`                  | 1.2.0         | `functions`                                                                                          | Rebuild (DR-1)                                            |
| `javascript-natural-sort`       | 0.7.1         | `functions`                                                                                          | Rebuild (DR-2)                                            |
| `tiny-emitter`                  | 2.1.0         | `functions`                                                                                          | Rebuild (DR-3)                                            |
| `seedrandom`                    | 3.0.5         | `functions`                                                                                          | Rebuild (DR-4)                                            |
| `js-yaml`                       | 5.5.0         | tool + root devDependency                                                                            | Rebuild the one call onto `yaml` (DR-5)                   |
| `fraction.js`                   | 5.3.4         | `functions`                                                                                          | Rebuild: delete; `core` `Fraction` already exists (DR-6)  |
| `bignumber.js`                  | 11.1.5        | `functions`                                                                                          | Rebuild: delete; type-only today (DR-7)                   |
| `complex.js`                    | 2.4.3         | `functions`                                                                                          | Rebuild onto the in-tree complex type (DR-8)              |
| `decimal.js`                    | 10.6.0        | `functions`                                                                                          | Rebuild onto `functions/src/type/local/Decimal.ts` (DR-9) |
| `@danielsimonjr/typed-function` | 5.0.0-alpha.4 | `core`, `functions`, root, `packages/typed-function` (all via the npm alias `typed-function`)        | Vendor (DR-10)                                            |
| `@danielsimonjr/workerpool`     | 10.2.2        | root and `packages/workerpool` (npm alias `workerpool`); `parallel` depends on the workspace wrapper | Vendor (DR-11)                                            |
| `yaml`                          | 2.9.0         | `workbook`                                                                                           | **Keep.** No removal sprint.                              |

`js-yaml` is in the table because the owner named it. It is not one of the 11 published-runtime packages. Count of decisions on third-party names in this plan: **9 rebuild, 2 vendor, 23 keep** (the keep set is `yaml` plus the 22 dev packages in the next table). Transitive `argparse` leaves with `js-yaml`. The root `overrides` pins `shell-quote` and `source-map-js` stay; they are not direct dependencies.

## Decision rules

- **Rebuild** means the call sites use MathTS source, and the `package.json` entry is deleted in that same PR. A local file that already exists (`Decimal.ts`, `core` `Fraction`, `core` `Complex`, `core` `BigNumber`) is the replacement when the section names it. Do not add a new dependency to do the replacement.
- **Vendor** means the pinned tarball's source is copied into the repo, license text is kept next to it, and the npm alias is deleted. Do not keep a dependency on the package you just copied.
- **Keep** means the package stays. The reason is in the inventory. No sprint removes a keep.

## Builder card

Every sprint below repeats this card so a fresh agent can execute that section alone.

- Branch from current `main`: `cursor/dr-<n>-<short-name>-<suffix>` using the suffix your own instructions require. One sprint, one PR, against `main`.
- Do not edit `functions/tests/scalar-search.test.ts` seed-7 rows. Do not retarget `createSeededRng`.
- Do not merge, release, tag, publish, force-push, rebase, amend, or pass `--no-verify`.
- Do not set `RELEASES_ENABLED`. A changeset may be added; do not merge the release PR that changesets opens.
- Before opening the PR, from the repo root, all of these exit 0:
  - `repo-tools check . --docs=docs/Architecture` with `@danielsimonjr/repo-tools` **2.2.4** (the pin `REPO_TOOLS_VERSION` in `.github/workflows/ci.yml`). Do not bump the pin. If a Verification cell fails, set it to the number the checker prints. Do not hand-edit `FILE_INVENTORY.md`, `dependency-graph.json`, or the other generated architecture files.
  - `bun run typecheck` (0 errors).
  - `bun run lint`.
  - `node tools/test/check-export-lock.mjs` with no `--write`, unless the section says the lock changes. It does not, for DR-1 through DR-12.
  - The tests named in the section, then `bun run test` if the section's diff touches a package that other packages import.
- Public API: no export added, removed, or renamed. `node tools/test/check-export-lock.mjs` stays green without `--write`. A signature-only change still has to pass `node tools/test/consumer-typecheck.mjs --skip-build` on Node 22 after `bun run build` when the section touches published `.d.ts`.
- Docs: a changeset for each **published** package whose `package.json` or runtime behavior changed (patch). A `CHANGELOG.md` bullet in the repo style. `docs/Architecture/OVERVIEW.md` on `30afc17b` does **not** state an npm dependency count. Do not invent one in Key Metrics or in a Verification table. DR-12 is the sprint that writes the remaining-dependency sentence. If `repo-tools check` fails because line counts moved, fix only the cells it names.
- Bundle: after `bun run build`, `node tools/test/check-bundle-budget.mjs`. If the budget fails because this PR's package shrank or grew, refresh with `--write` only for the entries this PR moved, and say so in the PR body.
- Commit with Conventional Commits. Push with `git push -u origin <branch>`. Open the PR with the repository's PR tool. Do not merge it.

## Inventory

### `escape-latex@1.2.0` — rebuild

|          |                                                                                                                                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT. Unpacked size **7,474** bytes. No dependencies.                                                                                                                                                                                                                                                        |
| Declared | `functions/package.json` only.                                                                                                                                                                                                                                                                              |
| Used     | `expression/src/utils/latex.ts` default import `escapeLatexLib`. `escapeLatex` calls it with `{ preserveFormatting: true }`. `toSymbol` and `expression/src/node/ConstantNode.ts` call the local `escapeLatex`. `expression/package.json` does **not** declare the package; Bun hoists it from `functions`. |
| API used | One function. Second argument `{ preserveFormatting: true }`. `escapeMapFn` is never passed.                                                                                                                                                                                                                |
| Risk     | Low. Wrong escape text changes every LaTeX export.                                                                                                                                                                                                                                                          |

`escape-latex` 1.2.0 walks the string and replaces the first matching key. With `preserveFormatting: true` the map is the specials plus the formatting keys. Insertion order, which is the order `Object.keys` yields:

| Input          | Replacement          |
| -------------- | -------------------- |
| `{`            | `\{`                 |
| `}`            | `\}`                 |
| `\`            | `\textbackslash{}`   |
| `#`            | `\#`                 |
| `$`            | `\$`                 |
| `%`            | `\%`                 |
| `&`            | `\&`                 |
| `^`            | `\textasciicircum{}` |
| `_`            | `\_`                 |
| `~`            | `\textasciitilde{}`  |
| U+2013 en dash | `\--`                |
| U+2014 em dash | `\---`               |
| space          | `~`                  |
| tab            | `\qquad{}`           |
| `\r\n`         | `\newline{}`         |
| `\n`           | `\newline{}`         |

A bare `\r` is not a key and is copied through. `String(str)` is applied first, so a non-string is coerced. The implementation is not a single global regex: a formatting key of length 2 (`\r\n`) is tried as a prefix.

### `javascript-natural-sort@0.7.1` — rebuild

|          |                                                                                                                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT (Jim Palmer; header of `naturalSort.js`). Registry `unpackedSize` is absent. The package is that one file.                                                                                                                                            |
| Declared | `functions/package.json`.                                                                                                                                                                                                                                 |
| Used     | `functions/src/relational/compareNatural.ts` (type-name tie-break, string compare, `keysX.sort(naturalSort)` / `keysY.sort`). `functions/src/typed/relational.ts` (the same tie-break and string compare). `functions/types/modules.d.ts` ambient module. |
| API used | Default export, a comparator `(a, b) => -1 \| 0 \| 1`. The `naturalSort.insensitive` flag is never set, so comparison stays case-sensitive.                                                                                                               |
| Risk     | Medium for sort order, low for size. `compareNatural` is public. A one-character difference changes `sort` of strings.                                                                                                                                    |

Quirks the port must keep, from 0.7.1 `naturalSort.js`:

- Coerce with `'' + value`, then trim leading and trailing spaces (`/(^[ ]*|[ ]*$)/g`). Tabs are not trimmed.
- Chunk on `/(^([+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?)?$|^0x[0-9a-f]+$|\d+)/gi`.
- A chunk that starts with `0` stays a string (`ore = /^0/`), so `'02'` and `'2'` do not compare as the numbers 2 and 2. The file's own comment: `'02' < 2` is not the same relation as `'02' < '2'`.
- A numeric chunk compares less than a non-numeric chunk (`isNaN` mismatch: the NaN side is greater).
- Hex: a full string matching `/^0x[0-9a-f]+$/i` compares as `parseInt(x, 16)` before chunking.
- Dates: when the pattern `dre` matches and `Date.parse` is used, those values compare as timestamps. Both sides have to take that path (`yD` is computed only when `xD` is set, except for hex).
- `null` becomes `'null'`. `undefined` becomes `'undefined'`.
- Equal chunks through the whole string return `0`.

### `tiny-emitter@2.1.0` — rebuild

|          |                                                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT. Unpacked size **77,178** bytes (package includes extra files). The runtime is `index.js`, the `E` constructor below.                                                        |
| Declared | `functions/package.json`.                                                                                                                                                        |
| Used     | `functions/src/utils/emitter.ts` `mixin`. The only production caller found is `functions/src/core/create.ts`, which mixes `on` / `off` / `once` / `emit` onto the math instance. |
| API used | `new Emitter()`, then `on`, `off`, `once`, `emit` bound onto the object. The `.e` map must stay off the public object. `TinyEmitter` named export is unused.                     |
| Risk     | Medium. `once`/`off` identity bugs leak listeners for the life of a math instance.                                                                                               |

Semantics of 2.1.0 `index.js` (this is the contract):

- `on(name, callback, ctx)` appends `{ fn: callback, ctx }` and returns the emitter. The same callback may be registered twice; both run.
- `once(name, callback, ctx)` registers a wrapper. The wrapper's `._` property is the original callback. The wrapper calls `off(name, wrapper)` and then `callback.apply(ctx, arguments)`.
- `off(name, callback)` drops a listener whose `fn` is `callback` **or** whose `fn._` is `callback`. So `off(name, original)` removes a `once` wrapper. If nothing remains, the key is `delete`d. If `callback` is omitted, the local `liveEvents` array stays empty and the key is deleted: `off(name)` removes every listener for `name`. `off()` with no name deletes `e[undefined]`, not every key.
- `emit(name, ...args)` copies the listener array first, then calls `fn.apply(ctx, args)`. A listener that removes itself or a later listener does not skip or repeat because of that mutation. Return value is the emitter; `mixin` types the bound methods as returning `void`. Keep that public type. Do not start returning the emitter from `mixin`'s methods.
- `ctx` omitted: the library is sloppy-mode, so `apply(undefined)` becomes `this === globalThis`. MathTS modules are strict. The port uses strict `apply`: omitted `ctx` means `this` is `undefined` inside the listener. Callers in this repo do not pass `ctx` and do not read `this`. A parity test must assert `this` is `undefined`, and it must not assert `globalThis`.

### `seedrandom@3.0.5` — rebuild

|          |                                                                                                                                                                                                                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT (David Bau). Unpacked size **374,034** bytes. Most of that is alternate PRNGs (`xor128`, `xorwow`, `xorshift7`, `xor4096`, `tychei`, ARC4) and the Node/browser entropy pools. No dependencies.                                                                                                                                                                                          |
| Declared | `functions/package.json`. Ambient types in `functions/types/modules.d.ts`.                                                                                                                                                                                                                                                                                                                   |
| Used     | `functions/src/probability/util/seededRNG.ts` `createRng`: `seedrandom(Date.now())` once for the null-seed singleton, and `seedrandom(String(seed))` otherwise. `functions/src/typed/probability.ts` `makeRng`: `seedrandom()` when `seed === null`, else `seedrandom(String(seed))`. `functions/src/numeric/global-optimizers.ts` only mentions it in a comment; the code uses `createRng`. |
| API used | The default call. No options object, no `Math.seedrandom`, no named PRNG. The default algorithm in 3.0.5 is **Alea**.                                                                                                                                                                                                                                                                        |
| Risk     | High for reproducibility, low for size. Any bit difference changes `random`, `randomInt`, `pickRandom`, and seeded optimizers. It does **not** feed `searchScalars`.                                                                                                                                                                                                                         |

`createSeededRng` in `core/src/numeric/rng.ts` is a different generator. `searchScalars` uses that one. The seed-7 front in `functions/tests/scalar-search.test.ts` is pinned to it. DR-4 does not import Alea from `core`, and it does not change `core`.

Port `lib/alea.js` from the 3.0.5 tarball (MIT) as a function `(seed: string) => () => number`. Do not port ARC4 or the entropy autoseed. The two null-seed call sites stay time-based and unreproducible: `seededRNG.ts` keeps one `Date.now()` singleton; `makeRng(null)` keeps one unreproducible generator per call. Do not silently switch null seeds onto Alea of `''`.

Parity, before deleting the dependency: for seeds `''`, `'0'`, `'7'`, `'hello'`, and `'MathTS'`, the first 32 outputs are `Object.is`-equal to `seedrandom@3.0.5`. Inline those 160 numbers in the test in the same PR, then remove the import. A later reader must not need the package installed.

### `fraction.js@5.3.4` — rebuild (delete)

|          |                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT. Unpacked size **147,709** bytes.                                                                                                                                                                                                                                                                                                           |
| Declared | `functions/package.json` `dependencies`.                                                                                                                                                                                                                                                                                                        |
| Used     | Type positions only. `functions/src/types.ts` exports `type Fraction = import('fraction.js').default`. `functions/types/index.d.ts` imports `{ Fraction }`. No `new`, no value import, under `functions/src` or tests. Runtime fractions are `core`'s `Fraction` (`core/src/types/fraction.ts`), re-exported from `@danielsimonjr/mathts-core`. |
| API used | The type name. None of the fraction.js methods.                                                                                                                                                                                                                                                                                                 |
| Risk     | Low at runtime (it is not called). Medium if a published `.d.ts` names the module `fraction.js` and a consumer imports that type. `consumer-typecheck` is the check.                                                                                                                                                                            |

Reason: the implementation already lives in `core`. Keeping a 148 KB runtime dependency for a type query is an accident of the mathjs port.

### `bignumber.js@11.1.5` — rebuild (delete)

|          |                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT (Mike Mclaughlin). Unpacked size **500,493** bytes.                                                                                                                                                                |
| Declared | `functions/package.json`.                                                                                                                                                                                              |
| Used     | `import type BigNumber from 'bignumber.js'` in `functions/src/matrix/det.ts`, `diag.ts`, `eigs.ts`, `eigs/complexEigs.ts`, `eigs/realSymmetric.ts`, `inv.ts`, `pinv.ts`, `sqrtm.ts`. No value import.                  |
| API used | The type. The matrix files were written against the bignumber.js instance shape. The value type MathTS actually constructs is either `core` `BigNumber` or the local `Decimal` (DR-9). Those two are not bignumber.js. |
| Risk     | Low at runtime. A wrong structural type makes `typecheck` fail, which is the point of doing this in its own PR before DR-9.                                                                                            |

Reason: nothing calls the library. A local structural type of the members those files read replaces the import. Do not switch the files onto `decimal.js` in this sprint.

### `complex.js@2.4.3` — rebuild

|          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT (Robert Eisele). Unpacked size **143,858** bytes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Declared | `functions/package.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Used     | Value: `functions/src/type/complex/Complex.ts` imports `Complex as ComplexClass` and describes a mathjs-shaped constructor (`fromPolar`, `fromJSON`, `compare`, `ZERO`, `ONE`, `I`, `PI`, `E`, `INFINITY`, `NAN`, `EPSILON`, callable and `new`). Type: `functions/src/types.ts`; `import type { Complex }` in `det.ts`, `eigs.ts`, `eigs/complexEigs.ts`, `inv.ts`, `pinv.ts`, `sqrtm.ts`. `core/src/types/complex.ts` is a separate class (`re`, `im`, methods on the core type). `functions/src/signal/zpk2tf.ts` and `freqz.ts` already comment that injected `Complex` is the core class, not the complex.js factory. |
| API used | The class as the factory's underlying implementation, plus the type in the matrix factories.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Risk     | High. `acosh`, `sqrt`, branch cuts, and formatting are user-visible. `core` `Complex` is the public numeric type; this factory is the mathjs-compat shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Reason: two complex implementations is how the dependency survived. DR-8 makes the factory delegate to `core` `Complex` where the methods match, and implements the factory-only statics (`fromJSON`, constants) in `functions` without `complex.js`. Where a method disagrees, the parity test names the complex.js 2.4.3 result and the PR keeps that result. Do not change `core` `Complex` method results in this sprint. If a core method is wrong relative to complex.js, file the difference in the PR body and keep the previous public result.

### `decimal.js@10.6.0` — rebuild

|          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT (Mike Mclaughlin). Unpacked size **284,347** bytes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Declared | `functions/package.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Used     | Value imports of `{ Decimal }` from `decimal.js`: `functions/src/type/bignumber/BigNumber.ts` (the mathjs BigNumber factory; `Decimal.Value`, `Decimal.Config`), `functions/src/arithmetic/ceil.ts`, `floor.ts`, `functions/src/trigonometry/acot.ts`, `acoth.ts`, `acsc.ts`, `acsch.ts`, `asec.ts`, `asech.ts`. Type-only: `functions/src/type/unit/physicalConstants.ts`. `functions/src/types.ts` already aliases `BigNumber` to `import('./type/local/Decimal.js').Decimal`. `functions/src/type/local/Decimal.ts` is a BigInt decimal that the header says replaces decimal.js, and it is not what those value imports construct. Tests that import `decimal.js` directly: `functions/tests/s2r-clones-batch4-oracle.test.ts` (`max` / `min` oracles). Other tests mention the decimal.js API in comments (`plus` / `minus` / `cmp`) because `core` `BigNumber` does not have that API. |
| API used | Constructor, `Decimal.clone` / config if `BigNumber.config` forwards it, and the methods the trig and ceil/floor factories call on instances. Read those files at the start of DR-9 and list every method in the PR. Do not port the whole of decimal.js.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Risk     | High. Precision, rounding mode, and non-finite values change numeric results. `core` `BigNumber` (96 methods, bigint) is a different type and must not become the factory's implementation in this sprint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Reason: `Decimal.ts` exists for this replacement. DR-9 wires it and deletes the dependency. Oracles against decimal.js 10.6.0 are written first and then inlined.

### `@danielsimonjr/typed-function@5.0.0-alpha.4` — vendor

|          |                                                                                                                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT. Unpacked size **2,343,074** bytes.                                                                                                                                                                                                                                                                                                                                                     |
| Declared | npm alias `typed-function` in root `dependencies`, `core/package.json`, `functions/package.json`, and `packages/typed-function/package.json`. The workspace package `@danielsimonjr/mathts-typed-function` re-exports `typed` and `create` and then adds MathTS helpers (`TYPED_FUNCTION_TYPE` and the rest of `packages/typed-function/src/index.ts`). It does not contain the dispatcher. |
| Used     | `core/src/typed/mathts-typed.ts` (`typed`, `create`, and type imports). `functions/src/core/create.ts`, `functions/src/core/function/typed.ts`, `functions/src/utils/optimizeCallback.ts`. Ambient shim `core/src/typed-function.d.ts` (consumers of the published package do not see this shim; `consumer-typecheck` uses the published `.d.ts`).                                          |
| API used | `typed`, `create`, signature maps, `referTo`, `referToSelf` if `create.ts` uses them, and the `TypedFunction` type. Read the import lists at the start of DR-10 and vendor the files that export those names.                                                                                                                                                                               |
| Risk     | Highest of the runtime set. Every factory dispatches through it. A behavior change fails thousands of tests. The unpacked tarball is large because of bundles and docs; vendor the source the entry point loads, not a second copy of `dist`.                                                                                                                                               |

Reason: the repo already wraps this fork, but the implementation is still downloaded. Vendoring removes the npm edge. Publishing a new `@danielsimonjr/typed-function` is out of scope. After DR-10 the workspace package **is** the implementation.

### `@danielsimonjr/workerpool@10.2.2` — vendor

|          |                                                                                                                                                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | Apache-2.0. Unpacked size **9,575,706** bytes.                                                                                                                                                                                                                                                                                            |
| Declared | npm alias `workerpool` in root `dependencies` and `packages/workerpool/package.json`. `parallel` depends on `@danielsimonjr/mathts-workerpool` (workspace).                                                                                                                                                                               |
| Used     | `packages/workerpool/src/index.ts` imports `pool as createPool`, `Pool`, `Transfer`, `PoolOptions`, `ExecOptions`, `PoolStats`. `packages/workerpool/src/worker.ts` imports `worker` and `Transfer`. `packages/workerpool/scripts/postbuild.mjs` exists so the emitted `.d.ts` does not keep a bare `from 'workerpool'` that drops types. |
| API used | Those exports only. The MathTS wrapper adds chunking, FFT, and numerics on top.                                                                                                                                                                                                                                                           |
| Risk     | High for workers, timeouts, and `Transfer`. The security invariant is `parallel/src/WorkerPool.ts` `timeoutMs` and hung-worker replacement. DR-11 must not edit that plumbing. The unpacked size is not a reason to rewrite the pool.                                                                                                     |

Reason: same as typed-function. The wrapper is in-repo; the pool is not. Apache-2.0 attribution has to travel with the files (see DR-11).

### `yaml@2.9.0` — keep

|                   |                                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License           | ISC. Unpacked size **685,953** bytes. Declared `^2.3.0` by `workbook/package.json`.                                                                                        |
| Used              | `workbook/src/yaml-safe.ts` `parse` with `{ schema: 'core', merge: false, logLevel: 'silent' }`, plus a prototype-pollution walk. `workbook/src/parser.ts` `stringify`.    |
| API used          | `parse` options `schema`, `merge`, `logLevel`. `stringify` for round-trip of a workbook.                                                                                   |
| Risk of replacing | A YAML 1.2 parser written for this repo will get anchors, tags, or merge keys wrong. The hardened options are a security boundary (`workbook` tests cover pollution keys). |

Reason to keep: one maintained parser, already shared, ISC, and the options we need are a small part of a spec that is expensive to reimplement. DR-5 moves `js-yaml`'s single emitter onto this package. No sprint deletes `yaml`.

### `js-yaml@5.5.0` — rebuild the call

|          |                                                                                                                                                                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License  | MIT. Unpacked size **1,626,579** bytes. Dependency: `argparse` (locked transitively; license Python-2.0 / PSF).                                                                                                                                                                                |
| Declared | `tools/create-dependency-graph/package.json` `dependencies`. Root `devDependencies`. Root `overrides` `"js-yaml": "^5.5.0"`. `tools/create-dependency-graph/package-lock.json` is a stale separate lock (it still resolves js-yaml 4.3.2) and is not `bun.lock`.                               |
| Used     | `tools/create-dependency-graph/create-dependency-graph.ts` imports `{ dump as yamlDump }`. `tools/create-dependency-graph/check-duplicates.mjs` only mentions the override in a comment (npx walks overrides and dies with `EOVERRIDE`).                                                       |
| API used | `dump` of the dependency-graph document. No `load`, no schema, no the CLI.                                                                                                                                                                                                                     |
| Risk     | Medium for generated YAML byte equality. `docs:deps` output is committed. A stringify change that is still valid YAML can fail `repo-tools check` or a byte-compare test. The sprint must regenerate and commit the generated docs if the bytes change, and the PR body must say they changed. |

Reason: the repo already depends on `yaml` for the same job. `js-yaml` plus `argparse` is the large one.

### Dev tooling — keep (DR-12 records it, removes nothing that is still imported)

Versions below are the ranges in `package.json`. Locked versions move; do not pin them in this plan as if they were the runtime set.

| Package                                                                | Where                                                                                                                                     | License of current latest matching the range (registry, not a promise of the lock) | Role                                        | Why it stays                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`                                                           | every TS package `^7.0.2`; `tools/chunking-for-files` `^5.6.2`; `tools/compress-for-context` and `tools/create-dependency-graph` `^5.3.0` | Apache-2.0                                                                         | typecheck, `tsc` `.d.ts` emit               | The compiler. Three tool packages are not on TypeScript 7. DR-12 may align those three ranges with the root only if `bun run` of those tools still passes. That is the only dev-tool edit allowed.                                                                                                                                                                                                                               |
| `vitest`                                                               | workspace packages `^5.0.0`, root `^5.0.5`                                                                                                | MIT                                                                                | test runner                                 | Replacing the runner is a separate project.                                                                                                                                                                                                                                                                                                                                                                                      |
| `@vitest/browser`, `@vitest/browser-playwright`, `@vitest/coverage-v8` | root                                                                                                                                      | MIT                                                                                | browser tests, coverage                     | `npm run test:browser` and `test:coverage`.                                                                                                                                                                                                                                                                                                                                                                                      |
| `playwright`                                                           | root                                                                                                                                      | Apache-2.0                                                                         | browser host                                | CI and local WebGPU tests.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tsdown`                                                               | every bundled package `^0.23.0`                                                                                                           | MIT                                                                                | ESM bundle                                  | The build. `dts: false` stays required.                                                                                                                                                                                                                                                                                                                                                                                          |
| `turbo`                                                                | root `^2.10.12`                                                                                                                           | MIT                                                                                | task graph                                  | The monorepo runner.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `oxlint`                                                               | root `^1.82.0`                                                                                                                            | MIT                                                                                | lint, warnings are failures                 | The linter.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `prettier`                                                             | root `^3.9.8`                                                                                                                             | MIT                                                                                | format                                      | The formatter, including generated docs.                                                                                                                                                                                                                                                                                                                                                                                         |
| `husky`                                                                | root `^9.0.0`                                                                                                                             | MIT                                                                                | git hooks                                   | Pre-commit.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `lint-staged`                                                          | root `^17.4.1`                                                                                                                            | MIT                                                                                | staged lint/format                          | Pre-commit.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `@changesets/cli`                                                      | root `^3.0.1`                                                                                                                             | MIT                                                                                | version PRs                                 | Release flow. Do not publish from a sprint.                                                                                                                                                                                                                                                                                                                                                                                      |
| `esbuild`                                                              | root `^0.28.1`                                                                                                                            | MIT                                                                                | `tools/benchmark/wasm/run-node.mjs` bundles | Documented: without the root entry the lock has no esbuild and the bench fails.                                                                                                                                                                                                                                                                                                                                                  |
| `fast-check`                                                           | `core`, `expression`, root, all `^4.9.0`                                                                                                  | MIT                                                                                | property tests                              | Tests only. Call sites: `core/tests/collection-properties.test.ts`, `core/tests/object-properties.test.ts`, `core/tests/helpers/equivalence.ts`, `expression/tests/security/parse-fuzz.test.ts`, `functions/tests/property-invariants.test.ts`, `functions/tests/dedup-bucketB-equivalence.test.ts`, `functions/tests/dedup-bucketB-slice2-equivalence.test.ts`, `functions/tests/dedup-bucketC-arithmetic-equivalence.test.ts`. |
| `assemblyscript`, `@assemblyscript/loader`                             | `assembly` `^0.28.20`                                                                                                                     | Apache-2.0                                                                         | the sole WASM backend                       | Removing them removes the WASM tier. Loader is dev: the runtime instantiates the shipped `.wasm` through MathTS's own loader.                                                                                                                                                                                                                                                                                                    |
| `@types/node`                                                          | almost every package                                                                                                                      | MIT                                                                                | Node typings                                | Types only.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `@types/bun`                                                           | root                                                                                                                                      | MIT                                                                                | Bun typings                                 | Types only.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `@webgpu/types`                                                        | dev of `functions`, `gpu`, `matrix`; **peer** of `gpu` and `matrix`                                                                       | BSD-3-Clause                                                                       | WebGPU typings                              | Not runtime code. Peers stay so consumers can type `GPUDevice`.                                                                                                                                                                                                                                                                                                                                                                  |
| `@xmldom/xmldom`                                                       | dev of `plot` and `workbook` `^0.9.12`                                                                                                    | MIT                                                                                | `DOMParser` in tests                        | `plot/tests/svg-attr-escape.test.ts`, `workbook/tests/chart-markup.test.ts`, `workbook/tests/markup-escape.test.ts`. Not on the published entry. A homegrown XML parser for three test files is not a dependency reduction.                                                                                                                                                                                                      |
| `@yao-pkg/pkg`                                                         | dev of the three `tools/*` packages that declare it                                                                                       | MIT                                                                                | optional single-file tool builds            | Not used by the published packages.                                                                                                                                                                                                                                                                                                                                                                                              |

Root `overrides` that are not direct dependencies: `shell-quote` `^1.11.0`, `source-map-js` `^1.2.2`, and today `js-yaml` `^5.5.0`. DR-5 removes the `js-yaml` override after nothing depends on it. The other two stay. They are security pins, not sprints.

## Sprint order

Smallest behavior surface first. Number libraries after the four tiny ports. typed-function and workerpool last. DR-12 is the keep record. DR-13 deletes this plan.

| Sprint | Package                   | Decision                     | PR shape                                                                          |
| ------ | ------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| DR-1   | `escape-latex`            | Rebuild                      | One helper, delete the dep                                                        |
| DR-2   | `javascript-natural-sort` | Rebuild                      | One comparator, delete the dep                                                    |
| DR-3   | `tiny-emitter`            | Rebuild                      | `mixin` emitter, delete the dep                                                   |
| DR-4   | `seedrandom`              | Rebuild Alea only            | Two call sites, delete the dep                                                    |
| DR-5   | `js-yaml`                 | Switch `dump` to `yaml`      | Tooling, delete js-yaml                                                           |
| DR-6   | `fraction.js`             | Delete type-only dep         | Types point at `core`                                                             |
| DR-7   | `bignumber.js`            | Delete type-only dep         | Structural type                                                                   |
| DR-8   | `complex.js`              | Rebuild factory              | Parity, then delete                                                               |
| DR-9   | `decimal.js`              | Rebuild onto local `Decimal` | Parity, then delete                                                               |
| DR-10  | `typed-function`          | Vendor                       | Copy source, delete alias                                                         |
| DR-11  | `workerpool`              | Vendor                       | Copy source, delete alias                                                         |
| DR-12  | dev tooling and `yaml`    | Keep                         | One sentence in OVERVIEW, no removals except a package DR-1–DR-11 already dropped |
| DR-13  | this file                 | Delete the plan              | Docs only                                                                         |

---

## DR-1 — Rebuild `escapeLatex`

**Decision.** Rebuild. `escape-latex` is 7,474 bytes, MIT, one function, and it is declared on the wrong package (`functions` declares it, `expression` imports it).

**Scope.** Replace the default import in `expression/src/utils/latex.ts` with a local function that matches 1.2.0 when called as `escapeLatexLib(string, { preserveFormatting: true })`. Delete `escape-latex` from `functions/package.json`. Run `bun install` so `bun.lock` drops it. Do not add a dependency.

**Files.**

- `expression/src/utils/latex.ts` — implementation and the existing `escapeLatex` wrapper. The wrapper keeps the name, the argument, and `{ preserveFormatting: true }`.
- `expression/tests/utils-latex.test.ts` — extend. Existing cases: `'a_b'` is escaped, `'hello123'` is unchanged, `'50%'` is escaped.
- `functions/package.json`, `bun.lock`.
- `.changeset/` patch for `@danielsimonjr/mathts-expression` and `@danielsimonjr/mathts-functions` (the dependency leaves `functions`).
- `CHANGELOG.md` one bullet.

**Contract.** For `{ preserveFormatting: true }`, every key in the DR inventory table is replaced, including both dashes, space, tab, `\n`, and `\r\n`. A string that contains every special once, in the order `{}\#$%&^_~` plus en dash, em dash, space, tab, `\r\n`, `\n`, round-trips through the table. Bare `\r` stays `\r`. `String()` coercion: `escapeLatex` of a number is the escaped decimal digits (no specials). Order of replacement follows the table, so `\r\n` is one newline token and not `\r` plus `\newline{}`. Do not implement `escapeMapFn`. Do not implement `preserveFormatting: false` unless a call site passes it; none does. If you implement only the `true` map, the public `escapeLatex` still passes `true`.

**Tests.** A table test with one `it` per row of the specials table, plus one string that contains all of them. Keep the three existing assertions. The test must not import `escape-latex`. Generate the expected strings from the table in the test file so the package is not required.

**Public API.** `escapeLatex` and `toSymbol` stay. Export lock unchanged.

**Bundle / perf.** `expression` bundle must not contain the string `escape-latex`. No perf gate: the function is linear in the string and runs on symbols, not on arrays.

**Docs.** Changeset and changelog. No OVERVIEW dependency count (there is none). If Verification cells move, set them from `repo-tools check`.

**Builder card.** Follow the card at the top. In particular: do not touch `functions/tests/scalar-search.test.ts`; do not merge.

**Done.** `escape-latex` is absent from every `package.json` and from `bun.lock`. `rg escape-latex` finds only changelog and this plan. `bun run typecheck`, `bun run lint`, `node tools/test/check-export-lock.mjs`, `repo-tools check . --docs=docs/Architecture`, and `bunx vitest run expression/tests/utils-latex.test.ts` exit 0. PR opened, not merged.

---

## DR-2 — Rebuild natural sort

**Decision.** Rebuild. One MIT file, used as a comparator in two relational modules.

**Scope.** Add `naturalSort` under `functions/src/relational/` (a sibling of `compareNatural.ts`, not a new public export). Both call sites import it from that module with a `.js` specifier. Delete `javascript-natural-sort` from `functions/package.json` and the ambient module in `functions/types/modules.d.ts` if nothing else references it. Update `bun.lock`.

**Files.**

- New `functions/src/relational/natural-sort.ts`.
- `functions/src/relational/compareNatural.ts`, `functions/src/typed/relational.ts`.
- `functions/types/modules.d.ts`.
- `functions/package.json`, `bun.lock`.
- New `functions/tests/natural-sort.test.ts`.
- Existing `functions/tests/typed-relational.test.ts` already says javascript-natural-sort orders `'10'` after `'2'`. Keep that assertion, aimed at the local function.
- Changeset patch `@danielsimonjr/mathts-functions`. `CHANGELOG.md`.

**Contract.** Match 0.7.1 with `insensitive` unset. Required cases:

- `naturalSort('2', '10') < 0` and `naturalSort('10', '2') > 0`.
- `naturalSort('a2', 'a10') < 0`.
- Leading zero: `naturalSort('02', '2')` is not `0`. Record the actual 0.7.1 sign in the test name.
- Case: `naturalSort('A', 'a')` follows code-unit order, not a case fold.
- Space trim: `naturalSort(' a', 'a') === 0`. A tab is not trimmed.
- Hex: `naturalSort('0x10', '0x2') > 0` because 16 > 2.
- Number-versus-string chunk: a numeric chunk sorts before a non-numeric chunk (`naturalSort('2', 'a') < 0`).
- `naturalSort(null, 'null') === 0` and `naturalSort(undefined, 'undefined') === 0`.
- Empty strings and two empty strings return `0`.
- `Array.prototype.sort` stability is the engine's. The comparator itself returns only `-1`, `0`, or `1`.

Do not add `insensitive`. Do not locale-compare.

**Tests.** The cases above in `functions/tests/natural-sort.test.ts`. One property: for 50 pairs of strings drawn from digits, letters, spaces, and a `'0'` prefix, the comparator is antisymmetric (`sgn(cmp(a,b)) === -sgn(cmp(b,a))`) and `cmp(a,a) === 0`.

**Public API.** `compareNatural` stays. `naturalSort` is not added to `functions/src/index.ts`. Export lock unchanged.

**Bundle / perf.** No array benchmark. The comparator is the same shape as the library.

**Docs.** Changeset and changelog. No new OVERVIEW count.

**Builder card.** As in the top card. Do not touch the seed-7 test. Do not merge.

**Done.** `javascript-natural-sort` is gone from `package.json` and `bun.lock`. `rg javascript-natural-sort` is changelog, this plan, and comments you rewrote. Gates in the card exit 0, plus `bunx vitest run functions/tests/natural-sort.test.ts functions/tests/typed-relational.test.ts`. PR opened, not merged.

---

## DR-3 — Rebuild the emitter

**Decision.** Rebuild. `mixin` uses four methods. The 77,178 byte unpack is the package, not the algorithm.

**Scope.** Move the 2.1.0 behavior into `functions/src/utils/emitter.ts`. Delete the import and the `tiny-emitter` dependency. Keep `EmitterMixin` and `mixin`'s signature.

**Files.**

- `functions/src/utils/emitter.ts`.
- New `functions/tests/emitter.test.ts`.
- `functions/package.json`, `bun.lock`.
- Changeset patch `@danielsimonjr/mathts-functions`. `CHANGELOG.md`.
- Do not change `functions/src/core/create.ts` unless a type breaks. Behavior of `math.on` stays.

**Contract.**

- `on` allows two registrations of one function; `emit` runs both, in registration order.
- `emit` snapshots the list. A listener that calls `off` on the next listener still lets that next listener run for this `emit`. A listener that `on`s another listener during `emit` does not run the new one until the next `emit`.
- `once` runs one time. `off(name, originalCallback)` before the event removes the wrapper (`fn._ === original`). `off(name, wrapper)` also removes it.
- `once` passes arguments through. `this` inside the callback is the `ctx` argument. Omitted `ctx`: `this` is `undefined` (strict). Do not copy sloppy-mode `this === globalThis`.
- `off(name)` removes every listener for `name` and later `emit` does not call them.
- `off(name, fn)` that matches nothing does not throw.
- `emit` of an unknown name does not throw.
- The listener map is not a property of the object `mixin` returns. `'e' in mixin({})` is false.
- Bound methods do not return the emitter. Existing type `void` stays.
- Two `mixin` objects do not share listeners.

**Tests.** One `it` per bullet. Use a counter and a `this` probe (`function` not arrow).

**Public API.** The math instance still has `on`, `off`, `once`, `emit`. Export lock unchanged. `mixin` stays a non-export of the package index unless it already is; do not add it.

**Bundle / perf.** None beyond the bundle budget. This is four array operations.

**Docs.** Changeset and changelog.

**Builder card.** As in the top card. Do not touch the seed-7 test. Do not merge.

**Done.** `tiny-emitter` is gone from `package.json` and `bun.lock`. Gates exit 0, plus `bunx vitest run functions/tests/emitter.test.ts`. PR opened, not merged.

---

## DR-4 — Rebuild Alea for the two `seedrandom` call sites

**Decision.** Rebuild the default Alea generator only. Do not vendor the 374,034 byte package.

**Scope.** Add an internal `alea(seed: string): () => number` and point `createRng` and `makeRng` at it. Delete `seedrandom` from `functions/package.json` and the ambient module. Leave `core/src/numeric/rng.ts` and `functions/tests/scalar-search.test.ts` byte-for-byte unchanged. Prove that with `git diff` before opening the PR.

**Files.**

- New `functions/src/probability/util/alea.ts` (port of `lib/alea.js` from seedrandom 3.0.5, MIT, with the copyright notice in the file header).
- `functions/src/probability/util/seededRNG.ts`.
- `functions/src/typed/probability.ts` (`makeRng` only).
- `functions/types/modules.d.ts`.
- `functions/package.json`, `bun.lock`.
- New `functions/tests/alea-parity.test.ts`.
- Changeset patch `@danielsimonjr/mathts-functions`. `CHANGELOG.md`. State that `random` / `randomInt` / `pickRandom` seeds match seedrandom 3.0.5 Alea, and that null seeds stay unreproducible.

**Contract.**

- `alea('7')` first 32 values are `Object.is`-equal to `seedrandom('7')` from 3.0.5. Same for `''`, `'0'`, `'hello'`, `'MathTS'`.
- Return values are in `[0, 1)`.
- The same seed returns the same sequence from two fresh generators. Calling the first generator does not advance the second.
- `createRng('7')` matches `alea('7')`. `createRng(7)` matches `alea('7')` because the old code did `String(seed)`.
- `createRng(null)` still uses one process-lifetime generator seeded from `Date.now()` at module init. Do not call `alea` for that path. A test can only assert it returns a number in `[0, 1)` and that two `createRng(null)` calls share state (the second call's first draw is not a restart). Do not snapshot `Date.now()`.
- `makeRng(null)` still constructs an unreproducible generator (old code called `seedrandom()` with no seed, which mixes entropy). Do not replace that with `alea('')`. A test asserts it returns numbers in `[0, 1)` and that two `makeRng(null)` sequences are not required to match. Do not assert they differ; entropy can theoretically collide. Document that null is not a golden seed.
- No `Math.seedrandom`. No options argument. No `xor4096`.

**Tests.** Golden vectors inlined in `alea-parity.test.ts`. Build them locally against 3.0.5 before deleting the package, paste the numbers, then remove the import in the same commit. Do not leave `seedrandom` as a devDependency.

**Public API.** `createRng` stays. Export lock unchanged. Seeded `random` results for a string seed stay.

**Bundle / perf.** No benchmark. Alea is a few arithmetic operations per draw. The bundle must not contain `seedrandom`.

**Docs.** Changeset and changelog. Do not document a new RNG for `searchScalars`.

**Builder card.** As in the top card. `git diff -- functions/tests/scalar-search.test.ts core/src/numeric/rng.ts` is empty. Do not merge.

**Done.** `seedrandom` is gone from `package.json` and `bun.lock`. Gates exit 0, plus `bunx vitest run functions/tests/alea-parity.test.ts functions/tests/scalar-search.test.ts`. The scalar-search run is the proof the pin still passes, not a license to edit it. PR opened, not merged.

---

## DR-5 — Replace `js-yaml` `dump` with `yaml`

**Decision.** Rebuild the call. Keep `yaml` (see inventory). Delete `js-yaml`.

**Scope.** `create-dependency-graph.ts` imports `stringify` from `yaml` instead of `dump` from `js-yaml`. Add `yaml` to `tools/create-dependency-graph/package.json` at the same range workbook uses (`^2.3.0`). Remove `js-yaml` from that package, from the root `devDependencies`, and from root `overrides`. Update the comment in `tools/create-dependency-graph/check-duplicates.mjs` so it no longer says the override is `js-yaml`. Do not revive `tools/create-dependency-graph/package-lock.json`; if that file is unused by Bun, leave it, but do not let it be the only lock that still requires js-yaml 4. If `bun install` does not read it, say so in the PR. `argparse` must disappear from `bun.lock` if nothing else depends on it. Check with `rg '"argparse"' bun.lock`.

**Files.**

- `tools/create-dependency-graph/create-dependency-graph.ts`.
- `tools/create-dependency-graph/package.json`.
- `tools/create-dependency-graph/check-duplicates.mjs` (comment only).
- Root `package.json` `devDependencies` and `overrides`.
- `bun.lock`.
- Generated `docs/Architecture/*` if `bun run docs:deps` changes bytes. Commit the generator output. Do not hand-edit the graphs.
- `CHANGELOG.md`. No changeset if no published package changed. If `workbook` is untouched, do not bump it.

**Contract.** `stringify` from `yaml` 2.x of the same plain-data document `dump` used to receive. The tool's YAML is an emitted report, not a workbook, so do not pass `{ schema: 'core' }` unless the current `dump` options were restricting the schema. Read the call. If `dump` is called with no options, call `stringify` with no options first and diff `docs/Architecture/dependency-graph.yaml`. If the diff is comments or key order only, prefer `yaml`'s default and commit the new file. If a test compares YAML bytes, update the fixture in this PR and show a short before/after in the PR body. Do not keep both libraries "temporarily".

**Tests.** `bun run docs:deps:test`. `repo-tools check` after the regen. `bun run docs:deps` itself must exit 0.

**Public API.** None. The tool is not a published package. Export lock unchanged.

**Bundle / perf.** Not a published bundle. No perf gate.

**Docs.** Changelog bullet: `js-yaml` and its `argparse` transitive are gone; architecture YAML is emitted by `yaml`. OVERVIEW counts unchanged unless `repo-tools check` says a Verification cell moved because generated files changed length.

**Builder card.** As in the top card. Do not touch the seed-7 test. Do not merge.

**Done.** `rg js-yaml` finds no `package.json` dependency and no import. The root override key `js-yaml` is gone. Gates exit 0. PR opened, not merged.

---

## DR-6 — Delete `fraction.js`

**Decision.** Rebuild by deletion. `core` `Fraction` is the implementation. `fraction.js` has no value import.

**Scope.** Point `functions/src/types.ts` `Fraction` at the core type (`import type { Fraction } from '@danielsimonjr/mathts-core'` or the relative type the package already uses for other core types; match the file's import style). Remove the `fraction.js` import from `functions/types/index.d.ts` the same way, or delete that import if the file is not on the published entry. Confirm with the `exports` map in `functions/package.json` before editing. Remove the dependency. `bun install`.

**Files.**

- `functions/src/types.ts`.
- `functions/types/index.d.ts` if it is still compiled or shipped.
- `functions/package.json`, `bun.lock`.
- A type-level test if `tsc` is not enough: `functions/tests` already constructs `new Fraction(1, 3)` from core. Do not add a fraction.js oracle.
- Changeset patch `@danielsimonjr/mathts-functions`. `CHANGELOG.md`: no behavior change; the unused dependency is gone.
- If `consumer-typecheck` reports a public type that was `import('fraction.js').default`, stop and keep the public type shape by re-exporting core `Fraction`. Do not publish a type that references `fraction.js`.

**Contract.** No runtime change. `new Fraction(1n, 3n)` and the existing fraction tests stay. `fraction.js` methods (`gcd`, `div`, `toFraction`) are not part of this sprint.

**Tests.** `bunx vitest run functions/tests/typed-relational.test.ts functions/tests/typed-arithmetic.test.ts`. `node tools/test/consumer-typecheck.mjs --skip-build` after `bun run build`.

**Public API.** Export lock unchanged. If the lock does not record types, `consumer-typecheck` is the type gate.

**Bundle / perf.** The functions bundle must not contain `fraction.js`. No numeric perf change is expected. Bundle budget may shrink; `--write` only if the checker reports this package.

**Docs.** Changeset and changelog.

**Builder card.** As in the top card. Do not touch the seed-7 test. Do not merge.

**Done.** No `package.json` lists `fraction.js`. `rg "fraction\\.js"` in `*.ts` is empty. Gates exit 0. PR opened, not merged.

---

## DR-7 — Delete `bignumber.js`

**Decision.** Rebuild by deletion. Type-only imports. Do not adopt the library, and do not point these files at `decimal.js` (DR-9 removes that next).

**Scope.** Replace `import type BigNumber from 'bignumber.js'` in the eight matrix files with a structural type that has the members those files actually read. Put the type in one module, for example `functions/src/matrix/bignumber-like.ts`, and import it. If the files only need it in signatures, prefer the existing local `Decimal` type or `core`'s `BigNumber` **only when** `typecheck` shows the values are that class. Read each use. A wrong class in a signature is a behavior comment, not a runtime change, but it will fail `tsc`. Remove the dependency.

**Files.**

- The eight files named in the inventory (`det`, `diag`, `eigs`, `eigs/complexEigs`, `eigs/realSymmetric`, `inv`, `pinv`, `sqrtm`).
- One new type module if a shared structural type is clearer than eight duplicates.
- `functions/package.json`, `bun.lock`.
- Changeset patch `@danielsimonjr/mathts-functions`. `CHANGELOG.md`.

**Contract.** No runtime change. `rg bignumber.js` in `*.ts` is empty. Tests that already cover `det` / `inv` / `eigs` on the number path stay green. Do not add bignumber.js as a devDependency to "compare".

**Tests.** The existing matrix factory tests those files already have. `bun run typecheck`.

**Public API.** Export lock unchanged. The structural type is not exported from `functions/src/index.ts`.

**Bundle / perf.** Bundle must not contain `bignumber.js`. No perf claim.

**Docs.** Changeset and changelog.

**Builder card.** As in the top card. This sprint does not change decimal arithmetic. Do not start DR-9 here. Do not touch the seed-7 test. Do not merge.

**Done.** `bignumber.js` is absent from `package.json` and `bun.lock`. Gates exit 0. PR opened, not merged.

---

## DR-8 — Rebuild the complex factory without `complex.js`

**Decision.** Rebuild. `complex.js` 2.4.3 is 143,858 bytes, MIT, and it is the value behind `functions/src/type/complex/Complex.ts`. `core` already ships `Complex`.

**Scope.** The factory file stops importing `complex.js`. It constructs `core` `Complex` or a thin subclass in `functions` that adds only the mathjs fields the factory's interface requires (`type`, `isComplex`, `toJSON`, `format`, `toPolar`). Static `fromPolar`, `fromJSON`, `compare`, and the constants `ZERO`, `ONE`, `I`, `PI`, `E`, `INFINITY`, `NAN`, `EPSILON` live in that file. Matrix files that `import type { Complex } from 'complex.js'` switch to the local type. `functions/src/types.ts` stops saying `import('complex.js').default`.

Do not change results of methods on `core` `Complex`. If a factory test expected a complex.js branch cut that core does not match, keep the previous observable result by wrapping in the factory, and write the pair down in the PR body.

**Files.**

- `functions/src/type/complex/Complex.ts`.
- `functions/src/types.ts`.
- Matrix files that import the type from `complex.js` (inventory list).
- `functions/package.json`, `bun.lock`.
- New `functions/tests/complex-factory-parity.test.ts`.
- Changeset patch `@danielsimonjr/mathts-functions`. `CHANGELOG.md`.

**Contract.** For these inputs, the factory's `re` and `im` match the previous implementation (`Object.is` on both parts):

- `0`, `1`, `-1`, `Infinity`, `-Infinity`, `NaN`.
- `new (re, im)` for `(0, 0)`, `(1, -1)`, `(Number.MIN_VALUE, Number.MAX_VALUE)`.
- `fromPolar` of `r = 1`, `phi = 0`, `phi = Math.PI / 2`, `phi = Math.PI`, `phi = -Math.PI / 2`.
- `sqrt(-1)` if the factory exposes sqrt through the class (complex.js does). If the factory does not add `sqrt` and only core has it, do not reimplement sqrt here; call core and record the result.
- `toJSON()` is `{ mathjs: 'Complex', re, im }` as the interface in `Complex.ts` already says.
- `compare` ordering: real part, then imaginary part. Document equality of NaNs: if complex.js treated NaN as unordered, match that.

Build the golden pairs against `complex.js@2.4.3` in a scratch script, paste `Object.is` expectations, delete the import before the PR.

**Tests.** The parity file. Existing `core/tests/types/complex-oracle.test.ts` and `functions` complex tests stay green without edits, unless an assertion imported `complex.js`.

**Public API.** Names of `Complex` exports stay. Export lock unchanged. `consumer-typecheck` after the build.

**Bundle / perf.** No speed claim. Bundle must not contain `complex.js`. Budget `--write` only on a real delta.

**Docs.** Changeset and changelog. Do not claim core `Complex` changed.

**Builder card.** As in the top card. Do not touch the seed-7 test. Do not merge.

**Done.** `complex.js` is absent from `package.json` and `bun.lock`. `rg "complex\\.js"` in `*.ts` is empty. Gates exit 0, plus the new parity file. PR opened, not merged.

---

## DR-9 — Rebuild decimal factories on local `Decimal`

**Decision.** Rebuild. `decimal.js` 10.6.0 is 284,347 bytes. `functions/src/type/local/Decimal.ts` was written to replace it and is already the `BigNumber` alias in `functions/src/types.ts`. The value imports still construct `decimal.js`.

**Scope.** Switch every value import listed in the inventory to the local `Decimal`. Implement any missing method those call sites use, in `Decimal.ts`, with an oracle against decimal.js 10.6.0. Then delete the dependency and inline the oracles. `physicalConstants.ts` switches its type import to the local class.

Do not replace the factory with `core` `BigNumber`. Call sites throughout `functions` still distinguish `.add` (core) from `.plus` (decimal.js). The factory's public methods stay the decimal.js names that `BigNumber.ts` already declares. Read `BigNumber.ts` and keep `config` behavior: precision and rounding mode must keep working for the modes the factory tests set.

`functions/tests/s2r-clones-batch4-oracle.test.ts` imports `decimal.js` as an oracle for `max` / `min`. Retarget the oracle at the local `Decimal` or inline the expected values. Do not keep the dependency for one test.

**Files.**

- `functions/src/type/local/Decimal.ts`.
- `functions/src/type/bignumber/BigNumber.ts`.
- `functions/src/arithmetic/ceil.ts`, `floor.ts`.
- `functions/src/trigonometry/acot.ts`, `acoth.ts`, `acsc.ts`, `acsch.ts`, `asec.ts`, `asech.ts`.
- `functions/src/type/unit/physicalConstants.ts`.
- `functions/tests/s2r-clones-batch4-oracle.test.ts`.
- New `functions/tests/decimal-parity.test.ts`.
- `functions/package.json`, `bun.lock`.
- Changeset patch `@danielsimonjr/mathts-functions`. `CHANGELOG.md`.

**Contract.** For each method the call sites use (the PR lists them), these inputs match decimal.js 10.6.0 with its default config (precision 20, rounding `ROUND_HALF_UP` in decimal.js; local `Decimal.ts` defaults to precision 28 in the file header — **do not silently change the factory default**). If the factory today uses decimal.js defaults, the factory keeps those defaults. If local `Decimal` defaults differ, set the factory's config explicitly so observable results match the old factory, and test that.

Required oracle rows, default factory config:

- Integers: `0`, `1`, `-1`, `10`, `-10`.
- Fractions: `'0.1'`, `'0.2'`, `'1e-20'`, `'1e+20'`.
- Non-finite: `NaN`, `Infinity`, `-Infinity`, if the constructor accepts them. Match decimal.js, including the string it formats.
- `ceil` / `floor` of `'1.5'`, `'-1.5'`, `'2'`, `'-2'`.
- One inverse trig value the `acot` family actually computes. Read the function and oracle that input, not a random one.
- Rounding: a tie at the last digit (`'1.25'` at precision 2, or whatever precision the factory uses). Record the mode.

`Object.is` is the wrong tool for decimal objects. Compare `toString()` and, when both are finite, a numeric `cmp` or `comparedTo` result of `0`.

**Tests.** `decimal-parity.test.ts` with the inlined expected strings. Existing `functions/tests/bignumber-operations.test.ts` and `core` bignumber tests stay. Core tests must not start importing local `Decimal`.

**Public API.** Factory name `bignumber` and the `BigNumber` type stay. Export lock unchanged. `consumer-typecheck` after the build.

**Bundle / perf.** No speed claim required. A note in the PR if `toString` of a 100-digit value is slower than decimal.js is acceptable; a wrong digit is not. Bundle must not contain `decimal.js`.

**Docs.** Changeset and changelog. Say the factory is the local `Decimal`, not `core` `BigNumber`.

**Builder card.** As in the top card. Do not touch the seed-7 test. Do not merge.

**Done.** `decimal.js` is absent from every `package.json` and from `bun.lock`. `rg "decimal\\.js"` in `*.ts` is comments or this plan. Gates exit 0, plus `bunx vitest run functions/tests/decimal-parity.test.ts functions/tests/bignumber-operations.test.ts functions/tests/s2r-clones-batch4-oracle.test.ts`. PR opened, not merged.

---

## DR-10 — Vendor `typed-function`

**Decision.** Vendor `@danielsimonjr/typed-function@5.0.0-alpha.4` (MIT, unpacked 2,343,074 bytes) into `packages/typed-function`. Delete the npm alias.

**Scope.**

- Download the tarball for **5.0.0-alpha.4** (the lock), not "latest". Record the integrity from `bun.lock` (`sha512-8frL4OQGbB2v9NnKf4Uc92GBQZ9p9F8HbkfJlceiTEkpgJU7DWCC1x4evdxRdsW/tKyJkEqNQX9z3dueUEea1g==`) and verify it before copying.
- Copy the source that the package entry loads into `packages/typed-function/vendor/` (or `src/vendor/`). Keep `LICENSE` and the copyright header. Do not copy a second prebuilt `dist` if the source builds with the package's existing `tsdown` script. If the tarball is JS-only, vendor that JS and the `.d.ts` it ships, and wire `exports` at it.
- `packages/typed-function/src/index.ts` imports `typed` and `create` from the vendored path, not from `'typed-function'`.
- Remove the alias from `packages/typed-function/package.json`, `core/package.json`, `functions/package.json`, and root `package.json` `dependencies`.
- Point `core` and `functions` imports at `@danielsimonjr/mathts-typed-function` **or** keep a relative import only where a package already depends on the workspace package. `core` today depends on the alias, not on the workspace package. Give `core` a `workspace:` dependency on `@danielsimonjr/mathts-typed-function` and remove the alias. Check for a cycle: the workspace package must not depend on `core`. It does not today. Keep it that way. The helpers that mention MathTS types stay in the workspace package; the dispatcher stays free of `core` imports.
- `core/src/typed-function.d.ts` is the in-repo shim. After vendoring, `consumer-typecheck` must pass against the **built** declarations, not the shim. Delete or shrink the shim only if `node tools/test/consumer-typecheck.mjs` is green without it. If the shim still supplies `SignatureImpl`, keep it until the vendored `.d.ts` exports that name, and say which one consumers see.
- `bun install` so the lock no longer has `@danielsimonjr/typed-function`.

**Files.** The vendor directory, the four `package.json` files, `bun.lock`, `core/src/typed/mathts-typed.ts`, `functions` import sites (`create.ts`, `core/function/typed.ts`, `optimizeCallback.ts`), `packages/typed-function/src/index.ts`, `packages/typed-function/tests/`, changeset patches for `core`, `functions`, and `mathts-typed-function`. `CHANGELOG.md`.

**Contract.** Dispatch parity, not a new dispatcher:

- A typed function with signatures `'number'`, `'string'`, and `'number, number'` still selects those implementations. Extra arguments and missing arguments throw the same way (same error name if the library uses `TypeError`; same message if a test already pins the message).
- `referTo` / conversions: if `core` registers any, the existing `core/tests/typed/` suite is the oracle. Do not rewrite those tests to match a bug.
- `create()` returns an isolated dispatcher. Types registered on one instance are not visible on another. There is a test for this in the package or in `core`; run it.
- Minified names: `TYPED_FUNCTION_TYPE` behavior stays.

**Tests.** `packages/typed-function/tests/`, `core/tests/typed/`, and `bunx turbo test --filter=@danielsimonjr/mathts-core --filter=@danielsimonjr/mathts-typed-function`. `consumer-typecheck` after `bun run build`.

**Public API.** The workspace package still exports `typed` and `create`. Export lock unchanged. Do not add the vendored file list as public exports.

**Bundle / perf.** No speed claim. Dispatch is on the hot path; do not restyle the vendored source "while you are there". A drive-by edit invalidates the "same bytes" story. If you must patch a type error, one patch, one comment, one test.

**Docs.** Changelog: the implementation is vendored from `@danielsimonjr/typed-function@5.0.0-alpha.4`, MIT, integrity recorded in the PR. `packages/typed-function/README.md` one paragraph. OVERVIEW already calls the package a fork; DR-12 updates the remaining-dependency sentence. You may fix the word "forked" in OVERVIEW only if you do not touch Key Metrics numbers.

**Builder card.** As in the top card. Do not touch the seed-7 test. Do not merge. Do not publish the old npm name.

**Done.** No `package.json` maps `typed-function` to `npm:@danielsimonjr/typed-function`. `bun.lock` has no `@danielsimonjr/typed-function`. Gates exit 0. PR opened, not merged.

---

## DR-11 — Vendor `workerpool`

**Decision.** Vendor `@danielsimonjr/workerpool@10.2.2`. License **Apache-2.0**. Unpacked size 9,575,706 bytes. Vendor the files the entry loads, plus `LICENSE` and `NOTICE`. Do not check in a second copy of browser bundles the wrapper never imports.

**Scope.**

- Verify the tarball against `bun.lock` (`sha512-2ku3pC7MzMWuAbLuS5AxUE3Dh2P75gf891Hi4RPoSkGtgo6ta7XlhOra19wtCea1ci6vcBx7MiMCt6oc9V2gBQ==`).
- Copy source into `packages/workerpool/vendor/`. Apache-2.0 requires the license, the notice if the tarball has one, and retention of copyright headers. Add `packages/workerpool/vendor/NOTICE` listing the upstream project and the pinned version if the tarball has no NOTICE.
- `src/index.ts` and `src/worker.ts` import `pool`, `Pool`, `Transfer`, `worker`, and the option types from the vendor path.
- `scripts/postbuild.mjs` must still produce a `.d.ts` that does not `import` from the bare name `'workerpool'` unless that name resolves inside the package. Prefer a relative specifier. The browser-safety scan (`tools/test/smoke-dist-node.mjs`) must still pass: no new `node:` import on the browser entry. Read `NODE_RUNTIME_PACKAGES` before changing the worker entry.
- Remove the npm alias from `packages/workerpool/package.json` and root `dependencies`.
- `parallel` keeps its workspace dependency. Do not edit `parallel/src/WorkerPool.ts` timeout or hung-worker replacement.
- `bun install`.

**Files.** Vendor tree, `packages/workerpool/src/index.ts`, `src/worker.ts`, `scripts/postbuild.mjs`, both `package.json` files, `bun.lock`, changeset patch `@danielsimonjr/mathts-workerpool` and `@danielsimonjr/mathts-parallel` only if parallel's public behavior changes (it should not). `CHANGELOG.md`.

**Contract.**

- `createPool` / `pool()` still runs a worker that can execute a pure function and return a number.
- `Transfer` still marks an `ArrayBuffer` so the existing chunk tests pass (`slice`, not a shared view, is the wrapper's rule; do not change `chunkTyped`).
- Terminating a pool settles outstanding calls with an error, not a hang. Use the existing workerpool tests under `packages/workerpool/tests/` and `parallel/tests/`.
- A hung worker is still replaced by `parallel`'s `timeoutMs` path. Run the existing timeout test. Do not weaken it.
- Node and browser entries stay split the way `postbuild` and the browser shim already split them.

**Tests.** `packages/workerpool` tests, `parallel` tests that boot a pool, `node tools/test/smoke-dist-node.mjs` after `bun run build`.

**Public API.** Exports of `@danielsimonjr/mathts-workerpool` stay. Export lock unchanged. `canUseWasm` and `initializePool` stay.

**Bundle / perf.** No speed claim. Vendoring is not a license to rewrite the queue.

**Docs.** Changelog names the Apache-2.0 vendor and the version. README of the package links the vendor directory.

**Builder card.** As in the top card. Do not touch the seed-7 test. Do not merge. Do not publish.

**Done.** No `package.json` maps `workerpool` to `npm:@danielsimonjr/workerpool`. `bun.lock` has no that package. Gates exit 0. PR opened, not merged.

---

## DR-12 — Record the keep set

**Decision.** Keep `yaml` and every dev package in the inventory table. This sprint does not remove a library that is still imported. It may delete a dependency only if DR-1 through DR-11 left a `package.json` entry and the import is already gone.

**Scope.**

- Confirm with a script you run locally (do not commit the script unless it is the one-liner in the PR body): every `dependencies` / `devDependencies` / `peerDependencies` key, ignoring `workspace:` and `@danielsimonjr/mathts-*`. The expected remaining third-party **runtime** dependency of a published package is `yaml` on `workbook`, plus `@webgpu/types` as a **peer** of `gpu` and `matrix`. If you find another, stop and add a section to this plan in a docs PR rather than deleting it on a hunch.
- Optional: align the three `tools/*` `typescript` ranges with the root `^7.0.2` only if those tools still typecheck. If they do not, leave the ranges and say so.
- Add one sentence under the Packages section of `docs/Architecture/OVERVIEW.md`, after the sentence that versions live in each `package.json`. Text: the published packages' only third-party runtime dependency is `yaml` (`workbook`); `@webgpu/types` is a peer of `gpu` and `matrix`; dev tooling is intentionally external. Do not edit Key Metrics, the package file-count table, or any Verification cell except to satisfy `repo-tools check`.
- `CHANGELOG.md` bullet listing the keep set in one sentence and pointing here. If DR-13 is next, the pointer may be temporary; still write it.

**Files.** `docs/Architecture/OVERVIEW.md` (one sentence). `CHANGELOG.md`. Tool `package.json` files only for the TypeScript range, if you proved it.

**Contract.** `bun run typecheck` and `bun run build` still work. `yaml` parse options in `yaml-safe.ts` are unchanged. No production import of `@xmldom/xmldom` (it stays devDependencies).

**Tests.** `repo-tools check`. `bunx vitest run workbook/tests` for the YAML tests if you touched nothing, you may skip the suite only when `git diff` shows no `workbook` code. If you only edited OVERVIEW, the card's gates are enough.

**Public API.** Unchanged. Export lock unchanged.

**Bundle / perf.** None.

**Docs.** This is the docs sprint. No changeset unless a published `package.json` changed.

**Builder card.** As in the top card. Do not remove `yaml`. Do not touch the seed-7 test. Do not merge.

**Done.** OVERVIEW states the remaining runtime dependency. Gates exit 0. PR opened, not merged.

---

## DR-13 — Delete this plan

**Decision.** The plan is done. Delete it so it does not stay as a second source of truth next to the code.

**Scope.** This sprint runs only after DR-1 through DR-12 are merged to `main`. Delete `docs/plans/DEPENDENCY_REDUCTION_PLAN.md`. In `docs/README.md`, remove the row that links this file. Leave the symbolic-regression row as it is. `CHANGELOG.md` one bullet: the dependency-reduction plan is removed; the remaining third-party runtime dependency is `yaml`. Do not revert the OVERVIEW sentence from DR-12.

**Files.** `docs/plans/DEPENDENCY_REDUCTION_PLAN.md` (delete). `docs/README.md`. `CHANGELOG.md`.

**Contract.** No `package.json` changes. `rg DEPENDENCY_REDUCTION_PLAN` is empty except `CHANGELOG.md`.

**Tests.** `repo-tools check . --docs=docs/Architecture` if you touched nothing under `docs/Architecture`, the check should be unchanged. Run it anyway.

**Public API.** None. Export lock not run is not acceptable: run it. It passes with no `--write`.

**Bundle / perf.** None.

**Docs.** The changelog bullet is the docs update.

**Builder card.** As in the top card. Docs-only. Do not merge, release, tag, or publish. Do not touch the seed-7 test.

**Done.** The file is gone. The README index does not link it. Gates exit 0. PR opened, not merged.

## Counts

| Decision | Count | Names                                                                                                                                                                                                                                                                                                                                                                               |
| -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebuild  | 9     | `escape-latex`, `javascript-natural-sort`, `tiny-emitter`, `seedrandom`, `js-yaml`, `fraction.js`, `bignumber.js`, `complex.js`, `decimal.js`                                                                                                                                                                                                                                       |
| Vendor   | 2     | `@danielsimonjr/typed-function`, `@danielsimonjr/workerpool`                                                                                                                                                                                                                                                                                                                        |
| Keep     | 23    | `yaml`, plus 22 dev packages: `typescript`, `vitest`, `@vitest/browser`, `@vitest/browser-playwright`, `@vitest/coverage-v8`, `playwright`, `tsdown`, `turbo`, `oxlint`, `prettier`, `husky`, `lint-staged`, `@changesets/cli`, `esbuild`, `fast-check`, `assemblyscript`, `@assemblyscript/loader`, `@types/node`, `@types/bun`, `@webgpu/types`, `@xmldom/xmldom`, `@yao-pkg/pkg` |

Sprints: DR-1, DR-2, DR-3, DR-4, DR-5, DR-6, DR-7, DR-8, DR-9, DR-10, DR-11, DR-12, DR-13.
