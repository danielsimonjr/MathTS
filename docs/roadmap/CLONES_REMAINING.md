# Remaining clone pairs after Sprint 2R

Tracking list for the look-alike functions that Sprint 2R (`repo-tools clones`) did not merge, and why. Every
pair here was read and declined on purpose; none is an oversight. Re-run the tool before picking one up:

```bash
repo-tools clones . --src $(cat clones-src-args.txt) --out=<relative path outside the repo>
```

where `clones-src-args.txt` lists every package `src` folder (`<pkg>/src` for the 24 workspace packages, plus
`packages/typed-function/src` and `packages/workerpool/src`). Do not commit the tool's reports.

## Counts

| Measure                         | Baseline (`b24e3ec2`) | After Sprint 2R (`4f1d0fc6`) |
| ------------------------------- | --------------------- | ---------------------------- |
| Files scanned                   | 1192                  | 1212                         |
| Units (at least 50 nodes)       | 2714                  | 2635                         |
| Exact groups                    | 68                    | 12                           |
| Units inside exact groups       | 161                   | 43                           |
| Near pairs                      | 857                   | 638                          |
| Near pairs, jStruct 0.9 or more | 192                   | 115                          |
| Near pairs, jStruct 0.8 to 0.9  | 180                   | 165                          |

The unit total fell by less than the merged-body count because each shared helper is itself a unit and the
new oracle tests are not scanned.

## Exact groups still reported (12)

| Group                                                                                                                 | Why it stays                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AS `_carlsonRC` and JS `_carlsonRC`                                                                                   | A cross-language mirror: the JS fallback must stay and AssemblyScript cannot import a TypeScript package.                                                                              |
| `autograd/src/tape.ts` `_batchedMatmul`, `GradA`, `GradB`                                                             | Three different contractions (`A@B`, `dY@Bᵀ`, `Aᵀ@dY`) with different m/k/n sources and offsets. A stride gemm would sit on the tape hot path.                                         |
| `isSafeMethod` in core, expression, functions                                                                         | Sandbox predicate; the expression and functions copies are canonical by design and the core copy is not on `internal`.                                                                 |
| `factory` in core, expression, functions                                                                              | The bodies match but the generics do not: core's `Record<string, unknown>` constraint breaks the expression and functions call sites (comment in both `factory.ts` files).             |
| `mulberry32` and `_workerMulberry32`                                                                                  | `dist/worker.js` cannot import core (externalized dependency, the bundle would pull the core barrel). `packages/workerpool/tests/worker-numerics.test.ts` pins parity.                 |
| Complex `tan` / `tanh`, `cot` / `coth`                                                                                | Different formulas (`sin/cos` against `sinh/cosh`, and which doubled part feeds which); a four-callback helper on a four-line method is longer than the bodies.                        |
| `isBigNumber` in expression and functions                                                                             | Local guards on purpose: a cross-module re-export measured about 40% slower on the Tukey path; `is-guards-local.test.ts` pins it.                                                      |
| `setSymDifference` / `setUnion` handlers                                                                              | The empty-set preamble matches, but the result is `concat(diff, diff)` against `concat(symDiff, intersect)`.                                                                           |
| 11 and 8 unary `Float64Array` overloads in `typed/arithmetic.ts` and `typed/trigonometry.ts` (3 groups, 22 overloads) | Merged-loop prototype measured 56% to 643% slower on the sub-threshold sequential path (megamorphic call site in a shared hot loop, PR #454). Each overload keeps its own inline loop. |

## Near pairs not merged (63 triaged, plus 112 unary pairs)

- **AssemblyScript (18 pairs).** Same reason as the exact AS groups: editing the source rebuilds the binary. The JS twins are the fallback, not a second copy to delete.
- **Layering (6).** `packages/workerpool` cannot import `core`, `parallel` or `functions` (`gammaSampleRng` / `_workerGammaRandom`, `tensordotChunkKernel` / `tensordotChunk`, `applyKernelChunk`, `bitwiseChunk`).
- **Security (3).** `functions` and `matrix` `WasmLoader` `precompile`, `loadNodeWasm`, `loadBrowserWasm`: import object, path resolution and the integrity import differ; folding them risks the SHA-384 gate.
- **Measured hot paths (16).** `workerpool` `sum` / `prod` / `norm` / `scale` / `bitwiseNot` / `applyKernel`, `JSBackend` `add` / `subtract` / `multiplyElementwise` / `divideElementwise`, `DualTensor` `add` / `sub`, `norm2` against `scaledDistance`, `neumaierSum` against `neumaierCumsum`, `isBigNumber`.
- **Different jobs (20).** A merge would need a mode flag or would change behavior: `lsolveAll` / `usolveAll` substitutions, `unflattenl` / `unflattenr`, `_xgcdBigNumber` / `_xgcdFraction`, `chainGpuDispatchImpl` against `chainReduceGpuDispatchImpl` (the error-scope LIFO makes a shared template a silent-zero risk), `sortF64Dispatch` against `argsortF64Dispatch` / `rankF64Dispatch`, `AssignmentNode` `_toString` / `_toHTML`, the `tape.ts` `log` / `exp` / `sqrt` / `sin` / `cos` adjoints, `makeILU0` / `makeIC0`, `logm` `solveCol` against `sqrtm` `solveLinearSystem`, `solveDAE` `_denseSolve` against `solveODE` `_inlineLuSolve`, `inverse` against `choleskyDecomposition`.
- **Unary `Float64Array` overloads (112 pairs, plan batch 5).** Deferred for the same measured reason as the exact groups above. A merge needs a per-kernel build step (code generation) so each overload keeps a monomorphic loop; that is a design change, not a refactor.

## Known follow-ups found during review

- `matrix` `GPUBackend.add` / `matmul` / `transpose` do not use `serializeGpu` or a validation error scope, so a WebGPU validation error would read back zeros (same behavior as before the `runShader` extraction; AGENTS.md "WGSL gotchas").
- `core` `deepMap` / `deepForEach` / `reduce` typing for nested arrays (CLAUDE.md "Known Issues") is still open.
