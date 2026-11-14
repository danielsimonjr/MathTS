---
persona: ml-engineer
round: 3
date: 2026-11-13 (session ran into 2026-11-14)
release: a5887117 (MathTS main), published npm packages only
---

# ml-engineer — npm dogfood round 3, 2026-11-13

STARTED 2026-11-14T05:14:55Z (UTC, first action).

I am a PyTorch/JAX engineer who trains small models in TypeScript. I used only the 24 published `@danielsimonjr/mathts-*` packages at the exact versions in the brief (`npm ls --depth=0` matched all 24). I did not build the monorepo, did not import from a clone, and did not change product code. Scratch project: `C:/Users/danie/mathts-dogfood-r3/ml-engineer/`. Node v26.13.0 on Windows 11 (round 2 used Node v22.23.4 on Linux). Oracles: NumPy 2.3.4 (local Python), closed forms, and central finite differences. **Other agents running at the same time:** at least one other persona sweep (`symbolic-user/sweep/sweep-child.mjs`, seen in the process list at 00:04) ran during my benches. I did not identify the others. Every timing below is marked with that caveat.

```
npm ls --depth=0  (ml-engineer-r3@0.0.0)
+-- @danielsimonjr/mathts-arithmetic@0.2.0   +-- @danielsimonjr/mathts-ast@0.2.0
+-- @danielsimonjr/mathts-autograd@0.6.0     +-- @danielsimonjr/mathts-compat@0.6.0
+-- @danielsimonjr/mathts-core@0.28.0        +-- @danielsimonjr/mathts-evaluator@0.2.0
+-- @danielsimonjr/mathts-expression@0.14.0  +-- @danielsimonjr/mathts-functions@0.86.0
+-- @danielsimonjr/mathts-gpu@0.4.0          +-- @danielsimonjr/mathts-linalg@0.3.0
+-- @danielsimonjr/mathts-matrix@0.11.0      +-- @danielsimonjr/mathts-numbers@0.2.0
+-- @danielsimonjr/mathts-parallel@0.11.0    +-- @danielsimonjr/mathts-parser@0.2.0
+-- @danielsimonjr/mathts-plot@0.5.0         +-- @danielsimonjr/mathts-signal@0.2.0
+-- @danielsimonjr/mathts-statistics@0.5.0   +-- @danielsimonjr/mathts-tensor@0.5.0
+-- @danielsimonjr/mathts-trigonometry@0.2.0 +-- @danielsimonjr/mathts-typed-function@0.3.0
+-- @danielsimonjr/mathts-units@0.8.0        +-- @danielsimonjr/mathts-wasm@0.4.0
+-- @danielsimonjr/mathts-workbook@0.6.0     `-- @danielsimonjr/mathts-workerpool@0.5.0
```

## Goal

Find issues nobody has reported, across the exports in my area (tensor, autograd, matrix, parallel, gpu, core, functions), with edge inputs. Re-check the round-2 issues #902 to #905. Run the ML tasks: tensor semantics, gradients against finite differences, an MLP that trains, parallel dispatch, and the package.json import.

## What I tried, in order

1. STARTED line; `npm install` of the 24 exact versions; `npm ls --depth=0` (above). Versions match.
2. Read the round-2 report (`docs/persona-sessions/2026-11-12-ml-engineer-r2.md`) and its bench JSON. Round-2 issue index: #902, #903, #904, #905. Read each with `gh issue view` (all four CLOSED).
3. Re-check of #902 to #905 (table below), with repro scripts in `ml-engineer/t4/recheck.mjs`.
4. Export inventory: `ml-engineer/ml-engineer-surface-all.txt` (copy at `C:/Users/danie/mathts-dogfood-r3/ml-engineer-surface.txt`), 2,886 lines, 24 packages, every package imports.
5. Tensor semantics against NumPy (`t1/tensor_numpy.mjs`, `t1/tensor2.mjs`, `t1/batch.mjs`): reshape (-1, size mismatch), slice with negative start/stop/step (1-D and 2-D, step -1, -2, clamp), flip, roll, stack, concatenate, gather, pad, broadcasting, matmul (2-D, batched same-rank, broadcast, rank-1, empty, NaN, Inf, -0, mixed storage). Each NumPy value was computed with `python -c` (numpy 2.3.4).
6. Autograd gradient check (`t2/ad.mjs`, `t2/isolate.mjs`, `t2/ce.mjs`): a 2-layer tanh MLP with a softmax cross-entropy loss, 26 parameters. Reverse mode (Tape) against central finite differences, h = 1e-6: max abs error 1.3e-10, max rel error 8e-9. One early mismatch (tape loss 0.458 against oracle 0.690) was **my error**: `crossEntropy` returns per-sample losses, and I printed element 0. With `.mean()` the values agree to 1e-16.
7. Forward and reverse parity (`t2/parity.mjs`): f(x) = x*sin(x) + exp(x/2) on R^3. Forward Jacobian (`forwardGrad`) and reverse rows (`reverseGrad`, unit cotangents) agree with the analytic diagonal exactly (max diff 0). Default cotangent gives the column sums. Singularities checked (`derivative` of sqrt, log, 1/x, asin, tan, exp at the domain edges).
8. Training (`t2/train.mjs`): XOR, 2-layer tanh MLP (2-8-1), SGD lr 0.5, 200 steps. Loss 0.706 (step 0) to 0.037 (step 199); 4 of 4 correct. 2000 steps: loss 0.0012, 4 of 4.
9. `binaryCrossEntropy` check (`t2/isolate.mjs`): see finding F-BCE below. The first training run applied `sigmoid` before the op and reached 3 of 4.
10. Parallel (`t4/parallel.mjs`, `t4/bench_sin.mjs`, `t4/verify.mjs`, `t4/unhandled*.mjs`): `ComputePool.warmup()`, `pool.sin` and `pool.matmul` against in-process results, edge calls (empty, size 1, NaN/Inf/-0, shape mismatch, terminate then call).
11. Import of the package.json subpath (#905): `t4/recheck.mjs`.
12. Export sweep (`sweep/sweep.mjs`, `sweep/run.sh`, `sweep/resume.sh`): each export of the 7 packages in my area was called with 22 argument sets (none, one, NaN, Inf, -Inf, -0, MAX_VALUE pair, subnormal, string, null, object, empty array, array, nested array, Float64Array, Tensor, empty Tensor, DenseMatrix, a SparseMatrix fixture (it was null, because my fixture call failed, so no SparseMatrix was passed), eight arguments, two Tensors, Tensor with scalar, Tensor with bad axis). The watchdog is per chunk of exports (20 s to 90 s), not per call: a timeout marks the export that was in progress, not the exact argument set. Synchronous calls were not bounded per call. Output: `sweep/<pkg>.log`. An error whose message names an internal property is marked LEAK. The `functions` sweep ran as several chunks through `sweep/resume.sh`; one `run.sh` ran detached (`&`) for part of that time and overlapped the chunks, so `functions.log` may have duplicate rows. I did not use its row counts as exact.
13. Hand tests of the exports the sweep could not exercise with valid input (`t5/dec.mjs`, `t5/recon.mjs`, `t5/one.mjs`): tensor decompositions need a `rowAxes` argument (my first call omitted it and got `rowAxes is not iterable`). With `[0]`: SVD reconstruction equals A; QR Q·R equals A; `tensorPinv` equals the closed-form inverse for the 2x2 matrix; `tensorCholesky` uses only the lower triangle, as NumPy does. LU reconstruction not verified: `tensorLU` returns `P` as a non-Tensor (`P.matmul is not a function`).
14. Hang isolation (`sweep/one.mjs`): for the 34 exports the sweep marked, I called each with (MAX_VALUE, MAX_VALUE) under a 6 s watchdog, and for the first 11 also with `one` and `nan`. Those 11 returned a value or threw at once except for the MAX_VALUE case. The other 23 got the MAX_VALUE case only. 33 did not return. `wilcoxon` was a false mark (it returned at once with that input).
15. Duplicate search for every draft (`gh issue list --search`), noted per draft below.
16. Coverage table built from the logs (`sweep/cov.mjs`, then `t5/patch.mjs` for the hand-tested exports), file `ml-engineer/coverage.tsv`.

## Round-2 re-check

| Issue | Title (short)                       | Fixed?         | Evidence (what I ran, what I saw)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ----------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #902  | slice negative step                 | **yes**        | `slice(arange(0,5), [{step:-1}])` gives `[4,3,2,1,0]`. NumPy `[::-1]` gives the same. `{start:3,stop:0,step:-1}` gives `[3,2,1]` (NumPy `[3:0:-1]` = `[3,2,1]`). 2-D `[null,{step:-1}]` gives `[[2,1,0],[5,4,3]]`, NumPy `[:, ::-1]` the same. (`t1/tensor2.mjs`, `t4/recheck.mjs`)                                                                                                                                                                                                                                                           |
| #903  | forceParallel sin slower            | **yes** (perf) | Round 2: forceParallel 75.2 ms vs sequential 27.4 ms (2.75x slower). Round 3, two benches on Node 26 with other agents running: first bench (7 runs) forceParallel **61.7 ms**, `Math.sin` map 125.6 ms, default 68.6 ms; second bench (9 runs, `t4/bench_sin.mjs`) forceParallel **27.7 ms**, sequential for-loop 36.2 ms, `Float64Array.map` 64.6 ms, default 38.8 ms. Both runs put forced parallel at or below sequential. The two runs differ by 2.2x on the same case, so the noise is large. Repeat on a quiet machine before closing. |
| #904  | Tensor.matmul(TapedTensor) fails    | **partial**    | The RHS case still is not supported. The error changed from `other.contiguous is not a function` to a clear message: "operand is a TapedTensor, so a plain Tensor op would drop its gradient. Wrap this Tensor ... call TapedTensor.matmul." The workaround (tape both operands) works, `[3,2]`. Batched LHS still fails: see F1.                                                                                                                                                                                                             |
| #905  | package.json needs import attribute | **yes** (docs) | Bare `import('@danielsimonjr/mathts-tensor/package.json')` throws `ERR_IMPORT_ATTRIBUTE_MISSING` on Node 26. With `{ with: { type: 'json' } }` it returns version `0.5.0`. The README documents the attribute. Node requires the attribute, so this is not a package defect.                                                                                                                                                                                                                                                                  |

Round-1 rows (#747 to #765) are not in this round's index; I did not re-check them.

## New findings (round 3)

Draft text for each is in `C:/Users/danie/mathts-dogfood-r3/ml-engineer-issues.md`.

### P1 — F1: batched matmul does not broadcast batch dimensions or accept rank-1 operands

Evidence: `Tensor.ones(4,3,5).matmul(Tensor.ones(5,2))` throws "batch rank mismatch; operands must have the same rank (3 vs 2)". `ones(2,2,2).matmul(ones(2))` throws "both operands must have rank ≥ 2". The same calls fail in `TapedTensor.matmul`. NumPy and PyTorch return `[4,3,2]` and `[2,2]`. Related: #753 (closed), #763. Priority note: the docs say "batched matrix multiply"; they do not promise NumPy broadcast. The lead should decide P1 (ML layer over batched input) or P2 (under the brief's rule).

### P1 — F2: 33 numeric exports do not return within 6 s for (Number.MAX_VALUE, Number.MAX_VALUE); integerSqrt also hangs at 1e100

Evidence: `integerSqrt(v)` returns at once for v = 1e9, 1e15, 1e20, 1e21, 1e22, 1e25, 1e30 (all correct), and does not return within 8 s for v = 1e100, 1e300 or Number.MAX_VALUE (`t6/isq.mjs`). The exact threshold between 1e30 and 1e100 is not measured. `timeout 6 node one.mjs <name> big` gave no return for: bernoulliPolynomial, besselJ, besselJZeros, besselK, besselY, binomialTest, cheby1, chebyshevT, composition, eulerPolynomial, fallingFactorial, gegenbauerC, hadamardMatrix, hankelH1, hankelH2, hermiteH, integerSqrt, jacobiP, laguerreL, legendreP, mathieuB, mathieuSe, permutations, polygamma, riemannSiegelZ, risingFactorial, rootsChebyshevU, rootsLegendre, siegelZ, sphericalBesselK, sphericalBesselY, sphericalHarmonic, stirlingS2. Single-argument check: `integerSqrt(Number.MAX_VALUE)` did not return within 6 s, but `integerSqrt(1e9)` returns 31622 at once (correct). `permutations(Number.MAX_VALUE)` returns `Infinity`. Most of these are not a bug in the formula; they are unbounded loops or allocations with no size check. Duplicate check: #964 (open) is about FFT and stats overloads, not this.

### P2 — F3: grad and valueAndGrad blame the output for a bad input, and skip the AD-traceable guard

Evidence: `grad(x=>x.square())('abc')` throws "fn must return a scalar (length 1); got length 3". `grad(() => new Tensor(...))([1])` throws a raw `TypeError: Cannot read properties of undefined (reading 'length')`. `reverseGrad` with the same function gives the guard message. (`t2/verify2.mjs`)

### P2 — F4: Tape ops given a plain Tensor operand report "operands belong to different Tapes"

Evidence: `TapedTensor.fromTensorAsInput(Tensor.ones(2,2), new Tape()).matmul(Tensor.ones(2,2))` and `.add(Tensor.ones(2,2))` both throw "TapedTensor: operands belong to different Tapes". The second operand has no tape. Related: #755 (closed; same message for `add(1)`).

Dropped from this round: `derivative(log, -1)` returns -1 while the value is NaN. This is the usual reverse-mode convention (grad = 1/x), not a confirmed defect. PyTorch and JAX were not run here, so I did not draft it.

### P2 — F6: reshape size-mismatch message prints the target shape twice

Evidence: `Tensor.arange(0,12).reshape([3,4]).reshape([5,3])` throws "size mismatch [5,3] -> [5,3] (size 12 vs 15)". The source shape should be `[3,4]`. Related: #752 (closed).

### P2 — F7: gather rejects negative indices; slice accepts them

Evidence: `slice(arange(0,4), [{start:-1}])` gives `[3]`. `gather(arange(0,4), 0, [-1])` throws "index -1 at position 0 is out of range". NumPy `take` wraps. The docs say nothing about this.

### P2 — F8: roll error messages and argument rules

Evidence: `roll(arange(0,4), 1, 0)` (axes as a number) throws "shifts length 1 does not match axes length undefined". `roll(arange(0,4), [1])` (no axes) throws "when axes is omitted, shifts must be a single number". NumPy `roll(x, [1])` with no axis flattens and rolls. `flip` gives "axes must be an array of integers" for the same kind of mistake.

### P2 — F9: wrong argument types reach internal code and throw raw TypeErrors (all 7 packages)

Evidence: `gather(1, 0, [0])` gives "Cannot read properties of undefined (reading 'length')". `flip(1, [0])`, `concatenate([1], 0)`, `matrixExpm(Tensor.ones(2,2))` ("A.toArray is not a function"), `getMaxMatrixSize()` ("reading 'supported'"). The sweep marked raw internal errors on these edge sets: tensor 340 rows, autograd 110, matrix 136, core 233, parallel 556, gpu 6 (rows = export x argument set; see `sweep/*.log`).

### P2 — F10: pairwiseSum, pairwiseDot and sumSquaredDeviations overflow the stack on a scalar; parallelSum(1) crashes Node when not awaited

Evidence: `pairwiseSum(1)`, `pairwiseSum(NaN)`, `pairwiseSum({})`, `pairwiseDot(1,2)`, `sumSquaredDeviations(1)` each throw `RangeError: Maximum call stack size exceeded`. `parallelSum(1)` without `await` exits the process (code 1) with the same RangeError as an unhandled rejection. With `await` it rejects normally. Duplicate check: #964 (open) has a stack overflow in `mad` and `mode` on a DenseMatrix. That is a different code path, so I drafted this one separately and linked #964.

### P2 — F11: parallelMean('abc') (standalone export) resolves NaN silently

Evidence: `await parallelMean('abc')` gives `{ result: NaN, parallelized: false }`, no error. `ComputePool.sin([1,2,3])` (plain array, typed as Float64Array) also resolves silently.

### P2 — F12: ComputePool.workerCount disagrees with stats() and isReady()

Evidence: a fresh pool reports `workerCount 2`, `isReady() false`, `stats().totalWorkers 0`. After `terminate()`, `workerCount` is still 2 while `stats().totalWorkers` is 0 (`t4/verify.mjs`).

### P2 — F13: ComputePool.unary() with an unknown op throws an internal error

Evidence: `pool.unary(data, 'cbrt')` throws "UNARY_KERNELS[fn] is not a function". The method is typed as a union of ops; the runtime does not check.

### P2 — F-BCE: binaryCrossEntropy takes logits; the API page does not list it

Evidence: `binaryCrossEntropy([1,0])` on the input `[0.8, 0.3]` gives `[0.3711, 0.8544]`, which is log(1+exp(-x)) for each input. Probabilities would give `[-log 0.8, -log 0.7] = [0.2231, 0.3567]`. So the op treats its input as a logit. The JSDoc says "with logits"; `docs/api/autograd.md` contains no `crossEntropy` or `binaryCrossEntropy` entry. Consequence measured: XOR, 200 steps, with `sigmoid` applied before the op (so the input was transformed twice), 3 of 4 correct. With raw logits, 4 of 4 correct, loss 0.037. The name differs from PyTorch `BCELoss`, which takes probabilities.

### Also observed, not drafted (not a defect or too small)

- `tensorCholesky` on a non-symmetric matrix reads only the lower triangle without error. NumPy does the same.
- `tensorLU` returns `P` as a non-Tensor value (`P.matmul` is not a function). Not verified further.
- `Tensor.flip` requires an axes argument (signature says so); NumPy flips all axes when none are given. Documented, so not drafted.

## Coverage

Source: `C:/Users/danie/mathts-dogfood-r3/ml-engineer/coverage.tsv` (one row per export, 1,819 rows). Summary below. Column meanings: **yes** = at least one argument set returned a value; **fuzz only** = every argument set was rejected (the sweep did not get a valid call); **hand test** = a valid call I ran by hand (marked in the finding column); **constant or class** = not a function, so the sweep skipped it.

Columns: **valid, sweep** = the sweep got a returned value with a valid-looking argument set (it does not check the value); **hand** = I called it by hand with a valid input (listed in `coverage.tsv` by name; oracle check only where stated in "What I tried"); **fuzz only** = every argument set was rejected, so no valid call was made; **const/class** = a non-function export (constant or class; the sweep skips these); **no result row** = the sweep never got a result row for the export (hang or not reached).

| Package   | Exports   | Valid, sweep | Hand   | Fuzz only | Const/class | No result row                                                 |
| --------- | --------- | ------------ | ------ | --------- | ----------- | ------------------------------------------------------------- |
| tensor    | 23        | 2            | 16     | 4         | 1           | 0                                                             |
| autograd  | 9         | 0            | 9      | 0         | 0           | 0                                                             |
| matrix    | 157       | 107          | 1      | 22        | 27          | 0                                                             |
| parallel  | 70        | 48           | 4      | 11        | 7           | 0                                                             |
| gpu       | 25        | 18           | 3      | 0         | 4           | 0                                                             |
| core      | 152       | 65           | 3      | 19        | 65          | 0                                                             |
| functions | 1,383     | 893          | 2      | 357       | 94          | 32 (includes wilcoxon, a false mark; 5 more were not reached) |
| **total** | **1,819** | **1,133**    | **38** | **413**   | **198**     | **32**                                                        |

Totals: 1,133 + 38 + 413 + 198 + 32 = 1,814, plus 5 not reached = 1,819. The 5 not reached in `functions` are butter, divisorSigma, ferrersP, nthRoots, nuclearMagneton (the sweep was interrupted before them and I did not re-run them). The "no result row" exports in `functions` are the hang list in F2 (32 rows, one false mark). "Fuzz only" exports (413) are the next valid-input test target for the lead.

Exports with a valid call checked against an oracle: tensor slice (NumPy), flip, roll, matmul, SVD (reconstruction = A), QR (= A), pinv (= closed form), autograd gradients (finite differences), parallel `sin` and `matmul` (against in-process), pairwise sum (1e6 ones). Exports called with a valid input but not checked: `tensorEig`, `tensorSolve`, `tensorKron`, `randomTensor`, `gpu` status calls, and most of `functions`.

Hand tests (valid input, result checked where noted): tensor `slice`, `flip`, `roll`, `stack`, `concatenate`, `gather`, `pad`, broadcast add, matmul (2x2, batched, NaN, 0xN), `tensorSvd` (reconstruction = A), `tensorQr` (= A), `tensorPinv` (= closed form), `tensorCholesky` (values), `tensorEig` (keys only), `tensorSolve` (keys only), `tensorKron` (shape only), `randomTensor` (not checked). Autograd: `Tape` with `matmul`, `add`, `tanh`, `sigmoid`, `crossEntropy`, `binaryCrossEntropy`, `backward`, `getInputGrad`, `forwardGrad`, `reverseGrad`, `grad`, `valueAndGrad`, `derivative`, `jacobian`, `DualTensor` (`unitAt`, `sin`, `divide`, `sqrt`, `abs`). Parallel: `ComputePool` (`warmup`, `sin`, `matmul`, `sum`, `stats`, `terminate`, `isReady`, `workerCount`, `unary`, concurrent calls), `parallelSum`, `parallelMean`, `pairwiseSum`, `pairwiseDot`, `sumSquaredDeviations`, `resolveDefaultWorkerScript`, `DEFAULT_THRESHOLD_BY_OP`. GPU: `hasWebGPU`, `getGlobalGPUContext`, `initializeGlobalGPUWithReason`, `detectGPUCapabilities`, `getMaxMatrixSize` (needs an argument).

Not covered by a valid-input call this round: the remaining matrix and core exports beyond the sweep, most of functions (the sweep gives argument-type feedback only), `randomTensor` output properties, `scatter` (sweep only), `contractNetwork`, `tensorLU` (P type), `Index`/`idx`, and all `Wasm` variants (`tensorSvdWasm`, `tensorEigWasm`, `wasm` package). The functions package was sweep-only; its values are not checked against an oracle.

## Bench

Node v26.13.0, Windows 11, 2 pool workers (`maxWorkers: 2`). Each row: median of the runs shown. Other agents running: yes (see the header). Round-2 numbers from `docs/persona-sessions/bench/2026-11-12-ml-engineer-r2.json` (Node 22, Linux).

| Case                                        | Round 3 (median ms, runs)           | Round 2 (ms)                     | Ratio / note                                                       |
| ------------------------------------------- | ----------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| sin 1e6, sequential for-loop                | 36.2 (9)                            | 27.4 (5, seq)                    | 1.3x; noise                                                        |
| sin 1e6, sequential `Float64Array.map`      | 64.6 (9)                            | —                                | not comparable to the for-loop                                     |
| sin 1e6, pool `forceParallel`               | 27.7 (9)                            | 75.2 (5)                         | round 2 was 2.75x slower than seq; now faster than seq loop (#903) |
| sin 1e6, pool default dispatch              | 38.8 (9)                            | ~27 (in-process)                 | 1.4x vs round 2; within noise, flagged for the lead to repeat      |
| matmul 256, in-process `Tensor.matmul`      | 41.3 (7)                            | —                                | new                                                                |
| matmul 256, pool `forceParallel`, warm      | 22.5 (7)                            | —                                | 1.8x faster than in-process                                        |
| matmul 512, in-process `Tensor.matmul`      | 372.1 (7)                           | —                                | new; this is the number the lead should compare with NumPy         |
| matmul 512, pool `forceParallel`, warm      | 281.2 (7)                           | —                                | 1.3x faster; no NumPy oracle timing taken                          |
| XOR MLP (tanh, 2-8-1, BCE logits), per step | 0.21 to 0.24 ms (200 steps, median) | 0.0435 ms (relu MLP, 2500 steps) | different model; not comparable                                    |

No case is more than 1.5x slower than round 2. The pool `warmup()` took 195 ms (one time). Matmul correctness: pool result equals `Tensor.matmul` exactly (max abs diff 0) at 256 and 512. No NumPy timing was taken (the oracle column in the brief was not run).

## What worked well

- Reverse-mode AD on a 26-parameter MLP agrees with central finite differences to 1e-10 (abs). Forward and reverse mode agree exactly on an elementwise R^3 function. Forward mode on the MLP was not run. The guard messages for non-traceable functions (`forwardGrad`, `reverseGrad`) are clear.
- XOR trains to 4 of 4 with the logits BCE: loss 0.037 at 200 steps, 0.0012 at 2000.
- Slice with negative step, including 2-D, matches NumPy (#902 fixed).
- `forceParallel` is no longer slower than in-process (#903).
- The parallel results are bit-exact against in-process matmul and `Math.sin` (max diff 0), including NaN and -0 handling.
- Shape and rank errors for `matmul`, `concatenate`, `stack`, `slice` and `pad` name the problem and the shapes.

## Verdict

I would train small same-rank models here now: a 2-layer MLP on a matrix batch, with a logits loss and `Tape`, converges and matches finite differences. I would not adopt it for sequence or conv models yet: the batched matmul rejects the shared-weight case that every linear layer on batched input needs (F1). I would keep the BCE op away from probabilities (F-BCE), and I would guard inputs before calling any numeric function from `functions` (F2: 33 functions hang on large arguments). GPU does not run in Node (`status unavailable`), so the browser path is untested by me.

## Issue index (round 3)

Drafts are not filed. Labels and repro scripts are in `C:/Users/danie/mathts-dogfood-r3/ml-engineer-issues.md`. "Duplicate" means I found an open or closed issue with the same symptom; "related" means a near match.

| #   | Draft title                                                                                                                    | Priority | Labels        | Duplicate check            |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------- | -------------------------- |
| 1   | Tensor.matmul and TapedTensor.matmul do not broadcast batch dimensions or accept rank-1 operands                               | P1       | dogfood, api  | related #753, #763         |
| 2   | Several numeric functions never return for Number.MAX_VALUE arguments (33 exports)                                             | P1       | dogfood, bug  | none (#964 different)      |
| 3   | grad and valueAndGrad blame the output for a bad input, and skip the AD-traceable guard                                        | P2       | dogfood, bug  | none                       |
| 4   | Tape ops given a plain Tensor operand report "operands belong to different Tapes"                                              | P2       | dogfood, api  | related #755               |
| 6   | Tensor.reshape size-mismatch message prints the target shape twice                                                             | P2       | dogfood, docs | related #752               |
| 7   | gather rejects negative indices, while slice accepts them                                                                      | P2       | dogfood, api  | none                       |
| 8   | roll: non-array axes gives "axes length undefined"; shift array without axes throws                                            | P2       | dogfood, api  | none                       |
| 9   | Wrong argument types reach internal code and throw raw TypeErrors (all 7 packages)                                             | P2       | dogfood, api  | none                       |
| 10  | pairwiseSum, pairwiseDot and sumSquaredDeviations overflow the stack on a scalar; parallelSum(1) crashes Node when not awaited | P2       | dogfood, bug  | none (#423, #964 not this) |
| 11  | ComputePool.parallelMean('abc') resolves NaN without an error                                                                  | P2       | dogfood, api  | none                       |
| 12  | ComputePool.workerCount disagrees with stats() and isReady()                                                                   | P2       | dogfood, api  | none                       |
| 13  | ComputePool.unary() with an unknown op throws an internal error                                                                | P2       | dogfood, api  | none                       |
| 14  | binaryCrossEntropy takes logits; docs/api/autograd.md omits crossEntropy and binaryCrossEntropy                                | P2       | dogfood, docs | none                       |

Round-2 re-check counts: **yes 3** (#902, #903, #905), **partial 1** (#904), **no 0**.
New findings by priority: **P0 0**, **P1 2**, **P2 11** (one draft dropped: the derivative-at-negative-log convention).
Coverage: **exports reached 1,814 of 1,819** in area (5 functions not reached); **with a valid-input call: 1,171** (1,133 from the sweep, 38 by hand); 413 fuzz-only; 198 constants or classes not called; 32 with no result row.

## PARTIAL - remaining

Not done this round (brief steps 4c and 4e were only partly run):

- Forward-mode AD (`forwardGrad`) on the MLP loss. Forward mode ran only on an elementwise R^3 function.
- Strict `tsc` consumer (`skipLibCheck: false`) for the types of the packages in my area.
- NumPy matmul timing at 256 and 512 (the oracle column of the bench was not run).
- Complex, Fraction, BigNumber, Unit and SparseMatrix inputs through the tensor and parallel exports. The SparseMatrix fixture in the sweep was null.
- Step 4d contracts: the .d.ts and JSDoc were checked only for `binaryCrossEntropy`, `tensorLU` and `Tensor`.
- The 5 `functions` exports the sweep did not reach (butter, divisorSigma, ferrersP, nthRoots, nuclearMagneton), and the 198 constants or classes not called.
- `scatter`, `contractNetwork`, `Index`/`idx`, `randomTensor` determinism, and the Wasm variants (`tensorSvdWasm`, `tensorEigWasm`, the `wasm` package).
- Values for the `functions` package beyond the argument-type sweep: no oracle check.
- `grep TIMEOUT-async sweep/*.log` was not run.
- A dedicated NumPy oracle for `tensorLU` (its `P` is not a Tensor, so `P.matmul` fails).

## Containment and files

Created (all under `C:/Users/danie/mathts-dogfood-r3/ml-engineer/` unless stated): `package.json`, `package-lock.json`, `node_modules/` (24 packages), `t1/`, `t2/`, `t4/`, `t5/`, `t6/` (scripts and `.out` files), `sweep/` (sweep scripts, `*.log`, `names-*.txt`, `hang-exports.txt`, `functions.run.txt`), `surface.mjs`, `ml-engineer-surface-all.txt`, `coverage.tsv`, `t5_tensor_valid.mjs` (empty, created by a mistyped command; it is inside the folder and can be deleted). Deliverables outside that folder, as the brief names them: `C:/Users/danie/mathts-dogfood-r3/ml-engineer-report.md`, `ml-engineer-issues.md`, `ml-engineer-surface.txt`.

Processes: all runs were foreground or were watched until they finished. One `run.sh` for the `functions` sweep was started with `&` and was reaped by the shell when its call ended; its partial output is in `functions.log`. Before I killed them, I stopped: two hung sweep children (`node sweep.mjs functions`), two leftover `cov.sh` shells, and two awk coverage builds. A CIM search for command lines naming my folder found only the shells of the tool and `node.exe` processes from another persona's folder (`symbolic-user/sweep/sweep-child.mjs`), which I did not touch. No process of mine was still running at the end, as far as the process list shows.

Not committed, pushed, merged, or touched on GitHub. Product code unchanged. The issue file `C:/Users/danie/mathts-dogfood-r3/ml-engineer-issues.md` changed on disk after I wrote it; I did not revert that.
