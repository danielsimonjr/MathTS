STARTED 2026-11-13T23:40:59-06:00

# symbolic-user — npm dogfood round 3, 2026-11-13

I am a dogfood tester, not a maintainer. I used only the published npm packages at the exact round-3 versions (all 24 `@danielsimonjr/mathts-*` packages, pinned as in the common brief; `npm ls --depth=0` matched, see `symbolic-user/install-ls.txt`). Node v26.13.0, Windows 11. Oracles: SymPy 1.14.0 (Python 3.13.14), mathjs 15.2.0, TypeScript (strict, skipLibCheck false, `types: []`). I did not change product code, did not file, comment on or close issues, and did not commit or push. Issue drafts are in `C:/Users/danie/mathts-dogfood-r3/symbolic-user-issues.md`.

## Goal

Re-check round-2 findings. Find issues nobody has reported, across every symbolic-area export, with edge inputs and chained combinations. The main effort was the export sweep (4c) and combinations (4e).

## What I tried, in order

1. Wrote `STARTED` to this report. Read the round-2 report (`docs/persona-sessions/2026-11-12-symbolic-user-r2.md`) with `gh api`. It has no "Issue index" section, so the round-2 issue list is the re-check table (#714-#726) plus the findings table (#883-#887).
2. Installed the 24 pinned packages in `symbolic-user/`. Versions matched.
3. Round-2 re-check. Read each issue with `gh issue view`. All of #883-#887 are CLOSED. Probes: `p/t13.mjs`, `p/t1.mjs`, `p/t3.mjs`, `p/t8.mjs`.
4. Discovery:
   a. Surface inventory of all 24 packages, `sweep-out`-independent: `symbolic-user-surface.txt` (2886 lines; `list-exports.mjs`).
   b. Persona tasks. Grammar and round trips (`p/t1.mjs`, `p/t2.mjs` vs mathjs, `p/t9.mjs`, `p/t10.mjs` C9/C10). CAS vs SymPy (`p/t3.mjs`, `p/t4.mjs`, `p/t5.mjs`, `p/t11.mjs`, `p/t12.mjs`; SymPy 1.14.0 oracle script `p/sympy_oracle.py` confirmed the expand (2.828 at x=1), factor, integral and divergence results cited below). solve and solveExact (`p/t6.mjs`). Compile and exact arithmetic (`p/t8.mjs`, `p/t9.mjs`). Node API (`p/t14.mjs`). TypeScript consumer (`tsc/`). The `renderPolynomial` task is not reachable: the export is not in the package `exports` map or the index (checked with `node -e` and the `ERR_PACKAGE_PATH_NOT_EXPORTED` error).
   c. Export sweep (the main work). `sweep/sweep-child.mjs` calls each function export with 26 single edge inputs (empty array and string, 0, -0, 1, -3, NaN, ±Infinity, Number.MAX_VALUE, subnormal, 0.5, 20, array, nested, ragged, Float64Array, string, expression string, {}, Fraction, BigNumber, Complex, true, null, three arguments) and 100 two-argument pairs. Each call is logged before and after, so a hang or crash names its call. `sweep/sweep-parent.mjs` restarts after each hang or crash. Logs: `sweep-out/mathts-*.jsonl`. Analysis: `sweep/analyze.mjs`. Coverage: `sweep/coverage.mjs` writes `symbolic-user-coverage.md`.
   d. Contracts: d.ts comments and README examples compared with runtime (findings below).
   e. Combinations: derivative vs finite differences (ok), symbolicIntegral then derivative (crash), simplify then re-evaluate (lossy), solve roots substituted back (ok), factor then expand (ok), parse, toString, parse fixed point (ok).
5. No bench (persona has none).
   5b. Coverage: see below.
6. Drafted 20 issues in `symbolic-user-issues.md`. Duplicate search with `gh issue list --search` on every keyword group. No duplicates. #966 (open, "CAS solve/expand follow-ups") is related but does not cover these failures.
7. This report.

## Round-2 re-check

| Issue | Title (short)                                            | Fixed? | Evidence                                                                                                                                                              |
| ----- | -------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #883  | zero-arg createParse/createEvaluate throw                | yes    | `createParse()('2+3')` = "2 + 3"; `createEvaluate()('2+3')` = 5 (`p/t1.mjs`)                                                                                          |
| #884  | solve("sin(x)=0") returns 63 floats                      | yes    | now throws with the documented message pointing to solveExact; `solveExact('sin(x) = 0')` = roots [0, pi], period 2*pi (`p/t6.mjs`)                                   |
| #885  | Unicode √2 parses as "2√"                                | yes    | `parse('√2').toString()` = "sqrt(2)"; `2√` still a SyntaxError (acceptable) (`p/t13.mjs`)                                                                             |
| #886  | strict tsc without @types/node fails on workerpool types | yes    | `tsc/tsconfig.json` strict, skipLibCheck false, types []: no workerpool error                                                                                         |
| #887  | expand("(x+1)^2") term order and 1*x^2                   | yes    | `expand('(x+1)^2')` = "x^2 + 2*x + 1" (`p/t3.mjs`). A new wrong-math bug with irrational constants is issue 2                                                         |
| #714  | new BigNumber(1).toString()                              | yes    | "1" (`p/t13.mjs`)                                                                                                                                                     |
| #715  | parser/evaluator factories                               | yes    | zero-arg works (see #883)                                                                                                                                             |
| #716  | simplify/factor of x^2+2x+1                              | yes    | "(x + 1) ^ 2"                                                                                                                                                         |
| #717  | integrate 1/x                                            | yes    | "log(abs(x))"                                                                                                                                                         |
| #718  | casDerivative sin(x)*x                                   | yes    | "cos(x) * x + sin(x)"                                                                                                                                                 |
| #719  | solve x^2-2 symbolic                                     | yes    | ["-sqrt(2)", "sqrt(2)"]; sin(x)=0 throws (see #884)                                                                                                                   |
| #720  | π in evaluate                                            | yes    | 3.141592653589793                                                                                                                                                     |
| #721  | sum(i,1,3,i)                                             | yes    | throws "use summation(expr, index, lo, hi) instead"                                                                                                                   |
| #722  | nesting limit 125                                        | yes    | 125 parentheses evaluate; 126 throws SyntaxError                                                                                                                      |
| #723  | "1e"                                                     | yes    | SyntaxError "Digit expected"                                                                                                                                          |
| #724  | substitute("x^2+y", {x:2})                               | yes    | "4 + y"                                                                                                                                                               |
| #725  | assignment needs unsafe                                  | yes    | throws, message says `{ unsafe: true }`; works with the option                                                                                                        |
| #726  | evaluate typed unknown; GPUBuffer in tsc                 | yes    | GPU error gone; `const n: number = evaluate("2+3")` compiles under strict tsc (checked, `tsc/unknown-check.ts`). simplify and derivative are still unknown (issue 11) |

## New findings (round 3)

Drafts for each are in `symbolic-user-issues.md`, in this order.

### P0

1. **simplify and derivative crash on sqrt, exp or log of a constant.** `simplify('sqrt(2)')`, `simplify('exp(1)*x')`, `derivative('sqrt(2)*x','x')` all throw "Cannot convert Complex number to Node". Also `derivative(symbolicIntegral('1/(x^2+1)','x'),'x')` throws because the integral contains `sqrt(4)`. mathjs `simplify('sqrt(2)')` returns a number.
2. **expand gives wrong mathematics for irrational constants.** `expand('sqrt(2)*(x+1)')` = "sqrt2*x + 2*1" (undefined symbol sqrt2; constant term 2, not sqrt(2)). `expand('exp(1)*(x+1)')` = "exp1*x + 1*1". `expand('log(2)*(x+1)')` = "log2*x + 2*1". `evaluate(expand('2^(1/2)*(x+1)'), {x:1})` = 1.5, expected 2.828. Silent.

### P1

3. **simplify prints a lossy number fraction.** `simplify('2^(1/2)*2^(1/2)')` = "4.43365544449e+11 / 2.21682772224e+11"; parsed back it evaluates to 2.000000000004511 (error 4.5e-12) against 2.0000000000000004 direct. `simplify('2^(1/2)')` returns the float 1.4142135623730951.
4. **nintegrate returns a finite value for a divergent integral.** `nintegrate(1/x, 0, 1)` = 41.689; `quad` on the same input reports error 1.846. The error estimate is dropped.
5. **sum, mean, variance, dot and min return a JS number for BigNumber and Fraction input.** `sum([BigNumber 0.1, 0.2])` = 0.30000000000000004 (number). `mean([1/2, 1/3])` = 0.41666666666666663 (number). `cumsum` and `prod` keep BigNumber, so the family is inconsistent.
6. **summation with a non-integer lower bound returns a wrong sum silently.** `summation('i','i',1.5,3)` = 4 (adds 1.5 and 2.5). Expected an error or a sum over integers.
7. **Fraction: README example and API.** README says `new Fraction(1,3).add(new Fraction(1,6)).toString()` is "1/2"; the runtime prints "0.5". No `n`, `d`, `s` fields. `new Fraction('1/3')` throws "Cannot convert 1/3 to a BigInt". mathjs `fraction('1/3')` works.
8. **bellNumbers(Number.MAX_VALUE) exhausts the heap and aborts the process.** Exit 134 after about 50 s at about 4 GB ("Last few GCs"). Not catchable. Sweep log, function `bellNumbers`, label `maxVal`.

### P2

9. realRoots default tolerance: about 1e-11 error on exact roots (`realRoots([1,-3,2])` = [0.49999999999272404, 1.0000000000218279]); the coefficient order (lowest power first) is not stated in the d.ts; NumPy's order is the opposite.
10. realRoots with a NaN coefficient returns [] silently.
11. Strict TypeScript: `simplify`, `derivative`, `evaluate` return `unknown`, so the README-style `.toString()` does not compile (TS2571).
12. factor: prints a stderr message for every non-polynomial input (`sin(x)`); returns `x^2/2-1/2` unchanged with no error (expected `(x-1)*(x+1)/2`); `x^3-x` gives `(x)*(x - 1)*(x + 1)`.
13. solve blames the equation for a missing variable: `solve('x^3-8','y')` and `solve('a = 2','x')` both say "no closed-form solution found".
14. compileExpr / evaluate accept undefined, null, NaN and a string as variable values and return them.
15. derivativeAt with an ordinary number function returns undefined silently. Dual arithmetic is required (`x.powConst(3)` gives 12).
16. symbolicPartialDerivative returns an unevaluated "d/dx(x^2*y)" and an unsimplified "2*x^1". integrate('x*exp(x)') stays unevaluated while symbolicIntegral solves it.
17. Scalar functions with wrong input types: `scalarSymbols('x+y*x')` = [] (silent); `scalarSize('x+1')` = 1; `scalarComplexity` = NaN; `scalarCanonical` = undefined; `scalarEquals`, `scalarDepth`, `scalarGrammarAccepts` throw a raw "reading 'kind'" TypeError.
18. Raw internal TypeErrors: `compile(ast)` without a scope ("Cannot use 'in' operator ... in undefined"); `getPrecedence('*')` ("node.getContent is not a function"); `addExactScales()`.
19. nintegrate with an infinite limit names quad in its error; a NaN integrand returns NaN silently.
20. symbolicEqual('(x+1)^2','x^2+2*x+1') = false. It is documented as "a valid manipulation", but only simplify is tried. Docs should say so.
21. TeX: `not true` renders `\negtrue` (undefined in LaTeX; mathjs 15.2.0 does the same, so this is shared); `a--b` renders " a-- b" (mathjs: `a--\mathrm{b}`).

Not reported (checked, correct or consistent with mathjs): derivative of 10 functions against finite differences (max error 2.9e-10); symbolicIntegral back-differentiated on 7 inputs (exact); solveExact on 12 trig equations (roots and periods correct); parse → toString fixed point on 13 inputs; expand of (x+1)^100 (length and time fine). `simplify('')` returns a node whose toString is "undefined"; mathjs does the same, so not reported.

## Coverage

`symbolic-user-coverage.md` has the full per-export table (1,512 rows across the 7 persona packages, all 7 swept). Call status is "edge-only": the export received the generic edge inputs of the sweep, not a valid input. Most Algebra and CAS exports (for example apart, cancel, collect, limit, taylor, series, laplace, groebnerBasis, toRadicals, minimalPolynomial) were never given a valid input, so they are not verified. Summary:

| package    | functions called | non-callable exports | skipped | timed out or crashed |
| ---------- | ---------------- | -------------------- | ------- | -------------------- |
| expression | 74 of 74         | 7                    | 0       | 0                    |
| parser     | 24 of 24         | 2                    | 0       | 0                    |
| ast        | 16 of 16         | 0                    | 0       | 0                    |
| evaluator  | 6 of 6           | 0                    | 0       | 0                    |
| functions  | 1,289 of 1,294   | 89                   | 5       | 38                   |
| core       | 96 of 97         | 55                   | 1       | 0                    |
| numbers    | 7 of 7           | 18                   | 0       | 0                    |

Total: 1,512 of 1,518 callable exports called. The 6 not called are the 5 functions skipped by pattern in `functions` (`enableGpu`, `disableGpu`, `loadWasm`, `resetGpuElementwise`, `resetGpuFft`) and `initTypedWasm` in `core`: these change global state, and the reason is recorded in the table. Non-callable exports (constants, objects, classes not invoked) are listed as "not callable". Note: the `numbers` count of 7 is the number of function-kind exports; the `Fraction`, `BigNumber`, `Complex` classes are classes and are covered by hand probes (`p/t8.mjs`, `p/t9.mjs`).

Hang status after an isolated rerun (`sweep/isolate-hangs.mjs`, each function alone in a fresh process, 15 s timeout, `sweep-out/isolated/summary.json`): 39 functions were flagged in the sweep; **29 are confirmed hangs** and 10 were load artifacts (they finished alone). Confirmed: 21 single-argument functions that do not return on Number.MAX_VALUE (drafted), bellNumbers (heap abort, drafted), and 7 functions on non-numeric array or object inputs (drafted as one P2; the exact input is not yet pinned, so that draft says so). Single-argument hangs were also re-checked by hand under `timeout 10` (exit 124).

The sweep also recorded 621 functions where at least one edge input produced a raw JavaScript-style TypeError message (for example "Invalid array length", "is not iterable"), and 105 functions returning NaN for a finite edge input (for example `besselY0(0)`, `betaCDF(0.5)`). I did not verify each one against an oracle; they are triage lists in `sweep-out/analysis-functions.json`. Only the items above are confirmed findings.

## Bench

Not applicable (persona has no bench).

## What worked well

- Round-2 fixes all hold: the factories, `simplify` of polynomials, `solve` of quadratics, `solveExact`, the `√2` parse, `expand` ordering, the nesting limit, the `1e` error, `substitute`, and the `unsafe` option.
- Sandbox: `constructor`, `__proto__` and assignment are blocked through `compileExpr`, `evaluate` and `parse` (errors, no prototype access).
- Symbolic derivatives agree with finite differences on 10 functions; `solveExact` periods and roots are correct; `renderPolynomial`-style canonical text for `expand` is consistent.
- Fraction and BigNumber scalar arithmetic is exact (`F.add`, `F.mul`, `bignumber` 0.1+0.2 = 0.3).
- The surface is large and the sweep ran with no leaked path strings in any error message (0 path leaks in 160,641 unique calls). Note: run 2 finished the full sweep and run 3 then resumed from index 52 into the same log, so log lines for indices 52 and above are duplicated (211,223 lines); the 160,641 figure counts unique (function, call) pairs.

## Verdict

I would not adopt the symbolic path for exact work yet. The `simplify` and `derivative` crash on any `sqrt`, `exp` or `log` of a constant (issue 1) is the blocker: a common expression can throw, and `expand` with an irrational constant (issue 2) returns wrong results with no error. Exact types are silently converted to numbers by `sum`, `mean` and `variance` (issue 5), and the Fraction README is wrong (issue 7). For numeric and polynomial work on integers and rationals, solveExact and the CAS basics are usable. Fix issues 1, 2 and 5 first.

## Issue index (round 3)

| #   | Draft title                                                                                      | Priority | Labels                              |
| --- | ------------------------------------------------------------------------------------------------ | -------- | ----------------------------------- |
| 1   | simplify/derivative throw "Cannot convert Complex number to Node" for sqrt/exp/log of a constant | P0       | dogfood, bug, persona:symbolic-user |
| 2   | expand returns wrong mathematics for irrational constant coefficients                            | P0       | dogfood, bug                        |
| 3   | simplify folds an irrational power to a lossy fraction text                                      | P1       | dogfood, bug                        |
| 4   | nintegrate returns a finite value for a divergent integral                                       | P1       | dogfood, bug                        |
| 5   | sum/mean/variance/dot/min coerce BigNumber and Fraction to number                                | P1       | dogfood, bug                        |
| 6   | summation with non-integer bounds returns a wrong sum silently                                   | P1       | dogfood, bug                        |
| 7   | Fraction README prints 0.5; no n/d/s; string input throws                                        | P1       | dogfood, docs                       |
| 8   | bellNumbers(Number.MAX_VALUE) exhausts the heap and aborts the process                           | P1       | dogfood, bug                        |
| 9   | realRoots default tolerance ~1e-11 error; coefficient order undocumented                         | P2       | dogfood, docs                       |
| 10  | realRoots returns [] for a NaN coefficient                                                       | P2       | dogfood, bug                        |
| 11  | simplify/derivative/evaluate typed unknown; README .toString() fails strict tsc                  | P2       | dogfood, bug                        |
| 12  | factor: stderr for every non-polynomial; unchanged output on rational coefficients               | P2       | dogfood, bug                        |
| 13  | solve blames the equation for a missing variable                                                 | P2       | dogfood, bug                        |
| 14  | compileExpr/evaluate accept undefined, null, NaN, string variable values                         | P2       | dogfood, bug                        |
| 15  | derivativeAt with a plain number function returns undefined                                      | P2       | dogfood, bug                        |
| 16  | symbolicPartialDerivative unevaluated; integrate vs symbolicIntegral disagree                    | P2       | dogfood, bug                        |
| 17  | scalar* functions return silent wrong values or raw TypeErrors                                   | P2       | dogfood, bug                        |
| 18  | raw internal TypeErrors on wrong input (compile, getPrecedence, addExactScales)                  | P2       | dogfood, bug                        |
| 19  | nintegrate names quad in its error; NaN integrand returns NaN silently                           | P2       | dogfood, docs                       |
| 20  | symbolicEqual false for equal polynomials that need expansion                                    | P2       | dogfood, docs                       |
| 21  | TeX: `not` renders \negtrue; `a--b` stray space                                                  | P2       | dogfood, docs                       |
| 22  | Single-argument functions do not return on Number.MAX_VALUE (21 functions)                       | P1       | dogfood, bug                        |
| 23  | Non-numeric array/object inputs hang (7 functions; input not yet pinned)                         | P2       | dogfood, bug                        |

Duplicates: none found. Related open issue #966 (not a duplicate).
