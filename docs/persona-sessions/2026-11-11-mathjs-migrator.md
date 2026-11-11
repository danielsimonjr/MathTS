# mathjs-migrator — persona dogfood, 2026-11-11

I am shipping a production mathjs app to browsers, Node, Bun, and Deno. The advertised path is `import { create, all } from '@danielsimonjr/mathts-compat'` and leave the rest of the call sites alone. I used **only published npm tarballs** in a scratch tree at `/tmp/mathts-migrator` (`npm i …@latest`). Oracle: **mathjs 13.2.3**. I did not build MathTS from this clone.

**Environment.** Node v22.23.4, Bun 1.4.4 (installed for this session), Deno 2.9.8, Linux 6.12.113 x86_64, Intel Xeon 4 vCPU. Packages: `@danielsimonjr/mathts-compat@0.4.52`, `core@0.26.0`, `functions@0.84.0`, `units@0.7.5`, `arithmetic@0.1.86`, `trigonometry@0.1.86`, `numbers@0.1.28` (transitive `matrix@0.10.0`, `parallel@0.10.0`, `expression@0.12.7`). Clone SHA at session start: `fef4010b8a468215a26bcdb9642db0556055b9bb`. Label: `persona:mathjs-migrator`.

**Docs I read first.** `docs/migration-guide.md` (title: mathjs **v15**, “call sites unchanged”), published `compat` README (already says there is no `math.import`), `examples/mathjs-migration.ts`.

## What I tried, in order

1. ESM `create(all)` vs mathjs `create(all)` for evaluate, config, BigNumber/Fraction parsing, units, matrices, chain, import/typed, trig/arithmetic edges (`compare.mjs`). **62 same / 13 different** on the first pass.
2. Deeper unit/trig/JSON/subset/typed surface (`deeper.mjs`).
3. Packaging: `exports`, CJS `require`, `tsc` with `moduleResolution` node16 and bundler (`skipLibCheck: false`), Bun, Deno `npm:` specifier, Vite 8 lib build, esbuild browser bundle, source maps, `sideEffects`.
4. ABBA microbench vs mathjs 13 on the compat instance (see JSON sibling).

Bun `create(all)` and Deno `npm:@danielsimonjr/mathts-compat@0.4.52` both ran `add` / `evaluate` successfully.

## What worked (parity with mathjs 13.2.3)

- `evaluate('sin(pi/2)')` → 1; `evaluate('x^2 + y', {x:3,y:4})` → 13; `0.1+0.2` float; `2 inch to cm` → `5.08 cm`; `5 cm + 2 inch` → `10.08 cm`; `1 km/h to m/s`; `sqrt(-4)` → `2i`; `1/0`, `-1/0`, `0/0`; `2!`; `sum`/`det` in evaluate.
- `create(all, { number: 'BigNumber' })` then `evaluate('0.1 + 0.2')` → `0.3`; Fraction config `1/3+1/6` → `1/2`. Instance config did **not** leak into bare `functions.evaluate` (compat README is right about isolation).
- Units: `100 degC` → `K`/`degF` (MathTS `212 degF` vs mathjs `211.999…`); `32 degF` → `degC`; `1 N` equals `1 kg m / s^2`; prefixes `kN`/`mN`; `createUnit('myinch', …)`; `splitUnit`.
- Matrices: `det`, `identity(2)`, `lusolve`, `inv`, `chain(3).add(4).multiply(2)`, transpose chain, `complex` JSON, `parse('1+2').toString()`.
- `sqrt(-1)` → `i`; `cbrt(-8)` → `-2`; `sin(1e16)` matched mathjs; `log(complex(-1,0))` matched.
- `add`/`sin` from the thin `arithmetic` / `trigonometry` re-export packages run at runtime.

## Findings

GitHub comments on duplicates **#696, #697, #707, #708** returned `Resource not accessible by integration`; the extra repros are below and in those issues’ intended comments.

| #   | Sev | Issue                                                      | Title                                                                   |
| --- | --- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | P0  | [#727](https://github.com/danielsimonjr/MathTS/issues/727) | `evaluate('sin(90 deg)')` throws (`Unit` not accepted by `sin`)         |
| 2   | P0  | [#728](https://github.com/danielsimonjr/MathTS/issues/728) | compat `asin` is `Math.asin` → `NaN` vs mathjs/functions Complex        |
| 3   | P0  | [#729](https://github.com/danielsimonjr/MathTS/issues/729) | `log(-1)` / `pow(-8,1/3)` / `nthRoot(-8,3)` / `acosh(0)` → `NaN`        |
| 4   | P1  | [#730](https://github.com/danielsimonjr/MathTS/issues/730) | no `math.import`                                                        |
| 5   | P1  | [#731](https://github.com/danielsimonjr/MathTS/issues/731) | no `math.typed`                                                         |
| 6   | P1  | [#732](https://github.com/danielsimonjr/MathTS/issues/732) | no `math.compile` (only `compileExpr` on functions)                     |
| 7   | P1  | [#733](https://github.com/danielsimonjr/MathTS/issues/733) | `subset` / `index` throw `value.subset is not a function`               |
| 8   | P1  | [#734](https://github.com/danielsimonjr/MathTS/issues/734) | `reviver` does not restore Unit or BigNumber                            |
| 9   | P1  | [#735](https://github.com/danielsimonjr/MathTS/issues/735) | scalar `add` ~18× slower than mathjs 13                                 |
| 10  | P1  | [#736](https://github.com/danielsimonjr/MathTS/issues/736) | CJS `require()`: no `exports.require`                                   |
| 11  | P1  | [#737](https://github.com/danielsimonjr/MathTS/issues/737) | `add`/`sin` typed as `unknown`                                          |
| 12  | P1  | [#738](https://github.com/danielsimonjr/MathTS/issues/738) | migration guide “drop-in / v15” vs actual holes                         |
| 13  | P2  | [#739](https://github.com/danielsimonjr/MathTS/issues/739) | `createUnit('furlong')` — name already built in                         |
| 14  | P2  | [#740](https://github.com/danielsimonjr/MathTS/issues/740) | no JS source maps                                                       |
| 15  | P2  | [#741](https://github.com/danielsimonjr/MathTS/issues/741) | no `sideEffects` field; ~2.7–3.0 MB `create(all)` browser bundle        |
| 16  | P2  | [#742](https://github.com/danielsimonjr/MathTS/issues/742) | unit `toString` ULP vs mathjs (inch / mL / degF)                        |
| 17  | P2  | [#743](https://github.com/danielsimonjr/MathTS/issues/743) | `fraction(0.1).toString()` is `1/10` not `0.1`                          |
| 18  | P2  | [#744](https://github.com/danielsimonjr/MathTS/issues/744) | `size(zeros(2,3))` is a JS array (`"2,3"`) not a Matrix                 |
| dup | P2  | [#696](https://github.com/danielsimonjr/MathTS/issues/696) | `./package.json` not in `exports` (reproduced)                          |
| dup | P2  | [#697](https://github.com/danielsimonjr/MathTS/issues/697) | workerpool types need `@types/node` (reproduced via compat)             |
| dup | P1  | [#707](https://github.com/danielsimonjr/MathTS/issues/707) | huge evaluate bundle (compat path **2.7 MB** Vite / **3.0 MB** esbuild) |
| dup | P1  | [#708](https://github.com/danielsimonjr/MathTS/issues/708) | static/dynamic Node builtins; esbuild browser fail, Vite externalizes   |

Intended labels on every new issue: `dogfood` + `bug`/`api`/`perf`/`docs`/`packaging` + `P0`/`P1`/`P2` + `persona:mathjs-migrator` (first line of each body; this token cannot apply labels).

## Packaging notes (not filed twice)

- ESM `"exports"."import"` works on Node, Bun, Deno `npm:`.
- `require('@danielsimonjr/mathts-compat')` → `ERR_PACKAGE_PATH_NOT_EXPORTED` (#736).
- `tsc` node16 and bundler: workerpool `#697` **and** `unknown` returns `#737`.
- No `index.js.map` (#740). `sideEffects` omitted (#741).
- Vite “succeeds” by externalizing `fs`/`crypto`/`worker_threads`; esbuild refuses without aliases (#708).

## Verdict

**Not a drop-in for a real mathjs 13+ app.** Arithmetic, evaluate of unit-free expressions, BigNumber/Fraction **parse config**, chain, and many conversions work. The blockers for my port are: trig on degree units (#727), inverse-trig / negative-real principal values (#728, #729), missing `import`/`typed`/`compile` (#730–#732), `subset` (#733), JSON revive of units and BigNumbers (#734), CJS and browser bundling (#736, #708, #707), and `create(all)` scalar `add` at ~18× mathjs (#735). I would keep mathjs in production until those P0/P1 items land, and treat the typed packages as a parallel rewrite rather than a shim.

Bench numbers: `docs/persona-sessions/bench/2026-11-11-mathjs-migrator.json`.
