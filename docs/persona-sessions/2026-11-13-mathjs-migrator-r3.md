# mathjs-migrator — npm dogfood round 3, 2026-11-13

I am the production mathjs user who migrates to MathTS. I used only the published npm packages at the round-3 pinned versions (install list in the common brief; all 24 packages installed, `npm ls --depth=0` matches). Oracle: mathjs 15.2.0. Environment: Windows 11, Node v26.13.0, tsc 7.0.2, esbuild 0.28.2, one Git Bash shell, 4 parallel grid workers. I did not change product code. I did not file, comment, commit or push. Scratch project: `C:/Users/danie/mathts-dogfood-r3/mathjs-migrator/`.

## Goal

Re-check round-2 issues (step 3), then discover unreported defects across the mathjs-compatible export surface of `compat.create(compat.all)` with an automated differential sweep (step 4c) and chained combinations (4e).

## What I tried, in order

1. Read the round-2 report from GitHub. Note: it has no "Issue index" section. I used its findings table and the round-1 re-check table instead.
2. Installed the 24 pinned packages plus mathjs@15 and tsx. Version check matched.
3. Round-2 re-check (table below): read each issue with `gh issue view`, wrote repro scripts, ran them.
4. Export inventory per package (`inventory.mjs`). Compat has 78 runtime exports, core 152, functions 1383, units 55, arithmetic 46, trigonometry 20, numbers 25. Mathjs user functions: 290. Names present in both compat `create(all)` and mathjs: 248.
5. Differential sweep (`sweep-one.mjs`, `runner-par.mjs`, `analyze.mjs`): each of the 248 names is called with 0, 1, 2, 3 and 4 arguments from a grid of 22 single values (0, -0, 1, -1, 2.5, NaN, Infinity, -Infinity, 1e308, 5e-324, [], [1,2,3], [[1,2],[3,4]], [[]], DenseMatrix, SparseMatrix, empty matrix, Complex, BigNumber, Fraction, 'abc', null, true) and 14 second arguments. Results are compared by canonical serialization with tolerance 1e-9. Three functions (random, randomInt, pickRandom) are skipped by design (non-deterministic).
6. Hung grid cells: 13 functions hit a 60 s kill. I replayed each hung cell alone in both libraries with a 15 s limit (`replay.mjs`, `hang-min.mjs`). Results are in the findings below.
7. Combinations (`combos.mjs`, `focus1..6.mjs`): 45 chained or realistic calls, plus a matrix storage-rule table (12 operations by 12 operand pairs) and an aggregate-function matrix (12 functions by 6 input storage types).
8. Searched GitHub issues (all 231 titles dumped to `all-issues.txt`) before drafting each new issue.
9. Read `docs/migration-guide.md` compat matrix: it says "If you find a divergence, file an issue; do not assume differences are intentional".

## Round-2 re-check

Brief note: the round-2 report has no "Issue index" section, so I used its findings table (#888-#893, #742) and its round-1 table rows (#736, #737, #697, #707, #708).

| Issue | Title (short)                                      | Fixed?                   | Evidence                                                                                                                                                                                     |
| ----- | -------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #888  | CJS require throws                                 | yes                      | `recheck-cjs.cjs`: `require('@danielsimonjr/mathts-compat')` loads, 78 keys                                                                                                                  |
| #889  | sin(0.5) scalar ~18x slower                        | not run                  | No bench in this persona. Not measured.                                                                                                                                                      |
| #890  | strict tsc fails on GPUBuffer / workerpool types   | yes (for these packages) | `tsc-consumer/`: strict, skipLibCheck false, three tsconfig variants (nodenext, bundler+dom, nodenext+dom), exit 0. Second consumer importing functions, gpu, parallel, units, core: exit 0. |
| #891  | matrix toString format                             | yes                      | `matrix([[1,2]]).toString()` = `[[1, 2]]` in both. `format()` not checked.                                                                                                                   |
| #892  | Fraction mode `1/3` prints `1/3`                   | yes                      | `create(all, {number:'Fraction'})`: `1/3` = `0.(3)` in both                                                                                                                                  |
| #893  | esbuild browser bundle hard-fails on Node builtins | yes (esbuild only)       | `esbuild --platform=browser --format=iife --minify` builds (1.76 MB). Runs in a VM with no `process` or `require`, prints `3`. Needs a `navigator` stub (see finding F7).                    |
| #742  | unit 1 ULP                                         | reversed                 | `5 cm`->inch and `100 degC`->degF now give exact `212`. mathjs `211.99999999999997`. Open duplicate: #942.                                                                                   |
| #736  | CJS require (round 1)                              | yes                      | Same as #888                                                                                                                                                                                 |
| #737  | add/sin typed as unknown                           | partial                  | Not type-tested beyond `const s: unknown = m.sin(0)` compiling. Open: #943.                                                                                                                  |
| #697  | functions consumer tsc on workerpool types         | yes                      | Second consumer above: exit 0                                                                                                                                                                |
| #707  | huge evaluate bundle                               | partial                  | esbuild iife 1.76 MB minified (not Vite). #944 open reports 3.42 MB.                                                                                                                         |
| #708  | esbuild Node builtins                              | yes                      | Same as #893                                                                                                                                                                                 |

## New findings (round 3)

Priority rule: P0 = wrong result or crash on documented use; P1 = documented feature fails, or large parity gap, or hang; P2 = docs, typing, ergonomics.

### P0-1 Fraction config: any decimal literal throws

`create(all,{number:'Fraction'}).evaluate('0.1')` throws `SyntaxError: Cannot convert 0.1 to a BigInt`. mathjs returns `0.1`. Also `1.5`, `0.1+0.2`, `2*0.5`. `fraction(0.1)` works. No issue matched.

### P0-2 Aggregates over 2-D arrays and matrices return wrong values

`sum([[1,0],[0,2]])` = string `"001,00,2"` (mathjs 3). `min` and `max` of the 2-D input = NaN (mathjs 0 and 2). Confirmed at package level (`@danielsimonjr/mathts-functions`), not only through compat. No issue matched.

### P0-3 Aggregates over 1-D matrices and sparse vectors

`sum(matrix([1,0,2]))` = `"00"`, `sum(sparse([1,0,2]))` = `"00"` (mathjs 3). `norm(matrix([3,4]))` = 0 (mathjs 5; plain array `norm([3,4])` = 5). `mean(matrix([1,0,2]))` throws `RangeError: Maximum call stack size exceeded`. `median`, `std`, `variance`, `mode` of `sparse([1,0,2])` = NaN (mathjs 1, mode `[1,0,2]`). No issue matched.

### P0-4 Sparse 2-D: reductions and element-wise functions throw or return wrong values

- `ceil`, `floor`, `abs`, `sqrt`, `expm`, `hypot`, `sum`, `min`, `max`, `median` of `sparse([[1,0],[0,2]])` throw `TypeError: index is not iterable`.
- `diag(sparse([[1],[2]]))` throws `x.diagonal is not a function` (mathjs returns a SparseMatrix).
- `prod(sparse([[1,0],[0,2]]))` = 2 (mathjs 0). Implicit zeros are dropped.
- `abs(sparse([1,0,2]))` returns a sparse matrix with empty rows `[[],[],[]]` (mathjs `[[1],[0],[2]]`).
  Possible overlap with open #975 (sparse follow-ups). Check before filing.

### P1-5 Matrix storage: operations return plain arrays

For `add`, `subtract`, `multiply`, `dotMultiply` with DenseMatrix or SparseMatrix operands, MathTS returns a plain `Array` (or a sparse result is lost). mathjs returns `DenseMatrix` or `SparseMatrix`. Example: `add(matrix(A), matrix(A)).get([0,0])` throws (mathjs `2`). `multiply(matrix, matrix)` returns an Array. `evaluate('[1,2;3,4]*[1;1]')` returns an Array; mathjs returns a DenseMatrix. Also `zeros(2,2)` and `identity(2)` return a raw `DenseMatrix` whose `size()` is `{rows:2, cols:2}` (mathjs `[2,2]`), and `size(zeros(2,3))` returns a Matrix so `size(...)[0]` is undefined (mathjs `2`). Related: #744 (closed) fixed stringification, not the type. Also `matrix([1,2]) + matrix 2x2` throws `DenseMatrix nested array must be a non-empty rectangular array of numbers`: mathjs broadcasts to `[[2,4],[4,6]]`; the message names the wrong cause.

### P1-6 Element-wise comparison and division of arrays and matrices throw

`equal([1,2],[1,2])`, `compare([1,2],[2,2])` (mathjs `[-1,0]`), `equal`, `larger`, `compare` on DenseMatrix, SparseMatrix and mixed scalar/matrix arguments all throw `Unexpected type of argument`. `divide(matrix(A), matrix(A))` throws; mathjs returns `A * inv(B)` = identity. `divide(array, array)` throws. Only `divide(scalar, matrix)` works (#960 closed). Related: #960.

### P1-7 Logical and conversion functions collapse arrays to a scalar; complex() on an array returns a broken Complex

`and(2, [1,2,3])` = `true` (mathjs `[true,true,true]`). `boolean([1,2,3])` = `true` (mathjs `[true,true,true]`). `complex([1,2,3])` = Complex whose `re` is an array; `toString()` = `Infinity` (mathjs `[1, 2, 3]` as Complex array).

### P1-8 Default norm of a 2-D matrix differs from mathjs

`norm([[1,0],[0,2]])` = 2.2360679... (Frobenius). mathjs `norm` default = 2 (spectral norm). With explicit `'fro'` both give 2.236. Silent numeric change for the default call.

### P1-9 round() differs from mathjs at half values and at decimal ties

`round(-2.5)` = -2 (mathjs -3). `round([-2.5, 1.5])` = `[-2, 2]` (mathjs `[-3, 2]`). `round(1.005, 2)` = 1 (mathjs 1.01). Positive `round(2.5)` = 3 and `round(2.675, 2)` = 2.68 match.

### P1-10 BigNumber log and atan2 lose digits beyond about 28 significant digits

`log(bignumber('0.1'))` (default 64-digit precision) = `-2.302585092994045684017991454684364207601101488628787213671287872`. mathjs `...628772976033327901`. The true value of ln(0.1) is `...628772976033327900967...`, so MathTS is wrong from digit 29. `atan2` BigNumber shows the same drift. I did not check the precision config against the docs.

### P1-11 MathTS-only hangs (mathjs throws at once)

These cells hang past 15 s in MathTS and return or throw at once in mathjs:

- `gcd(NaN, bignumber('0.1'))`
- `lcm(NaN, bignumber('0.1'))`
- `nthRoot(bignumber('0.1'), 0)`
- `permutations(1e308, 0)` (mathjs returns 1e308)
  Both libraries hang on `bernoulli(1e308)`, `bellNumbers(8)`, `stirlingS2(8, 0)`, `composition(8,1)`, `eigs(15,0)`, `range(2,4)` with Infinity inputs: unbounded in both, not reported.

### P1-12 About 42 mathjs functions are missing from the compat instance

Missing from `create(all)` (mathjs 15 exports them): `num`, `den`, `isArray`, `isString`, `isBoolean`, `isNull`, `isUndefined`, `isDenseMatrix`, `isSparseMatrix`, `isUnit`, `isBigInt`, `isFunction`, `isObject`, `isDate`, `isRegExp`, `isCollection`, `isMap`, `isRange`, `isChain`, `isHelp`, `isNode`, plus the AST node predicates (`isSymbolNode`, `isOperatorNode`, and so on). The migration guide matrix does not list these as gaps. Node predicates may be out of scope; say so in the issue.

### P1-13 Multiply of two vectors throws

`multiply([1,2],[3,4])` throws "requires two 2-D matrices; use dot()". mathjs returns 11. The message is deliberate, but the migration guide says divergences should be filed.

### P2-14 Migration-guide claims and typing

- Assignment in `evaluate` throws `Security: assignment expressions are disabled` by default. This is documented in #725 (closed). Not filed again.
- `divisorSigma`: the guide says mathjs uses `(k, n)`. mathjs 15.2 has no `divisorSigma`, so the claim cannot be checked against 15.x.
- `bigint(2.5)` throws RangeError; mathjs returns 3n. Low.

### Other observations (not filed)

- `ifft` and `expm` values differ at the 15th digit (rounding): not a bug.
- `round`, `and`, `complex` results above are the same collapsed-shape pattern as P1-7.
- Several grid differences are harness artifacts (my serializer read Fraction `n`/`d` wrongly, so `fraction` and `ceil` showed false NaN). Corrected by direct check: `ceil(fraction(1,3))` = 1 in both, `fraction(0)` = 0 in both.

## Coverage

Columns: export | called (yes/no) | edge inputs tried | finding. The full 248-row table is in `mathjs-migrator/both.txt` and `results/`. Summary:

| Export group                                                                                            | Count            | Called                                       | Edge inputs                                                                                                                             | Finding                                                        |
| ------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Functions in both compat and mathjs                                                                     | 248              | 245 (grid); 3 random-based skipped by design | 0,-0,1,-1,2.5,NaN,±Infinity,1e308,5e-324, empty, 1-D, 2-D, dense, sparse, Complex, BigNumber, Fraction, string, null, boolean; 0-4 args | P0-2..4, P1-5..10, P1-13; 13 functions partly hung (see P1-11) |
| Functions only in mathjs (not in compat)                                                                | 42               | no (not exported)                            | none                                                                                                                                    | P1-12                                                          |
| Compat named classes and constants (BigNumber, Complex, Fraction, DenseMatrix, SparseMatrix, constants) | 78 total exports | used as inputs only                          | as above                                                                                                                                | none beyond the above                                          |
| Compat `computePool`, `createUnit`-family                                                               | 2                | no                                           | none                                                                                                                                    | not called (parallel pool is persona 7's area)                 |

Count: 245 of 248 both-names called with the full grid; 3 skipped by design; 42 mathjs names absent; 78 compat exports partly used as inputs.

## Bench

None in this persona. Not run.

## What worked well

- CJS `require` and TypeScript strict consumers now work.
- Fraction mode prints like mathjs, once the decimal-input crash is avoided.
- Scalar arithmetic, `evaluate` on scalars, `lusolve`/`lsolve`/`usolve` (values match mathjs), `cumsum`, `range`, `format`, `simplify`, `derivative`, `parse` toString, `chain`, `corr`, `mean`/`median`/`std` on 2-D inputs, `log(-1)` and `complex` results all match mathjs in my checks.
- Unit conversions (`5 cm` to inch, `200 grad` to rad) are exact; `1 L` to mL is exact where mathjs is 1 ULP off.
- The browser bundle runs in a VM without Node globals.

## Verdict

I would pilot MathTS compat for scalar-only and vector-only server code with its current `evaluate`, `lusolve` and trig paths. I would not adopt it for matrix workloads, statistics on matrices, or sparse data: aggregates and sparse reductions return wrong values or crash (P0-2..4), and matrix operations return plain arrays where mathjs returns matrices (P1-5). The Fraction config path crashes on any decimal literal (P0-1). Blockers for my cutover: P0-1, P0-2, P0-3, P0-4, P1-5, P1-6.

## Issue index (round 3)

| #   | Draft title                                                                             | Priority | Labels                                |
| --- | --------------------------------------------------------------------------------------- | -------- | ------------------------------------- |
| 1   | Fraction config: decimal literal in evaluate throws SyntaxError (BigInt)                | P0       | dogfood, bug, persona:mathjs-migrator |
| 2   | sum/min/max/norm of 2-D arrays and matrices give string or NaN                          | P0       | dogfood, bug, persona:mathjs-migrator |
| 3   | 1-D matrix and sparse aggregates: sum "00", norm 0, mean stack overflow, median/std NaN | P0       | dogfood, bug, persona:mathjs-migrator |
| 4   | 2-D SparseMatrix: ceil/floor/abs/sum/min/max/diag throw; prod wrong                     | P0       | dogfood, bug, persona:mathjs-migrator |
| 5   | add/subtract/multiply/dotMultiply return plain Array, not Matrix                        | P1       | dogfood, api, persona:mathjs-migrator |
| 6   | equal/compare/larger throw on arrays and matrices; divide(matrix,matrix) throws         | P1       | dogfood, api, persona:mathjs-migrator |
| 7   | and/boolean collapse arrays to scalar; complex(array) returns broken Complex            | P1       | dogfood, bug, persona:mathjs-migrator |
| 8   | norm(2-D) default is Frobenius; mathjs default is spectral                              | P1       | dogfood, api, persona:mathjs-migrator |
| 9   | round(-2.5) = -2 and round(1.005,2) = 1 differ from mathjs                              | P1       | dogfood, api, persona:mathjs-migrator |
| 10  | BigNumber log/atan2 wrong from digit 29 at default precision                            | P1       | dogfood, bug, persona:mathjs-migrator |
| 11  | gcd, lcm, nthRoot, permutations hang where mathjs throws                                | P1       | dogfood, bug, persona:mathjs-migrator |
| 12  | About 42 mathjs functions missing from compat (num, den, isArray, ...)                  | P1       | dogfood, api, persona:mathjs-migrator |
| 13  | multiply(vector, vector) throws instead of dot product                                  | P1       | dogfood, api, persona:mathjs-migrator |
| 14  | size() returns Matrix; zeros/identity return raw DenseMatrix with size() object         | P1       | dogfood, api, persona:mathjs-migrator |
| 15  | Vector plus matrix error names the wrong cause; mathjs broadcasts                       | P2       | dogfood, api, persona:mathjs-migrator |
| 16  | bigint(2.5) throws RangeError; mathjs rounds                                            | P2       | dogfood, api, persona:mathjs-migrator |

Drafts: the lead files these after dedupe. Full repro blocks: each finding above names its exact call; the scripts are in `mathjs-migrator/`. Duplicates to check first: #975 (sparse), #744 (size), #960 (divide), #725 (assignment, closed), #942 and #943 and #944 (open, related).

## Files and processes created

- Directory tree: `C:/Users/danie/mathts-dogfood-r3/mathjs-migrator/` (node_modules, scripts `*.mjs`, `*.cjs`, `*.ts`, `tsc-consumer/`, `results/` with 245 jsonl files, `runner.log.jsonl`, `diff-rows.json`, `all-issues.txt`, `both.txt`, `only_mathjs.txt`, `*.keys.txt`, `r2.md`, `migration-guide.md`, `out-browser.js`, `out-iife.js`, `entry-compat.mjs`, `repro-*.mjs`, `recheck-*.mjs`, `focus*.mjs`, `combos.mjs`, `verify1.mjs`, `hangprobe.mjs`, `hang-min.mjs`, `replay.mjs`, `analyze.mjs`, `runner.mjs`, `runner-par.mjs`, `sweep-one.mjs`, `vm-browser.mjs`, `tsc2.out`, `overlap*.mjs`, `inventory.mjs`, `startup.mjs`, `missing.mjs`, `probe1.mjs`, `package.json`, `package-lock.json`).
- Report: `C:/Users/danie/mathts-dogfood-r3/mathjs-migrator-report.md` (this file), and the STARTED stub it replaced.
- Cleanup: a stray file named `nul` in the scratch directory was created by writes to `/dev/null` on Windows. I deleted it.
- Temp file `/tmp/x-floor.jsonl` created by a test run, deleted.
- Processes: background bash tasks (all completed or stopped; none running): `bawu3ezlb` (stopped), `bgcplqj1w` (completed), `bbno0g0l0` (completed), `b5mif84vq` (stopped), `bqd2xkhjx` (completed). Monitors `bi97arxci` (ended), `baiztxeri` (expired). No detached processes left. Child node processes were all foreground with timeouts.
- Ran mathjs `create` and `esbuild` only in scratch. Nothing outside `C:/Users/danie/mathts-dogfood-r3/` was written except `C:/Users/danie/mathts-dogfood-r3/mathjs-migrator-report.md`.
