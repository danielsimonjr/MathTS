# MathTS dogfood round 3: consolidated filing list

**Scope.** I read all 9 personas' drafts, reports and final messages. I merged them by root cause into 54 items: 13 P0, 19 P1 and 22 P2. I ran the repros myself against the published packages under `timeout -s KILL 20` and pasted what they printed. Nothing was filed, commented on, committed or pushed.

**Versions for every item.** functions 0.86.0, core 0.28.0, matrix 0.11.0, linalg 0.3.0, statistics 0.5.0, signal 0.2.0, numbers 0.2.0, compat 0.6.0, tensor 0.5.0, autograd 0.6.0, parallel 0.11.0, workbook 0.6.0, expression 0.14.0. Node v26.13.0 on Windows 11. Probe file: `C:/Users/danie/mathts-dogfood-r3/consolidate/probes.mjs`, run through `run.sh <case>`.

**Corrections to the brief**

- **Reproduction coverage.** I did not re-run everything in the P2 band. Items marked "carried" were not re-run.
- **Newcomer drafts.** The newcomer-issues.md reopen drafts for #914 and #916 are dropped, as the brief said.
- **Migrator claims I disproved.** Two migrator claims are wrong on re-run, and I corrected them below. `dotMultiply` of two matrices returns a matrix, not a plain array. The BigNumber `log` error starts near digit 50, not digit 29, and `atan2` is correct.
- **Hang timeouts.** `timeout 20` alone did not stop `wilcoxon('abc')` (it ran past 120 s), so I used `timeout -s KILL` throughout.
- **Reopen candidates (#777, #926, #930, #933).** These are closed issues whose published-package defect still reproduces. The lead decides whether to reopen or file new.

## P0 (13)

### 1. `det` returns its argument for a DenseMatrix or a string. NEW. Labels: dogfood, bug, P0.

- **Repro:** `F.det(M.matrix([[1,2],[3,4]]))`, `F.det([[1,2],[3,4]])`, `F.det('abc')`.
- **Expected:** `-2`, as the array path gives. The declared type is `number | BigNumber | Complex`.
- **Actual (VERIFIED):** the DenseMatrix call returns the matrix itself (`DenseMatrix {...data 1,2,3,4}`). The array call returns `-2`. `det('abc')` returns `abc`.
- **Not a bug:** `det(5)` returns `5`, which is correct.
- **Personas:** numerical-analyst.

### 2. `linsolve(A, DenseMatrix column b)` returns `[NaN, NaN]` with no error. NEW. Labels: dogfood, bug, P0.

- **Repro:** `F.linsolve([[1,2],[3,4]], M.matrix([[5],[11]]))`.
- **Expected:** `[1,2]`, as the nested-array `b` gives. Otherwise a TypeError that names the accepted shape.
- **Actual (VERIFIED):** `[null,null]`, which is NaN. The array `b` gives `[1,2]`.
- **Personas:** numerical-analyst.

### 3. `eigs` and `L.eig` return wrong eigenvectors for complex eigenvalues. NEW. Labels: dogfood, bug, P0.

- **Repro:** `F.eigs([[0,-1],[1,0]]).eigenvectors` and `L.eig` on the same matrix.
- **Expected:** λ=i has v ∝ (1,−i). NumPy gives residual 0.
- **Actual (VERIFIED):**
  - `eigs` returns the real vector `[-0.7071,0]` for both ±i.
  - `L.eig` column 0 is the real vector (−0.707, −0.707), so A·v ≠ λ·v.
  - `L.eig` column 1 is `i·(0.707,−0.707)`, and it also fails A·v = λ·v.
- **Personas:** numerical-analyst.

### 4. `rankdata`, `spearman`, `spearmanr`, `wilcoxon` and `unwrapPhase` never return on NaN, Infinity or non-number input. NEW. Labels: dogfood, bug, P0.

- **Repro:** `S.rankdata([3,1,NaN])`, `S.spearman([1,NaN,2,3],[1,2,3,4])`, `S.spearmanr(same)`, `S.wilcoxon('abc')`, `S.wilcoxon([1,NaN,3,4],[2,3,1,5])`, `SG.unwrapPhase([Infinity,1,2,-Infinity])`.
- **Expected:** `rankdata` returns ranks with NaN last (SciPy gives `[2,1,3]`). `spearman` returns NaN. `wilcoxon('abc')` throws a TypeError.
- **Actual (VERIFIED):** all six run past 20 s and are killed (exit 124 or 137).
- **Related:** #968 item 7 (`solveODE` NaN hang) is a different loop.
- **Personas:** data-scientist.

### 5. `kendalltau` p-value is wrong for random data. REOPEN #777. Labels: dogfood, bug, P0.

- **Repro:** use `data-scientist/data.json`, fields `t` and `u`. Call `S.kendalltau(t.slice(0,30), u.slice(0,30))` and the same with `slice(0,10)`.
- **Expected:**
  - For n=10 and tau=0.1556 (S=7), I computed the exact two-sided p by permutation DP: **0.6006536596119929**. This matches the data-scientist's SciPy value.
  - For n=30, SciPy gives 0.5239.
- **Actual (VERIFIED):** n=30 gives `pValue: 1` with tau 0.085, and n=10 gives `0.7838899911816578`. A tau of 0.085 cannot give p=1.
- **Personas:** data-scientist.

### 6. `cov([1,2,3,4])` returns `[]`. NEW. Labels: dogfood, bug, P0.

- **Repro:** `S.cov([1,2,3,4])`.
- **Expected:** `1.6666666666666665`, as `numpy.cov([1,2,3,4])` gives.
- **Actual (VERIFIED):** `[]`. `variance([1,2,3,4],{ddof:1})` gives 1.6667.
- **Personas:** data-scientist.

### 7. `sum`, `mean`, `variance` and `std` of a Complex array return a Number built from magnitudes. NEW. Labels: dogfood, bug, P0.

- **Repro:** `z=[new Complex(1,1), new Complex(2,0)]`, then `S.sum(z)`.
- **Expected:** `sum` is 3+1i, `mean` is 1.5+0.5i, and `variance` is 0.5 (ddof 0).
- **Actual (VERIFIED):** `sum` is 3.414213562373095, `mean` is 1.7071, `variance` is 0.1716 and `std` is 0.4142, all plain Numbers. `cumsum` and `prod` return Complex.
- **Personas:** data-scientist. Sibling of item 26 (type dropped for BigNumber and Fraction).

### 8. `complex('2+3i')` and `complex([1,2,3])` return a Complex whose `re` is not a number. NEW. Labels: dogfood, bug, P0.

- **Repro:** `c=F.complex('2+3i'); c.re, c.im, String(c)` and `C.create(C.all).complex([1,2,3])`.
- **Expected:** `2 3 2 + 3i`. The array form should give `[1, 2, 3]` as a Complex array.
- **Actual (VERIFIED):**
  - String form: `re` is the Complex object (prints `2+3i`), `im` is 0, and `String(c)` is `Infinity`.
  - Array form: `re` is `[1,2,3]` and `String(c)` is `Infinity`.
- **Personas:** robustness-tester (string), mathjs-migrator (array).

### 9. `fraction('1/3')`, `fraction('0.5')`, `new Fraction('1/3')` and any decimal literal under the Fraction config throw `Cannot convert X to a BigInt`. NEW. Labels: dogfood, bug, P0.

- **Repro:** `F.fraction('1/3')`, `new N.Fraction('1/3')`, and `create(all,{number:'Fraction'}).evaluate('0.1')`.
- **Expected:** `1/3` and `1/2`. mathjs returns `0.1` for the evaluate call. The typings accept `string`.
- **Actual (VERIFIED):** `SyntaxError Cannot convert 1/3 to a BigInt`, and the same for `0.5`. Under the Fraction config, `0.1`, `1.5` and `0.1+0.2` throw. `evaluate('1/3')` works and gives `0.(3)`.
- **Docs note:** the Fraction README example prints `0.5`, and `f.n`, `f.d`, `f.s` are undefined.
- **Personas:** robustness-tester, mathjs-migrator, symbolic-user.

### 10. Aggregates over nested arrays and Dense or Sparse matrices return strings, NaN or 0. NEW. Labels: dogfood, bug, P0. New evidence on #964 item 4.

- **Repro, compat 2-D:** `math.sum([[1,0],[0,2]])`, `min` and `max` of the same.
- **Repro, functions 2-D:** `F.sum([[1,2],[3,4]])`.
- **Repro, 1-D and sparse:** `sum`, `norm`, `mean`, `median` and `std` on `math.matrix([1,0,2])` or `math.sparse([1,0,2])`.
- **Expected:** `sum` is 3, `min` is 0, `max` is 2, `norm(matrix [3,4])` is 5.
- **Actual (VERIFIED):**
  - `sum` of the compat 2-D array is `"001,00,2"`.
  - `F.sum([[1,2],[3,4]])` is `"001,23,4"`, so this is in functions, not only compat.
  - `min` and `max` of the 2-D array are NaN.
  - `sum` of the 1-D matrix and of the 1-D sparse vector is `"00"`.
  - `norm(matrix [3,4])` is 0, while `norm([3,4])` is 5.
  - `mean(matrix)` throws RangeError (stack overflow).
  - `median` and `std` of the sparse vector are NaN.
- **Personas:** mathjs-migrator.

### 11. Compat 2-D SparseMatrix: element-wise and reduction functions throw `index is not iterable`. NEW. Labels: dogfood, bug, P0. Overlaps open #975 only for `sqrt`.

- **Repro:** `m=C.create(C.all); m.ceil(m.sparse([[1,0],[0,2]]))`.
- **Expected:** a SparseMatrix result, or the correct scalar. mathjs `prod` is 0.
- **Actual (VERIFIED):**
  - `ceil`, `floor`, `abs`, `sum`, `min`, `max` and `sqrt` throw `TypeError index is not iterable`.
  - `diag(sparse([[1],[2]]))` throws `x.diagonal is not a function`.
  - `prod(sparse2D)` is 2, where mathjs gives 0.
  - `abs(sparse([1,0,2]))` returns an empty-values matrix (`size [3,0]`).
- **Personas:** mathjs-migrator.

### 12. `simplify` and `derivative` throw `Cannot convert Complex number to Node` for sqrt, exp or log of a constant. NEW. Labels: dogfood, bug, P0.

- **Repro:** `F.simplify('sqrt(2)')`, `F.simplify('exp(1)*x')`, `F.simplify('log(2)*x')`, `F.derivative('sqrt(2)*x','x')`, `F.derivative(F.symbolicIntegral('1/(x^2+1)','x'),'x')`.
- **Expected:** `sqrt(2)` and similar. mathjs returns 1.4142135623730951 for the first call.
- **Actual (VERIFIED):** all five throw. The last throws because `symbolicIntegral` emits `sqrt(4)`.
- **Personas:** symbolic-user.

### 13. `expand` and `simplify` give wrong or lossy results for irrational constants. NEW. Labels: dogfood, bug, P0. Distinct from #966 and #887.

- **Repro:** `F.expand('sqrt(2)*(x+1)')`, `F.expand('exp(1)*(x+1)')`, `F.simplify('2^(1/2)*2^(1/2)')`.
- **Expected:** `sqrt(2)*x + sqrt(2)`, which is 2.8284 at x=1. The simplified product should be 2.
- **Actual (VERIFIED):**
  - `sqrt2*x + 2*1`, and `exp1*x + 1*1` for the exp case.
  - `evaluate(expand(...),{x:1})` throws `Undefined symbol "sqrt2"`.
  - `simplify('2^(1/2)*2^(1/2)')` prints `4.43365544449e+11 / 2.21682772224e+11`, which parses back with a 4.5e-12 error.
- **Personas:** symbolic-user.

## P1 (19)

### 14. Empty input overflows the stack. NEW. Labels: dogfood, bug, P1.

- **Repro:** `F.fft([])`, `F.ifft([])`, `F.rfft([])`, `F.fftn([])`, `F.mean(F.matrix([]))`.
- **Expected:** an empty result or a TypeError. `fft(Float64Array(0))` returns `[]` and `mean([])` returns NaN.
- **Actual (VERIFIED):** all five throw `RangeError Maximum call stack size exceeded`. `std` and `variance` of `matrix([])` throw the same RangeError (carried from the robustness-tester).
- **Personas:** numerical-analyst, robustness-tester. Related: #964.

### 15. Integer or huge-argument special functions run without bound. NEW. Labels: dogfood, bug, P1.

- **Repro:** `F.bernoulli(1e6)`, `F.bernoulli(1e308)`, `F.doubleFactorial(1e308)`, `subfactorial`, `lucasL`, `harmonicNumber`, `integerSqrt`, `divisors`.
- **Also hangs with `(Number.MAX_VALUE, Number.MAX_VALUE)`:** `besselJ`, `hermiteH`, `stirlingS2`, `permutations`, `integerSqrt`.
- **Expected:** a RangeError in milliseconds. `bernoulli(Infinity)` already throws `RangeError` at once, which is the model.
- **Actual (VERIFIED):** each of those calls is killed at 20 s.
- **Not re-run:** about 40 more names are in the drafts (33 two-argument, 21 one-argument). The `hugeInt` and `maxmax` cases in `probes.mjs` take any name.
- **Personas:** robustness-tester, ml-engineer, symbolic-user.

### 16. Huge allocations abort the process with heap OOM. NEW. Labels: dogfood, bug, P1. Cites #810 as closed and partial.

- **Repro:** `F.zeros(100000,100000)`, and `F.bellNumbers(Number.MAX_VALUE)` under `node --max-old-space-size=300`.
- **Expected:** a catchable RangeError at a cap, as `DenseMatrix.zeros` has (#810).
- **Actual (VERIFIED):** `zeros` prints `FATAL ERROR ... heap out of memory` and exits 134. `bellNumbers` does the same under the 300 MB heap limit. `ones(1e308)` and `hadamardMatrix(1e308)` are carried.
- **Personas:** robustness-tester, symbolic-user.

### 17. Stiff ODE methods hang on a malformed `tspan`. NEW. Labels: dogfood, bug, P1. Related: #691, #968 item 7.

- **Repro:** `F.solveODE(rob,[1,0,0],[0,40],{method:'Radau'})`, where the argument order is wrong (`tspan` first).
- **Expected:** the `"tspan" must be an Array of two numeric values` TypeError.
- **Actual (VERIFIED):** Radau and BDF both hit the 20 s timeout (exit 124). RK45 throws the expected error at once. Rosenbrock and RODAS are carried.
- **Personas:** numerical-analyst.

### 18. `matmul` does not broadcast batch dimensions or accept rank-1 operands. NEW. Labels: dogfood, api, P1. Related: #753.

- **Repro:** `Tensor.ones(4,3,5).matmul(Tensor.ones(5,2))`, and the same through TapedTensor.
- **Expected:** shape `[4,3,2]`, as in NumPy and PyTorch.
- **Actual (VERIFIED):**
  - `batch rank mismatch (3 vs 2)`.
  - A rank-1 right operand is rejected: `both operands must have rank >= 2 (got 3 and 1)`.
  - `[1,2,2] @ [3,2,2]` throws `batch dimension 0 mismatch`.
  - The taped version throws the same rank mismatch.
- **Personas:** ml-engineer.

### 19. Compat matrix operations return plain Arrays, and `size` behaves differently. NEW. Labels: dogfood, api, P1. Extends #968 item 5.

- **Repro:** `m.add(m.matrix(A),m.matrix(A))`, `m.multiply(...)`, `m.subtract(...)`, `m.evaluate('[1,2;3,4]*[1;1]')`, `m.zeros(2,2).size()`, `m.size(m.zeros(2,3))[0]`.
- **Expected:** a matrix back, as in mathjs. `size(zeros(2,3))[0]` is 2.
- **Actual (VERIFIED):**
  - `add`, `subtract`, `multiply` and the evaluate call return `Array`.
  - `add(sparse,sparse)` returns `Array`.
  - `zeros(2,2).size()` throws `size is not a function`.
  - `size(zeros(2,3))[0]` is `undefined`.
- **Correction:** `dotMultiply` returns `MathJSDenseMatrix`, so the migrator's claim about it is wrong.
- **Personas:** mathjs-migrator.

### 20. Compat `equal`, `compare`, `larger` and `divide(matrix, matrix)` throw on arrays and matrices. NEW EVIDENCE ON OPEN #975. Labels: dogfood, api, P1.

- **Repro:** `m.equal([1,2],[1,2])`, `m.compare([1,2],[2,2])`, `m.larger([1,2],[0,5])`, `m.divide(m.matrix(A),m.matrix(A))`, `m.divide(A,A)`.
- **Expected:** element-wise results. mathjs `compare` gives `[-1,0]`, and `divide` gives `A*inv(B)`.
- **Actual (VERIFIED):** every call throws `Unexpected type of argument`.
- **Note:** #975 covers the comparison part. The `divide` part is new.
- **Personas:** mathjs-migrator.

### 21. Compat `and`, `boolean` and `complex` collapse arrays. NEW. Labels: dogfood, bug, P1.

- **Repro:** `m.and(2,[1,2,3])`, `m.boolean([1,2,3])`.
- **Expected:** `[true,true,true]`.
- **Actual (VERIFIED):** both return the scalar `true`.
- **Personas:** mathjs-migrator. The `complex([...])` array case is merged into item 8.

### 22. Default `norm` of a 2-D matrix is Frobenius, not spectral. NEW. Labels: dogfood, api, P1.

- **Repro:** `m.norm([[1,0],[0,2]])`.
- **Expected:** `2`, the mathjs default (spectral norm).
- **Actual (VERIFIED):** `2.23606797749979`, which is the Frobenius value. `norm(...,'fro')` gives the same number.
- **Personas:** mathjs-migrator.

### 23. `round` differs from mathjs at ties. NEW. Labels: dogfood, api, P1.

- **Repro:** `m.round(-2.5)`, `m.round([-2.5,1.5])`, `m.round(1.005,2)`, `F.round(-2.5)`.
- **Expected:** `-3`, `[-3,2]` and `1.01`, as mathjs gives.
- **Actual (VERIFIED):** `-2`, `[-2,2]` and `1`. `F.round(-2.5)` is also `-2`. `round(2.5)` is 3, which matches.
- **Personas:** mathjs-migrator.

### 24. Compat is missing 23 of 23 probed mathjs functions. NEW. Labels: dogfood, api, P1.

- **Repro:** check `'num' in C.create(C.all)` for the names below.
- **Missing (VERIFIED):** `num`, `den`, `isArray`, `isString`, `isBoolean`, `isNull`, `isUndefined`, `isDenseMatrix`, `isSparseMatrix`, `isUnit`, `isBigInt`, `isFunction`, `isObject`, `isDate`, `isRegExp`, `isCollection`, `isMap`, `isRange`, `isChain`, `isHelp`, `isNode`, `isSymbolNode`, `isOperatorNode`.
- **Not re-run:** the migrator reports about 42 missing in total. The migration guide does not list them as gaps.
- **Personas:** mathjs-migrator.

### 25. `nintegrate` returns a finite value for a divergent integral. NEW. Labels: dogfood, bug, P1.

- **Repro:** `F.nintegrate(x=>1/x, 0, 1)` and `F.quad(x=>1/x, 0, 1)`.
- **Expected:** an error or a non-finite value, since the integral diverges.
- **Actual (VERIFIED):** `nintegrate` returns `41.68915999972937`. `quad` returns the same value with `error: 1.846`, which `nintegrate` drops.
- **Personas:** symbolic-user.

### 26. `sum`, `mean`, `variance`, `min` and `dot` of BigNumber or Fraction return a Number. `median` of Fractions returns a Complex. NEW. Labels: dogfood, bug, P1. Related: #964 item 3.

- **Repro:** `F.sum([BigNumber.from('0.1'), BigNumber.from('0.2')])`, `F.mean([new Fraction(1,2), new Fraction(1,3)])`.
- **Expected:** a BigNumber `0.3` for the sum and a Fraction `5/12` for the mean.
- **Actual (VERIFIED):**
  - `sum` of the BigNumbers returns type `number`, while `cumsum` keeps BigNumber and gives `["0.1","0.3"]`.
  - `mean`, `variance` and `min` of the Fractions return `number`.
  - `S.median` of Fractions returns a Complex.
- **Personas:** symbolic-user, data-scientist.

### 27. `summation` with a non-integer lower bound returns a wrong sum. NEW. Labels: dogfood, bug, P1.

- **Repro:** `F.summation('i','i',1.5,3)`.
- **Expected:** a RangeError that says the bounds must be integers.
- **Actual (VERIFIED):** `4`, which adds 1.5 and 2.5, with no error. `summation('i','i',2,3)` correctly gives 5.
- **Personas:** symbolic-user.

### 28. `multinomial` takes time linear in the sum of the counts. NEW. Labels: dogfood, bug, P1.

- **Repro:** `S.multinomial([1e7,1e7])`, then `S.multinomial([1e9,1e9])`.
- **Expected:** `Infinity`, in constant or log time.
- **Actual (VERIFIED):** `[1e7,1e7]` returns `Infinity` after 590 ms. `[1e9,1e9]` runs past 20 s and is killed.
- **Personas:** data-scientist.

### 29. Compat `gcd`, `lcm`, `nthRoot` and `permutations` hang where mathjs returns or throws. NEW. Labels: dogfood, bug, P1.

- **Repro:** `m.gcd(NaN, m.bignumber('0.1'))`, `m.lcm(NaN, m.bignumber('0.1'))`, `m.nthRoot(m.bignumber('0.1'), 0)`, `m.permutations(1e308, 0)`.
- **Expected:** mathjs throws, or returns `1e308` for `permutations`.
- **Actual (VERIFIED):** all four are killed at 20 s.
- **Personas:** mathjs-migrator.

### 30. DenseMatrix arguments hit raw internal errors in `inv`, `linsolve`, `lusolve`, `eigs` and `lstsq`. NEW. Labels: dogfood, bug, P1.

- **Repro:** `A=M.matrix([[1,2],[3,4]])`, then call each function with `A`.
- **Expected:** the array-path result, for example `inv` gives `[[-2,1],[1.5,-0.5]]`. Otherwise a message that names the accepted type.
- **Actual (VERIFIED):**
  - `inv`: `RangeError Matrix must be two dimensional (size: [])`.
  - `linsolve` and `lusolve`: `TypeError Cannot read properties of undefined (reading 'length')`.
  - `eigs`: `TypeError mat.size is not a function`.
  - `lstsq` with a DenseMatrix `b`: the same `reading 'length'` TypeError.
  - `L.matrixExpm` with a plain array: `A.toArray is not a function`.
- **Personas:** numerical-analyst, ml-engineer.

### 31. `eigs` returns a dependent eigenvector pair on a defective block with no flag. REOPEN #926. Labels: dogfood, bug, P1.

- **Repro:** `F.eigs([[2,1,0],[0,2,0],[0,0,3]]).eigenvectors`.
- **Expected:** one eigenvector for λ=2, or a defective marker.
- **Actual (VERIFIED):** `eigs` returns `[1,0,0]` and `[-1,1.8e-15,0]` for λ=2, which are linearly dependent. `L.eig` marks the block `defective:true, independentEigenvectors:1`, so only `eigs` lacks the flag.
- **Personas:** numerical-analyst.

### 32. Named-import bundles are not tree-shaken. REOPEN #930, with #707 as evidence. Labels: dogfood, packaging, P1.

- **Repro:** esbuild `--bundle --minify --format=esm --platform=node` of `import {add} from '@danielsimonjr/mathts-functions'`, and of `import {evaluate} from '@danielsimonjr/mathts-functions/evaluate'`.
- **Expected:** a bundle near single-function size.
- **Actual (VERIFIED, esbuild 0.28.2):**
  - `add` bundles **1,215,116** bytes, the same as an fft-only bundle (1,215,122).
  - The `functions/evaluate` subpath bundles **1,205,475** bytes.
  - Compat `create(all)` as an iife browser bundle is 1,764,336 bytes.
- **Evidence for #944:** the issue reports 3.42 MB, so the compat bundle has shrunk since then.
- **Personas:** performance-engineer, mathjs-migrator.

## P2 (22)

- **33. `describe` NaN policy is inconsistent. NEW. bug.** (VERIFIED)
  - Repro: `S.describe([1,NaN,2,3])`.
  - Actual: min is 1, max is 3 and q25 is NaN, but q75 is 2.25. `max([1,NaN,2,3])` is NaN. The README says NaN propagates.
  - Personas: data-scientist.

- **34. `quantileSeq` on 1e6 values is slow. NEW. perf.**
  - Repro: `S.quantileSeq(a,0.9)` on 1e6 values.
  - Actual (VERIFIED): 914 to 1127 ms against `median` at 24 ms, about 40 to 45 times slower. The data-scientist measured 2.9 s against NumPy 26 ms, which I did not re-run (no NumPy here).
  - Personas: data-scientist.

- **35. BigNumber `log` loses digits at the default 64-digit precision. NEW. bug.** (VERIFIED, corrected)
  - Repro: `math.log(math.bignumber('0.1'))`.
  - Actual: the output differs from the true ln(0.1) by 1.4e-50, so it is wrong from about the 50th decimal, not digit 29.
  - `atan2(1,3)` is correct to 5.7e-65, so the `atan2` claim is dropped.
  - Personas: mathjs-migrator.

- **36. Compat parity gaps that are deliberate today. NEW. api.** (VERIFIED)
  - `multiply([1,2],[3,4])` throws `requires two 2-D matrices; use dot()`, where mathjs returns 11.
  - `bigint(2.5)` throws a RangeError, where mathjs returns 3n.
  - `add(matrix([1,2]), 2x2)` throws a message about nested arrays, where mathjs broadcasts.
  - Personas: mathjs-migrator.

- **37. Raw V8 TypeErrors on missing or wrong-type arguments. NEW. api.** (VERIFIED on samples)
  - The data-scientist counted 113 functions, and the ml-engineer counted hundreds of rows across tensor, core, parallel and matrix.
  - Examples: `S.linregress([1,2,3])` gives `reading 'length'`, and `gather(1,0,[0])` fails the same way. `getMaxMatrixSize()` fails reading `supported`. `compile(parse('x+1')).evaluate` without a scope and `getPrecedence('*')` are carried.
  - Personas: data-scientist, ml-engineer, symbolic-user, numerical-analyst.

- **38. Silent acceptance of invalid input. NEW. api.** (VERIFIED)
  - `F.compileExpr('x').evaluate({x:undefined})` returns `undefined`.
  - `F.derivativeAt(x=>x*x*x,2)` returns `undefined`.
  - `F.realRoots([1,NaN,1])` returns `[]`.
  - `F.quad(()=>NaN,0,1)` returns `{value:NaN,error:NaN}`.
  - `F.lusolve([[2,0],[0,2]],[Infinity,2])` returns NaN.
  - `P.parallelMean('abc')` returns `{result:NaN,parallelized:false}`.
  - `E.scalarSymbols('x+y*x')` returns `[]`, and `E.scalarComplexity('x+1')` returns NaN.
  - Personas: numerical-analyst, symbolic-user, ml-engineer.

- **39. `fft` contract gaps. NEW. api.** (VERIFIED)
  - `F.fft([NaN,1,2,3])` gives re NaN but im 0, 2, 0, -2.
  - `F.fft([5])` returns `[5]`, not a Complex.
  - `F.ifft(F.fft([1,2,3,4]),4)` throws `Too many arguments (expected: 1, actual: 2)`, though the d.ts documents `originalLength`.
  - Related: #774 (closed).
  - Personas: numerical-analyst.

- **40. Scalar argument overflows the stack. NEW. bug.** (VERIFIED)
  - `pairwiseSum(0)`, `sumSquaredDeviations(0)` and `closestPair(0)` throw `RangeError Maximum call stack size exceeded`.
  - Carried: `pairwiseDot(1,2)` and an unawaited `parallelSum(1)`, which crashes the process.
  - Personas: robustness-tester, ml-engineer.

- **41. Misleading error messages. NEW. api.** (VERIFIED, except where noted)
  - `evaluate('a'.repeat(1e6))` throws a 1,000,019-character message.
  - `E.compile('2+3')` throws `Unknown node type: String`.
  - `Tensor.reshape` size mismatch prints the target shape as the source: `[5,3] -> [5,3]`.
  - `gather` rejects index -1 while `slice` accepts negatives.
  - `roll` with a numeric `axes` fails with `axes length undefined`.
  - `lusolve` with NaN in A says `singular`.
  - `runWorkbookWithTimeout('a: 1',{})` rejects with `exceeded undefinedms`.
  - `pool.unary(x,'cbrt')` throws `UNARY_KERNELS[fn] is not a function`.
  - `pinv([])` names `DenseMatrix`.
  - `realRoots([])` says `the zero polynomial`.
  - `solve('x^3-8','y')` blames the equation.
  - Carried: `solveODE` event spec `e.g is not a function`, the TapedTensor `different Tapes` message, and `grad('abc')` blaming the function output.
  - Personas: all.

- **42. `matrix([1,2])` throws. NEW. api.** (VERIFIED)
  - Actual: `DenseMatrix nested array must be a non-empty rectangular array of numbers`.
  - mathjs accepts 1-D input.
  - Personas: numerical-analyst.

- **43. Small CAS defects. NEW. bug.** (VERIFIED)
  - `F.factor('x^2/2-1/2')` returns the input unchanged.
  - `F.symbolicPartialDerivative('x^2*y','x')` returns `d/dx(x^2*y)`.
  - `F.symbolicEqual('(x+1)^2','x^2+2*x+1')` is `false`.
  - `F.realRoots([1,-3,2])` returns `[0.49999999999272404,1.0000000000218279]`, with the default tolerance and coefficient order undocumented.
  - `F.parse('not true').toTex()` returns `\negtrue`.
  - Personas: symbolic-user.

- **44. `scatter` silently drops non-finite points. NEW. bug.** (VERIFIED)
  - `scatter([1,2,Infinity],[1,-Infinity,3])` draws 1 circle for 3 points, with no warning.
  - Personas: data-scientist.

- **45. `ComputePool.workerCount` disagrees with `stats()`. NEW. api.** (VERIFIED)
  - Actual: `workerCount` is 2 before any work and still 2 after `terminate()`. `stats().totalWorkers` is 0.
  - Personas: ml-engineer.

- **46. `binaryCrossEntropy` expects logits and the API doc omits it. NEW. docs.** (VERIFIED)
  - `[0.8,0.3]` with labels `[1,0]` gives `[0.3711, 0.8544]`, where probabilities would give `[0.2231, 0.3567]`.
  - Personas: ml-engineer.

- **47. `fft` at 2^20 is slow against fft.js. REOPEN #933. perf.** (VERIFIED, worse than the persona's number)
  - My run: mathts `fft(number[])` 394 ms against fft.js 136 ms, about 2.9 times slower. The performance-engineer measured 1.91 times.
  - Both are medians of 5 on a machine with other load.
  - Personas: performance-engineer.

- **48. Neutral-platform esbuild of compat fails on `worker_threads`. NEW. packaging.** (VERIFIED)
  - `esbuild --platform=neutral` fails with `Could not resolve "worker_threads"` from `workerpool/src/js/environment.js`.
  - `--platform=browser --format=iife` builds fine (1,764,336 bytes).
  - This differs from #893, which was about the browser platform, so I classed it as new.
  - Personas: performance-engineer.

- **49. `@danielsimonjr/mathts-wasm` subpaths `./wasm` and `./debug` cannot be imported in Node. NEW. packaging.** (carried)
  - Reported error: `ERR_MODULE_NOT_FOUND: Cannot find package 'env' imported from .../build/mathts.wasm`.
  - Not re-run.
  - Personas: newcomer.

- **50. `Unit(180,'deg').value` is still π. REOPEN #921 candidate. bug.** (VERIFIED)
  - `F.unit(180,'deg').value` returns `3.141592653589793`.
  - #812 and #921 were both closed with no comment. This may be intended, so the lead should ask the owner before reopening.
  - Personas: robustness-tester.

- **51. `simplify` and `derivative` are typed `unknown`. NEW EVIDENCE ON OPEN #964. api.** (carried)
  - The `.toString()` call fails under strict tsc with TS2571. I did not re-run tsc.
  - Personas: symbolic-user.

- **52. Docs gaps. NEW. docs.** (carried)
  - Tensor README package.json import needs `resolveJsonModule`.
  - Compat `matrix()` is a class named `MathJSDenseMatrix`, while the README says `DenseMatrix`.
  - `welchPSD` has no detrend option.
  - `wilcoxon` p is the approximation, not the exact value.
  - Fraction README prints `0.5` and has no `n`, `d`, `s` fields.
  - Personas: newcomer, data-scientist, symbolic-user.

- **53. New evidence on closed #798 and #803. docs.** (carried)
  - typed-function still has no TypeScript fence (#798).
  - The root README says "22 published" while npm has 24 (#803).
  - Personas: newcomer.

- **54. New evidence on open #975. api.** (VERIFIED)
  - `sqrt(SparseMatrix)` returns a SparseMatrix for non-negative entries and a plain Array of Complex when any entry is negative.
  - Personas: numerical-analyst.

## Counts

| Priority | NEW | REOPEN                                             | NEW EVIDENCE ON OPEN              | Total |
| -------- | --- | -------------------------------------------------- | --------------------------------- | ----- |
| P0       | 12  | 1 (#777)                                           | 0                                 | 13    |
| P1       | 15  | 2 (#926, #930)                                     | 2 (#975 in 20, #964 in 10 and 26) | 19    |
| P2       | 16  | 3 (#933, #921 candidate, plus #893 treated as new) | 3 (#964, #975, closed #798/#803)  | 22    |

The NEW EVIDENCE column counts items that cite an open issue without being a pure comment. #10 is classed NEW with evidence on #964, #20 is evidence on #975, and #19 extends #968. No DUPLICATE-ALREADY-FIXED items survive.

**Verification.**

- All 13 P0 and 19 P1 items were reproduced, except the unrun tails inside items 15, 16, 24 and 14 (named above).
- P2: 17 reproduced, 5 carried (49, 51, 52, 53, and the unrun parts of 37 and 41).

## Dropped

| Draft                                                                               | Reason                                                                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `det(5)=5`                                                                          | Correct, as the lead said                                                                                                |
| ComputePool.sin at 1e6, #710/#931                                                   | Measured design, as the lead said                                                                                        |
| newcomer #914/#916 reopens                                                          | Superseded by newcomer-final.md                                                                                          |
| `dotMultiply` returns plain Array                                                   | Disproved: it returns `MathJSDenseMatrix`                                                                                |
| BigNumber `atan2` wrong, and "digit 29"                                             | Disproved: `atan2` is exact to 5.7e-65, and `log` is wrong from about digit 50 (kept as item 35 with the correct figure) |
| #932 `svd(DM)` slower than nested                                                   | Not reproduced, per the performance-engineer's own run 3                                                                 |
| svd 500 wall time varies 5x                                                         | Cause not identified, and the draft says it needs more evidence                                                          |
| #711 `loadWasm` no speedup, #934, #935                                              | Not re-run; the 0.94 ratio is noise-level, and #931's decision covers the same design                                    |
| `coulombFG`, `chirpZTransform`, `kolmogorovSmirnov2Test`, `medfilt`, `format` hangs | The persona did not pin the input, so these stay unfiled until pinned (`wilcoxon` was pinned and is item 4)              |
| `derivative(log,-1)`                                                                | The ml-engineer dropped it as a convention                                                                               |
| `#725` assignment disabled                                                          | Closed, and documented                                                                                                   |
| `workbook topologicalSort` hang                                                     | The robustness-tester could not reproduce it                                                                             |
| `#896` corrcoef default layout                                                      | README documents it, and `rowvar:true` works; the lead decides                                                           |
| ODE hint on a smooth oscillator, `sampleN` unbounded, `welchPSD([1,2])` NaN         | Already in open #968 items 6 to 8. `welchPSD([1,2])` returns NaN again today.                                            |

## Root-cause families for the fix plan

1. **Matrix-storage dispatch gaps.** Items 1, 2, 10, 11, 19, 20, 30, 42 and 54. Functions branch on array versus DenseMatrix versus SparseMatrix inconsistently. The result is wrong values (a string, a returned input, NaN) instead of a type error, and arrays are returned where matrices should be. One storage-adapter layer plus a conformance matrix test (function × storage type) would cover most of them.
2. **Numeric-type erasure in reductions.** Items 7, 8, 26 and 21. `sum`, `mean`, `variance` and `min` coerce Complex, BigNumber and Fraction to `number` and combine magnitudes. `complex()` and `and`/`boolean` also fail to map over arrays.
3. **String parsing into BigInt or Complex.** Items 8 and 9. `Fraction(string)` and `complex(string)` share an input-conversion bug.
4. **Unbounded loops with no input validation.** Items 4, 15, 16, 17, 28 and 29. NaN, Infinity or huge arguments feed loops and allocations. `bernoulli(Infinity)` already throws correctly, so the pattern exists. A shared `assertSafeInteger` and allocation-cap helper, plus a CI fuzz run with the 20 s kill, would cover them.
5. **Empty and degenerate input.** Items 14, 40 and 39. Recursion with no base case.
6. **CAS constant handling.** Items 12, 13, 43 and 25. Irrational constants (a Complex result from `sqrt`, `exp` or `log`) are not converted back to nodes, so `expand` makes symbols such as `sqrt2`.
7. **Wrong statistics and eigenvector math.** Items 3, 5, 6 and 31. These need oracle tests against SciPy and NumPy, for example `kendalltau` exact for n ≤ 33, complex `eigs` with a residual check, and `cov` of one vector.
8. **Error-handling and validation layer.** Items 37, 38, 40 and 41. There is no consistent argument guard, so raw V8 messages leak. Silent NaN, `undefined` and `[]` returns should become TypeErrors.
9. **mathjs parity decisions.** Items 22, 23, 24 and 36. Deliberate or accidental divergences (`norm`, `round`, missing predicates, vector multiply) need a documented decision each.
10. **Packaging and bundle shape.** Items 32, 47, 48 and 49. The `functions` barrel pulls in everything, and `workerpool` forces Node builtins in neutral builds.
11. **ML tensor ergonomics.** Items 18, 45 and 46.

## Files and processes I created

**Files** (all under `C:/Users/danie/mathts-dogfood-r3/`):

- `consolidated-STARTED.txt`
- `consolidate/`: `all-issues.json`, `probes.mjs`, `run.sh`, `package.json`, `bm.mjs`, `fftb.mjs`, `p2d.mjs`, `bundle-add.mjs`, `bundle-sub.mjs`, `bundle-compat.mjs`, `out-add.js`, `out-sub.js`, `out-cb.js`

I made a junction `consolidate/node_modules` to `newcomer/node_modules` and removed it with `rmdir`, which removes only the link. The target still holds 24 packages. The gh calls were read-only (`issue list` and `issue view`).

**Processes.** One backgrounded foreground command was stopped with TaskStop. One more completed on its own. No node process of mine was found running at the end.
