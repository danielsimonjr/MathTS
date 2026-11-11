# Dogfood relay implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan **group-by-group**. Each group is one PR. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all 139 open MathTS `dogfood` GitHub issues at root cause, one PR per group, P0 groups first.

**Architecture:** Issues were clustered by shared dispatch tables, types, and packages on `main` (2026-11-11). Builders implement only their group. Reviewer (grok-4.7) gates each PR against this plan's root-cause lines and the spec.

**Tech Stack:** TypeScript ESM, Vitest, Bun, Turborepo, tsdown. Parity oracles: mathjs 13/14 (compat), SciPy/NumPy (stats/signal), SymPy (CAS) only where the issue cites them.

**Spec:** `docs/superpowers/specs/2026-11-11-dogfood-relay-design.md`

## Global Constraints

- Fix at root cause. No call-site wrappers that hide a broken typed signature.
- Never skip tests, raise timeouts, or weaken assertions.
- Every PR body uses `Fixes #N` for each issue the PR actually resolves.
- No force-push, rebase, amend, or `--no-verify`.
- Never commit repo-tools JSON dumps (CDG outputs, persona JSON, inventory dumps).
- Keep architecture/docs CI green: `bun run docs:functions:check`, `bun run docs:deps:test`, `bun run check:browser-safety`.
- Tests import built `dist/` of dependencies. Prefer `bunx turbo test --filter=<pkg>`.
- `bun run typecheck` stays 0 errors on touched packages. `bun run lint` stays `--deny-warnings`.
- TDD: write the issue's exact repro as a failing test, confirm red, implement, confirm green, changeset, commit.
- Packages are pre-1.0: breaking change = **minor** changeset naming old vs new; otherwise patch.
- Do not set `RELEASES_ENABLED`. Do not tag. Do not `npm publish`. Do not merge the version PR.
- Import extensions `.js` except `tensor/src/` bare imports.
- Float32/Float64 copies: `new Float64Array(x)`, never `TypedArray.from`.
- WASM SHA-384, expression sandbox (`getSafeProperty`), WorkerPool `timeoutMs` must not regress.
- One group, one PR, in the order below. Do not start G12 until G01–G11 are merged or explicitly stacked with `Fixes` still accurate.

## File map (by wave)

| Wave | Groups  | Packages                                                                    |
| ---- | ------- | --------------------------------------------------------------------------- |
| P0   | G01–G11 | functions, compat, core, parallel, matrix, autograd, numbers                |
| P1   | G12–G27 | parallel, gpu, autograd, tensor, compat, expression, units, plot, packaging |
| P2   | G28–G36 | docs, plot, workbook, remaining API polish                                  |

---

## Builder checklist (every group)

- [ ] Read the group's issues with `gh issue view N -R danielsimonjr/MathTS` (repro + AC).
- [ ] Confirm `main` still matches the **Root cause** file:line below. If already fixed, comment evidence on the issue and skip the group.
- [ ] Add `*.test.ts` with the **exact repro** from the issue body (same imports, same args).
- [ ] Run the new test; expect FAIL.
- [ ] Implement the design below.
- [ ] Run the new test + the package's existing tests; expect PASS. Do not skip or widen timeouts.
- [ ] Update JSDoc/README/migration guide listed under **Docs**.
- [ ] `bunx changeset` for published packages.
- [ ] `CHANGELOG.md` `[Unreleased]`.
- [ ] PR title `fix(<pkg>): …` or `docs:` / `perf:`; body lists every `Fixes #N`.

---

### G01 — Complex promotion for real-domain functions (P0)

**Issues:** #728 (P0), #729 (P0)  
**Severity:** P0  
**Breaking API:** **Yes** (real `NaN` → `Complex`). Minor changeset. Callers who compared `log(-1) === NaN` will fail; mathjs parity is the AC.

**Root cause (main):**

- `compat/src/shims.ts:242` `asin`/`acos`/`atan` call `Math.asin` and `create(all)` prefers those shims over `functions.asin`.
- Typed/factory `log`/`pow`/`nthRoot`/`acosh` use `Math.log` / `Math.pow` / `Math.acosh` without a Complex branch (`functions/src/typed/` trigonometry + arithmetic; `nthRoot` lacks the odd-real branch that `cbrt` already has).

**Design:** Delete or stop installing inverse-trig shims that shadow functions. Centralize “if the real JS math is NaN and the input is real, promote to Complex” in one helper used by `log`, `pow`, `nthRoot`, `asin`, `acos`, `atan`, `acosh`, `atanh`. Match mathjs principal values (`log(-1) = iπ`, `pow(-8,1/3)` Complex, `nthRoot(-8,3) = -2` real odd root).

**Tests:**

```ts
import { create, all } from '@danielsimonjr/mathts-compat';
import { log, pow, nthRoot, acosh, asin, acos } from '@danielsimonjr/mathts-functions';
const math = create(all);
it('#729 log(-1) is i*pi', () => {
  const z = log(-1) as { re: number; im: number };
  expect(z.re).toBeCloseTo(0, 12);
  expect(z.im).toBeCloseTo(Math.PI, 12);
});
it('#729 nthRoot(-8,3) is -2', () => expect(nthRoot(-8, 3)).toBe(-2));
it('#728 math.asin(2) is Complex', () => expect(math.asin(2).im).not.toBeNaN());
```

Parity vs mathjs `create(all)` for the issue's listed expressions.

**Docs:** `compat/README.md`, `docs/guide/migration.md` — Complex promotion is on, not NaN.  
**Risk:** GPU/WASM f32 kernels stay real-only; only CPU typed/compat paths promote.

---

### G02 — Unit in trig and Complex × Unit (P0)

**Issues:** #727 (P0), #823 (P0), #834 (P1)  
**Severity:** P0  
**Breaking API:** No (new overloads).

**Root cause:**

- Typed `sin`/`cos`/`tan` register `number | Complex | BigNumber | …` but not `Unit` (`functions/src/typed/` trig). `evaluate("sin(90 deg)")` therefore throws typed-function.
- `multiply` signatures omit `Complex, Unit` / `Unit, Complex` even though scalar multiply documents them (`functions` multiply factory + typed arithmetic).

**Design:** Convert angle Units to radians via existing Unit SI value, then call the numeric kernel. Register `multiply(Complex, Unit)` as `new Unit(complex * unit.value, unit)`. Same for `divide`. Do not stringify the unit away.

**Tests:** exact `sin(new Unit(90,"deg")) === 1`, `math.evaluate("sin(90 deg)") === 1`, `multiply(new Complex(0,1), new Unit(1,"F"))` returns a Unit whose value is `0+1i` farad.

**Docs:** functions trig JSDoc; physics examples.  
**Risk:** non-angle Unit in `sin` must throw DimensionError, not convert.

---

### G03 — Null / invalid scalar dispatch (P0)

**Issues:** #807 (P0), #813 (P2)  
**Severity:** P0  
**Breaking API:** No for throws; #813 string→Complex is a **behavior fix** (throw TypeError).

**Root cause:** `core/src/arithmetic/scalar.ts:194-202` `number()` assumes leftover union member is Complex (`x.im`) with no `instanceof` / nullish guard. `addScalar` falls through to `asFraction` → `number`. Typed `add(null)` is treated as missing args.

**Design:** Guard `number()`, `addScalar`, `divideScalar`, `asComplex`, `asFraction` with `x == null` → TypeError. Typed `add`/`multiply` reject `null`/`undefined`/`string` with a short TypeError, not “Too few arguments” and not Complex.

**Tests:** `addScalar(null as never, 1)` throws; `number(null as never)` throws; `add(null)` throws TypeError matching AC; `add("1")` throws (not Complex).

**Docs:** core arithmetic JSDoc.  
**Risk:** none if only invalid inputs throw.

---

### G04 — WorkerPool constructor (P0)

**Issues:** #806 (P0)  
**Severity:** P0  
**Breaking API:** No (required arg was always required in types; runtime crashed).

**Root cause:** `parallel/src/WorkerPool.ts:61-71` constructor assigns `workerScript` then `initialize()`; `createWorker` at line 119 does `this.workerScript.startsWith` without a string check. `new WorkerPool()` from the package entry forwards undefined.

**Design:** If `workerScript` is not a non-empty string, throw `TypeError('WorkerPool requires a workerScript URL or path')` **before** `initialize()`. Do not start workers. Point README at `ComputePool` for the public API.

**Tests:** `expect(() => new WorkerPool()).toThrow(/workerScript/)`; no unhandled rejection.

**Docs:** `parallel/README.md`.  
**Risk:** keep `timeoutMs` replacement plumbing.

---

### G05 — Decomposition input types (P0)

**Issues:** #704 (P0), #705 (P1), #701 (P2)  
**Severity:** P0  
**Breaking API:** No (accept more; reject wrong with a clear error instead of silent empty SVD).

**Root cause:**

- `matrix/src/operations/svd.ts:375-402` `m = A.length; n = A[0]?.length || 0` — DenseMatrix is not a jagged array → `m===0` empty factors.
- `lu` requires `DenseMatrix.toFloat64Array` (`matrix` lu) — `number[][]` throws.
- `lusolve` typed signatures omit packed `Float64Array`.

**Design:** One `asPacked(A)` helper: DenseMatrix, `number[][]`, square Float64Array. SVD/LU/lusolve all use it. Unknown type throws `TypeError` naming accepted types.

**Tests:** `svd(new DenseMatrix([[1,0],[0,1]]))` U,S,V finite; `lu([[1,2],[3,4]])` does not throw; `lusolve` packed 2×2 + b.

**Docs:** `linalg/README.md` (also #695 later).  
**Risk:** non-square Float64Array for SVD already throws; keep that.

---

### G06 — fsolve scalar residual (P0)

**Issues:** #689 (P0)  
**Severity:** P0  
**Breaking API:** No.

**Root cause:** `functions/src/numeric/fsolve.ts:54-62` `Fx = F(x)` then `maxNorm` iterates. Scalar `F` returns a number; `for (const vi of v)` throws. `Array.from(x0)` on a number is wrong.

**Design:** Normalize `x0` to `number[]`. If `F` returns a number, wrap as `[Fx]`. If lengths mismatch, throw. Optionally add `fsolveScalar` alias. Match SciPy `fsolve` of a scalar residual.

**Tests:** `fsolve(x => x[0]**2 - 2, [1])` ≈ √2; `fsolve(x => x**2 - 2, 1)` if AC allows scalar x0.

**Docs:** JSDoc.  
**Risk:** keep vector systems unchanged.

---

### G07 — lusolve singular / NaN (P0)

**Issues:** #688 (P0)  
**Severity:** P0  
**Breaking API:** **Yes** (previously returned a particular solution). Minor. AC requires throw.

**Root cause:** `functions/src/algebra/solver/lusolve.ts` + `usolve`: zero pivot with zero RHS treated as free variable = 0. NaN comparisons skip the zero-pivot test. Contrast `linsolve` / `solvePivoted` which reject tiny pivots.

**Design:** After LUP, if any |U_ii| < eps or non-finite, throw `Error('lusolve: matrix is singular')` (or exported LinearIndependence error). Do not return a particular 0-filled solution. Same for Inf/NaN entries.

**Tests:** `[[1,1],[2,2]], [1,2]` throws; NaN matrix throws; well-conditioned 2×2 still matches.

**Docs:** lusolve JSDoc.  
**Risk:** mathjs sometimes returns particular solutions; this issue's AC overrides.

---

### G08 — TapedTensor broadcasting (P0)

**Issues:** #747 (P0)  
**Severity:** P0  
**Breaking API:** No.

**Root cause:** `autograd/src/tape.ts:180-182` `add`/`mul` call `checkSameShape`; `tensor` already broadcasts.

**Design:** Reuse tensor broadcast shapes; backward scatters adjoints with `broadcast_to` reverse (sum reduced axes). Scalars: `add(1)` must not say “different Tapes” (see G13 for detach).

**Tests:** MLP bias `y.add(b)` with shapes `[2,3]` + `[3]`; finite grads vs finite difference.

**Docs:** autograd README (ties #765).  
**Risk:** wrong backward is worse than throwing — include FD checks.

---

### G09 — studentTTest popmean (P0)

**Issues:** #766 (P0)  
**Severity:** P0  
**Breaking API:** **Yes** if overload `studentTTest(sample, number)` currently means two-sample. Must match SciPy `ttest_1samp`. Document two-sample as `(a, b)` arrays only.

**Root cause:** Second numeric arg is not `popmean`; implementation treats it as a second sample (length 1) → NaN df.

**Design:** If arg2 is `number`, one-sample vs popmean. If arg2 is array, two-sample. Options object `{ popmean, alternative }`. Parity: SciPy `ttest_1samp([1,2,3,4,5], 5.5)`.

**Tests:** exact issue repro; p-value vs SciPy within 1e-10.

**Docs:** statistics README.  
**Risk:** any caller using `studentTTest(x, 0)` as two-sample of `[0]` — extremely unlikely.

---

### G10 — PDE CFL and BC validation (P0)

**Issues:** #822 (P0), #833 (P1)  
**Severity:** P0  
**Breaking API:** **Yes** (`solvePDE` currently returns silently wrong fields). Throw on `r>0.5` unless `{ allowUnstable: true }`.

**Root cause:** `functions/src/typed/numeric.ts:2254-2256` empty `if (r > 0.5)` comment. `solveParabolicPDE` is the real solver; `bcLeft: 0` number vs `{type,value}` hangs (#833).

**Design:** `solvePDE` either delegates to `solveParabolicPDE` or throws “use solveParabolicPDE” **and** CFL check. Validate BC objects before the time loop (finite timeout test: 50ms).

**Tests:** r>0.5 throws; `bcLeft: 0` throws within 50ms; implicit scheme still solves a heat problem vs analytic.

**Docs:** numeric JSDoc.  
**Risk:** do not hang CI — the hang test must use `AbortSignal` or a step cap.

---

### G11 — BigNumber public construction (P0)

**Issues:** #714 (P0)  
**Severity:** P0  
**Breaking API:** No if you add a public constructor or factory `BigNumber.from(1)` and export it from `numbers`. Do **not** leave `new BigNumber(1)` constructable-then-throwing.

**Root cause:** `core/src/types/bignumber.ts:79` `private constructor`; TS erases it; runtime `new BigNumber(1)` builds a broken instance; `.toString()` throws. `fromNumber`/`parse` are the real factories.

**Design:** Public `static from(value: number | string | bigint)` and a documented construct signature **or** a runtime guard in a public constructor that forwards to `fromNumber`. Export from `@danielsimonjr/mathts-numbers`. README shows `BigNumber.from(1)` not `new`.

**Tests:** `new BigNumber(1).toString()` is `'1'` **or** throws a clear “use BigNumber.from”. AC prefers constructable working instance.

**Docs:** `numbers/README.md`.  
**Risk:** keep `_sign/_coefficient` invariants.

---

### G12 — ComputePool init, thresholds, Vite worker (P1)

**Issues:** #757 #758 #710 #829  
**Root cause:** methods sequential unless `initialize()`; after `terminate()` they still compute; `thresholdByOp.sin === 'never'` / 100 chunks at n=1e6 (`parallel/src/ComputePool.ts`); Vite 404 `worker.js`.  
**Design:** auto-init on first parallel op; after terminate throw; honor `thresholdByOp`; document Vite `worker` plugin / `new URL(..., import.meta.url)`. Chunk count ≈ hardwareConcurrency, not 100.  
**Tests:** exact `forceParallel` n=1e6 chunk count; terminate then call throws; worker URL unit test.  
**Breaking:** terminate-then-compute currently “works” — **yes**, throw is AC.  
**Docs:** parallel README + Vite snippet.

---

### G13 — Autograd tape reuse, detach, activations (P1)

**Issues:** #756 #764 #755 #754 #763 #765  
**Root cause:** second `backward()` triples grads; Tape grows without `reset()`; no `detach`/`no_grad`; no relu/softmax/GELU/CE; jacobian/grad rank-1 only; README claims ML.  
**Design:** second backward accumulates 2× or zeros adjoints then reapplies (PyTorch-like; pick one, document). `reset()` bound in README. `detach()` clones primal without tape. Activations as TapedTensor methods with FD tests. `reshape`/`sum({keepDims})` on TapedTensor.  
**Tests:** issue repros + FD.  
**Breaking:** if second backward currently 3×, fixing to 2× is a bugfix not a break.  
**Docs:** autograd README rewrite (#765).

---

### G14 — Tensor construction and NumPy-shaped API (P1)

**Issues:** #795 #750 #749 #752 #751 #760 #748 #753 #761 #762 #831  
**Root cause:** `fromNested` requires shape; `flip` axes not iterable; `stack` omitted axis zeros; reshape copies and rejects `-1`; no zeros/ones/full/arange; f64-only; constructor accepts f32; `matMul` rank-2 camelCase vs taped `matmul`; no in-place; `slice` not a method; no cross/dot.  
**Design:** infer shape in `fromNested`; `flip(t,0)` axes as number; `stack` default axis 0; reshape view when contiguous + `-1`; factories; **keep f64 as default** but add `dtype` field that **rejects** Float32Array at runtime (#748) unless `#760` implements f32 (prefer reject + docs for P1, f32 as follow-up if too large — if implementing dtype, it is its own sub-PR stacked). `Tensor.matmul` alias batched. `cross`/`dot` for 3-vectors. In-place ops optional P2 in same PR only if tests are cheap.  
**Breaking:** constructor currently accepts f32 — rejecting is **yes**.  
**Tests:** each issue's exact throw/result.

---

### G15 — GPU status vs hasWebGPU (P1)

**Issues:** #835 #759  
**Root cause:** `hasWebGPU()` adapter probe true; `initializeGlobalGPU` false; `GPUContext.status === 'error'` on Node without GPU. README promised quiet fallback.  
**Design:** status `'unavailable'` not `'error'` when no adapter; never throw; `initializeGlobalGPU` returns `{ok:false, reason}` consistent with `hasWebGPU`.  
**Breaking:** status string **yes** (error → unavailable).  
**Docs:** gpu README.

---

### G16 — mathjs compat surface (P1)

**Issues:** #730 #731 #732 #733 #734 #738  
**Root cause:** `create(all)` missing `import`, `typed`, `compile`; `subset` expects mathjs Matrix; `reviver` skips Unit/BigNumber; migration guide claims drop-in.  
**Design:** implement `math.import`/`typed`/`compile` (alias `compileExpr`); `subset` on DenseMatrix; reviver table for Unit/BigNumber/Complex/Fraction; rewrite migration guide to a **gap table** until true drop-in.  
**Tests:** mathjs snippets from issues.  
**Breaking:** no.

---

### G17 — Public TypeScript types (P1)

**Issues:** #737 #785 #726 #700 #830  
**Root cause:** TypedFunction `(...args: never[]) => unknown`; GPUBuffer types leak; `Unit` is value not type (TS2749); `det` union too wide.  
**Design:** overload `add(a: number, b: number): number` etc. on wrappers; `export type UnitInstance = InstanceType<typeof Unit>` **and** `interface Unit` merge; `gpu` dts `types` condition or triple-slash; `det(number[][]): number`.  
**Breaking:** no (types only).  
**Docs:** units README.

---

### G18 — FFT / signal API (P1)

**Issues:** #706 #774 #768 #773 #779  
**Root cause:** factory `fft` rejects Float64Array; signal package omits factory fft; PSD empty array n<256; `resample(x,4)` RangeError; `windowFunction(n,type)` vs string-first.  
**Design:** `fft` accepts Float64Array via `fft-core-f64`; re-export from `@danielsimonjr/mathts-signal`; PSD throws if `n < frameLength`; `resample` SciPy semantics (num samples); overload `windowFunction('hamming', n)`.  
**Tests:** SciPy/NumPy citations in issues.  
**Breaking:** resample currently throws — fixing is not a break. Empty PSD → throw **yes**.

---

### G19 — Statistics NaN / ddof / typed arrays (P1)

**Issues:** #769 #771 #767 #776 #775  
**Root cause:** `variance` only mathjs strings; no skipna; median/mode reject Float64Array; overflow NaN; empty median throws vs mean NaN.  
**Design:** `{ ddof }` like NumPy; `{ skipna: true }` or `nanmean`; accept TypedArray everywhere reductions do; identical values → variance 0 (Welford / pairwise); empty: all throw **or** all NaN — pick pandas (`NaN` + warning) **or** NumPy (`nanmean` empty NaN); document.  
**Tests:** issue arrays; NumPy `ddof`.  
**Breaking:** empty median throw → NaN if chosen.

---

### G20 — parser / evaluator packages (P1)

**Issues:** #715 #796  
**Root cause:** `createParse()`/`compileExpression` require a mathjs-style factory instance; thin README shows them as public. Real path: `functions.parse` / `evaluate`.  
**Design:** Either bind default factories so `compileExpression("2+3")()` works, or replace README with “install `@danielsimonjr/mathts-functions`” and re-export `evaluate`. Prefer binding a default instance so the package name is not a lie.  
**Tests:** `compileExpression("2+3")` → 5.  
**Breaking:** no.

---

### G21 — CAS simplify / integrate / solve (P1)

**Issues:** #716 #717 #718 #719 #721  
**Root cause:** simplify rule set never factors; two integral tables disagree on `log(abs(x))`; `casDerivative` prints Diff; `solve` numeric; `sum(i,1,3,i)` is variadic + imaginary unit.  
**Design:** `simplify` runs factor+expand for polynomials; unify `integrate` with `symbolicIntegral` (`log(abs(x))`); `casDerivative` calls `derivative`; `solve("x^2-2")` returns `±sqrt(2)` symbols; `sum` 4-arg summation if first is symbol name — **or** document `summation` and make `sum(i,…)` throw a hint (imaginary `i` collision). Prefer dedicated `summation` + evaluate hint.  
**Tests:** SymPy strings from issues.  
**Breaking:** `sum(i,1,3,i)` currently Complex — changing **yes**.

---

### G22 — Expression lexer / sandbox / overflow (P1)

**Issues:** #720 #809 #808 #793 #725  
**Root cause:** Unicode `π` tokenized but scope has `pi`; integer lexeme `Number()` → Inf; evaluate scope leaks `parse`/`typed`; README samples missing import / `{unsafe:true}`.  
**Design:** bind `π`/`√` in default scope or rewrite tokens; overflow integer literals throw; drop live `parse`/`typed` from safe evaluate scope (keep forbidden-call); fix READMEs. Related P2 #817 #816 #723 #722 in G28/G32.  
**Tests:** `evaluate("π")===Math.PI`; huge integer throws; `evaluate("typed")` unsafe-only.  
**Breaking:** leaking `typed` was a bug; removing is **security**, not a break.

---

### G23 — Units, CODATA, physics scope (P1)

**Issues:** #811 #825 #812 #828 #827  
**Root cause:** superlinear Unit.parse; no dB/Np; `Unit.value` SI vs display; `physicsScope().e` vs Euler `e`; CODATA no uncertainty.  
**Design:** linear-time parse with length cap; add `dB`/`dBm`/`Np` as logarithmic units (bel ≠ byte `B` — use `dB` string, not `B`); document `.value` SI + `.toNumber('deg')`; physics scope uses `e0`/`elementaryCharge` and `e` stays Euler **or** isolated `physicsEvaluate`; attach `unc` on constants.  
**Tests:** 10k invalid string finishes <100ms; `unit('1 dB')`; `evaluate("e")` Euler; `G` bound in physicsScope.  
**Breaking:** if `e` in physicsScope currently charge, renaming **yes**.

---

### G24 — DenseMatrix construction / scale / size cap (P1)

**Issues:** #810 #814 #815  
**Root cause:** `zeros(1e8,1e8)` allocates; ctor treats nested array as flat string; `.multiply(2)` reads `.rows`.  
**Design:** MAX_ELEMENTS (e.g. 1e8) RangeError **named**; `new DenseMatrix([[1,2],[3,4]])` infers; `.multiply(number)` delegates to `scale` or throws “use scale”.  
**Tests:** exact throws.  
**Breaking:** multiply(2) currently throws garbage — clear error or scale; prefer scale (mathjs).

---

### G25 — ODE API (P1)

**Issues:** #824 #698 #691  
**Root cause:** `maxIter` 1e5; stiff Robertson generic message; `stiffODESolver` arg order reversed vs `solveODE`.  
**Design:** raise default or count **accepted steps** not RHS; stiffness hint in error; alias args `(f, y0, tspan)` matching `solveODE`.  
**Tests:** SHO t=100 completes; Robertson message `/stiff|Rosenbrock|BDF/`; swapped args work.  
**Breaking:** stiff arg order fix **yes** — keep old order behind options for one minor.

---

### G26 — Perf: sort, GEMM, lusolve, wasm messaging (P1)

**Issues:** #712 #693 #694 #711 #735  
**Root cause:** `Array.sort` comparator; ijk GEMM; factory lusolve vs packed lu; `loadWasm()` does not change public `sin` (policy); compat `add` dispatch.  
**Design:** typed-array sort path; blocked GEMM on `DenseMatrix.multiply`; `lusolve` call packed kernel; **do not** flip wasm policy for `sin` — change `loadWasm` docs + `isWasmLoaded` messaging (#711 is docs/policy). Measure `create(all).add` and cut typed dispatch for number,number. Use A/B harness rules in AGENTS.md.  
**Tests:** correctness + optional bench gate only if existing harness.  
**Breaking:** no.

---

### G27 — Packaging (P1)

**Issues:** #708 #736 #707 #791 #792  
**Root cause:** static `fs`/`crypto` on browser barrel; no CJS; star-export 1.13MB; README versions/paths.  
**Design:** dynamic `import('node:fs')` only on wasm Node path; `exports.require` **only if** dual package is in AC — AGENTS.md says ESM-only: prefer README “ESM only” for #736 rather than a fake CJS. Split `evaluate` subpath export. Fix README versions via generator. GitHub blob URLs for docs.  
**Tests:** `check:browser-safety` still green; consumer typecheck.  
**Breaking:** subpath exports additive.

---

### G28 — README / newcomer docs (P2)

**Issues:** #804 #803 #802 #801 #800 #799 #798 #797 #794 #793 (if not G22) #695 #782  
**Design:** one docs PR: install lines, TypeScript samples, package count 22 vs 24 workspace members, TypeDoc job or remove `/api` link, plot `svgString`, linalg DenseMatrix sample, `sample` vs `sampleN`.  
**Tests:** optional `tools/test` that extracts fenced blocks — if too heavy, at least compile samples in `docs/` tests.  
**Breaking:** no.

---

### G29 — Packaging P2 (LICENSE, homepage, maps, sideEffects)

**Issues:** #789 #790 #741 #740 #696 #697  
**Design:** `"files"` include `LICENSE`; `homepage`/`bugs`; `"sideEffects": false` only where true (typed registration **has** side effects — set `false` only on pure re-export packages); JS `sourceMap` in tsdown; `exports["./package.json"]`; workerpool types without requiring `@types/node` in consumers (triple-slash optional).  
**Breaking:** no.

---

### G30 — Stats SciPy leftover (P2)

**Issues:** #786 #783 #777 #778 #781 #772 #784  
**Design:** p-value underflow `erfc` not 0; KS named `'norm'`; kendall exact default n≤10; quantile `{method}` NumPy names; `describe` std/quartiles; `gammaDist` **document rate vs scale** and add `{scale}`; heatmap colorbar.  
**Tests:** SciPy numbers from issues.  
**Breaking:** gammaDist scale **yes** if default flips — prefer options, keep rate default.

---

### G31 — Plot live canvas / PNG (P2)

**Issues:** #836 #780  
**Design:** `plot.update(el, spec)` DOM; PNG via optional `resvg-wasm` **or** document SVG-only in README (AC wants JS fallback — prefer wasm resvg optional dep).  
**Breaking:** no.

---

### G32 — Expression P2 robustness

**Issues:** #817 #816 #818 #723 #722 #724 #743 #744 #739 #742 #820  
**Design:** block comments in lexer; clone/sanitize evaluate results; workbook `constructor` key via `setSafeProperty` allowlist or Map; `1e` SyntaxError; docs nesting 124; substitute then simplify; Fraction toString mathjs `0.1` **or** document canonical `1/10`; `size` format `[2, 3]`; `createUnit` overwrite option; L→mL 1000 exact via rational factors; workerpool README vs export.  
**Breaking:** `1e` currently 2.718 — SyntaxError **yes**.

---

### G33 — Remaining API nits (P2)

**Issues:** #826 #819 #832 #831 (if not G14) #709 #692 #690 #732 leftover  
**Design:** `DimensionMismatchError` export; reject NaN Unit; `integrate(fn)` dispatch to `quad`; ComputePool matmul arg check message; `sin(number[])` map; `solve(A,b)` detect matrices → `lusolve` **or** throw “use lusolve”.  
**Breaking:** `solve` matrix currently `[]` — throw/hint **yes**.

---

## Issue → group map (all 139)

|   # | P   | Group | Title (short)                 |
| --: | --- | ----- | ----------------------------- |
| 688 | P0  | G07   | lusolve singular silent       |
| 689 | P0  | G06   | fsolve scalar residual        |
| 690 | P1  | G33   | solve is CAS not linsolve     |
| 691 | P1  | G25   | stiffODESolver arg order      |
| 692 | P1  | G33   | sin rejects number[]          |
| 693 | P1  | G26   | DenseMatrix.multiply GEMM     |
| 694 | P1  | G26   | functions lusolve slow        |
| 695 | P2  | G28   | linalg README exports         |
| 696 | P2  | G29   | export ./package.json         |
| 697 | P2  | G29   | workerpool @types/node        |
| 698 | P1  | G25   | RK45 stiffness message        |
| 699 | P2  | G26   | svd n=500 vs ml-matrix        |
| 700 | P2  | G17   | det return type               |
| 701 | P2  | G05   | lusolve Float64Array          |
| 704 | P0  | G05   | svd DenseMatrix empty         |
| 705 | P1  | G05   | lu(number[][])                |
| 706 | P1  | G18   | fft rejects Float64Array      |
| 707 | P1  | G27   | evaluate 1.13MB               |
| 708 | P1  | G27   | node builtins in barrel       |
| 709 | P2  | G33   | ComputePool.matmul args       |
| 710 | P1  | G12   | ComputePool.sin not parallel  |
| 711 | P1  | G26   | loadWasm sin no speedup       |
| 712 | P1  | G26   | sort/median slow              |
| 714 | P0  | G11   | BigNumber ctor                |
| 715 | P1  | G20   | createParse throws            |
| 716 | P1  | G21   | simplify x^2+2x+1             |
| 717 | P1  | G21   | integrate vs symbolicIntegral |
| 718 | P1  | G21   | casDerivative unevaluated     |
| 719 | P1  | G21   | solve numeric roots           |
| 720 | P1  | G22   | evaluate π                    |
| 721 | P1  | G21   | sum(i,1,3,i)                  |
| 722 | P2  | G32   | paren nesting docs            |
| 723 | P2  | G32   | parse("1e")                   |
| 724 | P2  | G32   | substitute no fold            |
| 725 | P2  | G22   | unsafe assignment docs        |
| 726 | P2  | G17   | GPUBuffer / evaluate unknown  |
| 727 | P0  | G02   | evaluate sin(90 deg)          |
| 728 | P0  | G01   | compat asin NaN               |
| 729 | P0  | G01   | log/pow/nthRoot NaN           |
| 730 | P1  | G16   | math.import missing           |
| 731 | P1  | G16   | math.typed missing            |
| 732 | P1  | G16   | math.compile missing          |
| 733 | P1  | G16   | subset not a function         |
| 734 | P1  | G16   | JSON reviver Unit             |
| 735 | P1  | G26   | create(all).add slow          |
| 736 | P1  | G27   | no CJS require                |
| 737 | P1  | G17   | add/sin typed unknown         |
| 738 | P1  | G16   | migration drop-in claim       |
| 739 | P2  | G32   | createUnit furlong            |
| 740 | P2  | G29   | no JS source maps             |
| 741 | P2  | G29   | no sideEffects                |
| 742 | P2  | G32   | unit ULP L→mL                 |
| 743 | P2  | G32   | fraction toString             |
| 744 | P2  | G32   | size stringifies 2,3          |
| 747 | P0  | G08   | TapedTensor no broadcast      |
| 748 | P1  | G14   | Tensor accepts f32            |
| 749 | P1  | G14   | stack omitted axis            |
| 750 | P1  | G14   | flip axes                     |
| 751 | P1  | G14   | no zeros/ones                 |
| 752 | P1  | G14   | reshape copy / -1             |
| 753 | P1  | G14   | matMul vs matmul              |
| 754 | P1  | G13   | no relu/softmax               |
| 755 | P1  | G13   | no detach                     |
| 756 | P1  | G13   | second backward 3×            |
| 757 | P1  | G12   | ComputePool initialize        |
| 758 | P1  | G12   | forceParallel 6× slower       |
| 759 | P2  | G15   | GPU status error              |
| 760 | P1  | G14   | Tensor f64-only               |
| 761 | P2  | G14   | no in-place ops               |
| 762 | P2  | G14   | slice negative step           |
| 763 | P1  | G13   | no reshape/keepDims           |
| 764 | P1  | G13   | Tape RSS leak                 |
| 765 | P2  | G13   | autograd README ML            |
| 766 | P0  | G09   | studentTTest popmean          |
| 767 | P1  | G19   | median rejects Float64Array   |
| 768 | P1  | G18   | welchPSD empty                |
| 769 | P1  | G19   | variance ddof                 |
| 771 | P1  | G19   | no skipna                     |
| 772 | P1  | G30   | gammaDist rate vs scale       |
| 773 | P1  | G18   | resample not scipy            |
| 774 | P1  | G18   | signal has no fft             |
| 775 | P2  | G19   | empty median/mean             |
| 776 | P2  | G19   | variance 1e308                |
| 777 | P2  | G30   | kendalltau exact              |
| 778 | P2  | G30   | quantileSeq methods           |
| 779 | P2  | G18   | windowFunction args           |
| 780 | P2  | G31   | PNG PATH tools                |
| 781 | P2  | G30   | describe no std               |
| 782 | P2  | G28   | sample vs sampleN             |
| 783 | P2  | G30   | kstest named dist             |
| 784 | P2  | G30   | heatmap no colorbar           |
| 785 | P2  | G17   | variance typed unknown        |
| 786 | P2  | G30   | pearsonr pValue 0             |
| 789 | P2  | G29   | LICENSE omitted               |
| 790 | P2  | G29   | homepage/bugs omitted         |
| 791 | P1  | G27   | README docs/ paths            |
| 792 | P1  | G27   | stale versions                |
| 793 | P1  | G22   | MathML parse import           |
| 794 | P2  | G28   | createSeededRng fence         |
| 795 | P1  | G14   | Tensor.fromNested             |
| 796 | P1  | G20   | evaluator no evaluate         |
| 797 | P2  | G28   | gpu README                    |
| 798 | P2  | G28   | 12 READMEs no TS sample       |
| 799 | P2  | G28   | core README DenseMatrix       |
| 800 | P2  | G28   | plot svgString                |
| 801 | P2  | G28   | no TypeDoc site               |
| 802 | P2  | G28   | linalg no DenseMatrix         |
| 803 | P2  | G28   | 24 vs 22 packages             |
| 804 | P2  | G28   | arithmetic README mix         |
| 806 | P0  | G04   | WorkerPool() TypeError        |
| 807 | P0  | G03   | addScalar null .im            |
| 808 | P1  | G22   | evaluate leaks typed          |
| 809 | P1  | G22   | integer Infinity              |
| 810 | P1  | G24   | zeros 1e8×1e8                 |
| 811 | P1  | G23   | Unit parser DoS               |
| 812 | P1  | G23   | Unit.value radians            |
| 813 | P2  | G03   | add(null)/add(string)         |
| 814 | P2  | G24   | DenseMatrix nested ctor       |
| 815 | P2  | G24   | multiply(2)                   |
| 816 | P2  | G32   | evaluate returns process      |
| 817 | P2  | G32   | /* */ comments                |
| 818 | P2  | G32   | workbook constructor key      |
| 819 | P2  | G33   | Unit(NaN)                     |
| 820 | P2  | G32   | chunkTyped export             |
| 822 | P0  | G10   | solvePDE CFL                  |
| 823 | P0  | G02   | multiply(Complex,Unit)        |
| 824 | P1  | G25   | solveODE maxIter              |
| 825 | P1  | G23   | dB/dBm/Np                     |
| 826 | P2  | G33   | DimensionMismatchError        |
| 827 | P1  | G23   | CODATA no uncertainty         |
| 828 | P1  | G23   | e vs charge / G               |
| 829 | P1  | G12   | Vite worker.js 404            |
| 830 | P2  | G17   | Unit as type TS2749           |
| 831 | P2  | G14   | Tensor cross/dot              |
| 832 | P2  | G33   | integrate(Math.sin)           |
| 833 | P1  | G10   | solveParabolicPDE hang        |
| 834 | P1  | G02   | sin(Unit deg)                 |
| 835 | P1  | G15   | hasWebGPU vs init             |
| 836 | P2  | G31   | static SVG only               |

Count check: 139 rows. Missing GitHub numbers in the dogfood dump (not open / not labeled): 687, 702, 703, 713, 745, 746, 770, 787, 788, 805, 821 — do not invent groups for them.

---

## Group index (name, issues, severity)

| Group | Name                      | Issues                                                | Highest |
| ----- | ------------------------- | ----------------------------------------------------- | ------- |
| G01   | Complex promotion         | 728, 729                                              | P0      |
| G02   | Unit trig + Complex×Unit  | 727, 823, 834                                         | P0      |
| G03   | Null scalar dispatch      | 807, 813                                              | P0      |
| G04   | WorkerPool constructor    | 806                                                   | P0      |
| G05   | Decomposition input types | 704, 705, 701                                         | P0      |
| G06   | fsolve scalar             | 689                                                   | P0      |
| G07   | lusolve singular          | 688                                                   | P0      |
| G08   | TapedTensor broadcast     | 747                                                   | P0      |
| G09   | studentTTest popmean      | 766                                                   | P0      |
| G10   | PDE CFL + BC              | 822, 833                                              | P0      |
| G11   | BigNumber constructor     | 714                                                   | P0      |
| G12   | ComputePool / workers     | 757, 758, 710, 829                                    | P1      |
| G13   | Autograd ML surface       | 756, 764, 755, 754, 763, 765                          | P1      |
| G14   | Tensor API                | 795, 750, 749, 752, 751, 760, 748, 753, 761, 762, 831 | P1      |
| G15   | GPU status                | 835, 759                                              | P1      |
| G16   | mathjs compat             | 730, 731, 732, 733, 734, 738                          | P1      |
| G17   | TypeScript types          | 737, 785, 726, 700, 830                               | P1      |
| G18   | FFT / signal              | 706, 774, 768, 773, 779                               | P1      |
| G19   | Stats NaN/ddof            | 769, 771, 767, 776, 775                               | P1      |
| G20   | parser/evaluator packages | 715, 796                                              | P1      |
| G21   | CAS                       | 716, 717, 718, 719, 721                               | P1      |
| G22   | Expression lexer/sandbox  | 720, 809, 808, 793, 725                               | P1      |
| G23   | Units / CODATA            | 811, 825, 812, 828, 827                               | P1      |
| G24   | DenseMatrix ctor/size     | 810, 814, 815                                         | P1      |
| G25   | ODE API                   | 824, 698, 691                                         | P1      |
| G26   | Perf + wasm messaging     | 712, 693, 694, 711, 735, 699                          | P1      |
| G27   | Packaging P1              | 708, 736, 707, 791, 792                               | P1      |
| G28   | README newcomer           | 804, 803, 802, 801, 800, 799, 798, 797, 794, 695, 782 | P2      |
| G29   | Packaging P2              | 789, 790, 741, 740, 696, 697                          | P2      |
| G30   | Stats SciPy leftover      | 786, 783, 777, 778, 781, 772, 784                     | P2      |
| G31   | Plot                      | 836, 780                                              | P2      |
| G32   | Expression/unit P2        | 817, 816, 818, 723, 722, 724, 743, 744, 739, 742, 820 | P2      |
| G33   | API nits                  | 826, 819, 832, 709, 692, 690                          | P2      |

---

## Self-review

- Spec coverage: 139 issues mapped; 0 unmapped from the dump.
- Already-fixed: none on `main` 2026-11-11.
- Placeholders: none; each group names files, design, tests, docs, breaking yes/no.
- G14 `dtype` may split: if f32 training is too large, G14a (bugs: fromNested/flip/stack/reshape/reject f32) then G14b (zeros/dtype/in-place) as a stacked PR — still `Fixes` only the issues that PR closes.
