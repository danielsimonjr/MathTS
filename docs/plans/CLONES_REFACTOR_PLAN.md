# Plan: remaining clone pairs — merge or keep

**Status:** planning only. This file is the contract for later implementation PRs. It does not change runtime source.
**Ledger:** [`docs/roadmap/CLONES_REMAINING.md`](../roadmap/CLONES_REMAINING.md), written by `156e4ea8` (`refactor: share same-algorithm clones and ledger every remaining pair (#473) (#494)`). That path is the clone ledger. There is no `docs/analysis/CLONES_REMAINING.md` and no differently named #473 look-alike ledger.
**Tree reviewed:** `156e4ea8`, which is `main` at the time of this plan. The ledger's "After this follow-up" column is this tree. The counts below were re-measured; they match that column, and the tool also reports `parseErrors=5`, which the ledger does not.
**Tool:** `@danielsimonjr/repo-tools` 2.3.0, command `repo-tools clones`.

## Judgment

A pair is **MERGE** when both bodies share the control flow and the difference is an output template, a combiner invoked once per call, or a choice made outside the element loop. That is the case the ledger was too willing to call a look-alike: `setSymDifference` and `setUnion` share the empty-set preamble and differ only in the final `concat(...)`.

A pair is **KEEP** when the differing expression is the numeric definition, a precision / NaN / pivot policy, a typed-dispatch signature, a callback or mode branch inside a measured hot loop, a sandbox or SHA-384 gate, a worker-bundle layering ban, or an AssemblyScript operator that is the kernel (including `@inline` per element). A boolean checked once after a cold loop, or a callback invoked once, is still MERGE. A boolean inside the element loop is KEEP.

"Editing AssemblyScript rebuilds the binary" is a cost of a merge, not a reason to keep two copies of one loop. "The markup differs" is not a reason to keep two printers that walk the same children. "The formulas differ" is a reason only when the formula is what the loop computes.

Each implementation PR keeps the public name and the numeric result. The old names stay as wrappers. A mode flag inside a hot numeric loop is out of scope. Each published-package change carries a patch changeset. Do not edit `package.json` `"version"` by hand. Do not merge, tag, release, or publish. Leave PR #398 alone.

## Baseline

Re-measured on `156e4ea8` with the tool defaults (no `repo-tools.config.json` in the repo):

| Flag                | Value |
| ------------------- | ----- |
| `--min-nodes`       | 50    |
| `--shingle`         | 6     |
| `--near`            | 0.6   |
| `--containment`     | 0.9   |
| `--containment-min` | 20    |
| `--rare`            | 60    |
| `--min-shared`      | 3     |

```
files=1219 parseErrors=5 units(minNodes=50)=2604
nodes p50=110 p90=327 p99=827 max=3705
exact groups=12 (units in them=43) text-identical groups=4
near pairs=573 by jStruct: 0.9 or more: 112, 0.8 to 0.9: 164, 0.7 to 0.8: 91, 0.6 to 0.7: 181, below 0.6 (containment): 25
units by folder: assembly/src=151 autograd/src=51 compat/src=9 core/src=228 expression/src=154 functions/src=1517 gpu/src=14 matrix/src=191 packages/typed-function=2 packages/workerpool=61 parallel/src=50 plot/src=36 tensor/src=58 workbook/src=82
```

`112 + 164 + 91 + 181 + 25 = 573`. Five files contain tree-sitter `ERROR` nodes. The scanner still extracts units from those files. Those five files are not a clone class.

The 12 exact groups are also near pairs at `jStruct` 1. Their units: `_carlsonRC` (2), `_batchedMatmul` trio (3), `isSafeMethod` (3), `factory` (3), `mulberry32` (2), `Complex.tan`/`tanh` (2), `Complex.cot`/`coth` (2), `isBigNumber` (2), `setSymDifference`/`setUnion` (2), and three unary `Float64Array` groups (11 + 8 + 3). `43` units. The four text-identical groups are `isSafeMethod` (core ↔ functions), `mulberry32` ↔ `_workerMulberry32`, `factory` (expression ↔ functions), and `isBigNumber` (expression ↔ functions). Expression `isSafeMethod` is not text-identical: it casts `method as string`. Core `factory` is not text-identical: the generic constraint differs.

### Re-measure

From the repo root, with `@danielsimonjr/repo-tools@2.3.0` installed outside the repo (a global install needs a writable prefix; `npm install @danielsimonjr/repo-tools@2.3.0` in a scratch directory works):

```bash
repo-tools clones . --src \
  packages/typed-function/src packages/workerpool/src \
  core/src matrix/src tensor/src autograd/src functions/src expression/src \
  parser/src units/src numbers/src ast/src evaluator/src linalg/src \
  arithmetic/src trigonometry/src statistics/src signal/src \
  parallel/src workbook/src assembly/src compat/src gpu/src plot/src \
  --out=../tmp/clones-baseline
```

`--src` is one flag. It takes every following argument until the next flag. Repeating `--src=` is a usage error. `--out` must be relative to the repo root; an absolute path is rejected. The parent of that relative path must be writable. Do not commit `inventory.jsonl` or `clones.json`.

Re-measure after each implementation PR. Do not predict a new total. The pairs this plan marks MERGE should leave the report or shrink under 50 nodes. The KEEP cliques should remain.

## Accounting

| Verdict                | Pairs |
| ---------------------- | ----: |
| MERGE (nine later PRs) |    16 |
| KEEP                   |   557 |
| Total near pairs       |   573 |

The appendix lists every pair once. Exact-group pairs are included at `jStruct` 1.

| MERGE                                      | Pairs | Later PR |
| ------------------------------------------ | ----: | -------- |
| `setSymDifference` / `setUnion` flatten    |     1 | B        |
| `AssignmentNode` string / HTML / TeX       |     3 | A        |
| `ObjectNode` string / HTML                 |     1 | A        |
| `unflattenl` / `unflattenr`                |     1 | C        |
| `cleanUnivariatePoly` / `renderIntPoly`    |     1 | D        |
| pageRank / betweenness / eigenvector shell |     3 | E        |
| `Fraction.floor` / `ceil`                  |     1 | F        |
| `flipRows` / `flipCols`                    |     1 | G        |
| worker `sum` / `prod` / `norm`             |     3 | H        |
| AssemblyScript Airy Ai / Bi series         |     1 | I        |

## What the ledger called a skip, and this plan merges

The ledger's class bullets ("different markup", "different jobs", "loop shell", "measured hot path", "an AssemblyScript edit rebuilds the binary") are the lenient skips. These sixteen pairs fail that test because the shared region is the algorithm and the difference is a template or a once-per-call choice.

| Ledger skip                                                                                               | Bodies                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `setSymDifference` / `setUnion` "the result is `concat(diff, diff)` against `concat(symDiff, intersect)`" | Lines 52–59 and 69–76 are the same empty-set flatten. Line 60 vs line 77 is the only difference, and it runs once.                                                                                                                                                       |
| `AssignmentNode` printers "different markup per output kind"                                              | `_toString` (302), `_toHTML` (349), and `_toTex` (383) each render object, index, and value, then apply `needParenthesis`, then join with `=`. The parenthesis glyphs and the `=` span differ.                                                                           |
| `ObjectNode` `_toString` / `_toHTML`                                                                      | Both walk `hasOwnProperty` keys. The entry text and the braces differ. `_toTex` (225) is the same walk and is not a reported pair; the helper should take it as a third call.                                                                                            |
| `unflattenl` / `unflattenr` "different jobs"                                                              | Same recursion and the same `isAssociative` test. Right pops and builds `[popped, current]`. Left shifts and builds `[current, shifted]`. Cold CAS tree walk.                                                                                                            |
| `Fraction.floor` / `ceil` "remainder adjustment"                                                          | Shared `denominator === 1n` return and toward-zero bigint division. Floor subtracts `1n` when the value is negative and not exact. Ceil adds `1n` when it is positive and not exact. One comparison per call, no element loop.                                           |
| `flipRows` / `flipCols` "different index maps"                                                            | Same allocation and the same `i, j` nest. The source index is `(m-1-i)*n+j` or `i*n+(n-1-j)`. Select the nest once, before the loops.                                                                                                                                    |
| centrality "one base would branch on `ranks` vs `centrality`"                                             | `runCentralityRestarts` is already shared. What remains is reading `restarts` / `restartSeed` / `aggregation`, the `restarts === 1` path, and packing the single result. The kernels stay. The packer is a callback invoked once.                                        |
| worker `sum` / `prod` / `norm` "measured hot path"                                                        | The parallel envelope matches (`shouldParallelize`, `chunkFloat64Array`, `exec` of one chunk task, reduce partials, `ParallelResult`). The sequential loops differ and stay as closures invoked once. `runChunks` (2289) is the existing precedent.                      |
| Airy series "AssemblyScript"                                                                              | `_airyAiSeries` (396) and `_airyBiSeries` (423) share the series loop. The return is `AI0*f - AI_PRIME0*g` or `sqrt(3)*(AI0*f + AI_PRIME0*g)`. JS already did this: `airyScalar` checks `combine` once after the loop (`functions/src/wasm/special/scalars.ts` 509–512). |

## Pull requests

Land them one at a time, each against `main`, and re-measure before the next. They do not stack. JS-only cold edits come first. The worker shell is gated on a measurement. The AssemblyScript edit is last because it rebuilds `mathts-as.wasm` and the SHA-384 manifest.

### PR-A — expression printers

**Package:** `expression`. **Pairs retired:** 4 (three assignment, one object).

Add nothing public. Helpers stay inside the node factories so they can see the local `needParenthesis` (Assignment) and `hasOwnProperty` (Object).

```ts
function renderAssignment(
  render: (node: MathNode, options?: StringOptions) => string,
  markup: { paren: (value: string) => string; eq: string }
): string;
```

`_toString` passes `(value) => '(' + value + ')'` and `' = '`. `_toHTML` passes the existing parenthesis spans, including the class spelling `math-paranthesis`, and the existing `math-assignment-operator` span around `=`. `_toTex` passes `` (value) => `\\left(${value}\\right)` `` and `'='`. `needParenthesis(this, options && options.parenthesis, options && options.implicit)` stays the guard. `_toMathML` (372) stays a separate algorithm: a symbol left-hand side becomes `<mrow>`, anything else becomes escaped `toString()`.

```ts
function renderObjectEntries(
  entry: (key: string, node: MathNode) => string,
  separator: string,
  wrap: (joined: string) => string
): string;
```

One `for...in` plus `hasOwnProperty`. `_toString` joins `key: value` with `', '` inside `{}`. `_toHTML` uses the property, colon, and separator spans and the curly parenthesis spans. `_toTex` uses `'\\mathbf{' + key + ':} & ' + ... + '\\\\'`, separator `'\n'`, and the `array` wrap. That third call is not a reported pair; it is the same walk.

`RelationalNode._toHTML` (242) repeats the precedence walk that `renderRelational` (47) already performs for `_toString` and `_toTex`. Point `_toHTML` at `renderRelational` with the HTML parenthesis spans and `escape(operatorMap[cond])` in the join. That call retires no reported pair (`_toString` already uses the helper, so the detector does not pair them).

Leave `AccessorNode`, `ArrayNode._toTex`, `ConditionalNode._toTex`, and every `toMathML`. Parenthesis, Block, FunctionAssignment, and Array string/HTML are under the 50-node cutoff; they are not part of this PR.

**Risk.** HTML and TeX strings drift, including the `math-paranthesis` spelling. A helper that "fixes" that spelling changes snapshots.

**Tests.** `expression/tests/AssignmentNode.test.ts`, `expression/tests/ObjectNode.test.ts`, `expression/tests/RelationalNode.test.ts`. Golden strings for assignment string, HTML, and TeX, including a parenthesized value and an indexed left-hand side. Golden HTML for a relational chain. `expression/tests/security/sandbox.test.ts` stays green; this PR does not touch `customs.ts`.

```bash
bunx vitest run expression/tests/AssignmentNode.test.ts expression/tests/ObjectNode.test.ts expression/tests/RelationalNode.test.ts expression/tests/security/sandbox.test.ts
```

### PR-B — set flatten

**Package:** `functions`. **Pairs retired:** 1 exact group (2 units).

New file `functions/src/set/flatten-pair.ts`:

```ts
function flattenSetPair(
  a1: MathArray | Matrix,
  a2: MathArray | Matrix,
  deps: {
    size: (arr: MathArray | Matrix) => number[];
    subset: (arr: number[], index: Index) => number;
    Index: new (i: number) => Index;
    flatten: (a: MathNumericType[]) => MathNumericType[];
  },
  combine: (b1: MathNumericType[], b2: MathNumericType[]) => MathNumericType[] | Matrix
): MathNumericType[] | Matrix;
```

Empty side zero returns `flatten` of the other side, matching lines 52–57 and 69–74. Otherwise flatten both and call `combine` once. `createSetSymDifference` passes `(b1, b2) => concat(setDifference(b1, b2), setDifference(b2, b1))`. `createSetUnion` passes `(b1, b2) => concat(setSymDifference(b1, b2), setIntersect(b1, b2))`. The typed handlers stay the public surface.

`setDifference` (53) and `setIntersect` (53) do not join this helper. Difference returns `[]` when `a1` is empty and `flatten` of `a1` when `a2` is empty, then sorts and `identify`s. Intersect returns `[]` when either side is empty. The difference empty path also casts `a1` to `Matrix` before `toArray()`; leave that behavior where it is.

`functions/src/typed/set.ts` is a separate implementation. A green `typed-set.test.ts` does not cover `functions/src/set/setUnion.ts`.

**Risk.** Calling `combine` per element, or routing difference and intersect through the empty-set policy, changes multiset results.

**Tests.** A new `functions/tests/set-flatten-pair.test.ts` that builds `createSetUnion` and `createSetSymDifference` (or the live factory `math`) and checks both-empty, one-empty, overlap, and a nested array. The returned arrays must match the current `concat` lines.

```bash
bunx vitest run functions/tests/set-flatten-pair.test.ts
```

### PR-C — unflatten side

**Package:** `functions`. **Pairs retired:** 1.

In `functions/src/algebra/simplify/util.ts`, one function:

```ts
function unflatten(
  node: MathNode & { args?: MathNode[] },
  context: OperatorContext,
  side: 'left' | 'right'
): void;
```

Recurse on `node.args` with the same `side`. When `args.length > 2` and `isAssociative`, `right` pops and `makeNode([popped, current])`; `left` shifts and `makeNode([current, shifted])`. `unflattenl` and `unflattenr` remain as wrappers. `side` is not a per-node numeric callback.

**Risk.** Swapping pop and shift changes associativity of flattened `+` and `*`.

**Tests.** Existing simplify tests that build a left-heavy and a right-heavy tree. Add one case with three or more associative operands on each side if the suite does not already pin the child order.

```bash
bunx vitest run functions/tests --testNamePattern unflatten
```

If that pattern matches nothing, add the two tree cases next to the existing simplify tests and run that file.

### PR-D — univariate printer

**Package:** `functions`. **Pairs retired:** 1.

New file `functions/src/typed/factorization/render-univariate.ts`:

```ts
interface UnivariateTerm {
  zero: boolean;
  negative: boolean;
  absText: string;
  absIsOne: boolean;
}

function renderDescendingUnivariate(
  length: number,
  coeffAt: (power: number) => UnivariateTerm,
  variable: string
): string;
```

The loop is the descending-power printer now copied in `cleanUnivariatePoly` (45) and `renderIntPoly` (89): skip zeros, constant vs `v` vs `v^i`, elide a unit coefficient, leading sign against later `+` / `-` joiner, empty result `'0'`. `coeffAt` runs once per power.

`cleanUnivariatePoly` `Math.round`s the number, then passes `zero`, `negative`, `String(abs)`, and `abs === 1`. `renderIntPoly` passes bigint facts: `c === 0n`, `c < 0n`, `(-c).toString()` or `c.toString()`, `abs === 1n`. The bigint path must not call `Number()`. `renderLinearFactor` stays separate.

**Risk.** Routing a Hensel coefficient above `2^53` through `Number` silently rounds a factor string.

**Tests.** Existing factor-string cases. One bigint polynomial whose coefficient is `2n ** 53n + 1n` renders that decimal, not a rounded number. One number polynomial still rounds (`1.6` prints as `2`).

```bash
bunx vitest run functions/tests --testNamePattern 'factor|univariate|renderIntPoly|cleanUnivariate'
```

### PR-E — centrality dispatch

**Package:** `functions`. **Pairs retired:** 3.

Next to `runCentralityRestarts` in `functions/src/typed/graph.ts`:

```ts
async function dispatchCentrality<R>(
  opts: CentralityRestartOptions | undefined,
  once: (seed: number) => R,
  aggregate: (
    vectors: Float64Array[],
    aggregation: RestartAggregation
  ) => Promise<unknown> | unknown,
  packSingle: (value: R) => object
): Promise<unknown>;
```

Read `restarts` (default 1), `restartSeed` (default 0), and `aggregation` (default `'mean'`). When `restarts === 1`, return `packSingle(once(0))`. Otherwise return `runCentralityRestarts(...)` with the existing `_splitSeed`. `pageRank` closes damping, `maxIter`, and `tol` inside `once` and packs `{ ranks }`. `betweennessCentrality` closes `directed` and `normalise` and packs `{ centrality }`. `eigenvectorCentrality` closes `maxIter` and `tol` and packs `{ centrality }`. `_pageRankOnce`, `_betweennessOnce`, `_eigenvectorOnce`, `_aggregateRanks`, `_aggregateBetweenness`, and `_aggregateEigenvector` stay. Do not branch on a result-field name inside the helper.

`_aggregateEigenvector` (936) against `aggregateRestartVectors` is a different job (sign alignment, renormalize, extra result fields). That pair stays KEEP.

**Risk.** The `restarts === 1` path must keep seed `0` and the field name (`ranks` vs `centrality`). A shared result object would change callers.

**Tests.** `functions/tests/typed-graph-workers.test.ts`: `restarts: 1` and `restarts > 1`, and the result key.

```bash
bunx vitest run functions/tests/typed-graph-workers.test.ts
```

### PR-F — Fraction floor and ceil

**Package:** `core`. **Pairs retired:** 1.

On `Fraction` in `core/src/types/fraction.ts`:

```ts
private truncBound(toward: 'floor' | 'ceil'): Fraction
```

`denominator === 1n` returns `this`. `quot = this.numerator / this.denominator` stays bigint division toward zero. Exactness is `this.numerator % this.denominator === 0n`. Floor returns `quot` when `numerator >= 0n` or exact, otherwise `quot - 1n`. Ceil returns `quot` when `numerator <= 0n` or exact, otherwise `quot + 1n`. `floor` and `ceil` become one-line wrappers. Do not call `Math.floor`. `round` keeps calling `floor`.

**Risk.** Using a number division, or flipping the sign test, changes negative non-integers (`-7/3` floors to `-3` and ceils to `-2`).

**Tests.** `core/tests/types/fraction.test.ts` and `core/tests/types/fraction-coverage.test.ts`. Cases: positive non-integer, negative non-integer, exact fraction, denominator `1n` returns the same instance.

```bash
bunx vitest run core/tests/types/fraction.test.ts core/tests/types/fraction-coverage.test.ts
```

### PR-G — dense flip axis

**Package:** `matrix`. **Pairs retired:** 1.

In `matrix/src/operations/qr-family.ts`:

```ts
function flipDense(M: DenseMatrix, axis: 0 | 1): DenseMatrix;
```

Allocate once. `axis === 0` runs the row-reverse nest. `axis === 1` runs the column-reverse nest. The branch sits outside both loops. `flipRows` and `flipCols` pass a literal `0` or `1`. No per-element callback. Do not fold this into `tensor` `transposeSquare`: the index map is different, and `tensor` must not take a new dependency on this file for a one-line copy.

**Risk.** An axis test inside the `i, j` loop, or a callback per element, on the LQ/QL copy.

**Tests.** `matrix/tests/operations/qr-family.test.ts` (LQ/QL). One direct oracle: row-reverse and column-reverse of a non-square matrix match the current index formulas, including a 1×n and an m×1 matrix.

```bash
bunx vitest run matrix/tests/operations/qr-family.test.ts
```

### PR-H — worker scalar shell

**Package:** `packages/workerpool`. **Pairs retired:** the three among `sum` (768), `prod` (806), and `norm` (1495), if the methods then drop under 50 nodes or stop pairing. Pairs of those methods with `scale`, `dot`, `bitwiseNot`, `applyKernel`, and `distance` stay KEEP.

Private method beside `runChunks`:

```ts
private async reduceScalar(
  data: Float64Array,
  options: TaskOptions | undefined,
  spec: {
    sequential: () => number;
    task: 'sumChunk' | 'prodChunk' | 'normChunk';
    reducePartials: (parts: number[]) => number;
  }
): Promise<ParallelResult<number>>
```

`sequential` is the whole sub-threshold loop, invoked once: sum starts at `0` and adds, prod starts at `1` and multiplies, norm sums squares and then `Math.sqrt`. Above `parallelThreshold` (default `10000`), chunk, `exec` the named task, then `reducePartials` once (sum of partials, product of partials, or `Math.sqrt` of the sum of partial squares). Do not pass a per-element operator. Do not import `core`, `parallel`, or `functions`.

**Risk.** If `sequential`'s loop is rewritten as a callback per element, the sub-threshold path regresses the same way PR #454 measured. If the helper fails to inline, even a once-per-call closure can move a tight reduction.

**Gate.** Warm at least five reps, then alternate the old and new bodies, at `n = parallelThreshold - 1`, for `sum`, `prod`, and `norm`. Drop this PR when any of the three is slower by more than run-to-run noise. The sequential source in the closure must still be a monomorphic `for` loop.

**Tests.** The workerpool numeric tests, plus `packages/workerpool/tests/worker-numerics.test.ts` parity. Empty input: sum `0`, prod `1`, norm `0`.

```bash
cd packages/workerpool && bunx vitest run
```

### PR-I — AssemblyScript Airy series

**Package:** `assembly`, which rebuilds the binary consumed by `functions` and `matrix`. **Pairs retired:** 1.

In `assembly/src/special.ts`, one internal function:

```ts
function _airySeries(x: f64, combine: i32): f64;
```

The loop body of `_airyAiSeries` stays, including the `1e-16` break and the `k <= 30` cap. After the loop, `combine == 0` returns `AI0 * f - AI_PRIME0 * g`. Otherwise return `Math.sqrt(3.0) * (AI0 * f + AI_PRIME0 * g)`. `_airyAiSeries` and `_airyBiSeries` become wrappers so `_airyAi` / `_airyBi` stay. No `new`, no array, no module-level heap slot: the stub runtime is a bump allocator and `heap_reset` would drop it. `AI_PRIME0` stays `0.25881940379280679841`.

This is the only AssemblyScript pair whose loop is identical and whose branch is after the loop. The other 73 AssemblyScript–AssemblyScript pairs keep a different operator or a second payload inside the loop. The 22 AssemblyScript–JavaScript mirrors stay, including the exact `_carlsonRC` group: the JS body is the fallback, and AssemblyScript cannot import a TypeScript package.

**Risk.** A numeric drift against `airyAiScalar` / `airyBiScalar`, or a hand-edited `wasm-manifest.json`. The build generates the manifest. Do not edit it by hand.

**Tests.**

```bash
bun run build:wasm
bun run test:wasm
bunx vitest run functions/tests/special-as-wasm.test.ts functions/tests/special-scalars-airy-oracle.test.ts functions/tests/security/wasm-integrity.test.ts matrix/tests/security/wasm-integrity.test.ts
```

`functions` and `matrix` copy the binary in their package build. A wasm-only edit is not done until that build has run, or `copy-wasm.mjs` fails closed.

## KEEP

557 pairs. The reason is the line that would change behavior or measured speed. Counts are the reported pairs, not a Cartesian product (the 25 unary overloads form 243 reported pairs, not `C(25, 2) = 300`). The buckets below sum to 557.

| Bucket                                          | Pairs |
| ----------------------------------------------- | ----: |
| Unary `Float64Array` overloads                  |   243 |
| AssemblyScript against AssemblyScript           |    73 |
| Worker-pool methods outside the scalar shell    |    34 |
| Tape methods other than the batched matmul trio |    31 |
| AssemblyScript against JavaScript               |    22 |
| `JSBackend` element loops                       |    18 |
| Unary overloads against `mapArray`              |    11 |
| Containment false matches                       |    10 |
| Special-function formulas                       |     8 |
| Scalar promotion ladder                         |     6 |
| Stiff solvers and Runge–Kutta tableaus          |     5 |
| Parallel-backend shell                          |     4 |
| Triangular substitution                         |     4 |
| WASM dispatch ABI                               |     4 |
| Worker layering                                 |     4 |
| GPU async kernels                               |     3 |
| Batched matmul contractions                     |     3 |
| Compensated reductions                          |     3 |
| `factory` generic                               |     3 |
| `isBigNumber` locals                            |     3 |
| Jacobi number against BigNumber                 |     3 |
| Krylov algorithms                               |     3 |
| Map / reduce callback shape                     |     3 |
| NNLS gradients and two contained loops          |     3 |
| Opposite solve axis                             |     3 |
| Pivot cutoff and singular policy                |     3 |
| Sandbox `isSafeMethod`                          |     3 |
| Series, hyperbolic, or decimal sign             |     3 |
| `WASMBackend` kernel envelope                   |     3 |
| WASM loader integrity                           |     3 |
| Complex `tan`/`tanh` and `cot`/`coth`           |     2 |
| Control transpose, matadd, and `norm1` NaN      |     2 |
| `sqrtm` / `logm` formulas                       |     2 |
| `ParallelMatrix` job                            |     2 |
| Sparse multiply against map                     |     2 |
| `Tensor` / `DualTensor` add against sub         |     2 |
| Typed `xgcd`                                    |     2 |
| WASM header against instantiate                 |     2 |
| Worker chunk arity                              |     2 |
| CAS extra rewrite                               |     1 |
| GPU chain against chain-reduce                  |     1 |
| Bernoulli precision cache                       |     1 |
| Eigenvector sign alignment                      |     1 |
| Givens axis                                     |     1 |
| Graph traversal order                           |     1 |
| L1 against Huber influence                      |     1 |
| `mapArray` against `mapBinaryF64`               |     1 |
| Parallel-matrix multiply against matvec         |     1 |
| Parser operator class                           |     1 |
| Newton against Halley correction                |     1 |
| Sandbox compile                                 |     1 |
| Shader plan layout                              |     1 |
| BigNumber shift policy                          |     1 |
| Subset get against set                          |     1 |
| WASM feature probe bytes                        |     1 |
| `mulberry32` layering                           |     1 |

### Unary Float64Array overloads (243 + 11 + 1)

Twenty-five `Float64Array` signatures in `functions/src/typed/arithmetic.ts` and `functions/src/typed/trigonometry.ts`: `sign` 536, `cube` 660, `cbrt` 704, `log10` 774, `log2` 796, `log1p` 816, `expm1` 836, `round` 870, `floor` 891, `ceil` 912, `fix` 935, `sinh` 1189, `cosh` 1211, `tanh` 1231, `min` 1343, `max` 1366, `csc` 94, `sec` 116, `cot` 138, `asin` 170, `acos` 195, `atan` 215, `asinh` 279, `acosh` 299, `atanh` 319.

Each map overload is `shouldParallelize`, then `applyKernel` with that function's kernel string, else a loop that stores one `Math.*` or arithmetic expression. `min` and `max` are reductions (seed `Infinity` / `-Infinity`, scalar result, op name `'min'` / `'max'` passed to `shouldParallelize`). PR #454 measured a shared loop 56% to 643% slower on the sub-threshold path because the call site was megamorphic. `mapArray` (`functions/src/typed/parallel-map.ts` 38) is that shared callback; the 11 pairs against it are the 62-node exact group (`sign`, `cbrt`, `round`, `floor`, `ceil`, `fix`, `cosh`, `asin`, `acos`, `asinh`, `acosh`). `mapArray` against `mapBinaryF64` (56) is unary `applyKernel` against binary `applyKernel2`. A code generator that emits a monomorphic loop per kernel would be a new design, not one of these PRs.

### AssemblyScript against AssemblyScript (73)

The operator or the second array is the body of the loop, or the two functions carry a different payload. `f64Add` / `f64Sub` / `f64Mul` / `f64Div` and `f64Min` / `f64Max` are `@inline` (`assembly/src/ops/f64-buffer.ts`); the comment says the inline keeps the loop in the export. Bitwise `i32` loops are the same shape with a different operator. Value sorts against index sorts (`_heapsort` / `_siftDown` / `_insertionSort` / `_introsort` and the `Idx` twins) swap an index array and compare through `cmpIdxStable`. `complex_array_abs` / `arg` / `abs_squared` are one expression in an 8-wide loop. `complex_array_mul` loads a second array; `complex_array_scale_complex` uses two scalars hoisted outside. `matrix_vector_multiply` writes the dot; `matrix_gemv` writes `alpha * dot + beta * y`, and `beta == 0` still reads `y` (`0 * NaN` is `NaN`). `determinant` mutates an `Array<f64>`; `detSquare` copies into a `Float64Array` first. `resultantValue` and `sylvesterDet` fill the same Sylvester matrix and then call those two determinants. Curve fits log a different variable. Bessel J0/J1 change the term divisor and the return scale inside the recurrence. Rebuilding the binary is extra cost on top of that, not the reason.

### AssemblyScript against JavaScript (22)

The JS function is the fallback used when the module is not loaded or the policy declines it. AssemblyScript cannot import a TypeScript package. Includes the exact `_carlsonRC` group and the Carlson RJ/RD/RF, incomplete and complete elliptic, `erfi`, Hankel, Bessel J0/J1/Y0/Y1 series, `sinIntegral`, `expIntegralEi`, Goertzel, chirp-Z, `_fftInterleaved`, `determinant` against `resultantJS`, and `_erfSeries` against `erfcSelfContained`.

### Worker pool methods other than the scalar shell (34 + 2 + 4 + 1)

`MathWorkerPool` methods that only share the parallel envelope: `scale`, `bitwiseNot`, `unary`, `applyKernel`, `applyKernel2`, `dot`, `distance`, `elementwise`, `bitwiseBinary`, `bitwiseScalar`, `matmul`, `matvec`, `outer`, `distanceMatrix`, `sort`, `runChunks`, `reduce`, `exec`, `execFunction`, and the pairs of `sum` / `prod` / `norm` with those methods. Arity, dtype, result shape, or the chunk task differs. `exec` sends a named method plus a transfer list; `execFunction` sends a function value. `sort` is a k-way merge; `runChunks` maps or filters; `reduce` folds. `applyKernelChunk` / `applyKernel2Chunk` and `bitwiseChunk` / `bitwiseScalarChunk` are same-file arity splits in `worker.ts`.

Layering, because `dist/worker.js` cannot import `core`, `parallel`, or `functions`: `tensordotChunk` ↔ `tensordotChunkKernel` (the bodies have drifted: `Set` against `Array.from`, typed arrays against buffers; the parity test is the pin), `gammaSampleRng` ↔ `_workerGammaRandom`, `fftCoreFloat64` ↔ `fftFrameInPlace`, `gaussQuadSerial` ↔ `integrateChunk` (a closure against a `compileFunctionSource` string). `mulberry32` ↔ `_workerMulberry32` is the same closure with a different name; `worker-numerics.test.ts` pins parity.

### Tape, dual, and tensor arithmetic (31 + 3 + 2)

`autograd/src/tape.ts` unary methods share `tape.record` and differ in the forward value and the adjoint: `sin` is `dY*cos`, `cos` is `-dY*sin`, `tan` is `dY/cos^2`, `sqrt` is `dY/(2*y)`, `exp` multiplies by the cached exp, `log` divides by `x`, `abs` uses the sign and writes `0` at exact `0`, `square` is `dY*2*x`, `scale` is `dY*k`. `mean` divides the broadcast by `N`; the #489 merge already shared the backward scatter, and the forward methods still differ. `add` / `sub` / `mul` are different element formulas. `_unaryElementwise` takes callbacks; putting `exp` on it is the hot-loop loss. `_eigSymBackward` uses a symmetrizer; `_eigGeneralBackward` uses a gauge. `_eigSymmetric` rejects an imaginary part; `_eigGeneral` also requires `cond_inf(V) <= 1e14`. `svd` against `_eigSymmetric` is a different factorization. The `_batchedMatmul` trio (3 pairs) contracts `A@B`, `dY@Bᵀ`, and `Aᵀ@dY` with different `m`/`k`/`n` and offsets. A stride GEMM would sit on the tape hot path.

`DualTensor.add` / `sub` and `Tensor.add` / `sub` are the same element loop with `+` against `-`.

### JSBackend element loops (18)

`add`, `subtract`, `multiplyElementwise`, `divideElementwise`, `scale`, `abs`, and `transpose` in `matrix/src/backends/JSBackend.ts` share the `i, j` store. The stored expression differs. `transpose` also swaps the index and the shape. `negate` already calls `scale(a, -1)`. A per-element callback is the measured loss. Generating monomorphic loops is out of scope.

### Scalar ladder and compensated sums (6 + 3)

`addScalar`, `subtractScalar`, `multiplyScalar`, `divideScalar` (`core/src/arithmetic/scalar.ts`) share the promotion ladder. The number and bigint arms are the operator, and the promoted methods are `.add` / `.subtract` / `.multiply` / `.divide`. Hot path.

`norm2` scales one vector; `scaledDistance` scales `a[i] - b[i]`. `pairwiseSum` adds eight lanes of one array; `pairwiseDot` adds `a[i]*b[i]`. `neumaierSum` returns `sum+c`; `neumaierCumsum` writes every prefix `out[i] = sum+c`.

### Solvers, substitutions, and factorizations (5 + 4 + 3 + 3 + 3 + 2 + 1 + 3)

`_denseSolve` (`solveDAE.ts` 184) returns a NaN vector when `|pivot| < 1e-300` and always swaps. `_inlineLuSolve` (`solveODE.ts` 137) has no cutoff and divides by the pivot; the comment records it 1.8×–8× faster than matrix LU for `n = 1–3`. `solveLinearSystem` (`fir-smoothing.ts` 26) throws below `1e-14`, skips a zero factor, and swaps only when `piv !== col`. A singular-policy branch on the stiff step is a mode flag in that loop. `rosenbrockSolve` / `rodasSolve` and `_rk23` / `_rk45` are different tableaus; the shared `_rk` shell already exists.

`lsolve` / `usolve` and `lsolveAll` / `usolveAll`, dense and sparse: opposite column directions and CSC pointer walks, and a zero pivot throws. `condest` `luSolve` / `luSolveTranspose` and the Gaussian-process `forwardSolve` / `backSolveTranspose` walk opposite axes. `tensor` `forwardSub` does not divide by the diagonal; `backSub` divides by `U[i, i]`.

`makeILU0` writes a unit lower factor and divides by `U`; `makeIC0` divides by `L` on both sweeps. `incompleteCholesky` is IC(0) on a sparsity pattern; `_cholesky` is dense and uses a different error string. `cg` and `bicgstab` are different recurrences.

`invertUnscaled` cuts off at `1e-12` and skips a zero factor. `matrixInverse` and `_matInverse` use `1e-15`, always multiply the factor, and yield NaN on a non-finite entry. `solveAugmentedNormalEquations` mutates and returns null at `1e-14`; `linsolve` copies and throws at `1e-15`.

`sqrtmSymmetric` gates eigenvalues at `-1e-8` and forms `Q*sqrt(D)*Qᵀ`. `sqrtmGeneral` rejects `|im| > 1e-7` or `re < -1e-7` and forms `Q*sqrt(D)*Q⁻¹`. `logm` `validateEigenvalues` rejects; `logmEig` builds the log.

`applyGivensCols` rotates columns `(j, i)` / `(j, k)`. `applyGivensLeft` rotates rows `(i, j)` / `(k, j)`.

`WASMBackend.inverse`, `choleskyDecomposition`, and `luDecomposition` (3 pairs) share a call envelope and run different kernels.

### Typed numeric definitions (2 + 1 + 3 + 3 + 1 + 8 + 1 + 3)

`xgcd` `number, number` (1013) floors through `Math.floor` before the loop. `bigint, bigint` (1028) uses truncating BigInt division and does not pre-floor. `_xgcdBigNumber` and `_xgcdFraction` are different arithmetic types.

`rightArithShiftBigNumber`: an infinite shift of a negative is `-1`. `rightLogShiftBigNumber`: that case is `NaN`, and a negative is reduced mod `2^32`.

`BigNumber.sinh` returns `(e^x - e^{-x})/2` and passes infinities through. `tanh` returns the ratio and maps infinities to the sign. `_atanTaylor` divides a copy of the term by `2n+1` and does not store that divisor back into `term`. `_alternatingEvenTaylor` folds the divisor and the negate into `term`. `Decimal.plus` / `minus` differ in the sign rules.

`diag` / `diagBig`, `Sij1` / `x1`, `Sij1Big` / `x1Big`: number against BigNumber Jacobi, and a column rotation against the full diagonal update.

`bernoulli` `bigint | Fraction` against `BigNumber`: the precision-reset cache exists only on the BigNumber path.

`gradL1` is `sign(residual)` inside the row loop. `gradHuber` is `2*clamp(residual, -1, 1)`. A callback there is the #454 loss. The two `nnls` `gradient`s differ inside the product: line 94 fuses `Aᵀ(b−Ax)`; line 203 materializes `r = Ax−b` then `Aᵀr`, opposite sign, different rounding. The other two pairs in that count of 3 are containment, not a second algorithm to merge: `gradient` (94) against `lsqBounded` (189), and `bfgs` `matVec` against `lsqBounded`. `besselJ0Series` / `besselJ1Series` (the JS pair), `fresnelC` / `fresnelS`, `erfc2` / `erfc3`, `ferrersP` / `ferrersPContinued`, `spheroidalAngular` / `spheroidalAngularContinued`, `besselJScalar` / `besselYScalar`, `dct` / `dst`, `rickerWavelet` / `morletWavelet`: the term, the seed, the band, or the trig kernel differs inside the loop.

### Security, generics, and local guards (3 + 3 + 3 + 3 + 2 + 1 + 1)

`isSafeMethod` in `core/src/customs.ts` (exported, `method: string`), `expression/src/utils/customs.ts` (`method: unknown`, then `method as string`), and `functions/src/utils/customs.ts` (`method: string`, not exported). Sandbox predicate. The expression and functions copies are canonical in those packages. The core copy is not on `core`'s public index or `internal`.

`factory`: core `TDeps extends Record<string, unknown>` returns `FactoryFunction<TResult>`. Expression uses `TDeps extends object`. Functions uses `TDeps extends Record<string, any> = any`. The comment at `expression/src/utils/factory.ts` 26–34 records that core's constraint is TS2345 at the call sites. Expression ↔ functions are text-identical except that generic line.

`isBigNumber`: expression and functions are text-identical local copies. `expression/tests/is-guards-local.test.ts` and `functions/tests/is-guards-local.test.ts` forbid `export * from` core; a cross-module re-export measured about 40% slower on the Tukey path. Core's copy (`core/src/is.ts` 155) is the shorter sibling at `jStruct` 0.861.

`loadNodeWasm` (`j` 0.952), `loadBrowserWasm` (0.919), and `precompile` (0.877): `matrix` dynamically imports `./wasm/integrity.js`; `functions` statically calls `verifyWasmIntegrity`. Folding them can skip the SHA-384 compare on one path. `asAllocHeader` pins a header; `allocAsTypedView` pins a header plus a typed view. `getImports` builds the import object; `WASMBackend.loadAsModule` is the integrity-checked instantiate.

`_getObjectProperty` returns `getSafeProperty` and, on an empty index, `undefined`. `_setObjectProperty` clones and `setSafeProperty`, and on an empty index returns the object. The shared prelude is the index check. The sandbox calls stay separate.

`compileFunctionNode` / `compileArrayNode`: the sandbox accessor path stays.

### GPU, parallel shells, sparse, and small control-flow splits (28)

`GPUMatrixBackend` `addAsync` / `scaleAsync` / `multiplyAsync`: different kernels and shapes. `chainGpuDispatchImpl` / `chainReduceGpuDispatchImpl`: a shared template can pop the wrong per-device error scope and read zeros (the WGSL LIFO gotcha). `planRunShaderFromAdd` / `planRunShaderFromTranspose`: different pipeline, buffer count, and bindings. `gpuOrJs` and `RunShaderPlan` already exist. `detectSIMD` / `detectBulkMemory` already share `testWasmFeature`; the remaining bodies are the probe bytes. Other detectors in that file have the same shape and are under the cutoff or unpaired.

`ParallelBackend` `scale` / `multiply` / `transpose` / `sum`: the `whenParallel` shell matches; the pool method and the result shape do not. `ParallelMatrix.dotProduct` / `sum` and `elementwise` / `scale` likewise. The two `DenseMatrix, DenseMatrix` handlers in `matrix/src/parallel-matrix.ts` are multiply against matvec.

`SparseMatrix.multiplyElementwise` against `mapNonZeros`: a per-nonzero callback measured +12.4% (2000×2000, about 40k nonzeros) and +4.4% (500×500); tried in #481 and reverted. `multiplyElementwise` against `multiply` is a different product.

`control-equations` `transpose` writes `T[j][i] = A[i][j]`; `matadd` writes `C[i][j] = A[i][j] + s*B[i][j]`. `norm1` in that file uses `Math.max` (NaN propagates). `matrix` `common.ts` `norm1` uses `colSum > maxColSum` (NaN does not replace the max).

`recursiveMapWithIndex` passes `index.slice(0, depth)`. `recursiveMap` calls a unary callback. `_reduce` folds to a scalar. `_mapSlices` invokes the callback on the whole slice when `dim <= 0`. `matAlgo13` `_iterate` is dense-dense `f(a[i], b[i])`. `matAlgo14` `_iterate` is a scalar with the operand order reversed.

`welchPSDDispatch` / `bartlettPSDDispatch`, `polyMulDispatch` / `resultantDispatch`, `tridiagSolveDispatch` / `dividedDifferenceDispatch`, `runBinaryBitwiseWasm` / `runUnaryBitwiseWasm`: the exports, ABIs, and result types differ. `withAsF64` already holds the marshalling.

`parseShift` (1003) is binary `<<` `>>` `>>>` over `parseConversion`, which special-cases inches inside the loop. `parseLeftHandOperators` (1404) is postfix `!` and `'` over `parseCustomNodes`, then `parseAccessors`. `parseAddSubtract` is a third loop with a percentage rewrite. One binary-infix helper would hide those.

`fullSimplify` / `_casSimplifyOne`: the CAS path adds numeric eval and like-term combine. `bfs` / `visit`: FIFO against recursive DFS. `newton` / `halley`: `iterateRoot` is already shared; the corrections differ.

### Complex closed forms and eigenvector aggregation (2 + 1)

`Complex.tan` (480) is `d = cos(2x) + cosh(2y)`, then `(sin(2x)/d, sinh(2y)/d)`. `tanh` (538) is `d = cosh(2x) + cos(2y)`, then `(sinh(2x)/d, sin(2y)/d)`. `cot` (490) is `d = cosh(2y) - cos(2x)`, then `(sin(2x)/d, -sinh(2y)/d)`. `coth` (548) is `d = cosh(2x) - cos(2y)`, then `(sinh(2x)/d, -sin(2y)/d)`. A helper that takes four trig callbacks is longer than the four-line methods.

`_aggregateEigenvector` sign-aligns restart vectors and renormalizes before it fills `centrality`, `centralityPerRestart`, and `restartStats`. `aggregateRestartVectors` averages without that alignment. That pair stays out of PR-E.

### Containment false matches (10)

The smaller body is a loop the larger function also contains. Sharing them would merge unrelated algorithms. `jStruct` is below 0.6 and containment is what reported the pair.

| Pair                                       | jStruct | What is contained                      |
| ------------------------------------------ | ------: | -------------------------------------- |
| `flipCols` ↔ `transposeSquare`             |   0.515 | a dense index copy, different map      |
| `vecRowMajor` ↔ `matrixExpm`               |   0.247 | the final copy loop of the exponential |
| `_eigSymBackward` ↔ `transposeSquare`      |   0.221 | a transpose inside the adjoint         |
| `luDecomposition` ↔ `transposeSquare`      |   0.176 | a transpose in the factorization       |
| `_svdBackward` ↔ `transposeSquare`         |   0.138 | a transpose inside the adjoint         |
| `qr` ↔ `transposeSquare`                   |   0.116 | a transpose in QR                      |
| `transposeSquare` ↔ `tensorSolve`          |   0.074 | a transpose in the solve               |
| `eigGeneral` ↔ `gemmRows`                  |   0.036 | a GEMM-shaped nest                     |
| `eigGeneral` ↔ `transposeSquare`           |   0.025 | a transpose in the general eig         |
| `_intersect3dHelper` ↔ `createComplexEigs` |   0.022 | an unrelated numeric nest              |

`gradient` ↔ `lsqBounded` and `matVec` ↔ `lsqBounded` are the same kind of containment and are counted in the NNLS row above. `aggregateRestartVectors` ↔ `_aggregateEigenvector` (`j` 0.474) is the sign-alignment split named under PR-E.

## Cross-cutting utilities

Three shapes cover the merges. Each one leaves the numeric choice at the call site.

1. **Render with a template.** `renderAssignment`, `renderObjectEntries`, and the existing `renderRelational`. The walk is shared. The glyphs are arguments. This does not extend to `AccessorNode` or to `toMathML`.
2. **A combiner invoked once.** `flattenSetPair`'s `combine`, `dispatchCentrality`'s `packSingle` and `aggregate`, `renderDescendingUnivariate`'s `coeffAt`, and `reduceScalar`'s `sequential` plus `reducePartials`.
3. **A choice outside the element loop.** `unflatten`'s `side`, `flipDense`'s `axis` selecting a whole nest, `truncBound`'s `toward` on one bigint quotient, and `_airySeries`'s `combine` after the series.

Rejected as a shared utility, because each one hides a real difference:

- An elementwise callback for the `Float64Array` overloads, `JSBackend`, the tape adjoints, `f64Add` and its siblings, or `SparseMatrix.mapNonZeros`.
- A Gauss–Jordan mode flag. `gaussJordanSolve` and `gaussJordanContinue` already stay split: continue skips a tiny pivot (`1e-15` in `expm`, `1e-30` in `logm`) instead of returning null.
- One `factory` generic. Core's `Record<string, unknown>` breaks the call sites.
- One `isBigNumber` import. The local copies are the measured fast path.
- One `WasmLoader`. The integrity import is the SHA-384 gate.
- One `isSafeMethod` moved onto `core/internal`. The package copies are the sandbox predicate those packages call.

## Observations that are not clone PRs

`AccessorNode._toTex` (`expression/src/node/AccessorNode.ts` 250) assigns the string literal `"'\\left(' + object + '\\right)"'`. The concatenation sits inside the quotes, so a parenthesized object renders that text instead of TeX. `_toHTML` and `_toTex` also drop the optional-chaining prefix that `_toString` (223–224) includes. These functions are under the 50-node cutoff, so they are not in the 573. A markup helper must not absorb them: folding `_toTex` in would either keep the bug or change TeX. Fix the literal and the missing prefix in their own change, with a golden string.

The ledger's other follow-ups stay follow-ups. `GPUBackend.add` / `matmul` / `transpose` still skip `serializeGpu`, so a WebGPU validation error can read back zeros. `core`'s `deepMap` / `deepForEach` / `reduce` (`/internal`) are still typed for flat arrays while they recurse into nested ones.

## Appendix

Every remaining near pair. `j` is `jStruct`. The line is the function start in `156e4ea8`. A pair from an exact group is listed here at `j` 1. 16 lines are MERGE and 557 are KEEP.

- `assembly/src/special.ts:633 _carlsonRC` ↔ `functions/src/wasm/special/wasm-bridge.ts:278 _carlsonRC` (j 1.000) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `autograd/src/tape.ts:2302 _batchedMatmul` ↔ `autograd/src/tape.ts:2345 _batchedMatmulGradA` (j 1.000) — **KEEP.** Three contractions: A@B, dY@Bᵀ, Aᵀ@dY, with different m/k/n and offsets. A shared GEMM sits on the tape hot path.
- `autograd/src/tape.ts:2302 _batchedMatmul` ↔ `autograd/src/tape.ts:2388 _batchedMatmulGradB` (j 1.000) — **KEEP.** Three contractions: A@B, dY@Bᵀ, Aᵀ@dY, with different m/k/n and offsets. A shared GEMM sits on the tape hot path.
- `autograd/src/tape.ts:2345 _batchedMatmulGradA` ↔ `autograd/src/tape.ts:2388 _batchedMatmulGradB` (j 1.000) — **KEEP.** Three contractions: A@B, dY@Bᵀ, Aᵀ@dY, with different m/k/n and offsets. A shared GEMM sits on the tape hot path.
- `core/src/customs.ts:113 isSafeMethod` ↔ `expression/src/utils/customs.ts:104 isSafeMethod` (j 1.000) — **KEEP.** Sandbox predicate. Expression types `method` as `unknown` and casts it to `string`. The core copy is not on `internal`.
- `core/src/customs.ts:113 isSafeMethod` ↔ `functions/src/utils/customs.ts:102 isSafeMethod` (j 1.000) — **KEEP.** Sandbox predicate. Text-identical except `export` on the core copy. The functions copy is not exported, and the core copy is not on `internal`.
- `core/src/factory.ts:83 factory` ↔ `expression/src/utils/factory.ts:94 factory` (j 1.000) — **KEEP.** Bodies match. The generic differs (Record<string, unknown> vs object vs Record<string, any>), and core's constraint is TS2345 at the call sites.
- `core/src/factory.ts:83 factory` ↔ `functions/src/utils/factory.ts:104 factory` (j 1.000) — **KEEP.** Bodies match. The generic differs (Record<string, unknown> vs object vs Record<string, any>), and core's constraint is TS2345 at the call sites.
- `core/src/numeric/rng.ts:27 mulberry32` ↔ `packages/workerpool/src/worker-numerics.ts:42 _workerMulberry32` (j 1.000) — **KEEP.** Same Mulberry32 closure. dist/worker.js cannot import core. worker-numerics.test.ts pins parity.
- `core/src/types/complex.ts:480 tan` ↔ `core/src/types/complex.ts:538 tanh` (j 1.000) — **KEEP.** tan is (sin 2x, sinh 2y)/(cos 2x + cosh 2y). tanh swaps the doubled parts. A four-callback helper is longer than the bodies.
- `core/src/types/complex.ts:490 cot` ↔ `core/src/types/complex.ts:548 coth` (j 1.000) — **KEEP.** cot is (sin 2x, -sinh 2y)/(cosh 2y - cos 2x). coth swaps the doubled parts and the minus.
- `expression/src/utils/customs.ts:104 isSafeMethod` ↔ `functions/src/utils/customs.ts:102 isSafeMethod` (j 1.000) — **KEEP.** Sandbox predicate. Expression casts `method as string`. Functions types `method` as `string` and does not export the function.
- `expression/src/utils/factory.ts:94 factory` ↔ `functions/src/utils/factory.ts:104 factory` (j 1.000) — **KEEP.** Bodies match. The generic differs (Record<string, unknown> vs object vs Record<string, any>), and core's constraint is TS2345 at the call sites.
- `expression/src/utils/is.ts:291 isBigNumber` ↔ `functions/src/utils/is.ts:226 isBigNumber` (j 1.000) — **KEEP.** Local duck-test. A cross-module re-export measured about 40% slower on the Tukey path. The guard tests forbid export * from core.
- `functions/src/set/setSymDifference.ts:48 Array | Matrix, Array | Matrix` ↔ `functions/src/set/setUnion.ts:65 Array | Matrix, Array | Matrix` (j 1.000) — **MERGE.** PR-B. The empty-set flatten matches; only the final concat differs, and it runs once.
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
- `packages/workerpool/src/worker.ts:770 tensordotChunk` ↔ `parallel/src/ComputePool.ts:413 tensordotChunkKernel` (j 0.971) — **KEEP.** dist/worker.js cannot import core, parallel, or functions. The worker copy is the bundle, and the bodies have drifted where a parity test pins them.
- `functions/src/wasm/WasmLoader.ts:368 loadNodeWasm` ↔ `matrix/src/backends/WasmLoader.ts:658 loadNodeWasm` (j 0.952) — **KEEP.** matrix dynamically imports ./wasm/integrity.js; functions calls verifyWasmIntegrity statically. Folding can skip the SHA-384 compare.
- `functions/src/wasm/WasmLoader.ts:400 loadBrowserWasm` ↔ `matrix/src/backends/WasmLoader.ts:691 loadBrowserWasm` (j 0.919) — **KEEP.** matrix dynamically imports ./wasm/integrity.js; functions calls verifyWasmIntegrity statically. Folding can skip the SHA-384 compare.
- `matrix/src/backends/JSBackend.ts:123 abs` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.917) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `assembly/src/special.ts:725 _carlsonRJ` ↔ `functions/src/wasm/special/wasm-bridge.ts:379 _carlsonRJ` (j 0.915) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/typed/graph.ts:632 pageRank` ↔ `functions/src/typed/graph.ts:1011 eigenvectorCentrality` (j 0.915) — **MERGE.** PR-E. Shared restart shell. Kernels stay. packSingle runs once and keeps ranks versus centrality.
- `assembly/src/special.ts:799 _ellipticPiIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:459 _ellipticPiIncomplete` (j 0.909) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `assembly/src/sort.ts:120 _heapsort` ↔ `assembly/src/sort.ts:222 _heapsortIdx` (j 0.905) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:858 cos` (j 0.900) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `matrix/src/backends/GPUMatrixBackend.ts:183 addAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:282 multiplyAsync` (j 0.900) — **KEEP.** Different kernels and result shapes. gpuOrJs is already the shared never-throw shell.
- `assembly/src/special.ts:788 _ellipticEIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:448 _ellipticEIncomplete` (j 0.898) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/probability/util/gammaSample.ts:24 gammaSampleRng` ↔ `packages/workerpool/src/worker.ts:850 _workerGammaRandom` (j 0.891) — **KEEP.** dist/worker.js cannot import core, parallel, or functions. The worker copy is the bundle, and the bodies have drifted where a parity test pins them.
- `packages/workerpool/src/worker.ts:250 applyKernelChunk` ↔ `packages/workerpool/src/worker.ts:271 applyKernel2Chunk` (j 0.889) — **KEEP.** Same-file arity split: one array against two, or an array operand against a scalar.
- `functions/src/gpu/elementwise-gpu.ts:307 chainGpuDispatchImpl` ↔ `functions/src/gpu/elementwise-gpu.ts:499 chainReduceGpuDispatchImpl` (j 0.888) — **KEEP.** A shared command template can pop the wrong per-device error scope and read zeros.
- `functions/src/numeric/krylov.ts:223 makeILU0` ↔ `functions/src/numeric/krylov.ts:244 makeIC0` (j 0.887) — **KEEP.** ILU0 writes a unit lower factor and divides by U. IC0 divides by L on both sweeps.
- `core/src/numeric/stable.ts:132 norm2` ↔ `core/src/numeric/stable.ts:222 scaledDistance` (j 0.881) — **KEEP.** norm2 scales one vector's entries. scaledDistance scales a[i]-b[i]. Documented hot loop.
- `assembly/src/special.ts:683 _carlsonRD` ↔ `functions/src/wasm/special/wasm-bridge.ts:329 _carlsonRD` (j 0.877) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/wasm/WasmLoader.ts:306 precompile` ↔ `matrix/src/backends/WasmLoader.ts:592 precompile` (j 0.877) — **KEEP.** matrix dynamically imports ./wasm/integrity.js; functions calls verifyWasmIntegrity statically. Folding can skip the SHA-384 compare.
- `matrix/src/backends/GPUMatrixBackend.ts:183 addAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:242 scaleAsync` (j 0.875) — **KEEP.** Different kernels and result shapes. gpuOrJs is already the shared never-throw shell.
- `autograd/src/tape.ts:475 sum` ↔ `autograd/src/tape.ts:500 mean` (j 0.874) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `matrix/src/backends/WASMBackend.ts:779 inverse` ↔ `matrix/src/backends/WASMBackend.ts:894 choleskyDecomposition` (j 0.873) — **KEEP.** Shared call envelope around different kernels (LU, inverse, Cholesky).
- `assembly/src/special.ts:778 _ellipticFIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:438 _ellipticFIncomplete` (j 0.872) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/numeric/solveDAE.ts:184 _denseSolve` ↔ `functions/src/numeric/solveODE.ts:137 _inlineLuSolve` (j 0.872) — **KEEP.** Pivot policy differs: NaN below 1e-300, no cutoff, or throw below 1e-14. A mode flag would sit on the stiff-step loop. Inline LU is the measured n=1–3 path.
- `expression/src/node/AssignmentNode.ts:302 _toString` ↔ `expression/src/node/AssignmentNode.ts:349 _toHTML` (j 0.869) — **MERGE.** PR-A. Same object/index/value render and needParenthesis; the parenthesis glyphs and the '=' joiner differ.
- `functions/src/algebra/solver/lsolveAll.ts:149 _denseForwardSubstitution` ↔ `functions/src/algebra/solver/usolveAll.ts:149 _denseBackwardSubstitution` (j 0.869) — **KEEP.** Opposite triangle direction, including the sparse CSC pointer walk. A zero pivot throws.
- `functions/src/algebra/solver/lsolveAll.ts:218 _sparseForwardSubstitution` ↔ `functions/src/algebra/solver/usolveAll.ts:218 _sparseBackwardSubstitution` (j 0.867) — **KEEP.** Opposite triangle direction, including the sparse CSC pointer walk. A zero pivot throws.
- `assembly/src/special.ts:396 _airyAiSeries` ↔ `assembly/src/special.ts:423 _airyBiSeries` (j 0.863) — **MERGE.** PR-I. The series loop matches. The Ai/Bi combination runs after the loop, as airyScalar already does.
- `packages/workerpool/src/index.ts:960 scale` ↔ `packages/workerpool/src/index.ts:1148 bitwiseNot` (j 0.862) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `core/src/is.ts:155 isBigNumber` ↔ `expression/src/utils/is.ts:291 isBigNumber` (j 0.861) — **KEEP.** Local duck-test. A cross-module re-export measured about 40% slower on the Tukey path. The guard tests forbid export * from core.
- `core/src/is.ts:155 isBigNumber` ↔ `functions/src/utils/is.ts:226 isBigNumber` (j 0.861) — **KEEP.** Local duck-test. A cross-module re-export measured about 40% slower on the Tukey path. The guard tests forbid export * from core.
- `assembly/src/ops/complex-array.ts:120 complex_array_mul` ↔ `assembly/src/ops/complex-array.ts:165 complex_array_scale_complex` (j 0.855) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/sort.ts:102 _siftDown` ↔ `assembly/src/sort.ts:205 _siftDownIdx` (j 0.852) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/special.ts:560 _ellipticK` ↔ `functions/src/wasm/special/scalars.ts:333 ellipticKScalar` (j 0.849) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/arithmetic/xgcd.ts:99 _xgcdBigNumber` ↔ `functions/src/arithmetic/xgcd.ts:153 _xgcdFraction` (j 0.846) — **KEEP.** BigNumber arithmetic against Fraction arithmetic. The loop is the same shape and the operations are not.
- `packages/workerpool/src/index.ts:768 sum` ↔ `packages/workerpool/src/index.ts:806 prod` (j 0.846) — **MERGE.** PR-H. The parallel envelope matches. The sequential loop stays a closure invoked once. Gate on a sub-threshold measurement.
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
- `assembly/src/special.ts:656 _carlsonRF` ↔ `functions/src/wasm/special/wasm-bridge.ts:301 _carlsonRF` (j 0.839) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:836 sin` (j 0.832) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `packages/workerpool/src/index.ts:960 scale` ↔ `packages/workerpool/src/index.ts:1659 applyKernel` (j 0.832) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `assembly/src/ops/special.ts:79 erfi` ↔ `functions/src/typed/special.ts:111 erfiScalar` (j 0.829) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `assembly/src/special.ts:101 _besselHankel` ↔ `functions/src/wasm/special/scalars.ts:132 besselHankel` (j 0.829) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `core/src/numeric/stable.ts:103 neumaierSum` ↔ `core/src/numeric/stable.ts:373 neumaierCumsum` (j 0.829) — **KEEP.** One compensated total (sum+c) against a prefix write out[i]=sum+c.
- `autograd/src/tape.ts:133 add` ↔ `autograd/src/tape.ts:148 sub` (j 0.828) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/dual-tensor.ts:77 add` ↔ `autograd/src/dual-tensor.ts:89 sub` (j 0.826) — **KEEP.** Hot element loop. add stores +, sub stores -.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.825) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.823) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/ops/polynomial.ts:140 resultantValue` ↔ `assembly/src/poly.ts:98 sylvesterDet` (j 0.821) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:817 exp` (j 0.821) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/sort.ts:89 _insertionSort` ↔ `assembly/src/sort.ts:193 _insertionSortIdx` (j 0.820) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/ops/polynomial.ts:87 determinant` ↔ `assembly/src/poly.ts:60 detSquare` (j 0.818) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/typed/graph.ts:831 betweennessCentrality` ↔ `functions/src/typed/graph.ts:1011 eigenvectorCentrality` (j 0.818) — **MERGE.** PR-E. Shared restart shell. Kernels stay. packSingle runs once and keeps ranks versus centrality.
- `assembly/src/ops/matrix.ts:276 matrix_vector_multiply` ↔ `assembly/src/ops/matrix.ts:614 matrix_gemv` (j 0.814) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `packages/workerpool/src/index.ts:768 sum` ↔ `packages/workerpool/src/index.ts:1495 norm` (j 0.813) — **MERGE.** PR-H. The parallel envelope matches. The sequential loop stays a closure invoked once. Gate on a sub-threshold measurement.
- `packages/workerpool/src/worker.ts:311 bitwiseChunk` ↔ `packages/workerpool/src/worker.ts:353 bitwiseScalarChunk` (j 0.812) — **KEEP.** Same-file arity split: one array against two, or an array operand against a scalar.
- `packages/workerpool/src/index.ts:1148 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1659 applyKernel` (j 0.810) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `functions/src/algebra/simplify/util.ts:201 unflattenr` ↔ `functions/src/algebra/simplify/util.ts:225 unflattenl` (j 0.802) — **MERGE.** PR-C. Same recursion and associativity test; right pops, left shifts. Cold tree walk.
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
- `matrix/src/operations/condest.ts:18 luSolve` ↔ `matrix/src/operations/condest.ts:47 luSolveTranspose` (j 0.794) — **KEEP.** Opposite axis. tensor backSub divides by the diagonal; forwardSub does not.
- `matrix/src/backends/GPUMatrixBackend.ts:242 scaleAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:282 multiplyAsync` (j 0.785) — **KEEP.** Different kernels and result shapes. gpuOrJs is already the shared never-throw shell.
- `matrix/src/operations/givens.ts:28 applyGivensCols` ↔ `matrix/src/operations/schur.ts:60 applyGivensLeft` (j 0.783) — **KEEP.** Columns (j,i)/(j,k) against rows (i,j)/(k,j).
- `assembly/src/ops/complex-array.ts:211 complex_array_abs` ↔ `assembly/src/ops/complex-array.ts:235 complex_array_abs_squared` (j 0.780) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `assembly/src/special.ts:129 _besselJ0Series` ↔ `functions/src/wasm/special/scalars.ts:164 besselJ0Series` (j 0.778) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/algebra/solver/lsolve.ts:134 _denseForwardSubstitution` ↔ `functions/src/algebra/solver/usolve.ts:134 _denseBackwardSubstitution` (j 0.774) — **KEEP.** Opposite triangle direction, including the sparse CSC pointer walk. A zero pivot throws.
- `functions/src/fit-scalar.ts:550 gradL1` ↔ `functions/src/fit-scalar.ts:570 gradHuber` (j 0.770) — **KEEP.** sign(residual) against 2*clamp(residual,-1,1) inside the row loop. A callback there is the PR #454 loss.
- `assembly/src/ops/f64-buffer.ts:7 f64Min` ↔ `assembly/src/ops/f64-buffer.ts:21 f64Max` (j 0.769) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `packages/workerpool/src/index.ts:1198 matmul` ↔ `packages/workerpool/src/index.ts:2011 matvec` (j 0.766) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:844 dot` ↔ `packages/workerpool/src/index.ts:1533 distance` (j 0.764) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
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
- `assembly/src/special.ts:580 _ellipticE` ↔ `functions/src/wasm/special/scalars.ts:355 ellipticECompleteScalar` (j 0.759) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `assembly/src/ops/special.ts:93 expIntegralEi` ↔ `functions/src/typed/special.ts:455 expIntegralEiScalar` (j 0.758) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `autograd/src/tape.ts:1970 _eigSymBackward` ↔ `autograd/src/tape.ts:2049 _eigGeneralBackward` (j 0.757) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/sort.ts:134 _introsort` ↔ `assembly/src/sort.ts:240 _introsortIdx` (j 0.756) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `tensor/src/Tensor.ts:161 add` ↔ `tensor/src/Tensor.ts:172 sub` (j 0.755) — **KEEP.** Hot element loop. add stores +, sub stores -.
- `functions/src/typed/graph.ts:632 pageRank` ↔ `functions/src/typed/graph.ts:831 betweennessCentrality` (j 0.754) — **MERGE.** PR-E. Shared restart shell. Kernels stay. packSingle runs once and keeps ranks versus centrality.
- `packages/workerpool/src/index.ts:1198 matmul` ↔ `packages/workerpool/src/index.ts:1873 distanceMatrix` (j 0.754) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `assembly/src/ops/curvefit.ts:6 expfit` ↔ `assembly/src/ops/curvefit.ts:55 powerfit` (j 0.752) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:836 sin` (j 0.752) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/ops/complex-array.ts:211 complex_array_abs` ↔ `assembly/src/ops/complex-array.ts:223 complex_array_arg` (j 0.750) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/wasm/signal/wasm-bridge.ts:332 welchPSDDispatch` ↔ `functions/src/wasm/signal/wasm-bridge.ts:369 bartlettPSDDispatch` (j 0.750) — **KEEP.** The WASM-or-JS shell matches. The export, ABI, and result type differ. withAsF64 already holds the marshalling.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:858 cos` (j 0.748) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:858 cos` (j 0.746) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/wasm/poly/wasm-bridge.ts:109 polyMulDispatch` ↔ `functions/src/wasm/poly/wasm-bridge.ts:266 resultantDispatch` (j 0.745) — **KEEP.** The WASM-or-JS shell matches. The export, ABI, and result type differ. withAsF64 already holds the marshalling.
- `parallel/src/ParallelMatrix.ts:388 dotProduct` ↔ `parallel/src/ParallelMatrix.ts:421 sum` (j 0.744) — **KEEP.** The parallel shell matches. The reduction (dot versus sum, elementwise versus scale) does not.
- `functions/src/algebra/solver/lsolve.ts:184 _sparseForwardSubstitution` ↔ `functions/src/algebra/solver/usolve.ts:188 _sparseBackwardSubstitution` (j 0.742) — **KEEP.** Opposite triangle direction, including the sparse CSC pointer walk. A zero pivot throws.
- `matrix/src/backends/gpu/run-shader.ts:32 planRunShaderFromAdd` ↔ `matrix/src/backends/gpu/run-shader.ts:82 planRunShaderFromTranspose` (j 0.742) — **KEEP.** Different pipeline, buffer count, and bindings. RunShaderPlan is already shared.
- `packages/workerpool/src/index.ts:960 scale` ↔ `packages/workerpool/src/index.ts:1582 unary` (j 0.738) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:1659 applyKernel` ↔ `packages/workerpool/src/index.ts:1709 applyKernel2` (j 0.732) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `expression/src/parse.ts:1003 parseShift` ↔ `expression/src/parse.ts:1404 parseLeftHandOperators` (j 0.731) — **KEEP.** Binary << >> >>> over parseConversion (inch special case inside the loop) against postfix ! and ' over parseCustomNodes.
- `functions/src/numeric/solveDAE.ts:184 _denseSolve` ↔ `functions/src/signal/fir-smoothing.ts:26 solveLinearSystem` (j 0.728) — **KEEP.** Pivot policy differs: NaN below 1e-300, no cutoff, or throw below 1e-14. A mode flag would sit on the stiff-step loop. Inline LU is the measured n=1–3 path.
- `functions/src/numeric/solveODE.ts:137 _inlineLuSolve` ↔ `functions/src/signal/fir-smoothing.ts:26 solveLinearSystem` (j 0.728) — **KEEP.** Pivot policy differs: NaN below 1e-300, no cutoff, or throw below 1e-14. A mode flag would sit on the stiff-step loop. Inline LU is the measured n=1–3 path.
- `assembly/src/signal.ts:236 goertzel_f64` ↔ `functions/src/wasm/signal/wasm-bridge.ts:93 goertzelJS` (j 0.727) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/wasm/bridges/common.ts:180 asAllocHeader` ↔ `matrix/src/backends/wasm/as-typed-array.ts:35 allocAsTypedView` (j 0.727) — **KEEP.** One pins a header. The other pins a header plus a typed view.
- `packages/workerpool/src/index.ts:806 prod` ↔ `packages/workerpool/src/index.ts:1495 norm` (j 0.726) — **MERGE.** PR-H. The parallel envelope matches. The sequential loop stays a closure invoked once. Gate on a sub-threshold measurement.
- `functions/src/numeric/control-equations.ts:79 transpose` ↔ `functions/src/numeric/control-equations.ts:87 matadd` (j 0.724) — **KEEP.** T[j][i]=A[i][j] against C[i][j]=A[i][j]+s*B[i][j].
- `matrix/src/backends/JSBackend.ts:108 scale` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.723) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:880 tan` (j 0.720) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `assembly/src/special.ts:129 _besselJ0Series` ↔ `assembly/src/special.ts:143 _besselJ1Series` (j 0.718) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `matrix/src/operations/qr-family.ts:53 flipRows` ↔ `matrix/src/operations/qr-family.ts:67 flipCols` (j 0.716) — **MERGE.** PR-G. Same allocation and i,j nest. Pick the row-reverse or column-reverse nest once, outside the loops.
- `assembly/src/ops/matrix.ts:204 matrix_multiply` ↔ `assembly/src/ops/matrix.ts:583 matrix_gemm` (j 0.714) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `autograd/src/tape.ts:858 cos` ↔ `autograd/src/tape.ts:880 tan` (j 0.714) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/wasm/interpolation/wasm-bridge.ts:117 tridiagSolveDispatch` ↔ `functions/src/wasm/interpolation/wasm-bridge.ts:206 dividedDifferenceDispatch` (j 0.714) — **KEEP.** The WASM-or-JS shell matches. The export, ABI, and result type differ. withAsF64 already holds the marshalling.
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
- `packages/workerpool/src/index.ts:768 sum` ↔ `packages/workerpool/src/index.ts:1148 bitwiseNot` (j 0.692) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:806 prod` ↔ `packages/workerpool/src/index.ts:1148 bitwiseNot` (j 0.692) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:922 square` (j 0.690) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `core/src/collection.ts:136 _reduce` ↔ `functions/src/matrix/mapSlices.ts:100 _mapSlices` (j 0.688) — **KEEP.** _reduce folds to a scalar at a flat leaf. _mapSlices invokes the callback on the whole slice when dim<=0.
- `expression/src/node/AssignmentNode.ts:302 _toString` ↔ `expression/src/node/AssignmentNode.ts:383 _toTex` (j 0.687) — **MERGE.** PR-A. Same object/index/value render and needParenthesis; the parenthesis glyphs and the '=' joiner differ.
- `matrix/src/backends/ParallelBackend.ts:124 scale` ↔ `matrix/src/backends/ParallelBackend.ts:180 transpose` (j 0.687) — **KEEP.** The whenParallel shell matches. The pool method and the result shape differ.
- `core/src/numeric/stable.ts:46 pairwiseSum` ↔ `core/src/numeric/stable.ts:167 pairwiseDot` (j 0.686) — **KEEP.** Eight-lane leaf adds xs[i], or a[i]*b[i]. A multiply mode in that leaf is the known loss.
- `matrix/src/operations/sqrtm.ts:91 sqrtmSymmetric` ↔ `matrix/src/operations/sqrtm.ts:185 sqrtmGeneral` (j 0.686) — **KEEP.** Eigenvalue gate -1e-8 and Q*sqrt(D)*Qᵀ, against |im|>1e-7 or re<-1e-7 and Q*sqrt(D)*Q⁻¹.
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.685) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `packages/workerpool/src/index.ts:712 exec` ↔ `packages/workerpool/src/index.ts:740 execFunction` (j 0.684) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:892 elementwise` ↔ `packages/workerpool/src/index.ts:1709 applyKernel2` (j 0.682) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
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
- `packages/workerpool/src/index.ts:2289 runChunks` ↔ `packages/workerpool/src/index.ts:2345 reduce` (j 0.680) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `functions/src/numeric/solveODE.ts:465 rosenbrockSolve` ↔ `functions/src/numeric/solveODE.ts:613 rodasSolve` (j 0.678) — **KEEP.** Different tableaus. The shared _rk shell already exists.
- `functions/src/matrix/subset.ts:240 _getObjectProperty` ↔ `functions/src/matrix/subset.ts:265 _setObjectProperty` (j 0.677) — **KEEP.** Empty index returns undefined versus the object. Then getSafeProperty versus clone plus setSafeProperty.
- `functions/src/signal/fft-core-f64.ts:43 fftCoreFloat64` ↔ `packages/workerpool/src/fft-core.ts:35 fftFrameInPlace` (j 0.677) — **KEEP.** dist/worker.js cannot import core, parallel, or functions. The worker copy is the bundle, and the bodies have drifted where a parity test pins them.
- `packages/workerpool/src/index.ts:1148 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1582 unary` (j 0.674) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
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
- `packages/workerpool/src/index.ts:1582 unary` ↔ `packages/workerpool/src/index.ts:1659 applyKernel` (j 0.665) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
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
- `functions/src/typed/factorization/index.ts:45 cleanUnivariatePoly` ↔ `functions/src/typed/factorization/index.ts:89 renderIntPoly` (j 0.662) — **MERGE.** PR-D. Same descending-term printer. Rounding stays on the number path; bigint must not pass through Number.
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
- `packages/workerpool/src/index.ts:2210 sort` ↔ `packages/workerpool/src/index.ts:2345 reduce` (j 0.662) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `functions/src/typed/normal-equations-solve.ts:8 solveAugmentedNormalEquations` ↔ `functions/src/typed/numeric.ts:196 linsolve` (j 0.661) — **KEEP.** Mutate and return null at 1e-14, against copy and throw at 1e-15.
- `packages/workerpool/src/index.ts:844 dot` ↔ `packages/workerpool/src/index.ts:1495 norm` (j 0.661) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `functions/src/ml/ols.ts:73 invertUnscaled` ↔ `functions/src/typed/matrix-ops.ts:490 matrixInverse` (j 0.658) — **KEEP.** Cutoff 1e-12 and skip a zero factor, against 1e-15, always multiply the factor, NaN on a non-finite entry.
- `core/src/types/bignumber.ts:1432 _alternatingEvenTaylor` ↔ `core/src/types/bignumber.ts:1471 _atanTaylor` (j 0.657) — **KEEP.** atan divides a copy of the term by 2n+1 and does not write that divisor back. The alternating series folds the divisor and the negate into term.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:880 tan` (j 0.656) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/ml/ols.ts:73 invertUnscaled` ↔ `functions/src/typed/hypothesis.ts:2039 _matInverse` (j 0.656) — **KEEP.** Cutoff 1e-12 and skip a zero factor, against 1e-15, always multiply the factor, NaN on a non-finite entry.
- `functions/src/type/local/Decimal.ts:349 plus` ↔ `functions/src/type/local/Decimal.ts:388 minus` (j 0.656) — **KEEP.** Decimal sign rules differ.
- `assembly/src/special.ts:179 _besselY1Series` ↔ `functions/src/wasm/special/scalars.ts:217 besselY1Series` (j 0.655) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `packages/workerpool/src/index.ts:768 sum` ↔ `packages/workerpool/src/index.ts:960 scale` (j 0.655) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:806 prod` ↔ `packages/workerpool/src/index.ts:960 scale` (j 0.655) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `matrix/src/backends/JSBackend.ts:92 divideElementwise` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654) — **KEEP.** Same i,j store. The stored expression differs, and transpose also swaps the index and the shape. A per-element callback is the measured loss.
- `packages/workerpool/src/index.ts:844 dot` ↔ `packages/workerpool/src/index.ts:1709 applyKernel2` (j 0.654) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:892 elementwise` ↔ `packages/workerpool/src/index.ts:1582 unary` (j 0.654) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:1017 bitwiseBinary` ↔ `packages/workerpool/src/index.ts:1086 bitwiseScalar` (j 0.654) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:817 exp` (j 0.653) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/typed/signal.ts:578 dct` ↔ `functions/src/typed/signal.ts:622 dst` (j 0.652) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `functions/src/special/spheroidal.ts:159 spheroidalAngular` ↔ `functions/src/special/spheroidal.ts:234 spheroidalAngularContinued` (j 0.651) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `autograd/src/tape.ts:880 tan` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.649) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `autograd/src/tape.ts:880 tan` ↔ `autograd/src/tape.ts:1001 reciprocal` (j 0.649) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/stats/gaussian-process.ts:101 forwardSolve` ↔ `functions/src/stats/gaussian-process.ts:113 backSolveTranspose` (j 0.649) — **KEEP.** Opposite axis. tensor backSub divides by the diagonal; forwardSub does not.
- `assembly/src/ops/complex-array.ts:120 complex_array_mul` ↔ `assembly/src/ops/complex-array.ts:137 complex_array_div` (j 0.647) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `matrix/src/types/SparseMatrix.ts:576 multiplyElementwise` ↔ `matrix/src/types/SparseMatrix.ts:878 mapNonZeros` (j 0.645) — **KEEP.** A per-nonzero callback measured +12.4% (2000×2000) and +4.4% (500×500). Tried in #481 and reverted.
- `core/src/types/bignumber.ts:1100 sinh` ↔ `core/src/types/bignumber.ts:1126 tanh` (j 0.642) — **KEEP.** sinh returns (e^x-e^{-x})/2 and passes infinities through. tanh returns the ratio and maps infinities to the sign.
- `packages/workerpool/src/index.ts:768 sum` ↔ `packages/workerpool/src/index.ts:844 dot` (j 0.642) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:1022 abs` (j 0.640) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `functions/src/numeric/solveODE.ts:1613 _rk23` ↔ `functions/src/numeric/solveODE.ts:1634 _rk45` (j 0.639) — **KEEP.** Different tableaus. The shared _rk shell already exists.
- `assembly/src/signal.ts:50 _fftInterleaved` ↔ `functions/src/wasm/signal/wasm-bridge.ts:110 _fftInterleavedJS` (j 0.638) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:1022 abs` (j 0.637) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `matrix/src/backends/WASMBackend.ts:574 luDecomposition` ↔ `matrix/src/backends/WASMBackend.ts:779 inverse` (j 0.637) — **KEEP.** Shared call envelope around different kernels (LU, inverse, Cholesky).
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.636) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `matrix/src/types/SparseMatrix.ts:576 multiplyElementwise` ↔ `matrix/src/types/SparseMatrix.ts:601 multiply` (j 0.636) — **KEEP.** Elementwise product against matrix product. The CSR walk is not the same multiply.
- `assembly/src/ops/matrix.ts:297 vector_matrix_multiply` ↔ `assembly/src/ops/matrix.ts:441 matrix_sum_cols` (j 0.633) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/typed/integration.ts:389 gaussQuadSerial` ↔ `packages/workerpool/src/worker.ts:966 integrateChunk` (j 0.632) — **KEEP.** dist/worker.js cannot import core, parallel, or functions. The worker copy is the bundle, and the bodies have drifted where a parity test pins them.
- `functions/src/special/spheroidal.ts:35 ferrersP` ↔ `functions/src/special/spheroidal.ts:212 ferrersPContinued` (j 0.631) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:922 square` (j 0.630) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `core/src/types/fraction.ts:573 floor` ↔ `core/src/types/fraction.ts:587 ceil` (j 0.630) — **MERGE.** PR-F. Same toward-zero bigint quotient. Floor subtracts 1n on a negative non-integer; ceil adds 1n on a positive one.
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
- `packages/workerpool/src/index.ts:768 sum` ↔ `packages/workerpool/src/index.ts:1659 applyKernel` (j 0.627) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:806 prod` ↔ `packages/workerpool/src/index.ts:1659 applyKernel` (j 0.627) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:892 elementwise` ↔ `packages/workerpool/src/index.ts:1017 bitwiseBinary` (j 0.627) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:960 scale` ↔ `packages/workerpool/src/index.ts:1709 applyKernel2` (j 0.626) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `assembly/src/ops/matrix.ts:276 matrix_vector_multiply` ↔ `assembly/src/ops/matrix.ts:422 matrix_sum_rows` (j 0.625) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `packages/workerpool/src/index.ts:1198 matmul` ↔ `packages/workerpool/src/index.ts:2085 outer` (j 0.625) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
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
- `expression/src/node/AssignmentNode.ts:349 _toHTML` ↔ `expression/src/node/AssignmentNode.ts:383 _toTex` (j 0.620) — **MERGE.** PR-A. Same object/index/value render and needParenthesis; the parenthesis glyphs and the '=' joiner differ.
- `packages/workerpool/src/index.ts:1148 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1495 norm` (j 0.619) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `functions/src/type/matrix/utils/matAlgo13xDD.ts:120 _iterate` ↔ `functions/src/type/matrix/utils/matAlgo14xDs.ts:101 _iterate` (j 0.618) — **KEEP.** matAlgo13 is dense-dense f(a[i], b[i]). matAlgo14 is a scalar with the operand order reversed.
- `packages/workerpool/src/index.ts:1495 norm` ↔ `packages/workerpool/src/index.ts:1533 distance` (j 0.618) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `autograd/src/tape.ts:1428 svd` ↔ `autograd/src/tape.ts:1583 _eigSymmetric` (j 0.617) — **KEEP.** Shared tape.record shell. The forward value and the adjoint formula differ (or the factorization: symmetrizer versus gauge, imag rejection, SVD versus symmetric eig).
- `packages/workerpool/src/index.ts:1148 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1709 applyKernel2` (j 0.617) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `packages/workerpool/src/index.ts:2210 sort` ↔ `packages/workerpool/src/index.ts:2289 runChunks` (j 0.616) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `functions/src/signal/wavelets.ts:86 rickerWavelet` ↔ `functions/src/signal/wavelets.ts:99 morletWavelet` (j 0.615) — **KEEP.** The term divisor, seed, band, recurrence, or trig kernel differs inside the loop.
- `parallel/src/ParallelMatrix.ts:288 elementwise` ↔ `parallel/src/ParallelMatrix.ts:356 scale` (j 0.615) — **KEEP.** The parallel shell matches. The reduction (dot versus sum, elementwise versus scale) does not.
- `core/src/array.ts:985 recursiveMapWithIndex` ↔ `core/src/array.ts:1003 recursiveMap` (j 0.614) — **KEEP.** The index walk passes index.slice(0, depth). recursiveMap calls the unary callback.
- `packages/workerpool/src/index.ts:1017 bitwiseBinary` ↔ `packages/workerpool/src/index.ts:1709 applyKernel2` (j 0.612) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
- `functions/src/typed/arithmetic.ts:1343 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1366 Float64Array` (j 0.610) — **KEEP.** Monomorphic min and max loops. A shared callback is the PR #454 regression (56%–643% slower below threshold). Both are reductions; the comparison and the seed differ (±Infinity).
- `matrix/src/backends/WASMBackend.ts:574 luDecomposition` ↔ `matrix/src/backends/WASMBackend.ts:894 choleskyDecomposition` (j 0.609) — **KEEP.** Shared call envelope around different kernels (LU, inverse, Cholesky).
- `packages/workerpool/src/index.ts:1873 distanceMatrix` ↔ `packages/workerpool/src/index.ts:2011 matvec` (j 0.609) — **KEEP.** The parallel envelope matches. Arity, dtype, chunk task, or result shape differs, so this is outside the sum/prod/norm shell.
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
- `expression/src/node/ObjectNode.ts:162 _toString` ↔ `expression/src/node/ObjectNode.ts:198 _toHTML` (j 0.606) — **MERGE.** PR-A. Same hasOwnProperty walk; the entry text and the braces differ.
- `functions/src/matrix/eigs/realSymmetric.ts:102 diag` ↔ `functions/src/matrix/eigs/realSymmetric.ts:134 diagBig` (j 0.604) — **KEEP.** Same diagonal update. `diag` uses number arithmetic and `diagBig` uses BigNumber.
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/parallel-map.ts:56 mapBinaryF64` (j 0.603) — **KEEP.** Unary applyKernel against binary applyKernel2. The arity split is the kernel.
- `functions/src/numeric/krylov.ts:287 cg` ↔ `functions/src/numeric/krylov.ts:530 bicgstab` (j 0.602) — **KEEP.** Different recurrences.
- `tensor/src/operations/solve.ts:81 forwardSub` ↔ `tensor/src/operations/solve.ts:102 backSub` (j 0.602) — **KEEP.** Opposite axis. tensor backSub divides by the diagonal; forwardSub does not.
- `assembly/src/ops/special.ts:11 chebyshevT` ↔ `assembly/src/ops/special.ts:60 legendreP` (j 0.600) — **KEEP.** The operator, the recurrence, or a second payload (index array, scalar versus array, mutating Array versus copied Float64Array) is the body of the loop. @inline on f64Add/Sub/Mul/Div and f64Min/Max keeps that loop in the caller.
- `functions/src/matrix/eigs/realSymmetric.ts:208 Sij1Big` ↔ `functions/src/matrix/eigs/realSymmetric.ts:226 x1Big` (j 0.596) — **KEEP.** Number against BigNumber Jacobi, and a column rotation against the full diagonal update.
- `functions/src/matrix/eigs/realSymmetric.ts:190 Sij1` ↔ `functions/src/matrix/eigs/realSymmetric.ts:269 x1` (j 0.577) — **KEEP.** Number against BigNumber Jacobi, and a column rotation against the full diagonal update.
- `functions/src/probability/bernoulli.ts:83 bigint | Fraction` ↔ `functions/src/probability/bernoulli.ts:92 BigNumber` (j 0.556) — **KEEP.** The precision-reset cache exists only on the BigNumber Bernoulli path.
- `matrix/src/operations/qr-family.ts:67 flipCols` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.515) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `assembly/src/ops/polynomial.ts:87 determinant` ↔ `functions/src/wasm/poly/wasm-bridge.ts:174 resultantJS` (j 0.486) — **KEEP.** JS is the fallback. AssemblyScript cannot import a TypeScript package. Folding them deletes the path that runs when the module is absent.
- `functions/src/typed/aggregate-restart.ts:12 aggregateRestartVectors` ↔ `functions/src/typed/graph.ts:936 _aggregateEigenvector` (j 0.474) — **KEEP.** Eigenvector aggregation sign-aligns and renormalizes. The shared restart average does not.
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
- `expression/src/compiler/compile.ts:298 compileFunctionNode` ↔ `expression/src/compiler/compile.ts:444 compileArrayNode` (j 0.103) — **KEEP.** The sandbox accessor path stays in the function-node compiler.
- `tensor/src/operations/cholesky.ts:45 transposeSquare` ↔ `tensor/src/operations/solve.ts:127 tensorSolve` (j 0.074) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `matrix/src/operations/eig.ts:158 eigGeneral` ↔ `parallel/src/gemm-rows.ts:19 gemmRows` (j 0.036) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `matrix/src/operations/eig.ts:158 eigGeneral` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.025) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
- `functions/src/geometry/intersect.ts:272 _intersect3dHelper` ↔ `functions/src/matrix/eigs/complexEigs.ts:66 createComplexEigs` (j 0.022) — **KEEP.** Containment false match. The smaller loop appears inside an unrelated algorithm.
