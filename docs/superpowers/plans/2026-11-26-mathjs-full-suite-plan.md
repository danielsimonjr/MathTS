# mathjs 15.3.0 full unit-suite relay

> **For agentic workers:** Use superpowers:executing-plans. Each batch is one PR in `compat/` unless the issue text says a native bug. Checkbox steps.

**Goal:** Make the mathjs `v15.3.0` public-API unit tests pass against `@danielsimonjr/mathts-compat`.

**Run (2026-11-26, this plan):** mathjs tag `v15.3.0` `test/unit-tests` (311 files). Public tests import `src/defaultInstance.js` (and the public `create` / `factory` / error-class modules) through a loader that serves `create(all)` from `@danielsimonjr/mathts-compat`. No mathjs package was added to MathTS `package.json`.

## Totals

|                                           |                                         Files | Tests |
| ----------------------------------------- | --------------------------------------------: | ----: |
| Suite                                     |                                           311 |  6806 |
| Public API, passed                        |                                           285 |  5726 |
| Public API, failed                        | (same 285 files; 178 files contain a failure) |   694 |
| Public API, pending (`it.skip` in mathjs) |                                               |    19 |
| N/A internals-only                        |                                            26 |   367 |

Public tests: 5726 + 694 + 19 = 6439. Suite tests: 6439 + 367 = 6806.

The 19 pending tests are skipped by mathjs itself. They are not failures.

N/A files were executed on mathjs 15.3.0 source (not compat): 364 passed, 3 pending, 0 failed. Pending there: `deepMap should skip zero values if skipZeros is true`, `factory should order functions by their dependencies (1)`, `factory should not go crazy with circular dependencies`.

## N/A internals-only (26 files, 367 tests)

These import mathjs modules that are not on the public `mathjs` export surface (`create`, `factory`, `config`, named functions, error classes, the default instance). They were not scored as compat failures.

| Tests | File                                                   |
| ----: | ------------------------------------------------------ |
|    29 | `constants.test.js`                                    |
|     1 | `expression/keywords.test.js`                          |
|    10 | `expression/operators.test.js`                         |
|     6 | `expression/transform/utils/lastDimToZeroBase.test.js` |
|     5 | `function/algebra/sparse/csLu.test.js`                 |
|     2 | `plain/number/arithmetic.test.js`                      |
|     9 | `type/matrix/utils/broadcast.test.js`                  |
|     8 | `type/matrix/utils/deepForEach.test.js`                |
|    10 | `type/matrix/utils/deepMap.test.js`                    |
|    13 | `type/matrix/utils/isCollection.test.js`               |
|     9 | `type/matrix/utils/reduce.test.js`                     |
|     2 | `type/unit/physicalConstants.test.js`                  |
|    68 | `utils/array.test.js`                                  |
|     4 | `utils/bignumber/constants.test.js`                    |
|    18 | `utils/bignumber/formatter.test.js`                    |
|     8 | `utils/bignumber/nearlyEqual.test.js`                  |
|    21 | `utils/customs.test.js`                                |
|     7 | `utils/factory.test.js`                                |
|     7 | `utils/function.test.js`                               |
|     5 | `utils/is.test.js`                                     |
|     4 | `utils/latex.test.js`                                  |
|    18 | `utils/map.test.js`                                    |
|    38 | `utils/number.test.js`                                 |
|    36 | `utils/object.test.js`                                 |
|     9 | `utils/optimizeCallback.test.js`                       |
|    20 | `utils/string.test.js`                                 |

## Rules for every batch

- Patch `compat/` (`@danielsimonjr/mathts-compat`) only, copying `mathjs@15.3.0` behavior exactly — quirks included — as a thin wrapper/adapter layer. Zero runtime `require('mathjs')` or `import('mathjs')` in `compat/src/`.
- Never change critical libraries (`typed-function`, `core`, `matrix`, `functions`, `workerpool`, `gpu`, `parallel`) just to match mathjs. Only genuine native MathTS bugs (verified against NumPy/SciPy/SymPy) may touch them, with regression tests and a changelog fragment.
- No new dependencies (never add `mathjs` or any other dependency to `package.json`). No weakened or skipped tests.
- No `: any`, `as any`, `as never`, or `@ts-ignore`. No force-push, amend, rebase, or `--no-verify`.
- One batch, one PR, `Fixes #N` for each issue in that batch.
- Honor main's conflict-free formats:
  - Add a changelog fragment at `changelog-fragments/YYYY-MM-DD-<slug>.md` (never hand-edit `CHANGELOG.md`).
  - Update per-area gap lists in `compat/tests/parity/known-gaps/*.json` as gaps close.
  - Add a patch changeset in `.changeset/`.
- Do not set `RELEASES_ENABLED`. Do not tag, publish, or merge.

## Batches

Fewest dependencies first. Issues in one batch touch different compat files and can be separate PRs in parallel. The next wave starts after the previous wave's shared types (`CompatBigNumber`, `DenseMatrix`, error classes) have landed.

### Wave 1 — constructors and error shape (parallel)

| Issue | Failures | Cause                                         | Files                                                                                   |
| ----- | -------: | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| #1774 |       11 | Constructors throw without `new`              | `compat/src/named-symbols.ts`, constructor exports                                      |
| #1775 |        2 | `string()` with no args returns `"undefined"` | string wrapper                                                                          |
| #1773 |       33 | Error class and message text                  | `compat/src/shims.ts`, `compat/src/mathjs-parity-g02.ts`, `compat/src/named-symbols.ts` |

#1773 and #1774 both edit `named-symbols.ts`. Land #1774 first, then #1773. #1775 is parallel with #1774.

### Wave 2 — scalar formatting (parallel after Wave 1)

| Issue | Failures | Cause                                                                                       | Files                                                                   |
| ----- | -------: | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| #1780 |      140 | `BigNumber` class is not the one `bignumber()` returns; `valueOf` is not the decimal string | `compat/src/bignumber.ts`, arithmetic wrappers that return `decimal.js` |
| #1779 |       11 | Fraction `toString` / `valueOf`                                                             | fraction formatting                                                     |
| #1781 |        7 | Complex `valueOf` and `format`                                                              | Complex wrapper                                                         |

### Wave 3 — JSON, help, format, chain, sandbox (parallel after Wave 2)

| Issue | Failures | Cause                                              | Files                           |
| ----- | -------: | -------------------------------------------------- | ------------------------------- |
| #1782 |        5 | `replacer` / `reviver`                             | `compat/src/serialization.ts`   |
| #1776 |       60 | `help()` has no embedded docs                      | help/docs wiring                |
| #1778 |       32 | `format` / `print` precision and syntax            | format/print wrappers           |
| #1783 |        1 | Chain keeps inherited properties                   | Chain wrapper                   |
| #1777 |       22 | Sandbox says undefined symbol instead of no access | compat expression error mapping |

#1782 waits on #1779 and #1780 so Fraction and BigNumber JSON shapes are stable.

### Wave 4 — units and matrix model (parallel)

| Issue | Failures | Cause                                                                             | Files                  |
| ----- | -------: | --------------------------------------------------------------------------------- | ---------------------- |
| #1784 |       33 | `to`, `toBest`, `createUnit`, unit predicates                                     | unit wrappers          |
| #1785 |      115 | Dense/Sparse/Immutable storage, datatype, jagged arrays, subset, map, clone, JSON | compat matrix adapters |

### Wave 5 — functions that sit on the matrix and BigNumber adapters (parallel after Wave 4)

| Issue | Failures | Cause                                                        | Files                              |
| ----- | -------: | ------------------------------------------------------------ | ---------------------------------- |
| #1786 |       72 | Parser, evaluate, AST nodes                                  | parse/evaluate/node re-exports     |
| #1787 |       19 | Arithmetic and bitwise dispatch                              | arithmetic/bitwise/logical shims   |
| #1788 |       67 | Relational compares and statistics, including NaN            | relational and statistics wrappers |
| #1789 |       16 | Trig branch cuts (`acsc(0)` real part)                       | trigonometry wrappers              |
| #1790 |       17 | `simplify` / `derivative` / `resolve` strings                | symbolic adapters                  |
| #1791 |       16 | `qr`, `eigs`, `det`, `inv`, `pinv`, `expm`                   | linalg adapters                    |
| #1792 |       10 | `distance`, `intersect`                                      | geometry wrappers                  |
| #1793 |        4 | `setCartesian`, `setDistinct`, `setIntersect`, `setPowerset` | set wrappers                       |

#1786 waits on #1777 so sandbox messages are not rewritten twice.

### Wave 6 — after symbolic (sequential)

| Issue | Failures | Cause                                                                                                                                                   | Files               |
| ----- | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| #1794 |        1 | `rationalize` test "processes a really complex expression" did not finish in 20s isolated or 300s for the file. The other 13 tests in that file passed. | rationalize adapter |

## Reproducing & Running Tests

Each Relay builder and challenger can run any `mathjs@15.3.0` public unit test file (or the full public suite) against `@danielsimonjr/mathts-compat` without adding `mathjs` to MathTS:

1. **Fetch `mathjs@15.3.0` into `/tmp` and install its test runner (`mocha`):**

```bash
curl -sL https://github.com/josdejong/mathjs/archive/refs/tags/v15.3.0.tar.gz | tar -xz -C /tmp
cd /tmp/mathjs-15.3.0 && npm ci --ignore-scripts
```

2. **Build `@danielsimonjr/mathts-compat` from the MathTS repo root:**

```bash
bun run build
```

3. **Create a temporary Node ESM loader hook (`/tmp/compat-loader.mjs` and `/tmp/compat-register.mjs`)** that resolves `src/defaultInstance.js` (and the public `src/core/create.js`, `src/utils/factory.js`, and `src/type/error/*.js` entry points) to `<MATHTS_ROOT>/compat/dist/index.js`:

```js
// /tmp/compat-loader.mjs
import { pathToFileURL } from 'node:url';

const COMPAT_URL = pathToFileURL(process.env.MATHTS_COMPAT_DIST).href;

export async function resolve(specifier, context, nextResolve) {
  const res = await nextResolve(specifier, context);
  if (
    res.url.endsWith('/src/defaultInstance.js') ||
    res.url.endsWith('/src/core/create.js') ||
    res.url.endsWith('/src/utils/factory.js')
  ) {
    return { url: COMPAT_URL, shortCircuit: true };
  }
  return res;
}
```

```js
// /tmp/compat-register.mjs
import { register } from 'node:module';
register('/tmp/compat-loader.mjs', import.meta.url);
```

4. **Run one or more unit test files against compat:**

```bash
MATHTS_COMPAT_DIST="$(pwd)/compat/dist/index.js" \
  node --import /tmp/compat-register.mjs \
  /tmp/mathjs-15.3.0/node_modules/.bin/mocha \
  /tmp/mathjs-15.3.0/test/unit-tests/function/string/string.test.js
```

## Check

Re-run the loader harness above across all 285 public files in `mathjs@15.3.0` `test/unit-tests` (excluding the 26 internals-only files listed above). Target: 6439 public tests, 0 failed, 19 still pending. Do not expect the 367 internals-only tests to pass on compat.
