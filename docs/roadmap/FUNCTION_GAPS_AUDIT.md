# MathTS Function & Auxiliary-Function Gap Audit

**Date:** 2026-05-24
**Source:** Cross-reference of `docs/Architecture/dependency-summary.compact.json` (2026-05-24 CDG run) against the per-package `typed/`, `factories/`, and synced-mathjs surface. Companion to the slice proposal in [`FUNCTION_GAPS.md`](./FUNCTION_GAPS.md).
**Method:**
- Listed every `functions/src/typed/*.ts` file's exported `mathTyped(…)` / `export function` count.
- Listed every synced category under `functions/src/{arithmetic, algebra, …}/` by file count.
- Counted `wasmLoader.*` and `computePool.*` call sites inside each `typed/<cat>.ts` to identify acceleration coverage.
- Cross-checked which `typed/<cat>.ts` files do not exist for a synced category that has > 0 files.

This is the broader audit the [FUNCTION_GAPS proposal](./FUNCTION_GAPS.md) was extracted from. It picked the three highest-leverage slices (TapedTensor AD, complex+set promotion, Tensor decompositions); this document keeps the full inventory so the remaining slices are addressable from a single source of truth instead of being scattered across chat-history paragraphs.

## A. Promotion gaps — synced categories without an active `typed/<cat>.ts`

Six categories ship synced mathjs files but never grew a typed-layer wrapper. The synced code is dormant — not exported through the public `functions/src/index.ts` directly.

| Category | Synced files | Notable missing exports | Priority | Status |
|---|---:|---|---|---|
| `set` | 10 | `setUnion`, `setIntersect`, `setDifference`, `setSymDifference`, `setIsSubset`, `setMultiplicity`, `setPowerset`, `setDistinct`, `setSize`, `setCartesian` | **★★★** | ✅ promoted in commit `1bfad1e` (FUNCTION_GAPS Slice 2) |
| `complex` | 4 | `arg`, `conj`, `im`, `re` — basic complex-number accessors | **★★★** | ✅ promoted in commit `1bfad1e` (FUNCTION_GAPS Slice 2) |
| `relational` | 13 | `deepEqual`, `unequal`, `compareNatural`, `compareText`, `compareUnits`, `equalScalar`, `equalText` (the basic `equal`/`larger`/`smaller`/`largerEq`/`smallerEq`/`compare` are already in `typed/numeric.ts`) | **★★** | ⏳ pending — see Open Items below |
| `probability` | 12 | `bernoulli`, `combinations`, `combinationsWithRep`, `multinomial`, `pickRandom`, `randomInt` — but most of the rest overlaps with `typed/distributions.ts` or `typed/special.ts` under different names | **★** | ⏳ pending — needs an audit to dedupe before promoting |
| `unit` | 2 | `to`, `toBest` — Unit-type conversion | **★** | ⏳ pending — depends on a real `Unit` type, which is not present in `core` today |
| `string` | 5 | `bin`, `hex`, `oct`, `format`, `print` — number formatting | ★ | ⏳ pending — low priority |

### Open items in this class
- **`typed/relational.ts`** — write a wrapper covering the seven currently-unpromoted comparison helpers. Most are leaf functions. ~80 LOC + tests.
- **`typed/probability.ts`** — first audit which of the 12 synced files are already surfaced under a different name in `typed/distributions.ts`/`typed/special.ts`; only promote the genuinely-missing six (`bernoulli`, `combinations`, `combinationsWithRep`, `multinomial`, `pickRandom`, `randomInt`).
- **`typed/unit.ts`** — blocked on the absence of a real `Unit` type in `core`. If/when a Unit type lands, `to` and `toBest` are one-liner wrappers.
- **`typed/string.ts`** — formatter helpers. Low priority; would round out the `mathjs` API surface but no downstream consumer is blocking on it.

## B. Acceleration gaps — `typed/` files running pure-JS

The dep-graph snapshot of per-typed-file dispatch routing (`wasmLoader.*` and `computePool.*` call counts at the time of the audit):

| typed file | exports | WASM calls | worker calls | Verdict |
|---|---:|---:|---:|---|
| `numeric` | 34 | **57** | 0 | well-accelerated |
| `signal` | 33 | **62** | 22 | best-accelerated |
| `geometry` | 31 | **25** | 1 | well-accelerated |
| `arithmetic` | 54 | 0 | **55** | worker-only — appropriate (cheap ops, WASM marshal would dominate) |
| `statistics` | 24 | 0 | 26 | worker-only |
| `trigonometry` | 20 | 0 | 21 | worker-only |
| `algebra` | 37 | 0 | 0 | **★★ pure JS — polynomial ops over many coefficients could WASM-route** |
| `cas` | 31 | 0 | 0 | symbolic — appropriate as JS (WASM doesn't help symbolic) |
| `combinatorics` | 21 | 0 | 0 | small-result ops; worker overhead would dominate. Appropriate as JS. |
| `integration` | 4 | 0 | 0 | **★★ `trapz` / `simpson` / `gaussQuad` / `romberg` over big integrands should worker-route** |
| `hypothesis` | 7 | 0 | 0 | **★ KS / Mann-Whitney / Shapiro-Wilk over big samples should worker-route** |
| `interpolation` | 6 | 0 | 0 | mixed — `cubicSpline` already partly WASM via `numeric.ts`'s `rbf_interp_wasm` |
| `bitwise` | 8 | 0 | 7 | worker-routed; WASM tier exists at the bridge level (`functions/src/wasm/bitwise/wasm-bridge.ts`, `WASM_BITWISE_THRESHOLD = 65,536`) but `typed/bitwise.ts` doesn't directly import it — dispatch is layered through `ComputePool` |
| `dist-objects` | 12 | 0 | 0 | distribution sampling — could batch-parallelize but each sample is tiny |
| `graph` | 8 | 0 | 0 | graph algorithms — appropriate as JS |
| `gpu` | 4 | 0 | 0 | already on WebGPU (separate dispatch tier) |
| `logical` | 6 | 0 | 0 | boolean ops — correctly skipped per the acceleration roadmap proposal |

### Open items in this class
- **`typed/algebra.ts` WASM routing for polynomial ops** — `polyadd`, `polymul`, `polynomialGCD`, `polynomialLCM`, `polynomialQuotient`, `polynomialRemainder`, `discriminant`, `resultant`. These are O(n²) over many coefficients and well-suited to WASM. Adding a `wasm.polyMulArray` etc. set to the Rust crate + the AS module would mirror the bitwise WASM-port pattern.
- **`typed/integration.ts` worker dispatch** — `gaussQuad` and `romberg` over many sub-intervals are embarrassingly parallel. `trapz` and `simpson` over big arrays similarly. ~50 LOC of `ComputePool` plumbing + benchmark to set the per-op threshold.
- **`typed/hypothesis.ts` worker dispatch** — `kolmogorovSmirnovTest`, `mannWhitneyTest`, `shapiroWilkTest`, `chiSquareTest` over big samples. Similar plumbing.

## C. Cross-cutting infrastructure gaps

### Tensor (`@danielsimonjr/mathts-tensor`)

| Item | Status |
|---|---|
| `tensorSvd` truncated tensor SVD | ✅ landed in `a21a844` (ITENSOR_PARITY Phase 2) |
| `tensorQr` / `tensorLU` / `tensorCholesky` / `tensorEig` | ✅ landed in `1bfad1e` (FUNCTION_GAPS Slice 3) |
| `tensorPinv` (Moore-Penrose pseudoinverse) | ⏳ pending — one-liner on top of `tensorSvd` |
| `tensorSolve(A, b)` (linear system on tensors with named indices) | ⏳ pending |
| `tensorKron` (Kronecker product) | ⏳ pending — comes up frequently in quantum / signal processing |
| `Tensor.slice / gather / scatter / concatenate / stack / pad / roll / flip` | ⏳ pending — NumPy/JAX-style indexing primitives |

### Autograd (`@danielsimonjr/mathts-autograd`)

| Item | Status |
|---|---|
| `TapedTensor.contract` + `TapedTensor.matmul` | ✅ landed in `4417836` (ITENSOR_PARITY Phase 5) |
| `TapedTensor` reductions (`sum`/`mean`/`max`/`min`/`prod`/`norm`) | ✅ landed in `1bfad1e` (FUNCTION_GAPS Slice 1) |
| `TapedTensor` elementwise math (`log`/`exp`/`sin`/`cos`/`tan`/`sqrt`/`square`/`pow`/`reciprocal`/`abs`) | ✅ landed in `1bfad1e` (FUNCTION_GAPS Slice 1) |
| `TapedTensor.divide` / `TapedTensor.sub` | ⏳ pending — `divide` adjoint mirrors `mul` minus; `sub` is the dual of `add` |
| `TapedTensor.tensordot` | ⏳ pending — adjoint follows from `contract`'s rule but the axis-pair plumbing is non-trivial |
| `TapedTensor.svd` / `eig` | ⏳ pending — decomposition adjoints have edge cases in the repeated-eigenvalue / singular-value case |
| `TapedTensor.pow(taped, taped)` (variable-exponent pow) | ⏳ pending — requires both inputs on tape |

### Parallel / ComputePool (`@danielsimonjr/mathts-parallel`)

| Item | Status |
|---|---|
| `ComputePool.subtract` exists; `ComputePool.divide` is missing | ⏳ asymmetry worth closing |
| `ComputePool` for `pow`, `sqrt`, `square`, `sign` (elementwise math beyond trig) | ⏳ pending |
| `ComputePool.tensordot` | ⏳ pending — would let Phase-6's `Tensor.tensordot` route through workers above threshold |

### Matrix (`@danielsimonjr/mathts-matrix`)

| Item | Status |
|---|---|
| Public `qr` primitive | ✅ existed; promoted to a re-export in `1bfad1e` (FUNCTION_GAPS Slice 3) |
| Public `lu` / `cholesky` primitives | ⏳ pending — currently inlined inside `tensor/src/operations/{lu,cholesky}.ts`. Promoting them to `matrix/src/operations/{lu,cholesky}.ts` is an internal de-duplication slice. |
| `matrixPinv` (pseudoinverse via SVD) | ⏳ pending |

### Benchmarks

| Item | Status |
|---|---|
| `bench:wasm` (Rust vs AS vs JS) | ✅ exists |
| `bench:parallel` (worker vs sequential break-even) | ✅ exists |
| `bench:tensor` (contract, contractNetwork, tensordot, decompositions) | ⏳ pending — would close the perf-measurement gap for the ITensor-parity surface |

## D. Sequencing recommendation

What's now done since this audit ran (2026-05-24): the three slices in `FUNCTION_GAPS.md` (TapedTensor reductions + elementwise AD; `typed/complex.ts` + `typed/set.ts` promotion; Tensor `qr` / `lu` / `cholesky` / `eig` wrappers) — all landed in commit `1bfad1e`.

What's left and ranked by leverage:

| Rank | Item | Class | Why it's next |
|---|---|---|---|
| 1 | `TapedTensor.divide` + `.sub` | C (autograd) | Smallest gap closes a symmetry asymmetry; trivial adjoints (`dA = dY / b`, `dB = -dY · A / b²` for divide; `dA = dY`, `dB = -dY` for sub). |
| 2 | `typed/relational.ts` (7 missing comparison ops) | A | Leaf-function promotion; no architectural risk; same pattern as `typed/complex.ts`. |
| 3 | `ComputePool.divide` | C (parallel) | One-line plumbing parity with `subtract`. |
| 4 | `tensorPinv` + `tensorSolve` + `tensorKron` | C (tensor) | Common ML/stats primitives; small impl on top of `tensorSvd`. |
| 5 | Promote `tensor/src/operations/{lu,cholesky}.ts` algorithms into `matrix/src/operations/` | C (matrix de-duplication) | Pure refactor; no behavioural change. |
| 6 | `bench:tensor` suite | C (benchmarks) | Closes the perf-measurement gap for the ITensor-parity surface so future regressions show up in CI. |
| 7 | `typed/algebra.ts` polynomial WASM ports | B | Substantial — Rust crate kernels + AS port + bridge + manifest regen. Worth doing once consumer pressure shows up. |
| 8 | `typed/integration.ts` worker dispatch | B | Worker-routing `gaussQuad` / `romberg`. Bench-then-decide pattern (per the existing `bench:parallel` discipline). |
| 9 | `typed/probability.ts` audit + selective promotion | A | First do the dedup audit against `distributions.ts`/`special.ts`; only promote what's genuinely missing. |
| 10 | `typed/hypothesis.ts` worker dispatch | B | Same pattern as integration. |
| 11 | `Tensor.slice` / `gather` / `stack` / `concatenate` family | C (tensor) | NumPy-style indexing primitives; bigger surface, lower leverage than the decompositions. |
| 12 | `TapedTensor.tensordot` / `svd` / `eig` | C (autograd) | Decomposition adjoints have edge cases; their own slice. |
| 13 | `typed/string.ts` | A | Formatter helpers; rounds out the mathjs API surface but no downstream consumer is blocking. |
| 14 | `typed/unit.ts` | A | Blocked on a `Unit` type landing in `core` first. |

## E. Out of scope (decided not to pursue)

These were considered and consciously not pursued (see [`docs/roadmap/ITENSOR_PARITY.md`](./ITENSOR_PARITY.md) §8 for the longer rationales):

- **MPS/MPO state representations** — physics-specific; belong in UPT or a sibling.
- **DMRG / TEBD / TDVP variational algorithms** — physics-specific.
- **Quantum-number block-sparse tensor storage** — UPT proposal §1.3 explicitly disclaims wanting this in MathTS.
- **Fermionic anticommutation / particle-conservation arithmetic** — physics-specific.
- **HDF5 I/O for tensors** — adds a runtime dependency for marginal browser-audience value.
- **Sparse-tensor decompositions** (COO / CSR-N etc.) — limited value for browser-first workloads; the matrix sparse path already covers most use cases.
- **Compile-time shape inference at the TS type level** — tried in `@tensorflow/tfjs` and abandoned; TypeScript's type system isn't expressive enough to be ergonomic.
- **`eigs` / `svd` / `singularValues` worker-dispatch parallelization** — re-validated 2026-05-23 with measured bench evidence; sequential JS-fallback stays. See `tools/benchmark/parallel/eig-inner-probe.ts` for the data.
- **`polyFit` / `leastSquares` worker-dispatch parallelization** — re-validated 2026-05-23 with measured bench evidence; sequential stays. See `tools/benchmark/parallel/regression-probe.ts`.
- **Unified f32 WebGPU path** — design spec written at [`docs/roadmap/UNIFIED_WEBGPU_PATH.md`](./UNIFIED_WEBGPU_PATH.md); separate research effort.

## F. How to use this document

When a new slice lands, update the corresponding row's Status column. When a new gap is discovered (e.g. CDG surfaces a category not in this audit), add it to the right class (A / B / C) and the sequencing table (D). When a gap is decided not-to-pursue, move it to class E with the rationale.

The "Status" column uses three states:
- **✅ landed in `<commit-sha>`** — done; cite the commit.
- **⏳ pending** — actionable; pin to a numbered row in section D for prioritisation.
- **Decided not to pursue** — move to section E with the rationale, do not leave in A/B/C.
