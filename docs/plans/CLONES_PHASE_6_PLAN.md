# Plan: Phase 6 clone pairs — merge or keep

**Status:** planning only. This file is the contract for the Phase 6 build PRs. It changes no runtime source.
**Ledger:** [`docs/roadmap/CLONES_REMAINING.md`](../roadmap/CLONES_REMAINING.md), the Phase 6 measurement, committed with this plan.
**Tree reviewed:** `40466a97` (`docs(roadmap): Sprint 5R close-out (PySR PR 12) (#528)`), which is `main` at the time of this plan.
**Tool:** `@danielsimonjr/repo-tools` 2.3.0, command `repo-tools clones`. The CI pin `REPO_TOOLS_VERSION: 2.2.4` has no `clones` subcommand (`repo-tools: unknown subcommand or option 'clones'`). That pin is for `repo-tools check` and stays as it is.
**Procedure:** the "Phase 6 and up: clone-reduction loop" section of [`PYSR_INFORMED_ROADMAP.md`](../roadmap/PYSR_INFORMED_ROADMAP.md). [`CLONES_REFACTOR_PLAN.md`](./CLONES_REFACTOR_PLAN.md) is the historical plan for `156e4ea8` and is not rewritten.

## Judgment

The rules are the ones `CLONES_REFACTOR_PLAN.md` used, so MERGE and KEEP mean the same thing in both plans.

A pair is **MERGE** when both bodies share the control flow and the difference is an output template, a combiner invoked once per call, or a choice made outside the element loop.

A pair is **KEEP** when the differing expression is the numeric definition, a precision / NaN / pivot policy, a typed-dispatch signature, a callback or mode branch inside a measured hot loop, a sandbox or SHA-384 gate, a layering ban from the dependency graph, or an AssemblyScript operator that is the kernel (including `@inline` per element). PR #454 measured a shared per-element callback 56% to 643% slower on the sub-threshold path. A boolean checked once per call is still MERGE. A boolean inside the element loop is KEEP.

Phase 6 adds three rules.

1. **A carried reason is checked against the current code.** 548 of the 553 pairs were in the `156e4ea8` report and carry a verdict from the previous plan. Fifteen of those KEEP reasons do not survive a reading of the current bodies; those pairs are MERGE here. [Verdicts that changed](#verdicts-that-changed) quotes each old reason and the code that answers it.
2. **The residue left after a shared envelope is KEEP when the residue is the element loop.** PR-H (#504) moved the worker `sum` / `prod` / `norm` envelope into `reduceScalar`. The pairs still report (0.710 and 0.610) because the remaining bodies are the sequential loops, and folding those loops into one is the #454 loss. The same holds for every worker method that keeps a sequential `for` after its envelope moves.
3. **A helper must be smaller than what it replaces.** When the shared region is about as large as the callback surface a helper would need, the pair is KEEP. `WASMBackend` `inverse` / `choleskyDecomposition` / `luDecomposition` is the case: about ten shared lines against five callbacks.

## Baseline

Measured on `40466a97` with the tool defaults (there is no `repo-tools.config.json` in the repo; the ledger lists the flag values):

```
files=1230 parseErrors=0 units(minNodes=50)=2653
nodes p50=109 p90=327 p99=827 max=3705
exact groups=10 (units in them=39) text-identical groups=4
near pairs=553 by jStruct: 0.9 or more: 109, 0.8 to 0.9: 159, 0.7 to 0.8: 90, 0.6 to 0.7: 171, below 0.6 (containment): 24
units by folder: assembly/src=150 autograd/src=51 compat/src=9 core/src=227 expression/src=157 functions/src=1564 gpu/src=14 matrix/src=190 packages/typed-function=2 packages/workerpool=62 parallel/src=51 plot/src=36 tensor/src=58 workbook/src=82
```

`109 + 159 + 90 + 171 + 24 = 553`. Two runs on the same tree wrote byte-identical `clones.json`, so a count that moves after a PR is the PR.

### Re-measure

From the repo root, with `@danielsimonjr/repo-tools@2.3.0` installed outside the repo (`npm install @danielsimonjr/repo-tools@2.3.0` in a scratch directory):

```bash
repo-tools clones . --src \
  packages/typed-function/src packages/workerpool/src \
  core/src matrix/src tensor/src autograd/src functions/src expression/src \
  parser/src units/src numbers/src ast/src evaluator/src linalg/src \
  arithmetic/src trigonometry/src statistics/src signal/src \
  parallel/src workbook/src assembly/src compat/src gpu/src plot/src \
  --out=../tmp/clones-phase-6
```

`--src` is one flag; it takes every following argument until the next flag. `--out` must be relative to the repo root, and its parent must be writable. Do not commit `inventory.jsonl` or `clones.json`.

Each build PR runs this command on its branch and pastes the `exact groups=` and `near pairs=` lines, before and after, into the PR description. It also lists every pair that appeared. A pair the PR creates is judged by the rules above in the PR, not deferred silently.

## Accounting

| Verdict                       | Pairs |
| ----------------------------- | ----: |
| MERGE (11 build PRs, P6-1–11) |    20 |
| KEEP                          |   533 |
| Total near pairs              |   553 |

The [appendix](#appendix) lists every pair once with its verdict and reason. Exact-group pairs are listed at `j` 1.000. No KEEP pair shares a unit with a MERGE pair, so each PR's expected drop is exactly its own pairs.

| PR    | MERGE pair                                                     |     j | Previous verdict |
| ----- | -------------------------------------------------------------- | ----: | ---------------- |
| P6-1  | `rotateLeft` ↔ `rotateRight` (exact group 10)                  | 1.000 | new pair         |
| P6-1  | `swapOperands` ↔ `deleteNode`                                  | 0.649 | new pair         |
| P6-2  | `_xgcdBigNumber` ↔ `_xgcdFraction`                             | 0.846 | KEEP             |
| P6-3  | `rosenbrockSolve` ↔ `rodasSolve`                               | 0.678 | KEEP             |
| P6-4  | `gradL1` ↔ `gradHuber`                                         | 0.770 | KEEP             |
| P6-5  | `Complex.tan` ↔ `tanh`                                         | 0.803 | KEEP             |
| P6-5  | `Complex.cot` ↔ `coth`                                         | 0.706 | KEEP             |
| P6-5  | `Complex.tan` ↔ `cot`                                          | 0.683 | new pair         |
| P6-5  | `Complex.tanh` ↔ `coth`                                        | 0.636 | new pair         |
| P6-6  | workerpool `exec` ↔ `execFunction`                             | 0.684 | KEEP             |
| P6-7  | workerpool `runChunks` ↔ `reduce`                              | 0.680 | KEEP             |
| P6-7  | workerpool `reduceScalar` ↔ `runChunks`                        | 0.664 | new pair         |
| P6-7  | workerpool `sort` ↔ `reduce`                                   | 0.662 | KEEP             |
| P6-7  | workerpool `sort` ↔ `runChunks`                                | 0.616 | KEEP             |
| P6-8  | worker `tensordotChunk` ↔ `ComputePool` `tensordotChunkKernel` | 0.971 | KEEP             |
| P6-9  | functions `asAllocHeader` ↔ matrix `allocAsTypedView`          | 0.727 | KEEP             |
| P6-10 | functions ↔ matrix `WasmLoader.loadNodeWasm`                   | 0.952 | KEEP             |
| P6-10 | functions ↔ matrix `WasmLoader.loadBrowserWasm`                | 0.919 | KEEP             |
| P6-10 | functions ↔ matrix `WasmLoader.precompile`                     | 0.877 | KEEP             |
| P6-11 | `chainGpuDispatchImpl` ↔ `chainReduceGpuDispatchImpl`          | 0.888 | KEEP             |

By band, the MERGE pairs are 4 at `jStruct` 0.9 or more, 4 at 0.8 to 0.9, 3 at 0.7 to 0.8, 9 at 0.6 to 0.7, and none below 0.6.

### Exact groups (10)

| Group | Units                                                                    | Verdict | Reason                                                                                                                                          |
| ----: | ------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | 11 unary `Float64Array` overloads (`sign`, `cbrt`, `round`, …), 62 nodes | KEEP    | One `Math.*` call per element in a monomorphic loop. A shared loop is the #454 loss.                                                            |
|     2 | 8 unary `Float64Array` overloads (`log10`, `log2`, `log1p`, …), 74 nodes | KEEP    | Same as group 1.                                                                                                                                |
|     3 | `_batchedMatmul`, `_batchedMatmulGradA`, `_batchedMatmulGradB`           | KEEP    | `A@B`, `dY@Bᵀ`, `Aᵀ@dY` with different `m`/`k`/`n` and offsets, on the tape hot path.                                                           |
|     4 | `isSafeMethod` in core, expression, functions                            | KEEP    | Sandbox predicate. Each package calls its own copy; the core copy is not on `internal`.                                                         |
|     5 | `factory` in core, expression, functions                                 | KEEP    | The generic constraint differs. Core's `Record<string, unknown>` is TS2345 at the expression and functions call sites.                          |
|     6 | `csc` / `sec` / `cot` `Float64Array` overloads                           | KEEP    | Same as group 1.                                                                                                                                |
|     7 | `_carlsonRC` in AssemblyScript and in the JS bridge                      | KEEP    | The JS body is the fallback when the module is absent. AssemblyScript cannot import a TypeScript package.                                       |
|     8 | `mulberry32` ↔ `_workerMulberry32`                                       | KEEP    | `workerpool` cannot import `core`. The roadmap's standing example of a KEEP the dependency graph forces. `worker-numerics.test.ts` pins parity. |
|     9 | `isBigNumber` in expression and functions                                | KEEP    | Local guards. A cross-module re-export measured about 40% slower on the Tukey path; `is-guards-local.test.ts` forbids `export *`.               |
|    10 | `rotateLeft` ↔ `rotateRight`                                             | MERGE   | P6-1.                                                                                                                                           |

The four text-identical groups (`isSafeMethod` core ↔ functions, `mulberry32` ↔ `_workerMulberry32`, `factory` expression ↔ functions, `isBigNumber` expression ↔ functions) are members of groups 4, 8, 5, and 9 and are KEEP for the same reasons.

## Verdicts that changed

Against the `156e4ea8` plan: 15 pairs move from KEEP to MERGE, 2 move from MERGE to KEEP, 5 pairs are new (all MERGE), and 32 KEEP pairs keep the verdict with a rewritten reason.

### KEEP to MERGE (15)

| Pair (j)                                                                                | Old reason                                                                                                                                    | Why it does not hold now                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tensordotChunk` ↔ `tensordotChunkKernel` (0.971)                                       | `dist/worker.js` cannot import `core`, `parallel`, or `functions`; the bodies have drifted and a parity test is the pin.                      | The ban runs one way. `parallel` already imports `forEachMultiIndex` and `chunkTyped` from `workerpool`, so the kernel can live in `workerpool` and `parallel` can call it. The `ComputePool` doc comment already says the kernel is meant to be in one place. The drift is `Array.from` copies of readonly axes and buffer unwrapping; the loops and accumulation order match. No test names either kernel. |
| `loadNodeWasm` (0.952), `loadBrowserWasm` (0.919), `precompile` (0.877)                 | `matrix` dynamically imports `./wasm/integrity.js`; `functions` statically calls `verifyWasmIntegrity`. Folding can skip the SHA-384 compare. | Both `integrity.ts` files are one `export { … } from '@danielsimonjr/mathts-core/internal'`. A diff of the method bodies leaves only that import and comments. Moved into `WasmModuleLoader`, the compare sits in the module that defines it, and no path loses it.                                                                                                                                          |
| `chainGpuDispatchImpl` ↔ `chainReduceGpuDispatchImpl` (0.888)                           | A shared template can pop the wrong per-device error scope and read zeros.                                                                    | The LIFO hazard is concurrency, and both impls already run inside `serializeGpu` (lines 304 and 496). The hazard inside one call is an unbalanced push/pop, and today it is guarded by two hand-written copies of the `scopePushed` / `scopePopped` `finally` block. One lifecycle owning one push and one pop is the safer shape.                                                                           |
| `_xgcdBigNumber` ↔ `_xgcdFraction` (0.846)                                              | BigNumber arithmetic against Fraction arithmetic; the loop is the same shape and the operations are not.                                      | The operations are the same; only the method names differ (`div`/`divide`, `minus`/`subtract`, `times`/`multiply`, `lt`/`lessThan`, `neg`/`negate`, `isInt`/`isInteger`). `mod`, `floor`, and `isZero` already match. No `number` path and no measured loop.                                                                                                                                                 |
| `Complex.tan` ↔ `tanh` (0.803), `cot` ↔ `coth` (0.706)                                  | A helper that takes four trig callbacks is longer than the four-line methods.                                                                 | After #516 each method also carries the `HYPERBOLIC_OVERFLOW_ARG` branch. The helper needs two booleans, not callbacks: `tanh z = -i tan(iz)` swaps the doubled arguments and the output order; `cot` / `coth` flip the denominator and negate one part.                                                                                                                                                     |
| `gradL1` ↔ `gradHuber` (0.770)                                                          | `sign(residual)` against `2*clamp(residual,-1,1)` inside the row loop; a callback there is the #454 loss.                                     | No callback is needed. The loss is chosen once per call, before the row loop, and each loss keeps its own monomorphic influence loop. The accumulation over free parameters is the same code.                                                                                                                                                                                                                |
| `asAllocHeader` ↔ `allocAsTypedView` (0.727)                                            | One pins a header; the other pins a header plus a typed view.                                                                                 | Both pin a buffer, allocate the 12-byte header, and write `[buffer, dataStart, byteLength]` as little-endian `u32`s. The view is one constructor call after that, once per call.                                                                                                                                                                                                                             |
| `exec` ↔ `execFunction` (0.684)                                                         | `exec` sends a named method plus a transfer list; `execFunction` sends a function value.                                                      | That is the argument list of one `pool.exec` call. The pool check, the timeout, and the `_recordExecution` bookkeeping are the same. Once per chunk, not per element.                                                                                                                                                                                                                                        |
| `runChunks` ↔ `reduce` (0.680), `sort` ↔ `reduce` (0.662), `sort` ↔ `runChunks` (0.616) | The parallel envelope matches; arity, dtype, chunk task, or result shape differs, so this is outside the `sum`/`prod`/`norm` shell.           | "Outside the shell" scoped PR-H; it is not a difference. `sort` and `reduce` inline the `runChunks` envelope. The k-way merge, the partial fold, and `.flat()` run once per call after the chunks return: the combiner case PR-H already used.                                                                                                                                                               |
| `rosenbrockSolve` ↔ `rodasSolve` (0.678)                                                | Different tableaus; the shared `_rk` shell already exists.                                                                                    | Neither solver calls `_rk` (that shell serves `_rk23` / `_rk45`). Validation, the Hairer initial step, the overshoot clamp, `F0` / `J`, the scaled RMS error norm, the accept test, step control, and the min/max clamp are the same. The tableau is the step body, run once per step beside an O(n³) factorization.                                                                                         |

### MERGE to KEEP (2)

`sum` ↔ `prod` (0.710) and `sum` ↔ `norm` (0.610) in `packages/workerpool/src/index.ts`. PR-H (#504) moved their envelope into `reduceScalar`. What still pairs is each sequential closure (`+=` from 0, `*=` from 1, or squares then `Math.sqrt`): the element loop. Rule 2.

### New pairs (5)

`rotateLeft` ↔ `rotateRight` (j 1.000, exact group 10), `swapOperands` ↔ `deleteNode` (0.649), `Complex.tan` ↔ `cot` (0.683), `Complex.tanh` ↔ `coth` (0.636), and `reduceScalar` ↔ `runChunks` (0.664). All five are MERGE.

### Rewritten KEEP reasons (32)

The verdict is unchanged. The old reason no longer described the current code, or it grouped the pair with a different case.

- 20 worker per-element method pairs (`scale`, `bitwiseNot`, `unary`, `applyKernel`, `applyKernel2`, `elementwise`, `bitwiseBinary`, `bitwiseScalar`, `dot`, `distance`, `matmul`, `matvec`, `distanceMatrix`, `outer`). Their envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential loop over elements or rows, and the chunk task. Routing them through `runParallel` is optional cleanup and retires no pair (rule 2).
- 3 worker-bundle pairs: `gammaSampleRng` ↔ `_workerGammaRandom`, `fftCoreFloat64` ↔ `fftFrameInPlace`, `gaussQuadSerial` ↔ `integrateChunk`. The old reason grouped them with `tensordot`. Unlike `tensordot`, these kernels live in `functions`, and `functions` does not depend on `workerpool`; `dist/worker.js` cannot import `functions`.
- 3 substitution pairs with a reason specific to the axis: `condest` `luSolve` / `luSolveTranspose`, Gaussian-process `forwardSolve` / `backSolveTranspose`, and `tensor` `forwardSub` / `backSub`.
- 3 `WASMBackend` pairs (`inverse`, `choleskyDecomposition`, `luDecomposition`). Rule 3.
- 2 `ParallelMatrix` pairs (`dotProduct` / `sum`, `elementwise` / `scale`). The parallel shell is already `scatterBlocks` / `sumBlocks`; the residue is the element loop.
- `compileFunctionNode` ↔ `compileArrayNode` (j 0.105). A containment false match, not a sandbox pair: the child-compile loop of `compileArrayNode` sits inside `compileFunctionNode`.

## Pull requests

Eleven PRs. Each branches from `main`, is mergeable alone, and lands on its own. They do not stack. P6-6, P6-7, and P6-8 edit different parts of `packages/workerpool/src/index.ts`; whichever lands later rebases. P6-9 and P6-10 edit different files in `core/src/`.

Recommended order: the cold JavaScript edits first (P6-1 to P6-4), then the two gated hot-path edits (P6-5, P6-7) beside the small P6-6, then the cross-package and security-adjacent ones (P6-8 to P6-11).

Every PR follows these rules.

- **Pins first.** The first commit adds the pinning tests the section names and is green against the old code. The refactor follows in a later commit, and the pins stay green unchanged.
- **Same names, same numbers.** Public names and signatures stay, and numeric results stay bit-identical unless the section says otherwise. A mode flag inside a hot loop is out of scope.
- **Changesets.** One patch changeset for each published package the PR changes. Do not edit `package.json` `"version"` by hand.
- **Gates.** `bun run typecheck` (0 errors), `bun run lint`, the section's tests, `node tools/test/check-export-lock.mjs`, and, after `bun run build`, `node tools/test/check-bundle-budget.mjs`. When the budget reports drift this PR caused, refresh it with `--write` and commit the file in the same PR.
- **Pre-commit.** When a package `src/` or `assembly/` file is staged, the hook runs `docs:deps` and `docs:functions` and stages `docs/Architecture`, `docs/api`, and `docs/reference`. `docs:functions` reads each package's built `dist` and refuses a stale one, so build the changed packages before committing. A test-only `.ts` change runs `docs:deps` for the file census. Every commit runs `check:file-census` and `check:duplicates:fast`. Commit what the hook regenerates. Do not use `--no-verify`.
- **Re-measure** as described under [Re-measure](#re-measure).

### P6-1 — scalar mutation: pick-and-replace and rotation side

**Package:** `functions`. **File:** `functions/src/scalar-mutate.ts`. **Pairs retired:** 2, one of them exact group 10.

Two module-private helpers:

```ts
type OpNode = Extract<ScalarNode, { kind: 'op' }>;

function replaceBinaryOp(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext,
  replacement: (current: OpNode) => ScalarNode
): ScalarNode | null;

function rotateAt(opNode: ScalarNode, side: 0 | 1): ScalarNode | null;
```

`replaceBinaryOp` is the body that `swapOperands` (261) and `deleteNode` (348) share: `collectPaths` with the binary-op predicate, the empty check, `paths[rng.nextInt(paths.length)]`, `nodeAt`, the arity guard, `replaceAt(node, path, replacement(current))`, then `accepts(ctx.grammar, next) ? next : null`. `swapOperands` passes `(c) => ({ kind: 'op', op: c.op, args: [c.args[1], c.args[0]] })`. `deleteNode` passes `(c) => c.args[rng.nextInt(2)]`; that draw still comes after the path draw, so the RNG sequence does not change. The callback runs once per call.

`rotateAt` replaces `rotateLeft` (366) and `rotateRight` (381), which are private. It keeps both guards. With `pivot = opNode.args[side]` and `other = opNode.args[1 - side]`:

- side 0 (today's `rotateLeft`): `inner = op(opNode.op, [pivot.args[1], other])`, result `op(pivot.op, [pivot.args[0], inner])`;
- side 1 (today's `rotateRight`): `inner = op(opNode.op, [other, pivot.args[0]])`, result `op(pivot.op, [inner, pivot.args[1]])`.

In `rotateTree` the coin becomes `const first = rng.next() < 0.5 ? 0 : 1` and the call `rotateAt(current, first) ?? rotateAt(current, first === 0 ? 1 : 0)`, which keeps the existing fallback when only one direction is possible.

**Public API and export lock:** `swapOperands`, `deleteNode`, and `rotateTree` keep their signatures. No export changes.

**Risk.** A changed RNG draw order changes every seeded search result. A rotation with its operands swapped builds a valid tree with a different value, which only a golden test catches.

**Pins first** (add the ones `scalar-mutate.test.ts` does not already have): golden `rotateTree` output for both coin outcomes on a tree where both rotations apply, and on trees where only the left or only the right applies; `deleteNode` with a stubbed `nextInt` sequence, asserting which child survives; `swapOperands` on `-` and `/`.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/scalar-mutate.test.ts tests/scalar-search.test.ts tests/scalar-search-parallel.test.ts
cd .. && bunx vitest run tests/integration/scalar-search-parallel.test.ts
```

**Exit criteria.** Exact groups 10 → 9 (units in them 39 → 37). Near pairs 553 → 551: `jStruct` 0.9 or more −1, 0.6 to 0.7 −1. No pair involving `scalar-mutate.ts` remains or appears.

### P6-2 — `xgcd` over a ring adapter

**Package:** `functions`. **File:** `functions/src/arithmetic/xgcd.ts`. **Pairs retired:** 1.

Inside the factory, where `BigNumber` and `Fraction` are in scope:

```ts
interface XgcdRing<T> {
  from(v: 0 | 1): T;
  isInt(v: T): boolean;
  floorDiv(a: T, b: T): T; // a.div(b).floor() / a.divide(b).floor()
  minus(a: T, b: T): T;
  times(a: T, b: T): T;
  lt(a: T, b: T): boolean;
  neg(a: T): T;
}

function _xgcdRing<T extends { isZero(): boolean; mod(b: T): T }>(
  ring: XgcdRing<T>,
  a: T,
  b: T
): unknown;
```

`_xgcdRing` is the current loop: build `zero` and `one` with `ring.from` on every call (as now), the integer check with the exact message `'Parameters in function xgcd must be integer numbers'`, `while (!b.isZero())`, and the final branch. `!a.isZero() ? lastx : 0` keeps the JS number `0`, and `config.matrix === 'Array' ? res : matrix(res)` stays. `_xgcdBigNumber` and `_xgcdFraction` stay as the typed-signature values, each one line over its adapter. `_xgcdFraction` keeps `if (!Fraction) throw new Error('Fraction is not available')`, and the Fraction signature is still registered only when `Fraction` is present.

**Public API and export lock:** unchanged. The typed signatures `'BigNumber, BigNumber'` and `'Fraction, Fraction'` keep their names.

**Risk.** The factory's BigNumber and Fraction paths have no test today: `factories-tier4.test.ts` calls `factory_xgcd` with numbers only, and the Fraction cases in `arithmetic-extended.test.ts` reach the typed `xgcd` in `functions/src/typed/arithmetic.ts`, not this factory.

**Pins first.** A new test that builds `createXgcd` with core's `BigNumber` and `Fraction` (or uses `factory_xgcd` if its scope provides them) and checks, for both types: `(36163, 21199)` gives `[1247, -7, 12]`; a negative input normalizes the sign; `(a, 0)`; `(0, 0)` gives a second element that is the number `0`; a non-integer throws the exact message; `config.matrix` `'Array'` against `'Matrix'`.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/factories-tier4.test.ts tests/arithmetic-extended.test.ts tests/cov-arithmetic.test.ts <new pin file>
```

**Exit criteria.** Near pairs −1 (0.8 to 0.9). `_xgcdBigNumber` and `_xgcdFraction` drop under 50 nodes.

### P6-3 — linearly implicit stiff driver

**Package:** `functions`. **File:** `functions/src/numeric/solveODE.ts`. **Pairs retired:** 1.

Module-private driver:

```ts
function _linearlyImplicitDriver(
  name: 'Rosenbrock' | 'RODAS',
  f: ForcingFunction,
  tspan: unknown[],
  y0raw: unknown[],
  options: ODEOptions,
  control: { growMax: number; shrinkMin: number; exponent: number },
  step: (
    t: number,
    y: number[],
    h: number,
    F0: number[],
    J: number[][]
  ) => { yNew: number[]; err: number[] }
): { t: number[]; y: number[][] };
```

The driver owns the `tspan` / `y0` validation (messages built from `name`: `The "Rosenbrock" stiff method requires numeric tspan`, `… requires plain-number state (y0)`), `dir`, `rtol` / `atol` / `maxIter` / `span`, the Hairer initial step or `firstStep`, the overshoot clamp, `F0 = _fArr(f, t, y)` and `J = _jacobianAt(f, t, y, F0, options)`, the scaled RMS norm of `err`, the accept test, `h *= Math.min(growMax, Math.max(shrinkMin, 0.9 * Math.pow(errNorm || 1e-10, exponent)))`, the min/max step clamp, and the `maxIter` error.

- `rosenbrockSolve` passes `{ growMax: 4, shrinkMin: 0.25, exponent: -1 / 3 }` and a step that forms `W = I − hγJ`, runs the three stages, and returns `err[i] = (h / 6) * (k1[i] - 2 * k2[i] + k3[i])`.
- `rodasSolve` passes `{ growMax: 6, shrinkMin: 0.2, exponent: -1 / 4 }` and a step that computes `fx = _fdTimeDerivative(f, t, y, F0)` first, forms `E = I/(γh) − J`, runs the six stages, and returns `err = k6`.

The order of `f` evaluations is unchanged: the initial-step probe, then `F0`, the Jacobian, then (RODAS only) `fx`, then the stages. `stiffODESolver` keeps calling `rosenbrockSolve`, whose signature does not change.

**Public API and export lock:** `rosenbrockSolve`, `rodasSolve`, and `createSolveODE` keep their signatures. No export changes.

**Risk.** The error strings carry the method name, and no test pins them today. Moving the `fx` evaluation before the Jacobian would change call counts for a counting `f`.

**Pins first.** Both methods' error strings (non-numeric `tspan`, non-number `y0`, `maxIter` reached); `t` and `y` arrays for one fixed stiff problem per method compared with `toEqual` (exact), so any reordering fails; and an `f` call count per method.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/solveode-jspath.test.ts tests/gap-stiff-rodas-oracle.test.ts tests/stiffodesolver-correct.test.ts tests/solveode-events.test.ts <new pin file>
```

**Exit criteria.** Near pairs −1 (0.6 to 0.7). If the two wrappers still report as a pair through their step bodies (three stages against six, different coefficients), the PR lists it; that residue is the tableau, which is the numeric definition, so it is KEEP.

### P6-4 — robust-loss gradient

**Package:** `functions`. **File:** `functions/src/fit-scalar.ts`. **Pairs retired:** 1.

Replace `gradL1` (550) and `gradHuber` (570) with one closure-local function:

```ts
function gradRobust(batch: EvalBatch, loss: 'l1' | 'huber'): number[];
```

1. One pass over `frozenRows`: on the first row where `rowActive` fails, return `freeIdx.map(() => Number.POSITIVE_INFINITY)`. Otherwise store `r[j] = batch.values[row] - observed[row]`.
2. The influence loop is chosen once, before it runs. For `'l1'`: `ws[j] = wAt(row) * (r[j] === 0 ? 0 : Math.sign(r[j]))`. For `'huber'`: `ws[j] = wAt(row) * (2 * Math.max(-1, Math.min(1, r[j])))`. Two monomorphic one-line loops, no callback.
3. For each free parameter, `terms[j] = ws[j] * batch.grad[row * p + pi]`, then `g[fi] = pairwiseSum(terms)`.

The product keeps its association: `w * s * g` is `(w * s) * g` today, and `ws[j] * g` is the same double. The result is bit-identical. `rowActive` and `wAt` are pure, so evaluating them once per row instead of once per row and parameter changes nothing; the early return still fires when any row is inactive, and an empty `freeIdx` still returns `[]`.

In `runAttempt` the three `gradFn` arms (645–676) share one scatter wrapper: `gFull = new Array(p).fill(0)`, then `gFull[freeIdx[fi]] = gFree[fi]`. `l2` passes `gradL2`; `l1` and `huber` pass `gradRobust` with their tag; other losses keep `undefined`.

**Public API and export lock:** unchanged; all of this is closure-local.

**Risk.** Rewriting step 2 as a per-row callback is the #454 shape. A change in the product's association changes the last bit.

**Pins first.** An exact (`toEqual`) gradient for L1 and for Huber on a small weighted fit with a zero residual, a residual beyond the Huber clamp, and one inactive row; and an exact BFGS result for each loss.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/fit-scalar-parameters.test.ts <new pin file>
```

**Exit criteria.** Near pairs −1 (0.7 to 0.8). `gradRobust` has one copy and does not pair with `gradL2`; if it does, the PR lists it.

### P6-5 — complex tangent family

**Package:** `core`. **File:** `core/src/types/complex.ts`. **Pairs retired:** 4.

Module-private helper beside `HYPERBOLIC_OVERFLOW_ARG`:

```ts
function tanFamily(t: number, h: number, cot: boolean, hyperbolic: boolean): Complex {
  let s: number;
  let q: number;
  if (Math.abs(h) > HYPERBOLIC_OVERFLOW_ARG) {
    s = 2 * Math.sin(t) * Math.exp(-Math.abs(h));
    q = Math.sign(h);
  } else {
    const d = cot ? Math.cosh(h) - Math.cos(t) : Math.cos(t) + Math.cosh(h);
    s = Math.sin(t) / d;
    q = Math.sinh(h) / d;
  }
  if (cot) {
    if (hyperbolic) s = -s;
    else q = -q;
  }
  return hyperbolic ? new Complex(q, s) : new Complex(s, q);
}
```

`tan()` is `tanFamily(2re, 2im, false, false)`, `cot()` is `tanFamily(2re, 2im, true, false)`, `tanh()` is `tanFamily(2im, 2re, false, true)`, and `coth()` is `tanFamily(2im, 2re, true, true)`. Each result matches today's bits. Floating-point addition commutes exactly (`cos 2y + cosh 2x`), `-(a / d)` equals `(-a) / d`, and `-(2 * s * e)` equals `(-2) * s * e`. The only difference is the sign bit of a NaN, which JavaScript does not expose.

**Public API and export lock:** the four methods keep their names; `Complex` keeps its kind.

**Risk.** These are scalar hot paths that `functions` reaches through typed dispatch. Two predictable branches per call should cost nothing, but that is to be measured, not assumed.

**Gate.** Warm at least five reps. Then time old and new alternately (ABBA) over 10⁶ random arguments, including some past the overflow threshold, for all four methods. Drop the PR if any method is slower by more than run-to-run noise.

**Pins first.** Exact bits (via `Float64Array` / `Object.is`) of all four methods on a grid that crosses `HYPERBOLIC_OVERFLOW_ARG` in both signs, and includes `±0` parts and poles.

**Tests that stay green:**

```bash
cd core && bun test --isolate --timeout 30000 tests/types/complex.test.ts tests/types/complex-coverage.test.ts tests/types/complex-oracle.test.ts <new pin file>
cd ../functions && bunx vitest run tests/typed-complex.test.ts
```

**Exit criteria.** Near pairs −4: 0.8 to 0.9 −1, 0.7 to 0.8 −1, 0.6 to 0.7 −2. The four methods drop under 50 nodes.

### P6-6 — timed worker exec

**Package:** `packages/workerpool`. **File:** `packages/workerpool/src/index.ts`. **Pairs retired:** 1.

Private method:

```ts
private async _timedExec<T>(
  target: string,
  params: unknown[],
  execOptions: ExecOptions | undefined,
  options: TaskOptions | undefined
): Promise<T>;
```

The body is today's `exec` (712) after its options object: the `this.pool` check with the message `'WorkerPool not initialized. Call initialize() first.'`, `taskTimeout ?? this.config.taskTimeout`, `performance.now()`, `.timeout(timeout)`, and `_recordExecution` on success and on failure (rethrow). `exec` passes `(method, params, { on: options?.on, transfer: options?.transfer }, options)`. `execFunction` (740) passes `(fn as unknown as string, [arg], undefined, options)`. Today `execFunction` calls `pool.exec(fn, [arg])` with two arguments. `Pool.exec` in `@danielsimonjr/workerpool` 10.2.2 reads `options` only as a value, and its function branch is `this.exec('run', [String(method), params], options)`, so passing `undefined` is the same call.

**Public API and export lock:** `exec` and `execFunction` keep their signatures. No export changes.

**Risk.** Building the `{ on, transfer }` object before the pool check reads two optional fields earlier, with no side effect. Dropping a `_recordExecution` call on the failure path would skew `stats()`.

**Pins first** (`execFunction` has no direct test): its result, the uninitialized throw, and a failing function counted in `totalTasksFailed`.

**Tests that stay green:**

```bash
cd packages/workerpool && bun test --isolate --timeout 30000
```

**Exit criteria.** Near pairs −1 (0.6 to 0.7).

### P6-7 — one parallel envelope in the worker pool

**Package:** `packages/workerpool`. **File:** `packages/workerpool/src/index.ts`. **Pairs retired:** 4.

Private method, replacing `runChunks` (2263):

```ts
private async runParallel<TChunk, TPart, TOut>(
  length: number,
  options: TaskOptions | undefined,
  spec: {
    sequential: () => TOut;
    chunks: () => TChunk[];
    send: (chunk: TChunk) => Promise<TPart>;
    combine: (parts: TPart[]) => TOut;
  }
): Promise<ParallelResult<TOut>>;
```

The body is the envelope as it is now: `start`, `shouldParallelize(length, options)`, the sequential record (`result: spec.sequential()` before `duration`), then `chunks()`, then `stats()`, then `Promise.all(chunks.map((c) => spec.send(c)))`, then `result: spec.combine(parts)` before `duration`, `chunks.length`, and `workersUsed: Math.min(chunks.length, stats.totalWorkers)`. The calls happen in that order, as today.

- `map` and `filter` call `runParallel` directly. Their `sequential` is `data.map(fn)` / `data.filter(predicate)`, `send` executes `'mapChunk'` / `'filterChunk'` with `[chunk, fnString]`, and `combine` is `.flat()`. `fn.toString()` is still taken once per call. `runChunks` is deleted.
- `sort` (2184) passes `[...data].sort(compare)`, `sortChunk` with `[chunk, compare?.toString()]`, and `kWayMerge` as the combiner.
- `reduce` (2319) passes `data.reduce(fn, initial)`, `reduceChunk` with `[chunk, fn.toString(), initial]`, and the partial fold `parts.reduce((acc, p) => fn(acc, p as unknown as T), initial)`.
- `reduceScalar` (765) stays as the adapter that `sum`, `prod`, and `norm` call. It keeps `chunkFloat64Array` and `[chunk.buffer, 0, chunk.length]`.

The array chunker is `this.chunkArray(data, options?.chunkSize ?? this.config.chunkSize)`, as now. No per-element callback is added: each `sequential` stays the closure it is, invoked once.

**Public API and export lock:** `map`, `filter`, `sort`, `reduce`, `sum`, `prod`, and `norm` keep their signatures. `runChunks` is private. No export changes.

**Risk.** A per-call closure that fails to inline could move the sub-threshold path of `sum` / `prod` / `norm`.

**Gate.** Warm at least five reps, then ABBA at `n = parallelThreshold - 1` for `sum`, `prod`, `norm`, `map`, and `reduce`. Drop the PR if any is slower by more than run-to-run noise.

**Pins first.** `s2r-clones-workerpool-chunks-oracle.test.ts` exists. Confirm that it covers `sort` with and without a comparator above the threshold, `reduce` with a non-zero `initial`, and the `chunks` / `parallelized` / `workersUsed` fields on both paths. Add what is missing.

**Tests that stay green:**

```bash
cd packages/workerpool && bun test --isolate --timeout 30000
```

That runs `index`, `worker-numerics`, `s2r-clones-workerpool-chunks-oracle`, `parallel-dispatch`, `bitwise-dispatch`, `dist-browser-safe`, and `fft-core`, among others.

**Exit criteria.** Near pairs −4 (all in 0.6 to 0.7). Deleting `runChunks` retires three of them. `sort` ↔ `reduce` retires if both drop under 50 nodes or stop pairing. If `sort` ↔ `reduce` or a new `map` ↔ `filter` pair still reports, the PR lists it: the remaining body is each method's own task and combiner over the shared envelope, and the reviewer decides by rule 2 whether it is residue (KEEP) or a further merge. The 20 worker per-element pairs stay; routing those methods through `runParallel` is optional and retires none.

### P6-8 — tensordot range kernel in the worker package

**Packages:** `packages/workerpool`, `parallel`. **Pairs retired:** 1.

New module `packages/workerpool/src/tensordot-range.ts`:

```ts
export function tensordotRange(
  a: Float64Array,
  aShape: readonly number[],
  b: Float64Array,
  bShape: readonly number[],
  axesA: readonly number[],
  axesB: readonly number[],
  resultShape: readonly number[],
  outStart: number,
  outEnd: number
): Float64Array;
```

The body is `tensordotChunkKernel` (`parallel/src/ComputePool.ts` 413) with `_tdRowMajorStrides` from `./worker-numerics.js` (pinned against core's `rowMajorStrides` by `worker-numerics.test.ts`) and `forEachMultiIndex` from `./multi-index.js`. It reads the readonly axes directly, with no `Array.from` copy. The loop order and the `acc +=` order stay. The module imports nothing outside `packages/workerpool/src/`, so `dist/worker.js` keeps its zero external imports.

- `worker.ts` `tensordotChunk` (770) becomes the message adapter: `tensordotRange(new Float64Array(aBuffer), aShape, new Float64Array(bBuffer), bShape, axesA, axesB, resultShape, outStart, outEnd).buffer`. `_tdFlatIndex` goes if nothing else uses it.
- `packages/workerpool/src/index.ts` adds `export { tensordotRange } from './tensordot-range.js';` beside `forEachMultiIndex`.
- `parallel/src/ComputePool.ts` imports `tensordotRange` from `@danielsimonjr/mathts-workerpool` and calls it on the sequential path (line 1453). It deletes `tensordotChunkKernel`, `_flatIndex`, and any import that becomes unused.

**Public API and export lock:** one addition, `@danielsimonjr/mathts-workerpool` `.` → `tensordotRange` (`function`). The precedent is `forEachMultiIndex` and `chunkTyped`, which the same entry exports so that `parallel` can share worker-side helpers. `tensordotChunkKernel` is not in the lock (`parallel` exports it from the module, not from its index). Update `tools/test/export-lock.json` in this PR.

**Risk.** A `Set` built from a readonly array and one built from an `Array.from` copy hold the same members, so the free-axis order cannot change. The worker adapter must still return a fresh `ArrayBuffer` of exactly `outEnd - outStart` doubles.

**Pins first.** No test calls either kernel by name. Add a `parallel` test that runs `ComputePool.tensordot` above the threshold (worker path) and below it (sequential path) on the same inputs and compares the `Float64Array` bytes. Add a workerpool test of `tensordotRange` against a naive reference for a rank-3 by rank-2 contraction and a sub-range.

**Tests that stay green:**

```bash
cd packages/workerpool && bun test --isolate --timeout 30000
cd ../../parallel && bun test --isolate --timeout 30000 tests/ComputePool.test.ts tests/ComputePool.coverage.test.ts tests/s2r-clones-compute-batch5-oracle.test.ts
```

**Bundle budget.** `packages/workerpool/dist/index.js` grows and `parallel/dist/index.js` shrinks by about the kernel's size. Refresh the budget for both.

**Exit criteria.** Near pairs −1 (0.9 or more). `tensordotRange` has one copy.

### P6-9 — AssemblyScript array header in core

**Packages:** `core`, `matrix`, `functions`. **Pairs retired:** 1.

New `core/src/wasm-as-header.ts`, exported from `core/src/internal.ts`:

```ts
export function allocAsHeader(
  mod: {
    __new(size: number, id: number): number;
    __pin(ptr: number): number;
    memory: WebAssembly.Memory;
  },
  byteLength: number,
  typeId: number
): { headerPtr: number; bufferPtr: number };
```

The body is `asAllocHeader` (`functions/src/wasm/bridges/common.ts` 180): pin a new `ArrayBuffer` (id 1), allocate the 12-byte header with `typeId`, pin it, and write `bufferPtr`, `bufferPtr`, and `byteLength` as little-endian `u32` at offsets 0, 4, and 8.

- `matrix/src/backends/wasm/as-typed-array.ts` `allocAsTypedView` (35) calls it and then builds `new Ctor(module.memory.buffer, bufferPtr, length)`. Its return type does not change. Its exported constants stay, because `WASMBackend.ts` and `WasmLoader.ts` import them.
- `functions/src/wasm/bridges/common.ts` deletes `asAllocHeader` and the `AS_ID_ARRAY_BUFFER` / `AS_HEADER_BYTES` constants (147, 151), which nothing else uses; `withAsF64` (250) calls `allocAsHeader`.

**Public API and export lock:** one addition, `@danielsimonjr/mathts-core` `./internal` → `allocAsHeader` (`function`). The precedent is `WasmModuleLoader` and `verifyWasmIntegrity`, which are shared WASM plumbing on the same entry. Update `tools/test/export-lock.json` in this PR.

**Risk.** The stub runtime never frees and `functions` calls `heap_reset` after each managed call. The helper allocates exactly what the two copies allocate, in the same order (buffer, then header), so heap growth does not change. No module state goes on the AssemblyScript heap.

**Pins first.** `as-typed-array-header.test.ts` and `wasm-bridge-clones-pin.test.ts` exist. Confirm that they assert the three header words and the allocation order; add a direct `allocAsHeader` test in core against a stub `{ __new, __pin, memory }`.

**Tests that stay green:**

```bash
cd core && bun test --isolate --timeout 30000 <new pin file>
cd ../matrix && bun test --isolate --timeout 30000 tests/backends/as-typed-array-header.test.ts tests/s2r-clones-batch4-oracle.test.ts tests/backends/wasm-memory-bounded.test.ts
cd ../functions && bunx vitest run tests/wasm-bridge-clones-pin.test.ts tests/wasm-heap-bounded.test.ts
```

**Exit criteria.** Near pairs −1 (0.7 to 0.8). The header write has one copy.

### P6-10 — WASM load paths in `WasmModuleLoader`

**Packages:** `core`, `functions`, `matrix`. **Pairs retired:** 3. This PR touches security invariant 1 (SHA-384 before instantiate).

Move `precompile` (public), `loadNodeWasm`, and `loadBrowserWasm` (protected) from `functions/src/wasm/WasmLoader.ts` (306, 368, 400) and `matrix/src/backends/WasmLoader.ts` (592, 658, 691) into `WasmModuleLoader` in `core/src/wasm-loader.ts`. The abstract declarations of the two loaders (299–300) become concrete methods. `getDefaultWasmPath` stays abstract.

- The bodies are the current ones. A diff of the two packages' copies shows only the integrity import (static against `await import('./wasm/integrity.js')`) and comments. In core they call `verifyWasmIntegrity` and `loadWasmManifest` from the same module.
- Node file access stays lazy: `await import('fs')` and `await import('util')` with `promisify(readFile)`, as now. Core's `wasm-loader.ts` already reaches Node APIs only through `import()` (lines 58, 90–91, 175–177), which the dist browser-safety scan ignores, so `core`'s entries gain no static `node:` import.
- `instance.exports as unknown as WasmModule` becomes `as unknown as TModule`.
- The browser path keeps its rule: when a manifest exists, materialize the buffer and verify it before `WebAssembly.compile`. Stream only when there is no manifest.
- Update the comment above the `./wasm-loader.js` re-export in `core/src/internal.ts`, CLAUDE.md "Security Invariants", and AGENTS.md invariant 1, so they name `WasmModuleLoader` as the class that runs the compare.

**Public API and export lock:** unchanged. `WasmModuleLoader` keeps its kind, and each package's `WasmLoader` class and singleton keep their names. The lock records names and kinds, not methods.

**Risk.** A path that compiles before it hashes. Losing the manifest check on the browser path to a streaming shortcut.

**Pins first** in both packages: `precompile()` rejects a tampered binary on the Node path, and the browser path (stubbed `fetch`, with the Node check spoofed off) rejects a tampered binary when a manifest is present. Both must be green before the move.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/security/wasm-loader-pin.test.ts tests/security/wasm-integrity.test.ts tests/wasm-resolve.test.ts
cd ../matrix && bun test --isolate --timeout 30000 tests/security/wasm-loader-pin.test.ts tests/security/wasm-integrity.test.ts tests/WasmLoader.test.ts tests/backends/WasmLoader-as.test.ts tests/backends/WasmLoader-browser.test.ts tests/backends/WasmLoader-pool.test.ts tests/wasm-resolve.test.ts
cd .. && bun run test:wasm:integration
bun run build && node tools/test/smoke-dist-node.mjs
```

**Bundle budget.** `core/dist/internal.js` grows, and `matrix/dist/index.js` and `functions/dist/index.js` shrink. Refresh the entries that move beyond tolerance.

**Exit criteria.** Near pairs −3: 0.9 or more −2, 0.8 to 0.9 −1. One copy of each load path.

### P6-11 — one GPU chain lifecycle

**Package:** `functions`. **File:** `functions/src/gpu/elementwise-gpu.ts`. **Pairs retired:** 1.

`chainGpuDispatchImpl` (307) and `chainReduceGpuDispatchImpl` (499) keep their gates and then call one lifecycle:

```ts
interface ChainTail<T> {
  encoderLabel: 'elementwise-chain' | 'elementwise-chain-reduce';
  stagingLabel: 'chain-staging' | 'reduce-staging';
  readBytes: number;
  extra?: { label: 'reduce-partials'; bytes: number };
  encode(ctx: {
    device: GPUDevice;
    shaders: ShaderManager;
    encoder: GPUCommandEncoder;
    chainOut: GPUBuffer;
    extra: GPUBuffer | undefined;
    params: GPUBuffer;
    staging: GPUBuffer;
    workgroups: number;
  }): void;
  finish(mapped: Float32Array): T;
}

async function runChainLifecycle<T>(
  ops: readonly string[],
  xs: Float64Array | Float32Array,
  options: GpuChainOptions | undefined,
  tail: (sizes: { bytes: number; workgroups: number }) => ChainTail<T>
): Promise<T | null>;
```

The lifecycle is the shared body: `getResources`, the three device-limit checks, `new Float32Array(xs)` (never `.from`), `pushErrorScope('validation')`, acquiring A, B, then `extra`, then staging, then params (today's order), writing the input and the IEEE uniform, one encoder, the ping-pong passes, `tail.encode` once, one `submit`, `popErrorScope`, the readback of `readBytes`, `tail.finish` once, the `catch` that returns `null`, and one copy of the `finally` block with its `scopePushed` / `scopePopped` comment and its releases in today's order. The chain tail copies `chainOut` to staging and returns the `Float32Array`. The reduce tail binds the reduction pipeline, copies the partials, and returns `reduceNumbers(parts, reduce)`.

The wrappers keep their gates: `enabled`, `ops.length === 0`, `GPU_MIN_ELEMENTS`, `isGpuChainSupported`, and for reduce `GPU_REDUCE_OPS.includes(reduce)`. The exported dispatchers keep `serializeGpu`.

**Public API and export lock:** `elementwiseChainGpuDispatch` and `elementwiseChainReduceGpuDispatch` keep their signatures. No export changes.

**Risk.** An unbalanced error scope reads back zeros. A release that the `finally` skips leaks pool buffers.

**Pins first.** Count `pushErrorScope` / `popErrorScope` on a stubbed device for: success, a below-threshold `null`, a device-limit `null` after `getResources`, and a throw between push and pop. Every case must end balanced, and every acquired buffer must be released once. There is no Node seam today: stub `navigator.gpu` in a Node test, or put the pin in `gpu-elementwise.browser.test.ts`, which CI runs on SwiftShader.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/gpu-elementwise.test.ts tests/gpu.test.ts
cd .. && bun run test:browser   # the gpu-*.browser.test.ts files; CI runs them on SwiftShader
```

**Exit criteria.** Near pairs −1 (0.8 to 0.9).

### Exit criteria, all PRs

The counts assume each PR retires exactly its own pairs and creates none. The re-measure on each branch is the authority.

| After | Retires | Near pairs | 0.9+ | 0.8–0.9 | 0.7–0.8 | 0.6–0.7 | <0.6 | Exact groups (units) |
| ----- | ------: | ---------: | ---: | ------: | ------: | ------: | ---: | -------------------- |
| base  |         |        553 |  109 |     159 |      90 |     171 |   24 | 10 (39)              |
| P6-1  |       2 |        551 |  108 |     159 |      90 |     170 |   24 | 9 (37)               |
| P6-2  |       1 |        550 |  108 |     158 |      90 |     170 |   24 | 9 (37)               |
| P6-3  |       1 |        549 |  108 |     158 |      90 |     169 |   24 | 9 (37)               |
| P6-4  |       1 |        548 |  108 |     158 |      89 |     169 |   24 | 9 (37)               |
| P6-5  |       4 |        544 |  108 |     157 |      88 |     167 |   24 | 9 (37)               |
| P6-6  |       1 |        543 |  108 |     157 |      88 |     166 |   24 | 9 (37)               |
| P6-7  |       4 |        539 |  108 |     157 |      88 |     162 |   24 | 9 (37)               |
| P6-8  |       1 |        538 |  107 |     157 |      88 |     162 |   24 | 9 (37)               |
| P6-9  |       1 |        537 |  107 |     157 |      87 |     162 |   24 | 9 (37)               |
| P6-10 |       3 |        534 |  105 |     156 |      87 |     162 |   24 | 9 (37)               |
| P6-11 |       1 |        533 |  105 |     155 |      87 |     162 |   24 | 9 (37)               |

Rows are cumulative in the recommended order. Each PR's own delta is the same whatever the order. Text-identical groups stay at 4. After the last PR, Phase 7 measures `main` again. Phase 7 is clean only if its plan finds no MERGE pair among what remains, including any pair these PRs created.

## KEEP

533 pairs. The reason given is the line that would change behavior or measured speed. Counts are reported pairs, not a Cartesian product. The buckets sum to 533 and fall into four classes: intentional copies (292), an operator inside a measured loop (164), different computations (63), and false positives (14).

| Bucket                                                   | Class                       |   Pairs |
| -------------------------------------------------------- | --------------------------- | ------: |
| Unary `Float64Array` overloads                           | Intentional copy            |     255 |
| AssemblyScript against JavaScript fallback               | Intentional copy            |      22 |
| Worker-bundle layering                                   | Intentional copy            |       4 |
| Sandbox and integrity paths                              | Intentional copy            |       5 |
| Local guards and `factory` generics                      | Intentional copy            |       6 |
| AssemblyScript operator loops                            | Operator in a measured loop |      73 |
| Tape adjoints and batched contractions                   | Operator in a measured loop |      34 |
| `JSBackend`, `Tensor`, and `DualTensor` element loops    | Operator in a measured loop |      20 |
| Scalar ladder and compensated sums                       | Operator in a measured loop |       9 |
| Worker-pool per-element methods                          | Operator in a measured loop |      24 |
| Callback-shape and sparse loops                          | Operator in a measured loop |       4 |
| Solvers, substitutions, and factorizations               | Different computation       |      19 |
| Special functions, series, and typed numeric definitions | Different computation       |      20 |
| Shells around an existing shared helper                  | Different computation       |      18 |
| Small control-flow splits                                | Different computation       |       6 |
| Containment false matches                                | False positive              |      12 |
| Literal data                                             | False positive              |       2 |
| **Total KEEP**                                           |                             | **533** |

### Intentional copies (292)

**Unary `Float64Array` overloads (255).** The 25 unary signatures in `functions/src/typed/arithmetic.ts` and `functions/src/typed/trigonometry.ts`, and their pairs with `mapArray` / `mapBinaryF64` in `functions/src/typed/parallel-map.ts`. Each is `shouldParallelize`, then `applyKernel` with its kernel string, else one monomorphic loop over one `Math.*` call. PR #454 measured the shared `mapArray` callback 56% to 643% slower on that path. Exact groups 1, 2, and 6 are in this bucket. A generator that emits one monomorphic loop per kernel would be a new design, not a clone PR.

**AssemblyScript against JavaScript fallback (22).** The JS function runs when the module is not loaded or the dispatch policy declines it, and AssemblyScript cannot import a TypeScript package. Carlson RC / RD / RF / RJ (exact group 7 is `_carlsonRC`), the incomplete and complete elliptic integrals, `erfi`, Hankel, Bessel J0 / J1 / Y0 / Y1 series, `sinIntegral`, `expIntegralEi`, Goertzel, chirp-Z, `_fftInterleaved`, `determinant` against `resultantJS`, and `_erfSeries` against `erfcSelfContained`.

**Worker-bundle layering (4).** `mulberry32` ↔ `_workerMulberry32` (exact group 8; `workerpool` cannot import `core`). `gammaSampleRng` ↔ `_workerGammaRandom`, `fftCoreFloat64` ↔ `fftFrameInPlace`, and `gaussQuadSerial` ↔ `integrateChunk`: the source kernels live in `functions`, `dist/worker.js` cannot import `functions` (a cycle), and `functions` does not depend on `workerpool`. Parity tests pin them: `worker-numerics.test.ts`, `fft-core.test.ts`, `dist-objects-sampleN-oracle.test.ts`, `ComputePool.coverage.test.ts`.

**Sandbox and integrity paths (5).** The three `isSafeMethod` copies (exact group 4) are each package's sandbox predicate. `_getObjectProperty` / `_setObjectProperty` share only the index check; `getSafeProperty` and `setSafeProperty` stay separate calls. `getImports` ↔ `WASMBackend.loadAsModule` (j 0.232) is the import object against the integrity-checked instantiate.

**Local guards and `factory` generics (6).** The three `factory` copies (exact group 5) differ in the generic constraint, and core's is TS2345 at the other packages' call sites. `isBigNumber` in expression and functions (exact group 9) are local copies on the measured fast path, and core's shorter sibling pairs with each at 0.861.

### Operator inside a measured loop (164)

**AssemblyScript operator loops (73).** The operator or the second array is the body of the loop: `@inline` `f64Add` / `f64Sub` / `f64Mul` / `f64Div` / `f64Min` / `f64Max`, the bitwise `i32` loops, value sorts against index sorts, the complex array loops, `matrix_vector_multiply` against `matrix_gemv` (where `beta == 0` still reads `y`), the two determinants and their Sylvester callers, curve fits on different variables, and Bessel J0 / J1 recurrences.

**Tape adjoints and batched contractions (34).** `autograd/src/tape.ts`. The unary methods share `tape.record` and differ in the forward value and the adjoint (`sin` is `dY*cos`, `log` divides by `x`, and so on). `add` / `sub` / `mul` are different element formulas, `sum` / `mean` differ by the `1/N` broadcast, the eigen backward passes use a symmetrizer against a gauge, and `svd` against `_eigSymmetric` is a different factorization. Exact group 3, the `_batchedMatmul` trio, is in this bucket.

**`JSBackend`, `Tensor`, and `DualTensor` element loops (20).** `add`, `subtract`, `multiplyElementwise`, `divideElementwise`, `scale`, `abs`, and `transpose` share the `i, j` store; the stored expression differs. `Tensor` and `DualTensor` `add` / `sub` are `+` against `-`. A per-element callback is the measured loss.

**Scalar ladder and compensated sums (9).** `addScalar` / `subtractScalar` / `multiplyScalar` / `divideScalar` share the promotion ladder, and the arms are the operator. `norm2` / `scaledDistance`, `neumaierSum` / `neumaierCumsum`, and `pairwiseSum` / `pairwiseDot` differ in what each lane accumulates.

**Worker-pool per-element methods (24).** `sum` / `prod` and `sum` / `norm` (rule 2, after PR-H). Twenty pairs among `scale`, `bitwiseNot`, `unary`, `applyKernel`, `applyKernel2`, `elementwise`, `bitwiseBinary`, `bitwiseScalar`, `dot`, `distance`, `matmul`, `matvec`, `distanceMatrix`, and `outer` (rule 2: the residue after P6-7 is each sequential loop). `applyKernelChunk` / `applyKernel2Chunk` and `bitwiseChunk` / `bitwiseScalarChunk` are arity splits inside the worker's element loop.

**Callback-shape and sparse loops (4).** `_reduce` / `_mapSlices`, `matAlgo13` / `matAlgo14` `_iterate` (dense-dense against scalar with reversed operands), and `recursiveMapWithIndex` / `recursiveMap` differ in the callback's arity inside the recursion. `SparseMatrix.multiplyElementwise` ↔ `mapNonZeros`: a per-nonzero callback measured +12.4% at 2000×2000, tried in #481 and reverted.

### Different computations (63)

**Solvers, substitutions, and factorizations (19).** `makeILU0` / `makeIC0`; `_denseSolve` / `_inlineLuSolve` / `solveLinearSystem` (three pivot and singular policies); dense and sparse `lsolve` / `usolve` and `lsolveAll` / `usolveAll` (opposite directions); `condest` `luSolve` / `luSolveTranspose`, Gaussian-process `forwardSolve` / `backSolveTranspose`, and `tensor` `forwardSub` / `backSub` (opposite axis or diagonal policy); `applyGivensCols` / `applyGivensLeft`; `sqrtmSymmetric` / `sqrtmGeneral`; `solveAugmentedNormalEquations` / `linsolve`; `invertUnscaled` against `matrixInverse` and `_matInverse` (cutoffs `1e-12` against `1e-15`); `incompleteCholesky` / `_cholesky`; `cg` / `bicgstab`; `validateEigenvalues` / `logmEig`.

**Special functions, series, and typed numeric definitions (20).** The term, seed, band, or kernel differs inside the loop: Bessel J0 / J1 series, Fresnel C / S, `erfc2` / `erfc3`, Ferrers and spheroidal continuations, `besselJScalar` / `besselYScalar`, `dct` / `dst`, Ricker / Morlet. `newton` / `halley` already share `iterateRoot`. BigNumber `sinh` / `tanh` and the two Taylor helpers, `Decimal.plus` / `minus`, the BigNumber shift policies, the typed `xgcd` `number` / `bigint` signatures (pre-floor against truncating division), number against BigNumber Jacobi, the Bernoulli precision cache, the two NNLS `gradient`s (fused against materialized residual), and `aggregateRestartVectors` / `_aggregateEigenvector` (sign alignment).

**Shells around an existing shared helper (18).** The shell is already shared and the remaining bodies are different kernels: `GPUMatrixBackend` `addAsync` / `scaleAsync` / `multiplyAsync`; `planRunShaderFromAdd` / `planRunShaderFromTranspose` (`RunShaderPlan`); the `functions` WASM dispatchers (`withAsF64` holds the marshalling); `ParallelBackend` `scale` / `multiply` / `transpose` / `sum` (`whenParallel`); `ParallelMatrix` (`scatterBlocks` / `sumBlocks`); the two `DenseMatrix, DenseMatrix` handlers in `parallel-matrix.ts` (multiply against matvec); and `WASMBackend` `inverse` / `choleskyDecomposition` / `luDecomposition` (rule 3).

**Small control-flow splits (6).** `parseShift` / `parseLeftHandOperators` (binary infix over `parseConversion` against postfix over `parseCustomNodes`), `control-equations` `transpose` / `matadd`, the two `norm1`s (NaN policy: `Math.max` against `>`), `SparseMatrix.multiplyElementwise` / `multiply`, `bfs` / `visit` (FIFO against recursive DFS, j 0.400), and `fullSimplify` / `_casSimplifyOne` (j 0.375).

### False positives (14)

**Containment false matches (12).** `jStruct` is below 0.6, and containment reported the pair because the smaller body is a loop that the larger function also contains. Sharing it would merge unrelated algorithms.

| Pair                                       | jStruct | What is contained                      |
| ------------------------------------------ | ------: | -------------------------------------- |
| `vecRowMajor` ↔ `matrixExpm`               |   0.247 | the final copy loop of the exponential |
| `_eigSymBackward` ↔ `transposeSquare`      |   0.221 | a transpose inside the adjoint         |
| `nnls` `gradient` ↔ `lsqBounded`           |   0.220 | the gradient loop inside the solver    |
| `bfgs` `matVec` ↔ `lsqBounded`             |   0.194 | a matrix-vector product                |
| `luDecomposition` ↔ `transposeSquare`      |   0.176 | a transpose in the factorization       |
| `_svdBackward` ↔ `transposeSquare`         |   0.138 | a transpose inside the adjoint         |
| `qr` ↔ `transposeSquare`                   |   0.116 | a transpose in QR                      |
| `compileFunctionNode` ↔ `compileArrayNode` |   0.105 | the child-compile loop                 |
| `transposeSquare` ↔ `tensorSolve`          |   0.074 | a transpose in the solve               |
| `eigGeneral` ↔ `gemmRows`                  |   0.036 | a GEMM-shaped nest                     |
| `eigGeneral` ↔ `transposeSquare`           |   0.025 | a transpose in the general eig         |
| `_intersect3dHelper` ↔ `createComplexEigs` |   0.022 | an unrelated numeric nest              |

**Literal data (2).** `detectSIMD` / `detectBulkMemory` (j 1.000) already share `testWasmFeature`; what remains is two byte arrays. `_rk23` / `_rk45` (0.639) are Butcher tableaus; the shared `_rk` shell already runs them.

## Cross-cutting rules

Four shapes cover the merges. Each one leaves the numeric choice at the call site.

1. **A callback invoked once per call.** `replaceBinaryOp`'s `replacement`, `runParallel`'s `sequential` / `chunks` / `send` / `combine`, `_linearlyImplicitDriver`'s `step`, and `runChainLifecycle`'s `tail`.
2. **A choice made outside the element loop.** `rotateAt`'s `side`, `tanFamily`'s two booleans, and `gradRobust`'s `loss`, which selects one of two monomorphic loops.
3. **An adapter over method names.** `XgcdRing` maps BigNumber and Fraction methods once per call.
4. **One home for one ABI or one kernel.** `allocAsHeader` and the `WasmModuleLoader` load paths in core `/internal`, and `tensordotRange` in `workerpool`, where both bundles can reach it.

Rejected as shared utilities, because each would hide a real difference or cost measured speed:

- A per-element callback for the `Float64Array` overloads, `JSBackend`, the tape adjoints, the AssemblyScript `@inline` operators, the worker sequential loops, or `SparseMatrix.mapNonZeros`.
- One `factory` generic, one `isBigNumber` import, or one `isSafeMethod` on core `/internal`.
- Moving `gammaSampleRng`, `fftCoreFloat64`, or `gaussQuadSerial` into `workerpool`. That would add a `functions` → `workerpool` edge and make the pool package the home of `functions` kernels.
- A `WASMBackend` call-envelope helper with five callbacks (rule 3).

## Observations that are not clone PRs

- The "Phase 6 and up: clone-reduction loop" section appears twice in `PYSR_INFORMED_ROADMAP.md` (from line 1405 and again from line 1462, verbatim). A docs-only change should delete the second copy.
- `AccessorNode._toTex` (`expression/src/node/AccessorNode.ts` 250) still assigns the literal `"\\left(' + object + '\\right)"`, so a parenthesized object renders that text instead of TeX. The previous plan recorded it; it is under the 50-node cutoff and still open.
- `GPUBackend.add` / `matmul` / `transpose` (`matrix/src/backends/GPUBackend.ts` 212, 222, 235) still skip `serializeGpu`, so a WebGPU validation error can read back zeros.
- `ParallelMatrix.elementwise` (`parallel/src/ParallelMatrix.ts` 288) calls a per-element `op` callback on its sequential path (`add`, `subtract`, `elementMultiply`). That is the #454 shape on a hot path. It is not a clone pair, and it needs a measurement before any change.
- Core's `deepMap` / `deepForEach` / `reduce` (`/internal`) are still typed for flat arrays while they recurse into nested ones.
- After P6-7, the twenty worker per-element methods could route their envelopes through `runParallel`. That would remove code but retire no pair, so it is optional and not a Phase 6 PR.

## Constraints

- This plan and the ledger are documentation only. Implementation is the Phase 6 build step, one PR at a time.
- Each implementation PR carries a patch changeset for each published package it changes. This plan PR needs none.
- No tag, no GitHub Release, and no publish. Do not set `RELEASES_ENABLED`. §7 stays shut.
- Do not touch, merge, or close PR #398.
- No force-push to shared branches.
- Do not change `REPO_TOOLS_VERSION: 2.2.4` in `.github/workflows/ci.yml`.

## Appendix

Every near pair in the ledger, highest `jStruct` first, with its verdict. `j` is `jStruct`. The line is the function start in `40466a97`. A pair from an exact group is listed at `j` 1.000. 20 lines are MERGE and 533 are KEEP.

- `assembly/src/special.ts:617 _carlsonRC` ↔ `functions/src/wasm/special/wasm-bridge.ts:278 _carlsonRC` (j 1.000) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `autograd/src/tape.ts:2302 _batchedMatmul` ↔ `autograd/src/tape.ts:2345 _batchedMatmulGradA` (j 1.000) — **KEEP.** Three contractions: A@B, dY@Bᵀ, Aᵀ@dY, with different m/k/n and offsets. A shared GEMM sits on the tape hot path.
- `autograd/src/tape.ts:2302 _batchedMatmul` ↔ `autograd/src/tape.ts:2388 _batchedMatmulGradB` (j 1.000) — **KEEP.** Three contractions: A@B, dY@Bᵀ, Aᵀ@dY, with different m/k/n and offsets. A shared GEMM sits on the tape hot path.
- `autograd/src/tape.ts:2345 _batchedMatmulGradA` ↔ `autograd/src/tape.ts:2388 _batchedMatmulGradB` (j 1.000) — **KEEP.** Three contractions: A@B, dY@Bᵀ, Aᵀ@dY, with different m/k/n and offsets. A shared GEMM sits on the tape hot path.
- `core/src/customs.ts:113 isSafeMethod` ↔ `expression/src/utils/customs.ts:104 isSafeMethod` (j 1.000) — **KEEP.** Sandbox predicate. Expression types `method` as `unknown` and casts it to `string`. The core copy is not on `internal`.
- `core/src/customs.ts:113 isSafeMethod` ↔ `functions/src/utils/customs.ts:102 isSafeMethod` (j 1.000) — **KEEP.** Sandbox predicate. Text-identical except `export` on the core copy. The functions copy is not exported, and the core copy is not on `internal`.
- `core/src/factory.ts:83 factory` ↔ `expression/src/utils/factory.ts:94 factory` (j 1.000) — **KEEP.** Bodies match. The generic differs (Record<string, unknown> vs object vs Record<string, any>), and core's constraint is TS2345 at the call sites.
- `core/src/factory.ts:83 factory` ↔ `functions/src/utils/factory.ts:104 factory` (j 1.000) — **KEEP.** Bodies match. The generic differs (Record<string, unknown> vs object vs Record<string, any>), and core's constraint is TS2345 at the call sites.
- `core/src/numeric/rng.ts:27 mulberry32` ↔ `packages/workerpool/src/worker-numerics.ts:42 _workerMulberry32` (j 1.000) — **KEEP.** Same Mulberry32 closure. dist/worker.js cannot import core. worker-numerics.test.ts pins parity.
- `expression/src/utils/customs.ts:104 isSafeMethod` ↔ `functions/src/utils/customs.ts:102 isSafeMethod` (j 1.000) — **KEEP.** Sandbox predicate. Expression casts `method as string`. Functions types `method` as `string` and does not export the function.
- `expression/src/utils/factory.ts:94 factory` ↔ `functions/src/utils/factory.ts:104 factory` (j 1.000) — **KEEP.** Bodies match. The generic differs (Record<string, unknown> vs object vs Record<string, any>), and core's constraint is TS2345 at the call sites.
- `expression/src/utils/is.ts:291 isBigNumber` ↔ `functions/src/utils/is.ts:226 isBigNumber` (j 1.000) — **KEEP.** Local duck-test. A cross-module re-export measured about 40% slower on the Tukey path. The guard tests forbid export * from core.
- `functions/src/scalar-mutate.ts:366 rotateLeft` ↔ `functions/src/scalar-mutate.ts:381 rotateRight` (j 1.000) — **MERGE.** P6-1. Mirror rotations. The pivot is `args[0]` or `args[1]` and the rebuilt pair is ordered to match. One `rotateAt(opNode, side)` picks the side once per call. Cold tree edit.
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:704 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and cbrt loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and round loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and floor loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic sign and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and round loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and floor loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic cbrt and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:796 Float64Array` (j 1.000) — **KEEP.** Monomorphic log10 and log2 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:816 Float64Array` (j 1.000) — **KEEP.** Monomorphic log10 and log1p loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 1.000) — **KEEP.** Monomorphic log10 and expm1 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 1.000) — **KEEP.** Monomorphic log10 and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000) — **KEEP.** Monomorphic log10 and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000) — **KEEP.** Monomorphic log10 and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000) — **KEEP.** Monomorphic log10 and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:816 Float64Array` (j 1.000) — **KEEP.** Monomorphic log2 and log1p loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 1.000) — **KEEP.** Monomorphic log2 and expm1 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 1.000) — **KEEP.** Monomorphic log2 and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000) — **KEEP.** Monomorphic log2 and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000) — **KEEP.** Monomorphic log2 and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000) — **KEEP.** Monomorphic log2 and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 1.000) — **KEEP.** Monomorphic log1p and expm1 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 1.000) — **KEEP.** Monomorphic log1p and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000) — **KEEP.** Monomorphic log1p and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000) — **KEEP.** Monomorphic log1p and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000) — **KEEP.** Monomorphic log1p and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 1.000) — **KEEP.** Monomorphic expm1 and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000) — **KEEP.** Monomorphic expm1 and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000) — **KEEP.** Monomorphic expm1 and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000) — **KEEP.** Monomorphic expm1 and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 1.000) — **KEEP.** Monomorphic round and floor loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 1.000) — **KEEP.** Monomorphic round and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000) — **KEEP.** Monomorphic round and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000) — **KEEP.** Monomorphic round and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000) — **KEEP.** Monomorphic round and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000) — **KEEP.** Monomorphic round and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic round and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic round and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 1.000) — **KEEP.** Monomorphic floor and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000) — **KEEP.** Monomorphic floor and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000) — **KEEP.** Monomorphic floor and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000) — **KEEP.** Monomorphic floor and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000) — **KEEP.** Monomorphic floor and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic floor and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic floor and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000) — **KEEP.** Monomorphic ceil and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000) — **KEEP.** Monomorphic ceil and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000) — **KEEP.** Monomorphic ceil and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000) — **KEEP.** Monomorphic ceil and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic ceil and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic ceil and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000) — **KEEP.** Monomorphic fix and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000) — **KEEP.** Monomorphic fix and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000) — **KEEP.** Monomorphic fix and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic fix and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic fix and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000) — **KEEP.** Monomorphic sinh and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000) — **KEEP.** Monomorphic sinh and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000) — **KEEP.** Monomorphic sinh and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000) — **KEEP.** Monomorphic cosh and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000) — **KEEP.** Monomorphic cosh and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic cosh and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic cosh and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000) — **KEEP.** Monomorphic tanh and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000) — **KEEP.** Monomorphic tanh and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 1.000) — **KEEP.** Monomorphic csc and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 1.000) — **KEEP.** Monomorphic csc and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 1.000) — **KEEP.** Monomorphic sec and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000) — **KEEP.** Monomorphic asin and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic asin and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic asin and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:195 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000) — **KEEP.** Monomorphic acos and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:195 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic acos and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:215 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000) — **KEEP.** Monomorphic atan and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:279 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000) — **KEEP.** Monomorphic asinh and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `matrix/src/backends/wasm/detect.ts:60 detectSIMD` ↔ `matrix/src/backends/wasm/detect.ts:115 detectBulkMemory` (j 1.000) — **KEEP.** Both already call testWasmFeature. The remaining body is the probe byte array.
- `packages/workerpool/src/worker.ts:770 tensordotChunk` ↔ `parallel/src/ComputePool.ts:413 tensordotChunkKernel` (j 0.971) — **MERGE.** P6-8. The old reason covers one direction. `dist/worker.js` cannot import `parallel`, but `parallel` already imports `forEachMultiIndex` from `workerpool`, and the `ComputePool` comment says the kernel is exported to keep it in one place. The drift is `Array.from` copies of readonly axes and buffer unwrapping; loops and accumulation order match.
- `functions/src/wasm/WasmLoader.ts:368 loadNodeWasm` ↔ `matrix/src/backends/WasmLoader.ts:658 loadNodeWasm` (j 0.952) — **MERGE.** P6-10. Both `integrity.js` modules re-export core's `verifyWasmIntegrity` and `loadWasmManifest` unchanged; static against dynamic import is the only difference. In `WasmModuleLoader` the SHA-384 compare sits in the module that defines it.
- `functions/src/wasm/WasmLoader.ts:400 loadBrowserWasm` ↔ `matrix/src/backends/WasmLoader.ts:691 loadBrowserWasm` (j 0.919) — **MERGE.** P6-10. Both `integrity.js` modules re-export core's `verifyWasmIntegrity` and `loadWasmManifest` unchanged; static against dynamic import is the only difference. In `WasmModuleLoader` the SHA-384 compare sits in the module that defines it.
- `matrix/src/backends/JSBackend.ts:123 abs` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.917) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `assembly/src/special.ts:709 _carlsonRJ` ↔ `functions/src/wasm/special/wasm-bridge.ts:379 _carlsonRJ` (j 0.915) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `assembly/src/special.ts:783 _ellipticPiIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:459 _ellipticPiIncomplete` (j 0.909) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `assembly/src/sort.ts:116 _heapsort` ↔ `assembly/src/sort.ts:217 _heapsortIdx` (j 0.905) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:858 cos` (j 0.900) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `matrix/src/backends/GPUMatrixBackend.ts:183 addAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:282 multiplyAsync` (j 0.900) — **KEEP.** Different kernels and result shapes. gpuOrJs is already the shared never-throw shell.
- `assembly/src/special.ts:772 _ellipticEIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:448 _ellipticEIncomplete` (j 0.898) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/probability/util/gammaSample.ts:24 gammaSampleRng` ↔ `packages/workerpool/src/worker.ts:850 _workerGammaRandom` (j 0.891) — **KEEP.** `dist/worker.js` cannot import `functions` (that is a cycle). `functions` does not depend on `workerpool`; reading the worker copy would add that package edge and make the pool package the home of a `functions` kernel. The worker copy is the bundle; parity tests pin it (`fft-core.test.ts`, `dist-objects-sampleN-oracle.test.ts`, `ComputePool.coverage.test.ts`).
- `packages/workerpool/src/worker.ts:250 applyKernelChunk` ↔ `packages/workerpool/src/worker.ts:271 applyKernel2Chunk` (j 0.889) — **KEEP.** Same-file arity split: one array against two, or an array operand against a scalar.
- `functions/src/gpu/elementwise-gpu.ts:307 chainGpuDispatchImpl` ↔ `functions/src/gpu/elementwise-gpu.ts:499 chainReduceGpuDispatchImpl` (j 0.888) — **MERGE.** P6-11. Same gates, limit checks, scope push, ping-pong encode, pop, readback and release. The reduce variant adds one gate, one buffer, one pass and a CPU fold, once per call. One lifecycle owns the push/pop pair; land the scope-balance pin first.
- `functions/src/numeric/krylov.ts:223 makeILU0` ↔ `functions/src/numeric/krylov.ts:244 makeIC0` (j 0.887) — **KEEP.** ILU0 writes a unit lower factor and divides by U. IC0 divides by L on both sweeps.
- `core/src/numeric/stable.ts:132 norm2` ↔ `core/src/numeric/stable.ts:222 scaledDistance` (j 0.881) — **KEEP.** norm2 scales one vector's entries. scaledDistance scales a[i]-b[i]. Documented hot loop.
- `assembly/src/special.ts:667 _carlsonRD` ↔ `functions/src/wasm/special/wasm-bridge.ts:329 _carlsonRD` (j 0.877) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/wasm/WasmLoader.ts:306 precompile` ↔ `matrix/src/backends/WasmLoader.ts:592 precompile` (j 0.877) — **MERGE.** P6-10. Both `integrity.js` modules re-export core's `verifyWasmIntegrity` and `loadWasmManifest` unchanged; static against dynamic import is the only difference. In `WasmModuleLoader` the SHA-384 compare sits in the module that defines it.
- `matrix/src/backends/GPUMatrixBackend.ts:183 addAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:242 scaleAsync` (j 0.875) — **KEEP.** Different kernels and result shapes. gpuOrJs is already the shared never-throw shell.
- `autograd/src/tape.ts:475 sum` ↔ `autograd/src/tape.ts:500 mean` (j 0.874) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `matrix/src/backends/WASMBackend.ts:779 inverse` ↔ `matrix/src/backends/WASMBackend.ts:894 choleskyDecomposition` (j 0.873) — **KEEP.** Shared part is about ten lines: square check, JS fallback, `allocCache` allocate and release. Buffer count and type (LU adds an `Int32Array` permutation, inverse an n·n+n work buffer), kernel arity, error string, failure value and result fields differ; a helper would need five callbacks.
- `assembly/src/special.ts:762 _ellipticFIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:438 _ellipticFIncomplete` (j 0.872) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/numeric/solveDAE.ts:184 _denseSolve` ↔ `functions/src/numeric/solveODE.ts:137 _inlineLuSolve` (j 0.872) — **KEEP.** Pivot policy differs: NaN below 1e-300, no cutoff, or throw below 1e-14. A mode flag would sit on the stiff-step loop. Inline LU is the measured n=1–3 path.
- `functions/src/algebra/solver/lsolveAll.ts:149 _denseForwardSubstitution` ↔ `functions/src/algebra/solver/usolveAll.ts:149 _denseBackwardSubstitution` (j 0.869) — **KEEP.** Opposite triangle direction, including the sparse CSC pointer walk. A zero pivot throws.
- `functions/src/algebra/solver/lsolveAll.ts:218 _sparseForwardSubstitution` ↔ `functions/src/algebra/solver/usolveAll.ts:218 _sparseBackwardSubstitution` (j 0.867) — **KEEP.** Opposite triangle direction, including the sparse CSC pointer walk. A zero pivot throws.
- `packages/workerpool/src/index.ts:955 scale` ↔ `packages/workerpool/src/index.ts:1143 bitwiseNot` (j 0.862) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `core/src/is.ts:155 isBigNumber` ↔ `expression/src/utils/is.ts:291 isBigNumber` (j 0.861) — **KEEP.** Local duck-test. A cross-module re-export measured about 40% slower on the Tukey path. The guard tests forbid export * from core.
- `core/src/is.ts:155 isBigNumber` ↔ `functions/src/utils/is.ts:226 isBigNumber` (j 0.861) — **KEEP.** Local duck-test. A cross-module re-export measured about 40% slower on the Tukey path. The guard tests forbid export * from core.
- `assembly/src/ops/complex-array.ts:120 complex_array_mul` ↔ `assembly/src/ops/complex-array.ts:165 complex_array_scale_complex` (j 0.855) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/sort.ts:98 _siftDown` ↔ `assembly/src/sort.ts:200 _siftDownIdx` (j 0.852) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/special.ts:544 _ellipticK` ↔ `functions/src/wasm/special/scalars.ts:333 ellipticKScalar` (j 0.849) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/arithmetic/xgcd.ts:99 _xgcdBigNumber` ↔ `functions/src/arithmetic/xgcd.ts:153 _xgcdFraction` (j 0.846) — **MERGE.** P6-2. Same extended Euclid on two arbitrary-precision object types. The operations are the same; only the method names differ (`div`/`divide`, `minus`/`subtract`, `times`/`multiply`, `lt`/`lessThan`, `neg`/`negate`, `isInt`/`isInteger`). No number path and no measured loop.
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842) — **KEEP.** Monomorphic log10 and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842) — **KEEP.** Monomorphic log10 and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842) — **KEEP.** Monomorphic log10 and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842) — **KEEP.** Monomorphic log2 and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842) — **KEEP.** Monomorphic log2 and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842) — **KEEP.** Monomorphic log2 and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842) — **KEEP.** Monomorphic log1p and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842) — **KEEP.** Monomorphic log1p and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842) — **KEEP.** Monomorphic log1p and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842) — **KEEP.** Monomorphic expm1 and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842) — **KEEP.** Monomorphic expm1 and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842) — **KEEP.** Monomorphic expm1 and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842) — **KEEP.** Monomorphic sinh and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842) — **KEEP.** Monomorphic sinh and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842) — **KEEP.** Monomorphic sinh and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842) — **KEEP.** Monomorphic tanh and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842) — **KEEP.** Monomorphic tanh and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842) — **KEEP.** Monomorphic tanh and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.842) — **KEEP.** Monomorphic csc and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.842) — **KEEP.** Monomorphic csc and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.842) — **KEEP.** Monomorphic sec and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.842) — **KEEP.** Monomorphic sec and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.842) — **KEEP.** Monomorphic cot and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.842) — **KEEP.** Monomorphic cot and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:60 subtract` (j 0.840) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` (j 0.840) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:92 divideElementwise` (j 0.840) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` (j 0.840) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:92 divideElementwise` (j 0.840) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:92 divideElementwise` (j 0.840) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `assembly/src/special.ts:640 _carlsonRF` ↔ `functions/src/wasm/special/wasm-bridge.ts:301 _carlsonRF` (j 0.839) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:836 sin` (j 0.832) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `packages/workerpool/src/index.ts:955 scale` ↔ `packages/workerpool/src/index.ts:1633 applyKernel` (j 0.832) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `assembly/src/ops/special.ts:79 erfi` ↔ `functions/src/typed/special.ts:111 erfiScalar` (j 0.829) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `assembly/src/special.ts:101 _besselHankel` ↔ `functions/src/wasm/special/scalars.ts:132 besselHankel` (j 0.829) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `core/src/numeric/stable.ts:103 neumaierSum` ↔ `core/src/numeric/stable.ts:373 neumaierCumsum` (j 0.829) — **KEEP.** One compensated total (sum+c) against a prefix write out[i]=sum+c.
- `autograd/src/tape.ts:133 add` ↔ `autograd/src/tape.ts:148 sub` (j 0.828) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/dual-tensor.ts:77 add` ↔ `autograd/src/dual-tensor.ts:89 sub` (j 0.826) — **KEEP.** Hot element loop. add stores +, sub stores -.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.825) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.823) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/ops/polynomial.ts:140 resultantValue` ↔ `assembly/src/poly.ts:98 sylvesterDet` (j 0.821) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:817 exp` (j 0.821) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/sort.ts:85 _insertionSort` ↔ `assembly/src/sort.ts:188 _insertionSortIdx` (j 0.820) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/polynomial.ts:87 determinant` ↔ `assembly/src/poly.ts:60 detSquare` (j 0.818) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/matrix.ts:276 matrix_vector_multiply` ↔ `assembly/src/ops/matrix.ts:614 matrix_gemv` (j 0.814) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `packages/workerpool/src/worker.ts:311 bitwiseChunk` ↔ `packages/workerpool/src/worker.ts:353 bitwiseScalarChunk` (j 0.812) — **KEEP.** Same-file arity split: one array against two, or an array operand against a scalar.
- `packages/workerpool/src/index.ts:1143 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1633 applyKernel` (j 0.810) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `core/src/types/complex.ts:483 tan` ↔ `core/src/types/complex.ts:549 tanh` (j 0.803) — **MERGE.** P6-5. `tanh z = -i tan(iz)`: the same closed form, including the #516 overflow branch, with the doubled parts swapped. A private helper with two booleans and no callback; bit-identical.
- `assembly/src/ops/array.ts:89 array_argmin` ↔ `assembly/src/ops/array.ts:109 array_argmax` (j 0.800) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:774 Float64Array` (j 0.800) — **KEEP.** Monomorphic sign and log10 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:796 Float64Array` (j 0.800) — **KEEP.** Monomorphic sign and log2 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:816 Float64Array` (j 0.800) — **KEEP.** Monomorphic sign and log1p loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 0.800) — **KEEP.** Monomorphic sign and expm1 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800) — **KEEP.** Monomorphic sign and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800) — **KEEP.** Monomorphic sign and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic sign and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic sign and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:774 Float64Array` (j 0.800) — **KEEP.** Monomorphic cbrt and log10 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:796 Float64Array` (j 0.800) — **KEEP.** Monomorphic cbrt and log2 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:816 Float64Array` (j 0.800) — **KEEP.** Monomorphic cbrt and log1p loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 0.800) — **KEEP.** Monomorphic cbrt and expm1 loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800) — **KEEP.** Monomorphic cbrt and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800) — **KEEP.** Monomorphic cbrt and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic cbrt and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic cbrt and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and round loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and floor loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800) — **KEEP.** Monomorphic log10 and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and round loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and floor loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800) — **KEEP.** Monomorphic log2 and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and round loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and floor loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800) — **KEEP.** Monomorphic log1p and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and round loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and floor loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800) — **KEEP.** Monomorphic expm1 and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800) — **KEEP.** Monomorphic round and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800) — **KEEP.** Monomorphic round and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic round and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic round and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800) — **KEEP.** Monomorphic floor and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800) — **KEEP.** Monomorphic floor and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic floor and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic floor and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800) — **KEEP.** Monomorphic ceil and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800) — **KEEP.** Monomorphic ceil and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic ceil and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic ceil and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800) — **KEEP.** Monomorphic fix and sinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800) — **KEEP.** Monomorphic fix and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic fix and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic fix and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800) — **KEEP.** Monomorphic sinh and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800) — **KEEP.** Monomorphic sinh and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800) — **KEEP.** Monomorphic sinh and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800) — **KEEP.** Monomorphic sinh and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800) — **KEEP.** Monomorphic sinh and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800) — **KEEP.** Monomorphic cosh and tanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic cosh and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic cosh and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800) — **KEEP.** Monomorphic tanh and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800) — **KEEP.** Monomorphic tanh and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800) — **KEEP.** Monomorphic tanh and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800) — **KEEP.** Monomorphic tanh and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic asin and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic asin and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:195 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800) — **KEEP.** Monomorphic acos and atan loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:195 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic acos and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:215 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800) — **KEEP.** Monomorphic atan and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:215 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800) — **KEEP.** Monomorphic atan and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:279 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic asinh and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:299 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800) — **KEEP.** Monomorphic acosh and atanh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `assembly/src/ops/special.ts:117 sinIntegral` ↔ `functions/src/typed/special.ts:437 sinIntegralScalar` (j 0.798) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `assembly/src/special.ts:143 _besselJ1Series` ↔ `functions/src/wasm/special/scalars.ts:181 besselJ1Series` (j 0.797) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `matrix/src/operations/condest.ts:18 luSolve` ↔ `matrix/src/operations/condest.ts:47 luSolveTranspose` (j 0.794) — **KEEP.** Opposite order and axis. `luSolve` permutes `b`, runs unit-`L` forward and then `U` back with the divide; `luSolveTranspose` runs `Uᵀ` forward with the divide, then unit-`Lᵀ` back, then un-permutes. `[i*n+j]` against `[j*n+i]` is the kernel.
- `matrix/src/backends/GPUMatrixBackend.ts:242 scaleAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:282 multiplyAsync` (j 0.785) — **KEEP.** Different kernels and result shapes. gpuOrJs is already the shared never-throw shell.
- `matrix/src/operations/givens.ts:28 applyGivensCols` ↔ `matrix/src/operations/schur.ts:60 applyGivensLeft` (j 0.783) — **KEEP.** Columns (j,i)/(j,k) against rows (i,j)/(k,j).
- `assembly/src/ops/complex-array.ts:211 complex_array_abs` ↔ `assembly/src/ops/complex-array.ts:235 complex_array_abs_squared` (j 0.780) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/special.ts:129 _besselJ0Series` ↔ `functions/src/wasm/special/scalars.ts:164 besselJ0Series` (j 0.778) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/algebra/solver/lsolve.ts:134 _denseForwardSubstitution` ↔ `functions/src/algebra/solver/usolve.ts:134 _denseBackwardSubstitution` (j 0.774) — **KEEP.** Opposite triangle direction, including the sparse CSC pointer walk. A zero pivot throws.
- `functions/src/fit-scalar.ts:550 gradL1` ↔ `functions/src/fit-scalar.ts:570 gradHuber` (j 0.770) — **MERGE.** P6-4. Same weighted accumulation per free parameter. Compute the per-row influence (`sign` or `2*clamp`) in its own monomorphic loop, then share the accumulation. No callback in a loop, and `(w*s)*g` keeps its association.
- `assembly/src/ops/f64-buffer.ts:7 f64Min` ↔ `assembly/src/ops/f64-buffer.ts:21 f64Max` (j 0.769) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `packages/workerpool/src/index.ts:1193 matmul` ↔ `packages/workerpool/src/index.ts:1985 matvec` (j 0.766) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `packages/workerpool/src/index.ts:839 dot` ↔ `packages/workerpool/src/index.ts:1507 distance` (j 0.764) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `assembly/src/ops/curvefit.ts:31 logfit` ↔ `assembly/src/ops/curvefit.ts:55 powerfit` (j 0.762) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/f64-buffer.ts:35 f64Add` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/f64-buffer.ts:35 f64Add` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/f64-buffer.ts:35 f64Add` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/f64-buffer.ts:44 f64Sub` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/f64-buffer.ts:44 f64Sub` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/f64-buffer.ts:53 f64Mul` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/complex-array.ts:223 complex_array_arg` ↔ `assembly/src/ops/complex-array.ts:235 complex_array_abs_squared` (j 0.759) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/special.ts:564 _ellipticE` ↔ `functions/src/wasm/special/scalars.ts:355 ellipticECompleteScalar` (j 0.759) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `assembly/src/ops/special.ts:93 expIntegralEi` ↔ `functions/src/typed/special.ts:455 expIntegralEiScalar` (j 0.758) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `autograd/src/tape.ts:1970 _eigSymBackward` ↔ `autograd/src/tape.ts:2049 _eigGeneralBackward` (j 0.757) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/sort.ts:130 _introsort` ↔ `assembly/src/sort.ts:235 _introsortIdx` (j 0.756) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `tensor/src/Tensor.ts:161 add` ↔ `tensor/src/Tensor.ts:172 sub` (j 0.755) — **KEEP.** Hot element loop. add stores +, sub stores -.
- `packages/workerpool/src/index.ts:1193 matmul` ↔ `packages/workerpool/src/index.ts:1847 distanceMatrix` (j 0.754) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `assembly/src/ops/curvefit.ts:6 expfit` ↔ `assembly/src/ops/curvefit.ts:55 powerfit` (j 0.752) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:836 sin` (j 0.752) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/ops/complex-array.ts:211 complex_array_abs` ↔ `assembly/src/ops/complex-array.ts:223 complex_array_arg` (j 0.750) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/wasm/signal/wasm-bridge.ts:332 welchPSDDispatch` ↔ `functions/src/wasm/signal/wasm-bridge.ts:369 bartlettPSDDispatch` (j 0.750) — **KEEP.** The WASM-or-JS shell matches. The export, ABI, and result type differ. withAsF64 already holds the marshalling.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:858 cos` (j 0.748) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:858 cos` (j 0.746) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/wasm/poly/wasm-bridge.ts:109 polyMulDispatch` ↔ `functions/src/wasm/poly/wasm-bridge.ts:266 resultantDispatch` (j 0.745) — **KEEP.** The WASM-or-JS shell matches. The export, ABI, and result type differ. withAsF64 already holds the marshalling.
- `parallel/src/ParallelMatrix.ts:388 dotProduct` ↔ `parallel/src/ParallelMatrix.ts:421 sum` (j 0.744) — **KEEP.** The parallel shell is already `scatterBlocks` / `sumBlocks`. The residue is the sequential element loop: `sum += a[i]*b[i]` against `sum += a[i]`, or `op(a[i], b[i])` against `a[i]*scalar`.
- `functions/src/algebra/solver/lsolve.ts:184 _sparseForwardSubstitution` ↔ `functions/src/algebra/solver/usolve.ts:188 _sparseBackwardSubstitution` (j 0.742) — **KEEP.** Opposite triangle direction, including the sparse CSC pointer walk. A zero pivot throws.
- `matrix/src/backends/gpu/run-shader.ts:32 planRunShaderFromAdd` ↔ `matrix/src/backends/gpu/run-shader.ts:82 planRunShaderFromTranspose` (j 0.742) — **KEEP.** Different pipeline, buffer count, and bindings. RunShaderPlan is already shared.
- `packages/workerpool/src/index.ts:955 scale` ↔ `packages/workerpool/src/index.ts:1556 unary` (j 0.738) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `packages/workerpool/src/index.ts:1633 applyKernel` ↔ `packages/workerpool/src/index.ts:1683 applyKernel2` (j 0.732) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `expression/src/parse.ts:1031 parseShift` ↔ `expression/src/parse.ts:1441 parseLeftHandOperators` (j 0.731) — **KEEP.** Binary << >> >>> over parseConversion (inch special case inside the loop) against postfix ! and ' over parseCustomNodes.
- `functions/src/numeric/solveDAE.ts:184 _denseSolve` ↔ `functions/src/signal/fir-smoothing.ts:26 solveLinearSystem` (j 0.728) — **KEEP.** Pivot policy differs: NaN below 1e-300, no cutoff, or throw below 1e-14. A mode flag would sit on the stiff-step loop. Inline LU is the measured n=1–3 path.
- `functions/src/numeric/solveODE.ts:137 _inlineLuSolve` ↔ `functions/src/signal/fir-smoothing.ts:26 solveLinearSystem` (j 0.728) — **KEEP.** Pivot policy differs: NaN below 1e-300, no cutoff, or throw below 1e-14. A mode flag would sit on the stiff-step loop. Inline LU is the measured n=1–3 path.
- `assembly/src/signal.ts:236 goertzel_f64` ↔ `functions/src/wasm/signal/wasm-bridge.ts:93 goertzelJS` (j 0.727) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/wasm/bridges/common.ts:180 asAllocHeader` ↔ `matrix/src/backends/wasm/as-typed-array.ts:35 allocAsTypedView` (j 0.727) — **MERGE.** P6-9. The old reason is the extra step. Both pin a buffer, allocate the 12-byte header and write `[buffer, dataStart, byteLength]` as little-endian u32s; `allocAsTypedView` then builds one view, once per call. One AssemblyScript ABI layout in two packages; core `/internal` already holds the shared WASM plumbing.
- `functions/src/numeric/control-equations.ts:79 transpose` ↔ `functions/src/numeric/control-equations.ts:87 matadd` (j 0.724) — **KEEP.** T[j][i]=A[i][j] against C[i][j]=A[i][j]+s*B[i][j].
- `matrix/src/backends/JSBackend.ts:108 scale` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.723) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:880 tan` (j 0.720) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/special.ts:129 _besselJ0Series` ↔ `assembly/src/special.ts:143 _besselJ1Series` (j 0.718) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/matrix.ts:204 matrix_multiply` ↔ `assembly/src/ops/matrix.ts:583 matrix_gemm` (j 0.714) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:858 cos` ↔ `autograd/src/tape.ts:880 tan` (j 0.714) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/wasm/interpolation/wasm-bridge.ts:117 tridiagSolveDispatch` ↔ `functions/src/wasm/interpolation/wasm-bridge.ts:206 dividedDifferenceDispatch` (j 0.714) — **KEEP.** The WASM-or-JS shell matches. The export, ABI, and result type differ. withAsF64 already holds the marshalling.
- `packages/workerpool/src/index.ts:805 sum` ↔ `packages/workerpool/src/index.ts:822 prod` (j 0.710) — **KEEP.** PR-H (#504) already moved the envelope into `reduceScalar`. The residue is each sequential closure: `+=` from 0, `*=` from 1, or squares then `Math.sqrt`. That is the element loop.
- `core/src/types/complex.ts:498 cot` ↔ `core/src/types/complex.ts:562 coth` (j 0.706) — **MERGE.** P6-5. `coth z = i cot(iz)`: the same closed form, including the overflow branch, with the doubled parts swapped and the minus on the other part. Same helper; bit-identical.
- `matrix/src/backends/ParallelBackend.ts:180 transpose` ↔ `matrix/src/backends/ParallelBackend.ts:201 sum` (j 0.705) — **KEEP.** The whenParallel shell matches. The pool method and the result shape differ.
- `assembly/src/ops/complex-array.ts:267 complex_array_exp` ↔ `assembly/src/ops/complex-array.ts:298 complex_array_sqrt` (j 0.703) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/poly.ts:331 cheb_fit_f64` ↔ `assembly/src/poly.ts:373 legendre_fit_f64` (j 0.703) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:108 scale` (j 0.703) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `autograd/src/tape.ts:1583 _eigSymmetric` ↔ `autograd/src/tape.ts:1617 _eigGeneral` (j 0.702) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/wasm/bitwise/wasm-bridge.ts:78 runBinaryBitwiseWasm` ↔ `functions/src/wasm/bitwise/wasm-bridge.ts:103 runUnaryBitwiseWasm` (j 0.701) — **KEEP.** The WASM-or-JS shell matches. The export, ABI, and result type differ. withAsF64 already holds the marshalling.
- `functions/src/wasm/special/scalars.ts:164 besselJ0Series` ↔ `functions/src/wasm/special/scalars.ts:181 besselJ1Series` (j 0.701) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `functions/src/numeric/nnls.ts:94 gradient` ↔ `functions/src/numeric/nnls.ts:203 gradient` (j 0.700) — **KEEP.** Line 94 fuses Aᵀ(b−Ax). Line 203 materializes r=Ax−b then Aᵀr. Opposite sign, different rounding.
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.699) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.699) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.699) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:92 divideElementwise` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.699) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:922 square` (j 0.690) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `core/src/collection.ts:183 _reduce` ↔ `functions/src/matrix/mapSlices.ts:100 _mapSlices` (j 0.688) — **KEEP.** _reduce folds to a scalar at a flat leaf. _mapSlices invokes the callback on the whole slice when dim<=0.
- `matrix/src/backends/ParallelBackend.ts:124 scale` ↔ `matrix/src/backends/ParallelBackend.ts:180 transpose` (j 0.687) — **KEEP.** The whenParallel shell matches. The pool method and the result shape differ.
- `core/src/numeric/stable.ts:46 pairwiseSum` ↔ `core/src/numeric/stable.ts:167 pairwiseDot` (j 0.686) — **KEEP.** Eight-lane leaf adds xs[i], or a[i]*b[i]. A multiply mode in that leaf is the known loss.
- `matrix/src/operations/sqrtm.ts:91 sqrtmSymmetric` ↔ `matrix/src/operations/sqrtm.ts:185 sqrtmGeneral` (j 0.686) — **KEEP.** Eigenvalue gate -1e-8 and Q*sqrt(D)*Qᵀ, against |im|>1e-7 or re<-1e-7 and Q*sqrt(D)*Q⁻¹.
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.685) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `packages/workerpool/src/index.ts:712 exec` ↔ `packages/workerpool/src/index.ts:740 execFunction` (j 0.684) — **MERGE.** P6-6. The old reason is the argument list of one call. Both check `this.pool`, read `taskTimeout`, time the call, and record success or failure in `_recordExecution`. Only the `pool.exec` arguments differ: a method name, params and `{ on, transfer }`, against a function value and `[arg]` with no options. Once per chunk, not per element.
- `core/src/types/complex.ts:483 tan` ↔ `core/src/types/complex.ts:498 cot` (j 0.683) — **MERGE.** P6-5. Same doubled arguments and overflow branch. `cot` uses `cosh 2y - cos 2x` and negates the hyperbolic part. One boolean in the same helper.
- `packages/workerpool/src/index.ts:887 elementwise` ↔ `packages/workerpool/src/index.ts:1683 applyKernel2` (j 0.682) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:660 Float64Array` (j 0.681) — **KEEP.** Monomorphic sign and cube loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:704 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and cbrt loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and round loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and floor loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and ceil loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and fix loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and cosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.681) — **KEEP.** Monomorphic cube and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `autograd/src/tape.ts:858 cos` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.680) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/typed/special.ts:487 fresnelCScalar` ↔ `functions/src/typed/special.ts:509 fresnelSScalar` (j 0.680) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `packages/workerpool/src/index.ts:2263 runChunks` ↔ `packages/workerpool/src/index.ts:2319 reduce` (j 0.680) — **MERGE.** P6-7. `sort` and `reduce` inline the `runChunks` envelope. `kWayMerge`, the partial fold and `.flat()` are combiners invoked once per call. The old "outside the sum/prod/norm shell" note scoped PR-H; it is not a difference.
- `functions/src/numeric/solveODE.ts:465 rosenbrockSolve` ↔ `functions/src/numeric/solveODE.ts:613 rodasSolve` (j 0.678) — **MERGE.** P6-3. The old reason is wrong: neither solver calls `_rk`. Same validation, Hairer initial step, overshoot clamp, `F0`/`J`, scaled RMS error norm, accept test, step control and min/max clamp. The stage body runs once per step beside an O(n³) factorization.
- `functions/src/matrix/subset.ts:240 _getObjectProperty` ↔ `functions/src/matrix/subset.ts:265 _setObjectProperty` (j 0.677) — **KEEP.** Empty index returns undefined versus the object. Then getSafeProperty versus clone plus setSafeProperty.
- `functions/src/signal/fft-core-f64.ts:43 fftCoreFloat64` ↔ `packages/workerpool/src/fft-core.ts:35 fftFrameInPlace` (j 0.677) — **KEEP.** `dist/worker.js` cannot import `functions` (that is a cycle). `functions` does not depend on `workerpool`; reading the worker copy would add that package edge and make the pool package the home of a `functions` kernel. The worker copy is the bundle; parity tests pin it (`fft-core.test.ts`, `dist-objects-sampleN-oracle.test.ts`, `ComputePool.coverage.test.ts`).
- `packages/workerpool/src/index.ts:1143 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1556 unary` (j 0.674) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `assembly/src/special.ts:158 _besselY0Series` ↔ `functions/src/wasm/special/scalars.ts:195 besselY0Series` (j 0.672) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/numeric/control-equations.ts:113 norm1` ↔ `matrix/src/operations/common.ts:255 norm1` (j 0.672) — **KEEP.** Math.max propagates NaN. The colSum > maxColSum update does not replace the max with NaN.
- `matrix/src/backends/JSBackend.ts:108 scale` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.671) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/ParallelBackend.ts:124 scale` ↔ `matrix/src/backends/ParallelBackend.ts:158 multiply` (j 0.671) — **KEEP.** The whenParallel shell matches. The pool method and the result shape differ.
- `functions/src/numeric/open-root-finders.ts:88 newton` ↔ `functions/src/numeric/open-root-finders.ts:185 halley` (j 0.670) — **KEEP.** iterateRoot is already shared. The Newton and Halley corrections differ.
- `functions/src/special/erf.ts:105 erfc2` ↔ `functions/src/special/erf.ts:129 erfc3` (j 0.669) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `assembly/src/ops/complex-array.ts:165 complex_array_scale_complex` ↔ `assembly/src/ops/complex-array.ts:283 complex_array_log` (j 0.667) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:922 square` (j 0.667) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:1051 _unaryElementwise` (j 0.667) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `matrix/src/parallel-matrix.ts:415 DenseMatrix, DenseMatrix` ↔ `matrix/src/parallel-matrix.ts:937 DenseMatrix, DenseMatrix` (j 0.667) — **KEEP.** Two DenseMatrix handlers: multiply against matvec.
- `packages/workerpool/src/index.ts:1556 unary` ↔ `packages/workerpool/src/index.ts:1633 applyKernel` (j 0.665) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `packages/workerpool/src/index.ts:765 reduceScalar` ↔ `packages/workerpool/src/index.ts:2263 runChunks` (j 0.664) — **MERGE.** P6-7. Same parallel envelope: threshold, chunk, `stats`, `Promise.all(exec)`, result record. Chunker, task arguments and combiner run once per call or once per chunk.
- `assembly/src/signal.ts:274 chirp_z_transform_f64` ↔ `functions/src/wasm/signal/wasm-bridge.ts:223 chirpZTransformJS` (j 0.663) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662) — **KEEP.** Monomorphic sign and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662) — **KEEP.** Monomorphic sign and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662) — **KEEP.** Monomorphic sign and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662) — **KEEP.** Monomorphic cbrt and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662) — **KEEP.** Monomorphic cbrt and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662) — **KEEP.** Monomorphic cbrt and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662) — **KEEP.** Monomorphic round and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662) — **KEEP.** Monomorphic round and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662) — **KEEP.** Monomorphic round and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662) — **KEEP.** Monomorphic floor and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662) — **KEEP.** Monomorphic floor and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662) — **KEEP.** Monomorphic floor and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662) — **KEEP.** Monomorphic ceil and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662) — **KEEP.** Monomorphic ceil and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662) — **KEEP.** Monomorphic ceil and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662) — **KEEP.** Monomorphic fix and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662) — **KEEP.** Monomorphic fix and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662) — **KEEP.** Monomorphic fix and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662) — **KEEP.** Monomorphic cosh and csc loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662) — **KEEP.** Monomorphic cosh and sec loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662) — **KEEP.** Monomorphic cosh and cot loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.662) — **KEEP.** Monomorphic csc and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.662) — **KEEP.** Monomorphic csc and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.662) — **KEEP.** Monomorphic csc and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.662) — **KEEP.** Monomorphic csc and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.662) — **KEEP.** Monomorphic sec and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.662) — **KEEP.** Monomorphic sec and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.662) — **KEEP.** Monomorphic sec and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.662) — **KEEP.** Monomorphic sec and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.662) — **KEEP.** Monomorphic cot and asin loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.662) — **KEEP.** Monomorphic cot and acos loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.662) — **KEEP.** Monomorphic cot and asinh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.662) — **KEEP.** Monomorphic cot and acosh loops. A shared callback is the PR #454 regression (56%–643% slower below threshold).
- `functions/src/utils/bignumber/bitwise.ts:434 rightArithShiftBigNumber` ↔ `functions/src/utils/bignumber/bitwise.ts:484 rightLogShiftBigNumber` (j 0.662) — **KEEP.** An infinite shift of a negative is -1 on the arithmetic shift and NaN on the logical shift, which also reduces a negative mod 2^32.
- `matrix/src/backends/ParallelBackend.ts:158 multiply` ↔ `matrix/src/backends/ParallelBackend.ts:180 transpose` (j 0.662) — **KEEP.** The whenParallel shell matches. The pool method and the result shape differ.
- `packages/workerpool/src/index.ts:2184 sort` ↔ `packages/workerpool/src/index.ts:2319 reduce` (j 0.662) — **MERGE.** P6-7. `sort` and `reduce` inline the `runChunks` envelope. `kWayMerge`, the partial fold and `.flat()` are combiners invoked once per call. The old "outside the sum/prod/norm shell" note scoped PR-H; it is not a difference.
- `functions/src/typed/normal-equations-solve.ts:8 solveAugmentedNormalEquations` ↔ `functions/src/typed/numeric.ts:196 linsolve` (j 0.661) — **KEEP.** Mutate and return null at 1e-14, against copy and throw at 1e-15.
- `functions/src/ml/ols.ts:73 invertUnscaled` ↔ `functions/src/typed/matrix-ops.ts:490 matrixInverse` (j 0.658) — **KEEP.** Cutoff 1e-12 and skip a zero factor, against 1e-15, always multiply the factor, NaN on a non-finite entry.
- `core/src/types/bignumber.ts:1432 _alternatingEvenTaylor` ↔ `core/src/types/bignumber.ts:1471 _atanTaylor` (j 0.657) — **KEEP.** atan divides a copy of the term by 2n+1 and does not write that divisor back. The alternating series folds the divisor and the negate into term.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:880 tan` (j 0.656) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/ml/ols.ts:73 invertUnscaled` ↔ `functions/src/typed/hypothesis.ts:2039 _matInverse` (j 0.656) — **KEEP.** Cutoff 1e-12 and skip a zero factor, against 1e-15, always multiply the factor, NaN on a non-finite entry.
- `functions/src/type/local/Decimal.ts:349 plus` ↔ `functions/src/type/local/Decimal.ts:388 minus` (j 0.656) — **KEEP.** Decimal sign rules differ.
- `assembly/src/special.ts:179 _besselY1Series` ↔ `functions/src/wasm/special/scalars.ts:217 besselY1Series` (j 0.655) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:92 divideElementwise` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `packages/workerpool/src/index.ts:839 dot` ↔ `packages/workerpool/src/index.ts:1683 applyKernel2` (j 0.654) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `packages/workerpool/src/index.ts:887 elementwise` ↔ `packages/workerpool/src/index.ts:1556 unary` (j 0.654) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `packages/workerpool/src/index.ts:1012 bitwiseBinary` ↔ `packages/workerpool/src/index.ts:1081 bitwiseScalar` (j 0.654) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:817 exp` (j 0.653) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/typed/signal.ts:578 dct` ↔ `functions/src/typed/signal.ts:622 dst` (j 0.652) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `functions/src/special/spheroidal.ts:159 spheroidalAngular` ↔ `functions/src/special/spheroidal.ts:234 spheroidalAngularContinued` (j 0.651) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `autograd/src/tape.ts:880 tan` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.649) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/tape.ts:880 tan` ↔ `autograd/src/tape.ts:1001 reciprocal` (j 0.649) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/scalar-mutate.ts:261 swapOperands` ↔ `functions/src/scalar-mutate.ts:348 deleteNode` (j 0.649) — **MERGE.** P6-1. Same pick: binary-op paths, one `nextInt`, `nodeAt`, the arity guard, `replaceAt`, the grammar check. The replacement is built once per call. Stubbed-`nextInt` tests pin the draw order.
- `functions/src/stats/gaussian-process.ts:101 forwardSolve` ↔ `functions/src/stats/gaussian-process.ts:113 backSolveTranspose` (j 0.649) — **KEEP.** Opposite axis: `L[i][j]` walking up against `L[j][i]` walking down, inside the inner loop. The index form is the kernel.
- `assembly/src/ops/complex-array.ts:120 complex_array_mul` ↔ `assembly/src/ops/complex-array.ts:137 complex_array_div` (j 0.647) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `matrix/src/types/SparseMatrix.ts:576 multiplyElementwise` ↔ `matrix/src/types/SparseMatrix.ts:878 mapNonZeros` (j 0.645) — **KEEP.** A per-nonzero callback measured +12.4% (2000×2000) and +4.4% (500×500). Tried in #481 and reverted.
- `core/src/types/bignumber.ts:1100 sinh` ↔ `core/src/types/bignumber.ts:1126 tanh` (j 0.642) — **KEEP.** sinh returns (e^x-e^{-x})/2 and passes infinities through. tanh returns the ratio and maps infinities to the sign.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:1022 abs` (j 0.640) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/numeric/solveODE.ts:1613 _rk23` ↔ `functions/src/numeric/solveODE.ts:1634 _rk45` (j 0.639) — **KEEP.** Different tableaus. The shared _rk shell already exists.
- `assembly/src/signal.ts:50 _fftInterleaved` ↔ `functions/src/wasm/signal/wasm-bridge.ts:110 _fftInterleavedJS` (j 0.638) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:1022 abs` (j 0.637) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `matrix/src/backends/WASMBackend.ts:574 luDecomposition` ↔ `matrix/src/backends/WASMBackend.ts:779 inverse` (j 0.637) — **KEEP.** Shared part is about ten lines: square check, JS fallback, `allocCache` allocate and release. Buffer count and type (LU adds an `Int32Array` permutation, inverse an n·n+n work buffer), kernel arity, error string, failure value and result fields differ; a helper would need five callbacks.
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.636) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `core/src/types/complex.ts:549 tanh` ↔ `core/src/types/complex.ts:562 coth` (j 0.636) — **MERGE.** P6-5. Same doubled arguments and overflow branch. `coth` uses `cosh 2x - cos 2y` and negates the trigonometric part. One boolean in the same helper.
- `matrix/src/types/SparseMatrix.ts:576 multiplyElementwise` ↔ `matrix/src/types/SparseMatrix.ts:601 multiply` (j 0.636) — **KEEP.** Elementwise product against matrix product. The CSR walk is not the same multiply.
- `assembly/src/ops/matrix.ts:297 vector_matrix_multiply` ↔ `assembly/src/ops/matrix.ts:441 matrix_sum_cols` (j 0.633) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/typed/integration.ts:389 gaussQuadSerial` ↔ `packages/workerpool/src/worker.ts:966 integrateChunk` (j 0.632) — **KEEP.** `dist/worker.js` cannot import `functions` (that is a cycle). `functions` does not depend on `workerpool`; reading the worker copy would add that package edge and make the pool package the home of a `functions` kernel. The worker copy is the bundle; parity tests pin it (`fft-core.test.ts`, `dist-objects-sampleN-oracle.test.ts`, `ComputePool.coverage.test.ts`).
- `functions/src/special/spheroidal.ts:35 ferrersP` ↔ `functions/src/special/spheroidal.ts:212 ferrersPContinued` (j 0.631) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:922 square` (j 0.630) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/typed/arithmetic.ts:1013 number, number` ↔ `functions/src/typed/arithmetic.ts:1028 bigint, bigint` (j 0.630) — **KEEP.** The number path Math.floors both inputs and the quotient. The bigint path is truncating division and does not pre-floor.
- `assembly/src/poly.ts:293 poly_fit_f64` ↔ `assembly/src/poly.ts:331 cheb_fit_f64` (j 0.629) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629) — **KEEP.** mapArray is the shared scalar callback sign must not call on the sub-threshold path (PR #454).
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629) — **KEEP.** mapArray is the shared scalar callback cbrt must not call on the sub-threshold path (PR #454).
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629) — **KEEP.** mapArray is the shared scalar callback round must not call on the sub-threshold path (PR #454).
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629) — **KEEP.** mapArray is the shared scalar callback floor must not call on the sub-threshold path (PR #454).
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629) — **KEEP.** mapArray is the shared scalar callback ceil must not call on the sub-threshold path (PR #454).
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629) — **KEEP.** mapArray is the shared scalar callback fix must not call on the sub-threshold path (PR #454).
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629) — **KEEP.** mapArray is the shared scalar callback cosh must not call on the sub-threshold path (PR #454).
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.629) — **KEEP.** mapArray is the shared scalar callback asin must not call on the sub-threshold path (PR #454).
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.629) — **KEEP.** mapArray is the shared scalar callback acos must not call on the sub-threshold path (PR #454).
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.629) — **KEEP.** mapArray is the shared scalar callback asinh must not call on the sub-threshold path (PR #454).
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.629) — **KEEP.** mapArray is the shared scalar callback acosh must not call on the sub-threshold path (PR #454).
- `functions/src/numeric/krylov.ts:197 incompleteCholesky` ↔ `functions/src/typed/dist-objects.ts:1281 _cholesky` (j 0.628) — **KEEP.** IC(0) on a sparsity pattern against a dense factorization, and the error strings differ.
- `packages/workerpool/src/index.ts:887 elementwise` ↔ `packages/workerpool/src/index.ts:1012 bitwiseBinary` (j 0.627) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `packages/workerpool/src/index.ts:955 scale` ↔ `packages/workerpool/src/index.ts:1683 applyKernel2` (j 0.626) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `assembly/src/ops/matrix.ts:276 matrix_vector_multiply` ↔ `assembly/src/ops/matrix.ts:422 matrix_sum_rows` (j 0.625) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `packages/workerpool/src/index.ts:1193 matmul` ↔ `packages/workerpool/src/index.ts:2059 outer` (j 0.625) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `autograd/src/tape.ts:133 add` ↔ `autograd/src/tape.ts:202 mul` (j 0.624) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `core/src/arithmetic/scalar.ts:56 addScalar` ↔ `core/src/arithmetic/scalar.ts:66 subtractScalar` (j 0.623) — **KEEP.** Same promotion ladder. The number/bigint operator and the promoted method name (.add/.subtract/.multiply/.divide) are the operation. Hot path.
- `core/src/arithmetic/scalar.ts:56 addScalar` ↔ `core/src/arithmetic/scalar.ts:77 multiplyScalar` (j 0.623) — **KEEP.** Same promotion ladder. The number/bigint operator and the promoted method name (.add/.subtract/.multiply/.divide) are the operation. Hot path.
- `core/src/arithmetic/scalar.ts:56 addScalar` ↔ `core/src/arithmetic/scalar.ts:88 divideScalar` (j 0.623) — **KEEP.** Same promotion ladder. The number/bigint operator and the promoted method name (.add/.subtract/.multiply/.divide) are the operation. Hot path.
- `core/src/arithmetic/scalar.ts:66 subtractScalar` ↔ `core/src/arithmetic/scalar.ts:77 multiplyScalar` (j 0.623) — **KEEP.** Same promotion ladder. The number/bigint operator and the promoted method name (.add/.subtract/.multiply/.divide) are the operation. Hot path.
- `core/src/arithmetic/scalar.ts:66 subtractScalar` ↔ `core/src/arithmetic/scalar.ts:88 divideScalar` (j 0.623) — **KEEP.** Same promotion ladder. The number/bigint operator and the promoted method name (.add/.subtract/.multiply/.divide) are the operation. Hot path.
- `core/src/arithmetic/scalar.ts:77 multiplyScalar` ↔ `core/src/arithmetic/scalar.ts:88 divideScalar` (j 0.623) — **KEEP.** Same promotion ladder. The number/bigint operator and the promoted method name (.add/.subtract/.multiply/.divide) are the operation. Hot path.
- `assembly/src/ops/curvefit.ts:6 expfit` ↔ `assembly/src/ops/curvefit.ts:31 logfit` (j 0.622) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/special.ts:43 laguerreL` ↔ `assembly/src/ops/special.ts:60 legendreP` (j 0.621) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:903 sqrt` ↔ `autograd/src/tape.ts:922 square` (j 0.620) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/type/matrix/utils/matAlgo13xDD.ts:120 _iterate` ↔ `functions/src/type/matrix/utils/matAlgo14xDs.ts:101 _iterate` (j 0.618) — **KEEP.** matAlgo13 is dense-dense f(a[i], b[i]). matAlgo14 is a scalar with the operand order reversed.
- `autograd/src/tape.ts:1428 svd` ↔ `autograd/src/tape.ts:1583 _eigSymmetric` (j 0.617) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `packages/workerpool/src/index.ts:1143 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1683 applyKernel2` (j 0.617) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `packages/workerpool/src/index.ts:2184 sort` ↔ `packages/workerpool/src/index.ts:2263 runChunks` (j 0.616) — **MERGE.** P6-7. `sort` and `reduce` inline the `runChunks` envelope. `kWayMerge`, the partial fold and `.flat()` are combiners invoked once per call. The old "outside the sum/prod/norm shell" note scoped PR-H; it is not a difference.
- `functions/src/signal/wavelets.ts:86 rickerWavelet` ↔ `functions/src/signal/wavelets.ts:99 morletWavelet` (j 0.615) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `parallel/src/ParallelMatrix.ts:288 elementwise` ↔ `parallel/src/ParallelMatrix.ts:356 scale` (j 0.615) — **KEEP.** The parallel shell is already `scatterBlocks` / `sumBlocks`. The residue is the sequential element loop: `sum += a[i]*b[i]` against `sum += a[i]`, or `op(a[i], b[i])` against `a[i]*scalar`.
- `core/src/array.ts:985 recursiveMapWithIndex` ↔ `core/src/array.ts:1003 recursiveMap` (j 0.614) — **KEEP.** The index walk passes index.slice(0, depth). recursiveMap calls the unary callback.
- `packages/workerpool/src/index.ts:1012 bitwiseBinary` ↔ `packages/workerpool/src/index.ts:1683 applyKernel2` (j 0.612) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `functions/src/typed/arithmetic.ts:1343 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1366 Float64Array` (j 0.610) — **KEEP.** Monomorphic min and max loops. A shared callback is the PR #454 regression (56%–643% slower below threshold). Both are reductions; the comparison and the seed differ (±Infinity).
- `packages/workerpool/src/index.ts:805 sum` ↔ `packages/workerpool/src/index.ts:1490 norm` (j 0.610) — **KEEP.** PR-H (#504) already moved the envelope into `reduceScalar`. The residue is each sequential closure: `+=` from 0, `*=` from 1, or squares then `Math.sqrt`. That is the element loop.
- `matrix/src/backends/WASMBackend.ts:574 luDecomposition` ↔ `matrix/src/backends/WASMBackend.ts:894 choleskyDecomposition` (j 0.609) — **KEEP.** Shared part is about ten lines: square check, JS fallback, `allocCache` allocate and release. Buffer count and type (LU adds an `Int32Array` permutation, inverse an n·n+n work buffer), kernel arity, error string, failure value and result fields differ; a helper would need five callbacks.
- `packages/workerpool/src/index.ts:1847 distanceMatrix` ↔ `packages/workerpool/src/index.ts:1985 matvec` (j 0.609) — **KEEP.** The envelope is the one P6-7 moves into `runParallel`. What pairs is the residue: a sequential `for` loop over elements or rows, and the chunk task. Routed through `runParallel`, each method keeps that loop and stays at 50 nodes or more, still paired, as `sum`/`prod` still pair after PR-H (`map`/`filter` have no loop and are not units). Optional cleanup; it retires no pair.
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:798 log` (j 0.608) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` (j 0.607) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` (j 0.607) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` (j 0.607) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` (j 0.607) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.607) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.607) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.607) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.607) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:836 sin` (j 0.607) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/matrix/eigs/realSymmetric.ts:102 diag` ↔ `functions/src/matrix/eigs/realSymmetric.ts:134 diagBig` (j 0.604) — **KEEP.** Same diagonal update. `diag` uses number arithmetic and `diagBig` uses BigNumber.
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/parallel-map.ts:56 mapBinaryF64` (j 0.603) — **KEEP.** Unary applyKernel against binary applyKernel2. The arity split is the kernel.
- `functions/src/numeric/krylov.ts:287 cg` ↔ `functions/src/numeric/krylov.ts:530 bicgstab` (j 0.602) — **KEEP.** Different recurrences.
- `tensor/src/operations/solve.ts:81 forwardSub` ↔ `tensor/src/operations/solve.ts:102 backSub` (j 0.602) — **KEEP.** Opposite axis. `backSub` divides by `U[i, i]`; `forwardSub` assumes the unit diagonal of `L` and does not divide.
- `assembly/src/ops/special.ts:11 chebyshevT` ↔ `assembly/src/ops/special.ts:60 legendreP` (j 0.600) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/matrix/eigs/realSymmetric.ts:208 Sij1Big` ↔ `functions/src/matrix/eigs/realSymmetric.ts:226 x1Big` (j 0.596) — **KEEP.** Number against BigNumber Jacobi, and a column rotation against the full diagonal update.
- `functions/src/matrix/eigs/realSymmetric.ts:190 Sij1` ↔ `functions/src/matrix/eigs/realSymmetric.ts:269 x1` (j 0.577) — **KEEP.** Number against BigNumber Jacobi, and a column rotation against the full diagonal update.
- `functions/src/probability/bernoulli.ts:83 bigint | Fraction` ↔ `functions/src/probability/bernoulli.ts:92 BigNumber` (j 0.556) — **KEEP.** The precision-reset cache exists only on the BigNumber Bernoulli path.
- `assembly/src/ops/polynomial.ts:87 determinant` ↔ `functions/src/wasm/poly/wasm-bridge.ts:174 resultantJS` (j 0.486) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/typed/aggregate-restart.ts:12 aggregateRestartVectors` ↔ `functions/src/typed/graph.ts:928 _aggregateEigenvector` (j 0.474) — **KEEP.** Eigenvector aggregation sign-aligns and renormalizes. The shared restart average does not.
- `assembly/src/special.ts:242 _besselJn` ↔ `assembly/src/special.ts:286 _besselYn` (j 0.407) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/graph/traversal-centrality.ts:44 bfs` ↔ `functions/src/graph/traversal-centrality.ts:89 visit` (j 0.400) — **KEEP.** FIFO against recursive DFS.
- `functions/src/wasm/special/scalars.ts:265 besselJScalar` ↔ `functions/src/wasm/special/scalars.ts:311 besselYScalar` (j 0.397) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `functions/src/typed/algebra.ts:1560 fullSimplify` ↔ `functions/src/typed/cas.ts:2490 _casSimplifyOne` (j 0.375) — **KEEP.** The CAS path adds numeric eval and like-term combine on top of the shared simplify walk.
- `matrix/src/operations/logm.ts:234 validateEigenvalues` ↔ `matrix/src/operations/logm.ts:264 logmEig` (j 0.350) — **KEEP.** One rejects eigenvalues. The other builds the log.
- `assembly/src/elementwise.ts:34 _erfSeries` ↔ `functions/src/wasm/special/scalars.ts:69 erfcSelfContained` (j 0.335) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/numeric/control-equations.ts:172 vecRowMajor` ↔ `matrix/src/operations/expm.ts:139 matrixExpm` (j 0.247) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `core/src/wasm-loader.ts:302 getImports` ↔ `matrix/src/backends/WASMBackend.ts:404 loadAsModule` (j 0.232) — **KEEP.** getImports builds the import object. loadAsModule is the integrity-checked instantiate.
- `autograd/src/tape.ts:1970 _eigSymBackward` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.221) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `functions/src/numeric/nnls.ts:94 gradient` ↔ `functions/src/numeric/nnls.ts:189 lsqBounded` (j 0.220) — **KEEP.** Containment. One product or matvec sits inside lsqBounded. The algorithms are not the same.
- `functions/src/numeric/bfgs.ts:92 matVec` ↔ `functions/src/numeric/nnls.ts:189 lsqBounded` (j 0.194) — **KEEP.** Containment. One product or matvec sits inside lsqBounded. The algorithms are not the same.
- `matrix/src/backends/WASMBackend.ts:574 luDecomposition` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.176) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `autograd/src/tape.ts:1830 _svdBackward` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.138) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `matrix/src/operations/qr.ts:44 qr` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.116) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `expression/src/compiler/compile.ts:307 compileFunctionNode` ↔ `expression/src/compiler/compile.ts:456 compileArrayNode` (j 0.105) — **KEEP.** Containment false match (jStruct 0.105): the child-compile loop of `compileArrayNode` sits inside `compileFunctionNode`. #511 changed both bodies; the function-node compiler still owns the sandbox accessor path.
- `tensor/src/operations/cholesky.ts:45 transposeSquare` ↔ `tensor/src/operations/solve.ts:127 tensorSolve` (j 0.074) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `matrix/src/operations/eig.ts:158 eigGeneral` ↔ `parallel/src/gemm-rows.ts:19 gemmRows` (j 0.036) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `matrix/src/operations/eig.ts:158 eigGeneral` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.025) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `functions/src/geometry/intersect.ts:272 _intersect3dHelper` ↔ `functions/src/matrix/eigs/complexEigs.ts:66 createComplexEigs` (j 0.022) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
