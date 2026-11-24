# @danielsimonjr/mathts-core

## 0.30.1

### Patch Changes

- 7704089: Publish the source changes that were missing from the previous npm versions so that the runtime dependencies expose the contracts used by the functions bundle. Compute determinants, means, and covariances without premature overflow. Apply instance precision to BigNumber arithmetic, simplify exact radical identities before numerical approximation, and clarify errors for untracked autodiff operands.

## 0.30.0

### Minor Changes

- ba1fdea: `linsolve` accepts a DenseMatrix, a SparseMatrix or a MathJS matrix as `A`. It reads `b` with the new matrix-package reader `readRightHandSide`: a vector, a typed array of numbers, an `n x 1` column, a DenseMatrix or SparseMatrix of one column or one row, or a MathJS matrix. Entries of `A` and `b` follow the implicit rule of mathjs `lusolve`: a numeric string, a boolean, null and undefined convert (null and undefined are 0), and a non-numeric string throws `Cannot convert`. A BigNumber, Fraction or Complex entry is solved by the typed `lusolve`, and the result keeps that type, as in mathjs. An array inside a vector throws a TypeError. Core exports `convertToNumber` (number, string, boolean, bigint) and `isNumberTypedArray` from `/internal`; the matrix package exports `implicitNumber` and `isTypedScalar`. (Refs #977)
- 33acba1: `std`, `corr`, `skewness`, `kurtosis`, `describe`, the factory 2-norm, `parallelStatStd`, `parallelStatNorm`, the pool `variance` and the statistics that use the same sum now compute the result again with an exact power-of-2 scale when a sum of squares is below 2^-800 or overflows. Before, subnormal squares lost digits: `std([1e-160, 3e-160])` had a relative error of 5.6e-6, and `std` of data of order 1e-170 was 0. `skewness` and `kurtosis` do the same when the third or fourth powers leave the range. `linregress`, `linearRegression`, `partialCorrelation`, the effect sizes, the t tests, `fTest`, `bartlettTest`, `jarqueBera`, `dagostinoTest`, `acf`, `pacf`, `ljungBox`, `distance2D`, `distance3D`, `distanceND` and `gaussianKDE` use the same core helpers. `linregress` and `linearRegression` keep a finite slope when the two scales differ by more than the double range. Core adds `SQUARES_SAFE_MIN`, `ROOT_SAFE_MIN`, `squareSumsKeepDigits`, `powerOfTwoBelow`, `powerOfTwoScaleOf`, `scaleForVariance`, `divideByScale` and `stdFromSquaredDeviations`. Compat `std` and `variance` now use the functions implementations: they honour the dimension argument, the variadic form and BigNumber data, as mathjs does. (Refs #1280)
- 3b2ffe6: The default expression scope returns a Complex for `sqrt` and `log` of a negative real and for a negative real to a non-integer power, as mathjs does: `sqrt(-4)` is `2i`, `log(-1)` is `πi` and `(-8)^(1/3)` is `1 + 1.732i`. These calls gave `NaN`. An integer power stays real, the real limits `(-0.5)^Infinity` and `(-8)^(-Infinity)` stay 0, and a `NaN` argument stays the number `NaN`.
  
  `Complex.pow` uses the algorithm of complex.js, so `pow` of a Complex equals mathjs bit for bit on core, the typed functions, compat and the evaluators: `sqrt(-4)^2` is `-4` and was `-4 + 4.9e-16i`, `i^2` is `-1`, and `pow(-8, 1/3)` is `1 + 1.732050807568877i` and was `1.0000000000000002 + 1.7320508075688772i`. Many other results change by one unit in the last place. A zero base follows the IEEE 754 pow rules: `0^y` is 0 for `y > 0` and `Infinity` for `y < 0`. mathjs gives `-0 + 0i` for `0^2` and `0 - Infinity i` for `0^(-1)`. Where complex.js computes `Infinity * 0` and gives `NaN + NaN i`, the result keeps the IEEE value: `(1e300 + 1e300i)^2` stays `Infinity + Infinity i`, and `(1e300 + 1e300i)^0.5` is finite (a part above about 2.7e154 made the squares in complex.js overflow). The new methods `Complex.cbrt()` and `Complex.cbrtRoots()` hold the mathjs cube root, and the typed, factory and default-scope `cbrt` of a Complex call them, so all three equal mathjs. (Refs #1086)
- ba1fdea: Safe evaluate returns a matrix of the matrix package. Before, it refused the matrix as a host object, so `inv(A)`, `pinv(A)` and `transpose(A)` threw for a DenseMatrix or SparseMatrix `A` in scope. Inside such a matrix, safe evaluate accepts a typed array only as a plain numeric buffer: a real Float64Array, Float32Array or Int32Array with the exact prototype of its kind and no own property other than its indices. A typed-array subclass now throws at every position, as a result and as the receiver of a method call. Core exports the matrix brand `NATIVE_MATRIX_BRAND` from `/internal`, and the matrix classes and the guard read this one definition. (Refs #1036)

### Patch Changes

- 3b2ffe6: `Complex.parse` and `complex(string)` read the grammar of the complex.js string parser that mathjs uses. A number takes an exponent: `complex('1e3+2i')` is 1000 + 2i and was 1000i. A text that is not a complex number throws `SyntaxError('Invalid Param')`: `complex('abc')`, `complex('2abc')` and `complex('1+')` gave `NaN` or a part that the text did not hold. Three forms that mathjs rejects stay valid, so no working input breaks: white space except between two number characters (`'3 + 4 i'`), an `E` exponent (`'1E3'`) and the word `Infinity`. The text `'NaN'` throws. (Refs #1283)
- 789a41a: A result matrix takes its size from the operands, not from its nested data. `multiply`, `add` and `subtract` of 0 x 0 matrices keep the size `[0, 0]`, `sparse(zeros(0, 3))` keeps the size 0 x 3, and compat `matrix(x, format)` keeps the size of a native matrix with a zero dimension. `freqz` throws a `RangeError` for a coefficient matrix that is not a vector. Compat `divide` of two native `DenseMatrix` operands gives a native `DenseMatrix`. (Refs #1337)
- 3b2ffe6: `round` with a decimal count works for a Fraction and a Complex, and core `round(x, n)` uses `n`. `round(fraction, n)` returns a Fraction: it returned a BigNumber, and `factory_round(fraction(201, 200), 2)` returned 1. `round(complex, n)` rounds each part: it threw `Too many arguments`. Core `round(x, n)` ignored `n`. `Fraction.round` takes a decimal count, and a count that is not an integer throws `TypeError`. `round(5n, 2)` is now the Fraction 5, as `round(5n)` already was, and was a BigNumber 5: the cause is the order in which the typed dispatcher converts a bigint, and that order is a separate decision. `round` of an Array or a matrix with a decimal count works: `round([1.005, 2.675], 2)` is `[1.01, 2.68]` and `round(2.675, [1, 2])` is `[2.7, 2.68]`. Both threw `TypeError`. Each element takes the scalar row, so `round([-0], 2)` is `[0]`, as in mathjs. (Refs #996)
- b866b34: Integer functions follow mathjs for BigNumber and edge arguments. `nthRoot(bignumber(-8), 2)` throws `Root must be odd when a is negative.` (it returned NaN). `permutations` takes one BigNumber, two BigNumbers, and a BigNumber with a number; the result is the exact product, rounded one time to the precision. `permutations(2, 5)` and `permutations(-1, 2)` throw the mathjs messages. `permutations(170)` and `permutations(170, 170)` are `7.257415615307998e+306`, as in mathjs. `permutations` of an Array or a matrix maps over the elements (mathjs throws). `product` splits a range at an exact midpoint, so `permutations(2^53, 2)` returns `8.112963841460667e+31` where the parse path overflowed the stack. `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift` and `rightArithShift` of BigNumbers return a BigNumber NaN when an operand is NaN, as mathjs does; before, they threw `NaN not allowed`. A finite non-integer operand still throws `Integers expected`, and `rightLogShift` still throws for NaN. On the parse path, and on `evaluate` of `bitAnd` and `bitOr`, a finite BigNumber operand threw `Cannot read properties of undefined`, because the helpers read the digit array of decimal.js, which a BigNumber of this library does not have; and `bitNot(bignumber(12))` returned `13`, because the helper wrote a sign field that the BigNumber does not store (`bitXor(-1, bignumber(5))` gave `6`). The helpers now compute on bigint: `bitAnd(bignumber(12), bignumber(10))` is `8`, `bitNot(bignumber(12))` is `-13` and `bitXor(bignumber(-1), bignumber(5))` is `-6`, as in mathjs.
  
  `mod` of two BigNumbers on `evaluate` takes the sign of the divisor, as mathjs and the parse path do: `mod(bignumber(-7), bignumber(3))` is `2` (it was `-1`), and `mod(bignumber(-7.5), bignumber(2))` is `0.5` (it was `-1.5`). Both paths now call one function, `flooredModBigNumber`. A NaN or an infinite operand gives NaN, as mathjs (`mod(bignumber(-1), bignumber(Infinity))` was `Infinity` on both paths, and `mod(bignumber(1), bignumber(Infinity))` was `1`).
  
  The return type of a call with one BigNumber and one number changes: `permutations(bignumber(10), 3)` and `permutations(10, bignumber(3))` return BigNumbers, as mathjs does. Before, they returned numbers.
  
  In `@danielsimonjr/mathts-core`, the typed conversion from number to BigNumber comes before every conversion to Complex, as in mathjs, so a BigNumber and a number reach the BigNumber signature on the parse path: `nthRoot`, `round`, `ceil`, `floor` and `fix` of a BigNumber and a number return a BigNumber (they returned a Complex, or `nthRoot` threw the Complex error). `ceil` and `floor` of two BigNumbers no longer throw the internal `DecimalError`. (Refs #1097)
- 789a41a: `expm` of a matrix returns a matrix of the same class and storage. Before, `expm(matrix(A))` returned a native `DenseMatrix` with no `size` method, and `expm(sparse(A))` returned an Array. Now a dense matrix gives a dense matrix, a sparse matrix gives a sparse matrix of its own kind, and an Array gives an Array. A matrix with one or three dimensions now throws the square error with its real size. A matrix that is not square throws a `RangeError` at every site, as in mathjs; before, the same rule threw a plain `Error` at some sites. Each message stays the same, except `eigsh`: an empty input throws `eigsh: dense matrix input must be non-empty`, and a ragged input throws `eigsh: dense matrix input must be square`. A `catch` of `Error` still catches the error. `pinv`, `re`, `im`, `arg` and `setDistinct` of a matrix give a matrix (they gave an Array); `pinv([])` is `[]`, and a 1-D matrix gives a 1-D result. (Refs #1264)
- 3b2ffe6: `round` rounds a tie of a number and of a BigNumber away from zero, as mathjs does: `round(-2.5)` is -3 and was -2, `round(1.005, 2)` is 1.01 and was 1, and `round([-2.5, 1.5])` is `[-3, 2]`. The cause was `Math.round`, which rounds a tie toward `+Infinity`, and a scaling by `10^decimals` that is not exact. A value within `relTol` below a tie rounds up: `round(0.49999999999999994)` is 1. `round(-0)` and a value below `absTol` give 0 and not -0. Core `round` of a BigNumber rounds a tie away from zero and rounded it toward `+Infinity`. An element 0 or -0 of an Array or a matrix stays as it is (`round([-0])` is `[-0]`), as mathjs maps a collection; a Float64Array element takes the scalar rule. A Fraction and a Complex keep the rule of fraction.js and complex.js, so a tie goes toward `+Infinity`. The typed `round` and `factory_round` share one kernel, `roundNumberTol` of core `./internal`, and a `relTol` below `1e-15` no longer makes `factory_round` throw. (Refs #996)
- b866b34: `xgcd`, `combinations` and `isPrime` give exact results for BigNumber integers of any size. `xgcd` of BigNumbers computes the Bezout coefficients as exact integers, so `a*x + b*y = g` holds at every precision and for a negative operand (`xgcd(-1, 2)` is `[1, 1, 1]`, and `xgcd(0, 0)` is `[0, 0, 0]`). `xgcd` throws `Parameters in function xgcd must be integer numbers` for NaN, Infinity and a non-integer number; before, it returned NaN values or floored the operand. `combinations` of two BigNumbers computes the exact binomial coefficient and rounds the result one time to the precision. `isPrime` of a BigNumber of 2^32 or more runs the Miller-Rabin test on bigint, so no product rounds, and NaN, Infinity and a non-integer value of that size give `false`. Below 3317044064679887385961981 the 13 prime bases 2 to 41 are a proof; from that value the test adds the base of mathjs and is probabilistic, as in mathjs.
  
  The return type of a call with one BigNumber and one number changes. `xgcd(bignumber(12), 8)` and `combinations(bignumber(200), 100)` now return BigNumbers, as mathjs does. Before, the BigNumber was converted to a number and the call returned numbers. A bigint or a Fraction argument of `combinations` still gives a number.
  
  `xgcd` of two numbers throws a `RangeError` when a Bezout coefficient is not a safe integer, because a rounded coefficient breaks `a*x + b*y = g` (`xgcd(2^60, 3)` gave `[1, 1, -384307168202282300]`; the exact `y` is `-384307168202282325`). Bigint and BigNumber operands give the exact coefficients. mathjs gives the wrong `[3, 0, 1]` there.
  
  The BigNumber `combinations`, `combinationsWithRep`, `permutations` and `multinomial` of a long loop run at a working precision in O(k) steps, and a rounding proof checks each result: the error bound of the steps gives an interval for the exact value, and the result is accepted only when both ends of the interval round to the same value at the precision (else more guard digits, and at last the exact loop). So each result is the exact value rounded one time, for every rounding mode. A cost model in limb operations selects the exact loop or the working loop; `combinations(bignumber('1e10000'), 2)` takes milliseconds. `catalan` and `bellNumbers` of a BigNumber use the same proof: `catalan` rounded the binomial coefficient and then the quotient (two roundings), and the guard digits of `bellNumbers` did not cover the n(n + 1) / 2 additions behind the last entry of its triangle.
  
  In `@danielsimonjr/mathts-core`, `BigNumber.fromBigInt` and the normalization of every BigNumber result remove trailing zeros by powers 10^(2^j), not one zero per step: `BigNumber.fromBigInt(10n ** 100000n)` took 25 s and `xgcd(bignumber('1e100000'), bignumber('1e99999'))` 24 s; each now takes milliseconds. (Refs #1164)
- 89f1ec7: The binaries `mathts.wasm` and `mathts-debug.wasm` of the package have no import any more. The build sets `use: ["abort=src/abort/trapAbort"]` in `asconfig.json`, so an abort calls a function of the binary that traps, and no host function `env.abort` is necessary. Node reads each import of a WebAssembly module as a package name, so `import('@danielsimonjr/mathts-wasm/wasm')` failed with `ERR_MODULE_NOT_FOUND`. Now Node loads both binary subpaths as WebAssembly ES modules (Node 22.12 needs `--experimental-wasm-modules`; Bun returns the file path as `default`), and any runtime instantiates them with an empty import object. The subpaths `./wasm` and `./debug` have a `default` condition, so `require.resolve` finds the files. The new subpath `./debug.js` exports the glue of the debug build. An abort stores its message, file, line and column in globals of the binary (new exports `abort_take`, `abort_message`, `abort_file`, `abort_line` and `abort_column`) and traps as `WebAssembly.RuntimeError`. The glue turns the trap into `Error('<message> in <file>:<line>:<column>')`, the text of before. `functions` and `matrix` ship the rebuilt binary (64867 bytes, no import). `@danielsimonjr/mathts-core` exports `guardWasmAborts`, `translateWasmAbort` and `WASM_ABORT_TEXT` from `/internal`, and the loaders of `matrix` and `functions` use them. An abort that a call of their WASM tier reaches is the same `Error` as before (`WASM abort`; `AS WASM abort` from `WASMBackend`), and its `cause` now holds the message and the position of the abort. The loaders no longer print a `console.error` line for an abort. Their `getImports()` is empty. (Refs #1019)
- a7c47d4: BigNumber `sinh` keeps a small argument: `sinh(1e-40)` at precision 20 is `1e-40` and was `0`. The `expm1` of the functions package calls the BigNumber method, so `expm1(1e-70)` is `1e-70` and was `0`. `expm1`, `sinh`, `cosh` and `tanh` of `1e10` return a value and no longer throw `RangeError`. `zeta` of a BigNumber takes the number of Borwein terms from the precision, so `zeta(2)` at precision 64 is correct to 64 digits and was correct to 8 digits. `zeta` of a BigNumber has exact values at 0, at 1 and at a negative even integer, uses one `pow` for each prime term, and returns in milliseconds next to the pole. (Refs #1166)
- 3b2ffe6: `hypot`, the modulus of a Complex (`abs`), `norm` (the vector 2-norm, the Frobenius norm and the matrix 2-norm) and `distance` follow one rule on every path and type: the IEEE 754 rule of `hypot`. An infinite argument gives `Infinity`, also when another argument is `NaN`. Else a `NaN` argument gives `NaN`. Before, the paths did not agree: `hypot(Infinity, Infinity)` was `NaN` on the factory path, `hypot(bignumber(Infinity), bignumber(NaN))` was `NaN`, `norm([Infinity, Infinity])` and `distance([0, 0], [Infinity, Infinity])` were `NaN` for numbers and `Infinity` for BigNumbers. This rule is different from mathjs, which gives `NaN` for `hypot(Infinity, NaN)` and for `hypot(Infinity, Infinity)`. `hypot` of a list longer than 32768 numbers no longer overflows the call stack, and `distance2D`, `distance3D` and `distanceND` no longer overflow to `Infinity` for a large finite difference. The AssemblyScript `complex_abs`, `complex_to_polar` and `complex_array_abs` squared each part before the sum (Infinity above about 1e154, 0 below about 1e-162, NaN for an infinite part with a NaN part) and now take `Math.hypot`. Typed `hypot` of a BigNumber with two or more other arguments converted the BigNumber to a number; it now returns a BigNumber, as with one other argument. `gradientDescent` and the complex eigenvector of `eig` spread their vector into `Math.hypot`, which threw `RangeError` for a long vector; they now use the same long-list `hypot`. (Refs #1259)
- a7c47d4: BigNumber `add` and `subtract` no longer build `10^gap` for a large exponent gap, and `ln`, `log10`, `log` and a fractional `pow` no longer take time in proportion to the exponent. Before, `1e100000000 + 1` did not return and `1e2000000000 + 1` threw `RangeError`. `ln(1e100000)` took 12 to 15 seconds. Now each call returns in milliseconds, in every rounding mode, with the same digits as the exact sum. A fractional `pow` of a large argument keeps its last digits. An `add` or `multiply` of a wide operand that overflows gives `Infinity` and gave `0`. (Refs #1249)
- b866b34: The bigint greatest common divisor has one implementation, `gcdBigInt` in `@danielsimonjr/mathts-core/internal`. Before, `functions` had five private copies of it, and two copies of the modular power. Now `discreteLog`, `primitiveRoot`, `multiplicativeOrder`, `rationalNullspace`, `egyptianFraction`, the integer-polynomial gcd and the `bigint` branch of `gcd` use the shared code. The values do not change. (Refs #1137)

## 0.29.0

### Minor Changes

- b1977e7: Brand-based type tests accept a value of a second copy of core (#1033). The typed `sum` keeps Complex, BigNumber and Fraction values exact, sums nested arrays and matrices in the pairwise kernel, and sums along a dimension (#1039). The typed `min` and `max`, and `mean`, `variance` and `std`, keep exact types; complex variance uses the conjugate. A 1-D sparse matrix is a column vector. The typed `dot` keeps exact types and conjugates its first argument. A 1-D Matrix keeps its shape when it converts to an Array. New core exports: `pairwiseSumChecked`, `sumSquaredDeviationsChecked` and `pairwiseDotChecked`.
- 1629b29: `min` and `max` of a Float64Array propagate NaN on every sequential and parallel path, as the Array path and mathjs do (#1048). This change adds the core primitive `extrema`.
- 1906ed4: BigNumber gets the decimal.js names that the factory layer calls, a fractional pow, and full-precision transcendental functions; factory and typed norm, hypot and nthRoot keep BigNumber results (#1043).
- a5a8eff: Every function checks a dimension argument the same way (#1047). A non-integer dim throws a TypeError. An out-of-range dim throws an IndexError with a true relation, as in mathjs. This change adds the core helper `validateDimension`.

### Patch Changes

- fe2cf32: `BigNumber.sqrt` and `BigNumber.cbrt` round the exact root once, in the configured rounding mode. A root just below a power of ten no longer rounds up to the power: `sqrt(0.99999999999999999999)` at precision 20 is `0.99999999999999999999`, not `1`. In a directed mode (`up`, `down`, `ceil`, `floor`) an inexact root now rounds in the right direction, and `cbrt` of a negative value rounds the signed result, so `ceil` and `floor` agree with decimal.js. Fixes #1208.
- fbc5277: `BigNumber` `add`, `subtract` and `multiply` round the result to `config.precision` with the configured rounding mode, as decimal.js and mathjs do. Before, the square of a 64-digit value had up to 128 digits, and `add(bignumber('1'), bignumber('1e-30'))` at precision 20 gave `1.000000000000000000000000000001` (now `1`). A repeated product no longer grows without bound: a stage value inside a BigNumber `solveODE` step had 515 digits. An integer `pow` runs its products with guard digits and rounds once. Constructors, `negate` and `abs` keep every digit. Integer arithmetic beyond the precision loses digits, as in mathjs and decimal.js: `add(bignumber('1e30'), bignumber('1'))` at precision 20 gives 10^30 (the 1 is lost), and `factorial(bignumber(60))` at precision 64 has 64 significant digits. `mod` is exact and does not round, so `gcd` and the floored factory `mod` stay exact for integers longer than the precision. `xgcd`, `invmod` and `isPrime` raise the precision for their integer steps. `lcm`, `combinations` of the factory layer (with `composition` and `catalan`), `bellNumbers`, `factorial` and `gamma` of an integer run their steps with guard digits and round the result one time: a result that fits the precision is exact. `log1p`, `asinh`, `acosh`, `atanh` and `acos` keep a small argument and a result near 0 (`log1p(bignumber('1e-40'))` is 1e-40, not 0; `asinh` of a large negative value is finite). The `engineering` notation of `format` keeps every digit of a value. `compare` and `mod` of two values with the same large exponent build no long string. The release is a patch because the documented contract is `config.precision`. Results of more than `precision` digits were a defect, not a feature (Fixes #1118).
- 4304ad1: `BigNumber.isInteger()` returns false for NaN and Infinity. `gcd` and `lcm` of a BigNumber that is not an integer throw as mathjs does, where they never ended. `nthRoot` of a BigNumber with root 0 throws "Root must be non-zero". `permutations(n, k)` with n above 2^53 ends (#1002). `permutations(n, 0)` is 1 for every n, where mathjs returns n when `n + 1 === n`, and each factor above 2^53 has one rounding. `gcd` and `lcm` of a number that is not an integer (NaN, Infinity, 2.5) throw the mathjs error, where they returned NaN or a snapped value. Because a BigNumber NaN is not an integer, `pow` of a negative BigNumber with a NaN BigNumber exponent gives Complex NaN, and `gamma` and `factorial` of a BigNumber NaN give Infinity, as in mathjs.
- f7a4aa7: Kernels of the matrix package no longer compare data to an absolute constant that depends on the unit of the matrix (Fixes #1123, #1125, #1127).
  
  Root causes and results (SciPy and NumPy 2.3.5 are the oracle):
  
  - `WASMBackend.qrDecomposition`, `luDecomposition` and `inverse` (JS and AssemblyScript paths) skipped a column or a pivot below an absolute 1e-14 and squared entries above 1e154. The three methods now run on a copy scaled by an exact power of 2 when the largest entry is outside [2^-3, 2^400]. `[[3e-100,1e-100],[4e-100,2e-100]]` gave `Q = I, R = A` and `singular: true`; it now gives `|R| = [[5, 2.2], [0, 0.4]]e-100`, a regular LU and `inverse = [[1e100, -5e99], [-2e100, 1.5e100]]`. `[[3e200,1e200],[4e200,2e200]]` gave `Q·R ≠ A`; it now gives `Qᵀ·R = A` to 1e-16. The window constant is `UNIT_LO` in `core/src/pow2-scale.ts`; the scaling uses the shared `withPow2Scale`.
  - The JS path of `WASMBackend.luDecomposition` and `inverse` did not test the last pivot. `[[1,2],[2,4]]` gave `singular: false` and an inverse of NaN entries. The JS path now reports `singular: true` and a zero inverse when the last pivot is below 1e-14, as the AssemblyScript path does. `[[1,0],[0,1e-15]]` is now singular on both paths (it was regular on the JS path). The absolute 1e-14 pivot floor inside the scaling window is #1172.
  - `matrixSqrtm` compared with an absolute 1e-8 (symmetry, negative eigenvalue of a symmetric matrix), 1e-7 (negative or complex eigenvalue of a non-symmetric matrix) and 1e-13 (Newton step). Below a largest entry of 1 each cutoff is now relative to that entry. The eigenvalue tolerance is also never below 1e-13 of the largest entry, so it grows above a largest entry of 1e5 (symmetric) and 1e6 (non-symmetric): the rounding noise of a zero eigenvalue is no longer read as a negative eigenvalue. The 2×2 block root test and the Newton residual test are the tests of the previous release. `matrixSqrtm([[4,1],[1.02,3]]·2^-22)` gave a symmetric matrix with off-diagonal 1.3359e-4; it now gives 1.3227e-4 and 1.3492e-4 (SciPy). `matrixSqrtm(zeros(2))` gave `5.684e-14·I`; it now gives zeros (SciPy).
  - `matrixSqrtm` of a non-symmetric matrix was wrong from about 2^40 (#1127). The Schur form keeps Hessenberg residue below its quasi-diagonal of up to 1e-12 of the neighbouring diagonal, and the absolute test `|T[i+1][i]| < 1e-12` read residue of a large matrix as a 2×2 block. The test is now relative to the neighbouring diagonal. For G·2^52 the error of the root, scaled back, was 0.0122; it is now 0 (equal to `sqrtm(G)`), and G·2^300 gave NaN and now gives the root.
  - `matrixLogm` rejected an eigenvalue at or below an absolute 1e-14. The Schur path now accepts a positive eigenvalue at or below 1e-14 only when it is 1e8 times above the backward error `max|A - Q·T·Qᵀ|` of the Schur form, so its logarithm has a relative error of at most 1e-8. `matrixLogm(diag(1, 1e-20))` threw `non-positive eigenvalue`; it now gives `diag(0, -46.0517)` (SciPy). `matrixLogm([[1e-20,1],[0,1]])` threw; it now gives `[[-46.05, 46.05], [0, 0]]` (SciPy). The Schur block test and the root denominator test are relative the same way.
  - `matrixLogm` used 16-point Gauss-Legendre constants with nodes wrong by up to 1e-8 and weights that summed to 1 - 1e-11, so each Schur-path logarithm had an error of about 1e-11. The constants are now correct to the last bit. `matrixLogm([[2,1,0],[1,3,1],[0,1,4]])` was 3.1e-12 from mpmath; it is now 1.6e-15.
  - For a large matrix whose Schur form keeps residue above an absolute 1e-12 (the previous release took the Newton path), `matrixLogm` runs both paths and keeps the Newton result only when it agrees with the Schur result to 1e-8. The Newton path is more accurate there when it converges, and wrong by up to 1e11 when it does not.
  - `qr` treated a column of residual norm below an absolute 1e-14 as dependent. The cutoff is now relative to the largest entry when that entry is below 1. A 3-column matrix of pivots 1.6e-15 and 1.3e-15 at 2^-19 kept its column in the NumPy values.
  
  Known limit: `matrixLogm` of a singular matrix of large entries returns a finite matrix instead of throwing (#1174). This is also the behaviour of the previous release.
  
  Value and throw changes:
  
  - `WASMBackend.luDecomposition` and `inverse`, JS path: 217 of 1,500 ordinary matrices change from `singular: false` to `singular: true` with a zero inverse. Each of the 217 has a reciprocal condition number below 1e-13 (largest 8.7e-15). Of 320 scaled matrices, 26 change to singular (reciprocal condition number below 1.2e-15) and 13 change from singular to regular.
  - `WASMBackend.luDecomposition` and `inverse`, AssemblyScript path: 17 of 320 scaled matrices change from singular to regular. No ordinary matrix changes.
  - `matrixSqrtm`, largest entry below 1: 10 non-symmetric matrices with a small negative eigenvalue (8 of 1,500 ordinary, 2 of 320 scaled) now throw `negative eigenvalue`. The previous release returned a real matrix with an error of 4e-4 to 4e-3; SciPy gives a complex root.
  - `matrixSqrtm`, largest entry above 1e5: 5 of 320 scaled symmetric matrices that threw `negative eigenvalue` now return the real root. The error against the SciPy root is 4e-9 to 1.1e-8.
  - `matrixLogm([[1e-20,1],[0,1]])` and `matrixLogm(diag(1, 1e-20))` return a value instead of throwing.
  
  Differential against the previous release (1,500 ordinary matrices of size 1 to 6, entries up to 1e6; 320 of them scaled by 2^-60 to 2^600). Equal means the same doubles.
  
  | function                                   | ordinary                                                             | scaled                                                                            |
  | ------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
  | `matrixSqrtm`                              | 1,488 equal; 8 value to throw; 4 symmetric closer (5e-13 to 1.2e-15) | 306 equal; 5 throw to value; 2 value to throw; 7 last-bit or closer               |
  | `matrixLogm`                               | 749 equal; 741 closer; 10 further, at most 2.1 times                 | 145 equal; 169 closer (1 was wrong by 2.6e10); 6 further, at most 2.1 times       |
  | `qr`                                       | 1,499 equal; 1 changed, equal error (largest entry below 1, graded)  | 320 equal                                                                         |
  | `WASMBackend` `qr` (AS and JS)             | 1,499 equal; the same 1 changed, equal error                         | 287 equal; 29 closer; 4 equal error                                               |
  | `WASMBackend` `luDecomposition`, `inverse` | AS 1,500 equal; JS 1,283 equal, 217 regular to singular              | AS 303 equal, 17 singular to regular; JS 281 equal, 26 to singular, 13 to regular |
- c4ddb8c: Fixes #1168. `qr` of a small matrix of plain numbers no longer loses a column. The Householder step reads a residual column norm of 1e-15 or less as zero, an absolute test. A matrix with a largest entry in [2^-20, 1) was not scaled, so the residual of a nearly dependent column fell below the test and the reflection was skipped. `qr` now scales every all-number matrix with a largest entry below 1 by an exact power of 2 into [1, 2), and scales R back. Core exports the new window exponent `UNIT_FLOOR_LO = 0` (window start 2^0) from `/internal`. Complex, BigNumber and Fraction matrices are not scaled and still have the defect (#1188).
  
  Value changes: the factors of an all-number matrix with a largest entry in [2^-20, 1) and a column within about 1e-15 (absolute) of the span of earlier columns change from a skipped step to the true reflection. `[[1,1,1],[1,1+3e-10,1],[1,1,1+3e-10]]·2^-19` had a reconstruction error of 5e-11 and a wrong sign of R22; the error is now about 3e-16. Scaling by a power of 2 is exact, so other inputs give the same factors, except where an entry is subnormal before or after scaling.
- 2771df1: Matrices with extreme entries now work in the `functions` kernels, in `lstsq` and in the `svd` family (Fixes #1122, #1124, #1129).
  
  `qr`, `sqrtm`, `inv`, `rank` and `nullspace` of `functions` scale a matrix of plain numbers by an exact power of 2 when its largest entry is outside a window, as in #1104, and scale the result back. The window is 2^-400 to 2^400 for `inv`, 2^-20 to 2^400 for `qr`, `sqrtm`, `rank` and `nullspace`. A matrix inside its window takes the old path. The scale helpers (`withPow2Scale`, `entryRange`, `ldexp` and others) now live once in `@danielsimonjr/mathts-core/internal`, and `matrix` re-exports them from its `common.ts`. `eig` of `matrix` now uses the same helper in place of its own copy of the rule. Its results have the same bits on 5,716 matrices from 2^-1040 to 2^1010.
  
  A differential against the build before this change ran each changed function on 1,800 ordinary matrices of size 1 to 6 (largest entry 1e-5 to 1e4: real, integer, rank-deficient, symmetric positive definite and 1 × 1; 1,297 square ones for `inv` and `sqrtm`). Every result has the same bits, for `qr`, `inv`, `sqrtm`, `rank`, `nullspace` and `pinv` of `functions` and for `lstsq`, `svd`, `singularValues`, `pinv`, `cond`, `norm2` and `lowRankApprox` of `matrix`.
  
  A second corpus has 2,730 extreme matrices: 200 in each of 11 magnitude classes from 2^-1040 to 2^1010, 300 with one entry far below the largest (the span class), 200 graded diagonals from 1e-34 to 1e-4 and 30 special cases. Each changed result was judged against an 80-digit oracle (mpmath; NumPy 2.3.5 for `rank` and `pinv`). In the class 2^13 to 2^40 every result has the same bits.
  
  | Function                                          | Changed values | Closer | Same error | Further             |
  | ------------------------------------------------- | -------------- | ------ | ---------- | ------------------- |
  | `qr`                                              | 1,481          | 1,304  | 168        | 9 (largest 1.5 eps) |
  | `inv`                                             | 143            | 50     | 5          | 0                   |
  | `sqrtm`                                           | 693            | 692    | 1          | 0                   |
  | `rank`                                            | 1,280          | 1,280  | 0          | 0                   |
  | `nullspace`                                       | 1,292          | 1,286  | 1          | 5 (less than 1 eps) |
  | `pinv`                                            | 151            | 151    | 0          | 0                   |
  | `norm2`                                           | 89             | 89     | 0          | 0                   |
  | `lowRankApprox`                                   | 39             | 39     | 0          | 0                   |
  | `svd`, `singularValues`, `cond`, `functions.pinv` | 12 to 13 each  | all    | 0          | 0                   |
  
  Of the changed `inv` values, 87 more had a non-finite entry before and have one now, for matrices below 2^-1022: each ±Infinity entry is now where the true inverse is above the double range, and no entry is NaN. One more has an infinite input. The `svd` family changes only in the span class and the special cases, where the unscaled run is now judged (#1129). A result that changes between a value and an error:
  
  - `inv`: 7 results were a matrix of NaN and are now the error "determinant is zero" (singular matrices above 2^400). 69 errors "determinant is zero" for matrices near 1e-200 and below are now values. 42 of them have ±Infinity entries, where the true inverse is above the double range.
  - `sqrtm`: 303 values are now an error ("could not converge" for 291, "determinant is zero" for 12). Each of those values was wrong (a residual above 1e-10, or NaN). 81 errors are now values.
  
  Known limits:
  
  - `rank` and `nullspace` still change at the window edge 2^-20, because the absolute pivot test applies inside the window (#1157).
  - `sqrtm` can throw between 2^70 and 2^400, because its absolute stop test cannot be met when one unit in the last place of the root is larger than 1e-6 (#1158).
  - `qr` gives a different result for 101 random matrices with a largest entry below 2^-43. 61 of them differ only in the sign of a row of R.
  - `inv` of a matrix whose entries span more than the double range can still return all zeros, as before: `inv([[1e300, 1e-300], [0, 1e300]])` (#1162).
  - `sqrtm` of a singular matrix can return a wrong root with no error, at every scale (#1163). Such a matrix times 2^700 threw before and now returns that root, scaled.
  
  - `qr([[3e200, 1e200], [4e200, 2e200]]).R` was NaN. It is now `[[5e200, 2.2e200], [0, 4e199]]` (NumPy gives the same up to the sign of the first row).
  - `qr` of a matrix with entries below about 2^-51 returned the upper triangle of the input as R, because an absolute zero test skipped every reflection. `qr([[1.3, -0.4, 0.7], [0.2, 2.1, -1.1], [-0.9, 0.5, 1.6]] · 2^-60).R` is now 2^-60 times the R of the unscaled matrix. For a largest entry below 2^-43, a result that was a valid factorization can also change, most often in the sign of a row of R.
  - `sqrtm([[4e200, 1e200], [1e200, 3e200]])` was NaN. It is now `[[1.98158e100, 2.70832e99], [2.70832e99, 1.71075e100]]`, as in SciPy. Above 2^400, the unscaled iteration is tried first and kept when it is finite. Else the matrix is scaled to a largest entry in [1, 4). A scaled run that is not finite throws "could not converge". Before, `sqrtm` of a well-conditioned 2×2 matrix times 2^450 threw "could not converge"; it is now 2^225 times the root of the unscaled matrix.
  - `sqrtm([[4e-20, 1e-20], [1e-20, 3e-20]])` had a diagonal of 9.5e-7, because the stop test is absolute. It is now `1.98158e-10` and `1.71075e-10`, as in SciPy.
  - `inv([[1e200, 1e200], [0, 2e200]])` was all 0. It is now `[[1e-200, -5e-201], [0, 5e-201]]`. `inv([[1e-200, 1e-200], [0, 2e-200]])` threw "determinant is zero". It is now `[[1e200, -5e199], [0, 5e199]]`, as in NumPy.
  - `rank([[1e-20, 1e-20], [0, 2e-20]])` was 0 and `nullspace` was the identity. They are now 2 and `[]`, as in NumPy. An explicit `tol` is still an absolute pivot tolerance, so `rank(A, 1e-10)` of that matrix is still 0.
  
  `lstsq` divided every entry of `b` by the largest one, so the small entries of an extreme `b` became 0 or lost bits. The solution is linear in `b`. When that division would push a nonzero entry below 2^-1022, `b` is now split into the entries that keep their bits and the entries that do not. Each part is solved at its own scale, and the two solutions are added. Any other `b` gives the same bits as before, except a `b` whose largest entry is below 2^-1022 times the largest entry of `A` (see below). `lstsq(I, [[1e200, 1e-200], [0, 1e-200]])` was `[[1e200, 0], [0, 0]]`. It is now `[[1e200, 1e-200], [0, 1e-200]]`, as in NumPy. `lstsq(I, [1e100, 1e-300])` was `[1e100, 0]`, and `lstsq(I, [3, 1e-310])` was `[3, 9.9999999999995e-311]`. They are now `[1e100, 1e-300]` and `[3, 1e-310]`. A subnormal `b` also keeps its bits when the largest entry of `A` is above 1: `lstsq([[9, -2], [0, 1]], [0, 1e-323])` was `[0, 0]` and is now `[0, 1e-323]`. On 400 right-hand sides of that kind with no wide span, 277 results are bit-equal, 123 change, and none is further from the exact solution.
  
  A differential on 900 such right-hand sides (dense, identity, diagonal, triangular, block-diagonal, tall, wide and rank-deficient `A`, vector and matrix `b`) compared the result with the build before this change and with the exact rational solution. 587 results are bit-equal. An entry changes only where a small entry of `b` reaches it. Of the 306 changed results that have full rank, none is further from the exact solution relative to the largest entry of its column, and 25 are closer. Relative to each entry, 288 are closer and 1 is further, by 1.5 eps. The 7 changed rank-deficient results are closer to NumPy.
  
  The `svd` family can keep an unscaled kernel run for a matrix whose entries span more than the double range. That run is now kept only when its singular values are finite and each one is within 1e-10 times the largest singular value of the scaled run. Before, a finite run was kept. `pinv([[1e200, 0, 0], [0, 1, 0], [0, 0, 1e-200]])` of `matrix` returned all zeros. It is now `diag(1e-200, 0, 0)`, as in NumPy. `singularValues([[0, 0, 0], [0, 2e87, 1e86], [1e64, 0, 1e-267]])` was `[2e87, 1e86, 1e64]`. It is now `[2.0024984394500785e87, 1e64, 0]`, as in NumPy.
- 852f6e2: Four small numeric defects.
  
  - A number as the data argument of a stable reduction in core (`pairwiseSum`, `pairwiseDot`, `sumSquaredDeviations`, their `Checked` variants, `neumaierSum`, `neumaierCumsum`, `norm2`, `scaledDistance`, `extrema`) now throws a `TypeError` that names the function. A string, and an object whose `length` is not a non-negative integer, throw the same error. Before, `pairwiseSum(0)` and `sumSquaredDeviations(0)` threw `RangeError: Maximum call stack size exceeded`, and `norm2(5)` gave `0` (#1011).
  - `numberVector` rejects a value that is not an array, typed array, array-like or iterable object. The statistics, signal and linear-algebra functions that take a number vector read a number as `[]`. Before, `zscore(5)` was `[]`, `skewness(5)` was `NaN`, `trapz(5)` was `0` and `signTest(5)` was `{ statistic: 0, pValue: 1 }`. Now each throws a `TypeError` that names the function, for example `zscore: expects an array of numbers, got a number` (#1083).
  - The SVD gave wrong singular values for a matrix whose leading column entry is negative with zeros below it, because the Householder helper returned the non-orthogonal `beta = -2` for that column. Before, `norm([[-3,0],[0,1]], 2)` was `9`, and the singular values were `[9, 1]`. Now the norm is `3` and the singular values are `[3, 1]` (NumPy and mathjs). `pinv`, `lowRankApprox` and `svd` rebuild such a matrix correctly. The default `norm` of a matrix was already the spectral norm (`p = 2`), as in mathjs. A new test pins that default, and the fix above corrects its value for such a matrix: `norm([[-3,0],[0,1]])` was `9` and is `3`. `norm([[1,0],[0,2]])` is `2` (#1082, #995).
  - In `parallel`, `parallelMean`, `parallelVariance` and `parallelStd` on the sequential path pass the data to `pairwiseSum` before they read its length. A number now throws the `TypeError` of core. Before, `parallelMean(1)` gave `0` (#1011).
- 9a720bf: BigNumber handling fixes (Fixes #1117, #1119, #1120).
  
  - #1117: a Fraction converts to a BigNumber as numerator / denominator at the configured precision, not through a 16-digit number. `add(fraction(1, 3), bignumber(1))` gave 1.3333333333333333 and now gives 1.333... to 64 digits. `quantileSeq([fraction(1, 3), fraction(2, 3), fraction(1)], bignumber(3))` gave 0.49999999999999995 and 0.8333333333333333 for the outer quantiles and now gives 0.5 and 0.8333... to 64 digits. A BigNumber method that takes a Fraction (`BigNumber.add(fraction)`) converts the same way. This departs from mathjs 15.2.0 on purpose: mathjs throws a TypeError for `add(fraction, bignumber)`; MathTS keeps its implicit conversion and now keeps the digits. `bignumber(fraction)` already matched mathjs.
  - #1119: `bignumber()` returns 0, as mathjs. `bignumber(undefined)` throws a TypeError that names `bignumber` (mathjs also throws; the old error was a raw "reading 'isMatrix'"). `bignumber(complex(1, 2))` and `bignumber({})` throw a TypeError, as mathjs (they gave 2.236... and NaN). `bignumber(1, 2)` throws a TypeError ("Too many arguments"), as mathjs (it returned 1). The callback shape `(value, index, collection)` is the exception and converts the value, so `map(x, bignumber)`, `forEach`, `filter`, `matrix.map(bignumber)` and `[1, 2].map(bignumber)` work as before (mathjs throws for the last one only). Other values with no BigNumber form also throw a TypeError, as mathjs: a boxed Number, String or Boolean, a Date, a function, a typed array, a Map and an object with `valueOf` (they converted through `valueOf`). A BigNumber or a Fraction of another library (decimal.js, fraction.js, mathjs) still converts, and now keeps its digits. `bignumber('0x1F')`, `'0b101'`, `'0o17'`, a radix fraction (`'0x1.8'`), a binary exponent (`'0x1p3'` is 8) and the word-size form `'0xFFi8'` parse (they threw a SyntaxError). A word size larger than the value (`'0xFFi999999999'`) gives the value at once. A word size with a fraction (`'0x1.8i8'`), an upper-case `I` and surrounding spaces throw a SyntaxError (mathjs throws a DecimalError). Departures from mathjs 15.2.0 for radix strings: a sign applies after the word-size conversion (`'-0xFFi8'` is 1; mathjs ignores the sign and gives -1); the binary exponent must be at most 100000 in magnitude; the result rounds to the configured precision (mathjs keeps every digit of a radix string, and 20 digits when the string has a binary exponent); `'0x1i8p3'` and `'0xFFi8.0'` throw (mathjs gives 1 and -1).
  - #1120: `solveODE` with `RK23` or `RK45` and a BigNumber `tspan` or `y0` uses the same first-step heuristic as the number path (one shared function). For `y' = -y` on [0, 1], RK23 gave y(1) = 1/3 in 2 steps and now gives 0.3679 (e^-1) in many steps. This departs from mathjs 15.2.0 on purpose: mathjs returns 0.3333333333333334 in 2 steps for the same call. A BigNumber t, y and step size round to the configured precision at each accepted step, so the digits do not grow (RK45 on y'' = -y over [0, 10] with a BigNumber state returned values of 42457 characters; they now have at most 68). A BigNumber result has the step count of the number path and agrees with it to about 1e-14 relative. When the squares of the first-step norm overflow (a state near 1e160), the norm is scaled by the largest magnitude: `RK23`, `RK45`, `Rosenbrock` and `RODAS` with a number state of 1e160 did not return, because the first step was NaN. Every other number-path result keeps the same bits.
- aa18779: `hypot`, `norm` (a vector 2-norm and `'fro'`) and `distance` of BigNumber values scale the values by a power of ten before they square them (Fixes #1255). The result is correct whenever it is in range, and the configured `minExponent` and `maxExponent` apply to the result only.
  
  Core adds `BigNumber.hypotN(values)`, the n-ary form of `BigNumber.hypot`. `BigNumber.hypot` calls it. The scale changes only the exponent, so an input with more digits than `precision` is not rounded before it is squared. The squares and the root use 10 guard digits, and the root is rounded once.
  
  Result before the fix, for values of order 5e15 above the exponent limit of the squares:
  
  - `hypot(3e5000000000000000, 4e5000000000000000)`, `norm([..])` and `norm([[..]], 'fro')` returned `Infinity`. The result is now `5e+5000000000000000`.
  - `hypot(3e-5000000000000000, 4e-5000000000000000)` and the same `norm` returned `0`. The result is now `5e-5000000000000000`.
  - With `config({ maxExponent: 100 })`, `hypot(3e60, 4e60)` returned `Infinity`. The result is now `5e+60`.
  - At precision 20, `hypot(368908340768.57994560571, 3.0302e-19)` returned `368908340768.5799456`. The result is now the correctly rounded `368908340768.57994561`. In 3000 seeded random vectors at precision 20 (2 to 6 values, 1 to 30 digits, orders -60 to 60), the result equals the exact root rounded once in all 3000. Before the fix, typed `hypot` and `norm` differed from the exact root in 240 of the 3000, and the factory `hypot` in 861. So the last digit of an ordinary `hypot`, `norm` or core `BigNumber.hypot` result can change.
  - A number in a list with a BigNumber is converted with `BigNumber.fromNumber` before the squares. The factory `norm` squared the number as a number first, so `norm([bignumber('0.1'), 0.2])` changes from the 17th digit (`0.22360679774997899...` is now `0.22360679774997896964...`, the root of 0.05).
  - The factory `hypot` of a BigNumber and a number that is not finite threw `Cannot create fraction from non-finite number`. The result is now `NaN` or `Infinity`. The factory `hypot` of two BigNumbers whose root is above `maxExponent` returned `0`. The result is now `Infinity`.
  - `norm(v, p)` for p other than 2 returned `Infinity` or `0` when the sum of p-th powers was out of range, for numbers and BigNumbers (for example `norm([1e200, 1e200], 3)`). The norm is now `m * norm(v / m, p)` in that case, with `m = max(abs(v))` for a positive p and `m = min(abs(v))` for a negative p. For numbers, the case also includes a sum below 2^-969, where a subnormal p-th power loses digits: `norm([1e-107, 1e-107], 3)` was `1.2590858e-107` and is now `1.2599210e-107`. A sum in range keeps its digits.
  - The point-to-line `distance` returned `NaN` when a product or a square overflowed (for example the point `(3e160, 4e160)` and the line through `(0, 0)` and `(1e160, 0)` at `maxExponent: 300`, or numbers of order 1e160). The result is now `4e160`. The subnormal point-to-line `distance` result also changed: `distance([3e-160, 4e-160], [0, 1e-160, 0])` is now `4e-160` and was `3.99998e-160`.
  - `hypot` of an infinite BigNumber and a NaN BigNumber stays `NaN`, as in mathjs 15.2.0. The typed `hypot(Infinity, NaN)` of numbers stays `Infinity` (#1259).
- 3929108: Fixes #1201. `BigNumber.sqrt` and `BigNumber.cbrt` seed Newton from the mantissa and scale the seed by an exact power of ten, so a value outside the double range (for example `1e-400` or `1e400`) no longer returns Infinity (or -Infinity for a negative `cbrt`).
- 404e8a4: `BigNumber` enforces `minExponent` / `maxExponent`, no longer writes huge exponents as zeros, and overflows an exponent sum above 2^53 (Fixes #1204).
  
  - `valueOf()` builds no zeros. `BigNumber.parse('1e100000000').valueOf()` is `Infinity`, as before, but it no longer builds a string of 100000001 characters first.
  - `toString()` writes exponential notation when the order is at or above `toExpPos` or at or below `toExpNeg`. `BigNumber.parse('1e100000000').toString()` is `'1e+100000000'` (12 characters; it was 100000001 characters). `toExpPos` and `toExpNeg` are new `BigNumberConfig` fields with the defaults `1e6` and `-1e6`. A value with an order below 1e6 keeps its fixed-point output (`1e25` is still `'10000000000000000000000000'`). `toFixed()` still writes fixed-point notation.
  - `minExponent` and `maxExponent` were never read. Their default is now -9.007e15 and 9.007e15 (it was -1e9 and 1e9, not enforced), just below 2^53 - 2^31, so every in-range exponent is an exact integer. A value whose order is above `maxExponent` is `Infinity` or `-Infinity`, and one below `minExponent` is `0`, as in decimal.js. A value with an order of 2e9 (`1e2000000000`) stays finite.
  - An exponent sum above the bound overflows: `1e5000000000000000` squared is `Infinity` (it was `1e+10000000000000000`), and the cube of `3e4503599627370497` is `Infinity` (it was `2.7e+13510798882111492`, an exponent above 2^53 that was rounded).
  - `BigNumber.config()` throws `RangeError` for a bound that is not an integer from -(2^53 - 2^31) to 0 (`minExponent`, `toExpNeg`) or from 0 to 2^53 - 2^31 = 9007197107257344 (`maxExponent`, `toExpPos`). The message names the limit. `parse` still throws `RangeError` for an exponent text above 2^53 - 1; a parsed order from 9.007e15 to 2^53 - 1 is now `Infinity` or `0`.
  - The bounds apply to the result of a function, not to its inner steps. `exp`, `ln`, the trigonometric and hyperbolic functions, `pow`, `hypot` and the constants (`piAt`, `ln2At`) run their inner steps with the widest bounds. With `maxExponent: 5, minExponent: -5`, `sin(1)` keeps all 64 digits, and with `maxExponent: 5, minExponent: -100`, `1000 ** -3` is `1e-9`. `hypot` divides its operands by a power of ten before it squares them, so `hypot(3e5000000000000000, 4e5000000000000000)` is still `5e+5000000000000000`. `asinh` of a value whose square is above 2^53 - 2^31 is `ln(2x)`; it threw an out-of-memory `RangeError` before.
  - `bitAnd`, `bitOr`, `bitXor`, `bitNot` and the shift functions accept a BigNumber integer with an order of 1e6 or more. They read the integer with `toBigInt`, not from the `toString` text.
- db3f34f: `BigNumber.toBigInt()` multiplies or divides the coefficient by a power of ten and no longer builds and parses a zero-padded string (#1245). No value that the old conversion returned now throws, and every result is the same. Measured on Node 26: most values with an exponent between -2048 and 2048 are 4 to 40 times faster (`1e20`: 4.1 to 0.45 microseconds per call; a value below 1 or a 60-digit coefficient with 30 decimals takes the same time), `1e5000000` takes 1.5 s (before 2.6 s) and `1e100000000` takes 59 s (before 85 s). A value with 323231232 digits or more is certainly above the V8 bigint limit of 2^30 bits and throws a `RangeError` before any work, for example `1e1000000000`; the old conversion threw `RangeError: Invalid string length` for that input and a `SyntaxError` after seconds of work for `1e323000000`. NaN and Infinity still throw `Cannot convert NaN or Infinity to bigint`.

## 0.28.0

### Minor Changes

- 799b0fe: Compat output matches mathjs for `toString` and scalar trig (#889, #891, #892, #737).
  
  Breaking, visible output changes:
  
  - `Fraction#toString` prints the repeating decimal (`1/3` is now `0.(3)`, `1/2` is `0.5`). `format()` still prints the ratio (`1/3`), and a whole value prints without a denominator (`format(fraction(4, 2))` is `2`, not `2/1`).
  - `Matrix#toString` (matrix package, and the compat dense and sparse matrices) prints the nested-array form through `format()`: `[[1, 2], [3, 4]]` for 2-D, nested brackets for 3-D and more. Entries use `format()`: a Fraction entry prints `1/3` and a string entry prints quoted. The sparse matrix no longer prints the `Sparse Matrix [n x m]` listing from `toString`.
  - `Complex#toString` prints `NaN` when a part is NaN and `Infinity` when a part is infinite, as mathjs does (`log(-Infinity)` prints `Infinity`).
  - The compat instance type has no string index signature: `MathInstance` is the functions namespace plus the compat members. Code that read `math[name]` as `unknown` needs a cast.
  
  Workbook cells keep the ratio form for a Fraction result (`1/3`).
  
  Compat scalar `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `exp` and `log` take a number fast path.
  
  Documented exception: `asin(NaN)`, `acos(NaN)` and `log(NaN)` return a real `NaN` (mathjs returns Complex `NaN`); the printed text is the same.
- b95de8a: **Breaking:** Node 20 is dropped (`engines.node` >=22.12); packed-consumer contract (#886, #888, #890, #893, #905, #912, #914, #916, #930).
  
  Every package sets `engines.node` to `>=22.12`, and CI tests 22.x and 24.x.
  
  Every `exports` entry gains a `default` condition equal to `import`, so `require()` of the ES build works at run time on Node >= 22.12 (`mathts-wasm` has top-level await and stays import-only). Node 22.12 prints an `ExperimentalWarning` for it; 22.13 and later do not. On Node 22.11 and earlier, `require()` reports `ERR_REQUIRE_ESM`; use `import()`. TypeScript accepts the `require()` of these packages from CommonJS under `moduleResolution: nodenext`; `node16` reports TS1471. Issue #736 closed docs-only because its acceptance allowed documenting ESM-only; the `default` condition is the `require(esm)` fix.
  
  Published `.d.ts` files name no Node, workerpool, DOM or WebGPU global, so strict `tsc` with no `@types/node` passes. The `mathts-gpu` handle types are the WebGPU global types when the consumer has them, and interfaces of the package when it has not. `mathts-workerpool` ships a `browser` build (the worker is one classic script), so a bundler pulls no Node builtin into `mathts-compat`. README code fences carry a runtime tag. `functions/evaluate` is not a size saving; use `mathts-expression` for a small bundle.

### Patch Changes

- 2635bbb: `Unit._findUnit` keeps the length of the longest unit name in its index, so a miss no longer reads every `UNITS` name. The 577,000 miss calls of the reading oracle take 3.8 s, not 24.5 s (#956). The JSDoc of `UnitInstance.value`, `toNumber` and `toNumeric` states that `value` is the SI magnitude and that `toNumeric()` is the number in the shown unit (#921). Unit conversion rounds the exact scale once; the tests pin `5 cm` to `inch` (#742).
- aa76758: `evaluate('0.75 inch')` and `unit(0.75, 'inch')` store one exact value, and `60 mile/hour` agrees on both paths (#955). The `sin(200 grad)` result moves to the exact value, which is closer to sin(π) = 0.

## 0.27.0

### Minor Changes

- 17f64da: Fraction `toString` uses decimal form when the denominator is a power of ten (`0.1`), and `toJSON` emits numeric `n` and `d` when they are safe integers. `size` returns a Matrix when `config.matrix` is `Matrix`, including for native dense matrices, and that matrix stringifies as `[2, 3]`. `createUnit` replaces an existing unit only when `{ override: true }` is passed. Unit conversions keep exact rational scales, so `1 L` is `1000 mL`.

### Patch Changes

- ef236dc: Linear-time unit parsing with a 10k length cap; decibel (power) and neper (field) units; physics scope binds `e0`/`G`/`c`/`hbar` (bare `e` stays Euler — breaking for callers that read `physicsScope().e` as the elementary charge); CODATA 2022 absolute uncertainties on physical constants, `0` when the constant is exact. Dimensionless CODATA values (`fineStructure`, `weakMixingAngle`, `sackurTetrode`) stay usable as numbers via `valueOf` and also expose `.unc` (their runtime type is object).
- adcebad: Packaging (G27): neutral esbuild bundles no longer resolve Node builtins (workerpool requires are indirect; natural sort is in-repo ESM). `@danielsimonjr/mathts-functions/evaluate` is the same safe evaluate as the root and a smaller bundle. Safe evaluate keeps parse, typed, createUnit, resolve, simplify, derivative, and node constructors unreachable. ESM-only migration note, GitHub blob URLs in package READMEs, and a deterministic README stats check.
- b5f036d: Publish public call overloads generated from the live typed-function signatures (add, abs, sqrt, exp, log, trig, mean, variance, std, det, evaluate), keep them in sync with a failing check, fix `Unit` as a type via interface merge, and stop referencing `@webgpu/types` so consumers resolve WebGPU names from the TypeScript DOM lib.
- 7247de3: Reject nullish and invalid operands in core scalar helpers and typed `add`/`multiply` instead of crashing on `.im` or coercing strings to Complex.
- e7939a7: `new BigNumber(x)` and `BigNumber.from(x)` now construct working instances (fixes runtime/type mismatch from a private constructor erased in JS). Export `bignumber` from core and `@danielsimonjr/mathts-numbers`. A second constructor argument throws; `new BigNumber(existing)` copies and `BigNumber.from(existing)` keeps the same instance. Internal values use a private token so `new BigNumber(1, 2)` cannot set the coefficient.
- a07bf29: Packaging P2 (dogfood G29): ship LICENSE in tarballs, homepage/bugs links, `exports['./package.json']`, honest `sideEffects`, JS source maps from tsdown, and workerpool types that typecheck without `@types/node` (via updated `@danielsimonjr/workerpool` patch).
- ca97716: `Unit.add` for same-dimension addition; incompatible unit `add`/`subtract` throw `DimensionMismatchError`. `new Unit(NaN, …)` and non-finite numeric values throw `TypeError: Unit value must be finite`.

## 0.26.0

### Minor Changes

- 2f73d66: Add a deterministic mode (issue 380). `setDeterministic(true)` from `@danielsimonjr/mathts-core` (or `config({ deterministic: true })` from functions) makes results bit-identical whether or not the WASM tier is loaded: only the WASM kernels measured bit-identical to JS (`abs` on a `Float64Array`) still run, and implicit WebGPU, worker-pool parallelism, the integration and sampling fan-outs, and the WASM matrix backend are skipped. See `docs/determinism.md`.

## 0.25.3

### Patch Changes

- 4c870ff: `Unit.readings` and `Unit.parse` search a glued unit token in one pass. A token with many partial readings and no full reading no longer takes a time that doubles with each two characters. The readings and their order are the same.

## 0.25.2

### Patch Changes

- d99b779: Add `exactScaleRoundingCount()` in `types/unit/exact-scale` (tests and diagnostics, not in the barrels). It counts the exact-ratio roundings since module load, so a test can prove that unit conversions use the rounding memo without a wall-clock budget.

## 0.25.1

### Patch Changes

- b7f65ed: `Unit.readings` is about 12 times faster. The unit lookup scanned every name in `Unit.UNITS` on each miss. It now scans only the names that end in the last character of the spelling. The result is the same unit and prefix as the old scan, in the same insertion order. The old result memo is replaced by a memo of hits only. Each hit is checked against `Unit.UNITS` before it is used, so a name written directly to `Unit.UNITS` after a miss is found.
  
  The lookup tracks a direct write to `Unit.UNITS` only for a new name. It does not track a direct delete and re-add of a name (the old memo did not track it either), and it never finds an empty-string name written directly. `Unit.createUnitSingle` and `Unit.deleteUnit` are tracked.
  
  Measured on one machine in one session (median of 9 runs, 28,041 glued tokens, `tools/benchmark/unit-readings/bench.mjs`):
  
  - `Unit.readings`: 1,072 to 1,459 us per token before, 82 to 120 us per token after (13.1x and 12.2x).
  - `Unit.parse`, 10,000 distinct expressions: 1.0x to 1.07x.
  - `Unit.parse`, the same 1,000 expressions 10 times: the same as before with the hit memo (0.87x without it).

## 0.25.0

### Minor Changes

- 42f3c97: Add `Unit.readingsWithSource`. It gives the readings of `Unit.readings` and, for each factor, the source text of that factor in the token (`µmK` gives `µm` then `K`). `Unit.readings` is unchanged.

## 0.24.5

### Patch Changes

- 53df281: Unit reading: a glued digit power starts with 1 to 9, so `m0K` and `m01K` give no reading and `Unit.parse('1 m0K')` throws. A superscript plus is a caret plus: `m⁺²K` gives `m^2·K`.

## 0.24.4

### Patch Changes

- 8a5e408: `Unit.readings` reads a caret power (`m^2K`, `mK^-1`) and a superscript power (`m²K`, `m⁻¹K`) inside one glued token.

## 0.24.3

### Patch Changes

- 4d8e4fe: The micro signs `µ` (U+00B5) and `μ` (U+03BC) are now the micro prefix only. `Unit.readings` and `Unit.parse` no longer read them as the atomic mass unit `u`.

## 0.24.2

### Patch Changes

- ff7f9cd: `Unit.readings` reads a factor against the unrestricted prefix set. Thus, `lmpc` gives `l·mpc`, and `Hzpc` gives `H·zpc`. `Unit.parse` keeps the k-and-up prefix rule for `ly` and `pc`, so `Unit.parse('mpc')` still throws.

## 0.24.1

### Patch Changes

- 48c7474: `Unit.readings` reads the degree, micro, ohm and angstrom signs in the same way as `Unit.parse`. Thus, `m°R` gives `m·degR`.

## 0.24.0

### Minor Changes

- e7a003e: `Unit.parse` accepts the middle dot `·` (U+00B7) as a product sign, the same as `*`. For example, `N·m` is `N*m`, and `m^2/(V·s)` is `m^2/(V*s)`. After a solidus, the dot stays in the denominator: `W/m·K` is `W/(m*K)`.

## 0.23.0

### Minor Changes

- 3628d5a: Add `Unit.readings(token)`. The function gives every product reading of one glued unit token (for example `mAs` is `m·A·s` or `mA·s`), before any parse policy.

## 0.22.0

### Minor Changes

- 09b4dde: `ton` is now ambiguous: `Unit.parse` throws `AmbiguousUnitError` for `ton` and `tons`, and the new `shortton` (2000 lb) and `longton` (2240 lb) units name the two tons.
- ac4212b: `Unit.to()` sets a `cycles` property to the cycle bridge: 1 for Hz to rad/s, -1 for rad/s to Hz, and 0 otherwise.
- 2a6c91d: `Unit.parse` throws `AmbiguousUnitError` when a glued token has two or more readings with different dimensions. The error names every reading.
- 0de3d7a: `Unit.parse` accepts glued unit products (`m2K`, `Vs`, `cm^2/Vs`, `NN`) and Unicode superscripts (`K²`, `m⁻¹`). A token that names one unit keeps that reading. A prefix glued to a unit name (`mly`, `mpc`) is refused, and a token with two readings of different dimensions (`mAs`) is still not found.
- 2fd73e8: Compounds with an affine unit (degC, degF) now throw `UnitParseError` unless parsed with `{ affine: 'difference' }`, and `to(target, { reading: 'difference' })` converts a temperature interval.

## 0.21.1

### Patch Changes

- 78f8a1c: `Fraction.multiply` and `divide` cross-reduce before multiplying (Knuth), so the gcds run on the operands instead of the products; `negate`, `abs`, `inverse` and `pow` skip the gcd because their results are already in lowest terms. `Fraction.pow` throws a `TypeError` for a non-integer exponent (it was a bare `RangeError` from `BigInt`). `Unit.createUnit` with several definitions now creates units whose definition names a unit that comes later in the object, and names the unresolved ones when a definition can never resolve. VA/VAR selection compares the real part to the imaginary part instead of to an absolute 1e-14. The unit-lookup memo holds 1000 entries (was 100). Removed a stale TODO in `factory.ts`.

## 0.21.0

### Minor Changes

- 3652c57: psi and torr take SI prefixes (kpsi, mtorr). The parser refuses dB, dBm, dBW, Np, Mach and mach with a reason instead of reporting them as not found, and exports the reasons as REFUSED_UNIT_SPELLINGS.

## 0.20.0

### Minor Changes

- 19c4ba7: Export `mulberry32`, `boxMuller`, and `rowMajorStrides` from core; deduplicate tensor, functions, parallel, and worker copies.
- 11c4559: Add createSeededRng, a forkable Mulberry32 stream with string seeds.
- a6cf17a: BREAKING: `SiDimensionVector` is now a readonly 7-tuple of `Fraction` exponents; use `vec.map((f) => f.toNumber())` instead of comparing tuple elements with `===` on numbers. `fromSiDimensionVector` accepts `SiDimensionExponent` (`number | Fraction`) and still returns the length-10 `number[]` for `Unit`. There is no `toSiDimensionNumbers` helper.

### Patch Changes

- 9f5a065: Phase 6 P6-5: consolidate Complex tan/cot/tanh/coth via `tanFamily` (clone reduction).
- 83d8074: Extract shared `WasmModuleLoader` base (`load` / cached `loadModule` / `getImports`) from the byte-identical copies in `functions` and `matrix` into `core/src/wasm-loader.ts` (`/internal` only). SHA-384 verification stays in each package's Node/browser load paths.
- d7daec0: Consolidate Fraction add/subtract and BigNumber sin/cos Taylor series loops (clone batch H, M11–M12).
- 2fd47ee: Phase 6 P6-9: shared `allocAsHeader` on core `/internal` (clone reduction).
- 9009676: Add supplementary unit aliases `d` → day and `Angstrom` → angstrom. A unit symbol oracle test builds `new Unit(1, symbol)` for all 104 symbols and pins each scale and SI dimension (storage `bit` keeps its own scale; angle, solid-angle and bit exponents are an explicit allow-list).
- b1bdef8: Replace `export type *` barrels with named type re-exports (tree-sitter-typescript 0.23.2) and drop `@inline` on private AssemblyScript sort helpers so `repo-tools clones` reports `parseErrors=0`.
- b2a24a0: Fix the JavaScriptCore (Bun) slowdown of `Complex.tan/cot/tanh/coth` from P6-5. The four methods keep one closed form, but it is now bound once per method, when `Complex` is defined, instead of taking two boolean flags on every call through a shared helper. Results are bit-identical to the P6-5 pin.
- 1f52df2: Share Fraction floor/ceil trunc bound (clones plan PR-F).
- 2fd47ee: Phase 6 P6-10: consolidate WASM load paths on `WasmModuleLoader` (clone reduction).

## 0.19.0

### Minor Changes

- 61426de: Add the units UPT was keeping locally, read a single solidus the ISO 80000 way, accept µ μ Ω ℃ and Å, convert cycle rates such as Hz to rad/s, and let createUnit register an exact scale.

## 0.18.1

### Patch Changes

- 4e4acae: `symbolicEqual` simplifies with the default rules (it passed an empty rule array, so every pair compared false). `linearRegression.pValue` and `ols.pValues` are the two-sided Student-t tail computed directly as the regularized incomplete beta (`studentTTwoSidedP`; `2·(1 − studentTCDF)` rounded a steep slope's tail to 0). `ols` equilibrates the normal matrix by its diagonal before inverting, so an SI-scaled design is no longer refused as singular. `Fraction.fromNumber` returns the last continued-fraction convergent at or below `maxDenominator` (it once returned 739/200 for a cap of 64). Found by the Universal-Physics-Tensor deep dive of 2026-10-15.

## 0.18.0

### Minor Changes

- 15adc89: Exact-scale follow-ups after #346:
  
  - **Breaking (0.x minor): `ExactScale` holds irrational powers in one map.** `{ num, den, pi, ln2 }` is now `{ num, den, irrationals }`, where `irrationals` maps a name from the new `NAMED_IRRATIONALS` registry (`pi`, `ln2`) to its nonzero integer power (`{}` for a rational scale, `{ pi: 1 }` for `deg`'s π). Parsing, arithmetic, rounding and formatting all read the registry, so a new constant is one entry there. New helpers: `namedIrrationalScale(name)`, `irrationalPower(scale, name)`, `isRationalScale(scale)`; new types `IrrationalName`, `IrrationalPowers`. `PI_EXACT_SCALE` and `LN2_EXACT_SCALE` remain.
  - **Behavior change from #346 (0.17.0), now documented: `UNITS.degF.value` and `UNITS.degR.value` are numbers.** They were `Fraction(5, 9)` before 0.17.0 and are now the double nearest 5/9, like every other unit value. The exact 5/9 is on the definition's exact scale; conversions of Fraction values stay exact through it.
  - **Scale expressions accept parentheses and whitespace.** `a/(b*c)` reads as a/(b·c) (the same as the single-solidus `a/b*c`), groups nest and take powers (`(1/2)^-1`), and spaces around tokens are ignored (`lbf / inch ^ 2`). Juxtaposition (`2 3`) and unbalanced groups throw.
  - **`exactScaleToNumber` rounds correctly at any magnitude.** Rounding is integer base-2 (53-bit significand, ties to even); the normalization shift comes from the operands' bit lengths, not a bit-by-bit loop. Values below the smallest normal double round on the fixed 2^-1074 grid, and values past the largest finite double overflow to Infinity at the tie. Both operands within 2^53 take one IEEE division, which rounds the same way.
  - **Conversions that still hold their exact SI reading round the AB ratio once.** A number-valued `Unit` built from a built-in exact unit keeps `_exactSI`; `to()` and `toNumeric(other)` use `reading x fromScale / toScale` rounded once. They use the stored quantity only while `value` is still the double it rounds to, so a unit changed by `abs()`, arithmetic, `splitUnit` or an assignment to `value` converts from its current SI double. `createUnit` / non-exact units stay on the float route.
  - **ln 2 is a registered irrational.** Scale expressions accept `ln2`; its constant holds 120 correct decimal places. The Fraction and BigNumber routes give no exact value for a scale with an ln 2 factor, so those callers use the float route. This lets units such as `nat` and `bit` carry ln 2 without embedding it as a float (see #347).
  - **Speed.** `Unit.prototype.exactScale` is memoized per unit list (definition, prefix and power of each component; at most 1024 lists). The constructor builds a number reading's exact SI quantity once and rounds it once; each exact scale object remembers its rounded double. `exactScaleToNumber` keeps its string-keyed memo, bounded at 4096 results, least recently used first. `bun tools/benchmarks/unit-conversions.ts [core/src]` measures the hot conversion paths.

## 0.17.0

### Minor Changes

- f31f5ee: Unit values are now exact, and the built-in units live in one table.
  
  **Corrected values** (SI value of 1 unit; old → new):
  
  - `torr`: 133.322 → 133.32236842105263 Pa (101325/760 Pa exactly)
  - `mmHg`, `mmhg`: 133.322 → 133.322387415 Pa (conventional mmHg, NIST SP 811). `torr` and `mmHg` are now distinct.
  - `psi`: 6894.75729276459 → 6894.757293168362 Pa (lbf/in²)
  - `hp`: 745.6998715386 → 745.6998715822702 W (550 ft·lbf/s)
  - `kip`, `kips`: 4448.2216 → 4448.2216152605 N (1000 lbf)
  - `parsec`, `pc`, `parsecs`: 30856775814913700 → 30856775814913670 m (648000/π au, IAU 2015 B2)
  - `rd`: 5.02921 → 5.0292 m (16.5 ft, the same as `rod`)
  - `sqrd`: 25.29295 → 25.29285264 m² ((16.5 ft)²)
  - `sqch`: 404.6873 → 404.68564224 m² ((66 ft)²)
  - `acre`, `acres`: 4046.86 → 4046.8564224 m² (43 560 ft²)
  - `pica`, `picas`: 0.004233333333333333 → 0.004233333333333334 m (1/6 in, now rounded once)
  - the flat registry (`ALL_UNITS` / `DERIVED_UNITS`): `torr` 133.322368421 → 133.32236842105263 Pa and `psi` 6894.757293168361 → 6894.757293168362 Pa.
  
  **One table, exact scales.** `UNIT_ROWS` (`core/src/types/unit/unit-table.ts`) states every built-in unit's scale as an exact expression (`psi: 'lbf/inch^2'`, `hp: '550*foot*lbf'`, `torr: 'standard_atmosphere/760'`, `parsec: '648000*astronomical_unit/pi'`) over named defining values (`NAMED_SCALES`), and `UNIT_ROW_ALIASES` lists the other spellings. The `Unit` class builds `UNITS` from it, and `ALL_UNITS` / `DERIVED_UNITS` read their multipliers from it, so the two can no longer disagree. Each value is the exact scale rounded once (`exactScaleToNumber`, π carried to 120 digits).
  
  **Conversions round once.** A number-valued `Unit` with built-in units converts through the exact product of its unit and prefix scales: `1 g/cm^3` is 1000 kg/m³ (was 999.9999999999999), `72 mN/m` is 0.072 N/m (was 0.07200000000000001), and `1 m` in `ft` is 3.2808398950131235 (the correctly rounded 1/0.3048; was 3.280839895013123, one ulp low). Expect last-digit changes like this wherever the old float route rounded twice. A typed reading is taken as the decimal it prints as; a normalized value is taken at its exact binary value. Offset conversions are exact too: `212 degF` is 100 degC, `32 degF` is 273.15 K, and a number value now stays a number (it came back as a `Fraction` before, because `degF`'s scale was stored as `Fraction(5, 9)`). Fraction values convert exactly and BigNumber values at their precision. Units made with `createUnit`, VAR, and non-integer powers keep the float route.
  
  **New.** `cal` / `calorie` / `calories`: the thermochemical calorie, 4.184 J (so `kcal` is 4184 J); it was in `ALL_UNITS` but not in `Unit`. `Unit.exactScale(text)` and `unit.exactScale()` return a unit's exact SI scale (`{ num, den, pi }`, bigints and a power of π) or null. Exported from core and units: `UNIT_ROWS`, `UNIT_ROW_ALIASES`, `NAMED_SCALES`, `getUnitRow`, `unitRowExactScale`, `unitRowValue`, `namedExactScale`, `readUnitScale`, and the exact-scale functions (`exactScaleToNumber`, `exactScaleOf`, `binaryExactScale`, `decimalExactScale`, `ratioExactScale`, `multiplyExactScales`, `divideExactScales`, `powerExactScale`, `addExactScales`, `exactScalesEqual`, `formatExactScale`, `readScaleExpression`, `UNIT_EXACT_SCALE`, `PI_EXACT_SCALE`) with the `ExactScale`, `UnitRow`, `UnitBaseKey`, `UnitPrefixSetKey` and `UnitPrefix` types.
  
  **Prefixes and offsets in the table.** `UNIT_PREFIX_SETS` states every prefix set as `radix^power`, generated from one SI list (quecto to quetta) and one IEC list. `Unit.PREFIXES` is built from it (same keys, prefixes and values as before). `getUnitPrefix(unit, prefix)` says whether a built-in unit takes a prefix, `unitPrefixExactScale` gives the prefix's exact factor, and `unitRowExactOffset` gives an affine unit's exact offset in its own degrees (`degF`: 459.67). `SI_PREFIXES` is now read from the same set, so it gains `R`, `Q`, `r` and `q` (1e27, 1e30, 1e-27, 1e-30), which the hand-written list was missing.
  
  Conventions kept and now labelled in the table: `teaspoon`/`tablespoon` are the metric 5 mL / 15 mL, `drop` is 0.05 mL, `stick` is 0.115 kg, `month` is 1/12 Julian year, `BTU` is the International Table BTU, and `bit` (`b`) is its own BIT dimension (storage), not ln 2 nat.
  
  This changes numeric results, so it is a minor bump on these 0.x packages.

## 0.16.0

### Minor Changes

- 5b7ca6d: Add a conversion between the length-10 `Unit` exponent vector and the 7 SI base dimensions, exported from core and re-exported from units. `toSiDimensions` / `toSiDimensionVector` produce the BIPM order `[L, M, T, I, Θ, N, J]`; `fromSiDimensions` / `fromSiDimensionVector` go the other way. Nonzero angle, bit, or solid-angle exponents throw unless `ignoreExtra` is set.

## 0.15.5

### Patch Changes

- 8b0f960: Type fixes that let callers pass real implementations without casts. There is no runtime change.
  
  - **`createTypedFunction`** (factory and typed variants) accepts implementations with concrete parameter types, such as `(a: number, b: number) => number`. Its `unknown[]` parameter type rejected them under `strictFunctionTypes`.
  - **BigNumber formatter.** `formatBigNumber`, `toFixedBigNumber`, `toExponentialBigNumber` and `toEngineeringBigNumber` (the `/internal` entry) now accept core's own `BigNumber` and decimal.js values. `BigNumberValue` is now generic over the implementation's own type. Before this, no real value satisfied it: its members demanded that every implementation accept any other implementation, and the instance `constructor` member was typed as a constructor.

## 0.15.4

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).

## 0.15.3

### Patch Changes

- 3cdf6c6: fix: `ObjectWrappingMap.entries()` and `PartitionedMap.entries()` (and `[Symbol.iterator]()`) now return real iterable iterators, so spread, `for...of` and `Array.from` over them no longer throw.

## 0.15.2

### Patch Changes

- 8473590: Declare `typed-function` and `workerpool` as registry `npm:` aliases (`npm:@danielsimonjr/typed-function@5.0.0-alpha.4`, `npm:@danielsimonjr/workerpool@10.2.1`) instead of `github:` git dependencies. npm 10 (bundled with Node 20 and 22) failed to install these packages with "git dep preparation failed ... Cannot read properties of null (reading 'edgesOut')". The registry builds are code-identical to the git HEADs that were resolved before, and the import names do not change.

## 0.15.1

### Patch Changes

- ecdc79a: Fix the published `dist/map.d.ts` for consumers that compile with `skipLibCheck: false`.
  `ObjectWrappingMap` and `PartitionedMap` declared `keys()`, `values()` and `entries()` as
  `IterableIterator`, but the TypeScript >= 5.6 `Map` declares `MapIterator`, so the classes
  failed `implements Map` with six TS2416 errors. The return types now derive from `Map` itself
  (`ReturnType<Map<K, V>['keys']>` and so on), like `[Symbol.iterator]` already did. Both classes
  also add `getOrInsert` and `getOrInsertComputed` (the ESNext `Map` upsert methods), which a
  consumer with `lib: ["ESNext"]` otherwise reports as missing (TS2420).

## 0.15.0

### Minor Changes

- 57c8ffd: Range now keeps its caches in four public `_cache*` fields instead of ES-private `#cache*` fields. The TypeScript 7 declaration-emit fix made this change. Results are unchanged, but the fields are now visible, enumerable properties of a Range.

## 0.14.3

### Patch Changes

- 966a632: Speed up core hot paths: algebraic Complex.sqrt, closed-form tan/tanh, overflow-safe fast abs, integer BigNumber construction, and allocation-free sumSquaredDeviations.

## 0.14.2

### Patch Changes

- 966a632: Speed up core hot paths: algebraic Complex.sqrt, closed-form tan/tanh, overflow-safe fast abs, integer BigNumber construction, and allocation-free sumSquaredDeviations.

## 0.14.1

### Patch Changes

- 104a1c9: Fix Complex.fromPolar Inf×0 NaN, close expression object-literal sandbox holes, and fail-closed workbook YAML chart-spec parsing.

## 0.13.1

### Patch Changes

- Fix the exported `VERSION` constant, which had silently drifted from each package's published version.

  `VERSION` was a hardcoded string literal that Changesets never bumped, so it drifted: core reported `0.1.0`
  (was really 0.13.0), plot `0.2.0` (was 0.3.29), workbook `0.1.0` (was 0.3.3). Workbook's is user-facing —
  `mtsw version` (and `capabilities`/`introspect`) printed the wrong number.

  Root-cause fix (not a re-hardcode): `VERSION` is now injected at build time from each package's own
  `package.json` via a per-package `tsup.config.ts` (esbuild `define`, read Node-side so `package.json` is
  never bundled into `dist`). Tests import source, so the same define is mirrored into each `vitest.config.ts`;
  `core/tests/version.test.ts` now pins `VERSION` to `package.json` rather than a literal. `VERSION` can no
  longer drift from the published version.

## 0.13.0

### Minor Changes

- Resolve the deduplication campaign's final decisions: a compat compatibility correction and an internal WasmLoader consolidation.

  **compat (behavior change):** `zeros(n)` and `ones(n)` with a single argument now return a length-`n` **vector** (`[0,0,0]` / `[1,1,1]`), matching mathjs, instead of an `n×n` square matrix. Two-argument `zeros(r, c)` / `ones(r, c)` continue to return an `r×c` matrix. compat's purpose is mathjs compatibility, and the previous square result diverged from mathjs (`math.zeros(3)` is a size-`[3]` vector) — this was a bug. Anyone relying on `zeros(n)` returning a square must now pass `zeros(n, n)`.

  **core / functions / matrix (internal, no runtime behavior change):** the shared WASM-loader logic — the SHA-384 integrity verification (`sha384OfBuffer` / `verifyWasmIntegrity` / `loadWasmManifest`) and packaged-binary resolution (`resolvePackagedWasm` / `defaultWasmLocation`) — was byte-identical in `functions` and `matrix` and is now single-sourced in `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`), with each package injecting its own binary/manifest path. The SHA-384 verify-before-instantiate security invariant is preserved byte-for-byte (Node `crypto.createHash('sha384')` / browser `crypto.subtle.digest('SHA-384')`, mismatch throws), node built-ins stay behind lazy dynamic `import()`, and core's browser-safe `.` entry is unaffected. The per-package `WasmLoader` class stays local (distinct AS allocation models).

## 0.12.0

### Minor Changes

- Fix two BigNumber/Complex transcendental correctness bugs found by an mpmath/NumPy oracle audit, and consolidate the fftshift/ifftshift roll algorithm.

  **core (correctness):**
  - `BigNumber.divide` lost all precision when the divisor's coefficient had more digits than the (precision-scaled) dividend — the Newton-iteration step `2 / (g*g)` in `cbrt`/`sqrt` integer-divided to a quotient of `0`. As a result `cbrt(bignumber(2))` returned `4.6e-18` instead of `1.2599…`, and `asinh`/`acosh` on BigNumber degraded to ~11–16 digits. The dividend scale is now widened by `max(0, divisorDigits - dividendDigits)`; the result is **bit-identical** whenever `divisorDigits ≤ dividendDigits`, so no previously-correct division changes.
  - `Complex.acosh` landed on the wrong Riemann sheet for `Re(z) < 0` (`acosh(-1+0.5i)` returned the negated value). It now uses the factored principal form `ln(z + √(z-1)·√(z+1))` (C99 Annex G / DLMF 4.37 / NumPy).

  Every rich-type case of the 12 transcendental scalars (`sinh cosh tanh asinh acosh atanh cbrt log2 log10 log1p expm1 sign`) is now pinned to the mpmath/NumPy oracle by `functions/tests/gap-transcendental-richtype-oracle.test.ts`.

  **functions:** the public `fftshift`/`ifftshift` (`number[]`) and the internal generic complex-FFT toolkit versions now share one `rollBy<T>` algorithm instead of duplicating the roll logic; behavior is unchanged.

## 0.11.0

### Minor Changes

- Arithmetic correctness fixes (BigNumber/Fraction pow/round/equal) + cross-package util consolidation

  **Correctness fixes** (`functions`): three live public-API bugs, fixed at root by delegating the
  rich-type policy cases of the typed dispatchers to core's oracle-pinned scalar primitives:
  - `pow(bignumber(2), 0.5)` returned `1` (silently) — now `1.4142…`; `pow(fraction(3), 2.9)` silently
    floored the exponent to `27` — now `24.19…`.
  - `round(bignumber(-2.5))` returned `-3` — now `-2` (core's type-consistent `halfCeil`).
  - `equal(0.1+0.2, 0.3)` returned `false` (strict `===`) — now `true` (mathjs-parity tolerance via
    `nearlyEqual`; `bigint` stays exact).
    Hot `number`/`bigint` cases remain inline (unchanged, no perf impact). A new equivalence guard
    (fast-check property: typed case ≡ core primitive, + edge corpus) prevents future drift.

  **Consolidation** (`core`/`expression`/`functions`): duplicate mathjs-derived cold utilities
  (factory/string/formatter/array/collection/map) and error classes (`MathjsError`/`DimensionError`/
  `IndexError`) that `expression` and `functions` each carried are now unified on a single
  `@danielsimonjr/mathts-core/internal` canonical, with per-package re-export shims (no public API
  change). Two latent bugs fixed in passing (`ObjectWrappingMap[Symbol.iterator]` type-soundness;
  `sortFactories` now throws on indirect dependency cycles).

## 0.10.0

### Minor Changes

- 000679d: Fix `variance`/`std` accuracy — was ~10⁶× worse than NumPy on large-mean data

  `variance` and `std` lost ~7 significant digits on data with a large mean: variance of 1e9-pedestal
  samples came out at **~1e-7 relative error**, where `np.var` is ~1e-13 and the true value (exact
  rationals) is representable. The deviations `xᵢ − x̄` are small but sit on a huge pedestal, so any
  error in the mean rides straight into every squared deviation.

  Root cause spanned every path: the public typed `variance`/`std` used **Welford's online algorithm**
  (`m2OfArray`), which drifted here; the parallel path (`ComputePool.variance`) used a **naive mean +
  uncorrected two-pass**; and the factory/`std` paths had naive **WASM** kernels (`statsVariance`/
  `statsStd`) that were both less accurate and — being memory-bound reductions — not faster.

  Fixed with a new `sumSquaredDeviations` primitive in `@danielsimonjr/mathts-core`: the **corrected
  two-pass** — mean via pairwise summation, then `Σd² − (Σd)²/n`, where the correction term cancels the
  residual mean-bias exactly. Wired into every path (typed `variance`/`std`, `ComputePool.variance`,
  the factory `variance`, and `std = sqrt(variance)`); the naive WASM fast paths are retired. Now
  **machine-precision (relErr ~0), beating NumPy's uncorrected two-pass** — verified against exact
  rationals and live NumPy. Everything built on variance (`std`, `zscore`, `parallelStatCorr`, …)
  inherits the fix.

## 0.9.0

### Minor Changes

- 397493e: Fix `corr` catastrophic cancellation and a class of BigNumber correctness bugs

  **`corr` could return values outside [-1, 1].** The Pearson correlation used the one-pass
  "computational formula" `n·ΣXY − ΣX·ΣY`, which subtracts two nearly-equal large quantities and
  catastrophically cancels when the data has a large mean: `corr` of two ~1e9 series returned **52**
  (mathematically impossible) for a true value of **−1**. Rewritten to the numerically stable
  **two-pass** form (center by the mean, then `Σdx·dy / sqrt(Σdx²·Σdy²)`), with a pairwise-accurate
  plain-number fast path. Now matches `np.corrcoef` (verified against live NumPy).

  **Core BigNumber comparisons silently mishandled plain-number arguments.** `equals`, `lessThan`,
  `lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`, and `compareTo` passed their argument
  straight to the internal comparator without coercion, so `bignumber(8).lessThanOrEqual(3)` returned
  `true`. They now coerce (`number`/`string` → `BigNumber`) exactly like `add`/`gt` already did.

  **The mathjs-lineage factory layer assumed a decimal.js BigNumber API that core does not implement**
  (`plus`/`minus`/`dividedBy`/`lte`/`gte`/`lt`/`eq`/`cmp`), so many factory functions crashed or
  mis-ordered on BigNumbers. Fixed across arithmetic (`addScalar`, `subtractScalar`), all comparison
  and relational helpers (`nearlyEqual`, `compare`, `smaller`, `smallerEq`, `largerEq`, `equalScalar`)
  — restoring `sort`/`median`/`min`/`max` on BigNumber arrays — plus `cumsum`, `quantileSeq`,
  `factorial`, `gamma`, and `isPrime`. `isPrime`'s Miller-Rabin and `gamma`'s factorial both dropped
  their decimal.js precision-cloning dance (core's BigNumber is bigint-backed, so integer arithmetic
  is already exact). Also fixed a non-idempotent `bignumber()` conversion: `bignumber(aBigNumber)`
  returned `Infinity` (it re-ran `fromNumber` on an object), which corrupted every consumer that
  re-wraps a possibly-BigNumber value.

  No public API removals. These paths were previously **untested** (which is why they stayed broken
  under a green suite); regression tests added in `core/tests/bignumber-comparison-coercion.test.ts`
  and `functions/tests/bignumber-operations.test.ts`.

## 0.8.0

### Minor Changes

- a726fd7: Numerically stable `dot`, `distance`, and `cumsum` (NumPy/SciPy accuracy audit follow-up)

  Three new stable primitives in `@danielsimonjr/mathts-core` (`core/src/numeric/stable.ts`),
  wired into the public reduction paths so every caller inherits the fix:

  - **`pairwiseDot(a, b)`** — pairwise (cascade) dot product. The naive `Σ aᵢ·bᵢ` loop carries
    O(n)·ε error; measured ~18× worse than `np.dot` on an ill-conditioned dot (large mean × small
    factor, n = 10⁶). `dot` (both the `number[]` and `Float64Array` paths) now sums pairwise —
    at NumPy parity for the same flop count.
  - **`scaledDistance(a, b)`** — BLAS `dnrm2`-scaled Euclidean distance. `distance` was
    `sqrt(Σ(aᵢ−bᵢ)²)`, which **overflows to `Infinity`** for large inputs and **silently flushes
    to `0`** for tiny ones (NumPy's `linalg.norm` has the same bug). Now scales on the largest
    _difference_ seen: `‖[1e200]×4 − 0‖ = 2e200` and `‖[1e-200]×4 − 0‖ = 2e-200`, both exact,
    where naive squaring (and NumPy) get `inf`/`0`.
  - **`neumaierCumsum(xs, out)`** — Neumaier-compensated cumulative sum. A prefix scan is inherently
    sequential (pairwise doesn't apply), so `np.cumsum` accumulates naively and its tail drifts
    O(n)·ε (relErr ~1.3e-11 over 10⁶ terms). `cumsum` now carries a running compensation — exact
    prefixes for a few extra flops per element, a strict improvement over NumPy.

  Fixed on **every layer a consumer can reach**, not just the typed one: the public `distance` and
  `cumsum` a caller imports resolve to the mathjs _factory_ implementations (`geometry/distance.ts`,
  `statistics/cumsum.ts`), which were separate naive code paths from the typed `parallelStat*` ones —
  the same "wrong layer" trap that first bit `sum`. Both now route flat plain-number inputs through
  the stable primitives (retiring two naive WASM scans that carried the overflow bug); the generic
  `BigNumber`/`Complex`/multi-dim paths are unchanged. The compat-registry `dot` (`matrix/dot.ts`
  `_denseDot`) gets a plain-1D-numeric pairwise fast path too.

  No API removals; `dot`/`distance`/`cumsum` signatures and results are unchanged in the safe range.

## 0.7.0

### Minor Changes

- b8bf018: **Numerical accuracy: `sum` / `mean` were ~46,000× less accurate than NumPy. Fixed.**

  `sum` accumulated naively (`s += x`), so its error grew as **O(n)·ε**. NumPy uses pairwise
  summation, whose error grows as **O(log n)·ε**. Measured on 1e6 copies of `0.1` (exact answer
  100000):

  | accumulation              | relative error                      |
  | ------------------------- | ----------------------------------- |
  | naive (what shipped)      | **1.3e-11**                         |
  | **pairwise (now)**        | **2.9e-16** — identical to `np.sum` |
  | `fsum` (new, compensated) | **0** — exact                       |

  `mean`, `std`, and `variance` all inherit `sum`'s error, so this was the single largest accuracy
  defect in the library. Pairwise costs the _same number of additions_ — measured 1.03× **faster**
  than the naive loop (eight independent accumulators break the serial dependency chain). There was
  no trade here; the naive version was simply worse.

  **`norm(x, 2)` no longer overflows or underflows — and NumPy still does.** The obvious
  `sqrt(Σxᵢ²)` squares before it adds, so it dies well inside the representable range. MathTS now
  uses LAPACK's `dnrm2` scaling:

  ```ts
  norm([1e200, 1e200, 1e200, 1e200], 2); // 2e200    (np.linalg.norm: inf)
  norm([1e-200, 1e-200, 1e-200, 1e-200], 2); // 2e-200   (naive squaring: 0 — silently wrong)
  ```

  The underflow case is the dangerous one: a plausible `0` rather than an obvious `inf`.

  **New: `fsum(x)`** — exactly-rounded summation (Neumaier), the equivalent of Python's `math.fsum`.
  Pairwise cannot recover a value catastrophic cancellation has already destroyed:

  ```ts
  sum([1e16, 1, -1e16]); // 0  (np.sum gives 0.0 too — the 1 is annihilated by the 1e16)
  fsum([1e16, 1, -1e16]); // 1  (exact)
  ```

  ~2–4× slower, so it is opt-in. Reach for it when the result is a small difference of large terms.

  **`@danielsimonjr/mathts-core`** now exports the primitives directly: `pairwiseSum`, `neumaierSum`,
  `norm2`.

  **`@danielsimonjr/mathts-parallel`** gains a dependency on `core` for these primitives, and its
  `ComputePool.sum` / `.norm` sequential paths use them (0 new cycles).

## 0.6.0

### Minor Changes

- cb4bebf: **Wire `Range` into the public API** and remove the vestigial guard cluster. The complete, tested `createRangeClass` factory (a lazy `start:step:end` numeric sequence, mathjs parity) was reachable only from its own test; it is now exported from the package index — `Range` (ready-made class) + `createRangeClass` + the `Range*` types — alongside `Complex`/`Fraction`/`BigNumber`. Its four `private` memoization fields were converted to ECMAScript `#private` so the class survives declaration emit when public (TS4094). Removed `core/src/utils.ts` and `core/src/types.ts`: dead, unexported, production-unused scaffolding riddled with phantom imports (`utils.ts` imported a `ComplexNumber` type defined nowhere; `types.ts` re-exported from a non-existent `../types/index.js`). Their duplicate guards (`isNumeric` duplicated `arithmetic/scalar`'s; `isComplexLike`/`isMatrixArray` were unused) and self-referential tests were pruned. No production code referenced any of it; published behavior is unchanged apart from the new `Range` export.

### Patch Changes

- a5b5af6: Delete `core/src/types/index.ts` — a redundant, unreachable type barrel. `core/src/index.ts` already exports its constituents (`Complex`/`Fraction`/`BigNumber`/interfaces) directly from `./types/complex.js` etc.; nothing imported the barrel (`core/src/types.ts`'s `../types/index.js` resolves elsewhere, and there is no `./types` subpath export). Published surface unchanged — the barrel was tree-shaken out of the bundle. Surfaced by the dependency-graph tool, which also gained config-referenced-root seeding so bundler-alias targets (e.g. the `workerpool` browser shim aliased in by `vitest.config.browser.ts`) are no longer false-flagged as dormant.

## 0.5.0

### Minor Changes

- 779fcde: B-5 upstream-fix audit (all 61 drift commits since the last mathjs sync; full verdicts in `docs/roadmap/UPSTREAM_FIX_AUDIT_2026-07-05.md`):

  - **`groebnerBasis` rewritten — it was not computing a Gröbner basis at all.** The old code returned the parsed inputs "normalized", through an evaluation-based coefficient extractor that could not distinguish `x` from `x²` — `⟨x²+y²−1, x−y⟩` came back containing `x+y−1`, which does not vanish on the system's solutions. Now: exact AST-parsed polynomial arithmetic + real Buchberger (lex order) with honest iteration/size caps (new `typed/polynomial-ideal.ts`), reduced monic basis, oracle-pinned by ideal-membership vanishing tests.
  - **`eliminate` rewritten — it returned decorative strings, not equations** (`"(A) - (B) [x eliminated]"`) and echoed garbage input. Now computes the real elimination ideal (lex basis with the eliminated variable first, keep elements free of it) and throws on non-equation input.
  - **`laplacian` validates its variables** (empty array / empty strings / missing scope values throw clear errors instead of silent 0).
  - **core `Unit` gains the upstream astronomical/nautical/typography units** (`astronomicalUnit`/`AU`, `lightyear`/`ly`, `parsec`/`pc`, `nauticalMile`/`nmi`, `fathom`, `furlong`, `point`, `pica`) with the upstream prefix-direction fix: `ly`/`pc` accept upward prefixes only (`kpc`, `Mpc`, `Mly` work; `mly`/`mpc` throw instead of silently misparsing), and lowercase `au` stays undefined (Bohr-radius collision). IAU/NIST-pinned.

  Audited clean (no port needed): `discriminant`, `piecewise`, `toRadicals`, `fullSimplify`, `complexExpand`, `reduce`, `rowReduce`.

## 0.4.1

### Patch Changes

- 22427a8: Dead-code sweep: remove all 31 verified-unreferenced exports flagged by the fixed dependency-graph unused-analysis (plus 4 cascade orphans), ~630 LOC. None were public API — every symbol was verified unimported by source, tests, docs, and factory name-string dispatch before deletion. Highlights: the mathjs number-only-bundle factory remnants (`createNthRootNumber`, `createCompareTextNumber`, `createEqualScalarNumber`, `createBigNumberClass`, `createComplexClass`, `createArgumentsError`, `createIndexError`), the dead `functions/src/expression/operators.ts` precedence/associativity chain (the live copy is the `expression` package's own), orphan utils (`initial`, `toObject`, `noIndex`/`noSubset`, `endsWith`/`escape`, `operatorPrecedence`), unused JSON/type contracts, `SI_PREFIX_KEYS`, and AssemblyScript complex-constant helpers. The unused-analysis deletion-candidate count is now **0**.

## 0.4.0

### Minor Changes

- 5611a77: Add `BigNumber.prototype.div` and `.times` — short-name aliases for `divide`/`multiply`, matching the Decimal.js / mathjs calling convention already followed by `Complex` and `Fraction` (`.div`/`.mul`/`.sub`). Both accept the same operand types as their long forms (BigNumber, number, string). Needed by the mathjs-derived `Unit` (which calls `.div`/`.times` on BigNumber unit values) as it merges into core, and useful for general Decimal.js API parity.
- 25b80ed: Add polymorphic scalar arithmetic (`core/src/arithmetic/scalar.ts`): `addScalar`, `subtractScalar`, `multiplyScalar`, `divideScalar`, `pow`, `abs`, `fix`, `round`, `equal` over any mix of `number | bigint | Complex | Fraction | BigNumber`, plus a polymorphic `isNumeric` and a `number()` converter — all built solely on core's own numeric primitives. Dispatch promotes both operands to the richest common domain (Complex ≻ BigNumber ≻ Fraction) and invokes one same-type method, so operand order is preserved for non-commutative ops and same-type operands stay exact. Non-integer exponents on an exact base fall back to double `Math.pow` (so `pow(BigNumber, 0.5)` is correct, not silently `1`); `round` uses `'halfCeil'` on BigNumber for cross-type consistency with `Math.round`/`Fraction.round`; `isNumeric` follows mathjs semantics (boolean is numeric, Complex is not). This is the foundational dependency for the in-progress relocation of the feature-complete `Unit` class into core.
- 82bb0b1: **BREAKING (Unit merge complete): one `Unit`.** The former standalone core `Unit` class (the canonical-value subset in `core/src/types/unit.ts`) is retired; `@danielsimonjr/mathts-core`'s `Unit` is now the single, feature-complete merged implementation, and `functions` `unit()`/`to()`/`toBest()`/arithmetic+comparison operators all return that one class (the `to`/`toBest` operator dual-flavor branching is gone).

  Caller migration:

  - Unit arithmetic is at the operator level — use `add`/`subtract`/`multiply`/`divide` from `@danielsimonjr/mathts-functions`, not `unit.add(…)`/`.sub`/`.mul`/`.div`. `u1 / u2` of the same dimension returns a plain dimensionless number (mathjs parity).
  - `unit.equalBase(other)` replaces `unit.dimensionsEqual(other)`; dimensions are a 9-element exponent array, not a struct; `unit.formatUnits()`/`unit.toString()` replace `.notation`.
  - Temperature offsets apply on conversion (`new Unit(20,'degC').value === 20`; `.to('K')` → `293.15 K`); `°C`/`°F`/`°` are accepted.
  - `DimensionMismatchError`/`UnitParseError` are still thrown and exported; `Unit`/`isUnitValue`/`DIMENSIONLESS`/`dim`/`Dimensions`/`UnitDef` keep their import paths. New `UnitInstance` type export for type position.

  Also corrects `eV` to the exact 2019-SI value `1.602176634e-19` J.

### Patch Changes

- d27e0a5: Fix temperature-unit conversions and preserve degree-symbol notation in the merged `Unit`:

  - `Unit.parse` normalizes `°C`→`degC`, `°F`→`degF`, `°`→`deg` before tokenizing (the mathjs parser rejects `°`), so the merged Unit accepts the same inputs the previous core Unit did.
  - `new Fraction(fraction)` now clones its argument instead of falling through to `BigInt(fraction)`, which threw for non-integer values (e.g. `degF`'s `5/9` factor).
  - `typeOf(value)` returns canonical `'Complex'`/`'Fraction'` for those types instead of `constructor.name` (which a bundler mangles to `_Complex`/`_Fraction`), fixing the Unit's value-type converter dispatch in the built bundle.

  Net effect: `degF`/`°F` conversions (`32 °F → 0 degC`) now work.

## 0.3.1

### Patch Changes

- Gap-analysis closure (no deferral): the remaining high-complexity functions + two root-cause bug fixes.

  All verified against NumPy/SciPy or by self-consistency (d/dx ∫f = f).

  **functions — new:**
  - Optimizers: `nelderMead`, `gradientDescent`, `levenbergMarquardt`.
  - Clustering: `kmeans`, `spectralClustering`.
  - Digital filter design (vs scipy.signal): `firwin`, `butter`, `lfilter`, `lfilterZi`,
    `filtfilt` — `butter` via the full zpk→bilinear→tf pipeline, `filtfilt` via scipy's
    `lfilter_zi` steady-state edge handling (both to machine precision).
  - `studentizedRangeCDF` / `studentizedRangeQuantile` + `tukeyHSD` (vs scipy.stats).
  - `qz` (generalized Schur decomposition of a pencil).
  - `symbolicIntegral` (symbolic indefinite integration over a useful subset).

  **core — fix:** `new Fraction(0.25)` threw `BigInt(0.25)`, which silently broke the CAS
  `simplify` and symbolic `derivative` for ANY fractional coefficient (e.g.
  `derivative('x^4/4','x')`). The constructor now decomposes a non-integer number into an
  exact integer ratio (`0.25` → `1/4`).

## 0.3.0

### Minor Changes

- Named mathematical constants are now real exports + evaluator symbols.

  `docs/reference/constants.md` documented `import { PI, E, PHI, TAU } from
'@danielsimonjr/mathts-core'`, but those were never exported. They exist now:

  - **core**: new named exports `PI`, `E`, `TAU`, `PHI`, `SQRT2`, `SQRT1_2`, `LN2`,
    `LN10`, `LOG2E`, `LOG10E` (plain numbers). The imaginary unit `I` and the
    type-specific constants (`COMPLEX_*`, `BIGNUMBER_*`, `FRACTION_*`) are unchanged.
  - **functions**: the expression-evaluator scope gains `phi`, the imaginary unit
    `i`, and `SQRT2` / `SQRT1_2` / `LN2` / `LN10` / `LOG2E` / `LOG10E` (it already had
    `pi`/`e`/`tau`). So `evaluate('phi')` → 1.618…, `evaluate('2 + 3*i')` → Complex(2, 3).

## 0.2.0

### Minor Changes

- Matrix-factory acceleration + a matrix eigensolver correctness fix + forward-mode AD.

  **fix(matrix): eig — wrong eigenvalues for symmetric matrices with structural zeros.**
  The symmetric-only Givens/Wilkinson eigenvalue path returned grossly wrong
  eigenvalues for symmetric matrices with off-diagonal zeros (e.g. the tridiagonal
  `[[2,-1,0],[-1,2,-1],[0,-1,2]]` gave `[19.05, 2, 0.94]` — sum 22 ≠ trace 6 —
  instead of `[0.586, 2, 3.414]`). Fixed by routing all matrices through the robust
  JAMA orthes/hqr2 solver (verified vs numpy). This also repairs latent wrong
  results in `tensorEig`/`tensorEigWasm`. Note: eigenvectors for symmetric input now
  follow the general solver's convention (they are sign-ambiguous; A·v = λ·v holds).

  **perf(functions): det / inv accelerated.** Large (≥8×8) numeric square matrices
  now route `det` (~20× on 80×80) and `inv` (~9×) through the native Float64Array
  LU instead of boxed `number[][]`. numpy-verified; small / non-numeric / singular
  inputs fall back to the factory unchanged.

  **feat(functions + core): forward-mode automatic differentiation.** A new scalar
  `Dual` type (core, registered for typed dispatch) plus `Dual` signatures on the
  elementary functions (add/sub/mul/div/pow/sin/cos/tan/exp/log/sqrt/square/cube/
  cbrt/abs) make the ordinary functions API differentiable. New entry points
  `derivativeAt` / `valueAndDerivativeAt` / `gradientAt`:

      derivativeAt((x) => multiply(sin(x), x), 2)   // sin(2) + 2·cos(2), exact

## 0.1.5

### Patch Changes

- `Complex` now exposes short-name arithmetic aliases `sub`/`mul`/`div`/`neg` (delegating to `subtract`/`multiply`/`divide`/`negate`). The functions-package typed arithmetic (`subtractScalar`, etc.) calls the short names on scalars; a core `Complex` (e.g. from `sqrt(-4)`) flowing into those paths previously threw `x.sub is not a function`. Mirrors the existing `Fraction` short-alias fix.

## 0.1.4

### Minor Changes

- Add `BigNumber.toBinary()`, `toOctal()`, and `toHexadecimal()` (Decimal.js-compatible: `0b`/`0o`/`0x` prefixes, leading `-` for negatives, exact for integers and terminating fractions). These complete the radix-formatting surface the expression formatter's hex/bin/oct BigNumber path depends on.

## [Unreleased]

### Patch Changes

- `Unit.add` for same-dimension units; `DimensionMismatchError` on dimension mismatch. Reject non-finite numeric constructor values with `TypeError: Unit value must be finite` (Fixes #819, #826).

### Tests

- Raise vitest line coverage of the active core modules from ~80% to ~99% (every active file now ≥98%). Added 4 supplementary test files — `tests/types/complex-coverage.test.ts`, `tests/types/fraction-coverage.test.ts`, `tests/types/bignumber-coverage.test.ts`, `tests/typed/mathts-typed-coverage.test.ts` — plus `math.register`/`math.get` cases in `tests/factory/factory.test.ts`. These exercise previously-untested branches: `Complex` scalar-argument arithmetic, `format()` precision/notation paths, reciprocal/inverse trig & hyperbolic functions; `Fraction` scalar arithmetic, parse dispatch, continued-fraction round-trips, and integer floor/ceil short-circuits; `BigNumber` special-value (NaN/±Infinity/zero) branches across conversions, arithmetic, comparison, rounding modes, trig/hyperbolic/transcendental helpers, the `.e` getter, and the Decimal.js-compat aliases; and `mathts-typed` WASM init helpers, every `MATHTS_CONVERSIONS` convert callback, the duck-typed `isUnit`/`isMatrix`/`isDenseMatrix`/`isSparseMatrix` guards, and the full `TypeRegistry` lifecycle. No source changes — behavior-asserting tests only.

## 0.1.3

### Patch Changes

- Re-export `Unit` from the published build. `core@0.1.2` shipped to npm without `Unit` in its entry export block (the committed `dist` predated the Unit-export commit and was not rebuilt before publish), so downstream `@danielsimonjr/mathts-functions` hit `Unit is undefined`. Rebuilt so `dist/index.js` and `dist/index.d.ts` export `Unit` (`new Unit()`, `.to()`, `.toBest()`, `.value`, `.type`). Added a regression test that asserts the export against the built artifact so this cannot silently regress before a publish.

## 0.1.1

### Patch Changes

- e771b4e: Fix all pre-existing build, typecheck, and configuration issues across the monorepo.

  ### assembly/ (WASM)
  - Fix AssemblyScript build: prefix 114 bare math calls with `Math.`, fix abort path in asconfig.json
  - Add 6 missing inverse trig methods to Complex class (asin, acos, atan, asinh, acosh, atanh)
  - Fix complex_pow calling wrong method (pow → powReal for f64 args)

  ### expression/
  - Enable build: fix broken types.ts import, create tsconfig.json, restore build script
  - Copy shared mathjs utils into package, fix 60+ import paths
  - Export missing types (CompiledExpression, StringOptions), clean up unused @ts-expect-error directives

  ### parallel/ + matrix/ + compat/
  - Fix typecheck failures caused by workerpool shipping raw .ts sources
  - Create workerpool type stub (parallel/types/workerpool.d.ts) with full declarations
  - Redirect workerpool resolution via tsconfig paths in all affected packages

  ### All packages
  - Add @types/node to all 7 workspace package devDependencies
  - Add vitest.config.ts to 5 packages missing local test configs
  - Fix missing beforeAll/afterAll imports in ParallelMatrix tests
