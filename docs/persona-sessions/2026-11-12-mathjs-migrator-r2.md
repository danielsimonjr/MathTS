# mathjs-migrator — persona dogfood round 2, 2026-11-12

I am still the production mathjs migrator: browsers, Node, Bun, Deno, bundlers. This round I used **only published npm tarballs** in `/tmp/mathts-migrator-r2` at the versions from persona-common-r2. Oracle: **mathjs 13.2.3**. I did not build MathTS from source for behavior tests (clone read-only for docs + this PR).

**Environment.** Node v22.23.4, Bun 1.2.18, Deno 2.4.4, Linux 6.12.113 x86_64, Intel Xeon 4 vCPU. Direct installs: `@danielsimonjr/mathts-compat@0.5.0`, `core@0.27.0`, `functions@0.85.0`, `units@0.7.6`, `arithmetic@0.1.87`, `trigonometry@0.1.87`, `numbers@0.1.29`. Transitive: `matrix@0.10.1`, `expression@0.13.0`, `parallel@0.10.1`, `gpu@0.3.0`. `npm ls` shows no version skew vs the published list. Label: `persona:mathjs-migrator`.

**Docs.** `docs/migration-guide.md` compat matrix (Nov release), published compat README, round-1 log `2026-11-11-mathjs-migrator.md`.

## What I tried, in order

1. **Parity harness** (`compare.mjs`): evaluate, config, BigNumber/Fraction, units, matrices, chain, import/typed/compile/subset/reviver, trig edges — **37 same / 4 different** of 41 checks.
2. **Round-1 repro script** (`recheck-round1.mjs`) against closed #727–#744.
3. **Deep units + import** (`deeper.mjs`, `import-typed.mjs`): custom units, temperature, compound parsing, `import`/`compile`/`typed`, predictable config.
4. **Packaging**: `exports`, CJS `require`, `tsc` node16 + bundler (`skipLibCheck: false`), Bun, Deno `npm:`, Vite 6 lib build, esbuild browser, source maps, `sideEffects`.
5. **ABBA bench** vs mathjs (`bench.mjs`); numbers in bench JSON.

## What improved since round 1 (published 0.5.0)

- P0 evaluate/trig: `sin(90 deg)`, `asin(2)`, `log(-1)`, `nthRoot(-8,3)`, `acosh(0)` match mathjs principal values (#727–#729).
- API surface: `import`, `typed`, `compile`, `subset`/`index`, JSON `reviver` for Unit/BigNumber (#730–#734).
- Scalar **`add` perf** ~1.14× mathjs (#735 fix holds).
- Packaging: `./package.json` export, `index.js.map`, `sideEffects: true` (#696, #740, #741).
- `size(zeros(2,3))` returns a Matrix object (#744).
- `fraction(0.1).toString()` matches `0.1` (#743).
- Migration guide compat table matches spot checks for import/compile/subset/reviver.

## Findings (round 2)

| #   | Sev | Issue                                                      | Title                                                 |
| --- | --- | ---------------------------------------------------------- | ----------------------------------------------------- |
| 19  | P1  | [#888](https://github.com/danielsimonjr/MathTS/issues/888) | Regression: CJS `require()` (#736)                    |
| 20  | P1  | [#889](https://github.com/danielsimonjr/MathTS/issues/889) | `sin(0.5)` scalar ~18× slower (add fixed)             |
| 21  | P1  | [#890](https://github.com/danielsimonjr/MathTS/issues/890) | Regression: `tsc` GPUBuffer + workerpool (#726, #697) |
| 22  | P1  | [#893](https://github.com/danielsimonjr/MathTS/issues/893) | Regression: esbuild browser bundle (#708)             |
| 23  | P2  | [#891](https://github.com/danielsimonjr/MathTS/issues/891) | matrix `toString` formatting                          |
| 24  | P2  | [#892](https://github.com/danielsimonjr/MathTS/issues/892) | Fraction mode `0.(3)` vs `1/3`                        |
| —   | P2  | [#742](https://github.com/danielsimonjr/MathTS/issues/742) | comment failed (token); 100 degC→degF still differs   |

GitHub comments on **#736, #708, #742** returned `Resource not accessible by integration`; repros are in #888/#893 and the 742 note above.

## Remaining parity diffs (not filed — cosmetic / documented)

- `pow(-8,1/3)` complex string epsilon vs mathjs.
- Fraction config sum `1/3+1/6` → `1/2` vs mathjs `0.5` string (value OK).
- Unit strings: `100 degC`→`degF`, `500 mL` (#742 partial).
- Chain/matrix `toString` layout (#891).

## Packaging notes

- ESM import works on Node, Bun, Deno `npm:@danielsimonjr/mathts-compat@0.5.0`.
- CJS `require` still throws (#888).
- `tsc` with `skipLibCheck: false` fails on transitive GPU + workerpool types (#890).
- Vite browser lib: **3.21 MB** (+ wasm chunk 26.75 kB), gzip ~678 kB; externals Node builtins.
- esbuild `--platform=browser` hard-fails (#893).
- Compat `MathInstance` now types `add`/`sin` via shims; index signature still `unknown` for rare factories.

## Round-1 re-check table (closed issues #727–#744, #696–#708)

| Issue | Title (short)           | Fixed?                                                   |
| ----- | ----------------------- | -------------------------------------------------------- |
| #727  | `sin(90 deg)`           | yes                                                      |
| #728  | `asin` Complex          | yes                                                      |
| #729  | log/pow/nthRoot/acosh   | yes                                                      |
| #730  | `math.import`           | yes                                                      |
| #731  | `math.typed`            | yes                                                      |
| #732  | `math.compile`          | yes                                                      |
| #733  | subset/index            | yes                                                      |
| #734  | JSON reviver            | yes                                                      |
| #735  | scalar `add` perf       | yes                                                      |
| #736  | CJS require             | **no** → #888                                            |
| #737  | add/sin typed unknown   | partial (shims typed; `[name: string]: unknown` remains) |
| #738  | migration guide gaps    | yes (matrix matches npm 0.5.0)                           |
| #739  | createUnit furlong      | yes (still built-in; error matches mathjs)               |
| #740  | JS source maps          | yes                                                      |
| #741  | sideEffects             | yes (`true`)                                             |
| #742  | unit toString ULP       | partial (degF still differs)                             |
| #743  | fraction(0.1)           | yes                                                      |
| #744  | size(zeros)             | yes                                                      |
| #696  | package.json export     | yes                                                      |
| #697  | workerpool types        | **no** → #890                                            |
| #707  | huge evaluate bundle    | partial (Vite ~3.2 MB; still huge)                       |
| #708  | esbuild / Node builtins | **no** → #893                                            |

## Verdict

**Much closer to a real mathjs 13 port than round 1.** Evaluate, units (core conversions), matrices, chain, import/compile/typed, and JSON revive work on published 0.5.0. Blockers for my production cutover are now **packaging and perf**, not core math wrong answers: CJS (#888), strict TypeScript (#890), browser esbuild (#893), scalar **sin** cliff (#889), and bundle size/externalized Node shims. I would pilot compat for server-side ESM workloads first; keep mathjs for CJS-only or esbuild-only browser pipelines until #888/#893 land.

Bench: `docs/persona-sessions/bench/2026-11-12-mathjs-migrator-r2.json`.
