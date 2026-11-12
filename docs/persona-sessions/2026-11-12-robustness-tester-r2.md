# Persona session — robustness tester, round 2 (2026-11-12)

I am a security and robustness engineer fuzzing published MathTS packages before they
parse user input on a server. Round 2 exercises **npm registry installs only**
(release merge `cb254e81`, versions in `persona-common-r2.txt`). I did not build from
this repo or import internals.

**Goal:** re-run round-1 repros (#806–#820), replay the fast-check harness, and hunt for
regressions plus new sandbox/DoS/type edge cases on parser, evaluator, expression,
functions, core, matrix, units, numbers, workbook, workerpool, and parallel.

**What I did not do:** patch library code (owner rule: report only).

## Environment

- Scratch: `/tmp/mathts-robust-r2`, Node `v22.23.4`, ESM
- OS: Linux 6.12.113+ x86_64, 4× Xeon KVM
- Packages (`npm ls` matches round-2 list): core 0.27.0, functions 0.85.0, parser 0.1.35,
  evaluator 0.1.34, expression 0.13.0, matrix 0.10.1, units 0.7.6, numbers 0.1.29,
  workbook 0.5.19, parallel 0.10.1, workerpool 0.4.1, arithmetic 0.1.87, compat 0.5.0
- Property / fuzz seed: **20261112** (`fast-check`)
- Bench JSON: `docs/persona-sessions/bench/2026-11-12-robustness-tester-r2.json`
- Harness script (scratch): adapted from `2026-11-11-robustness-tester.harness.mjs.txt`
  as `/tmp/mathts-robust-r2/r2-harness.mjs` (round-1 assertions inverted for fixed bugs)

Default `parse` / `evaluate` on thin packages now work per README (`parser.parse('2+3')`,
`evaluator.evaluate('2+3')` → 5). `createParse()` / `createEvaluate()` zero-arg factories
remain broken (open #883, confirmed here).

## What I tried, in order

1. **Round-1 harness replay** on npm — P0 WorkerPool (#806) and core null crashes (#807)
   fixed; `parse`/`typed` no longer leak from `evaluate` (#808); overflow literals throw
   (#809); matrix zeros cap (#810); unit invalid-string scaling improved (#811).

2. **Sandbox / denylist** — constructor, `__proto__`, `eval`, `import.meta`, `Function()`,
   `sin.constructor` denied. Object literal `{__proto__: …}` evaluates without polluting
   `({}).polluted`. `evaluate('process', {process})` now throws host-object guard (#816).
   Assignment and `evaluate()` in workbook cells blocked. Symbol `chain` in default evaluate
   is the **length unit** `chain`, not mathjs `Chain` (confusing but not a leak).

3. **DoS limits** — Parenthesis nesting accepts **125** levels, rejects at **126** (off-by-one
   from round-1 / #722 now aligned). Compile depth 512 and unary-minus depth 500 enforced.
   Expression length >1e6 rejected. `factorial(200)` / `2^10000` → `Infinity` without hang.

4. **Invalid types** — `add`/`addScalar` reject null with typed errors (#813 behavior change
   vs round-1). `DenseMatrix` 2D ctor and `multiply(2)` scalar path fixed (#814/#815).

5. **Units** — `Unit(NaN,'m')` rejected (#819). **#812 regression:** `new Unit(180,'deg').value`
   still `Math.PI` on units@0.7.6 → filed [#921](https://github.com/danielsimonjr/MathTS/issues/921).

6. **Parser edge cases** — `parse('1e')` throws `Digit expected` (#723 fixed).
   `parse('𝟙')` succeeds but `evaluate('𝟙')` fails → [#922](https://github.com/danielsimonjr/MathTS/issues/922).

7. **Arithmetic fuzz** — `mod(10,0)` → silent `NaN` → [#923](https://github.com/danielsimonjr/MathTS/issues/923).
   fast-check 600 random strings (len ≤100) and 300 `add` commute pairs: no non-Error throws.

8. **Thin-package factories** — `createParse(create(all))` missing fourteen AST node
   constructors → [#924](https://github.com/danielsimonjr/MathTS/issues/924). Zero-arg
   `createParse()` / `createEvaluate()` still throw (see #883).

9. **Workers** — `new WorkerPool()` without script throws synchronously (#806 fixed).
   `ComputePool.initialize()` + parallel `sin` OK. `loadWasm()` from functions succeeds.

10. **Workbook** — formula injection of `__proto__` / `process` / nested `evaluate` denied;
    `constructor` object key no longer kills the graph (#818 fixed).

## Round-1 re-check table

| Issue | Fixed on npm? |
| ----- | ------------- |
| [#806](https://github.com/danielsimonjr/MathTS/issues/806) WorkerPool missing script | yes |
| [#807](https://github.com/danielsimonjr/MathTS/issues/807) addScalar null `.im` crash | yes |
| [#808](https://github.com/danielsimonjr/MathTS/issues/808) parse/typed leak | yes |
| [#809](https://github.com/danielsimonjr/MathTS/issues/809) silent Infinity literals | yes (SyntaxError) |
| [#810](https://github.com/danielsimonjr/MathTS/issues/810) huge zeros | yes (element cap) |
| [#811](https://github.com/danielsimonjr/MathTS/issues/811) unit string DoS | yes (sublinear ratio) |
| [#812](https://github.com/danielsimonjr/MathTS/issues/812) deg `.value` radians | **no** → #921 |
| [#813](https://github.com/danielsimonjr/MathTS/issues/813) add null/string | yes (stricter types) |
| [#814](https://github.com/danielsimonjr/MathTS/issues/814) DenseMatrix 2D ctor | yes |
| [#815](https://github.com/danielsimonjr/MathTS/issues/815) multiply scalar | yes |
| [#816](https://github.com/danielsimonjr/MathTS/issues/816) host scope exfiltration | yes |
| [#817](https://github.com/danielsimonjr/MathTS/issues/817) block comments | yes |
| [#818](https://github.com/danielsimonjr/MathTS/issues/818) workbook constructor key | yes |
| [#819](https://github.com/danielsimonjr/MathTS/issues/819) Unit NaN | yes |
| [#820](https://github.com/danielsimonjr/MathTS/issues/820) chunkTyped export docs | yes (README table) |

## Findings (round 2)

| # | Sev | Title | Labels (intended) |
| --- | --- | --- | --- |
| [921](https://github.com/danielsimonjr/MathTS/issues/921) | P1 | Regression: Unit.value for deg still radians (#812) | dogfood, bug, P1, persona:robustness-tester |
| [922](https://github.com/danielsimonjr/MathTS/issues/922) | P2 | parse accepts 𝟙 but evaluate throws | dogfood, api, P2, persona:robustness-tester |
| [923](https://github.com/danielsimonjr/MathTS/issues/923) | P2 | mod(10,0) silent NaN | dogfood, api, P2, persona:robustness-tester |
| [924](https://github.com/danielsimonjr/MathTS/issues/924) | P1 | createParse(create(all)) missing AST deps | dogfood, api, P1, persona:robustness-tester |

Also verified open [#883](https://github.com/danielsimonjr/MathTS/issues/883) (zero-arg
`createParse` / `createEvaluate`); did not duplicate.

## Verdict

I would deploy default `evaluate(userString)` with **thin evaluator safe mode** for
arithmetic-only sandboxes (`@danielsimonjr/mathts-evaluator` wired `evaluate` blocks
`parse` and assignment). For full `functions` evaluate, the 2026-11-12 release materially
hardened host-object returns and symbol leaks. I would still not trust angle `.value` for
user-facing degrees until #921 is fixed, and I would guard `mod` with a zero check client-side.

Random grammar fuzz (seed 20261112) did not surface hangs, ReDoS, or stack overflows under
published caps. Four new issues filed; one round-1 item (#812) regressed on npm.
