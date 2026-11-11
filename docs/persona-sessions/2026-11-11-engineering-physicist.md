# Engineering physicist — npm dogfood, 2026-11-11 (round 3)

I am wiring a browser physics calculator and simulation dashboard: SI/imperial units, CODATA constants, ODE/PDE workloads, complex impedances, then Vite + Playwright with plot/gpu/parallel.

I did **not** build MathTS from the repo. Scratch projects: `/tmp/phys-dash` (Node ESM + Vite) and `/tmp/phys-dash-ts` (strict `tsc`). Packages from npm `@latest` as of this session. Repo SHA I compared against: `fef4010b8a468215a26bcdb9642db0556055b9bb`. Node v22.23.4, Linux x64, Intel Xeon ×4. Playwright Chromium 131 headless-shell. Rounds 1–2 already own #688–#787; I also scanned #788–#821 from concurrent personas and linked overlaps in new issue bodies (GitHub comments 403 for this token).

## What I tried, in order

1. SI derived units N, J, W, Pa, Hz, ohm, F, H, T, Wb and conversions to SI base products — all `toNumber()` **1**.
2. Imperial: 1 mi = 1.609344 km, 1 in = 2.54 cm, 1 ft = 0.3048 m, 1 lb = 0.45359237 kg, 1 gal = 3.785411784 L, 1 hp = 745.6998715822702 W, 1 psi = 6894.757293168362 Pa, 1 mph = 0.44704 m/s. These match the usual exact US survey/avoirdupois figures. `toNumber` prints a deprecation warning (`use toNumeric`).
3. `F.add(1 m, 2 m)` → `3 m`. `F.add(1 m, 1 s)` throws a plain `Error`, not `DimensionMismatchError`. `Unit` has `.multiply` (2 m × 3 s → `6 m s`) but **no `.add`**. `new Unit(1,'m').to('s')` _does_ throw `DimensionMismatchError`.
4. Temperature: 0 °C → 273.15 K, 32 °F → 273.15 K, 212 °F → 100 °C. Good.
5. dB/dBm/Np refused. `1 B` is a byte (`8 bits`), not a bel.
6. Format: `1234.567 m` → `1.234567 km`; `{precision:4}` → `1.235 km`. Fine for sig-figs-ish display.
7. Unit matrix add of matching metres works (`[[4 m, 6 m]]`). Mismatch throws. `multiply(Unit, number[])` is typed-function “too few arguments”.
8. **CODATA 2022 check** of published `functions` constants vs NIST `allascii.txt`. Central values I sampled **match** 2022 (c, h, e, k, N_A, m_e, m_p, m_n, m_d, G, α, a_0, r_e, R_∞, μ_0, ε_0, Z_0, Φ_0, G_0, R_K, K_J, σ, Wien wavelength, F, R, u, …). **No uncertainties** on the objects. `evaluate('e')` is Euler; `physicsScope().e` is 160.2176634 zC; `evaluate('G')` is the symbol `G`.
9. SHO `x''=-4x`, RK45, `[0,π]`: 173 steps, max |x−cos(2t)| = 1.31e-10, energy drift −5.2e-10. `[0,100]` `tol 1e-10` hits default `maxIter` 1e5. Two-body Kepler `[0,10000]` same. With `maxIter: 1e6`, t=1e4 SHO finishes in 540336 steps.
10. Projectile with linear-in-|v| drag, 6 s, 316 steps — ran; no closed form checked beyond “it integrated”.
11. `integrate(Math.sin, 0, π)` crashes `expr.trim`. `quad` and string `integrate` both give 2.
12. `solvePDE` heat, nx=21, nt=5, T=1, α=1: CFL r=80, **finite wrong** midpoint −0.858 vs exp(−π²)≈5.16e-5. `solveParabolicPDE` with `{type:'dirichlet', value:0}` is accurate (maxErr 6.2e-4 at T=0.05, nx=21, 17 ms). `bcLeft: 0` **hangs**.
13. Numeric RLC at 60 Hz, R=10, L=0.01, C=1e-6: `Z = 10 − 2648.81i` (1/jωC dominates). `multiply(complex(0,1), new Unit(2,'ohm'))` throws.
14. `sin(new Unit(90,'deg'))` throws in functions and trigonometry.
15. Tensor 3-vector: no `.cross` / `.dot`.
16. Strict `tsc`: `Unit` is not a type (TS2749); GPUBuffer and workerpool Node types as in #726/#697.
17. **Browser:** Vite 6 + Playwright. Units + `solveODE` + `plot.line` SVG all work. Load ~2.1–3.1 s. rAF p50 16.7 ms. `sin(n=65536)` ~1 ms. `hasWebGPU() true`, `initializeGlobalGPU() false`, `status 'error'`. Vite **dev** 404 `/node_modules/.vite/deps/worker.js`; pool `parallelized: false`. `vite build` 1138.32 kB JS (gzip 348.75 kB) plus 14 kB worker chunk; Vite externalizes `node:fs`/`path`/`url` from core (#708).

I did not fix any of this. Issues #822–#836; comments on #707/#708/#726/#757/#759/#727/#806 were 403.

## Findings

| #   | Sev | Issue                                                      | Title                                                                               |
| --- | --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | P0  | [#822](https://github.com/danielsimonjr/MathTS/issues/822) | `solvePDE` ignores CFL r>0.5 and returns a silently wrong heat profile              |
| 2   | P0  | [#823](https://github.com/danielsimonjr/MathTS/issues/823) | `multiply(Complex, Unit)` throws Too few arguments (no unitful jωC)                 |
| 3   | P1  | [#824](https://github.com/danielsimonjr/MathTS/issues/824) | `solveODE` default maxIter 1e5 aborts SHO t=100 and long orbits                     |
| 4   | P1  | [#825](https://github.com/danielsimonjr/MathTS/issues/825) | dB/dBm/Np are refused; B is byte not bel                                            |
| 5   | P2  | [#826](https://github.com/danielsimonjr/MathTS/issues/826) | `add(m,s)` throws plain Error, not `DimensionMismatchError`; Unit has no add        |
| 6   | P1  | [#827](https://github.com/danielsimonjr/MathTS/issues/827) | CODATA constants have values but no uncertainties                                   |
| 7   | P1  | [#828](https://github.com/danielsimonjr/MathTS/issues/828) | `evaluate("e")` is Euler; `physicsScope().e` is charge in zC; G unbound             |
| 8   | P1  | [#829](https://github.com/danielsimonjr/MathTS/issues/829) | Vite dev 404s parallel `worker.js` so ComputePool never parallelizes in the browser |
| 9   | P2  | [#830](https://github.com/danielsimonjr/MathTS/issues/830) | `Unit` cannot be used as a TypeScript type (TS2749)                                 |
| 10  | P2  | [#831](https://github.com/danielsimonjr/MathTS/issues/831) | Tensor has no cross or dot for 3-vectors                                            |
| 11  | P2  | [#832](https://github.com/danielsimonjr/MathTS/issues/832) | `integrate(Math.sin, 0, π)` throws `expr.trim is not a function`                    |
| 12  | P1  | [#833](https://github.com/danielsimonjr/MathTS/issues/833) | `solveParabolicPDE({bcLeft:0})` hangs                                               |
| 13  | P1  | [#834](https://github.com/danielsimonjr/MathTS/issues/834) | `sin(new Unit(90,"deg"))` throws                                                    |
| 14  | P1  | [#835](https://github.com/danielsimonjr/MathTS/issues/835) | `hasWebGPU()` true in Chromium but init false / status error                        |
| 15  | P2  | [#836](https://github.com/danielsimonjr/MathTS/issues/836) | plot is static SVG only; no live canvas update                                      |

Intended labels on every issue: `dogfood`, one of `bug|api|perf|docs|packaging`, `P0|P1|P2`, `persona:engineering-physicist` (first line of each body; this token cannot apply labels).

Overlaps (not re-filed): #726 GPUBuffer types, #697 workerpool `@types/node`, #707 1.13 MB functions import, #708 Node builtins in core/matrix, #757/#710 ComputePool sequential, #759 GPUContext error on Node, #727 compat `sin(90 deg)`, #780 plot PNG native renderer, #806 WorkerPool workerScript.

## What was fine

Derived-unit identities; US customary conversions I checked; temperature affine conversions; CODATA **central** values vs 2022; short SHO energy conservation; `quad`; numeric (unitless) RLC; `solveParabolicPDE` when BCs are objects; plot SVG in Chromium; Vite can actually boot the dashboard despite Node builtin warnings.

## Verdict

I can convert units and integrate a short oscillator in the browser. I cannot trust `solvePDE`, unitful AC circuits, dB, `e`/`G` in `evaluate`, long orbits at default ODE settings, Vite workers, or WebGPU feature detection. Constants are CODATA-2022 numbers without ±u. The dashboard is a 1.1 MB static-SVG page on the main thread.

Bench JSON: `docs/persona-sessions/bench/2026-11-11-engineering-physicist.json`.
