# Symbolic user — npm dogfood round 2, 2026-11-12

Label: `persona:symbolic-user`. I still think in SymPy/Mathematica/mathjs terms: parse a real grammar, round-trip to string/TeX, run CAS, compile with scopes, keep exact arithmetic. Round 2 uses **published npm only** (release `cb254e81`, 2026-11-12) — scratch project `/tmp/mathts-symbolic-r2`, no monorepo imports.

## Environment

- npm (registry, `npm ls` deduped): **core 0.27.0**, **functions 0.85.0**, **expression 0.13.0**, **parser 0.1.35**, **ast 0.1.34**, **evaluator 0.1.34**, **numbers 0.1.29**
- Node **v22.23.4**, Linux x86_64, plain ESM + strict TypeScript consumer project
- Oracle: **SymPy 1.14.0**; competitor: **mathjs 15.2.0**
- Bench JSON: [`bench/2026-11-12-symbolic-user-r2.json`](./bench/2026-11-12-symbolic-user-r2.json)

## Goal, in order

Re-verify round-1 issues #714–#726. Re-run grammar corpus, CAS vs SymPy, sandbox, precision, README/API alignment across parser/ast/expression/evaluator/numbers, and parse/evaluate speed vs mathjs.

## What I tried

### 1. Install and thin packages

`npm i` the expression stack at the versions above. README path `import { parse, createParse } from '@danielsimonjr/mathts-parser'` — **default `parse` works** (`2+3`). **`createParse()` still throws** (same `typed` undefined as round 1). Evaluator: **`evaluate('2+3')` and `compileExpression('2+3')()` work** from `@danielsimonjr/mathts-evaluator`; **`createEvaluate()` still throws** weak-map key. Regression filed [#883](https://github.com/danielsimonjr/MathTS/issues/883) (could not comment on closed #715 — token 403).

### 2. Grammar corpus (functions `parse` / `evaluate`)

| Area | Result |
| --- | --- |
| Precedence `2+3*4`, right-assoc `2^3^2`, unary `-2^2`, `2*-3` | OK, matches mathjs semantics |
| Implicit `2(3+4)`, `2x`, `x y` | OK with scope |
| `5!`, matrices `[[1,2],[3,4]]` | OK; TeX bmatrix |
| `π`, `sin(π/2)` | **Fixed** — evaluate resolves π (#720) |
| `√2` | Parses as postfix **`2√`**; numeric value correct but AST/TeX wrong → [#885](https://github.com/danielsimonjr/MathTS/issues/885) |
| `1e` | **Fixed** — `SyntaxError` not implicit `e` (#723) |
| Malformed `1+*2`, `(` imbalance, `x[1` | Char-indexed errors |
| Nesting | **125** parentheses evaluates; **126** throws limit (#722 fixed vs docs) |
| `x=3`, `f(x)=x^2` evaluate | Blocked unless `{ unsafe: true }`; README now documents (#725 docs fix) |
| `sum(i,1,3,i)` | **Throws** with guidance to use `summation()` API — not wrong `4+2i` (#721 fixed) |
| `sum(k,1,3,k)` in expression | Undefined symbols (mathjs same — not a product bug) |

### 3. CAS vs SymPy 1.14

| op | MathTS 0.85.0 | SymPy 1.14 | Notes |
| --- | --- | --- | --- |
| `simplify('x^2+2*x+1')` | `(x + 1) ^ 2` / `(x+1)^2` | `(x+1)**2` | **Fixed** (#716) |
| `expand('(x+1)^2')` | `1 + 2*x + 1*x^2` | `x**2 + 2*x + 1` | [#887](https://github.com/danielsimonjr/MathTS/issues/887) P2 |
| `factor` | `(x+1)^2` | same | Fixed |
| `derivative` / `casDerivative` | `cos(x)*x+sin(x)` | match | **Fixed** (#718) |
| `integrate('1/x')` / `symbolicIntegral` | both `log(abs(x))` style | `log(x)` vs abs variant | **Aligned** (#717) |
| `solve('x^2-2')` | `±sqrt(2)` symbolic | `±sqrt(2)` | **Fixed** (was #719) |
| `solve('sin(x)=0')` | **63 floats** | `{0, π}` principal | **Not fixed** → [#884](https://github.com/danielsimonjr/MathTS/issues/884) |
| `substitute('x^2+y',{x:2})` | `4 + y` | `4+y` | **Fixed** (#724) |
| `rationalize('1/x+1/y')` | `(y+x)/(x*y)` | match | OK |

### 4. Compile, sandbox, precision

- `compileExpr('2*x+y').evaluate({x:3,y:4})` → 10.
- Prototype pollution via evaluate blocked (assignment validator).
- `new BigNumber(1).toString()` → **`1`** ([#714](https://github.com/danielsimonjr/MathTS/issues/714) fixed). README matches `from` / `new BigNumber(1)`.
- `bignumber(0.1)+bignumber(0.2)` → `0.3`; fractions OK.

### 5. Types / packaging

Strict `skipLibCheck: false` on **functions-only** consumer without `@types/node`: **workerpool `.d.ts` errors** persist → [#886](https://github.com/danielsimonjr/MathTS/issues/886) (regression vs closed #697). With `@types/node` + `"types":["node"]`, `consumer.ts` typechecks; `evaluate` is a typed `function` not `unknown` (GPUBuffer not hit on 0.85.0 — #726 appears fixed).

### 6. Speed vs mathjs

See JSON. Headlines: scoped **evaluate ~0.28×** mathjs median; **parse ~1.0×** on short strings; **200-term parse ~0.82×** (faster than R1’s 1.14×); compiled eval **~1.04×** (tie). Ad-hoc 200-term sum **evaluate** probe ~0.07 ms vs mathjs ~2.8 ms (not a gate row).

## Round-1 re-check (#714–#726)

| # | Fixed? | Round-2 note |
| --- | --- | --- |
| 714 `new BigNumber(1)` | **yes** | `toString()` → `1` |
| 715 parser/evaluator factories | **partial** | `parse`/`evaluate`/`compileExpression` wired; zero-arg `createParse`/`createEvaluate` fail → #883 |
| 716 simplify/factor | **yes** | `(x+1)^2` |
| 717 integrate 1/x | **yes** | both log(abs(x)) |
| 718 casDerivative | **yes** | same as derivative |
| 719 solve | **partial** | `x^2-2` symbolic; `sin(x)=0` still numeric → #884 |
| 720 unicode π | **yes** | eval 3.14…; `sin(π/2)=1` |
| 721 sum(i,1,3,i) | **yes** | throws with actionable message |
| 722 nesting 125 | **yes** | 125 ok, 126 limit |
| 723 `1e` | **yes** | syntax error |
| 724 substitute fold | **yes** | `4 + y` |
| 725 assignment docs | **yes** | README documents `{ unsafe: true }` |
| 726 GPU types / evaluate unknown | **mostly** | no GPUBuffer in repro; workerpool still #886 |

## Findings (round 2)

| # | Sev | Issue |
| --- | --- | --- |
| 1 | P1 | [#883](https://github.com/danielsimonjr/MathTS/issues/883) Regression: zero-arg `createParse`/`createEvaluate` |
| 2 | P1 | [#884](https://github.com/danielsimonjr/MathTS/issues/884) Regression: `solve('sin(x)=0')` 63 roots |
| 3 | P1 | [#885](https://github.com/danielsimonjr/MathTS/issues/885) Unicode `√2` → AST `2√` |
| 4 | P2 | [#886](https://github.com/danielsimonjr/MathTS/issues/886) Regression: workerpool types without `@types/node` |
| 5 | P2 | [#887](https://github.com/danielsimonjr/MathTS/issues/887) `expand` term order / `1*x^2` |

## Summary & verdict

The **A-Team relay materially improved** the symbolic path I care about: simplify/factor, π, substitute, polynomial `solve` for `x^2-2`, BigNumber ctor, derivative/casDerivative, and several parse edge cases (`1e`, nesting). The **wired functions stack** is faster than mathjs on scoped evaluate and competitive on parse.

I would still hesitate to call this “SymPy-grade” on npm: **thin-package factories** for custom scopes are broken at zero arity ([#883](https://github.com/danielsimonjr/MathTS/issues/883)), **transcendental solve** dumps floats ([#884](https://github.com/danielsimonjr/MathTS/issues/884)), and **Unicode sqrt** builds the wrong tree ([#885](https://github.com/danielsimonjr/MathTS/issues/885)). TypeScript strict onboarding still needs `@types/node` ([#886](https://github.com/danielsimonjr/MathTS/issues/886)). I did **not** fix any of this in round 2.
