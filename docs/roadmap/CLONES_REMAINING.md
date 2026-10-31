# Clone ledger — Phase 7 measurement

Measured on `main` at `9dc97c56` (`refactor(functions): P6-11 GPU chain lifecycle consolidation (#542)`), with
`@danielsimonjr/repo-tools` **2.3.0** (`repo-tools clones`) and the tool defaults. This file is a
measurement only, and it classifies no pair. Phase 7 is a runtime-speed phase
([`docs/plans/PHASE_7_PERFORMANCE_PLAN.md`](../plans/PHASE_7_PERFORMANCE_PLAN.md)); a clone pair is worked
there only when merging it makes code faster. The measurement procedure is the
"Phase 6 and up: clone-reduction loop" section of
[`PYSR_INFORMED_ROADMAP.md`](./PYSR_INFORMED_ROADMAP.md). The Phase 6 ledger (`40466a97`, 553 pairs) and its
verdicts are in git history at `d68f3a78` and in [`CLONES_PHASE_6_PLAN.md`](../plans/CLONES_PHASE_6_PLAN.md).

**Tool version.** `repo-tools` 2.2.4, the `REPO_TOOLS_VERSION` pin in `.github/workflows/ci.yml`, has no
`clones` subcommand (`repo-tools: unknown subcommand or option 'clones'`); its subcommands are `map`,
`depgraph`, `check`, `docs`, `chunk`, `compress`, `query`, and `ste`. That pin is for
`repo-tools check . --docs=docs/Architecture` and is unchanged. No `package.json` script or CI job runs
`clones`; the roadmap command below is the canonical invocation. Two runs on the same tree wrote
byte-identical `inventory.jsonl` and `clones.json`. Neither report is committed.

**Discovery.** The tool reads git-tracked files only (`git ls-files --cached`), so a new file is invisible
to it until it is staged. Stage new files before you measure a branch.

## Command

From the repo root, with the tool installed outside the repo (`npm install @danielsimonjr/repo-tools@2.3.0`
in a scratch directory):

```bash
repo-tools clones . --src \
  packages/typed-function/src packages/workerpool/src \
  core/src matrix/src tensor/src autograd/src functions/src expression/src \
  parser/src units/src numbers/src ast/src evaluator/src linalg/src \
  arithmetic/src trigonometry/src statistics/src signal/src \
  parallel/src workbook/src assembly/src compat/src gpu/src plot/src \
  --out=../tmp/clones-phase-7
```

Output:

```
files=1232 parseErrors=0 units(minNodes=50)=2644
nodes p50=109 p90=327 p99=826 max=3602
exact groups=9 (units in them=37) text-identical groups=4
near pairs=533 by jStruct: 0.9 or more: 105, 0.8 to 0.9: 155, 0.7 to 0.8: 87, 0.6 to 0.7: 162, below 0.6 (containment): 24
units by folder: assembly/src=150 autograd/src=51 compat/src=9 core/src=228 expression/src=157 functions/src=1559 gpu/src=14 matrix/src=186 packages/typed-function=2 packages/workerpool=62 parallel/src=50 plot/src=36 tensor/src=58 workbook/src=82
```

| Flag                | Value |
| ------------------- | ----- |
| `--min-nodes`       | 50    |
| `--shingle`         | 6     |
| `--near`            | 0.6   |
| `--containment`     | 0.9   |
| `--containment-min` | 20    |
| `--rare`            | 60    |
| `--min-shared`      | 3     |

`105 + 155 + 87 + 162 + 24 = 533`.

## Counts

Every column is the same command with the same flags, run on a `git archive` export of that commit.

| Measure                                                 | `156e4ea8` | `bf90a00e` | `655ffb3a` | `40466a97` | `9dc97c56` |
| ------------------------------------------------------- | ---------: | ---------: | ---------: | ---------: | ---------: |
| Files scanned                                           |       1219 |       1221 |       1222 |       1230 |       1232 |
| Parse errors                                            |          5 |          0 |          0 |          0 |          0 |
| Units (at least 50 nodes)                               |       2604 |       2594 |       2594 |       2653 |       2644 |
| Exact groups                                            |         12 |         11 |          9 |         10 |          9 |
| Units inside exact groups                               |         43 |         41 |         37 |         39 |         37 |
| Text-identical groups                                   |          4 |          4 |          4 |          4 |          4 |
| Near pairs                                              |        573 |        549 |        551 |        553 |        533 |
| Near pairs, jStruct 0.9 or more                         |        112 |        110 |        108 |        109 |        105 |
| Near pairs, jStruct 0.8 to 0.9                          |        164 |        158 |        159 |        159 |        155 |
| Near pairs, jStruct 0.7 to 0.8                          |         91 |         89 |         90 |         90 |         87 |
| Near pairs, jStruct 0.6 to 0.7                          |        181 |        168 |        170 |        171 |        162 |
| Near pairs, jStruct below 0.6 (reported by containment) |         25 |         24 |         24 |         24 |         24 |

- `156e4ea8`: Tree reviewed by `CLONES_REFACTOR_PLAN.md`.
- `bf90a00e`: After clone PRs A–I (#497–#505) and #496.
- `655ffb3a`: After the core sprint (#507–#517).
- `40466a97`: Tree reviewed by `CLONES_PHASE_6_PLAN.md`, after PySR PRs 1–12 (#519–#530).
- `9dc97c56`: This ledger: after the Phase 6 build PRs P6-1 to P6-11 (#532–#542).

## Exact groups (9)

Same normalized structure (`exactHash`). Each group is also reported as near pairs at `jStruct` 1.
A member marked "text-identical" shares its `textHash` with another member of the group.

1. 11 units, 62 nodes each:
   - `functions/src/typed/arithmetic.ts:536 Float64Array`, the `sign` overload
   - `functions/src/typed/arithmetic.ts:704 Float64Array`, the `cbrt` overload
   - `functions/src/typed/arithmetic.ts:870 Float64Array`, the `round` overload
   - `functions/src/typed/arithmetic.ts:891 Float64Array`, the `floor` overload
   - `functions/src/typed/arithmetic.ts:912 Float64Array`, the `ceil` overload
   - `functions/src/typed/arithmetic.ts:935 Float64Array`, the `fix` overload
   - `functions/src/typed/arithmetic.ts:1211 Float64Array`, the `cosh` overload
   - `functions/src/typed/trigonometry.ts:170 Float64Array`, the `asin` overload
   - `functions/src/typed/trigonometry.ts:195 Float64Array`, the `acos` overload
   - `functions/src/typed/trigonometry.ts:279 Float64Array`, the `asinh` overload
   - `functions/src/typed/trigonometry.ts:299 Float64Array`, the `acosh` overload
2. 8 units, 74 nodes each:
   - `functions/src/typed/arithmetic.ts:774 Float64Array`, the `log10` overload
   - `functions/src/typed/arithmetic.ts:796 Float64Array`, the `log2` overload
   - `functions/src/typed/arithmetic.ts:816 Float64Array`, the `log1p` overload
   - `functions/src/typed/arithmetic.ts:836 Float64Array`, the `expm1` overload
   - `functions/src/typed/arithmetic.ts:1189 Float64Array`, the `sinh` overload
   - `functions/src/typed/arithmetic.ts:1231 Float64Array`, the `tanh` overload
   - `functions/src/typed/trigonometry.ts:215 Float64Array`, the `atan` overload
   - `functions/src/typed/trigonometry.ts:319 Float64Array`, the `atanh` overload
3. 3 units, 176 nodes each:
   - `autograd/src/tape.ts:2302 _batchedMatmul`
   - `autograd/src/tape.ts:2345 _batchedMatmulGradA`
   - `autograd/src/tape.ts:2388 _batchedMatmulGradB`
4. 3 units, 70 nodes each:
   - `core/src/customs.ts:113 isSafeMethod` (text-identical)
   - `expression/src/utils/customs.ts:104 isSafeMethod`
   - `functions/src/utils/customs.ts:102 isSafeMethod` (text-identical)
5. 3 units, 69 nodes each:
   - `core/src/factory.ts:83 factory`
   - `expression/src/utils/factory.ts:94 factory` (text-identical)
   - `functions/src/utils/factory.ts:104 factory` (text-identical)
6. 3 units, 76 nodes each:
   - `functions/src/typed/trigonometry.ts:94 Float64Array`, the `csc` overload
   - `functions/src/typed/trigonometry.ts:116 Float64Array`, the `sec` overload
   - `functions/src/typed/trigonometry.ts:138 Float64Array`, the `cot` overload
7. 2 units, 148 nodes each:
   - `assembly/src/special.ts:617 _carlsonRC`
   - `functions/src/wasm/special/wasm-bridge.ts:278 _carlsonRC`
8. 2 units, 71 nodes each:
   - `core/src/numeric/rng.ts:27 mulberry32` (text-identical)
   - `packages/workerpool/src/worker-numerics.ts:42 _workerMulberry32` (text-identical)
9. 2 units, 77 nodes each:
   - `expression/src/utils/is.ts:291 isBigNumber` (text-identical)
   - `functions/src/utils/is.ts:226 isBigNumber` (text-identical)

## Text-identical groups (4)

- `core/src/customs.ts:113 isSafeMethod` = `functions/src/utils/customs.ts:102 isSafeMethod`
- `core/src/numeric/rng.ts:27 mulberry32` = `packages/workerpool/src/worker-numerics.ts:42 _workerMulberry32`
- `expression/src/utils/factory.ts:94 factory` = `functions/src/utils/factory.ts:104 factory`
- `expression/src/utils/is.ts:291 isBigNumber` = `functions/src/utils/is.ts:226 isBigNumber`

## Changes since `40466a97`

`40466a97` is the tree whose pairs `CLONES_PHASE_6_PLAN.md` marked. Units are matched by file, container,
name, kind, and ordinal, so a moved line number is not a change.

- Near pairs: 553 then, 533 now. 20 left the report, 0 appeared,
  and 533 are carried. No carried pairs have a unit whose text changed.
- Exact groups: 10 then, 9 now. 1 left, none appeared.

Exact groups that left:

- `functions/src/scalar-mutate.ts` `rotateLeft`, `functions/src/scalar-mutate.ts` `rotateRight`

### Near pairs that left the report (20)

Line numbers are from `40466a97`. Each pair is a Phase 6 MERGE pair, and each left in its own PR.

- `functions/src/scalar-mutate.ts:366 rotateLeft` ↔ `functions/src/scalar-mutate.ts:381 rotateRight` (j 1.000) — first unit removed, second unit removed
- `packages/workerpool/src/worker.ts:770 tensordotChunk` ↔ `parallel/src/ComputePool.ts:413 tensordotChunkKernel` (j 0.971) — first unit removed, second unit removed
- `functions/src/wasm/WasmLoader.ts:368 loadNodeWasm` ↔ `matrix/src/backends/WasmLoader.ts:658 loadNodeWasm` (j 0.952) — first unit removed, second unit removed
- `functions/src/wasm/WasmLoader.ts:400 loadBrowserWasm` ↔ `matrix/src/backends/WasmLoader.ts:691 loadBrowserWasm` (j 0.919) — first unit removed, second unit removed
- `functions/src/gpu/elementwise-gpu.ts:307 chainGpuDispatchImpl` ↔ `functions/src/gpu/elementwise-gpu.ts:499 chainReduceGpuDispatchImpl` (j 0.888) — first unit removed, second unit removed
- `functions/src/wasm/WasmLoader.ts:306 precompile` ↔ `matrix/src/backends/WasmLoader.ts:592 precompile` (j 0.877) — first unit removed, second unit removed
- `functions/src/arithmetic/xgcd.ts:99 _xgcdBigNumber` ↔ `functions/src/arithmetic/xgcd.ts:153 _xgcdFraction` (j 0.846) — first unit removed
- `core/src/types/complex.ts:483 tan` ↔ `core/src/types/complex.ts:549 tanh` (j 0.803) — first unit removed, second unit removed
- `functions/src/fit-scalar.ts:550 gradL1` ↔ `functions/src/fit-scalar.ts:570 gradHuber` (j 0.770) — first unit removed, second unit removed
- `functions/src/wasm/bridges/common.ts:180 asAllocHeader` ↔ `matrix/src/backends/wasm/as-typed-array.ts:35 allocAsTypedView` (j 0.727) — first unit removed, second unit removed
- `core/src/types/complex.ts:498 cot` ↔ `core/src/types/complex.ts:562 coth` (j 0.706) — first unit removed, second unit removed
- `packages/workerpool/src/index.ts:712 exec` ↔ `packages/workerpool/src/index.ts:740 execFunction` (j 0.684) — first unit removed, second unit removed
- `core/src/types/complex.ts:483 tan` ↔ `core/src/types/complex.ts:498 cot` (j 0.683) — first unit removed, second unit removed
- `packages/workerpool/src/index.ts:2263 runChunks` ↔ `packages/workerpool/src/index.ts:2319 reduce` (j 0.680) — first unit removed
- `functions/src/numeric/solveODE.ts:465 rosenbrockSolve` ↔ `functions/src/numeric/solveODE.ts:613 rodasSolve` (j 0.678)
- `packages/workerpool/src/index.ts:765 reduceScalar` ↔ `packages/workerpool/src/index.ts:2263 runChunks` (j 0.664) — second unit removed
- `packages/workerpool/src/index.ts:2184 sort` ↔ `packages/workerpool/src/index.ts:2319 reduce` (j 0.662)
- `functions/src/scalar-mutate.ts:261 swapOperands` ↔ `functions/src/scalar-mutate.ts:348 deleteNode` (j 0.649) — first unit removed, second unit removed
- `core/src/types/complex.ts:549 tanh` ↔ `core/src/types/complex.ts:562 coth` (j 0.636) — first unit removed, second unit removed
- `packages/workerpool/src/index.ts:2184 sort` ↔ `packages/workerpool/src/index.ts:2263 runChunks` (j 0.616) — second unit removed

### Near pairs that appeared (0)

None.

### Carried pairs whose text changed (0)

None. Every carried pair has the same two bodies as at `40466a97`; only line numbers moved.

## Near pairs (533)

Every pair the run reported, in bands by `jStruct`, highest first. `contain` is the containment score and
`names` is `jNames`. Line numbers are the function start lines at `9dc97c56`.

### jStruct 0.9 or more (105)

- `assembly/src/special.ts:617 _carlsonRC` ↔ `functions/src/wasm/special/wasm-bridge.ts:278 _carlsonRC` (j 1.000, contain 1.000, names 1.000)
- `autograd/src/tape.ts:2302 _batchedMatmul` ↔ `autograd/src/tape.ts:2345 _batchedMatmulGradA` (j 1.000, contain 1.000, names 0.630)
- `autograd/src/tape.ts:2302 _batchedMatmul` ↔ `autograd/src/tape.ts:2388 _batchedMatmulGradB` (j 1.000, contain 1.000, names 0.630)
- `autograd/src/tape.ts:2345 _batchedMatmulGradA` ↔ `autograd/src/tape.ts:2388 _batchedMatmulGradB` (j 1.000, contain 1.000, names 0.630)
- `core/src/customs.ts:113 isSafeMethod` ↔ `expression/src/utils/customs.ts:104 isSafeMethod` (j 1.000, contain 1.000, names 1.000)
- `core/src/customs.ts:113 isSafeMethod` ↔ `functions/src/utils/customs.ts:102 isSafeMethod` (j 1.000, contain 1.000, names 1.000)
- `core/src/factory.ts:83 factory` ↔ `expression/src/utils/factory.ts:94 factory` (j 1.000, contain 1.000, names 1.000)
- `core/src/factory.ts:83 factory` ↔ `functions/src/utils/factory.ts:104 factory` (j 1.000, contain 1.000, names 1.000)
- `core/src/numeric/rng.ts:27 mulberry32` ↔ `packages/workerpool/src/worker-numerics.ts:42 _workerMulberry32` (j 1.000, contain 1.000, names 1.000)
- `expression/src/utils/customs.ts:104 isSafeMethod` ↔ `functions/src/utils/customs.ts:102 isSafeMethod` (j 1.000, contain 1.000, names 1.000)
- `expression/src/utils/factory.ts:94 factory` ↔ `functions/src/utils/factory.ts:104 factory` (j 1.000, contain 1.000, names 1.000)
- `expression/src/utils/is.ts:291 isBigNumber` ↔ `functions/src/utils/is.ts:226 isBigNumber` (j 1.000, contain 1.000, names 1.000)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:704 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:796 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:816 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:816 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/trigonometry.ts:195 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/trigonometry.ts:195 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `functions/src/typed/trigonometry.ts:215 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 1.000, contain 1.000, names 0.867)
- `functions/src/typed/trigonometry.ts:279 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 1.000, contain 1.000, names 0.846)
- `matrix/src/backends/wasm/detect.ts:60 detectSIMD` ↔ `matrix/src/backends/wasm/detect.ts:115 detectBulkMemory` (j 1.000, contain 1.000, names 0.500)
- `matrix/src/backends/JSBackend.ts:123 abs` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.917, contain 1.000, names 0.818)
- `assembly/src/special.ts:709 _carlsonRJ` ↔ `functions/src/wasm/special/wasm-bridge.ts:379 _carlsonRJ` (j 0.915, contain 0.959, names 0.971)
- `assembly/src/special.ts:783 _ellipticPiIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:459 _ellipticPiIncomplete` (j 0.909, contain 0.952, names 1.000)
- `assembly/src/sort.ts:116 _heapsort` ↔ `assembly/src/sort.ts:217 _heapsortIdx` (j 0.905, contain 0.957, names 0.545)
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:858 cos` (j 0.900, contain 0.952, names 0.889)
- `matrix/src/backends/GPUMatrixBackend.ts:183 addAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:282 multiplyAsync` (j 0.900, contain 0.953, names 0.875)

### jStruct 0.8 to 0.9 (155)

- `assembly/src/special.ts:772 _ellipticEIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:448 _ellipticEIncomplete` (j 0.898, contain 0.946, names 1.000)
- `functions/src/probability/util/gammaSample.ts:24 gammaSampleRng` ↔ `packages/workerpool/src/worker.ts:798 _workerGammaRandom` (j 0.891, contain 0.946, names 0.733)
- `packages/workerpool/src/worker.ts:250 applyKernelChunk` ↔ `packages/workerpool/src/worker.ts:271 applyKernel2Chunk` (j 0.889, contain 1.000, names 0.643)
- `functions/src/numeric/krylov.ts:223 makeILU0` ↔ `functions/src/numeric/krylov.ts:244 makeIC0` (j 0.887, contain 0.949, names 0.800)
- `core/src/numeric/stable.ts:132 norm2` ↔ `core/src/numeric/stable.ts:222 scaledDistance` (j 0.881, contain 0.957, names 0.611)
- `assembly/src/special.ts:667 _carlsonRD` ↔ `functions/src/wasm/special/wasm-bridge.ts:329 _carlsonRD` (j 0.877, contain 0.934, names 1.000)
- `matrix/src/backends/GPUMatrixBackend.ts:183 addAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:242 scaleAsync` (j 0.875, contain 0.963, names 0.792)
- `autograd/src/tape.ts:475 sum` ↔ `autograd/src/tape.ts:500 mean` (j 0.874, contain 1.000, names 0.818)
- `matrix/src/backends/WASMBackend.ts:779 inverse` ↔ `matrix/src/backends/WASMBackend.ts:894 choleskyDecomposition` (j 0.873, contain 0.976, names 0.667)
- `assembly/src/special.ts:762 _ellipticFIncomplete` ↔ `functions/src/wasm/special/wasm-bridge.ts:438 _ellipticFIncomplete` (j 0.872, contain 0.932, names 1.000)
- `functions/src/numeric/solveDAE.ts:184 _denseSolve` ↔ `functions/src/numeric/solveODE.ts:137 _inlineLuSolve` (j 0.872, contain 0.983, names 0.857)
- `functions/src/algebra/solver/lsolveAll.ts:149 _denseForwardSubstitution` ↔ `functions/src/algebra/solver/usolveAll.ts:149 _denseBackwardSubstitution` (j 0.869, contain 0.942, names 1.000)
- `functions/src/algebra/solver/lsolveAll.ts:218 _sparseForwardSubstitution` ↔ `functions/src/algebra/solver/usolveAll.ts:218 _sparseBackwardSubstitution` (j 0.867, contain 0.958, names 1.000)
- `packages/workerpool/src/index.ts:927 scale` ↔ `packages/workerpool/src/index.ts:1115 bitwiseNot` (j 0.862, contain 0.932, names 0.735)
- `core/src/is.ts:155 isBigNumber` ↔ `expression/src/utils/is.ts:291 isBigNumber` (j 0.861, contain 0.939, names 1.000)
- `core/src/is.ts:155 isBigNumber` ↔ `functions/src/utils/is.ts:226 isBigNumber` (j 0.861, contain 0.939, names 1.000)
- `assembly/src/ops/complex-array.ts:120 complex_array_mul` ↔ `assembly/src/ops/complex-array.ts:165 complex_array_scale_complex` (j 0.855, contain 0.973, names 0.667)
- `assembly/src/sort.ts:98 _siftDown` ↔ `assembly/src/sort.ts:200 _siftDownIdx` (j 0.852, contain 0.920, names 0.545)
- `assembly/src/special.ts:544 _ellipticK` ↔ `functions/src/wasm/special/scalars.ts:333 ellipticKScalar` (j 0.849, contain 0.918, names 1.000)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.842, contain 0.928, names 0.867)
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:60 subtract` (j 0.840, contain 0.913, names 1.000)
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` (j 0.840, contain 0.913, names 1.000)
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:92 divideElementwise` (j 0.840, contain 0.913, names 1.000)
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` (j 0.840, contain 0.913, names 1.000)
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:92 divideElementwise` (j 0.840, contain 0.913, names 1.000)
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:92 divideElementwise` (j 0.840, contain 0.913, names 1.000)
- `assembly/src/special.ts:640 _carlsonRF` ↔ `functions/src/wasm/special/wasm-bridge.ts:301 _carlsonRF` (j 0.839, contain 0.916, names 1.000)
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:836 sin` (j 0.832, contain 0.913, names 0.737)
- `packages/workerpool/src/index.ts:927 scale` ↔ `packages/workerpool/src/index.ts:1605 applyKernel` (j 0.832, contain 0.933, names 0.879)
- `assembly/src/ops/special.ts:79 erfi` ↔ `functions/src/typed/special.ts:111 erfiScalar` (j 0.829, contain 0.932, names 0.900)
- `assembly/src/special.ts:101 _besselHankel` ↔ `functions/src/wasm/special/scalars.ts:132 besselHankel` (j 0.829, contain 0.906, names 1.000)
- `core/src/numeric/stable.ts:103 neumaierSum` ↔ `core/src/numeric/stable.ts:373 neumaierCumsum` (j 0.829, contain 0.935, names 0.900)
- `autograd/src/tape.ts:133 add` ↔ `autograd/src/tape.ts:148 sub` (j 0.828, contain 0.914, names 1.000)
- `autograd/src/dual-tensor.ts:77 add` ↔ `autograd/src/dual-tensor.ts:89 sub` (j 0.826, contain 0.905, names 1.000)
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.825, contain 0.913, names 0.778)
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.823, contain 0.921, names 0.778)
- `assembly/src/ops/polynomial.ts:140 resultantValue` ↔ `assembly/src/poly.ts:98 sylvesterDet` (j 0.821, contain 0.948, names 0.650)
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:817 exp` (j 0.821, contain 0.911, names 0.778)
- `assembly/src/sort.ts:85 _insertionSort` ↔ `assembly/src/sort.ts:188 _insertionSortIdx` (j 0.820, contain 0.909, names 0.500)
- `assembly/src/ops/polynomial.ts:87 determinant` ↔ `assembly/src/poly.ts:60 detSquare` (j 0.818, contain 0.992, names 0.706)
- `assembly/src/ops/matrix.ts:276 matrix_vector_multiply` ↔ `assembly/src/ops/matrix.ts:614 matrix_gemv` (j 0.814, contain 0.980, names 0.375)
- `packages/workerpool/src/worker.ts:311 bitwiseChunk` ↔ `packages/workerpool/src/worker.ts:353 bitwiseScalarChunk` (j 0.812, contain 0.920, names 0.538)
- `packages/workerpool/src/index.ts:1115 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1605 applyKernel` (j 0.810, contain 0.925, names 0.694)
- `assembly/src/ops/array.ts:89 array_argmin` ↔ `assembly/src/ops/array.ts:109 array_argmax` (j 0.800, contain 0.889, names 0.600)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:774 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:796 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:816 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:774 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:796 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:816 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:836 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:774 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:796 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:816 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:836 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1189 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1189 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1231 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/arithmetic.ts:1231 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/trigonometry.ts:170 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/trigonometry.ts:195 Float64Array` ↔ `functions/src/typed/trigonometry.ts:215 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/trigonometry.ts:195 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/trigonometry.ts:215 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/trigonometry.ts:215 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/trigonometry.ts:279 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)
- `functions/src/typed/trigonometry.ts:299 Float64Array` ↔ `functions/src/typed/trigonometry.ts:319 Float64Array` (j 0.800, contain 0.982, names 0.733)

### jStruct 0.7 to 0.8 (87)

- `assembly/src/ops/special.ts:117 sinIntegral` ↔ `functions/src/typed/special.ts:437 sinIntegralScalar` (j 0.798, contain 0.908, names 0.889)
- `assembly/src/special.ts:143 _besselJ1Series` ↔ `functions/src/wasm/special/scalars.ts:181 besselJ1Series` (j 0.797, contain 0.917, names 0.875)
- `matrix/src/operations/condest.ts:18 luSolve` ↔ `matrix/src/operations/condest.ts:47 luSolveTranspose` (j 0.794, contain 0.885, names 0.714)
- `matrix/src/backends/GPUMatrixBackend.ts:242 scaleAsync` ↔ `matrix/src/backends/GPUMatrixBackend.ts:282 multiplyAsync` (j 0.785, contain 0.912, names 0.760)
- `matrix/src/operations/givens.ts:28 applyGivensCols` ↔ `matrix/src/operations/schur.ts:60 applyGivensLeft` (j 0.783, contain 0.973, names 0.583)
- `assembly/src/ops/complex-array.ts:211 complex_array_abs` ↔ `assembly/src/ops/complex-array.ts:235 complex_array_abs_squared` (j 0.780, contain 0.902, names 0.889)
- `assembly/src/special.ts:129 _besselJ0Series` ↔ `functions/src/wasm/special/scalars.ts:164 besselJ0Series` (j 0.778, contain 0.907, names 0.875)
- `functions/src/algebra/solver/lsolve.ts:134 _denseForwardSubstitution` ↔ `functions/src/algebra/solver/usolve.ts:134 _denseBackwardSubstitution` (j 0.774, contain 0.882, names 1.000)
- `assembly/src/ops/f64-buffer.ts:7 f64Min` ↔ `assembly/src/ops/f64-buffer.ts:21 f64Max` (j 0.769, contain 0.870, names 0.800)
- `packages/workerpool/src/index.ts:1165 matmul` ↔ `packages/workerpool/src/index.ts:1957 matvec` (j 0.766, contain 0.895, names 0.755)
- `packages/workerpool/src/index.ts:811 dot` ↔ `packages/workerpool/src/index.ts:1479 distance` (j 0.764, contain 0.887, names 0.865)
- `assembly/src/ops/curvefit.ts:31 logfit` ↔ `assembly/src/ops/curvefit.ts:55 powerfit` (j 0.762, contain 0.869, names 0.800)
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/f64-buffer.ts:35 f64Add` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/f64-buffer.ts:35 f64Add` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/f64-buffer.ts:35 f64Add` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/f64-buffer.ts:44 f64Sub` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/f64-buffer.ts:44 f64Sub` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/f64-buffer.ts:53 f64Mul` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.760, contain 0.864, names 1.000)
- `assembly/src/ops/complex-array.ts:223 complex_array_arg` ↔ `assembly/src/ops/complex-array.ts:235 complex_array_abs_squared` (j 0.759, contain 0.863, names 0.800)
- `assembly/src/special.ts:564 _ellipticE` ↔ `functions/src/wasm/special/scalars.ts:355 ellipticECompleteScalar` (j 0.759, contain 0.885, names 0.941)
- `assembly/src/ops/special.ts:93 expIntegralEi` ↔ `functions/src/typed/special.ts:455 expIntegralEiScalar` (j 0.758, contain 0.883, names 0.909)
- `autograd/src/tape.ts:1970 _eigSymBackward` ↔ `autograd/src/tape.ts:2049 _eigGeneralBackward` (j 0.757, contain 0.927, names 0.571)
- `assembly/src/sort.ts:130 _introsort` ↔ `assembly/src/sort.ts:235 _introsortIdx` (j 0.756, contain 0.861, names 0.393)
- `tensor/src/Tensor.ts:161 add` ↔ `tensor/src/Tensor.ts:172 sub` (j 0.755, contain 0.860, names 1.000)
- `packages/workerpool/src/index.ts:1165 matmul` ↔ `packages/workerpool/src/index.ts:1819 distanceMatrix` (j 0.754, contain 0.880, names 0.760)
- `assembly/src/ops/curvefit.ts:6 expfit` ↔ `assembly/src/ops/curvefit.ts:55 powerfit` (j 0.752, contain 0.926, names 0.857)
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:836 sin` (j 0.752, contain 0.871, names 0.737)
- `assembly/src/ops/complex-array.ts:211 complex_array_abs` ↔ `assembly/src/ops/complex-array.ts:223 complex_array_arg` (j 0.750, contain 0.882, names 0.727)
- `functions/src/wasm/signal/wasm-bridge.ts:332 welchPSDDispatch` ↔ `functions/src/wasm/signal/wasm-bridge.ts:369 bartlettPSDDispatch` (j 0.750, contain 0.908, names 0.700)
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:858 cos` (j 0.748, contain 0.864, names 0.737)
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:858 cos` (j 0.746, contain 0.871, names 0.737)
- `functions/src/wasm/poly/wasm-bridge.ts:109 polyMulDispatch` ↔ `functions/src/wasm/poly/wasm-bridge.ts:266 resultantDispatch` (j 0.745, contain 0.864, names 0.458)
- `parallel/src/ParallelMatrix.ts:388 dotProduct` ↔ `parallel/src/ParallelMatrix.ts:421 sum` (j 0.744, contain 0.918, names 0.875)
- `functions/src/algebra/solver/lsolve.ts:184 _sparseForwardSubstitution` ↔ `functions/src/algebra/solver/usolve.ts:188 _sparseBackwardSubstitution` (j 0.742, contain 0.872, names 0.973)
- `matrix/src/backends/gpu/run-shader.ts:32 planRunShaderFromAdd` ↔ `matrix/src/backends/gpu/run-shader.ts:82 planRunShaderFromTranspose` (j 0.742, contain 0.868, names 0.938)
- `packages/workerpool/src/index.ts:927 scale` ↔ `packages/workerpool/src/index.ts:1528 unary` (j 0.738, contain 0.926, names 0.763)
- `packages/workerpool/src/index.ts:1605 applyKernel` ↔ `packages/workerpool/src/index.ts:1655 applyKernel2` (j 0.732, contain 0.924, names 0.744)
- `expression/src/parse.ts:1031 parseShift` ↔ `expression/src/parse.ts:1441 parseLeftHandOperators` (j 0.731, contain 0.851, names 0.643)
- `functions/src/numeric/solveDAE.ts:184 _denseSolve` ↔ `functions/src/signal/fir-smoothing.ts:26 solveLinearSystem` (j 0.728, contain 0.886, names 0.483)
- `functions/src/numeric/solveODE.ts:137 _inlineLuSolve` ↔ `functions/src/signal/fir-smoothing.ts:26 solveLinearSystem` (j 0.728, contain 0.937, names 0.429)
- `assembly/src/signal.ts:236 goertzel_f64` ↔ `functions/src/wasm/signal/wasm-bridge.ts:93 goertzelJS` (j 0.727, contain 0.860, names 0.833)
- `functions/src/numeric/control-equations.ts:79 transpose` ↔ `functions/src/numeric/control-equations.ts:87 matadd` (j 0.724, contain 0.913, names 0.636)
- `matrix/src/backends/JSBackend.ts:108 scale` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.723, contain 0.855, names 0.900)
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:880 tan` (j 0.720, contain 0.865, names 0.842)
- `assembly/src/special.ts:129 _besselJ0Series` ↔ `assembly/src/special.ts:143 _besselJ1Series` (j 0.718, contain 0.879, names 1.000)
- `assembly/src/ops/matrix.ts:204 matrix_multiply` ↔ `assembly/src/ops/matrix.ts:583 matrix_gemm` (j 0.714, contain 0.833, names 0.300)
- `autograd/src/tape.ts:858 cos` ↔ `autograd/src/tape.ts:880 tan` (j 0.714, contain 0.857, names 0.750)
- `functions/src/wasm/interpolation/wasm-bridge.ts:117 tridiagSolveDispatch` ↔ `functions/src/wasm/interpolation/wasm-bridge.ts:206 dividedDifferenceDispatch` (j 0.714, contain 0.878, names 0.385)
- `packages/workerpool/src/index.ts:777 sum` ↔ `packages/workerpool/src/index.ts:794 prod` (j 0.710, contain 0.831, names 1.000)
- `matrix/src/backends/ParallelBackend.ts:180 transpose` ↔ `matrix/src/backends/ParallelBackend.ts:201 sum` (j 0.705, contain 0.915, names 0.750)
- `assembly/src/ops/complex-array.ts:267 complex_array_exp` ↔ `assembly/src/ops/complex-array.ts:298 complex_array_sqrt` (j 0.703, contain 0.959, names 0.650)
- `assembly/src/poly.ts:331 cheb_fit_f64` ↔ `assembly/src/poly.ts:373 legendre_fit_f64` (j 0.703, contain 0.895, names 0.696)
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:108 scale` (j 0.703, contain 0.912, names 0.750)
- `autograd/src/tape.ts:1583 _eigSymmetric` ↔ `autograd/src/tape.ts:1617 _eigGeneral` (j 0.702, contain 0.949, names 0.667)
- `functions/src/wasm/bitwise/wasm-bridge.ts:78 runBinaryBitwiseWasm` ↔ `functions/src/wasm/bitwise/wasm-bridge.ts:103 runUnaryBitwiseWasm` (j 0.701, contain 0.861, names 0.800)
- `functions/src/wasm/special/scalars.ts:164 besselJ0Series` ↔ `functions/src/wasm/special/scalars.ts:181 besselJ1Series` (j 0.701, contain 0.870, names 1.000)
- `functions/src/numeric/nnls.ts:94 gradient` ↔ `functions/src/numeric/nnls.ts:203 gradient` (j 0.700, contain 0.949, names 0.800)

### jStruct 0.6 to 0.7 (162)

- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.699, contain 0.927, names 0.818)
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.699, contain 0.927, names 0.818)
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.699, contain 0.927, names 0.818)
- `matrix/src/backends/JSBackend.ts:92 divideElementwise` ↔ `matrix/src/backends/JSBackend.ts:177 transpose` (j 0.699, contain 0.927, names 0.818)
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:922 square` (j 0.690, contain 0.870, names 0.867)
- `core/src/collection.ts:183 _reduce` ↔ `functions/src/matrix/mapSlices.ts:100 _mapSlices` (j 0.688, contain 0.877, names 0.769)
- `matrix/src/backends/ParallelBackend.ts:124 scale` ↔ `matrix/src/backends/ParallelBackend.ts:180 transpose` (j 0.687, contain 0.821, names 0.769)
- `core/src/numeric/stable.ts:46 pairwiseSum` ↔ `core/src/numeric/stable.ts:167 pairwiseDot` (j 0.686, contain 0.850, names 0.762)
- `matrix/src/operations/sqrtm.ts:91 sqrtmSymmetric` ↔ `matrix/src/operations/sqrtm.ts:185 sqrtmGeneral` (j 0.686, contain 0.923, names 0.700)
- `autograd/src/tape.ts:836 sin` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.685, contain 0.817, names 0.737)
- `packages/workerpool/src/index.ts:859 elementwise` ↔ `packages/workerpool/src/index.ts:1655 applyKernel2` (j 0.682, contain 0.855, names 0.892)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/arithmetic.ts:660 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:704 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:870 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:891 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:912 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:935 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1211 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `functions/src/typed/arithmetic.ts:660 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.681, contain 0.825, names 0.833)
- `autograd/src/tape.ts:858 cos` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.680, contain 0.810, names 0.737)
- `functions/src/typed/special.ts:487 fresnelCScalar` ↔ `functions/src/typed/special.ts:509 fresnelSScalar` (j 0.680, contain 0.837, names 1.000)
- `functions/src/matrix/subset.ts:240 _getObjectProperty` ↔ `functions/src/matrix/subset.ts:265 _setObjectProperty` (j 0.677, contain 0.875, names 0.600)
- `functions/src/signal/fft-core-f64.ts:43 fftCoreFloat64` ↔ `packages/workerpool/src/fft-core.ts:35 fftFrameInPlace` (j 0.677, contain 0.828, names 0.763)
- `packages/workerpool/src/index.ts:1115 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1528 unary` (j 0.674, contain 0.884, names 0.610)
- `assembly/src/special.ts:158 _besselY0Series` ↔ `functions/src/wasm/special/scalars.ts:195 besselY0Series` (j 0.672, contain 0.821, names 0.688)
- `functions/src/numeric/control-equations.ts:113 norm1` ↔ `matrix/src/operations/common.ts:255 norm1` (j 0.672, contain 0.811, names 0.615)
- `matrix/src/backends/JSBackend.ts:108 scale` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.671, contain 0.825, names 0.750)
- `matrix/src/backends/ParallelBackend.ts:124 scale` ↔ `matrix/src/backends/ParallelBackend.ts:158 multiply` (j 0.671, contain 0.911, names 0.500)
- `functions/src/numeric/open-root-finders.ts:88 newton` ↔ `functions/src/numeric/open-root-finders.ts:185 halley` (j 0.670, contain 0.924, names 0.778)
- `functions/src/special/erf.ts:105 erfc2` ↔ `functions/src/special/erf.ts:129 erfc3` (j 0.669, contain 0.879, names 0.929)
- `assembly/src/ops/complex-array.ts:165 complex_array_scale_complex` ↔ `assembly/src/ops/complex-array.ts:283 complex_array_log` (j 0.667, contain 0.849, names 0.625)
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:922 square` (j 0.667, contain 0.812, names 0.875)
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:1051 _unaryElementwise` (j 0.667, contain 0.804, names 0.650)
- `matrix/src/parallel-matrix.ts:415 DenseMatrix, DenseMatrix` ↔ `matrix/src/parallel-matrix.ts:937 DenseMatrix, DenseMatrix` (j 0.667, contain 0.868, names 0.375)
- `packages/workerpool/src/index.ts:1528 unary` ↔ `packages/workerpool/src/index.ts:1605 applyKernel` (j 0.665, contain 0.847, names 0.769)
- `assembly/src/signal.ts:274 chirp_z_transform_f64` ↔ `functions/src/wasm/signal/wasm-bridge.ts:223 chirpZTransformJS` (j 0.663, contain 0.810, names 0.800)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:94 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:116 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/trigonometry.ts:138 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:94 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:116 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/typed/trigonometry.ts:138 Float64Array` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.662, contain 0.895, names 0.733)
- `functions/src/utils/bignumber/bitwise.ts:434 rightArithShiftBigNumber` ↔ `functions/src/utils/bignumber/bitwise.ts:484 rightLogShiftBigNumber` (j 0.662, contain 0.864, names 0.810)
- `matrix/src/backends/ParallelBackend.ts:158 multiply` ↔ `matrix/src/backends/ParallelBackend.ts:180 transpose` (j 0.662, contain 0.895, names 0.529)
- `functions/src/typed/normal-equations-solve.ts:8 solveAugmentedNormalEquations` ↔ `functions/src/typed/numeric.ts:196 linsolve` (j 0.661, contain 0.897, names 0.524)
- `functions/src/ml/ols.ts:73 invertUnscaled` ↔ `functions/src/typed/matrix-ops.ts:490 matrixInverse` (j 0.658, contain 0.798, names 0.667)
- `core/src/types/bignumber.ts:1432 _alternatingEvenTaylor` ↔ `core/src/types/bignumber.ts:1471 _atanTaylor` (j 0.657, contain 0.807, names 0.762)
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:880 tan` (j 0.656, contain 0.832, names 0.700)
- `functions/src/ml/ols.ts:73 invertUnscaled` ↔ `functions/src/typed/hypothesis.ts:2039 _matInverse` (j 0.656, contain 0.827, names 0.739)
- `functions/src/type/local/Decimal.ts:349 plus` ↔ `functions/src/type/local/Decimal.ts:388 minus` (j 0.656, contain 0.841, names 0.808)
- `assembly/src/special.ts:179 _besselY1Series` ↔ `functions/src/wasm/special/scalars.ts:217 besselY1Series` (j 0.655, contain 0.805, names 0.647)
- `matrix/src/backends/JSBackend.ts:44 add` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654, contain 0.850, names 0.692)
- `matrix/src/backends/JSBackend.ts:60 subtract` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654, contain 0.850, names 0.692)
- `matrix/src/backends/JSBackend.ts:76 multiplyElementwise` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654, contain 0.850, names 0.692)
- `matrix/src/backends/JSBackend.ts:92 divideElementwise` ↔ `matrix/src/backends/JSBackend.ts:123 abs` (j 0.654, contain 0.850, names 0.692)
- `packages/workerpool/src/index.ts:811 dot` ↔ `packages/workerpool/src/index.ts:1655 applyKernel2` (j 0.654, contain 0.833, names 0.725)
- `packages/workerpool/src/index.ts:859 elementwise` ↔ `packages/workerpool/src/index.ts:1528 unary` (j 0.654, contain 0.858, names 0.578)
- `packages/workerpool/src/index.ts:984 bitwiseBinary` ↔ `packages/workerpool/src/index.ts:1053 bitwiseScalar` (j 0.654, contain 0.847, names 0.757)
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:817 exp` (j 0.653, contain 0.837, names 0.765)
- `functions/src/typed/signal.ts:578 dct` ↔ `functions/src/typed/signal.ts:622 dst` (j 0.652, contain 0.829, names 0.833)
- `functions/src/special/spheroidal.ts:159 spheroidalAngular` ↔ `functions/src/special/spheroidal.ts:234 spheroidalAngularContinued` (j 0.651, contain 0.944, names 0.667)
- `autograd/src/tape.ts:880 tan` ↔ `autograd/src/tape.ts:903 sqrt` (j 0.649, contain 0.810, names 0.700)
- `autograd/src/tape.ts:880 tan` ↔ `autograd/src/tape.ts:1001 reciprocal` (j 0.649, contain 0.810, names 0.650)
- `functions/src/stats/gaussian-process.ts:101 forwardSolve` ↔ `functions/src/stats/gaussian-process.ts:113 backSolveTranspose` (j 0.649, contain 0.857, names 1.000)
- `assembly/src/ops/complex-array.ts:120 complex_array_mul` ↔ `assembly/src/ops/complex-array.ts:137 complex_array_div` (j 0.647, contain 0.815, names 0.929)
- `matrix/src/types/SparseMatrix.ts:576 multiplyElementwise` ↔ `matrix/src/types/SparseMatrix.ts:878 mapNonZeros` (j 0.645, contain 0.831, names 0.727)
- `core/src/types/bignumber.ts:1100 sinh` ↔ `core/src/types/bignumber.ts:1126 tanh` (j 0.642, contain 0.843, names 0.917)
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:1022 abs` (j 0.640, contain 0.845, names 0.700)
- `functions/src/numeric/solveODE.ts:1594 _rk23` ↔ `functions/src/numeric/solveODE.ts:1615 _rk45` (j 0.639, contain 0.885, names 1.000)
- `assembly/src/signal.ts:50 _fftInterleaved` ↔ `functions/src/wasm/signal/wasm-bridge.ts:110 _fftInterleavedJS` (j 0.638, contain 0.787, names 0.882)
- `autograd/src/tape.ts:798 log` ↔ `autograd/src/tape.ts:1022 abs` (j 0.637, contain 0.851, names 0.789)
- `matrix/src/backends/WASMBackend.ts:574 luDecomposition` ↔ `matrix/src/backends/WASMBackend.ts:779 inverse` (j 0.637, contain 0.921, names 0.500)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:35 f64Add` (j 0.636, contain 0.795, names 0.800)
- `matrix/src/types/SparseMatrix.ts:576 multiplyElementwise` ↔ `matrix/src/types/SparseMatrix.ts:601 multiply` (j 0.636, contain 0.882, names 0.615)
- `assembly/src/ops/matrix.ts:297 vector_matrix_multiply` ↔ `assembly/src/ops/matrix.ts:441 matrix_sum_cols` (j 0.633, contain 0.864, names 0.636)
- `functions/src/typed/integration.ts:389 gaussQuadSerial` ↔ `packages/workerpool/src/worker.ts:914 integrateChunk` (j 0.632, contain 0.782, names 0.412)
- `functions/src/special/spheroidal.ts:35 ferrersP` ↔ `functions/src/special/spheroidal.ts:212 ferrersPContinued` (j 0.631, contain 0.795, names 0.857)
- `autograd/src/tape.ts:817 exp` ↔ `autograd/src/tape.ts:922 square` (j 0.630, contain 0.777, names 0.765)
- `functions/src/typed/arithmetic.ts:1013 number, number` ↔ `functions/src/typed/arithmetic.ts:1028 bigint, bigint` (j 0.630, contain 0.895, names 0.778)
- `assembly/src/poly.ts:293 poly_fit_f64` ↔ `assembly/src/poly.ts:331 cheb_fit_f64` (j 0.629, contain 0.862, names 0.800)
- `functions/src/typed/arithmetic.ts:536 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/arithmetic.ts:704 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/arithmetic.ts:870 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/arithmetic.ts:891 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/arithmetic.ts:912 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/arithmetic.ts:935 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/arithmetic.ts:1211 Float64Array` ↔ `functions/src/typed/parallel-map.ts:38 mapArray` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/trigonometry.ts:170 Float64Array` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/trigonometry.ts:195 Float64Array` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/trigonometry.ts:279 Float64Array` (j 0.629, contain 0.772, names 0.600)
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/trigonometry.ts:299 Float64Array` (j 0.629, contain 0.772, names 0.600)
- `functions/src/numeric/krylov.ts:197 incompleteCholesky` ↔ `functions/src/typed/dist-objects.ts:1281 _cholesky` (j 0.628, contain 0.860, names 0.632)
- `packages/workerpool/src/index.ts:859 elementwise` ↔ `packages/workerpool/src/index.ts:984 bitwiseBinary` (j 0.627, contain 0.791, names 0.838)
- `packages/workerpool/src/index.ts:927 scale` ↔ `packages/workerpool/src/index.ts:1655 applyKernel2` (j 0.626, contain 0.866, names 0.650)
- `assembly/src/ops/matrix.ts:276 matrix_vector_multiply` ↔ `assembly/src/ops/matrix.ts:422 matrix_sum_rows` (j 0.625, contain 0.833, names 0.727)
- `packages/workerpool/src/index.ts:1165 matmul` ↔ `packages/workerpool/src/index.ts:2031 outer` (j 0.625, contain 0.780, names 0.886)
- `autograd/src/tape.ts:133 add` ↔ `autograd/src/tape.ts:202 mul` (j 0.624, contain 0.888, names 0.842)
- `core/src/arithmetic/scalar.ts:56 addScalar` ↔ `core/src/arithmetic/scalar.ts:66 subtractScalar` (j 0.623, contain 0.768, names 0.818)
- `core/src/arithmetic/scalar.ts:56 addScalar` ↔ `core/src/arithmetic/scalar.ts:77 multiplyScalar` (j 0.623, contain 0.768, names 0.818)
- `core/src/arithmetic/scalar.ts:56 addScalar` ↔ `core/src/arithmetic/scalar.ts:88 divideScalar` (j 0.623, contain 0.768, names 0.818)
- `core/src/arithmetic/scalar.ts:66 subtractScalar` ↔ `core/src/arithmetic/scalar.ts:77 multiplyScalar` (j 0.623, contain 0.768, names 0.818)
- `core/src/arithmetic/scalar.ts:66 subtractScalar` ↔ `core/src/arithmetic/scalar.ts:88 divideScalar` (j 0.623, contain 0.768, names 0.818)
- `core/src/arithmetic/scalar.ts:77 multiplyScalar` ↔ `core/src/arithmetic/scalar.ts:88 divideScalar` (j 0.623, contain 0.768, names 0.818)
- `assembly/src/ops/curvefit.ts:6 expfit` ↔ `assembly/src/ops/curvefit.ts:31 logfit` (j 0.622, contain 0.832, names 0.682)
- `assembly/src/ops/special.ts:43 laguerreL` ↔ `assembly/src/ops/special.ts:60 legendreP` (j 0.621, contain 0.787, names 1.000)
- `autograd/src/tape.ts:903 sqrt` ↔ `autograd/src/tape.ts:922 square` (j 0.620, contain 0.769, names 0.765)
- `functions/src/type/matrix/utils/matAlgo13xDD.ts:120 _iterate` ↔ `functions/src/type/matrix/utils/matAlgo14xDs.ts:101 _iterate` (j 0.618, contain 0.825, names 0.917)
- `autograd/src/tape.ts:1428 svd` ↔ `autograd/src/tape.ts:1583 _eigSymmetric` (j 0.617, contain 0.852, names 0.400)
- `packages/workerpool/src/index.ts:1115 bitwiseNot` ↔ `packages/workerpool/src/index.ts:1655 applyKernel2` (j 0.617, contain 0.864, names 0.625)
- `functions/src/signal/wavelets.ts:86 rickerWavelet` ↔ `functions/src/signal/wavelets.ts:99 morletWavelet` (j 0.615, contain 0.766, names 0.750)
- `parallel/src/ParallelMatrix.ts:288 elementwise` ↔ `parallel/src/ParallelMatrix.ts:356 scale` (j 0.615, contain 0.798, names 0.789)
- `core/src/array.ts:985 recursiveMapWithIndex` ↔ `core/src/array.ts:1003 recursiveMap` (j 0.614, contain 0.896, names 0.615)
- `packages/workerpool/src/index.ts:984 bitwiseBinary` ↔ `packages/workerpool/src/index.ts:1655 applyKernel2` (j 0.612, contain 0.823, names 0.750)
- `functions/src/typed/arithmetic.ts:1343 Float64Array` ↔ `functions/src/typed/arithmetic.ts:1366 Float64Array` (j 0.610, contain 0.766, names 0.800)
- `packages/workerpool/src/index.ts:777 sum` ↔ `packages/workerpool/src/index.ts:1462 norm` (j 0.610, contain 0.847, names 0.750)
- `matrix/src/backends/WASMBackend.ts:574 luDecomposition` ↔ `matrix/src/backends/WASMBackend.ts:894 choleskyDecomposition` (j 0.609, contain 0.945, names 0.512)
- `packages/workerpool/src/index.ts:1819 distanceMatrix` ↔ `packages/workerpool/src/index.ts:1957 matvec` (j 0.609, contain 0.763, names 0.755)
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:798 log` (j 0.608, contain 0.793, names 0.765)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:23 bitAnd_i32_array` (j 0.607, contain 0.773, names 0.800)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:33 bitOr_i32_array` (j 0.607, contain 0.773, names 0.800)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:43 bitXor_i32_array` (j 0.607, contain 0.773, names 0.800)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:66 leftShift_i32_array` (j 0.607, contain 0.773, names 0.800)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/bitwise.ts:77 rightArithShift_i32_array` (j 0.607, contain 0.773, names 0.800)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:44 f64Sub` (j 0.607, contain 0.773, names 0.800)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:53 f64Mul` (j 0.607, contain 0.773, names 0.800)
- `assembly/src/ops/array.ts:316 array_axpby` ↔ `assembly/src/ops/f64-buffer.ts:62 f64Div` (j 0.607, contain 0.773, names 0.800)
- `autograd/src/tape.ts:230 scale` ↔ `autograd/src/tape.ts:836 sin` (j 0.607, contain 0.804, names 0.722)
- `functions/src/matrix/eigs/realSymmetric.ts:102 diag` ↔ `functions/src/matrix/eigs/realSymmetric.ts:134 diagBig` (j 0.604, contain 0.768, names 0.586)
- `functions/src/typed/parallel-map.ts:38 mapArray` ↔ `functions/src/typed/parallel-map.ts:56 mapBinaryF64` (j 0.603, contain 0.772, names 0.529)
- `functions/src/numeric/krylov.ts:287 cg` ↔ `functions/src/numeric/krylov.ts:530 bicgstab` (j 0.602, contain 0.904, names 0.673)
- `tensor/src/operations/solve.ts:81 forwardSub` ↔ `tensor/src/operations/solve.ts:102 backSub` (j 0.602, contain 0.877, names 0.667)
- `assembly/src/ops/special.ts:11 chebyshevT` ↔ `assembly/src/ops/special.ts:60 legendreP` (j 0.600, contain 0.836, names 0.909)

### jStruct below 0.6 (reported by containment) (24)

- `functions/src/matrix/eigs/realSymmetric.ts:208 Sij1Big` ↔ `functions/src/matrix/eigs/realSymmetric.ts:226 x1Big` (j 0.596, contain 0.942, names 0.533)
- `functions/src/matrix/eigs/realSymmetric.ts:190 Sij1` ↔ `functions/src/matrix/eigs/realSymmetric.ts:269 x1` (j 0.577, contain 0.953, names 0.565)
- `functions/src/probability/bernoulli.ts:83 bigint | Fraction` ↔ `functions/src/probability/bernoulli.ts:92 BigNumber` (j 0.556, contain 1.000, names 0.529)
- `assembly/src/ops/polynomial.ts:87 determinant` ↔ `functions/src/wasm/poly/wasm-bridge.ts:174 resultantJS` (j 0.486, contain 0.945, names 0.429)
- `functions/src/typed/aggregate-restart.ts:12 aggregateRestartVectors` ↔ `functions/src/typed/graph.ts:928 _aggregateEigenvector` (j 0.474, contain 0.929, names 0.591)
- `assembly/src/special.ts:242 _besselJn` ↔ `assembly/src/special.ts:286 _besselYn` (j 0.407, contain 0.929, names 0.208)
- `functions/src/graph/traversal-centrality.ts:44 bfs` ↔ `functions/src/graph/traversal-centrality.ts:89 visit` (j 0.400, contain 0.920, names 0.529)
- `functions/src/wasm/special/scalars.ts:265 besselJScalar` ↔ `functions/src/wasm/special/scalars.ts:311 besselYScalar` (j 0.397, contain 0.906, names 0.231)
- `functions/src/typed/algebra.ts:1560 fullSimplify` ↔ `functions/src/typed/cas.ts:2490 _casSimplifyOne` (j 0.375, contain 0.913, names 0.250)
- `matrix/src/operations/logm.ts:234 validateEigenvalues` ↔ `matrix/src/operations/logm.ts:264 logmEig` (j 0.350, contain 0.913, names 0.455)
- `assembly/src/elementwise.ts:34 _erfSeries` ↔ `functions/src/wasm/special/scalars.ts:69 erfcSelfContained` (j 0.335, contain 0.957, names 0.450)
- `functions/src/numeric/control-equations.ts:172 vecRowMajor` ↔ `matrix/src/operations/expm.ts:139 matrixExpm` (j 0.247, contain 0.902, names 0.097)
- `core/src/wasm-loader.ts:425 getImports` ↔ `matrix/src/backends/WASMBackend.ts:404 loadAsModule` (j 0.232, contain 0.956, names 0.324)
- `autograd/src/tape.ts:1970 _eigSymBackward` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.221, contain 0.919, names 0.174)
- `functions/src/numeric/nnls.ts:94 gradient` ↔ `functions/src/numeric/nnls.ts:189 lsqBounded` (j 0.220, contain 0.949, names 0.300)
- `functions/src/numeric/bfgs.ts:92 matVec` ↔ `functions/src/numeric/nnls.ts:189 lsqBounded` (j 0.194, contain 1.000, names 0.143)
- `matrix/src/backends/WASMBackend.ts:574 luDecomposition` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.176, contain 0.919, names 0.100)
- `autograd/src/tape.ts:1830 _svdBackward` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.138, contain 0.919, names 0.100)
- `matrix/src/operations/qr.ts:44 qr` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.116, contain 0.919, names 0.114)
- `expression/src/compiler/compile.ts:307 compileFunctionNode` ↔ `expression/src/compiler/compile.ts:456 compileArrayNode` (j 0.105, contain 0.921, names 0.182)
- `tensor/src/operations/cholesky.ts:45 transposeSquare` ↔ `tensor/src/operations/solve.ts:127 tensorSolve` (j 0.074, contain 0.919, names 0.049)
- `matrix/src/operations/eig.ts:158 eigGeneral` ↔ `parallel/src/gemm-rows.ts:19 gemmRows` (j 0.036, contain 0.907, names 0.040)
- `matrix/src/operations/eig.ts:158 eigGeneral` ↔ `tensor/src/operations/cholesky.ts:45 transposeSquare` (j 0.025, contain 0.919, names 0.043)
- `functions/src/geometry/intersect.ts:272 _intersect3dHelper` ↔ `functions/src/matrix/eigs/complexEigs.ts:66 createComplexEigs` (j 0.022, contain 0.958, names 0.098)
