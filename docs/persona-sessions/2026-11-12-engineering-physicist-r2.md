# Engineering physicist — npm dogfood round 2, 2026-11-12

I am building a browser physics calculator and simulation dashboard: SI/imperial units, CODATA constants, ODE/PDE workloads, complex impedances, then Vite + Playwright with plot, gpu, and parallel. Round 2 tests **published npm only** (release `cb254e81`, versions pinned in `persona-common-r2`). Scratch root: `/tmp/mathts-ep-r2` (Node ESM), `/tmp/mathts-ep-r2-ts` (strict `tsc`), `/tmp/mathts-ep-dash` (Vite 6 + Playwright). Node v22.23.4, Linux x86_64, Intel Xeon. I did not fix anything in the product; issues #908–#912.

## What I tried, in order

1. `npm ls` — all focus packages match the published pin list (core 0.27.0, functions 0.85.0, units 0.7.6, …).
2. Derived units N, J, W, Pa, Hz: `toNumeric()` → 1. Imperial mi/in/lb and °C/°F conversions match reference values.
3. `add(m,m)`, `DimensionMismatchError` on `add(m,s)` and `.to('s')`; `Unit.add` exists; dB/dBm/Np parse.
4. CODATA 2022 central values match; **uncertainties** present on `electronMass`, `G`, etc. (#827 fixed).
5. `multiply(Complex, Unit)` → unitful `i·μF` (#823 fixed). `sin(90 deg)` → 1 (#834 fixed).
6. `solveODE` SHO: 539 steps, max |x−cos(2t)| ≈ 4.1e−13, energy drift ≈ −1.7e−12. **Note:** `sol.y[i]` is the state at step `i` (`[x,v]`), not `sol.y[component][i]`.
7. `solvePDE` with CFL r≈80: **throws** `RangeError` (no silent wrong field, #822 fixed). Fourth-arg `{ allowUnstable: true }` reproduces legacy unstable midpoint ≈ −0.858.
8. `solveParabolicPDE` with object BCs: max err ≈ 6.2e−4. Scalar `bcLeft: 0` → clear validation error (#833 fixed).
9. Default `maxIter`: SHO to t=100 completes (#824 fixed). Kepler to t=10⁴ still stops at 1e5 steps (improved error text).
10. `integrate(Math.sin,…)` works (#832). `Tensor.cross` / `.dot` work (#831).
11. `evaluate('G')` still wrong (#828 **not** fixed); `evaluate('c')`/`hbar` symbolic (#909). `propagateUncertainty` crashes on Unit constants (#910).
12. Strict `tsc`: `UnitInstance` / `Unit` types OK (#830 fixed).
13. Vite dev + Playwright: dashboard loads ~1.3 s, ODE+plot OK, **no** `worker.js` 404 (#829 fixed). `plot.update` patches SVG in DOM (#836 fixed). Headless Chromium: `hasWebGPU` false, status `unavailable` (#835 environment differs from headed claim).
14. `vite build` with `parallel` import **fails** (top-level await; workerpool `Transfer` in dynamic import) — #912.

GitHub comments/labels 403 for this token; label lines are in each issue body.

## Round-1 re-check (#822–#836)

| Issue | Fixed? | Notes |
| ----- | ------ | ----- |
| #822 | yes | CFL violation throws; optional `allowUnstable` |
| #823 | yes | Complex × Unit |
| #824 | yes | SHO t=100; long orbits need `maxIter` (documented error) |
| #825 | yes | dB/dBm/Np; README documents `B` = byte |
| #826 | yes | `DimensionMismatchError`; `Unit.add` |
| #827 | yes | `.uncertainty` on constants |
| #828 | **no** | `evaluate('G')` still placeholder Unit → **#908** |
| #829 | yes | No dev worker 404 in r2 harness |
| #830 | yes | Strict TS consumer passes |
| #831 | yes | Tensor cross/dot |
| #832 | yes | `integrate` callable |
| #833 | yes | BC validation |
| #834 | yes | `sin(Unit deg)` |
| #835 | partial | Headless: no adapter (not “has true, init false”) |
| #836 | yes | `plot.update` for live SVG |

## Findings (round 2)

| # | Sev | Issue | Title |
| --- | --- | ----- | ----- |
| 1 | P1 | [#908](https://github.com/danielsimonjr/MathTS/issues/908) | Regression: `evaluate("G")` still symbolic Unit (#828) |
| 2 | P1 | [#909](https://github.com/danielsimonjr/MathTS/issues/909) | `evaluate("c")` / `evaluate("hbar")` unbound vs `physicsScope` |
| 3 | P1 | [#910](https://github.com/danielsimonjr/MathTS/issues/910) | `propagateUncertainty` throws on Unit CODATA constants |
| 4 | P2 | [#911](https://github.com/danielsimonjr/MathTS/issues/911) | `multiply(Unit, number[])` throws |
| 5 | P1 | [#912](https://github.com/danielsimonjr/MathTS/issues/912) | Vite production build fails with `mathts-parallel` |

Intended labels: `dogfood`, `bug|api|packaging`, `P0|P1|P2`, `persona:engineering-physicist`.

## What was fine

Unit conversions; temperature; matrix unit add; short SHO accuracy; `solveParabolicPDE`; RLC numeric and unitful `jωC`; tensor 3-vector ops; dB units; parallel workers in **dev**; plot `line` + `update`; package version alignment on npm.

## Verdict

Most round-1 physics blockers shipped in 0.85.0. I still cannot rely on bare `G`/`c`/`hbar` in `evaluate`, uncertainty propagation through constants, or shipping a **built** Vite dashboard that imports `parallel`. PDE stability now fails loud. For a live dashboard I would use `plot.update`, accept main-thread numerics unless the parallel browser build story is fixed, and import constants by export name—not single-letter symbols.

Bench JSON: `docs/persona-sessions/bench/2026-11-12-engineering-physicist-r2.json`.
