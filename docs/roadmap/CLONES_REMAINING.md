# Remaining clone pairs after the #473 sprint

Tracking list for the look-alike functions that Sprint 2R and the #473 follow-up sprint (`repo-tools clones`)
did not merge, and why. The 12 exact groups below were read against the post-sprint report; skip reasons
are pinned to file headers or tests. Re-run the tool before picking a pair up:

```bash
repo-tools clones . --src <each workspace package src folder> --out=<relative path outside the repo>
```

`--src` is every workspace `src` folder (the 24 packages, including `packages/typed-function/src` and
`packages/workerpool/src`). Do not commit the tool's reports.

## Counts

| Measure                         | Baseline (`b24e3ec2`) | After Sprint 2R (`4f1d0fc6`) | Start of #473 (`b1ca0a62`) | After #473 (`37c0fd44`) |
| ------------------------------- | --------------------- | ---------------------------- | -------------------------- | ----------------------- |
| Files scanned                   | 1192                  | 1212                         | 1212                       | 1219                    |
| Units (at least 50 nodes)       | 2714                  | 2635                         | 2635                       | 2609                    |
| Exact groups                    | 68                    | 12                           | 12                         | 12                      |
| Units inside exact groups       | 161                   | 43                           | 43                         | 43                      |
| Near pairs                      | 857                   | 638                          | 638                        | 583                     |
| Near pairs, jStruct 0.9 or more | 192                   | 115                          | 115                        | 112                     |
| Near pairs, jStruct 0.8 to 0.9  | 180                   | 165                          | 165                        | 164                     |

The #473 columns come from `repo-tools clones` run twice with the same flags (every workspace `src` folder,
tool defaults, output outside the repo), at `b1ca0a62` and at `37c0fd44` (the main commit after the last
merge of the sprint). The "Start of #473" column repeats the Sprint 2R figures because `b1ca0a62` only added
the roadmap doc (and a CHANGELOG line).

The unit total fell by less than the merged-body count because each shared helper is itself a unit and the
new oracle tests are not scanned. Net effect of the 19 sprint PRs: 26 fewer units (2635 to 2609), 55 fewer
near pairs (638 to 583), the exact groups unchanged (all 12 are recorded skips), and 7 new `src` files (the
files the plans named: `bigint-binomial.ts`, `shortCircuitBinary.ts`, `gemm-rows.ts`, `string-derivative.ts`,
`circumcircle.ts`, `reshape-axes.ts`, `as-typed-array.ts`).

## What the #473 sprint merged

Each PR extracts shared helper(s), with the named public functions kept as thin wrappers (no public
name or behavior change). Every PR carries oracle tests written against the unchanged code and a
recorded review.

| PR   | Area       | Merged                                                                          |
| ---- | ---------- | ------------------------------------------------------------------------------- |
| #474 | functions  | dense polynomial coefficient fill (`polyToDenseCoefficients`)                   |
| #475 | expression | filter/forEach, cumsum/mapSlices, and/or/bitAnd/bitOr transforms                |
| #476 | matrix     | Givens rotation, single-shift QR chase, Gauss-Jordan continue, Newton sqrt step |
| #477 | functions  | BigNumber binomial product, schoolbook multiply, `binomialExact`                |
| #478 | parallel   | chunk planning, block scatter/sum, row-block gemm shared with the worker        |
| #479 | functions  | sparse-from-vectors builder, `Index` dimension walk, numeric-square predicate   |
| #480 | workbook   | graph text render (`toMermaid`/`toDOT`), info CLI command dispatch              |
| #481 | matrix     | `ParallelBackend` fallbacks and one parallel-guard helper                       |
| #482 | functions  | Dijkstra scan, `angleBetween`, circumcircle helper                              |
| #483 | functions  | CAS integer-range fold, string derivative walk, transform-table walk            |
| #484 | functions  | lasso/elastic-net shell, noncentral Poisson mixture, `sampleN` normals          |
| #485 | functions  | PSD result pack, Newton/Halley loop, band quadratic roots                       |
| #486 | tensor     | max/min reducer, axis lookup, eig/SVD axis prep                                 |
| #487 | core       | `Fraction` add/subtract core, BigNumber sin/cos Taylor loop                     |
| #488 | expression | child-array loop of the node `map` methods                                      |
| #489 | autograd   | taped `sum`/`mean` backward scatter                                             |
| #490 | matrix     | AssemblyScript typed-array header allocation                                    |
| #491 | functions  | Airy Ai/Bi evaluator, incomplete-beta continued fraction                        |
| #492 | functions  | `runUnaryPtr` delegates to `runChainPtr`                                        |

Review caught real defects before merge in most of these, for example a lost `BigNumber` sub in the
transforms (#475), identity-copy aliasing in the chunk planner (#478), a regex that threw for metacharacter
variables (#483), multiply associativity in seeded normals (#484), a wrong axis-error type (#486), an
over-sized tape slot (#489) and a per-call allocation that made Airy 30% slower (#491). The wasm header merge
(#490) also retired a stale `WasmLoader` Int32Array class id (4, which is `Complex` in the shipped binary;
the production path already used 6).

## Exact groups still reported (12)

| Group                                                                                                                    | Why it stays                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AS `_carlsonRC` and JS `_carlsonRC`                                                                                      | A cross-language mirror: the JS fallback must stay and AssemblyScript cannot import a TypeScript package.                                                                                       |
| `autograd/src/tape.ts` `_batchedMatmul`, `_batchedMatmulGradA`, `_batchedMatmulGradB`                                    | Three different contractions (`A@B`, `dY@Bᵀ`, `Aᵀ@dY`) with different m/k/n sources and offsets. A stride gemm would sit on the tape hot path.                                                  |
| `isSafeMethod` in core, expression, functions                                                                            | Sandbox predicate; the expression and functions copies are canonical by design and the core copy is not on `internal`.                                                                          |
| `factory` in core, expression, functions                                                                                 | The bodies match but the generics do not: core's `Record<string, unknown>` constraint breaks the expression and functions call sites (comment in both `factory.ts` files).                      |
| `mulberry32` and `_workerMulberry32`                                                                                     | `dist/worker.js` cannot import core (externalized dependency, the bundle would pull the core barrel). `packages/workerpool/tests/worker-numerics.test.ts` pins parity.                          |
| Complex `tan` / `tanh`, `cot` / `coth`                                                                                   | Different formulas (`sin/cos` against `sinh/cosh`, and which doubled part feeds which); a four-callback helper on a four-line method is longer than the bodies.                                 |
| `isBigNumber` in expression and functions                                                                                | Local guards on purpose: a cross-module re-export measured about 40% slower on the Tukey path; `expression/tests/is-guards-local.test.ts` and `functions/tests/is-guards-local.test.ts` pin it. |
| `setSymDifference` / `setUnion` handlers                                                                                 | The empty-set preamble matches, but the result is `concat(diff, diff)` against `concat(symDiff, intersect)`.                                                                                    |
| 11, 8 and 3 unary `Float64Array` overloads in `typed/arithmetic.ts` and `typed/trigonometry.ts` (3 groups, 22 overloads) | Merged-loop prototype measured 56% to 643% slower on the sub-threshold sequential path (megamorphic call site in a shared hot loop, PR #454). Each overload keeps its own inline loop.          |

## Near pairs not merged

583 near pairs remain. The bullets are the skip set that was read (baseline jStruct ≥ 0.8 skips, plus the
unary overloads whose merge PR #454 measured and reverted). They are not a partition of all 583.

- **AssemblyScript.** Same reason as the exact AS group: editing the source rebuilds the binary. The JS twins are the fallback, not a second copy to delete. After Sprint 2R: 22 AS–JS pairs (one is the exact `_carlsonRC` group) and 74 AS–AS pairs.
- **Layering.** `packages/workerpool` cannot import `core`, `parallel` or `functions`: `gammaSampleRng` / `_workerGammaRandom`, `tensordotChunkKernel` / `tensordotChunk`, `fftCoreFloat64` / `fftFrameInPlace` (`mulberry32` is the exact-group case). `applyKernelChunk` / `applyKernel2Chunk` and `bitwiseChunk` / `bitwiseScalarChunk` are same-file arity splits, not a layering skip.
- **Security (3).** `functions` and `matrix` `WasmLoader` `precompile`, `loadNodeWasm`, `loadBrowserWasm`: import object, path resolution and the integrity import differ; folding them risks the SHA-384 gate.
- **Measured hot paths.** `workerpool` `sum` / `prod` / `norm` / `scale` / `bitwiseNot` / `applyKernel`, `JSBackend` `add` / `subtract` / `multiplyElementwise` / `divideElementwise`, `DualTensor` `add` / `sub`, `norm2` against `scaledDistance`, `neumaierSum` against `neumaierCumsum`, `isBigNumber` (core still pairs with the expression and functions locals at jStruct 0.86).
- **Different jobs.** A merge would need a mode flag or would change behavior: `lsolveAll` / `usolveAll` substitutions, `unflattenl` / `unflattenr`, `_xgcdBigNumber` / `_xgcdFraction`, `chainGpuDispatchImpl` against `chainReduceGpuDispatchImpl` (the error-scope LIFO makes a shared template a silent-zero risk), `AssignmentNode` `_toString` / `_toHTML`, the `tape.ts` `log` / `exp` / `sqrt` / `sin` / `cos` adjoints, `makeILU0` / `makeIC0`, `logm` `solveCol` against `sqrtm` `solveLinearSystem`, `solveDAE` `_denseSolve` against `solveODE` `_inlineLuSolve`, `inverse` against `choleskyDecomposition`. `argsortF64Dispatch` and `rankF64Dispatch` already share `indexDispatch`; `sortF64Dispatch` stays separate (in-place `Float64Array` vs a new `Int32Array`).
- **Unary `Float64Array` overloads.** The 22 overloads above remain as inlined `Math.*` loops (PR #454). A merge needs a per-kernel build step (code generation) so each overload keeps a monomorphic loop; that is a design change, not a refactor.

### Skipped in the #473 sprint (one line each)

Decided after reading both bodies; the first two were also tried and reverted or blocked by a measurement.

- `SparseMatrix` `multiplyElementwise` against `mapNonZeros`: bit-identical, but the extra per-nonzero callback measured +12.4% (2000x2000, about 40k nonzeros) and +4.4% (500x500) in warm ABBA, so the inlined CSR walk stays (tried in #481, reverted in review).
- `functions` `matrixInverse` against `matrix` `matInv`: bit-identical for finite input, but `matInv` skips a zero elimination factor while `matrixInverse` multiplies it, so an Infinity/NaN entry gives NaN in one and a finite value in the other; merging would change `matrixPower` on non-finite input.
- PageRank, betweenness and eigenvector centrality already share `runCentralityRestarts`; the kernels differ and one base would branch on the result field (`ranks` vs `centrality`).
- `_denseSolve`, `_inlineLuSolve` and `solveLinearSystem` differ in pivot cutoff (1e-300, none, 1e-14) and singular policy; one solver would mode-switch on the stiff-step hot path.
- `lsolve`/`usolve` (and the `*All` forms): forward and backward substitution walk the triangle in opposite directions, including the sparse CSC pointer walk; a direction flag is a mode switch in the elimination loop.
- L1 and Huber gradients share the row loop but use different influence functions; a callback in that loop is the megamorphic hot-loop pattern PR #454 measured as a loss. NNLS gradients: one fuses `Aᵀ(b−Ax)` in a loop, the other materializes `r` first, so a merge changes rounding.
- Welch/Bartlett WASM dispatches, `polyMulDispatch`/`resultantDispatch`, `tridiagSolveDispatch`/`dividedDifferenceDispatch`, `runBinaryBitwiseWasm`/`runUnaryBitwiseWasm`: only the WASM-or-JS shell matches; the exports, argument lists, ABIs and result types differ and `withAsF64` already holds the marshalling.
- Bessel J0/J1 and Fresnel C/S series: different term divisors, recurrence factors and seeds; folding needs a mode switch in the series loop.
- `transpose` against `matadd`, `norm1` (`Math.max` propagates NaN, the `>` update does not), `flipRows`/`flipCols`/`transposeSquare`, `sinh`/`tanh`, `Fraction` `floor`/`ceil`, `logm` `validateEigenvalues`/`logmEig`: different index maps or formulas; the overlap is the loop shell.
- JSBackend `{add, subtract, multiplyElementwise, divideElementwise, scale, abs, transpose}`, `Tensor` `add`/`sub`, tape `add`/`sub`/`mul`, `pairwiseSum`/`pairwiseDot`, the scalar arithmetic ladder (`addScalar` and friends), `recursiveMapWithIndex`/`recursiveMap`, `_reduce`/`_mapSlices`: measured or documented hot loops where a callback or mode branch is the known loss pattern.
- `condest` `luSolve`/`luSolveTranspose`, `sqrtmSymmetric`/`sqrtmGeneral`, `expm` `matSolve` and the other Gauss-Jordan variants (singular policy and pivot cutoffs 1e-15, 1e-30, 1e-14 differ), autograd eig/SVD backward pairs, `forwardSub`/`backSub`, Givens `applyGivensCols`/`applyGivensLeft`: different algorithms or opposite index axes.
- GPU `addAsync`/`scaleAsync`/`multiplyAsync` and `planRunShaderFromAdd`/`planRunShaderFromTranspose`: different kernels and bind layouts (`gpuOrJs` and `RunShaderPlan` are already the shared parts); `detectSIMD`/`detectBulkMemory` differ only in the feature bytes.
- `_atanTaylor` against the new `_alternatingEvenTaylor`: arctan divides a copy of the term and does not fold the divisor back into `term`.
- Expression: `parseShift`/`parseLeftHandOperators` (binary infix against postfix unary), `AssignmentNode` `_toString`/`_toHTML`/`_toTex` and `ObjectNode` `_toString`/`_toHTML` (different markup per output kind), `compileFunctionNode`/`compileArrayNode` (the sandbox accessor path stays).
- `autograd` `_matmulMNK` against `parallel` `multiplySequential`: autograd must not depend on parallel.
- `core` `getImports` against `matrix` `loadAsModule`: the second is the integrity-checked instantiate path.

## Known follow-ups found during review

- `matrix` `GPUBackend.add` / `matmul` / `transpose` go through `runShader` but still do not use `serializeGpu` or a validation error scope, so a WebGPU validation error would read back zeros (same behavior as before the `runShader` extraction; AGENTS.md "WGSL gotchas").
- `core` `deepMap` / `deepForEach` / `reduce` typing for nested arrays (CLAUDE.md "Known Issues") is still open.
