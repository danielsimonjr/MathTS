> **In-repo archive** of a review produced on 2026-11-25 (America/Chicago).
> MathTS commit at review time: [`76f7a5b7f859`](https://github.com/danielsimonjr/MathTS/commit/76f7a5b7f859d29622b9300cd5ee9a7966f7b18d)
> (2026-11-25 06:02 CT). mathjs reference: 15.3.0.
> Related: issues [#1549](https://github.com/danielsimonjr/MathTS/issues/1549)–[#1589](https://github.com/danielsimonjr/MathTS/issues/1589),
> tracker [#1590](https://github.com/danielsimonjr/MathTS/issues/1590).
> Implementation plan (already in the repo, not duplicated here):
> [docs/superpowers/plans/2026-11-25-mathjs-parity-plan.md](../superpowers/plans/2026-11-25-mathjs-parity-plan.md).
> Companion data: [parity.csv](2026-11-25-mathjs-parity/data/parity.csv),
> [appendix](2026-11-25-mathjs-parity/appendix.md),
> [totals.txt](2026-11-25-mathjs-parity/data/totals.txt),
> [filed.json](2026-11-25-mathjs-parity/data/filed.json).
> Local working-copy paths from the original review have been rewritten to
> repo-relative links. Findings are otherwise unchanged.

# mathjs ↔ MathTS / mathts-compat parity inventory

Generated 2026-11-25 (America/Chicago). Read-only work: no PRs, issues, or pushes.

## 1. Versions and SHAs

| Item                       | Value                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mathjs (reference)         | **15.3.0**, latest on npm, published 2026-11-23 06:41 CT. Also installed 15.2.0 for comparison.                                                                                                                                                                                                                                                                                                                           |
| MathTS repo                | `danielsimonjr/MathTS` default branch `master` @ **76f7a5b7f859d29622b9300cd5ee9a7966f7b18d** (2026-11-25 06:02 CT, "Preserve mathjs notation on compatibility BigNumbers (#1548)")                                                                                                                                                                                                                                       |
| Build used                 | HEAD built locally: `bun install --frozen-lockfile && bun run build` (turbo, 24/24 tasks OK). Node v24.22.1, bun 1.4.4.                                                                                                                                                                                                                                                                                                   |
| mathts-compat              | `@danielsimonjr/mathts-compat` 0.7.25 (HEAD build; npm 0.7.25 also checked)                                                                                                                                                                                                                                                                                                                                               |
| Typed packages inventoried | core 0.30.3, matrix 0.13.2, functions 0.89.22, expression 0.14.5, parser 0.2.2, ast 0.2.2, evaluator 0.2.2, units 0.8.2, numbers 0.2.2, linalg 0.3.2, arithmetic 0.2.4, trigonometry 0.2.4, statistics 0.5.4, signal 0.2.4, tensor 0.5.3, autograd 0.7.1, parallel 0.12.2, workbook 0.6.4, gpu 0.4.1, plot 0.5.4, typed-function 0.3.0, workerpool 0.6.0 (+ subpaths `mathts-core/internal`, `mathts-functions/evaluate`) |
| Repo oracle                | compat devDependency `mathjs: 15.2.0`; `compat/src/parity-names.generated.ts` = "own keys of the mathjs **15.2.0** instance". Latest is 15.3.0. 15.2.0 → 15.3.0 adds or removes **no** export, instance key, or embedded-docs entry (verified by diffing both). Behavior changes in 15.3.0 that compat does not follow are in §5.4.                                                                                       |

## 2. Method

1. **mathjs inventory (runtime).** `Object.keys(require('mathjs'))` gives **1138** top-level exports: 394 plain names, 373 `create*`, and 371 `*Dependencies`. `Object.keys(create(all))` gives **402** instance keys. 13 of those keys are instance-only: `E Infinity NaN PI emit expression false import null off on once true`. The union is **1151** rows in parity.csv: **409** functional names, 346 factories, 25 transform factories, and 371 dependency bundles.
   - Categories come from mathjs's own embedded docs (`docs[name].category`, 308 entries). When a name has no docs entry, the category comes from the source path of its factory in `lib/esm/factoriesAny.js` (`function/<category>/…`, `type/…`, `expression/node/…`, `constants`, `physicalConstants`).
   - The cross-check for completeness is that every one of the 371 `all` factories maps to a source file, with no unmapped ones.
2. **MathTS inventory (runtime, HEAD build).** I imported each workspace package's `exports['.']` entry and unioned the `Object.keys`. A mathjs name counts as **present** if any typed (non-compat) package exports it.
   - **Renamed** means an equivalent exists under another name, for example `pi`→`core:PI` or `ConstantNode`→`createConstantNode` factory.
   - **Missing** means no package entry exports it. The source location is noted when the code exists internally.
3. **compat inventory.** Name presence is checked against compat's top-level exports (1155) and `create(all)` instance keys (402). Behavior is checked with a differential harness (`harness/`) that calls mathjs 15.3.0 `create(all, cfg)` and compat `create(all, cfg)` with identical inputs. Results are compared on the library's own `typeOf` plus `format(x,{precision:14})`. Numbers within 1e-9 relative are counted as "close", meaning a match. Random functions are compared on type only.
   - **docs-examples.mjs** runs all 926 mathjs embedded-docs examples under 3 configs: default, `number:'BigNumber'`, and `matrix:'Array'`. Each runs through `parser().evaluate` and through `evaluate(ex, scope)`, with `{unsafe:true}` for compat (see §5.1). Under default config it also compares `parse(ex).toString()` and `toTex()`. That is 6,486 comparisons in total.
   - **direct.mjs** calls 269 instance functions directly, each with 33 input shapes: scalars, arrays, Matrix, Sparse, Complex, BigNumber, Fraction, string, Unit, boolean, and binary/ternary mixes. That is 8,877 calls.
   - **classes.mjs** probes the 35 classes: constructor, `instanceof` on results, and node types.
   - **repro.mjs** gives minimal repros for each finding; its output is in `repro-output.txt`.
4. **Second, independent check of the missing lists (rfl).**
   - (a) Runtime keys of the **published npm** packages (a different artifact from the HEAD build) give the same 49 missing or renamed names, plus 29 more that exist only at HEAD (§4.3).
   - (b) A source grep (`rg` for `export class|const|function|{…}` of each name in non-compat `src/`) confirms there is no entry-level export. The hits are only type aliases in `utils/is.ts`, internal files, or `core/internal`.
   - (c) For compat, both the HEAD build and npm 0.7.25 show 0 missing top-level exports and 0 missing instance keys.
5. **Issues.** `gh issue list -R danielsimonjr/MathTS --state open` returns **0 open issues**. The `related_issue` column lists closed issues whose title names the function. That is a heuristic, so read it as context, not proof.

## 3. Headline counts

- **mathjs 15.3.0 public surface:** 1138 top-level exports and 402 instance keys, which make 1151 unique rows. Of these, 409 are functional names: functions, constants, classes, and core API.
- **Missing from MathTS (typed packages, HEAD):**
  - **14 of 409** functional names have no export, and 35 more exist only under a different name or as JS built-ins.
  - **261 of 346** `create*` factories are missing, with 63 more present as `functions:factory_*`.
  - **All 371** `*Dependencies` bundles are missing. This is by design: they exist only in compat.
- **Missing from mathts-compat: 0.** Every mathjs export (1138/1138) and instance key (402/402) is present. Two structural gaps remain:
  - `instance.expression.transform` has **0 of 26** entries.
  - `instance.expression.mathWithTransform` has **3 of 315**.
- **compat behavior across the 409 functional names:**
  - **285 match**, including 63 where compat also accepts inputs mathjs rejects.
  - **112 diverge.** 62 are value, type, or throw differences (including the expression sandbox), and 50 are cosmetic only (toTex, Fraction format, function names, version string).
  - **12 untested:** `all chain create docs emit expression factory off on once replacer reviver`.

Totals by category (functional names; factories and dependency bundles are summarized separately):

| category           | mathjs names | MathTS same name | MathTS renamed/n-a | MathTS missing | compat present | compat match | compat diverges | untested |
| ------------------ | ------------ | ---------------- | ------------------ | -------------- | -------------- | ------------ | --------------- | -------- |
| algebra            | 20           | 20               | 0                  | 0              | 20             | 11           | 9               | 0        |
| arithmetic         | 30           | 30               | 0                  | 0              | 30             | 20           | 10              | 0        |
| bitwise            | 7            | 7                | 0                  | 0              | 7              | 7            | 0               | 0        |
| combinatorics      | 4            | 4                | 0                  | 0              | 4              | 4            | 0               | 0        |
| complex            | 4            | 4                | 0                  | 0              | 4              | 2            | 2               | 0        |
| constants          | 24           | 8                | 16                 | 0              | 24             | 23           | 1               | 0        |
| construction       | 14           | 14               | 0                  | 0              | 14             | 7            | 6               | 1        |
| core               | 13           | 4                | 2                  | 7              | 13             | 2            | 2               | 9        |
| expression         | 7            | 6                | 1                  | 0              | 7              | 1            | 6               | 0        |
| expression-node    | 16           | 0                | 16                 | 0              | 16             | 16           | 0               | 0        |
| fraction           | 2            | 2                | 0                  | 0              | 2              | 2            | 0               | 0        |
| geometry           | 2            | 2                | 0                  | 0              | 2              | 2            | 0               | 0        |
| json               | 2            | 2                | 0                  | 0              | 2              | 0            | 0               | 2        |
| logical            | 5            | 5                | 0                  | 0              | 5              | 0            | 5               | 0        |
| matrix             | 39           | 39               | 0                  | 0              | 39             | 16           | 23              | 0        |
| numeric            | 1            | 1                | 0                  | 0              | 1              | 0            | 1               | 0        |
| operators          | 11           | 11               | 0                  | 0              | 11             | 1            | 10              | 0        |
| physical-constants | 51           | 51               | 0                  | 0              | 51             | 51           | 0               | 0        |
| probability        | 12           | 12               | 0                  | 0              | 12             | 10           | 2               | 0        |
| relational         | 12           | 12               | 0                  | 0              | 12             | 3            | 9               | 0        |
| set                | 10           | 10               | 0                  | 0              | 10             | 10           | 0               | 0        |
| signal             | 2            | 2                | 0                  | 0              | 2              | 1            | 1               | 0        |
| special            | 2            | 2                | 0                  | 0              | 2              | 1            | 1               | 0        |
| statistics         | 13           | 13               | 0                  | 0              | 13             | 7            | 6               | 0        |
| trigonometry       | 25           | 25               | 0                  | 0              | 25             | 16           | 9               | 0        |
| type               | 1            | 1                | 0                  | 0              | 1              | 0            | 1               | 0        |
| types              | 17           | 10               | 0                  | 7              | 17             | 14           | 3               | 0        |
| units              | 2            | 2                | 0                  | 0              | 2              | 1            | 1               | 0        |
| utils              | 61           | 61               | 0                  | 0              | 61             | 57           | 4               | 0        |
| **total**          | 409          | 360              | 35                 | 14             | 409            | 285          | 112             | 12       |

Factory and dependency rows:

| kind                | mathjs | MathTS same name    | MathTS renamed (`factory_*`) | MathTS missing | compat present |
| ------------------- | ------ | ------------------- | ---------------------------- | -------------- | -------------- |
| `create*` factories | 346    | 22                  | 63                           | 261            | 346            |
| `create*Transform`  | 25     | 25 (expression pkg) | 0                            | 0              | 25             |
| `*Dependencies`     | 371    | 0                   | 0                            | 371            | 371            |

## 4. Names missing from MathTS (typed packages)

### 4.1 Truly missing at the package-entry level (14)

- **Classes (7):**
  - `ArgumentsError`: only internal, in `functions/src/error`.
  - `DimensionError` and `IndexError`: only on the `@danielsimonjr/mathts-core/internal` subpath.
  - `FibonacciHeap`, `ImmutableDenseMatrix` and `Spa`: only internal, in `functions/src/type/matrix`.
  - `ResultSet`: only internal. `isResultSet` is exported.
- **Instance and core API (7):** `all`, `docs`, `expression`, `on`, `off`, `once`, `emit`. Only compat has these.

### 4.2 Present under a different name or form (35)

- **Constants:**
  - `e`→`core:E`, `pi`→`core:PI`, `tau`→`core:TAU`, `phi`→`core:PHI`, `i`→`core:I` / `numbers:I`.
  - `version`→`core:VERSION`, which holds the MathTS version, not a mathjs version.
  - `Infinity`, `NaN`, `true`, `false`, `null`, and `_Infinity`, `_NaN`, `_true`, `_false`, `_null` are JS built-ins (marked n/a).
- **Node classes (16):** `Node`, `AccessorNode`, `ArrayNode`, `AssignmentNode`, `BlockNode`, `ConditionalNode`, `ConstantNode`, `FunctionAssignmentNode`, `FunctionNode`, `IndexNode`, `ObjectNode`, `OperatorNode`, `ParenthesisNode`, `RangeNode`, `RelationalNode`, `SymbolNode`. Each is available only as a `create<X>` factory in expression, parser, and ast, with `is<X>` in functions. No ready class is exported.
- **Other:**
  - `Parser`→`expression:createParserClass` and `functions:parser()`.
  - `factory`→`core:createFactory`.
  - `import`→`functions:importFactory`, which is a factory only. There is no instance `import` on the typed API.

### 4.3 Present at HEAD but not in the published npm packages (29)

These have the same version numbers on npm but are not there yet, which suggests unreleased changes:
`isAccessorNode isArrayNode isAssignmentNode isBlockNode isChain isCollection isConditionalNode isConstantNode isDate isFunctionAssignmentNode isFunctionNode isHelp isIndex isIndexNode isMap isNode isObjectNode isObjectWrappingMap isOperatorNode isParenthesisNode isPartitionedMap isRange isRangeNode isRegExp isRelationalNode isResultSet isSymbolNode num den`.

### 4.4 Factories

The full lists are in the Appendix (A1–A4).

### 4.5 MathTS extras not in mathjs

The typed packages export **1,544** names that mathjs does not have. `functions` alone has 1,092, of which 65 are `factory_*`, 17 are ALL-CAPS constants, and 10 are `is*`. They cover:

- special functions (Bessel, Airy, elliptic, hypergeometric, zeta family, Coulomb)
- probability distributions and hypothesis tests
- signal processing (filters, windows, wavelets, FFT variants)
- graph algorithms
- computational geometry
- CAS and symbolic tools (expand, factor, Gröbner, apart, assumptions)
- optimization and root-finding
- quadrature and ODE
- sparse direct solvers (`cs*`)
- extra linear algebra (eigsh, generalized eig, matrix functions, Lyapunov and Riccati solvers)
- number theory
- GPU and parallel dispatch
- tensors and autograd

## 5. mathts-compat behavioral divergences (minimal repros, `M = create(all)`)

The repro output for all of these is in `repro-output.txt`, produced by `node harness/repro.mjs`. Per-name evidence is in `divergences-by-name.json` and `harness/*.json`.

### 5.1 The expression sandbox is not mathjs behavior (highest impact)

- `M.evaluate('a = 2')`, `M.parser().evaluate('x = 3')`, and `M.compile('a=2')` all throw `Security: assignment expressions are disabled`. mathjs returns 2.
- `M.evaluate('f(x)=x^2; f(3)')` throws in compat. mathjs returns `ResultSet [9]`.
- `M.evaluate('simplify("2x+x")')` and `derivative(...)`, `parse(...)`, `evaluate(...)`, `help(...)` inside expressions throw `forbidden function`. mathjs evaluates them.
- `Parser.prototype.evaluate` (`expression/src/Parser.ts`) always calls the safe evaluate. A compat parser therefore **cannot assign variables at all**, and there is no opt-out, even though its own doc comment shows `parser.evaluate('x = 7 / 2')`.
- Even with `{unsafe:true}` on `evaluate`:
  - `evaluate`, `compile`, `parser` and `help` are undefined inside expressions.
  - Node methods are blocked (`node.evaluate()` throws "No access to method evaluate").
  - Callbacks that touch scope objects throw "No access to host object" (the `forEach` docs example).
- The migration guide's compat matrix says "Safe math.evaluate: mathjs sandboxed / compat sandboxed". That is not accurate for mathjs, which allows assignment and these calls.
- Effect: 213 of the 926 docs examples fail in compat's default `parser().evaluate` path.

### 5.2 Value, type, or throw differences

- **Instance rounding with digits or units:** `M.ceil(3.14159, 2)`, `M.floor`, `M.fix` with 2 args, and `M.floor(unit('3.241 cm'), unit('cm'))` throw "Too many arguments" in compat. The named exports behave the same way. Yet `M.evaluate('ceil(3.14159, 2)')` = 3.15 works, so the instance function and the expression-scope function are different implementations.
- **`identity(m, n)`:** `identity(2,3)` gives 2×2 instead of 2×3, and `identity(7,2)` gives 7×7 instead of 7×2. `identity()` with no argument, `identity(true)`, and `identity(bignumber(7), bignumber(2))` throw.
- **Fraction sign tests:** `isPositive(fraction(1,3))` and `isNegative(fraction(-1,3))` both return `false`. They should be `true`.
- **Matrix return type under default config:** `ones(2)` and `expm([[0,2],[0,0]])` return a plain Array, where mathjs returns a DenseMatrix. `zeros` matches.
- **Unit support gaps:** `unaryMinus(unit)`, `unaryPlus(unit)`, `sign(unit)`, `max/min(unit, unit)`, and `max(complex)` with a single argument throw. `mad(units)` gives an equivalent value in a different unit (400 um vs 0.0157 inch).
- **Statistics signatures:** `std` and `variance` with 2 arrays or matrices (`variance([1,2,3],[4,5,6])`) throw, and `std(a, dim, normalization)` throws. For complex input, `std(complex, 2)` and `variance(complex, 2)` return a real number where mathjs returns a Complex. `sum`, `max` and `min` of `true` return a number, not a boolean.
- **`nthRoot(array, array)`** throws.
- **Block results:** `evaluate('1;2')` returns `2`, not a `ResultSet`. The same happens for the `sylvester` docs example.
- **Indexed assignment into an empty matrix** (with `{unsafe:true}`): `e=[]; e[1,1:2]=[5,6]; e[2,:]=[7,8]` gives `[7,8]` in compat. mathjs gives `[[5,6],[7,8]]`, and the `subset` docs example then cascades.
- **Inverse trig at the branch point and branch cut:** `acoth(0)` gives NaN (mathjs: 1.5708i). `acsc(0)` and `asec(0)` give NaN (mathjs: Infinity). `asech(7.25)` gives +1.4324i (mathjs: −1.4324i). `acsch(complex)` throws `x.acsch is not a function`. `arg(bignumber)` throws `y.atan2 is not a function`.
- **`nullish(fraction(1,3), x)`** returns a Complex or number instead of the Fraction.
- **`bernoulli(fraction(12))`** returns a number, not a Fraction.
- **`pinv(bignumber)`, `pinv(fraction)`, `compare(bignumber, bignumber)` and `compare(fraction, fraction)`** return a number, where mathjs keeps the type. `pinv(complex)` throws.
- **`number:'BigNumber'` config:**
  - `50cm == 0.5m` gives **false** and `!=` gives true. That is wrong.
  - `pow([[1,2],[4,3]], 2)` throws "DenseMatrix nested array must contain numbers".
  - `sylvester` and `lyap` throw "schur: only real (number) matrices".
  - `+true`, `+"2"`, `compare`, `pinv(4)` and `bernoulli(4)` return a number, not a BigNumber.
- **Algorithmic differences, where both results may be valid:**
  - `schur` returns a different but valid ordering.
  - `eigs` ignores a numeric `precision` argument (`eigs(A, 2)`) and returns normalized eigenvectors, where mathjs returns unnormalized ones.
  - `solveODE` uses different step selection, so the final y differs by about 2e-6 within default tolerances.
  - `sparse(...)` and `unit(sparse)` report a different density because they store explicit zeros.
  - `rotationMatrix(..., 'sparse')` shows the same density difference.
- **Places where compat is more correct than mathjs** (they still diverge from mathjs):
  - `zeta(-3)` = 0.0083333333 (exact 1/120), where mathjs gives 0.0083333346.
  - BigNumber `zeta` is accurate where mathjs is not.
  - `zeta(complex)` is finite where mathjs gives NaN.
  - `symbolicEqual("x*y","y*x")` is true under BigNumber.
  - `range("4:10")` is end-inclusive under BigNumber.
- **`createUnit`, `version`, and function names:**
  - `version` = "0.7.25", where mathjs gives "15.3.0".
  - Functions defined in expressions are named `fn` instead of their own names (`f`, `isOdd`).

### 5.3 Cosmetic formatting differences

- **`toTex` (53 docs examples):** these are an AST `toTex` issue, not a problem with the named functions.
  - Symbols that are unit names (`A`, `b`, `cm`, `m`) render as ` A`. mathjs renders `\mathrm{A}`.
  - `deg` renders as `deg`. mathjs renders `^\circ`.
  - `true\wedge false` has a space. mathjs prints `true\wedgefalse`, which is arguably a mathjs bug.
- **Fraction formatting:** `format(fraction(2))` = "2", where mathjs gives "2/1". `string(fraction(1,3))` = "0.3333333333333333", where mathjs gives "0.(3)". This affects ceil, fix, floor, round, im, inv, lcm, mad, sign, numeric and fraction.
- **`parse('1/3 + 1/4').toString()` under Fraction config:** "1 / 3 + 1 / 4", where mathjs gives "1/1 / 3/1 + …".

### 5.4 mathjs 15.3.0 behaviors compat does not follow yet (the oracle is pinned to 15.2.0)

- `multinomial(2,3)` (varargs) and `multinomial([2,0,1])` (zero entries) throw in compat. mathjs 15.3.0 returns 10 and 3.
- `catalan(30n)` is not exact bigint in compat: 3.8149865020923e+15, where mathjs 15.3.0 gives 3814986502092304.
- `dotPow`, `dotDivide` and `divide` of a sparse matrix by 0 keep the sparse result in compat:
  - `dotPow(sparse([[0,1]]),0)` drops 0^0 = 1, giving 0 at (0,0). mathjs 15.3.0 gives `[[1,1]]`.
  - `dotDivide(sparse([[0,1]]),0)` drops the NaN at (0,0).
- The bigint→number overflow guard is missing: `add(-(2n**1100n), 0.5)` gives −Infinity in compat. mathjs 15.3.0 throws.
- Already matching 15.3.0: Fraction and bigint `median`, the `rd` = `rod` unit, `stirlingS2` bigint, and 1-based `std`/`variance` dims inside expressions.

### 5.5 Permissive divergences (compat accepts what mathjs rejects; counted as match)

About 290 direct calls in ~87 functions fall here. Examples:

- one-argument `add`, `multiply` and `subtract`
- `size`, `transpose` and `bignumber`/`bigint`/`boolean` with extra arguments
- trig functions on Fractions
- under BigNumber config: `erf`, `random`, `gamma(1/2)`, `nthRoots`, `norm(x, 2)`, `slu`, `partitionSelect`, `row` and `column`

These count as match in parity.csv (`match+permissive`), but they can hide caller bugs.

## 6. Uncertain or not verified (please read)

- **Comparison method:** values are compared as `format(precision 14)` strings plus `typeOf`. Differences below 14 significant digits are invisible, except where flagged "close". Error parity checks only whether both sides throw, not whether the error message or class matches.
- **Untested surface:**
  - Factories (`create*`) and `*Dependencies` are checked for name presence only, not behavior.
  - Of the instance API, only `config`, `import`, `typed`, `chain` and `on`/`off`/`once`/`emit` were checked lightly, through the docs examples. `reviver` and `replacer` were not tested.
- **Docs examples run in sequence per function**, so one failure can cascade into later examples. The `subset` and `forEach` lines are cascades of §5.1 and §5.2.
- **Attribution limits:** toTex divergences are recorded under the function whose doc example triggered them, but the root cause is shared node rendering. Some "value" rows have the same root cause across many functions, such as Fraction formatting and BigNumber type promotion.
- **Input coverage:** the direct harness uses a fixed input pool. Functions that need special inputs (`solveODE`, `lsolve`, decompositions, `map`/`filter` callbacks) are covered mainly through docs examples, and coverage is thinner there. The 12 names with no behavior comparison are `all chain create docs emit expression factory off on once replacer reviver`.
- **Categories** follow mathjs's embedded-docs taxonomy ("operators", "type" and "units" are mathjs's own labels). Instance-only items were assigned manually.
- **"Renamed" mappings** (§4.2) are my judgment of the closest equivalent, checked by name and export only, not by behavior.
- **`related_issue`** is a title-match heuristic over closed issues. No open issues exist to tie gaps to.

## 7. Files

- [`parity.csv`](2026-11-25-mathjs-parity/data/parity.csv): one row per mathjs export (1151 rows).
- `REPORT.md`: this file.
- `repro-output.txt`: minimal repro output.
- `divergences-by-name.json`: per-name evidence, bucketed.
- `rows.json`: CSV source data.
- [`totals.txt`](2026-11-25-mathjs-parity/data/totals.txt): category totals.
- [`appendix.md`](2026-11-25-mathjs-parity/appendix.md): factory lists.
- `harness/`:
  - scripts: `common.mjs`, `docs-examples.mjs`, `direct.mjs`, `classes.mjs`, `repro.mjs`
  - raw results: `docs-examples.json`, `direct.json`, `classes.json`
- Inventory files: `scratch/mathjs-inventory.json`, `scratch/mathjs-categories.json`, `mathts-inventory.json`.
- Build and run scripts: `scratch/inv-mathjs.mjs`, `scratch/cat-mathjs.mjs`, `inv-mathts.mjs`, `cmp1.mjs`, `scratch/verify2.mjs` (npm second check), `build.mjs`, `classify.mjs`.
- Issue lists: `issues-open.json`, which is empty, and `issues-closed.json`.
- MathTS clone: `MathTS/` at the SHA in §1, unmodified apart from the local build output.

## Appendix

### A1. mathjs factories (create*) not exported by any MathTS typed package (261)

createAcoth, createAcsch, createAdd, createAddScalar, createAnd, createArg, createAsech, createAtomicMass, createAvogadro, createBellNumbers, createBernoulli, createBigNumberClass, createBigint, createBignumber, createBin, createBitAnd, createBitNot, createBitOr, createBitXor, createBohrMagneton, createBohrRadius, createBoltzmann, createBoolean, createCatalan, createChain, createChainClass, createClassicalElectronRadius, createClone, createColumn, createCombinations, createCombinationsWithRep, createCompareNatural, createCompareText, createCompile, createComplex, createComplexClass, createComposition, createConcat, createConductanceQuantum, createConj, createCorr, createCoth, createCoulomb, createCoulombConstant, createCount, createCross, createCsch, createCumSum, createDeepEqual, createDen, createDenseMatrixClass, createDerivative, createDet, createDeuteronMass, createDiag, createDiff, createDistance, createDivideScalar, createDotDivide, createDotMultiply, createDotPow, createE, createEfimovFactor, createEigs, createElectricConstant, createElectronMass, createElementaryCharge, createEqualScalar, createEqualText, createErf, createExpm, createFactorial, createFalse, createFaraday, createFermiCoupling, createFft, createFibonacciHeapClass, createFilter, createFineStructure, createFirstRadiation, createFlatten, createForEach, createFormat, createFraction, createFractionClass, createFreqz, createGamma, createGasConstant, createGetMatrixDataType, createGravitationConstant, createGravity, createHartreeEnergy, createHasNumericValue, createHelp, createHex, createI, createIdentity, createIfft, createIm, createImmutableDenseMatrixClass, createIndex, createIndexClass, createInfinity, createIntersect, createInv, createInverseConductanceQuantum, createInvmod, createIsBounded, createIsFinite, createIsInteger, createIsNaN, createIsNegative, createIsNumeric, createIsPositive, createIsPrime, createIsZero, createKldivergence, createKlitzing, createKron, createLN10, createLN2, createLOG10E, createLOG2E, createLeafCount, createLeftShift, createLgamma, createLoschmidt, createLsolve, createLsolveAll, createLup, createLusolve, createLyap, createMad, createMagneticConstant, createMagneticFluxQuantum, createMap, createMapSlices, createMatrix, createMatrixClass, createMatrixFromColumns, createMatrixFromFunction, createMatrixFromRows, createMedian, createMode, createMolarMass, createMolarMassC12, createMolarPlanckConstant, createMolarVolume, createMultinomial, createMultiply, createMultiplyScalar, createNaN, createNeutronMass, createNot, createNthRoots, createNuclearMagneton, createNull, createNullish, createNum, createNumber, createNumeric, createOct, createOnes, createOr, createPartitionSelect, createPermutations, createPhi, createPi, createPickRandom, createPinv, createPlanckCharge, createPlanckConstant, createPlanckLength, createPlanckMass, createPlanckTemperature, createPlanckTime, createPolynomialRoot, createPrint, createProd, createProtonMass, createQr, createQuantileSeq, createQuantumOfCirculation, createRandom, createRandomInt, createRange, createRationalize, createRe, createReducedPlanckConstant, createReplacer, createReshape, createResize, createResolve, createResultSet, createReviver, createRightArithShift, createRightLogShift, createRotate, createRotationMatrix, createRow, createRydberg, createSQRT1_2, createSQRT2, createSackurTetrode, createSchur, createSech, createSecondRadiation, createSetCartesian, createSetDifference, createSetDistinct, createSetIntersect, createSetIsSubset, createSetMultiplicity, createSetPowerset, createSetSize, createSetSymDifference, createSetUnion, createSimplify, createSimplifyConstant, createSimplifyCore, createSize, createSlu, createSolveODE, createSort, createSpaClass, createSparse, createSparseMatrixClass, createSpeedOfLight, createSplitUnit, createSqrtm, createSqueeze, createStefanBoltzmann, createStirlingS2, createString, createSubset, createSubtractScalar, createSylvester, createSymbolicEqual, createTau, createThomsonCrossSection, createTo, createToBest, createTrace, createTrue, createTypeOf, createTyped, createUnequal, createUnitClass, createUnitFunction, createUppercaseE, createUppercasePi, createUsolve, createUsolveAll, createVacuumImpedance, createVersion, createWeakMixingAngle, createWienDisplacement, createXor, createZeros, createZeta, createZpk2tf

### A2. Factories present under a different name (functions:factory_*) (63)

createAbs→factory_abs, createAcos→factory_acos, createAcosh→factory_acosh, createAcot→factory_acot, createAcsc→factory_acsc, createAsec→factory_asec, createAsin→factory_asin, createAsinh→factory_asinh, createAtan→factory_atan, createAtan2→factory_atan2, createAtanh→factory_atanh, createCbrt→factory_cbrt, createCeil→factory_ceil, createCompare→factory_compare, createCos→factory_cos, createCosh→factory_cosh, createCot→factory_cot, createCreateUnit→factory_createUnit, createCsc→factory_csc, createCtranspose→factory_ctranspose, createCube→factory_cube, createDivide→factory_divide, createDot→factory_dot, createEqual→factory_equal, createExp→factory_exp, createExpm1→factory_expm1, createFix→factory_fix, createFloor→factory_floor, createGcd→factory_gcd, createHypot→factory_hypot, createLarger→factory_larger, createLargerEq→factory_largerEq, createLcm→factory_lcm, createLog→factory_log, createLog10→factory_log10, createLog1p→factory_log1p, createLog2→factory_log2, createMax→factory_max, createMean→factory_mean, createMin→factory_min, createMod→factory_mod, createNorm→factory_norm, createNthRoot→factory_nthRoot, createPow→factory_pow, createRound→factory_round, createSec→factory_sec, createSign→factory_sign, createSin→factory_sin, createSinh→factory_sinh, createSmaller→factory_smaller, createSmallerEq→factory_smallerEq, createSqrt→factory_sqrt, createSquare→factory_square, createStd→factory_std, createSubtract→factory_subtract, createSum→factory_sum, createTan→factory_tan, createTanh→factory_tanh, createTranspose→factory_transpose, createUnaryMinus→factory_unaryMinus, createUnaryPlus→factory_unaryPlus, createVariance→factory_variance, createXgcd→factory_xgcd

### A3. Factories present with the same name in expression/parser/ast/core/units (47)

createAccessorNode, createAndTransform, createArrayNode, createAssignmentNode, createBitAndTransform, createBitOrTransform, createBlockNode, createColumnTransform, createConcatTransform, createConditionalNode, createConstantNode, createCumSumTransform, createDiffTransform, createEvaluate, createFilterTransform, createForEachTransform, createFunctionAssignmentNode, createFunctionNode, createHelpClass, createIndexNode, createIndexTransform, createMapSlicesTransform, createMapTransform, createMaxTransform, createMeanTransform, createMinTransform, createNode, createNullishTransform, createObjectNode, createOperatorNode, createOrTransform, createParenthesisNode, createParse, createParser, createParserClass, createPrintTransform, createQuantileSeqTransform, createRangeClass, createRangeNode, createRangeTransform, createRelationalNode, createRowTransform, createStdTransform, createSubsetTransform, createSumTransform, createSymbolNode, createVarianceTransform

### A4. *Dependencies bundles: all 371 missing from the typed packages, all 371 present in mathts-compat.
