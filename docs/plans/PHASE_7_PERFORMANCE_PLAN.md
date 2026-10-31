# Plan: Phase 7 — runtime performance

**Status:** planning only. This file is the contract for the Phase 7 build PRs. It changes no runtime source.
**Goal:** faster code. Each build PR shows a real speedup on Node (V8) and on Bun (JavaScriptCore), no case more than 2% slower on either engine, bit-identical results (or a tolerance the section documents), and an unchanged public API and export lock.
**Tree measured:** `9dc97c56` (`refactor(functions): P6-11 GPU chain lifecycle consolidation (#542)`), which is `main` at the time of this plan.
**Engines:** Node v22.23.4 and Bun 1.4.2, on one 4-vCPU Linux VM.
**Clone ledger:** [`docs/roadmap/CLONES_REMAINING.md`](../roadmap/CLONES_REMAINING.md), regenerated with this plan by `repo-tools clones` 2.3.0: 533 near pairs and 9 exact groups. Phase 7 does not classify pairs. A clone merge is in this plan only when the merged code measured faster, and one PR (P7-10) qualifies.
**Out of scope:** the PR #536 Bun fix, which another agent is building.

## Summary

Thirteen PRs. P7-0 adds the base-against-head harness that every other PR uses as its gate. P7-1 to P7-10 each have a prototype on `9dc97c56` that was measured on both engines and gave bit-identical results; the prototypes were reverted and are not in this PR. P7-11 and P7-12 have no prototype yet: each is an estimate and is dropped if its gate fails.

The ratio is head time over base time for the headline case, so lower is faster (0.50 is twice as fast). "Combined" is the geometric mean of the two speedups and sets the order.

| PR    | Change                                                          | Package    | Headline case                | Node            | Bun             | Combined |
| ----- | --------------------------------------------------------------- | ---------- | ---------------------------- | --------------- | --------------- | -------: |
| P7-0  | Base-against-head benchmark harness                             | tools only | —                            | —               | —               |        — |
| P7-1  | `qr`: number path for dense Householder                         | functions  | `qr` 128×128                 | 0.025 (40×)     | 0.045 (22×)     |      30× |
| P7-2  | `prod`: number path for flat arrays                             | functions  | `prod` n = 10,000            | 0.044 (23×)     | 0.078 (13×)     |      17× |
| P7-3  | `factory_max` / `factory_min`: number path in `reduceExtreme`   | functions  | `factory_max` n = 10,000     | 0.053 (19×)     | 0.089 (11×)     |      15× |
| P7-4  | `lup` (and so `lusolve`): number path for dense LU              | functions  | `lusolve` 128×128            | 0.086 (12×)     | 0.108 (9.3×)    |      10× |
| P7-5  | `add` / `subtract` / `multiply` on plain arrays: number walker  | functions  | `add` number[] n = 1,000     | 0.070 (14×)     | 0.213 (4.7×)    |     8.2× |
| P7-6  | `max` / `min` on arrays: loop instead of spread                 | functions  | `max` kernel n = 1,000       | 0.168 (6.0×)    | 0.427 (2.3×)    |     3.7× |
| P7-7  | `median` / `quantileSeq` / `mad` / `partitionSelect`            | functions  | `median` n = 100,000         | 0.518 (1.9×)    | 0.467 (2.1×)    |     2.0× |
| P7-8  | `JSBackend.multiply`: flat storage reads                        | matrix     | 128×128                      | 0.519 (1.9×)    | 0.753 (1.3×)    |     1.6× |
| P7-9  | `sort`: number comparator, ascending and descending             | functions  | `sort` n = 100,000           | 0.729 (1.4×)    | 0.770 (1.3×)    |     1.3× |
| P7-10 | autograd batched matmul: one strided contraction                | autograd   | 1×128×96×112                 | 0.921 (1.09×)   | 0.650 (1.54×)   |     1.3× |
| P7-11 | `lsolve` / `usolve`: number path (no prototype)                 | functions  | `lusolve` 128×128 after P7-4 | about 0.75 est. | about 0.75 est. |        — |
| P7-12 | Element-wise factories via the `number` datatype (no prototype) | functions  | `dotMultiply` n = 1,000      | up to 0.1 est.  | up to 0.25 est. |        — |

Three numbers come from in-process prototypes rather than from the two-tree harness: P7-6 (the kernel), P7-8, and P7-10. Each PR measures its own change with P7-0 before it lands.

## How the numbers were measured

The harness that P7-0 will commit was prototyped for this survey.

- **Two trees, one process each.** Base is the `9dc97c56` build of every workspace package, copied (`package.json` plus `dist/`) into an isolated `node_modules` tree. Head is the same tree with the prototype rebuilt. A child process imports both, builds seeded inputs, checks that both return the same result (a deep `Object.is` walk, so `-0`, `0` and `NaN` are told apart), then times them alternately (A B B A) for 8 rounds after 5 warm-up batches of about 25 ms each. A `null` result or a throw fails the case.
- **Both import orders.** Every case runs in two fresh processes, base imported first and head imported first, and the table reports the geometric mean of the two ratios. Import order alone changed some ratios by a factor of two or more (`sort` n = 100 on Node: 0.974 base-first, 0.497 head-first; `qr` on a singular 24×24 on Bun: 0.233 and 0.036), because the third-party modules (typed-function above all) are one shared instance and the first tree's type feedback shapes the second.
- **Fresh process per case.** Running all cases in one process let earlier cases skew later ones: `det`, an untouched control, read 0.883.
- **Noise.** Alternating base against a second copy of base in the same process gives ±1–3%. Running two identical trees through the whole pipeline (an A/A' control) gave single-run geometric means from 0.953 to 1.021, so one run has a noise floor of about ±5%. The untouched controls in the tables below sit inside that band (`det` 1.021, `mode` 1.051 on Node). A 2× gain in one run is real; a ratio within 5% of 1.00 in one run is "no change measured". That is why P7-0 gates on the median of at least five runs.
- **Bun.** Bun reads the root `tsconfig.json` `paths`, which point at `src`, so head's `core` loaded from source and failed on `__PKG_VERSION__`. Each Bun child runs with `--tsconfig-override=tsconfig.base.json`.
- **The symbol a consumer imports.** Every case calls the public export (`F.qr`, `F.prod`, ...), following the AGENTS.md benchmarking rules. Public `eigs` takes `correctEigs` for numbers, and `norm(A, 2)` does not reach the Jacobi solver, so the Jacobi prototype is not planned (see [Not planned](#not-planned)).

## Survey

Timings are microseconds per call, Node then Bun. "Over a loop" divides the public call by a hand-written loop that computes the same thing without dispatch, so it bounds what any rewrite could win.

The survey ran many cases in one process per engine, so its absolute times differ from the harness times in the PR sections, which run each case in fresh processes. `qr` at 128×128 on Node took 279 ms here and 195 ms in the harness. Use the survey to rank hot spots and the PR tables for ratios. The gates use only ratios.

### Where the time goes

1. **Per-element typed dispatch inside generic walkers.** `functions` factories (`qr`, `lup`, `prod`, `median`, `sort`, ...) and the typed `add`/`subtract`/`multiply` array paths call a typed-function (`addScalar`, `compare`, `multiplyScalar`) for every element. Each call costs tens of nanoseconds. That cost is 90–97% of `qr` and `prod` at moderate sizes, and P7-1 to P7-5, P7-7 and P7-9 remove it.
2. **Startup.** Importing `functions` takes 400 ms on Node and 470 ms on Bun, about half of it building typed-functions. The cause is in the typed-function package, outside this repository (see [Leads without a design](#leads-without-a-design)).
3. **Sandbox and tokenizer.** In a loop of compiled evaluations, 46% of the profiled time is the sandbox check `isSafeProperty`. In a loop of `parse` calls, 63% is the tokenizer. Neither has a design yet.

### Plain arrays (`number[]`)

| Call                      | n       | Node µs | Bun µs | Over a loop, Node | Over a loop, Bun |
| ------------------------- | ------- | ------: | -----: | ----------------: | ---------------: |
| `add(number[], number[])` | 1,000   |    35.8 |   42.8 |             32.6× |            19.4× |
| `add(number[], number[])` | 100,000 |   6,956 |  3,808 |             22.8× |            17.7× |
| `max(number[])`           | 1,000   |    4.01 |   3.29 |              4.7× |             3.3× |
| `max(number[])`           | 100,000 |     991 |    361 |             11.9× |             3.8× |
| `sum(number[])`           | 100,000 |    82.4 |    135 |              1.6× |             1.5× |
| `median(number[])`        | 1,000   |     257 |    229 |                 — |                — |
| `median(number[])`        | 100,000 |  25,876 | 23,200 |                 — |                — |
| `prod(number[])`          | 10,000  |     185 |    342 |                 — |                — |
| `quantileSeq(a, 0.3)`     | 10,000  |   2,362 |  2,161 |                 — |                — |
| `mad(number[])`           | 10,000  |   5,578 |  5,521 |                 — |                — |

`sum` is pairwise and the loop is naive, so its ratio is an upper bound, not a target.

### Typed arrays (`Float64Array`)

| Call                    | n       | Node µs | Bun µs | Over a loop, Node | Over a loop, Bun |
| ----------------------- | ------- | ------: | -----: | ----------------: | ---------------: |
| `sqrt`                  | 1,000   |    3.87 |   2.45 |             1.40× |            1.28× |
| `exp`                   | 1,000   |    10.5 |   6.21 |             1.38× |            1.06× |
| `sin`                   | 1,000   |    7.44 |   8.71 |             1.46× |            1.59× |
| `add(F64, F64)`         | 1,000   |    4.01 |   2.09 |             1.72× |            2.21× |
| `multiply(F64, number)` | 1,000   |    2.62 |   1.44 |             1.30× |            1.72× |
| `sqrt`                  | 100,000 |     219 |    274 |             1.18× |            1.27× |
| `sin`                   | 100,000 |   1,427 |  1,131 |             1.27× |            1.01× |
| `add(F64, F64)`         | 100,000 |     243 |    144 |             1.57× |            1.43× |
| `multiply(F64, number)` | 100,000 |     113 |   71.3 |             1.00× |            0.89× |

The typed-array kernels sit within 1.0–1.7× of a bare loop (2.2× for `add` on Bun at n = 1,000). What is left is dispatch and the `async` wrapper around the worker-pool threshold check. Two generated shapes for these overloads were modelled, and neither passed the bar (see [Not planned](#not-planned)).

### Matrix and linear algebra

| Call                      | 8×8, Node / Bun | 32×32, Node / Bun | 128×128, Node / Bun |
| ------------------------- | --------------: | ----------------: | ------------------: |
| `F.qr`                    |      72.7 / 144 |     4,648 / 5,813 |   278,548 / 321,452 |
| `F.lup`                   |     13.0 / 19.9 |         707 / 839 |     38,995 / 47,368 |
| `F.lusolve`               |     24.3 / 29.3 |         786 / 945 |     40,262 / 44,664 |
| `F.multiply(number[][])`  |     4.38 / 1.67 |        111 / 50.5 |       6,320 / 2,352 |
| `F.add(number[][])`       |     2.73 / 3.17 |       38.5 / 46.9 |           613 / 659 |
| `F.det`                   |     6.38 / 1.10 |       34.1 / 22.2 |           988 / 728 |
| `F.inv`                   |     7.00 / 2.86 |       70.7 / 61.0 |       2,823 / 2,069 |
| `F.eigs` (symmetric)      |     7.53 / 5.47 |         249 / 178 |     12,709 / 10,196 |
| matrix `DenseMatrix` `lu` |    4.07 / 0.453 |       16.8 / 12.0 |           870 / 621 |
| matrix `DenseMatrix` `qr` |     4.82 / 1.28 |       93.2 / 65.9 |       5,653 / 3,917 |
| matrix `multiply`         |    2.81 / 0.647 |       51.0 / 27.8 |       3,165 / 1,753 |
| tensor `Tensor.matMul`    |    3.71 / 0.876 |      100.7 / 38.5 |       6,226 / 2,681 |

At 128×128, `F.qr` is 49× (Node) and 82× (Bun) slower than the matrix package's Float64Array `qr`, and `F.lup` is 45× and 76× slower than its `lu`. The matrix package runs a different algorithm with different rounding, so routing to it would change results. The factory keeps its algorithm and drops the dispatch (P7-1, P7-4).

### Expression parse and evaluate

| Call                                   | Node µs | Bun µs |
| -------------------------------------- | ------: | -----: |
| `parse("sqrt(3^2+4^2)")`               |    2.99 |   4.33 |
| `evaluate("sqrt(3^2+4^2)")`            |    3.83 |   4.01 |
| compiled `a*x^2 + b*x + c`, `evaluate` |   0.638 |  0.381 |
| compiled trig expression, `evaluate`   |   0.830 |  0.568 |
| `parse` of a 200-term sum              |     245 |    202 |
| `simplify("2*x + 3*x + x^2*x")`        |   1,153 |    979 |
| `derivative("x^3 + sin(x)*x")`         |   1,736 |  1,518 |

A compiled polynomial is 12× (Node) and 9.5× (Bun) slower than the same closure. A Node CPU profile of 2 million compiled evaluations puts 440 ms of the 964 ms sampled inside the evaluation loop (46%) in `isSafeProperty` (core `customs.ts`). A profile of 4,000 parses of the 200-term sum puts 474 ms of the 963 ms sampled inside the parse loop (49%) in `getToken` and 133 ms (14%) in `getTokenSkipNewline`. These shares, like the unit shares below, are self time over the time sampled inside the measured loop; the import before the loop and garbage collection, which the profiler does not attribute to a function, are outside them.

### Units and exact scale

| Call                           | Node µs | Bun µs |
| ------------------------------ | ------: | -----: |
| `Unit.parse("5 km/h")`         |    2.60 |   2.02 |
| `unit.to("m/s")`               |    1.13 |   0.92 |
| unit multiply                  |    0.38 |   0.49 |
| `F.unit("5 kg")`               |    2.01 |   2.34 |
| `new Unit(x, "psi")`           |    2.71 |   2.26 |
| psi to Pa, `toNumeric`         |    3.79 |   3.44 |
| `kg*m/s^2` to lbf, `toNumeric` |    4.23 |   4.52 |

A Node profile of 400,000 constructions and conversions (3.74 µs each; 1,421 ms sampled inside the loop) splits self time as: exact-scale arithmetic 39% (`roundExactScale` 12%, `gcd` 11%, `rationalToNumber` 4%, `divideExactScales` 3%, `make` 3%, the rest under 2% each), `normalizeUnitSpellings` 15%, `Unit.parse` 11%, `memoized` 7%, `Unit.exactScale` 7%. One candidate was measured, the `gcd` swap without array destructuring. It is not planned because Node did not get faster (see [Not planned](#not-planned)).

### Scalars and allocation

| Call                      | Node µs | Bun µs |
| ------------------------- | ------: | -----: |
| `add(number, number)`     |   0.086 |  0.074 |
| `add(Complex, Complex)`   |   0.207 |  0.116 |
| `add(Fraction, Fraction)` |   0.330 |  0.378 |
| `Complex.mul`             |   0.058 |  0.035 |
| `Fraction.add`            |   0.127 |  0.232 |
| `BigNumber.add`           |   0.106 |  0.111 |
| `BigNumber.div`           |   0.866 |  0.844 |
| `BigNumber.sqrt`          |    22.0 |   22.0 |
| `bignumber("1.2345")`     |   0.202 |  0.129 |

A scalar typed call costs tens of nanoseconds: `add(number, number)` took 86 ns (Node) and 74 ns (Bun) in this survey and 20 ns and 10 ns in the harness's fresh processes. The PRs above remove that cost from loops; a single scalar call keeps it. `BigNumber.sqrt` is 25× a division on both engines (core's own BigNumber; not profiled).

### Autograd and tensor

| Call                                  | Node µs | Bun µs |
| ------------------------------------- | ------: | -----: |
| `Tensor.add`, n = 1,000               |    2.28 |   1.11 |
| `grad(sum(x*x))`, n = 1,000           |    22.9 |   12.5 |
| `grad(sum(exp(sin(x)*x)))`, n = 1,000 |    45.9 |   32.1 |

### Startup

Cold `import` of each package's `dist`, median of 9 fresh processes:

| Package                           | Node ms | Bun ms |
| --------------------------------- | ------: | -----: |
| core                              |      20 |     22 |
| expression                        |      22 |     25 |
| parallel                          |      30 |     29 |
| matrix                            |      65 |     91 |
| tensor                            |      67 |     92 |
| autograd                          |      69 |     93 |
| functions                         |     400 |    470 |
| compat                            |     393 |    477 |
| statistics (re-exports functions) |     390 |    480 |
| compat plus `create(all)`         |     414 |    481 |
| functions plus first `evaluate`   |     399 |    488 |

Building typed-functions is about 225 ms of a 460 ms Node profile of the `functions` import, plus garbage collection. The typed-function package (`@danielsimonjr/typed-function@5.0.0-alpha.4`, from npm) expands conversions combinatorially: one `number, number, number, number` signature takes 11.4 ms to build on Node and 7.8 ms on Bun. The 21 exports with three or more `number` parameters cost about 126 ms (Node) and 122 ms (Bun); the eight with four, among them `carlsonRJ`, `range` and the `parallelStat*` family, cost about 107 ms of that. The matrix import spends 22.7 ms in typed-function and 18 ms compiling its 190 KB bundle.

## Pull requests

P7-0 lands first, because every other PR gates on it. After that each PR branches from `main`, is mergeable alone, and lands on its own; they do not stack. P7-5 and P7-6 edit different parts of `functions/src/typed/arithmetic.ts`, and whichever lands later rebases. P7-11 assumes P7-4 is merged, because it measures the part of `lusolve` that P7-4 leaves. The recommended order is the table order.

Every build PR (P7-1 to P7-12) follows these rules.

- **Pins first.** The first commit adds the pinning tests the section names and passes against the old code. The optimization follows in a later commit, and the pins stay green unchanged.
- **Same numbers.** Results stay bit-identical unless the section says otherwise. The argument is always the same: the number path calls the implementation that typed dispatch already selects for numbers, resolved once with `typed.find(fn, ['number', 'number'])`. That implementation carries the configured tolerances (`compare`, `larger`, `equalScalar` and `isZero` use `nearlyEqual` inside it) and any user override of the factory's dependency.
- **Same API.** Public names, signatures, and typed signatures stay. No export is added or removed. `node tools/test/check-export-lock.mjs` passes unchanged.
- **Benchmark.** The PR adds or extends a case file under `tools/benchmark/ab/cases/` and pastes the P7-0 report for both engines into the description. Each section lists its `gain` cases (median of at least 5 runs at or below 0.95 on both engines) and its `neutral` cases (median at or below 1.02 on both engines). Every case must be bit-identical.
- **Changesets.** One patch changeset for each published package the PR changes. Do not edit `package.json` `"version"` by hand.
- **Gates.** `bun run typecheck` (0 errors), `bun run lint`, the section's tests, `node tools/test/check-export-lock.mjs`, and, after `bun run build`, `node tools/test/check-bundle-budget.mjs`. When the budget reports drift this PR caused, refresh it with `--write` and commit the file in the same PR.
- **Architecture docs.** The added lines move `totalLinesOfCode` (and a new file moves `totalTypeScriptFiles`), which the Verification tables in `docs/Architecture/` claim. Regenerate the values with `repo-tools map . --out=<tmp>` at the CI pin 2.2.4, update the tables, and run `repo-tools check . --docs=docs/Architecture` before pushing, as the Phase 6 PRs did.
- **Pre-commit.** When a package `src/` file is staged, the hook runs `docs:deps` and `docs:functions`, and `docs:functions` refuses a stale `dist`, so build the changed package before committing. Commit what the hook regenerates. Do not use `--no-verify`.
- **Clone report.** A number path is a near copy of the generic loop on purpose, and `repo-tools clones` may list it as a new pair. Note any new pair in the PR description. It is an intentional copy: the generic code stays for every other type.

### P7-0 — base-against-head benchmark harness

**Package:** none published. **Files:** `tools/benchmark/ab/` (new): `make-base.mjs`, `run.mjs`, `child.mjs`, `same.mjs`, and `cases/*.mjs`; a root script `bench:ab`; `tools/test/ab-harness.test.mjs`.

**Why a new harness.** The Phase 6 gates (`tools/benchmark/core/complex-tan-family.bench.mjs`, `tools/benchmark/workerpool/run-parallel-envelope.bench.mjs`) compare against an old copy of one file or one package built by hand. That does not work for `functions`. Two `functions` builds cannot share a process through one set of workspace packages: the second `expression` calls `addConversion` on core's typed instance and throws `There is already a conversion from string to Node`. Every Phase 7 gate needs base against head on the public symbol, across packages, on two engines.

**Base tree.** `make-base.mjs --ref <ref>` (default: the merge base of `HEAD` and `origin/main`) runs `git worktree add` into the OS temp directory, then `bun install --frozen-lockfile` and `bun run build` there. It copies each workspace package's `package.json` and `dist/` to `node_modules/.perf-base/node_modules/@danielsimonjr/<name>/` and writes the ref to `node_modules/.perf-base/REF`. Module resolution from a base file finds the base workspace packages first and the third-party packages in the repo's own `node_modules` after them. Everything sits under the ignored `node_modules`, so nothing is committed. `--control` writes a second copy of the same build to `node_modules/.perf-base-control/` for the A/A' run. The worktree is removed afterwards.

**Cases.** A case file exports `{ entry, cases }`. `entry` is the package to import, for example `@danielsimonjr/mathts-functions`. Each case is `{ name, kind: 'gain' | 'neutral', make(ns) }`, where `make` builds seeded inputs (mulberry32) from the imported namespace and returns the thunk to time; an optional `compare(a, b)` replaces the default equality.

**Runner.** For each case, each engine, each of R runs (default 5), and both import orders, `run.mjs` spawns a fresh `child.mjs` (`node`, or `bun --tsconfig-override=tsconfig.base.json`). The child:

1. imports both trees in the given order;
2. builds the inputs, runs each thunk once, and compares the results with a deep `Object.is` walk over arrays, typed arrays, `valueOf()`, and own non-function properties. A difference, a `null` or `undefined` result, or a throw fails the case;
3. calibrates a batch to about 25 ms, warms 5 batches of each side, times 8 A B B A rounds, and reports the median per-call time of each side and an in-process A/A (base against a second base thunk).

**Single-tree mode.** When a case's two import orders differ by more than 20% (|ln(base-first / head-first)| > 0.18), co-loading biases it. The runner then also times the case with each tree alone in its own process, alternating base and head processes over at least 10 processes per side, and the gate takes the higher of the two estimates.

**Report and gate.** Per case and engine: the median over runs of the per-run geometric mean, the min–max, the A/A, and the equality result, as a markdown table for the PR description (`--json` writes raw results). Exit code 1 when:

- a case differs or fails;
- a case's median is above 1.02, still above 1.02 when rerun with R = 9;
- a `gain` case's median is above 0.95 on either engine;
- in a `--control` session, any case's A/A' median is outside ±2%. The machine is too noisy for a 2% gate, so rerun elsewhere.

The runner refuses to start when a head package's `src/` is newer than its `dist/`, reusing the docs dist-freshness preflight, because a stale head times the wrong code.

**Committed cases.** The survey's case sets, so later PRs extend rather than rewrite them: `decomp.mjs` (`qr`, `lup`, `lusolve` at 2, 8, 32 and 128, rectangular, singular, and edge values, with `det` as the control), `elementwise.mjs`, `stats.mjs`, `extreme.mjs`, `matmul.mjs` (matrix package), and `autograd.mjs`.

**Pins first** (`tools/test/ab-harness.test.mjs`, `node:test`): `same()` on `-0`/`0`, `NaN`, nested arrays, `Float64Array`, a DenseMatrix-like `valueOf`, and `{ L, U, p }` objects; the geometric mean, median, and gate decisions on synthetic run results, including the single-tree trigger. A Compile & Lint step runs it, next to the other `node --test` tool tests; update that paragraph in `CLAUDE.md` in the same PR.

**Docs.** Add the harness to the AGENTS.md benchmarking rules as the way to gate a speed claim, with the import-order and fresh-process findings above.

**Exit criteria.** On this VM, a `--control` session over the committed cases gives every A/A' median within ±2% on both engines. A scratch head whose `prod` does about 5% extra work (not committed) fails the gate, and an unchanged head passes it.

### P7-1 — `qr`: number path for dense Householder

**Package:** `functions`. **File:** `functions/src/algebra/decomposition/qr.ts`. **Public calls that get faster:** `qr` on `number[][]` and on number `DenseMatrix`.

`_denseQRimpl` runs Householder reflections whose O(n³) inner loops call `addScalar`, `multiplyScalar`, `subtractScalar`, `divideScalar` and `conj` per element. A new module-private `_denseQRNumber(Rdata, Qdata, w, rows, cols, ops)` holds the number version of the step loop. `ops` is `{ add, mul, sub, div, conj }`, each resolved once with `typed.find(<dependency>, ['number', 'number'])` (`['number']` for `conj`) and cached per factory instance. The cache is a `let` declared above the factory's `return`, because a declaration after it is in its temporal dead zone when the typed-function first runs. A failed `find` caches `null`, and then only the generic path runs.

`_denseQRimpl` calls it only when every entry of R and Q is a number (a `typeof` scan). Per step, the O(n) scalar work (`sign`, `sqrt`, `isZero`, `unaryMinus`, the `u1` and `tau` divisions) keeps the same typed calls, so those values are the ones base computes. The step proceeds only when `tau`, `conjSgn` and `u1` are numbers: `sqrt(NaN)` returns a Complex, after which the step no longer fits the number path. `_denseQRNumber` returns the index of the first step it did not finish, and the generic loop resumes there, recomputing that step from its start. Steps are deterministic, so the recomputed step equals base. The generic loop is unchanged apart from its start index.

The prototype put these branches inside `_denseQRimpl`, and the Complex fallback measured 1.050 on Bun. The separate function is the fix, and the fallback is a gate case.

**Public API and export lock:** unchanged. The typed signatures `DenseMatrix`, `SparseMatrix` and `Array` stay.

**Risk.** A Complex or Fraction entry anywhere must keep the whole matrix on the generic path, and the resume step must be the first unfinished one, or R and Q differ in the last bits. `qr` on Fraction input already throws on both engines before this change (see [Observations](#observations)); the PR must not change that error.

**Pins first:** golden Q and R (bit-exact, via `Object.is`) for 8×8, 20×60 and 60×20 random matrices; a matrix with `NaN`, `0`, `-0` and `Infinity` entries; a rank-deficient 24×24; a matrix whose step 3 meets a `NaN` (the resume path); a Complex 8×8; a 2×2.

**Benchmark** (prototype, both import orders, one run):

| Case                        | Kind    |  Node |   Bun |
| --------------------------- | ------- | ----: | ----: |
| `qr` 2×2                    | gain    | 0.482 | 0.474 |
| `qr` 8×8                    | gain    | 0.109 | 0.131 |
| `qr` 32×32                  | gain    | 0.032 | 0.060 |
| `qr` 128×128                | gain    | 0.025 | 0.045 |
| `qr` 60×20                  | gain    | 0.034 | 0.041 |
| `qr` 20×60                  | gain    | 0.050 | 0.059 |
| `qr` edge values 16×16      | gain    | 0.065 | 0.150 |
| `qr` singular 24×24         | gain    | 0.049 | 0.092 |
| `qr` DenseMatrix 32×32      | gain    | 0.033 | 0.050 |
| `qr` Complex 8×8 (fallback) | neutral | 0.992 | 1.050 |
| `det` 128×128 (control)     | neutral | 1.021 | 1.010 |

The Bun singular row's import orders gave 0.233 and 0.036, so it is a single-tree-mode case; both orders are gains.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/gap-qr-parity.test.ts tests/gap-factory-decomposition-oracle.test.ts tests/gap-decomposition-oracles.test.ts tests/property-invariants.test.ts tests/typed-matrix-ops.test.ts <new pin file>
```

**Expected gain:** 22–40× at 128×128, 17–31× at 32×32, 7.6–9× at 8×8, about 2× at 2×2.

### P7-2 — `prod`: number path for flat arrays

**Package:** `functions`. **File:** `functions/src/statistics/prod.ts`. **Public calls that get faster:** `prod(number[])`.

`_prod` folds with `deepForEach` and calls `multiplyScalar` per element, after a string check per element. A new `_prodNumber(array, mul)` runs when the input is a plain `Array` (`constructor === Array`, which keeps subclasses and array-likes on the generic path), it is not empty, and a `typeof` scan finds only numbers. It starts from `array[0]` (base takes the first value as it is, without a multiplication) and folds `mul(p, array[i])` from index 1. `mul` is `typed.find(multiplyScalar, ['number', 'number'])`, cached as in P7-1. Nested arrays, strings, an empty array (base throws `Cannot calculate prod of an empty array`), and `prod(array, dim)` stay on their current paths.

The scan runs before any multiplication, so an array with a non-number late in it costs only the scan before the generic fold. The prototype folded and checked in one loop and still measured neutral on that case; scanning first keeps it so.

**Public API and export lock:** unchanged.

**Pins first:** `prod` of a seeded n = 10,000 array (bit-exact); one element; a `-0` element; `NaN`; `Infinity` times `0`; an array whose last element is a Fraction; an array of numeric strings; a 2-D array; `prod(A, 1)`; the empty-array error.

**Benchmark** (prototype):

| Case                                | Kind    |  Node |   Bun |
| ----------------------------------- | ------- | ----: | ----: |
| `prod` n = 10                       | gain    | 0.111 | 0.114 |
| `prod` n = 10,000                   | gain    | 0.044 | 0.078 |
| `prod` BigNumber n = 200 (fallback) | neutral | 1.000 | 0.989 |
| `prod` Fraction last (fallback)     | neutral | 0.997 | 1.015 |

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/statistics/prod-dim.test.ts tests/cov-statistics.test.ts tests/public-api-smoke.test.ts tests/typed-matrix-ops.test.ts tests/tier-parity-registry.test.ts <new pin file>
```

**Expected gain:** 13–23× at n = 10,000, about 9× at n = 10.

### P7-3 — `factory_max` / `factory_min`: number path in `reduceExtreme`

**Package:** `functions`. **Files:** `functions/src/statistics/extreme.ts`, `max.ts`, `min.ts`. **Public calls that get faster:** `factory_max(number[])` and `factory_min(number[])` (the factory exports; the typed `max`/`min` are P7-6).

`reduceExtreme` walks with `deepForEach` and calls the typed `isNaN` and the typed `larger` (or `smaller`) per element. `max.ts` and `min.ts` each resolve `{ nan, cmp }` once, with `typed.find(isNaN, ['number'])` and `typed.find(larger, ['number', 'number'])` (`smaller` for `min`), cache them per factory instance, and pass them to `reduceExtreme` in `deps`. For a plain `Array` whose `typeof` scan finds only numbers, a new `_reduceExtremeNumber(array, nan, cmp)` runs the base rule unchanged: a NaN replaces the result; otherwise the first value, or any value for which `cmp(value, result)` is true, replaces it. An empty array keeps the base error message.

The prototype folded and type-checked in one loop and threw its partial work away at the first non-number. That cost 5.3% (Node) and 6.0% (Bun) on an array with a Fraction at index 150 of 200. Scanning first reduces that case to a `typeof` walk.

**Public API and export lock:** unchanged.

**Pins first:** `factory_max` and `factory_min` of seeded arrays; `NaN` at the start, middle, and end; `[-0, 0]` and `[0, -0]` for both; values within `config.relTol` of each other (the tolerance lives in `larger`); a Fraction last; BigNumber; a numeric string (the `numeric` conversion of a string result); a 2-D array; a DenseMatrix; the empty-array error.

**Benchmark** (prototype, measured for this plan):

| Case                                       | Kind    |  Node |   Bun |
| ------------------------------------------ | ------- | ----: | ----: |
| `factory_max` n = 10                       | gain    | 0.270 | 0.270 |
| `factory_min` n = 10                       | gain    | 0.169 | 0.163 |
| `factory_max` n = 1,000                    | gain    | 0.051 | 0.076 |
| `factory_min` n = 1,000                    | gain    | 0.051 | 0.058 |
| `factory_max` n = 10,000                   | gain    | 0.053 | 0.089 |
| `factory_min` n = 10,000                   | gain    | 0.051 | 0.054 |
| `factory_max` with NaN, n = 10,000         | gain    | 0.048 | 0.129 |
| `factory_min` with ±0, n = 10,000          | gain    | 0.052 | 0.090 |
| `factory_max` 2-D 100×100 (generic)        | neutral | 1.015 | 0.743 |
| `factory_max` DenseMatrix 10,000 (generic) | neutral | 0.992 | 1.027 |
| `factory_max` BigNumber n = 200 (fallback) | neutral | 0.971 | 1.033 |
| `factory_max` Fraction at 150 (fallback)   | neutral | 1.053 | 1.060 |
| `mode` n = 10,000 (control)                | neutral | 0.995 | 0.953 |

The two fallback rows are the in-loop prototype and must reach 1.02 with the scan-first design. The Bun 2-D row is an import-order artifact (0.545 base-first, 1.012 head-first) and is a single-tree-mode case.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/factories-tier4.test.ts tests/s2r-clones-batch4-oracle.test.ts <new pin file>
```

**Expected gain:** 11–21× at n = 1,000 and above (7.8× on Bun with a NaN), 3.7–6× at n = 10.

### P7-4 — `lup` (and so `lusolve`): number path for dense LU

**Package:** `functions`. **File:** `functions/src/algebra/decomposition/lup.ts`. **Public calls that get faster:** `lup` and `lusolve` on number `number[][]` and `DenseMatrix`.

`_denseLUP`'s column loop calls `addScalar`, `multiplyScalar`, `subtractScalar`, `abs`, `larger`, `equalScalar` and `divideScalar` per element. A new `_denseLUPNumber(data, rows, columns, p, ops)` holds the same loop with the implementations found once (cached as in P7-1). `_denseLUP` calls it when a `typeof` scan of the cloned data finds only numbers; otherwise the existing loop runs unchanged. The L/U split after the loop is shared. In the number loop, the row swap of `p` uses a temporary, not the base's `p[j] = [p[pi], (p[pi] = p[j])][0]`, which allocates an array per swap and is slow on JavaScriptCore; both leave the same `p`. The pivot test keeps the typed `larger` (tolerance included), and the zero test keeps `equalScalar`, through their found number implementations. `SparseMatrix` input keeps its own algorithm.

**Public API and export lock:** unchanged.

**Risk.** Pivot choice is where a different comparison would show. `larger(absv, pabsv)` with the configured tolerance must be the comparison, not `>`.

**Pins first:** golden L, U and p (bit-exact) for random 8×8, 60×20 and 20×60; a matrix needing row swaps at every step; two columns whose candidate pivots are within `relTol` of each other; a singular 24×24; `NaN`, `-0` and `Infinity` entries; BigNumber 8×8; `lusolve` with a vector and with a matrix right-hand side.

**Benchmark** (prototype):

| Case                           | Kind    |  Node |   Bun |
| ------------------------------ | ------- | ----: | ----: |
| `lup` 2×2                      | gain    | 0.608 | 0.731 |
| `lup` 8×8                      | gain    | 0.266 | 0.466 |
| `lup` 32×32                    | gain    | 0.098 | 0.282 |
| `lup` 128×128                  | gain    | 0.062 | 0.211 |
| `lup` 60×20                    | gain    | 0.123 | 0.204 |
| `lup` 20×60                    | gain    | 0.086 | 0.251 |
| `lup` edge values 16×16        | gain    | 0.150 | 0.318 |
| `lup` singular 24×24           | gain    | 0.116 | 0.267 |
| `lup` DenseMatrix 32×32        | gain    | 0.097 | 0.292 |
| `lusolve` 8×8                  | gain    | 0.483 | 0.481 |
| `lusolve` 128×128              | gain    | 0.086 | 0.108 |
| `lup` BigNumber 8×8 (fallback) | neutral | 1.004 | 1.015 |
| `det` 128×128 (control)        | neutral | 1.021 | 1.010 |

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/factories-final.test.ts tests/gap-factory-decomposition-oracle.test.ts <new pin file>
```

**Expected gain:** `lup` 4.7–16× at 128×128 and 2–4× at 8×8; `lusolve` 9–12× at 128×128 and about 2× at 8×8.

### P7-5 — `add` / `subtract` / `multiply` on plain arrays: number walker

**Package:** `functions`. **File:** `functions/src/typed/arithmetic.ts`. **Public calls that get faster:** `add` and `subtract` with `(Array, Array)`, `(Array, number)` and `(number, Array)`; `multiply` with `(Array, number)` and `(number, Array)`; and the `DenseMatrix` and `SparseMatrix` signatures of all three that go through `elementwiseMatrix`.

`elementwise(op, a, b)` recurses through nested arrays and calls the typed `add` (or `subtract`, `multiply`) at every leaf. A new `elementwiseNumber(op, a, b)` resolves the operator's `number, number` implementation once with `mathTyped.find` (a lazy, cached getter on `addOp`, `subOp` and `mulOp`) and walks:

- two plain arrays of equal length: recurse into the rows when the first element is an array; otherwise, when a `typeof` scan of both finds only numbers, fill a preallocated `new Array(n)` with `f(a[i], b[i])`;
- an array and a number: the same, with the scalar on the side it came from;
- anything else at a level (a non-number leaf, unequal lengths, an empty array, an array that is not a plain `Array`): that level goes to the existing `elementwise`, which is unchanged.

The signatures listed above call `elementwiseNumber` instead of `elementwise`. Holes read as `undefined`, fail the scan, and keep the generic path, so a sparse array behaves as today.

Three shapes were measured before this one. A fast leaf inside `elementwise` made the BigNumber path 4.3% slower, so the number walker is a separate function and `elementwise` keeps its body. A per-element type check with `push` was half as fast on Bun as a scan followed by a tight loop into a preallocated array, which is the shape above.

**Public API and export lock:** unchanged; the typed signatures keep their names.

**Risk.** Broadcasting rules must match `elementwise` exactly: an array against a scalar on either side, nested depth, and the length-mismatch error, which must come from the same place with the same message.

**Pins first:** `add`, `subtract` and `multiply` on 1-D, 2-D and 3-D number arrays (bit-exact); scalar on the left and on the right; `NaN`, `-0`, `±Infinity`; a mixed number/Complex array; BigNumber and Fraction arrays; a length mismatch (same error); an empty array; an array with a hole; a `Float64Array` (its own signature, untouched); `DenseMatrix` and `SparseMatrix` operands (storage type of the result).

**Benchmark** (prototype, final shape):

| Case                                   | Kind    |  Node |   Bun |
| -------------------------------------- | ------- | ----: | ----: |
| `add` number[] n = 1                   | gain    | 0.326 | 0.678 |
| `add` number[] n = 10                  | gain    | 0.171 | 0.393 |
| `add` number[] n = 1,000               | gain    | 0.070 | 0.213 |
| `add` number[] n = 100,000             | gain    | 0.153 | 0.176 |
| `subtract` number[] n = 1,000          | gain    | 0.070 | 0.186 |
| `multiply(number[], number)` n = 1,000 | gain    | 0.044 | 0.076 |
| `add(number, number[])` n = 1,000      | gain    | 0.061 | 0.194 |
| `subtract(number[], number)` n = 1,000 | gain    | 0.059 | 0.133 |
| `add` edge values n = 1,000            | gain    | 0.071 | 0.230 |
| `add` number[][] 128×128               | gain    | 0.145 | 0.317 |
| `multiply(number[][], number)` 128×128 | gain    | 0.077 | 0.074 |
| `add` DenseMatrix 128×128              | gain    | 0.497 | 0.150 |
| `add` mixed Complex n = 100 (fallback) | neutral | 1.011 | 1.006 |
| `add` BigNumber n = 100 (fallback)     | neutral | 0.970 | 1.108 |
| `dotMultiply` n = 1,000 (control)      | neutral | 1.004 | 1.006 |
| `add(number, number)` (control)        | neutral | 0.977 | 0.992 |

The Bun BigNumber row varied by ±4–9% between runs, and its A/A' control read 0.964. Its two import orders gave 0.992 and 1.237, so it is a single-tree-mode case, and the PR must show its median at 1.02 or below.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/typed-arithmetic.test.ts tests/typed-arithmetic-elementwise.test.ts tests/arithmetic-extended.test.ts tests/cov-arithmetic.test.ts tests/dedup-bucketC-arithmetic-equivalence.test.ts tests/parallel-arithmetic.test.ts <new pin file>
```

**Expected gain:** 4.3–23× at n = 1,000, 5.7–6.5× at n = 100,000, 3–14× on 128×128 nested arrays, 2–7× on `DenseMatrix`, 1.5–3× at n = 1.

### P7-6 — `max` / `min` on arrays: loop instead of spread

**Package:** `functions`. **File:** `functions/src/typed/arithmetic.ts`. **Public calls that get faster:** `max(Array)` and `min(Array)` (the typed exports).

The `Array` signatures are `Math.max(...arr)` and `Math.min(...arr)`. They become a loop: `let m = -Infinity; for (...) m = Math.max(m, arr[i]); return m;`, and the same with `Infinity` and `Math.min`. Both forms convert every element with `ToNumber` once, in index order, and return `NaN` when any element is `NaN`; `Math.max` prefers `+0` over `-0` in either form; an empty array gives `-Infinity` (or `Infinity`) in both. A plain array reads the same values through its iterator and through its indices.

**Behaviour change.** On Node, the spread throws `RangeError: Maximum call stack size exceeded` for large arrays: `max` and `min` of 500,000 numbers throw today (Bun returns the value). The loop returns the value. This is the only change in observable behaviour in this plan, and the changeset says so.

**Public API and export lock:** unchanged.

**Pins first:** seeded arrays; `[-0, 0]`, `[0, -0]`, `[-0]`; `NaN` first, middle, last; the empty array; numeric strings and booleans (coerced as before); a `bigint` element (same `TypeError`); n = 500,000 (returns on both engines).

**Benchmark** (in-process kernel prototype: the spread against the loop, both without dispatch; the PR measures the public call with P7-0):

| Case                  | Kind |  Node |   Bun |
| --------------------- | ---- | ----: | ----: |
| kernel n = 10         | gain | 0.283 | 0.344 |
| kernel n = 1,000      | gain | 0.168 | 0.427 |
| kernel n = 100,000    | gain | 0.078 | 0.411 |
| `[-0, 0, -0]`, `max`  | gain | 0.195 | 0.223 |
| `[-0, 0, -0]`, `min`  | gain | 0.198 | 0.197 |
| 100 values with a NaN | gain | 0.216 | 0.420 |

The typed dispatch of `max(arr)` (about 0.05 µs) stays, so at n = 10 the public call gains less than the kernel row.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/typed-arithmetic.test.ts tests/dedup-bucketC-arithmetic-equivalence.test.ts tests/parallel-arithmetic.test.ts <new pin file>
```

**Expected gain:** 2.3–6× at n = 1,000, 2.4–13× at n = 100,000; large arrays stop throwing on Node.

### P7-7 — `median` / `quantileSeq` / `mad` / `partitionSelect`: number comparator

**Package:** `functions`. **Files:** `functions/src/matrix/partitionSelect.ts`, `functions/src/statistics/median.ts`. **Public calls that get faster:** `partitionSelect`, `median`, and through them `quantileSeq` and `mad`.

`quickSelect` first scans for NaN with the typed `isNumeric` and `isNaN` per element, then partitions with the typed `compare`. When the comparator is the ascending one and a `typeof` scan finds only numbers, a new `quickSelectNumber(arr, k, cmp)` runs instead. The scan also returns the first `NaN` it meets (`v !== v`), as base does, so the NaN check costs no second pass. `cmp` is `typed.find(compare, ['number', 'number'])`, cached per factory instance. The partition loop is the base loop with `cmp` in place of `compare`, and the pivot is drawn with the same `Math.random()` expression at the same point. `median`'s even-length pass (the largest value left of the middle) uses the same `cmp` when the left part is all numbers.

**Risk.** `partitionSelect` reorders its input in place, and the order depends on the pivots. The number path must draw `Math.random()` the same number of times, in the same order, as base, or the caller's array ends in a different order. The prototype's NaN scan was a separate loop, and `median` with a NaN measured 1.097 on Bun (noisy: A/A ±0.18); folding the check into the type scan is the fix, and that row is a gate case.

**Public API and export lock:** unchanged.

**Pins first:** with `Math.random` stubbed to a fixed sequence, the in-place order of the input after `partitionSelect` for seeded arrays and several `k`; `median` of odd and even lengths, with `NaN`, with `-0`/`0`; `quantileSeq` at 0, 0.3 and 1, sorted and unsorted; `mad`; BigNumber and Fraction inputs; descending `partitionSelect` (unchanged path).

**Benchmark** (prototype):

| Case                                  | Kind    |  Node |   Bun |
| ------------------------------------- | ------- | ----: | ----: |
| `median` n = 11                       | gain    | 0.558 | 0.557 |
| `median` n = 1,000                    | gain    | 0.524 | 0.366 |
| `median` n = 1,001                    | gain    | 0.552 | 0.584 |
| `median` n = 100,000                  | gain    | 0.518 | 0.467 |
| `quantileSeq(a, 0.3)` n = 10,000      | gain    | 0.556 | 0.491 |
| `mad` n = 10,000                      | gain    | 0.564 | 0.571 |
| `partitionSelect` n = 1,000           | gain    | 0.518 | 0.328 |
| `median` with NaN n = 10,000          | gain    | 0.625 | 1.097 |
| `median` BigNumber n = 200 (fallback) | neutral | 1.030 | 0.971 |
| `mode` n = 10,000 (control)           | neutral | 1.051 | 0.998 |

The Node BigNumber row (A/A ±0.064) and the Node `mode` control are inside the single-run noise; the PR's five-run median decides them.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/cov-statistics.test.ts tests/statistics-extended2.test.ts tests/gap-stats-completeness.test.ts tests/bignumber-operations.test.ts tests/gap-quantile-modes-oracle.test.ts tests/mad-median-vs-mean-ad.test.ts tests/factories-tier4.test.ts tests/factories-final.test.ts <new pin file>
```

**Expected gain:** 1.7–2.7× on `median`, `quantileSeq` and `mad`; 1.9–3× on `partitionSelect`.

### P7-8 — `JSBackend.multiply`: flat storage reads

**Package:** `matrix`. **Files:** `matrix/src/backends/JSBackend.ts`, `matrix/src/types/DenseMatrix.ts`. **Public calls that get faster:** `F.multiply(number[][], number[][])` and `F.multiply(DenseMatrix, DenseMatrix)` (both go through `backendManager.multiply`), `backendManager.multiply` when it picks JS (WASM not loaded, or below its threshold), and `jsBackend.multiply`.

The i-p-j loop calls `a.get(i, p)` and `b.get(p, j)`, each bounds-checked, per multiply-add. The new loop reads both operands' row-major `Float64Array` storage directly, in the same i-p-j order, accumulating with `+=` into the same zeroed result. Every product and sum happens in the same order, so the result is bit-identical, including `0 × Infinity` and `NaN`, which the loop does not skip. The storage is private, so `DenseMatrix.ts` adds a module-level accessor that returns `data` for a contiguous matrix (no view, offset 0, row stride equal to the column count) and a row-major copy otherwise. The accessor is not re-exported from `matrix/src/index.ts`, so the export lock does not move. The alternative is the public `toFloat64Array()`, which always copies; the PR may use it only if the 8×8 case still passes.

**Public API and export lock:** unchanged.

**Pins first:** `jsBackend.multiply` against golden products for 1×1, 3×5 by 5×2, and random 8×8, 32×32 and 128×128; a view (`subMatrix`/slice) operand; `0 × Infinity` and `NaN` entries; the dimension-mismatch error.

**Benchmark** (in-process prototype: the shipped method against the flat loop on the same objects):

| Case                                | Kind |  Node |   Bun |
| ----------------------------------- | ---- | ----: | ----: |
| 8×8                                 | gain | 0.619 | 0.821 |
| 32×32                               | gain | 0.534 | 0.796 |
| 128×128                             | gain | 0.519 | 0.753 |
| 16×16 with `0 × Infinity` and `NaN` | gain | 0.584 | 0.773 |

**Tests that stay green:**

```bash
cd matrix && bun test --isolate --timeout 30000 tests/JSBackend.test.ts tests/backends/BackendManager.test.ts tests/backends/Backend.test.ts tests/dense-js-backend-reach.test.ts
cd ../functions && bunx vitest run tests/typed-matrix-ops.test.ts
```

**Expected gain:** 1.6–1.9× on Node and 1.2–1.3× on Bun, from 8×8 to 128×128.

### P7-9 — `sort`: number comparator, ascending and descending

**Package:** `functions`. **File:** `functions/src/matrix/sort.ts`. **Public calls that get faster:** `sort(number[])`, `sort(number[], 'asc' | 'desc')`, and the same on a number `Matrix`.

`sort` passes `compareAsc` (the typed `compare`) or `compareDesc` (`-compare(a, b)`) to `Array.prototype.sort`. When a `typeof` scan finds only numbers, it passes the found `number, number` implementation of `compare` instead, or `(a, b) => -cmp(a, b)` for descending. The comparator returns the same value for every pair, and the engine's sort is deterministic for a given comparator, so the sorted order, `-0` against `0` included, is the same. The input is still sorted in place for arrays.

Descending was not prototyped. If its case does not pass the gain bar, descending stays on the typed comparator and becomes a `neutral` case.

**Public API and export lock:** unchanged.

**Pins first:** ascending and descending order of seeded arrays (bit-exact, including `-0`/`0` and `NaN` placement); the in-place mutation; `Matrix` input (storage kept); a custom comparator function (unchanged path); a natural-order string sort (unchanged path); BigNumber.

**Benchmark** (prototype of ascending only; the descending rows ran unchanged code on both sides, so they show the noise, not a result):

| Case                                | Kind           |  Node |   Bun |
| ----------------------------------- | -------------- | ----: | ----: |
| `sort` n = 100                      | gain           | 0.696 | 0.390 |
| `sort` n = 100,000                  | gain           | 0.729 | 0.770 |
| `sort` Matrix n = 1,000             | gain           | 0.736 | 0.663 |
| `sort` desc n = 100                 | not prototyped | 0.998 | 1.004 |
| `sort` desc n = 100,000             | not prototyped | 0.979 | 1.018 |
| `sort` BigNumber n = 200 (fallback) | neutral        | 0.999 | 1.039 |

The ascending Node rows have a strong import-order skew (n = 100: 0.974 base-first, 0.497 head-first), so they are single-tree-mode cases. The Bun BigNumber row was 1.057 and 1.021 by order with A/A ±0.007; the PR must show it at 1.02 or below.

**Tests that stay green:**

```bash
cd functions && bunx vitest run tests/factories-tier4.test.ts tests/cov-numeric.test.ts tests/cov-cas.test.ts <new pin file>
```

**Expected gain:** 1.3–2.6× ascending; descending to be measured.

### P7-10 — autograd batched matmul: one strided contraction

**Package:** `autograd`. **File:** `autograd/src/tape.ts`. **Public calls that get faster:** `TapedTensor.matmul` forward and its backward pass.

`_batchedMatmul` (A·B), `_batchedMatmulGradA` (dY·Bᵀ) and `_batchedMatmulGradB` (Aᵀ·dY) are three copies of one triple loop with different index arithmetic; the clone report lists them as exact group 3 and three near pairs at `jStruct` 1. One module-private `contract(x, y, batch, rows, cols, inner, xBatch, xRow, xIn, yBatch, yIn, yCol)` computes `out[b][r][c] = Σₜ x[xOff + r·xRow + t·xIn] · y[yOff + c·yCol + t·yIn]`, with the pointers advanced by addition. The three functions become one-line calls with their own strides. Each output element sums the same products in the same order of `t`, so the result is bit-identical.

**Public API and export lock:** unchanged; the three functions are module-private.

**Pins first:** golden `Y`, `dA` and `dB` (bit-exact) for shapes 8×2×3×4, 8×8×8×8, 4×32×16×24 and 1×128×96×112, and a batch shape with rank 2.

**Benchmark** (in-process prototype: copies of the three current functions against the helper; the forward pass and both gradients per iteration; two runs):

| Shape (batch×m×k×n) | Kind    | Node, runs 1 / 2 | Bun, runs 1 / 2 |
| ------------------- | ------- | ---------------: | --------------: |
| 8×2×3×4             | neutral |    0.972 / 0.987 |   0.825 / 0.831 |
| 8×8×8×8             | neutral |    0.980 / 0.961 |   0.714 / 0.712 |
| 4×32×16×24          | gain    |    0.923 / 0.921 |   0.678 / 0.678 |
| 2×64×64×64          | gain    |    0.926 / 0.927 |   0.671 / 0.676 |
| 1×128×96×112        | gain    |    0.921 / 0.922 |   0.650 / 0.655 |

Node's small shapes are within noise, so they are `neutral` cases.

**Tests that stay green:**

```bash
cd autograd && bun test --isolate --timeout 30000 tests/tensor-contract-ad.test.ts tests/tape-decomposition-ad.test.ts tests/reverse-grad.test.ts <new pin file>
```

**Expected gain:** 1.08–1.09× on Node and 1.47–1.54× on Bun from 4×32×16×24 up; 1.2–1.4× on Bun for small shapes. Exact groups 9 → 8, near pairs 533 → 530.

### P7-11 — `lsolve` / `usolve`: number path (no prototype)

**Package:** `functions`. **Files:** `functions/src/algebra/solver/lsolve.ts`, `usolve.ts`. **Public calls that get faster:** `lsolve`, `usolve`, and the triangular solves inside `lusolve`.

After P7-4, `lusolve` at 128×128 takes 2.68 ms on both engines, of which `lup` is 1.83 ms (Node) and 1.89 ms (Bun). That leaves at most 0.85 and 0.79 ms for the permutation and the two triangular solves, which call the typed scalar operations per element. The PR profiles that remainder first. If the two solves are most of it, it adds dense number paths of the P7-4 kind (a separate function, found implementations, a `typeof` scan, the generic loop unchanged).

**Expected gain** (estimate): if the solves shrink as much as `lup` did, `lusolve` at 128×128 goes from about 2.7 ms to about 2.0 ms on both engines, about 1.3× over P7-4; `lsolve` and `usolve` on their own gain more. The PR is dropped if the gate fails.

**Pins first:** golden solutions for lower and upper triangular systems with vector and matrix right-hand sides, a zero on the diagonal (same error), and BigNumber.

### P7-12 — element-wise factories via the `number` datatype (no prototype)

**Package:** `functions`. **Files:** the dense `matAlgo` helpers that the element-wise factories share (`matAlgo13xDD`, `matAlgo14xDs`, and the suite that calls them). **Public calls that get faster:** `dotMultiply`, `dotDivide`, and the other factory element-wise functions on number arrays.

`dotMultiply` on two number arrays of 1,000 takes 19.6 µs (Node) and 18.5 µs (Bun), against 1.68 and 4.72 µs for `add` after P7-5. The `matAlgo` helpers already resolve `typed.find(callback, [dt, dt])` once when a matrix carries a datatype, and call it per element. The PR infers `dt = 'number'` from a `typeof` scan when both operands are plain arrays, so that existing branch runs. That branch already runs today for `DenseMatrix` with datatype `'number'`, which is the identity argument. The result must not gain a datatype it lacks today, so the inference is limited to `Array` operands, or the output datatype is kept as base sets it.

**Expected gain** (estimate): up to the P7-5 ratios on `dotMultiply` at n = 1,000, about 10× on Node and 4× on Bun. The PR is dropped if the gate fails.

**Pins first:** each affected function on number arrays (bit-exact), mixed and BigNumber arrays, a `DenseMatrix` with and without a datatype (the result's datatype unchanged), and broadcasting against a scalar.

## Not planned

Each of these was measured or profiled and is out for a reason.

- **A generator for the 255 unary `Float64Array` overloads.** It would retire no clone pair, and neither generated shape passed the bar in a model of ten overloads (two or three runs per engine). One shared loop function over a per-op kernel measured 0.89–0.92 (Node) and 0.78–0.90 (Bun) at n ≤ 16, but 1.06–1.14 on Node at n ≥ 256. A template that keeps each loop inline behind one shared dispatch helper measured 0.87–0.93 (Node) and 0.77–0.91 (Bun) at n ≤ 16, 0.92–1.09 on Node at n = 256 (above 1.02 in two of three runs), and 0.98–1.01 on both engines at n ≥ 4,096. Its small-array gain comes from the shared dispatch helper, which a hand edit can make without a generator, and the model is not the shipped code: the real overloads dispatch through `elementwiseUnaryDispatch` and `computePool`. Whether that gain survives on them is unmeasured, so it is a lead, not a planned PR.
- **Routing the worker per-element methods through `runParallel`.** Routed over inline measured 1.20–1.29 (Node) and 1.13–1.51 (Bun) at n = 16 and 256, and 1.03–1.10 at 4,096 and 49,152, in two runs.
- **An incremental pivot in the Jacobi eigen solver** (`functions/src/matrix/eigs/realSymmetric.ts`). The rotation sequence was identical and the rotations got 2.3–6.7× faster on Node and 1.4–4.8× on Bun (once its array destructuring was removed; with it, Bun was 1.0–5.5× slower). No public number call reaches it: `eigs` uses `correctEigs`, and `norm(A, 2)` does not use Jacobi.
- **The `gcd` swap in the exact-scale engine** (`core/src/types/unit/exact-scale.ts`, `[p, q] = [q, p % q]` replaced by a temporary). Bun: unit conversions 0.84–0.96, `new Unit(x, 'psi')` 0.918, `multiplyExactScales` 0.50. Node: 0.949–1.055 on the same cases and 0.963 on `multiplyExactScales`, all inside the noise. It fails the "faster on both engines" bar. It can ride along with a later units change that does speed up Node.
- **Caching the prototype checks in `isSafeProperty`.** It is 46% of a compiled-evaluation loop. A cache of the `prop in Object.prototype` and `prop in Function.prototype` answers would stop seeing a property added to `Object.prototype` at runtime, which is the attack the sandbox guards. The security invariant wins.
- **`DenseMatrix.multiply` (matrix package) as a faster path.** It skips `aik === 0`, which is faster on sparse rows but drops `0 × Infinity` (see [Observations](#observations)), so it is not a bit-identical replacement for anything.

## Leads without a design

Profiled hot spots for a later phase. None has a prototype or a gain figure.

- **typed-function construction at import time.** About half of the 400–470 ms `functions` import. The combinatorial conversion expansion is in `@danielsimonjr/typed-function@5.0.0-alpha.4` (npm), outside this repository, and a fix ships only with a release of that package. Inside this repository, building the four-`number` exports lazily would save about 107 ms but changes what the export object is (its `signatures` and typed-function identity), so it needs a design that keeps both.
- **The expression tokenizer.** `getToken` and `getTokenSkipNewline` are 63% of a `parse` loop. A rewrite must keep calling the public `parse.isAlpha`, `parse.isWhitespace` and `parse.isDigit` hooks, which users may replace.
- **Unit construction and conversion.** `normalizeUnitSpellings` is 15% and `roundExactScale` 12% of the conversion loop. `roundExactScale` sets a `WeakMap` entry for every fresh scale object, and a conversion makes several.
- **`BigNumber.sqrt`.** 22 µs on both engines, 25× a division.

## Observations

Found while measuring. None is a speed PR here; each needs its own change.

- **`evaluate('5 km to m')` throws** `Unexpected type of argument in function to (expected: string, actual: Unit, index: 1)` on both engines, and so does `'5 km/h to m/s'`. `to(5 km, "m")` works. The `to` operator passes the target unit as a `Unit`, and the function accepts only a string there.
- **`max` and `min` overflow the stack on Node** for a 500,000-element array (`RangeError`); Bun returns the value. P7-6 fixes this as a side effect. `factory_max` does not have the problem.
- **`DenseMatrix.multiply` (matrix package) drops `0 × Infinity`.** `matrix/src/types/dense/arithmetic.ts` line 98 skips `aik === 0`, so `[0, 1] · [∞; 2]` gives `2`, while `jsBackend.multiply` and `backendManager.multiply` give `NaN`, the IEEE result. The two public multiplies disagree.
- **`qr` on Fraction input throws** `Cannot convert undefined to a BigInt` (Node) or `Invalid argument type in ToBigInt operation` (Bun), before any Phase 7 change.
- **Untouched code drifts by up to ±5% between single runs**, from module layout and JIT state. Do not read a single-run 1.03 on code a PR does not touch as a regression; that is what the five-run median and the A/A' control are for.

## Constraints

- This plan and the ledger are documentation only. Implementation is the Phase 7 build step, one PR at a time, P7-0 first.
- Each implementation PR carries a patch changeset for each published package it changes. P7-0 and this plan PR change no published package and need none.
- No tag, no GitHub Release, and no publish. Do not set `RELEASES_ENABLED`. §7 stays shut.
- Do not touch, merge, or close PR #398.
- No force-push to shared branches, and no `--no-verify`.
- Do not change `REPO_TOOLS_VERSION: 2.2.4` in `.github/workflows/ci.yml`. `repo-tools clones` needs 2.3.0, installed outside the repo; the CI pin is for `repo-tools check` only.
- Keep the architecture-docs gate green on every PR (`repo-tools check . --docs=docs/Architecture` at 2.2.4).
- Do not plan or touch the PR #536 Bun fix.
