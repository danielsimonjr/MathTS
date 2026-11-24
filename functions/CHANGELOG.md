# @danielsimonjr/mathts-functions

## 0.89.10

### Patch Changes

- c38f2cc: Expose selected MathJS dependency bundles for QR and LUP decompositions, the sparse accumulator, and the Fibonacci heap.
- 8a05164: Expose selected MathJS dependency bundles for 13 expression node constructors.
- c38f2cc: Expose selected MathJS dependency bundles for index construction, immutable matrices, set operations, rows, and columns.

## 0.89.9

### Patch Changes

- e649d66: Expose MathJS dependency bundles for triangular solves, range generation, distance, log1p, and Bernoulli numbers.
- cd4f430: Expose selected MathJS factory bundles for bignumber, fraction, complex, and numeric conversions.
- cd4f430: Expose more selected MathJS arithmetic and matrix factories, including scalar division, elementwise division, logarithms, and roots.

## 0.89.8

### Patch Changes

- aafaf92: Expose native MathJS factory bundles for rounding, modular arithmetic, matrix construction, sorting, and set size.
- 602aec8: Expose MathJS factory bundles for Chain, chain, and ResultSet.

## 0.89.7

### Patch Changes

- 9ed1bee: Expose native MathJS dependency bundles for mode and mapSlices, including empty-input errors and injectable dimension validation.
- 75fc560: Expose the MathJS number factory and dependency bundle, including signed word-size literals, radix fractions, and JSON revival.

## 0.89.6

### Patch Changes

- b6915dd: Expose more native MathJS factory bundles for bit shifts, matrix operations, comparisons, and numeric functions.
- c71620c: Expose native MathJS dependency bundles for binary, hexadecimal, and octal formatting and cube roots.

## 0.89.5

### Patch Changes

- 3ae5e5d: Expose native MathJS factory bundles for matrix creation and manipulation.
- 3ae5e5d: Expose native MathJS dependency bundles for binary operations, comparisons, and numeric predicates.
- 3ae5e5d: Expose MathJS addition and subtraction factories for selected scalar and matrix instances.

## 0.89.4

### Patch Changes

- 59fd216: Expose selected scalar arithmetic, comparison, and numeric factories with their MathJS dependency bundles.
- 59fd216: Accept arrays of factories and bind instance create options to the original factory selection.
- 59fd216: Expose the MathJS sine factory, its dependency bundle, and the class and typed factories it uses.
- fa2f915: Expose native MathJS matrix, comparison, concatenation, and atan2 factory bundles.
- fa2f915: Expose MathJS square-root and negation factory bundles with their declared dependencies.
- fa2f915: Apply instance settings when resolving and invoking functions from selected compatibility factory bundles.
- fa2f915: Expose more MathJS collection, formatting, and random factories and their dependency bundles.
- 59fd216: Expose the MathJS trigonometric and hyperbolic factories and their minimal dependency bundles.

## 0.89.3

### Patch Changes

- e405551: Load custom mathjs factory bundles passed to compat create, including nested bundles with dependencies.
- 0f1826b: Keep each compat instance's custom typed functions, type registrations, and conversions isolated.
- 158b82c: Match MathJS setUnion ordering in compat, including duplicate elements and matrix inputs.

## 0.89.2

### Patch Changes

- 2e88a10: Match mathjs 15.2 instance constants, including configured BigNumber precision, alternate names, and physical values. Use the same resolved constants for direct calls, interpreted expressions, and compiled expressions. Emit instance configuration changes with previous, current, and changed values.
- 2e88a10: Give compat mathjs-style random, randomInt, and pickRandom streams scoped to an instance. Direct, interpreted, and compiled calls share the same streams and honor changes to randomSeed.

## 0.89.1

### Patch Changes

- 7704089: Publish the source changes that were missing from the previous npm versions so that the runtime dependencies expose the contracts used by the functions bundle. Compute determinants, means, and covariances without premature overflow. Apply instance precision to BigNumber arithmetic, simplify exact radical identities before numerical approximation, and clarify errors for untracked autodiff operands.
- Updated dependencies [7704089]
  - @danielsimonjr/mathts-core@0.30.1
  - @danielsimonjr/mathts-matrix@0.13.1
  - @danielsimonjr/mathts-expression@0.14.3
  - @danielsimonjr/mathts-gpu@0.4.1

## 0.89.0

### Minor Changes

- 884eada: BREAKING: The third positional argument of `gammaPDF` is now the rate, in line with `gammaCDF`, `gammaQuantile`, and `gammaDist`. Pass `{ scale: theta }` to preserve previous positional-scale results. All four functions accept explicit `{ rate }` and `{ scale }` options.
- 576726b: `besselI` and `besselK` accept a real order. Before, both functions rounded the order to an integer, so `besselI(0.5, 1)` was `0.5652` (the value is `0.9377`), `besselI(-0.5, 1)` was `0.5652` (the value is `1.2312`) and `besselK(1.49, 3)` was `0.0402` (the value is `0.04783`). A negative real order of `besselI` is `I_nu = I_an + (2/pi) sin(an pi) K_an`, and the K term carries its factor, so the sum is correct next to an integer order. `besselI` of a negative `x` is `(-1)^n I_n(|x|)` for an integer order and `NaN` for a real order. `besselI(2, 800)` is `Infinity` and was `NaN`. `besselI(0.5, 1e-300)` is `7.98e-151` and was `0`. `besselI(0, x)` is about six times faster for `x` from 0 to 20 (3.0 to 3.4 microseconds a call before, 0.5 after). A series that does not converge gives `NaN`, never a partial sum. A call that needs more than 2500000000 steps throws `RangeError`, and the array form counts the total steps of its elements. (Refs #1331)
- 67c9b6f: Welch PSD, cross-spectral density, and coherence now use a DFT-periodic window and subtract the mean of each segment by default, matching SciPy. Pass `{ periodic: false, detrend: false }` to select the previous convention.

### Patch Changes

- 90ff360: `solveODE` with `RK23` or `RK45` on a very large BigNumber state stops with `step size underflow` and no longer runs to the attempt cap. A BigNumber step now stops below `10^(1 - precision)` times the larger of `|t|` and the span. When the last rejected error estimate is finite, the message names it and `tol`, says that the error test is absolute (as in mathjs) and advises `options.tol` or a rescaled state. `tol: Infinity` accepts the first trial. A BigNumber step is accepted by an exact decimal compare. The number path is unchanged: the same number of calls of `f`, and the same message base. `solveODESystem`, `solveDDE` and `solveDAE` start with a finite state of 1.4e154 or more: the norm of the first step no longer overflows. The step-budget error of a BigNumber run names the time of the last accepted step. (Refs #1156)
- 576726b: `besselJ` and `besselY` give the value for a very small `x`. Before, `besselJ(-0.5, 1e-300)` and `besselY(-0.3, 1e-300)` were `NaN`, `besselJ(0.5, 5e-324)` was `0`, `besselJ(2, 1e-16)` was `0` (the value is `1.25e-33`) and `besselY(2, 5e-324)` was `NaN`. Now a power series (J) and Temme's series (Y) run for `x < 1e-5`, every division is by `x`, and a result outside the double range is a signed `Infinity`. `sin(pi x)` of a number next to a non-zero integer loses digits when `pi * x` is rounded first. A new helper reduces `x` exactly and then multiplies. `gamma(-1.0000001)` is `9999999.5713771343` and was `9999999.569845542`. `lgamma(-1.0000001)`, `gamma` of a Complex number, `zeta` of a negative argument and `besselJ(-1.0000001, 1e-10)` have the same correction. The integer-order `besselJ` of `|x| < 1e-15` is `(x/2)^n / n!` in JavaScript and in the AssemblyScript kernel `besselJn`, with the same bits: `J_2(2e-16)` was `0` in the kernel and is `5e-33`. The kernel also returns `0` at once when the zero bound of J holds. `besselJ0`, `besselJ1`, `besselY0` and `besselY1` use the ascending series to `x = 4`, CF1 and Steed's CF2 below `x = 17`, and the Hankel expansion with the exact phase from `x = 17`. Before, the series ran to `x = 13` and cancelled (`besselY1(12.999999)` was 88820 units of 2^-52 off), and the rounded phase gave `besselJ1(1e17)` the wrong sign. The integer-order `besselJ` and `besselY` start from these values. The AssemblyScript kernels use the same rule, the amplitude `sqrt(2 / pi / x)` (it was `0` above `x = 5.7e307`) and the `-Infinity` bound of `Y_n` (`Y_2(5e-324)` was `NaN`). `digamma` of a negative argument reduces `pi x` exactly (it was 1.65e10 units off next to a negative integer). (Refs #1334)
- 04df2cc: Control RK23 and RK45 error with the estimated local change in the state. For numeric states, `tol` now sets relative tolerance and `tol * 0.001` sets absolute tolerance. Step counts can differ from mathjs's absolute derivative controller. Unit-valued problems retain the previous tolerance convention.
- 576726b: `besselK` is correct above `x = 700`, and so is the negative-order `besselI` that uses it. Before, the start values of the recurrence included `exp(-x)`, which is `0` from `x = 745.2`: `besselK(2000.5, 1200)` was `0` (the value is `6.975e100`) and `besselI(-2000.5, 1200)` was `3.07e-105` (the value is `4.441e100`). Now the recurrence carries `e^x K` and applies `exp(-x)` at the end. A gate before the loop gives `0` or `Infinity` at once for a value far outside the double range, so `besselK(1e15, 701)` is `Infinity` and `besselK(0, 1e308)` is `0` (it was `NaN`). An order above 2500000000 that passes the gate throws `RangeError`, and the array form counts the steps of its elements. (Refs #1362)
- 576726b: `legendreP`, `chebyshevT`, `hermiteH` and `laguerreL` give a signed `Infinity` when the value leaves the double range. Before, the recurrence gave `Infinity - Infinity` and the result was `NaN`: `hermiteH(1000, 1.5)` was `NaN` and is `-Infinity`. `hermiteH` and `laguerreL` now run the recurrence with a power-of-2 scale, so the sign of the result is exact, and a value inside the range is unchanged. `hermiteH` has an order limit of 2500000000, as `laguerreL` has: an order above it throws `RangeError`. Before, a `NaN` ended the loop after a few hundred steps, and the call returned `NaN`. One call at the limit takes about 20 seconds. The AssemblyScript functions `legendreP`, `chebyshevT`, `hermiteH` and `laguerreL` follow the same rule, and the AssemblyScript `lgamma` reduces `sin(pi x)` exactly. The WASM binary and its SHA-384 manifest change. (Refs #1332)
- 576726b: `zeta` of a negative argument uses the symmetric form of the functional equation, `zeta(s) = pi^(s - 3/2) sin(pi s / 2) Gamma((1 - s) / 2) Gamma(1 - s / 2) zeta(1 - s)`, for a number, a BigNumber and a Complex number. One code path serves all three types, and the intermediate values do not overflow. Before, `zeta(-170.5)` was `Infinity` (the value is `1.7363e171`), `zeta(-200.5)` was `-Infinity`, `zeta(complex(-200.5, 1))` was `NaN`, and `zeta(-1000)` was a noise value (the value is `0`). Now a negative even integer gives `0`, and a value outside the double range gives a signed `Infinity`. `zeta(bignumber('-630000000000000.5'))` is correct. Before, the BigNumber result was wrong from `|s|` near 6.25e14. (Refs #1327)
- 0c124c0: Compute signed Hermite overflows from a phase bound when possible. Above degree 10,000,000, an input whose sign cannot be certified raises promptly. Certified overflows are still supported up to the existing degree limits.
- 291a3e9: One balanced scan reads the parameter list of a callback and of a worker closure. A default value with a parenthesis no longer cuts the list. A rest parameter after a default value keeps the full callback arguments in `map`, `forEach`, `filter`, and the `map` and `forEach` methods of a Matrix and of a SparseMatrix. A default value counts as a parameter, so `matrix([5, 6]).map((a, s = 1 / 2) => a * s)` gives `[0, 6]`, as in mathjs. `validateClosureSource` reads a rest parameter, the own name of a function expression and a comment in the list. It rejects `this`, `super`, `import`, `export`, `from`, `as`, the spread of an outer name, a method, a generator and a destructured parameter. It reads each name with the Unicode rule. (Refs #1151)
- 291a3e9: `fraction`, `number` and `transpose` are typed-functions, as in mathjs. As a callback of `map`, `forEach`, `filter`, the `map` and `forEach` methods of a Matrix and of a SparseMatrix, `mapSlices`, `chain` and `evaluate`, each one now reads the value alone. Before, a callback adapter passed the index as the second argument: `map([1, 4], fraction)` threw `Fraction denominator cannot be zero`, and `map(['1', '4'], number)` threw about a unit. The compat `fraction` is the same function, with the no-argument and `undefined` calls that give 0. A call with a type that mathjs rejects now throws a TypeError: `number(undefined)`, `number({})`, `number(complex)`, `fraction(complex)`, `fraction(1, 2, 3)`, `fraction(1, null)` and a `Date` or a typed array as the argument. `transpose()` throws a TypeError too. (Refs #1160)
- 90ff360: The typed `floor`, `ceil`, `fix` and `mod` follow mathjs 15.2.0. `floor(2.9999999999999996)` is 3 and was 2. `ceil`, `fix` and the BigNumber rows snap to the nearest integer in the same way, with the live `relTol` and `absTol`. `mod(0.3, 0.1)` is `-5.551115123125783e-17` and `mod(0, -4)` is `0`. Two integers still give the exact remainder, so `mod(1700006399999, 86400000)` is 86399999 (mathjs gives -1). A finite pair whose quotient is 2^53 or more also gives the exact remainder: `mod(1e22, 0.7)` is 0.15692866092049007 (mathjs gives 0). The BigNumber row of `mod` snaps in the same way, so `mod(bignumber('2.9999999999999999999999'), 1)` is -1e-22, and two integers keep the exact remainder. The factory `mod` uses the same function. `compat` and `evaluate` take the new results. `add`, `subtract` and `multiply` of an Array and a matrix, and `add` and `subtract` of a dense and a sparse matrix, return a `DenseMatrix` (a `SparseMatrix` for a 2-D Array times a sparse matrix, and a sparse column of size [n, 1] for a sparse matrix times a vector), and returned an Array. The generated `PublicAdd` type follows. `csd` and `coherence` take a segment of exactly `nperseg` points and no longer pad it to a power of two. `csd` is a one-sided density: the bins between DC and Nyquist double, so `csd(x, x)` equals `welchPSD(x)`. `sampleN` rejects a count that is not a non-negative integer, and a count above 100000000, with a `RangeError` before it allocates. A Bluestein transform (a length that is not a power of two) keeps its chirp and filter spectrum for the next call of the same length: about 1.6 times faster for a repeated length. The step-limit error of `solveODE` names stiffness only when the stability limit of the method, and not the tolerance, ends the run. A BigNumber derivative that is not finite stops the run at once. (Refs #968)
- 576726b: `besselJ` and `besselY` of a real order give correct values and return in bounded time for a large order and for a large argument. Before, the continued fraction ran about `x` steps and the recurrence ran `n` steps, with no bound: `besselJ(4e9 + 0.5, 1000)` took 16 seconds, and `besselJ(400.3, 5000)` was wrong by 3e-10 of the amplitude. Now, from `x = 25`, the function starts from the Hankel expansion at `mu` and `mu + 1`, with the phase reduced exactly, and runs the stable recurrences. The test file states the error bound of each checked value. A value that lies in the window where `Y_n` is outside the double range and `J_n` is not is now correct: `besselJ(322.5, 25)` is `8.9e-318` and was `NaN`. A negative order uses a scale factor, so `besselY(-151.5001, 1)` is `-2.838e305` where `Y_n` alone is outside the range. The zero bound of `J` and the overflow bound of `Y` run before the order limit, for an integer and for a real order: `besselJ(4e9 + 0.5, 1000)` is `0` and `besselY(4e9, 1e8)` is `-Infinity`, both at once. An order above 2500000000 that passes both bounds throws `RangeError`. The array form of `besselJ` and `besselY` counts the steps of a non-integer order too, so `besselJ(1e9 + 0.5, array)` throws `RangeError` when the total is above 2500000000 steps. `besselJ(-1.5, 0)` is `-Infinity` and was `Infinity`: the sign is the sign of `Gamma(1 - n)`. `besselJ` of a real order is accurate for `1e-5 <= x < 2`: it lost up to 5 digits (`besselJ(37.53325087047588, 7.237015760887747e-5)` was 1.1e-11 off). `besselI(0, 1e306)` is `Infinity` and threw `RangeError`. `besselJ` and `besselY` of `x = Infinity` are `0`, the limit, and were `NaN`. The `besselI` series adds back the rounding of its steps. (Refs #1331)
- Updated dependencies [291a3e9]
  - @danielsimonjr/mathts-parallel@0.12.2

## 0.88.0

### Minor Changes

- 9cda207: `solve`, `solveExact`, `integrate`, `expand` and `coefficientTexts` close ten follow-up items of #965. A power of a base that cancels to a constant (`(x-x)^1000000000`) is an identity, and `solve('sin(x)-sin(x)')` reports an identity. The numeric scan finds the root of `(x-1)^2` between two grid points, exact to rounding (`(x^2-1)^2` gives -1 and 1). A coefficient reads as a small fraction only when it is the double of that fraction (`x-0.30000000000000004` keeps its root). The radicals of a quadratic have one text and one order (`x^2-0.5` gives `-sqrt(2)/2` and `sqrt(2)/2`). The root of `1e-20*x-1e-30` is `1e-10`. `solveExact('sin(x)=sqrt(2)/3')` gives `asin(sqrt(2)/3)`, and `solveExact` solves a polynomial of degree 1 or 2. `integrate('5*x^3')` is `5*x^4/4`. `expand('(x+y+z+w)^900')` is refused when a partial product has more than 10000 terms (the limit of #1176). `coefficientTexts` writes each fraction on its own, so `[0.5, 0.25, 2]` gives `['1/2', '1/4', '2']`. This changes output text: `expand('0.5*x*(x+1)')` is now `1/2*x^2 + 1/2*x` (it was `0.5*x^2 + 0.5*x`), which reverses the decimal rule of #887. A coefficient below `1e-14` stays a decimal and is no longer written as `0/1`. (Refs #966)
- 33acba1: The public types of `median`, `mode` and `mad` give the number type for a `readonly number[]` argument, and `median('x')`, `median({})`, `median()`, `mad()`, `mode()` and `mode(array, 0)` are compile errors. A spread of a plain array (`median(...xs)`) no longer compiles: pass the array. `matrix()` and `sparse()` return the new public type `BridgeMatrix`, and `bignumber()` of a scalar returns `BigNumber`. So `median`, `mode`, `mad`, `mean`, `variance` and `std` of `matrix(x)` compile. The statistics functions take the new public type `MatrixValue`. Compat `matrix()` and `sparse()` return the same `BridgeMatrix`. At run time, `mode` of a Matrix inside the argument list throws a `TypeError` in place of the false NaN message. `parallelFFT`, `parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `dct`, `dst`, `hilbertTransform`, `polymul`, `newtonInterp`, `polyFit` and the other callers of the shared sample copy throw a `TypeError` for an array entry with no numeric reading (a nested array such as the column `[[1], [3], [5]]`, an object, `undefined`, a string that is no number). A BigNumber, a Fraction and a numeric string entry still convert, and `''`, `' '`, `true` and `null` read as 0, 0, 1 and 0. `parallelStatStd` and `parallelStatVariance` throw the `TypeError` of `std` for an unknown normalization string. (Refs #964, Refs #1359)
- 44d5dd0: `owensT` of a large `a` returns the value, and `quad` and `nintegrate` take a new option `maxPanels`. Before, on main:
  
  - `owensT(1, 1e4)` and `owensT(1e-3, 1e12)` returned 0, because the quadrature over `[0, a]` missed the peak of the integrand near 0. They now return 0.07932762696572854 and 0.24980052889304447, as SciPy does. For `a > 1`, `owensT` uses the identity of Owen (1956) that maps `T(h, a)` to `T(a h, 1 / a)`. It uses the symmetry of `T` for a negative `a` or `h`. `skewNormalCDF` of a large shape is correct as a result.
  - `nintegrate(x => Math.sin(1 / x), 0, 1)` took 19 to 37 s, because every panel near 0 was bisected to the depth limit. `maxPanels` (default 100000) is the number of panels after which no panel is bisected. This integral now throws `RangeError: the integral did not converge` after 0.25 s, and `quad` returns `converged: false`. Pass a larger `maxPanels` to integrate a hard convergent integral. Every other integral in the test suite needs fewer than 2000 panels, so its result does not change. `maxPanels` must be a positive integer or `Infinity`. Another value, for example 0, a negative value, 2.5 or NaN, throws a RangeError. Before, 0 or a negative value stopped after the first panel with no error. (Refs #1100)
- 9cda207: `symbolicIntegral` now integrates a power of `sin(a*x+b)` or `cos(a*x+b)` (integer power 2 to 64) and a polynomial times `log(a*x+b)`. `laplace` now applies linearity, the shift theorem and `t^n*exp(a*t)`. `inverseLaplace` now reads a rational function of `s` by partial fractions (real poles with multiplicity, one complex pair). An input that none of these rules covers keeps the `integral(...)` marker in `symbolicIntegral` (the marker parses as a call). `laplace` and `inverseLaplace` now throw the new exported `NoClosedFormError` for such an input; they returned the text `L{...}(s)` or `L^-1{...}(t)`, which does not parse. A rational function with two real poles too close to separate (`1/(s^2-1e-14)`) throws `NoClosedFormError` in `inverseLaplace`, and `inverseLaplaceTransform` throws an `Error` for it; both gave `t`. The sampled table of `inverseLaplaceTransform` compares values with a relative tolerance, so `1/(s-1e-9)` is no longer read as `1/s`. A `log` with a base (`x*log(x, 2)`) keeps the marker; it gave the antiderivative of the natural logarithm. (Refs #1024)
- c12439a: The polynomial reader of the CAS has a limit on the number of terms: 10000 (`MAX_POLYNOMIAL_TERMS`, next to the degree limit 1000). A product that holds more than 10000 distinct terms makes `expand` throw a `PolynomialSizeError` (a `RangeError`) with the message `expand: the polynomial has more than 10000 terms, the most that the CAS builds`. Before the change, `expand('(a+b+c+d+x)^21')` (12650 terms) took seconds, `(a+b+c+d+x)^40` took 28 seconds, and `(a+b+c+d+x)^60` did not end in 100 seconds. Now each of them ends at once with the error. The count is of distinct terms, not of products, so a dense univariate product still works. `expand('(a+b+c+d+x)^19')` (8855 terms) and `expand('(x+1)^1000')` (1001 terms) give the same result as before. An input above the degree limit still gives the degree error. `groebnerBasis` and the elimination of a variable refuse such an input in the same way. `factor`, `together`, `apart` and the integrators read a univariate polynomial of at most 1001 terms, or catch the error and use their other path. The package exports `PolynomialSizeError` next to `PolynomialDegreeError`, so a caller can test `instanceof`. (Refs #1176)

### Patch Changes

- 8879eea: `subset`, `reshape` and `resize` of a dense matrix read every axis, not the first two. A scalar index drops its axis, so `subset(d3, index(1, 0, 1))` is a number and `subset(d3, index(0, [0, 1], 1))` has size [2]. A wrong number of indices throws the mathjs `DimensionError`, and an index out of range throws an `IndexError`. `subset` assignment writes every selected entry of a 3-D matrix, broadcasts a replacement to the shape of the selection, and gives a replacement with fewer axes the missing axes of length 1 (the mathjs `_set` rule). One selected entry takes one value only (`Scalar expected`). An assignment after the end of an axis grows the matrix and fills the new entries with the default value, a negative or non-integer index throws, and `get` checks each index. The `reshape` method changes its matrix and returns it, as in mathjs; the sparse matrix has a `reshape` method. `diag` of a 1-D matrix puts numbers on the diagonal. `reshape` of a matrix with three or more axes keeps the values, and a size with the wrong number of entries throws `Dimension mismatch`. A `subset` assignment does not change the replacement Array of the caller. (Refs #1155)
- 9cda207: `limit` takes L'Hopital's rule (symbolic derivatives, at most 8 steps) for a quotient that is 0/0 or c/0 at the point. `limit('(1-cos(x))/x^2', 'x', 0)` is now 0.5, and `limit('1/x', 'x', 0, 'right')` is now `Infinity` (it was 1e10). A small constant is not read as zero (`limit('1e-15/x', 'x', 0, 'right')` is `Infinity`), and the sampling path returns `-Infinity` for `limit('log(x)', 'x', 0, 'right')` (it was -23.03) and `Infinity` for `limit('exp(1/x)', 'x', 0, 'right')` (it was NaN). The sampling path returns 0 for samples that fall in size by 2 times or more at each step (`limit('x*log(x)', 'x', 0, 'right')` is 0, it was -2.3e-9), and `NaN` for samples that change sign and do not fall in size (`limit('sin(1/x)', 'x', 0, 'right')` has no limit). (Refs #1022)
- a7c47d4: `factorial` and `gamma` of a large integer BigNumber use the Stirling series above n = 10000 (and above 100 times the precision). `factorial(bignumber(1e9))` returns in milliseconds and was never returning. A result below that limit stays the exact product. An n above the range of a number gives `Infinity`. At a precision below the digits of n, `factorial` and `gamma` use the exact n + 1 and n - 1. (Refs #1115)
- 44d5dd0: `lusolve` judges each pivot against the terms that cancelled in it, not against one scale of the whole matrix. `lusolve([[1e10, 0], [0, 1e-7]], [1, 1])` threw `Linear system cannot be solved since matrix is singular`: the pivot 1e-7 is below 1e-15 times the largest entry 1e10. It now returns `[[1e-10], [1e7]]`, as mathjs 15.2.0 does, for an Array, a DenseMatrix, a SparseMatrix (with `lup` and with `slu`) and a factorization from `lup`. The scale of the pivot `U[i][i]` comes from `L` and `U`: the largest product `|L[i][k] * U[k][i]|` for `k < i`. The floor is `8 * n * eps` times that scale, and `linsolve` uses the same rule. So `[[1, 2], [2, 4]]` and `[[1, 2], [2, 4 + 1e-15]]` still throw, and the test does not change when a row or a column is multiplied by a constant: `lusolve([[1e12, 1e-5], [1e12, 2e-5]], [[1], [2]])` threw and now returns `[[0], [1e5]]`. (Refs #1287)
- b866b34: `gcd` and `lcm` take Fractions and more than two values. `gcd(fraction(1, 2), fraction(1, 3))` is `1/6` and `lcm(fraction(1, 2), fraction(1, 3))` is `1`, as in mathjs, and a Fraction with a number reads the number as a Fraction (`gcd(fraction(1, 2), 3)` is `1/2`). `gcd(4, 6, 8)` is `2` and `lcm(4, 6, 8)` is `24`, for numbers, bigints, BigNumbers and Fractions. The type `GcdFunction` has overloads that return a Fraction for two Fractions and take any count of arguments of the same type. Before, `gcd` of two Fractions returned a BigNumber and both functions took exactly two arguments. (Refs #1096)
- a5bc409: The operators `>`, `<`, `>=`, `<=`, `==` and `!=` and the functions `larger`, `smaller`, `largerEq`, `smallerEq`, `equal` and `unequal` take an Array or a matrix. `evaluate('[1,2,3] > 1')` gives `[false, true, true]` and `evaluate('[1,2,3][[1,2,3] > 1]')` gives `[2, 3]`. This also holds in the compat instance. (Refs #1307)
- 9cda207: `taylor`, `series` and `seriesCoefficient` get the coefficients from three tiers. Power-series arithmetic on the syntax tree comes first: it handles + - * / ^ and the elementary functions, exact to rounding at any order. Symbolic derivatives (f^(k)(x0)/k!) come next, for other functions. A Cauchy contour sum comes last; it doubles its points until two sums agree. `taylor('1/(1-x)', 'x', 0, 30)` now has every coefficient 1, and `taylor('x/(1-x-x^2)', 'x', 0, 10)` gives the Fibonacci numbers. The text of a coefficient keeps its exponent (`1.605904384e-10*x^13`, it was `1.605904384e-1*x^13`). A small true coefficient (`7.647163732e-13*x^15` of `exp(x)`) is no longer dropped; only a coefficient that is rounding noise is left out. A Fraction center works, and a Complex center off the real line throws a `TypeError`. (Refs #1023)
- ba1fdea: `linsolve` accepts a DenseMatrix, a SparseMatrix or a MathJS matrix as `A`. It reads `b` with the new matrix-package reader `readRightHandSide`: a vector, a typed array of numbers, an `n x 1` column, a DenseMatrix or SparseMatrix of one column or one row, or a MathJS matrix. Entries of `A` and `b` follow the implicit rule of mathjs `lusolve`: a numeric string, a boolean, null and undefined convert (null and undefined are 0), and a non-numeric string throws `Cannot convert`. A BigNumber, Fraction or Complex entry is solved by the typed `lusolve`, and the result keeps that type, as in mathjs. An array inside a vector throws a TypeError. Core exports `convertToNumber` (number, string, boolean, bigint) and `isNumberTypedArray` from `/internal`; the matrix package exports `implicitNumber` and `isTypedScalar`. (Refs #977)
- 2df36db: The general `eigs` of a defective BigNumber or Complex matrix with small entries gives no false eigenvector. The null space solver tests each coupling against the entries of its row, with a tolerance of one twentieth of `precision`, not against an absolute tolerance. This is a trade for a dense matrix with a double eigenvalue. Of 20 seeded dense BigNumber matrices `P D P^-1` per scale (order 3 to 5, a double eigenvalue), 20, 20 and 19 keep every eigenvector at the scales 1, 2^40 and 2^-60. A count can change between runs, because inverse iteration starts from a random vector. A lost eigenvector is a missing one, not a false one. (Refs #1242)
- 33acba1: `std`, `corr`, `skewness`, `kurtosis`, `describe`, the factory 2-norm, `parallelStatStd`, `parallelStatNorm`, the pool `variance` and the statistics that use the same sum now compute the result again with an exact power-of-2 scale when a sum of squares is below 2^-800 or overflows. Before, subnormal squares lost digits: `std([1e-160, 3e-160])` had a relative error of 5.6e-6, and `std` of data of order 1e-170 was 0. `skewness` and `kurtosis` do the same when the third or fourth powers leave the range. `linregress`, `linearRegression`, `partialCorrelation`, the effect sizes, the t tests, `fTest`, `bartlettTest`, `jarqueBera`, `dagostinoTest`, `acf`, `pacf`, `ljungBox`, `distance2D`, `distance3D`, `distanceND` and `gaussianKDE` use the same core helpers. `linregress` and `linearRegression` keep a finite slope when the two scales differ by more than the double range. Core adds `SQUARES_SAFE_MIN`, `ROOT_SAFE_MIN`, `squareSumsKeepDigits`, `powerOfTwoBelow`, `powerOfTwoScaleOf`, `scaleForVariance`, `divideByScale` and `stdFromSquaredDeviations`. Compat `std` and `variance` now use the functions implementations: they honour the dimension argument, the variadic form and BigNumber data, as mathjs does. (Refs #1280)
- c12439a: `expand` keeps the parentheses of a product and of a square when its input is not a polynomial. The fallback of `expand` (an input with a function call such as `sin(x)`, or a purely numeric product) wrote the sum of a distributed product without parentheses. So a factor, a divisor, an exponent or a minus sign bound to one term only. Before the change, `expand('2*(1+2)*(3+4)')` had the value 24 (the correct value is 42), `expand('(1+2)*(3+4)/2')` had 17 (10.5) and `expand('(1+2)*(3+4)^3')` had 141 (1029). The rewrite of `(s)^2` to `(s)*(s)` also changed the value of `1/(1+2)^2`, `(1+2)^2^2` and `(a+b)^23`. The fallback now puts the sum in parentheses when the product has a neighbour. It leaves a product unchanged when the product follows `/` or `^`, or precedes `^`. A plain product of two sums gives the same text as before: `expand('(a+b)*(c+d)')` is `a*c + a*d + b*c + b*d`. The split of a factor into its terms also cut a sign after an operator and the sign of an exponent literal. `expand('(1-2)*(3-4)*(5+6)')` gave the text `1**5 ...` and `expand('(2e-3+1)*(3+4)')` gave `2e*3 ...`, and neither text parses. A minus is now a cut only after an operand and outside a number literal. (Refs #1167)
- a5bc409: `add`, `subtract` and `mod` of two Arrays broadcast like mathjs and NumPy. The axes are right-aligned and an axis of size 1 stretches, so `add([9, 8], zeros([2, 1]))` is `[[9, 8], [9, 8]]` and `add([[1, 2], [3, 4]], [10, 20])` is `[[11, 22], [13, 24]]`. Before, the walk paired the first axes. Shapes that cannot broadcast throw `RangeError`, for example `add([[1, 2, 3]], [1, 2])`. `add(matrix([1, 2]), [[1, 2], [3, 4]])` follows from the same rule. The compat `add` and `subtract` send operands of different sizes to the same function: `create(all).add(matrix([1, 2]), matrix([[1, 2], [3, 4]]))` threw `Matrix dimensions must match` and is now `[[2, 4], [4, 6]]`. (Refs #1302)
- c12439a: `symbolicEqual` is `true` for two expressions that are the same polynomial with exact rational coefficients (Fixes #1178; this also fixes item 3 of #1014). `symbolicEqual` asked only whether `simplify` reduces the difference of the two sides to 0. An irrational constant beside a fraction folds to a decimal, so an exact zero left a rounding residue, and `simplify` does not expand `(x+1)^2`. The new module `cas/exact-identity.ts` reads both sides as polynomials over their variables and their function calls (`sqrt(2)` is one unknown) and compares them with integer arithmetic. These pairs were `false` and are now `true`: `1/3+sqrt(2)-sqrt(2)` and `1/3`; `sqrt(2)/3+1/3` and `(sqrt(2)+1)/3`; `(x+1/3)*sqrt(3)` and `sqrt(3)*x+sqrt(3)/3`; `(x+1)^2` and `x^2+2*x+1`. mathjs 15.2.0 gives `false` for these pairs, so this is a deliberate difference from mathjs. The exact test runs only when the caller gives no options, so a context such as `{ multiply: { commutative: false } }` keeps its meaning. A `false` still means "not decided": a matrix, a string, a call of `random`, a constant without a finite value (`log(0)`), a degree above 1000, a term count above 10000, and a product of more than 100000 term pairs are all left to `simplify`. A fuzz run of 1500 pairs found no case where the exact test said `true` and a numeric evaluation at three points disagreed. A coefficient of more than 4096 bits is also left to `simplify`: without that limit, `symbolicEqual('(x+1e300)^300', '(x+1e300)^300')` took 12 seconds. (Refs #1178)
- 789a41a: A result matrix takes its size from the operands, not from its nested data. `multiply`, `add` and `subtract` of 0 x 0 matrices keep the size `[0, 0]`, `sparse(zeros(0, 3))` keeps the size 0 x 3, and compat `matrix(x, format)` keeps the size of a native matrix with a zero dimension. `freqz` throws a `RangeError` for a coefficient matrix that is not a vector. Compat `divide` of two native `DenseMatrix` operands gives a native `DenseMatrix`. (Refs #1337)
- f4df499: `peakWidths` now returns the widths of `scipy.signal.peak_widths`. The old code walked outward from the peak until it found a sample at or below the reference height. It did not stop at the base of the peak. It looked at the neighbour of each sample, not at the sample. And it did not check `relHeight`. Results before the change:
  
  - `peakWidths([1, 3, 1], [0])` returned `[2]`. A peak at the edge has no prominence, so the width is now `[0]`.
  - `peakWidths([5, 1, 3, 1, 5], [2], 1.5)` returned `[4]`. The walk passed the base of the peak. The width is now `[2]`.
  - `peakWidths([0, 1, 2, 3, 4], [2])` returned `[2]` for an index that is not a peak. The width is now `[0]`.
  - `peakWidths([1, 3, 1], [1], -1)` returned `[-2]`. A negative `relHeight` now throws `RangeError`, as SciPy does. A `relHeight` of NaN returned `[NaN]` and now throws `RangeError` too (SciPy returns `[0]` for NaN; a NaN has no meaning as a fraction of a height, so this function rejects it).
  
  The widths now match SciPy 1.16.3 to the last bit on every probe, including plateaus, nested peaks and a `relHeight` of 1e308. The `prominence` option of `findPeaks` gives the same peaks, except for a signal that holds NaN: a NaN sample now ends the prominence walk, as in SciPy, so `findPeaks([0, NaN, 3, 4, 0], { prominence: 3 })` returns `[]` (it returned `[3]`).
  
  An `Int32Array` of peaks returned an `Int32Array` of truncated widths: `peakWidths([0, 1, 5, 1, 0], new Int32Array([2]))` returned `[1]`. It now returns the array `[1.25]`, as for an array of peaks.
  
  (Refs #1153)
- 2df36db: The general `eigs` converges for a real matrix with a complex conjugate pair when the entries are BigNumber or Complex. The QR iteration takes a double-shift step when the trailing 2x2 block has a complex pair, and a Complex matrix takes the Wilkinson shift. The 2x2 block solver scales a block with entries above 2^500 or below 2^-500, so the discriminant does not overflow. (Refs #1238)
- 8879eea: `matrix([[1], [2, 3]])` and every other ragged nested array throw the RangeError "Dimension mismatch", as mathjs does. Before, the matrix kept rows of different lengths. Compat `matrix`, the expression `matrix(...)` and `fft` of such a matrix give the same error. (Refs #1092, #1273)
- 3b2ffe6: `round` with a decimal count works for a Fraction and a Complex, and core `round(x, n)` uses `n`. `round(fraction, n)` returns a Fraction: it returned a BigNumber, and `factory_round(fraction(201, 200), 2)` returned 1. `round(complex, n)` rounds each part: it threw `Too many arguments`. Core `round(x, n)` ignored `n`. `Fraction.round` takes a decimal count, and a count that is not an integer throws `TypeError`. `round(5n, 2)` is now the Fraction 5, as `round(5n)` already was, and was a BigNumber 5: the cause is the order in which the typed dispatcher converts a bigint, and that order is a separate decision. `round` of an Array or a matrix with a decimal count works: `round([1.005, 2.675], 2)` is `[1.01, 2.68]` and `round(2.675, [1, 2])` is `[2.7, 2.68]`. Both threw `TypeError`. Each element takes the scalar row, so `round([-0], 2)` is `[0]`, as in mathjs. (Refs #996)
- f4df499: Matrix input and degenerate input of the signal functions now give a correct value or a named error. Results before the change:
  
  - `dct`, `idct`, `dst`, `idst`, `hilbertTransform` and `spectrogram` of a Matrix returned `[null]`, `[]` or a `RangeError` about `NaN`. Each now throws `TypeError: <name>: signal must be an array or a typed array`. Arrays and typed arrays give the same values as before.
  - `fftshift` and `ifftshift` of a Matrix threw `arr.slice is not a function`. They now unwrap a Matrix or a typed array and return a plain array. A nested array or a 2-D Matrix is now shifted along every axis, as NumPy does: `fftshift([[1, 2], [3, 4]])` returned `[[3, 4], [1, 2]]` (the first axis only) and now returns `[[4, 3], [2, 1]]`.
  - `fftshift` and `ifftshift` of an array of odd length were swapped with respect to NumPy: `fftshift([0, 1, 2, 3, 4])` returned `[2, 3, 4, 0, 1]`. It now returns `[3, 4, 0, 1, 2]`, and `ifftshift` returns `[2, 3, 4, 0, 1]`, as `numpy.fft.fftshift` and `numpy.fft.ifftshift` do. Results for an even length are unchanged.
  - `welchPSD([5, 6])` and `welchPSD([5, 6, 7, 8], { frameLength: 2 })` returned `NaN`, because a Hann window of length 2 is `[0, 0]`. They now throw `RangeError: welchPSD: a 'hann' window of length 2 is all zeros`. Other windows of length 2 give finite values. `periodogram([5, 6])`, `csd([5, 6], [5, 6])` and `coherence([5, 6], [5, 6])` returned `NaN` for the same window and now throw `RangeError` too. `spectrogram([5, 6])` and `spectrogram([5, 6, 7, 8], { windowSize: 2 })` returned a magnitude of all zeros for the same window and now throw `RangeError` too.
  - `multiTaperPSD([1, 2, 3, 4, 5])` returned five bins on the wrong frequency grid, with the last two bins 0. Each taper is now zero-padded to `nfft`, and the result equals the NumPy periodogram of the tapered signal. For `n = 5000` and the default `nfft` of 8192, every bin above 2500 was 0. An `nfft` or a `K` that is not a positive integer returned `NaN` bins or a PSD of zeros (`multiTaperPSD([1, 2, 3, 4, 5], { nfft: 2.5 })`) and now throws `RangeError`.
  - `medfilt` and `findPeaks` of a Matrix returned `[null]` and `[]`. Each now throws a `TypeError` that names the function.
  - `medfilt` now pads the signal with zeros at both ends, as `scipy.signal.medfilt` does. This changes the values at the edges: `medfilt([0, 1, 5, 1, 0])` returned `[1, 1, 1, 1, 1]` and now returns `[0, 1, 1, 1, 0]`. A window longer than the signal is padded with zeros too: `medfilt([1, 2, 3], 1e9)` returned `[2, 2, 2]` and now returns `[0, 0, 0]`. A window size that is not a positive integer now throws `RangeError`.
  - `fftshift` and `ifftshift` of a ragged nested array returned a ragged result (`fftshift([[1, 2], [3]])` returned `[[3], [2, 1]]`). They now throw a `DimensionError` (a `RangeError`), as `rfft` does.
  - `spectrogram([])` returned 129 frequencies. It now returns no frames, no times and no frequencies, as `welchPSD([])` does.
  - `welchPSD` and `bartlettPSD` with an odd `frameLength` returned the last bin at half of its value. For an odd frame the last bin is below the Nyquist frequency, so it is doubled like the bins before it. `welchPSD([1, 5, 2, 8, 3, 9, 4, 7, 6, 10], { frameLength: 5, window: 'rect' })` returned a last bin of 11.9 and now returns 23.8. Results for an even frame are unchanged. The `welch_psd_f64` and `bartlett_psd_f64` kernels of the WASM package now return an empty array for a frame length that is not a power of two, because they zero-pad each frame to the next power of two and put the bins of any other frame on the wrong grid. The bridge sends only a power-of-two frame to a kernel, so the public functions are not affected.
  
  `resample([], 2, 1)` returns `[]` and needs no change.
  
  (Refs #1145)
- b866b34: Integer functions follow mathjs for BigNumber and edge arguments. `nthRoot(bignumber(-8), 2)` throws `Root must be odd when a is negative.` (it returned NaN). `permutations` takes one BigNumber, two BigNumbers, and a BigNumber with a number; the result is the exact product, rounded one time to the precision. `permutations(2, 5)` and `permutations(-1, 2)` throw the mathjs messages. `permutations(170)` and `permutations(170, 170)` are `7.257415615307998e+306`, as in mathjs. `permutations` of an Array or a matrix maps over the elements (mathjs throws). `product` splits a range at an exact midpoint, so `permutations(2^53, 2)` returns `8.112963841460667e+31` where the parse path overflowed the stack. `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift` and `rightArithShift` of BigNumbers return a BigNumber NaN when an operand is NaN, as mathjs does; before, they threw `NaN not allowed`. A finite non-integer operand still throws `Integers expected`, and `rightLogShift` still throws for NaN. On the parse path, and on `evaluate` of `bitAnd` and `bitOr`, a finite BigNumber operand threw `Cannot read properties of undefined`, because the helpers read the digit array of decimal.js, which a BigNumber of this library does not have; and `bitNot(bignumber(12))` returned `13`, because the helper wrote a sign field that the BigNumber does not store (`bitXor(-1, bignumber(5))` gave `6`). The helpers now compute on bigint: `bitAnd(bignumber(12), bignumber(10))` is `8`, `bitNot(bignumber(12))` is `-13` and `bitXor(bignumber(-1), bignumber(5))` is `-6`, as in mathjs.
  
  `mod` of two BigNumbers on `evaluate` takes the sign of the divisor, as mathjs and the parse path do: `mod(bignumber(-7), bignumber(3))` is `2` (it was `-1`), and `mod(bignumber(-7.5), bignumber(2))` is `0.5` (it was `-1.5`). Both paths now call one function, `flooredModBigNumber`. A NaN or an infinite operand gives NaN, as mathjs (`mod(bignumber(-1), bignumber(Infinity))` was `Infinity` on both paths, and `mod(bignumber(1), bignumber(Infinity))` was `1`).
  
  The return type of a call with one BigNumber and one number changes: `permutations(bignumber(10), 3)` and `permutations(10, bignumber(3))` return BigNumbers, as mathjs does. Before, they returned numbers.
  
  In `@danielsimonjr/mathts-core`, the typed conversion from number to BigNumber comes before every conversion to Complex, as in mathjs, so a BigNumber and a number reach the BigNumber signature on the parse path: `nthRoot`, `round`, `ceil`, `floor` and `fix` of a BigNumber and a number return a BigNumber (they returned a Complex, or `nthRoot` threw the Complex error). `ceil` and `floor` of two BigNumbers no longer throw the internal `DecimalError`. (Refs #1097)
- 6c87a8b: `quantileSeq` of numbers now finds the one or two order statistics by selection and does not sort. It reads the values into one `Float64Array` in one pass. A flat array is not flattened first. On 1e6 numbers, `quantileSeq(a, 0.9)` took 1685 ms and now takes 37 ms. The time of `median` is 25 ms on the same machine.
  
  A list of probabilities, or an N, reads the values and scans for NaN once. From 24 probabilities the values are sorted once with the native typed-array sort.
  
  For a range of more than 64 values, the selection chooses its pivot at pseudo-random positions and sorts the rest of the range after a pass budget. A sorted array that is rotated, an organ-pipe array and a repeated pattern no longer give a bad split on every pass. With a fixed pivot, `quantileSeq(a, 0.9)` of 1e6 values that were sorted and rotated by a third took 19 s. It now takes 47 ms. `median`, `quickSelect`, `medianSelect`, `minSelect` and `maxSelect` use the same selection: `quickSelect` of 1e5 values that were sorted and rotated by a half took 4.3 s at k = 9e4 and now takes 65 ms.
  
  (Refs #1005)
- 44d5dd0: `slu` and `lusolve(sparse, b, order, threshold)` with the pivot threshold 0 never take a zero diagonal entry as the pivot. The test `|x[col]| >= max * threshold` reads `0 >= 0` for the threshold 0, so a zero diagonal entry won although the column had a nonzero entry. Before, on main, `slu(sparse([[0, 1], [1, 0]]), 0, 0)` returned an `L` with `Infinity` and a `U` with `-Infinity`, and `lusolve` of it threw the singular-matrix error. `lusolve` now returns `[[2], [1]]`. A singular matrix, such as `[[1, 2, 3], [0, 0, 0], [4, 5, 7]]`, throws the singular-matrix error of `slu` at the threshold 0 too. (Refs #1277)
- 789a41a: `expm` of a matrix returns a matrix of the same class and storage. Before, `expm(matrix(A))` returned a native `DenseMatrix` with no `size` method, and `expm(sparse(A))` returned an Array. Now a dense matrix gives a dense matrix, a sparse matrix gives a sparse matrix of its own kind, and an Array gives an Array. A matrix with one or three dimensions now throws the square error with its real size. A matrix that is not square throws a `RangeError` at every site, as in mathjs; before, the same rule threw a plain `Error` at some sites. Each message stays the same, except `eigsh`: an empty input throws `eigsh: dense matrix input must be non-empty`, and a ragged input throws `eigsh: dense matrix input must be square`. A `catch` of `Error` still catches the error. `pinv`, `re`, `im`, `arg` and `setDistinct` of a matrix give a matrix (they gave an Array); `pinv([])` is `[]`, and a 1-D matrix gives a 1-D result. (Refs #1264)
- a50902c: `mathieuA(n, q)` and `mathieuB(n, q)` are correct for a large `q` and a high order. The 50-harmonic matrix gave wrong values (`mathieuA(3, 1e6)` was -1981206.54 and not -1986006.25, `mathieuA(99, 1e8)` was +199904592.8 and not -196024956.4, `mathieuA(99, 1)` was 9801.0025 and not 9801.00005); both functions now use a matrix sized to `n` and `q` and one Sturm-bisection eigenvalue, so `mathieuA(99, 1e8)` is -196024956.4264. For `|q| >= max(1e5, 10 (2n+1)^4)` they use the asymptotic series of DLMF 28.8.1, so `mathieuA(3, 1e10)` and `mathieuA(3, 1e100)` (-2e100) cost no more than `mathieuA(3, 1e6)`. A negative `q` follows DLMF 28.2.21. `mathieuA(n, 0)` is `n^2`, an infinite `q` gives `-Infinity` and a NaN `q` gives NaN. (Refs #1105)
- 789a41a: `sylvester` checks the shapes of A, B and C before it solves. A matrix A or B that is not square, and a matrix C that is not m x n, now throw `RangeError: Dimension mismatch: ...` that names the operand and its size. Before, the call threw a generic `Error` from `schur` or `multiply`, and printed a `Backend operation failed` line. (Refs #1265)
- a50902c: Six results that lost their range are finite and correct. `bernoulli(198)` to `bernoulli(258)` were `Infinity`; they use the zeta product, so `bernoulli(200)` is -3.647e215 and `bernoulli(258)` is 1.335e306. `catalan(141)` to `catalan(519)` were `Infinity`; `catalan(300)` is 4.489e176, `catalan(520)` is `Infinity` and `catalan(30)` is the exact integer 3814986502092304 (it was one too high). `siegelZ(t)` for `|t| > 40` was `NaN` from `t = 55.6`; it now uses the Euler-Maclaurin sum (`siegelZ(1000)` is 0.99779463752), and `|t| > 8e7` throws a RangeError. `sphericalHarmonic(l, m, theta, phi)` with `l + |m| > 170` was `NaN` or 0; `sphericalHarmonic(200, 0, 1, 1)` is 0.0767642916 and `sphericalHarmonic(100, 100, 1, 1)` is 2.612e-8 - 1.534e-8i. `rootsHermite(n)` and `rootsLaguerre(n)` use the Golub-Welsch method: `rootsHermite(200)` no longer throws (the scan lost two roots), and `n` up to 7000 works (the limit was 500). `sphericalBesselY(400, 1)` is `-Infinity` (see #1116). (Refs #1102)
- a50902c: `mathieuCe(n, q, x)` and `mathieuSe(n, q, x)` are correct for a large `q` and a high order. They summed a 50-harmonic series, so `mathieuSe(100, 1e3, 0.4)` was 1.2043 and not -1.0101, and `mathieuCe(0, 1e6, 1.5)` was -0.0482 and not 0.0420. They now use the matrix of `mathieuA` and `mathieuB` (sized to `n` and `q`), the eigenvalue by Sturm bisection and the eigenvector by inverse iteration. A call that needs more than `MAX_MATHIEU_HARMONICS` (1e6; `|q|` above about 1.8e19 at `n = 3` and about 5e17 at `n = 99`) throws a RangeError: `mathieuCe(3, 1e30, 0)` returned the wrong value -0.0062. A NaN `q` gives NaN. The sign is the sign of DLMF 28.2(vi), continued from `q = 0`: `ce_n(0, q) > 0` and `se_n'(0, q) > 0` for every `q`. The old rule (coefficient `m` positive) gave the opposite sign from `q` about 25 on, for example `mathieuCe(2, 100, 0.3)` and `mathieuSe(4, 1e4, 1.2)`. (Refs #1289)
- 4966096: `signTest`, `moodMedianTest`, `cummax`, `cummin` and `medianSelect` return NaN for a NaN input, as SciPy and NumPy do. `ecdf` throws a `RangeError` for a NaN input. `wassersteinDistance` returns NaN when the same infinite value occurs twice, or when an infinite value has the weight 0. `signTest` gives the exact p-value for more than 1,029 values (it gave NaN or 0). For up to 1,000 values, `signTest` sums the binomial coefficients directly, so `signTest([Infinity, -Infinity, 1, 2])` gives 0.625 exactly (the log-gamma sum gave 0.6250000000000006). `fisherExact` walks from the mode of the distribution with exact ratios, so its time grows with the square root of the counts and not with the counts (`[[1e9, 1e9 + 1e5], [1e9, 1e9]]` takes less than 1 s). A p-value that a double can hold is not 0. A table counts when its probability is at most the observed one times 1 + 1e-14, as in SciPy (the tolerance was 1e-7). `fisherExact` throws a `RangeError` when the walk needs more than 400,000,000 steps, or when the sum of the entries is not finite. (Refs #1146)
- 44d5dd0: `owensT(h, a)` is accurate for a large `h`. Before, on main, `owensT(30, 1)` returned 2.4488e-198, and the closed form `Phi(h) Phi(-h) / 2` gives 2.4534e-198 (relative error 1.9e-3). The integrand has the factor `exp(-h^2 / 2)`, so its values were near 1e-196 and each panel of the quadrature met the absolute floor 1e-14. `owensT` now takes `exp(-h^2 / 2)` out of the integral. For `h` from 5 to 37 and `a = 1`, the relative error against the closed form is below 1e-10. (Refs #1294)
- 8879eea: `matrix(data, format)` checks its format, as in mathjs. A format other than `'dense'`, `'default'` or `'sparse'` throws `Unknown matrix type "foo".` (a boolean is read as a string), and a format that is not a string or boolean throws a `TypeError`. `matrix(sparseMatrix, 'dense')` and `matrix(sparseMatrix, 'default')` return a dense matrix with the same entries; before, they returned the sparse matrix. `matrix(m)` of a matrix, and `matrix(data)` of an Array, give a copy, as in mathjs. (Refs #1284)
- 89f1ec7: `round_f64` rounds a tie away from zero. Before, it used the WebAssembly instruction `nearest`, which rounds a tie to the even integer: `round_f64(0.5)` gave 0, `round_f64(2.5)` gave 2 and `round_f64(-2.5)` gave -2. Now `round_f64(0.5)` is 1, `round_f64(2.5)` is 3 and `round_f64(-2.5)` is -3. A zero input gives +0. The kernel has no configuration and applies no tolerance, so `round_f64(0.49999999999999994)` is 0, and the `round` of `@danielsimonjr/mathts-functions` gives 1 with its default `relTol`. No function of `functions`, `matrix`, `parallel`, `tensor`, `compat` or `expression` calls this kernel. (Refs #1028)
- c12439a: `simplify` keeps a decimal that has no small exact fraction, as mathjs does (Fixes #1175). Before the change, `simplify('66079.39738442015')` printed `6.977852205e+9 / 1.05598e+5`, `simplify('22026.465794806718*3')` and `simplify('exp(10)*3')` printed the same, and `simplify('59760.92063816244 + x')` printed `x + 1.7556623026e+10 / 2.93781e+5`. The test of `_exactFraction` accepted a number when a MathTS Fraction reproduces it, and a MathTS Fraction reproduces more doubles than the `fraction.js` class that mathjs asks. The test now asks `fraction.js` (a dependency of the package already), so each of these prints `66079.39738442015` and `x + 59760.92063816244`. The reverse case changes too: `simplify('1e-7')` printed `1e-7`, and now prints `1 / 1e+7`, as mathjs does, because `fraction.js` has an exact fraction for it. A number with a small exact fraction does not change: `0.1+0.2` is `3 / 10`, `123.456` is `15432 / 125` and `0.3333333333333333` is `1 / 3`. For 2000 values of `exp(12*u)` (u from a fixed generator), 307 results differed from mathjs before the change, and none differs after it. (Refs #1175)
- 789a41a: `pow` of a 0 x 0 matrix returns a 0 x 0 matrix of the same kind: `pow([], 2)` is `[]`, and a Matrix gives a Matrix. Before, the call threw `TypeError`. A 0 x 3 matrix throws the square `RangeError`, and the exponent rule (a non-negative integer) holds for an empty matrix too. `pow` and `sqrtm` of a non-empty Matrix now return a Matrix, as mathjs does (a sparse matrix gives a dense matrix); an Array still gives an Array. A call of the `compat` adapter with a native `DenseMatrix` now returns a public `DenseMatrix` for a result with a zero dimension, where it returned `[]` or threw: `sqrtm`, `sylvester`, `kron`, `inv`, `map`, `larger`, `equal` and the factors of `qr`. (Refs #1278)
- aaa52d3: sqrtm of a singular matrix that has a real root (the zero matrix, a rank-1 matrix) returns the root. Before, it threw "Cannot calculate inverse, determinant is zero". When Denman-Beavers does not give a root, sqrtm now uses the Schur method of matrixSqrtm. matrixSqrtm of a singular symmetric matrix now returns a root that squares back to the matrix to 1e-12. Before, the root of a matrix of rank below n-1 missed the matrix by 1e-9, and sqrtm threw an error. (Refs #1170)
- a7c47d4: BigNumber `gamma` and `factorial` of a value that is not an integer return a value and no longer throw. `zeta` of a negative BigNumber that is not an integer returns its value: before, `zeta(-0.5)` threw and `zeta(-1e-40)` gave `-0.5`. `gamma(NaN)` and `factorial(NaN)` give `NaN` and gave `Infinity`. This is a behaviour change and a deliberate difference from mathjs, which gives `Infinity`. `zeta` of a large negative odd integer gives a signed `Infinity` and gave `NaN`. (Refs #1291)
- 3b2ffe6: The default expression scope returns a Complex for `sqrt` and `log` of a negative real and for a negative real to a non-integer power, as mathjs does: `sqrt(-4)` is `2i`, `log(-1)` is `πi` and `(-8)^(1/3)` is `1 + 1.732i`. These calls gave `NaN`. An integer power stays real, the real limits `(-0.5)^Infinity` and `(-8)^(-Infinity)` stay 0, and a `NaN` argument stays the number `NaN`.
  
  `Complex.pow` uses the algorithm of complex.js, so `pow` of a Complex equals mathjs bit for bit on core, the typed functions, compat and the evaluators: `sqrt(-4)^2` is `-4` and was `-4 + 4.9e-16i`, `i^2` is `-1`, and `pow(-8, 1/3)` is `1 + 1.732050807568877i` and was `1.0000000000000002 + 1.7320508075688772i`. Many other results change by one unit in the last place. A zero base follows the IEEE 754 pow rules: `0^y` is 0 for `y > 0` and `Infinity` for `y < 0`. mathjs gives `-0 + 0i` for `0^2` and `0 - Infinity i` for `0^(-1)`. Where complex.js computes `Infinity * 0` and gives `NaN + NaN i`, the result keeps the IEEE value: `(1e300 + 1e300i)^2` stays `Infinity + Infinity i`, and `(1e300 + 1e300i)^0.5` is finite (a part above about 2.7e154 made the squares in complex.js overflow). The new methods `Complex.cbrt()` and `Complex.cbrtRoots()` hold the mathjs cube root, and the typed, factory and default-scope `cbrt` of a Complex call them, so all three equal mathjs. (Refs #1086)
- a50902c: `chebyshevT(n, xs)`, `legendreP(n, xs)` and `laguerreL(n, xs)` with an array now count the recurrence steps of the whole array. A call that needs more steps than the order limit of the scalar (4e9, 2.5e9 and 1e9) throws a RangeError before any recurrence runs. Before, each element had the scalar limit only, so an array of 1000 elements at the largest degree ran for hours. For `|x| > 1`, `chebyshevT` and `legendreP` count the steps up to the first overflow, so `chebyshevT(3e9, 1000 elements at 1.5)` still returns `Infinity` for every element. A degree above the limit of the scalar keeps the message of the scalar. (Refs #1290)
- 3b2ffe6: `round` rounds a tie of a number and of a BigNumber away from zero, as mathjs does: `round(-2.5)` is -3 and was -2, `round(1.005, 2)` is 1.01 and was 1, and `round([-2.5, 1.5])` is `[-3, 2]`. The cause was `Math.round`, which rounds a tie toward `+Infinity`, and a scaling by `10^decimals` that is not exact. A value within `relTol` below a tie rounds up: `round(0.49999999999999994)` is 1. `round(-0)` and a value below `absTol` give 0 and not -0. Core `round` of a BigNumber rounds a tie away from zero and rounded it toward `+Infinity`. An element 0 or -0 of an Array or a matrix stays as it is (`round([-0])` is `[-0]`), as mathjs maps a collection; a Float64Array element takes the scalar rule. A Fraction and a Complex keep the rule of fraction.js and complex.js, so a tie goes toward `+Infinity`. The typed `round` and `factory_round` share one kernel, `roundNumberTol` of core `./internal`, and a `relTol` below `1e-15` no longer makes `factory_round` throw. (Refs #996)
- a50902c: `besselJ(n, xs)` and `besselY(n, xs)` with an integer order of at least 2 now count the recurrence steps of the whole array. A call that needs more than 2.5e9 steps in all throws a RangeError before any recurrence runs. Before, each element had its own limit only, so `besselY(2.4e9, 1024 elements)` ran for hours. The message names the order, the element count and the maximum. An element that ends at once (a zero result, a non-finite `x`, `x <= 0` for `besselY`) counts no steps, and an element above its own limit keeps its own message. (Refs #1132)
- 3b2ffe6: `nthRoots` returns roots with number parts. Before, each root off the axes had the object `{ r, phi }` as its real part, because the call `new Complex({ r, phi })` reached a constructor that takes `(re, im)`. Each root now comes from `Complex.fromPolar`, and the local constructor type declares the real signature, so the compiler can see a wrong call. (Refs #1282)
- 8879eea: `matrix(undefined)` throws a `TypeError`, as in mathjs, and `matrix(undefined, 'sparse')` does too. Before, an explicit `undefined` data argument gave an empty matrix. A call with no argument, `matrix()`, is still an empty dense matrix, and `matrix(data, undefined)` is still read as no format. (Refs #1284)
- aaa52d3: sqrtm keeps a result only when it squares back to the matrix. A matrix with large entries (above about 2^33) or small entries (near 2^-19) now converges: sqrtm runs again on a copy that is scaled by a power of 2. Before, a large matrix threw an error, and a small matrix returned a value with a residual of 4.5e-8. (Refs #1158)
- 4966096: `chiSquareTest`, `kolmogorovSmirnovTest`, `mannWhitneyTest` and `shapiroWilkTest` throw when `bootstrap` is not a non-negative integer, or is above 10,000,000. `chiSquareTest` also throws when the bootstrap needs more than 200,000,000 draws. `fisherExact` throws a `RangeError` for an entry that is not a non-negative integer. `kolmogorovSmirnovTest`, `shapiroWilkTest` and `mannWhitneyTest` throw a `RangeError` when `bootstrap` times the sample size is above 20,000,000, 100,000,000 and 300,000,000 (pooled size) respectively: each limit is 5 to 23 s of work on the build machine, depending on its load. `chiSquareTest` with a NaN statistic gives NaN for `pValueEmpirical`, `bootstrapMean` and `bootstrapStd`, and B NaN statistics, as `mannWhitneyTest` does for a NaN sample (it gave 0). (Refs #1154)
- 44d5dd0: `tTestPower(effectSize, power, alpha, { solveFor: 'nobs' })` is about 3 times faster. The bisection stops when its interval is two adjacent doubles (after about 70 steps, not 200). The result does not change.
- 6c87a8b: `partitionSelect` no longer takes quadratic time on equal values. Each pass sent every value that equals the pivot to the right part, so a range of equal values became smaller by one value per pass. `partitionSelect(new Array(20000).fill(5), 10000)` took 41.8 s. Each pass now splits the range into values less than, equal to and greater than the pivot, and stops when k is in the equal part. `quantileSeq` and `median` of BigNumber, Fraction and Unit data use this selection: `quantileSeq` of 2000 equal BigNumbers took 8.2 s.
  
  (Refs #1293)
- a50902c: `besselY(n, x)` returns `-Infinity` when `Y_n(x)` is outside the double range, and it returned `NaN`. `besselY(154, 1)`, `besselY(400, 1)`, `besselY(1000, 100)` and `besselY(400.5, 1)` are `-Infinity`; `besselY(-401, 1)` is `Infinity` (the sign of a negative odd order). Values below the overflow keep their digits: `besselY(151, 1)` is -5.1999e307. The AssemblyScript kernel `bessel_yn_f64` returns the same infinities as the JS scalar. A real order with `nu / x` above about 150 was `NaN` for every `x` (the downward recurrence overflowed): `besselY(400.3, 3)` and `besselY(1000.3, 50)` are `-Infinity`, and `besselJ(300.5, 1)` is `0`. A negative non-integer order reduces `nu` modulo 2 and puts the factor `cos(nu pi)` (for `besselY`) or `-sin(nu pi)` (for `besselJ`) into the upward recurrence of `Y`, so a result that is a double stays finite where `Y_nu` alone overflows: `besselY(-100.5, 1)` is 5.94e-190 (it was -1.8e172), `besselY(-151.5001, 1)` is -2.84e305, `besselY(-152.5, 1)` is 7.63e-315, `besselJ(-152.0001, 1)` is 4.94e306, `besselY(-400.3, 1)` is `-Infinity`, `besselJ(-400.3, 1)` is `Infinity` and `besselY(-400.5, 1)` is `0`. A non-finite `x` stays `NaN`. (Refs #1289)
- a50902c: `besselJ` with a real order and a tiny `x`, `sphericalBesselJ` and `sphericalBesselI` with a tiny `x`, `sphericalBesselY` after its first overflow, `sphericalBesselI` with a large `x` and `chebyshevT` with `|x| > 1` after its first overflow no longer return NaN. `besselJ(0.5, 1e-300)` is 7.98e-151, `sphericalBesselJ(1, 1e-300)` is 3.33e-301, `sphericalBesselY(50, 1e-10)` is `-Infinity`, `sphericalBesselI(1000, 1000)` is 6.95e227 and `chebyshevT(1000, 1.5)` is `Infinity`. `sphericalBesselK(1000, 1000)` is 7.99e-235 (it was 0). `sphericalBesselY(4e8, 5)` is `-Infinity` (it was NaN), and `sphericalBesselK(1.8e9, 1e4)` is `Infinity` (it was 0). `sphericalBesselI(0, x)` uses `ln i_0` when `sinh(x)` overflows: `sphericalBesselI(0, 712)` is 1.16e306 (it was `Infinity`) and `sphericalBesselI(0, Infinity)` is `Infinity` (it was NaN). `sphericalBesselJ` scales its downward sweep by the larger of `|j_0|` and `|j_1|`, so `sphericalBesselJ(10, Math.PI)` is 5.4855e-6 (it was 2.7787e-6; `j_0` is a rounding error at `x = k pi`). (Refs #1116)
- a5bc409: `equal`, `unequal`, `smaller`, `larger`, `smallerEq`, `largerEq` and `compare` take an Array, a dense matrix and a sparse matrix, element by element, with the values and the result storage of the mathjs port. Before, six of them threw `TypeError` for a collection and `unequal` of two collections gave one boolean. `sqrt`, `log` and the other element-wise functions of `unaryCollection` keep the class of a factory matrix (dense or CSC) when an entry leaves the real domain: `sqrt` of a CSC matrix with a `-1` entry is a CSC matrix with Complex `i` there, where it was a plain Array. `sqrt(matrix([4, -1]))` of a 1-D matrix gave `[2, NaN]` and now gives `2` and `i`. `dotDivide` of a sparse zero matrix by an Array is a sparse zero matrix, as in mathjs (documented). `unequal` of two Units compares the quantity, as `equal` does: `unequal(unit('1 m'), unit('100 cm'))` was `true` and is now `false`. Scalar `equal` and `unequal` of two Units compare the values with the tolerance of the number rows: `equal(unit('0.3 m'), add(unit('0.1 m'), unit('0.2 m')))` was `false` and is now `true`, as in mathjs. (Refs #975)
- 8879eea: `resize` and `zeros` keep every axis of a size with three or more dimensions. `zeros([1, 0, 0], 'dense')`, `zeros(1, 0, 0)` and `matrix([]).resize([2, 0, 3])` now have the size that is asked for, and `zeros(2, 3, 4)` is filled on all three axes. `resize` of a 1-D or 2-D matrix to more axes pads the new axes, as in mathjs, and the `resize` function does not change its input. The `resize` method takes a matrix size, and `resize([])` gives the first entry. (Refs #1279, #1102)
- a5bc409: `multiply` of two sparse matrices builds no dense matrix. The product is a column Gustavson kernel that reads the stored entries only. A pair of 2000 x 2000 CSC matrices with 0.1% extra entries took 11370 ms and now takes 8 ms. A sum that cancels to zero stays a stored entry, as in mathjs, so the structure of the product no longer depends on the values and `slu` with the AMD order gives the same column order for any values of one pattern. A zero that the matrix does not store is never multiplied, so a product with an `Infinity` entry has no `NaN`, as in mathjs. A tall left operand (more than 65536 rows, and more rows than four times the sum of its stored entries and its columns) uses a workspace of one slot for each stored row. A 1e9 x 1 matrix with one stored entry threw `RangeError` (the buffer allocation failed) and now multiplies, as in mathjs. (Refs #1271)
- 2df36db: `eigs` of a Matrix of numbers uses the native solver, as the Array input does. Before, it used the general real-arithmetic solver, which threw "failed to converge" for some matrices and returned wrong eigenvectors. The result keeps the value order of a Matrix result and honours `matricize: false`. A matrix of numbers and Fractions (an Array or a Matrix) also takes the native solver, because the factory solves it in numbers: the eigenvector residual of such a 3x3 matrix was 2.3e-6 and is now at rounding size. The values keep the factory order (|lambda| ascending), as in mathjs 15.2.0. (Refs #1179)
- c12439a: Four small defects of the CAS and of the LaTeX output are fixed (Refs #1014; item 3, `symbolicEqual('(x+1)^2', 'x^2+2*x+1')`, is fixed with #1178).
  
  - `factor` of a polynomial with rational coefficients: `factor('x^2/2-1/2')` returned the input. It now returns `(x - 1)*(x + 1)/2`. The factor of the integer polynomial that the common denominator gives is divided by that denominator. `x^2-1/4` gives `(2*x - 1)*(2*x + 1)/4` and `2*x/3-2/3` gives `2*(x - 1)/3`. An irreducible polynomial (`x^2/2+1/2`) is returned as it is. The content path of `factor` also cut a number literal: `2*x/3-2/3` gave `2*(x/3 + -/3)`, `2^3*x+4` gave `2*(^3*x + 2)` and `4*x+2.5*y` gave `2*(2*x + .5*y)`, all with a wrong value. It now returns the input for these. It writes a negative term as `x - 1`, not `x + -1`.
  - `symbolicPartialDerivative('x^2*y', 'x')` returned `d/dx(x^2*y)`. The term reader of the function cannot read a power of the variable with another symbol, so it leaves that placeholder. For such an input the function now returns the derivative of the expression tree: `2 * y * x`. A term that the term reader reads keeps its text.
  - `realRoots([1, -3, 2])` returned `[0.49999999999272404, 1.0000000000218279]`: the bisection stops at a relative bracket width of 1e-10 and returned the middle. Newton steps inside the bracket now polish each root: the result is `[0.5, 1]`, and `[-6, 11, -6, 1]` gives `[1, 2, 3]`. A double root keeps the accuracy of the bisection. The documentation of `realRoots` states the order of the coefficients (ascending), the meaning of `tol` and the order of the roots (ascending, each once). `solve` of a polynomial uses `realRoots`, so its roots are more exact.
  - The LaTeX of an operator that is a command (`\neg`, `\cdot`, `\wedge`, `\mod`) is no longer joined to an operand that starts with a letter: `parse('not true').toTex()` was `\negtrue` and is now `\neg true`. `2*true` gives `2\cdot true`. A digit and a symbol are not changed (`\neg1`, `\neg a`). (Refs #1014)
- 6c87a8b: `quantileSeq` now uses the NumPy `method` for BigNumber, Fraction and Unit data and for a BigNumber probability. Before, these inputs gave the `linear` result for eight of the 13 methods: `quantileSeq([1, 2, 3, 4], bignumber(0.1), 'inverted_cdf')` gave 1.3 and the NumPy result is 1. One plan (`quantilePlan`) now gives the two order statistics and the weight for every type. A BigNumber probability uses exact BigNumber arithmetic.
  
  Every dimension form now accepts a method, an options object, and `sorted` with a method. `quantileSeq([[5, 2], [9, 1]], 0, 'hazen', 1)` threw "Too many arguments" and now gives `[2, 1]`. The expression language passes the method and the options object, and it counts `dim` from one.
  
  A NaN probability gives NaN. A BigNumber NaN probability gives a BigNumber NaN. Before, the result was `undefined`. NumPy raises `ValueError` for a NaN probability, and mathjs returns `undefined`. A probability outside 0 to 1 in a list now throws for every type of value.
  
  (Refs #1130)
- 44d5dd0: `inv` of a matrix of numbers with entries that span more than the double range returns the inverse. `inv([[1e300, 1e-300], [0, 1e300]])` gave a zero matrix: the unscaled determinant overflows, the scaled run flushes 1e-300 to zero, and the finite unscaled result was kept without a check. It now gives `[[1e-300, 0], [0, 1e-300]]`, as NumPy does. The unscaled result is kept only when the scaled run fails or is not finite, so `inv([[1e300, 0], [0, 1e-300]])` and a singular matrix give the same result as before. (Refs #1162)
- 8879eea: `sparse([[1], [2, 3]])` and `matrix(data, 'sparse')` of a ragged array keep every entry. The column count is the length of the longest row, as in mathjs. Before, the columns of a longer later row were lost. (Refs #1273)
- a5bc409: `divide` of a collection by a collection is `a * inv(b)`, as in mathjs. `divide([[1, 2], [3, 4]], [[1, 2], [3, 4]])` is the identity matrix, and `evaluate('A / B')` of two matrices works. A divisor that is not square throws `RangeError` and a singular divisor throws `Error`, with the text of `inv`. A scalar divided by a vector of length 1 is a vector: `divide(4, [-2])` threw `RangeError` and is now `[-2]`, as in mathjs. `eigs` of a defective Complex matrix multiplies the back transform by a vector or a column, which the new `multiply` accepts. (Refs #975)
- ba1fdea: `lstsq` reads `b` with `readRightHandSide`, so a DenseMatrix, SparseMatrix, typed-array or numeric-string `b` gives the solution. Before, a typed-array `b` gave zeros. A BigNumber, Fraction or Complex entry of `b` throws a TypeError that names the type (a BigNumber `b` gave zeros before). `matrixExpm`, `matrixLogm` and `matrixSqrtm` accept a nested array, a SparseMatrix and a MathJS matrix, as the decompositions do. The decomposition reader applies the implicit rule of mathjs: a numeric string, a boolean and null convert, and a non-numeric string throws `Cannot convert` (before, it became NaN). The `new DenseMatrix(rows, cols, array)` constructor throws a TypeError for an entry that is not a number. The matrix package exports `nestedMatrixShape`. (Refs #1003)
- a5bc409: `multiply` takes a 1-D operand, as mathjs does. A vector times a vector is the scalar product (`multiply([1, 2], [3, 4])` is 11, and it conjugates a Complex entry of the left vector, as `dot` does). A matrix times a vector and a vector times a matrix give a vector. A length mismatch throws `RangeError` with the mathjs text, and an operand of 3 or more dimensions throws `Error` with the mathjs text. `evaluate('[1,2]*[3,4]')` gives 11. The compat instance sends a 1-D operand to the same function: `create(all).multiply([[1, 2], [3, 4]], [1, 1])` threw `TypeError` and is now `[3, 7]`. A compat result of a 1-D matrix now has the mathjs shape, not a 1 x n row: `subtract(matrix([3, 4]), 1)` was `[[2, 3]]` and is `[2, 3]`, `multiply(matrix([1, 3, 4]), matrix([[-1], [0], [-2]]))` was `[[-9]]` and is `[-9]`, and `multiply(matrix([-3, 4, 4]), matrix([0, -4, 0]))` threw and is `-16`. A product with an empty axis follows mathjs: `multiply([[1], [2]], [[]])` threw `TypeError` and is `[[], []]`, and `multiply([[], []], [])` was `[0, 0]` and throws `TypeError`. (Refs #1007)
- b866b34: `xgcd`, `combinations` and `isPrime` give exact results for BigNumber integers of any size. `xgcd` of BigNumbers computes the Bezout coefficients as exact integers, so `a*x + b*y = g` holds at every precision and for a negative operand (`xgcd(-1, 2)` is `[1, 1, 1]`, and `xgcd(0, 0)` is `[0, 0, 0]`). `xgcd` throws `Parameters in function xgcd must be integer numbers` for NaN, Infinity and a non-integer number; before, it returned NaN values or floored the operand. `combinations` of two BigNumbers computes the exact binomial coefficient and rounds the result one time to the precision. `isPrime` of a BigNumber of 2^32 or more runs the Miller-Rabin test on bigint, so no product rounds, and NaN, Infinity and a non-integer value of that size give `false`. Below 3317044064679887385961981 the 13 prime bases 2 to 41 are a proof; from that value the test adds the base of mathjs and is probabilistic, as in mathjs.
  
  The return type of a call with one BigNumber and one number changes. `xgcd(bignumber(12), 8)` and `combinations(bignumber(200), 100)` now return BigNumbers, as mathjs does. Before, the BigNumber was converted to a number and the call returned numbers. A bigint or a Fraction argument of `combinations` still gives a number.
  
  `xgcd` of two numbers throws a `RangeError` when a Bezout coefficient is not a safe integer, because a rounded coefficient breaks `a*x + b*y = g` (`xgcd(2^60, 3)` gave `[1, 1, -384307168202282300]`; the exact `y` is `-384307168202282325`). Bigint and BigNumber operands give the exact coefficients. mathjs gives the wrong `[3, 0, 1]` there.
  
  The BigNumber `combinations`, `combinationsWithRep`, `permutations` and `multinomial` of a long loop run at a working precision in O(k) steps, and a rounding proof checks each result: the error bound of the steps gives an interval for the exact value, and the result is accepted only when both ends of the interval round to the same value at the precision (else more guard digits, and at last the exact loop). So each result is the exact value rounded one time, for every rounding mode. A cost model in limb operations selects the exact loop or the working loop; `combinations(bignumber('1e10000'), 2)` takes milliseconds. `catalan` and `bellNumbers` of a BigNumber use the same proof: `catalan` rounded the binomial coefficient and then the quotient (two roundings), and the guard digits of `bellNumbers` did not cover the n(n + 1) / 2 additions behind the last entry of its triangle.
  
  In `@danielsimonjr/mathts-core`, `BigNumber.fromBigInt` and the normalization of every BigNumber result remove trailing zeros by powers 10^(2^j), not one zero per step: `BigNumber.fromBigInt(10n ** 100000n)` took 25 s and `xgcd(bignumber('1e100000'), bignumber('1e99999'))` 24 s; each now takes milliseconds. (Refs #1164)
- 6c87a8b: `quantileSeq` and `median` of BigNumber data now give the same result for every order of the input. The selection compared the values with `compare`, which reads values within the config `relTol` as equal. `quantileSeq([bignumber('1.0000000000002'), bignumber(2), bignumber('1.0000000000001'), bignumber(1)], bignumber('0.5'))` gave 1.0000000000001, and the sorted input gave 1.00000000000015. The selection now compares numbers and BigNumbers exactly. Fraction and Unit data keep `compare`.
  
  (Refs #1292)
- aaa52d3: sqrtm of a singular matrix returns a real root when one exists. It no longer returns a value that is not a root (a residual of 0.458 for the matrix of the issue). matrixSqrtm reads a negative Schur entry within rounding noise as a zero eigenvalue. It returns the root when the root passes its check. A matrix with no real root still throws. For a singular matrix, the error message is now "iterative method could not converge" in place of "Cannot calculate inverse". (Refs #1163)
- b866b34: `parse(...).evaluate()` and `evaluate(...)` run one implementation of `multinomial`, `permutations`, `combinations` and `combinationsWithRep`: the typed functions. `combinationsWithRep` takes BigNumbers (the exact coefficient, rounded one time) and throws the mathjs texts. The `xgcd` of the parse path calls the typed `xgcd` and wraps the result in a matrix (an Array when `config.matrix` is `'Array'`). `multinomial([[1, 2], [3, 4]])` is `12600` on both paths, `multinomial([true, true])` is `2`, and `multinomial` of BigNumbers is an exact BigNumber with no 2^1024 cap. A matrix of matrices is one matrix: `matrix([matrix([1, 2]), matrix([3, 4])]).size()` and the size of the same data in a sparse matrix are `[2, 2]`, as in mathjs, and `sum([[1, 2], [3, 4]])` on the parse path is `10`.
  
  Accepted changes of the parse path: `combinations(200, 100)` is `9.054851465610328e+58`, the correctly rounded value of the exact coefficient (mathjs and the old factory give `9.054851465610331e+58`); `combinations(1e20, 2)`, `combinations(2^53, 3)` and `permutations(2^53, 2)` return values where the old factories threw; `combinationsWithRep(1e20, 2)` is `5e+39`, the exact `C(n + k - 1, k)` (mathjs gives `5e+19`); `combinations(fraction(5), fraction(2))` and `permutations(fraction(5))` are numbers (the old factories gave BigNumbers, and mathjs throws a conversion error); `permutations` of an Array maps over the elements. A ragged array literal, `multinomial([[1, 2], [3]])`, throws a `DimensionError` on the parse path, as in mathjs, while the compat `evaluate` keeps the plain array and counts all of its entries. (Refs #1093)
- 89f1ec7: The LU, inverse, determinant and QR of `WASMBackend` and the kernels `matrix_lu_decompose`, `matrix_inverse`, `matrix_determinant` and `matrix_qr_decompose` no longer compare a pivot to the absolute 1e-14. A pivot is now zero when it is at most 1e-14 times the sum of `|l|·|u|` of its own computation, so the verdict does not depend on the unit of the matrix. An infinite pivot is not zero, so `[[1, 2], [3, Infinity]]` stays regular. Before, a rank-deficient matrix times 2^20 was regular, `[[1, 0], [0, 1e-15]]` was singular, and `determinantWasm([[3e-100, 1e-100], [4e-100, 2e-100]])` returned 0 (it is 2e-200). The Householder QR skips a column only when its sub-column is exactly zero, and both QR kernels give an exact zero below the diagonal of R. The Householder QR kernel `matrix_qr_decompose` and its JavaScript twin also take the norm of a column whose largest finite entry is above 2^500 from the entries divided by that entry. The squares of such a column overflow, so the norm was `Infinity` and the result was finite and wrong: a column of three `1e200` gave `R[0][0] = -1e200`, and the value is `-1.7320508075688772e200`. Only a direct caller of the export saw this, because `WASMBackend` scales its input into range first. (Refs #1172)
- 33acba1: The distribution constructors (`normalDist`, `gammaDist`, `exponentialDist` and the 18 others) throw a `TypeError` for an options object after their last parameter, for a value with no numeric reading in a number position (an array too), and (`gammaDist`, `sampleN`) for an unknown option key. Before, `gammaDist(2, 2, { scale: 2 })` gave the rate distribution with no error. A call from `Array.prototype.map`, an explicit `undefined`, a BigNumber parameter and a missing parameter stay valid. Each constructor documents its SciPy equivalent. (Refs #940)
- c12439a: `simplify` folds `gcd` and `lcm` of constants to the mathjs values. `simplify` folds a constant as a Fraction. The Fraction signature of `gcd` called `Fraction.gcd()`, which takes no argument and returns `1n`, so `simplify('gcd(4,6)')` gave `1` and `simplify('gcd(12,18)+x')` threw `JSON.stringify cannot serialize BigInt`. The Fraction signature of `lcm` called a method that `Fraction` does not have, so `simplify('lcm(1/2,1/3)*x')` stayed unevaluated. Both signatures now use the fraction.js definition: gcd(a/b, c/d) = gcd(a, c) / lcm(b, d), and lcm(a/b, c/d) = lcm(a, c) / gcd(b, d). The results are `2`, `x + 6` and `x`. `replacer` now writes a bigint as `{"mathjs":"bigint","value":"5"}`, as mathjs does, and `simplify` uses the same replacer, so `simplify('2*x+3*x')` on an instance with `number: 'bigint'` gives `5 * x` and does not throw. `reviver` reads that tag back as a bigint. (Refs #1321)
- 8879eea: Resizing a sparse matrix fills the new entries with the default value, leaves the input as it is when a copy is asked for, and needs a size with two dimensions. `ones(2, 3, 'sparse')` is a matrix of ones, as in mathjs; before, it was all zero. `resize(sparse, [3])` and `zeros(3, 'sparse')` throw `Only two dimensions matrix are supported`. (Refs #1279, #1288)
- 33acba1: `gammaDist` reads a BigNumber or a Fraction second argument as the rate. Before, it read that argument as an options object and threw, so `evaluate('gammaDist(2, 2)')` failed in a scope with `number: 'BigNumber'`. (Refs #1360)
- 89f1ec7: The binaries `mathts.wasm` and `mathts-debug.wasm` of the package have no import any more. The build sets `use: ["abort=src/abort/trapAbort"]` in `asconfig.json`, so an abort calls a function of the binary that traps, and no host function `env.abort` is necessary. Node reads each import of a WebAssembly module as a package name, so `import('@danielsimonjr/mathts-wasm/wasm')` failed with `ERR_MODULE_NOT_FOUND`. Now Node loads both binary subpaths as WebAssembly ES modules (Node 22.12 needs `--experimental-wasm-modules`; Bun returns the file path as `default`), and any runtime instantiates them with an empty import object. The subpaths `./wasm` and `./debug` have a `default` condition, so `require.resolve` finds the files. The new subpath `./debug.js` exports the glue of the debug build. An abort stores its message, file, line and column in globals of the binary (new exports `abort_take`, `abort_message`, `abort_file`, `abort_line` and `abort_column`) and traps as `WebAssembly.RuntimeError`. The glue turns the trap into `Error('<message> in <file>:<line>:<column>')`, the text of before. `functions` and `matrix` ship the rebuilt binary (64867 bytes, no import). `@danielsimonjr/mathts-core` exports `guardWasmAborts`, `translateWasmAbort` and `WASM_ABORT_TEXT` from `/internal`, and the loaders of `matrix` and `functions` use them. An abort that a call of their WASM tier reaches is the same `Error` as before (`WASM abort`; `AS WASM abort` from `WASMBackend`), and its `cause` now holds the message and the position of the abort. The loaders no longer print a `console.error` line for an abort. Their `getImports()` is empty. (Refs #1019)
- 44d5dd0: `lup` and `linsolve` use pivots that are relative to the matrix, so a regular matrix with entries near 1e-100 factors and solves. Before, on main:
  
  - `lup([[3e-100, 1e-100], [4e-100, 2e-100]])` (an Array or a DenseMatrix) did not swap rows and did not divide, because every entry read as zero against the absolute tolerance of `larger` and `equalScalar`. It gave `L = [[1, 0], [4e-100, 1]]`. It now gives `L = [[1, 0], [0.75, 1]]` and `p = [1, 0]`, as SciPy does.
  - `lup(sparse(...))` of the same matrix returned `L` equal to the identity and `U` with no entries. It now returns the same factors as the dense matrix. The sparse accumulator `Spa` drops an entry only when it is exactly zero. An entry that is not a number (BigNumber, Fraction, Complex) keeps the tolerance rule.
  - `linsolve` threw `linsolve: singular matrix` for the same matrix. Its pivot test is now relative to the largest term that the elimination subtracted from the pivot entry, with the floor `8 * n * eps`. The solution is `[0, 1]`.
  - `lsolve`, `usolve` and `lusolve` read a right-hand side near 1e-15 and below as zero. `lusolve(matrix([[2, 1], [1, 3]]), [[1e-16], [2e-16]])` returned `[[0], [0]]`. It now returns `[[2e-17], [6e-17]]`, for a DenseMatrix, a SparseMatrix and a factorization from `lup` or `slu`. A zero right-hand side entry is skipped only when it is exactly 0.
  - The pivot search of `slu` tied every candidate of a matrix near 1e-100. `slu(sparse([[1e-110, 1e-100], [1e-100, 1e-100]]), 1, 1)` took the first row as the pivot and gave a multiplier of 1e10. It now takes the largest entry.
  - `lsolve` threw `Linear system cannot be solved since matrix is singular` for the regular matrix `[[2e-100, 0], [1e-100, 3e-100]]`, and `lsolveAll` and `usolveAll` returned `[]` (no solution) for it and for `[[2e-100, 1e-100], [0, 3e-100]]`. A diagonal entry that is a number is now zero only when it is exactly 0, as in `usolve`. `lsolve` of the first matrix with `[[1], [2]]` returns `[[5e99], [5e99]]`. `lsolve([[1e-16, 0], [1, 1e-16]], [1e-16, 2])` threw and now returns `[[1], [1e16]]`.
  
  The diagonal matrix `[[1e10, 0], [0, 1e-7]]` still solves, and `[[1, 2], [2, 4]]` and `[[1, 2], [2, 4 + 1e-15]]` still throw. A pivot that no term cancelled is valid at any size: `linsolve([[1e-16, 1], [0, 1]], [1, 1])` threw and now returns `[0, 1]`. A pivot below `8 * n * eps` times the terms that cancelled in it throws, so some rank-deficient matrices that returned an answer near 1e16 now throw, and a system with a condition number near 1e13 or above can throw. A result that `linsolve` or `leastSquares` returns is the same as before. (Refs #1169)
- a7c47d4: BigNumber `sinh` keeps a small argument: `sinh(1e-40)` at precision 20 is `1e-40` and was `0`. The `expm1` of the functions package calls the BigNumber method, so `expm1(1e-70)` is `1e-70` and was `0`. `expm1`, `sinh`, `cosh` and `tanh` of `1e10` return a value and no longer throw `RangeError`. `zeta` of a BigNumber takes the number of Borwein terms from the precision, so `zeta(2)` at precision 64 is correct to 64 digits and was correct to 8 digits. `zeta` of a BigNumber has exact values at 0, at 1 and at a negative even integer, uses one `pow` for each prime term, and returns in milliseconds next to the pole. (Refs #1166)
- f4df499: `unwrapPhase` now runs the algorithm of `numpy.unwrap` and takes O(n) time at any phase value. The old code subtracted 2π from the difference to the previous unwrapped value, one turn at a time, so a large step ran up to 2^20 turns for each sample. For 2000 samples that alternate between 0 and 6e6, the old code took 2812 ms and the new code takes 0.2 ms. The new code takes the wrapped step from the raw difference of two neighbours and adds the corrections in one pass.
  
  The results equal `numpy.unwrap` of NumPy 2.3.5 to the last bit. A large step now gives a result that differs from the old result by up to about 3e-11 in relative terms:
  
  - `unwrapPhase([0, 5e3, -5e3, 1e4, 0])` now returns `[0, -1.4155045149500438, 1.4155045149518628, 3.4521762772783404, 6.283185307180247]`. It returned `[0, -1.4155045149763694, 1.4155045149764476, 3.4521762771895084, 6.283185307179586]`.
  - `unwrapPhase([0, 6.6e6])` now returns `[0, -2.35992350243032]`. It returned `[0, -2.359923502508572]`.
  - `unwrapPhase([0, 1e300])` now returns `[0, 0]`, as `numpy.unwrap` does: at that scale the correction `wrapped - diff` rounds to `-1e300`. It returned `[0, -0.7234267005270212]`.
  
  A step that is NaN, infinite or overflows still gives NaN for that entry and every later entry. Small steps keep their values. A Matrix now throws `TypeError: unwrapPhase: phase must be an array or a typed array` (it threw `phase is not iterable`). A nested array, such as `[[0, 4], [8, 1]]`, returned a string entry and now throws `TypeError` too. A step below π does not run the modulo, so a phase that is already continuous costs no more than before.
  
  (Refs #1147)
- 3b2ffe6: `hypot`, the modulus of a Complex (`abs`), `norm` (the vector 2-norm, the Frobenius norm and the matrix 2-norm) and `distance` follow one rule on every path and type: the IEEE 754 rule of `hypot`. An infinite argument gives `Infinity`, also when another argument is `NaN`. Else a `NaN` argument gives `NaN`. Before, the paths did not agree: `hypot(Infinity, Infinity)` was `NaN` on the factory path, `hypot(bignumber(Infinity), bignumber(NaN))` was `NaN`, `norm([Infinity, Infinity])` and `distance([0, 0], [Infinity, Infinity])` were `NaN` for numbers and `Infinity` for BigNumbers. This rule is different from mathjs, which gives `NaN` for `hypot(Infinity, NaN)` and for `hypot(Infinity, Infinity)`. `hypot` of a list longer than 32768 numbers no longer overflows the call stack, and `distance2D`, `distance3D` and `distanceND` no longer overflow to `Infinity` for a large finite difference. The AssemblyScript `complex_abs`, `complex_to_polar` and `complex_array_abs` squared each part before the sum (Infinity above about 1e154, 0 below about 1e-162, NaN for an infinite part with a NaN part) and now take `Math.hypot`. Typed `hypot` of a BigNumber with two or more other arguments converted the BigNumber to a number; it now returns a BigNumber, as with one other argument. `gradientDescent` and the complex eigenvector of `eig` spread their vector into `Math.hypot`, which threw `RangeError` for a long vector; they now use the same long-list `hypot`. (Refs #1259)
- 2df36db: The matrix 2-norm of a matrix with a NaN entry is NaN, and with an infinite entry it is Infinity. Before, a BigNumber NaN entry gave 1, a number matrix with an infinite entry gave NaN, and a matrix of BigNumber or Complex entries with a non-finite entry threw the RangeError "eigs: matrix entries must be finite". `corr` of number lists near `Number.MAX_VALUE` no longer returns NaN, because the lists are scaled by an exact power of 2 before the mean. `eigs` of a BigNumber matrix with a complex pair of order 1e200 gives the pair, not NaN. (Refs #1285)
- 6c87a8b: `quantileSeq` now has one rule for an infinite end and for an overflowing difference. When `right - left` is finite, the blend is NumPy `_lerp`. Otherwise the result is the left end at weight 0 or when both ends are equal, the right end at weight 1, and `left * (1 - gamma) + right * gamma` between. So the quantile at 0 is the minimum, the quantile at 1 is the maximum, and the result does not decrease when the probability increases. One case stays NaN: the blend of the neighbours `-Infinity` and `Infinity` at a weight between 0 and 1, as the median of those two values.
  
  Five results change from NaN to the end value. NumPy gives NaN for these inputs:
  
  - `quantileSeq([1, Infinity], 0)` gives 1.
  - `quantileSeq([Infinity, Infinity, 2, 3], 0.75)` gives `Infinity`.
  - `quantileSeq([-Infinity, -Infinity], 0.5)` gives `-Infinity`.
  - `quantileSeq([-Infinity, 1, 2], 0, 'hazen')` gives `-Infinity`.
  - `quantileSeq([-Infinity, 1], 0.25, 'weibull')` gives `-Infinity`.
  
  `quantileSeq([-1.7e308, 1.7e308], 0)` gave NaN and now gives `-1.7e308`. The same values at 0.5 gave `-Infinity` and now give 0.
  
  (Refs #1131)
- c12439a: `rationalize`, `simplify` and `variables` match mathjs 15.2.0 in seven cases (Fixes #1177).
  
  - `rationalize('(2/5+x*x - x)^4')` did not finish. The rule engine distributes a product of sums term by term, and its cost grows with the expansion. A one-variable expression whose expansion has more than 8 terms is now read with exact polynomial arithmetic. The coefficients of this example are the exact ones, and `rationalize('(1+x)^6')` is `x ^ 6 + 6 * x ^ 5 + 15 * x ^ 4 + 20 * x ^ 3 + 15 * x ^ 2 + 6 * x + 1`. mathjs does not finish on these inputs. `rationalize('(1-x)^5')` threw `Invalid ^ placing` after 30 seconds and now returns `-x ^ 5 + 5 * x ^ 4 - 10 * x ^ 3 + 10 * x ^ 2 - 5 * x + 1`.
  - `rationalize('x^2/3+1/3')`, `rationalize('(x+1)^2/3')` and `rationalize('log(2)*x^2 + 1/3')` threw `Operator / invalid`, because a MathTS only expand step wrote a decimal coefficient as a fraction. The step now runs only when the direct read fails on a power. The three results are the mathjs texts, for example `0.3333333333333333 * x ^ 2 + 0.3333333333333333`. One text changes: `rationalize('(2/5+x)^2')` ends with `0.16000000000000003`, as in mathjs, and not `0.16`.
  - `simplify('factorial(5)/7')` and `simplify('atan2(1,1)*x')` gave a 64-digit BigNumber. A function that gets Fractions and has no Fraction signature takes the core conversion to BigNumber. When no argument holds a BigNumber, the function is now called again with numbers, as mathjs does. The results are `120 / 7` and `0.7853981633974483 * x`.
  - `simplify('det([1,2;3,4])*x')` stayed unevaluated, because the rows of a matrix literal were Matrices and so the matrix had the size `[2]`. The rows are now unwrapped: the result is `-(2 * x)`. `simplify('size([1,2])')` threw `m.valueOf(...).map is not a function`; it now returns `[2]`, as mathjs does.
  - `variables('1e3*x')` returned `['e3', 'x']`. The exponent of a number literal is no longer read as a name.
  - `rationalize('(x+1)*(x-1)')` threw `Invalid - placing` and `rationalize('x^2+3*x+2')` threw `Invalid + placing`. `simplify` applied its factored form after the rules of `rationalize`, so the expanded polynomial was factored again. The factored form now applies to the default rules only. The results are the mathjs texts: `x ^ 2 - 1` and `x ^ 2 + 3 * x + 2`.
  - `rationalize('(x+1)^5-(x+1)^5')` did not finish. The exact reader now returns `0` for a polynomial that cancels.
  - A division by a constant that is no power of 2 can differ from mathjs in the last digit of a coefficient. The first rules of `rationalize` change the division into a float factor and distribute it before the exact reader runs. The sums then round in another order than in mathjs. `rationalize('(x+1)^3*(x+2)/3')` gives `2.3333333333333335 * x`, and mathjs gives `2.333333333333333 * x`. On main, this input threw `Operator / invalid`.
  - Pinned, already correct on main: `simplify('complex(2,0)*x')` is `2 * x` and `simplify('log(8,2)/3')` is `1`. (Refs #1177)
- 44d5dd0: `rank` and `nullspace` of a matrix of finite numbers use a cutoff that is relative to the matrix: the number of singular values above `max(S) * max(m, n) * eps`, as NumPy `matrix_rank` counts. Before, both used the absolute pivot cutoff 1e-10. Three classes of result change:
  
  - A small trailing singular value of a graded matrix now counts. `rank([[1e-6, 0], [0, 1e-11]])` is 2 (was 1), and `rank([[0.5, 0], [0, 5e-11]])` is 2 (was 1).
  - The rounding residue of a large low-rank matrix no longer counts. The 3 x 3 product of two rank 2 factors, scaled by 2^34, has rank 2 (was 3).
  - `nullspace` always has `n - rank(A)` vectors. Before, `rank` and `nullspace` of the same matrix could disagree: the product above at 2^20 had rank 2 and no null vector.
  
  An explicit `tol` of `rank` keeps its absolute elimination, and a matrix with a NaN or infinite entry keeps the old elimination. (Refs #1157)
- 2df36db: `eigs` and `eig` of a number matrix keep a complex pair beside a huge entry. The matrix `eig` deflates a zero diagonal entry against its neighbouring sub-diagonal entries, not against the norm of the whole matrix, so `[[1e20, 0, 0], [0, 0, 1], [0, -1, 0]]` keeps the pair +-i. The matrix `eig` balances the matrix before the QR iteration (the new export `balanceForEig`: a permutation that isolates eigenvalues, then a scaling by powers of 2), so `[[3, 0, 0], [1e10, 0, 1], [0, -1, 0]]` gives 3 and +-i, not 52.9, -49.9 and -0.0011. The order of the values of `eig` can change for a matrix that the permutation reorders. The QR step no longer stops when its shift is exactly 0, so `eig([[3, 1e-8, 0], [1e-8, 0, 1], [0, -1, 0]])` converges. The test that reads an eigenvalue as real uses the Gershgorin rows of the balanced active block, so `1e-5 +- i` beside 1e20 stays complex, and a coupling entry of 1e15 does not make +-i real. (Refs #1240)
- 4966096: `mannWhitneyTest` and `wilcoxon` use the SciPy default methods. The p-values now agree with SciPy. `mannWhitneyTest` uses the exact distribution when a sample has 8 or fewer values and no ties. Otherwise it uses the normal approximation with the tie correction and the continuity correction. `wilcoxon` uses the exact, the permutation or the normal method that SciPy selects, with no continuity correction. For example, `mannWhitneyTest([1, 9, 3], [2, 9, 4])` gives p = 0.8248 (it gave 0.6625), and `wilcoxon([1, 9, 3, 4], [2, 3, 1, 5])` gives p = 0.625 (it gave 0.5807). When every difference is zero, `wilcoxon` gives the statistic 0 and p = 1 for 2 to 13 differences and p = NaN for more, as SciPy does (it threw); one zero difference still throws, as SciPy raises. (Refs #1148)
- 33acba1: A distribution constructor stores each number parameter as a number. Before, a numeric string, `null`, a BigNumber or a Fraction parameter was stored as it was, so `normalDist('2', 1).mean` was the string `'2'`. Now that parameter is stored as `Number(value)`, also for the `shape` and `scale` options of `gammaDist` and for each entry of the `mean` and `cov` of `multivariateNormal`: `normalDist('2', 1).mean` is 2, and `gammaDist('3', '4')` gives the distribution of the numbers 3 and 4. (Refs #1384)
- b866b34: The bigint greatest common divisor has one implementation, `gcdBigInt` in `@danielsimonjr/mathts-core/internal`. Before, `functions` had five private copies of it, and two copies of the modular power. Now `discreteLog`, `primitiveRoot`, `multiplicativeOrder`, `rationalNullspace`, `egyptianFraction`, the integer-polynomial gcd and the `bigint` branch of `gcd` use the shared code. The values do not change. (Refs #1137)
- Updated dependencies [3b2ffe6]
- Updated dependencies [ba1fdea]
- Updated dependencies [33acba1]
- Updated dependencies [789a41a]
- Updated dependencies [aaa52d3]
- Updated dependencies [3b2ffe6]
- Updated dependencies [b866b34]
- Updated dependencies [789a41a]
- Updated dependencies [89f1ec7]
- Updated dependencies [aaa52d3]
- Updated dependencies [3b2ffe6]
- Updated dependencies [3b2ffe6]
- Updated dependencies [c12439a]
- Updated dependencies [6c87a8b]
- Updated dependencies [ba1fdea]
- Updated dependencies [b866b34]
- Updated dependencies [aaa52d3]
- Updated dependencies [89f1ec7]
- Updated dependencies [89f1ec7]
- Updated dependencies [8879eea]
- Updated dependencies [89f1ec7]
- Updated dependencies [a7c47d4]
- Updated dependencies [3b2ffe6]
- Updated dependencies [2df36db]
- Updated dependencies [aaa52d3]
- Updated dependencies [a7c47d4]
- Updated dependencies [ba1fdea]
- Updated dependencies [b866b34]
  - @danielsimonjr/mathts-core@0.30.0
  - @danielsimonjr/mathts-matrix@0.13.0
  - @danielsimonjr/mathts-parallel@0.12.1
  - @danielsimonjr/mathts-expression@0.14.2

## 0.87.0

### Minor Changes

- f1a4b33: Recurrences, series sums, node rules, `gaussQuad` and `discreteLog` check the size of their input before they loop, and throw a `RangeError` instead of running for ever or out of memory (Closes #989). Each limit is near the order where the call takes about 20 s; the list below gives the old-build time at or near each limit. Each recurrence also stops at its first `NaN` (and `besselK` and `sphericalBesselK` at their first `Infinity`), so a huge order with an overflowing argument returns at once.
  
  Also fixed:
  
  - `besselJ(n, x)` with `|x| < n` rescaled its downward sweep too late and returned `NaN` when the sweep overflowed (`besselJ(200, 5)`, `besselJ(5, 1e-10)`, `besselJ(1e7, 5)`). It now scales by a power of 2. `besselJ(n, x)` for integer `n >= 2` returns the value to about 1e-13, and 0 only when J_n is below the smallest double (`besselJ(10, 1e-10)` is `2.69e-110`, `besselJ(1e9, 5)` is `0` at once).
  - `sphericalBesselJ(n, x)` and `sphericalBesselI(n, x)` no longer allocate an array of `max(n, |x|)` elements, and no longer rescale that array on every overflow (`sphericalBesselJ(1e6, 5)` took 33.7 s and now takes 12 ms).
  - `discreteLog` keys its baby-step table by number, not by string: `p = 1e14 + 31` takes 13.8 s and 1.1 GB (26.5 s and 2 GB before).
  - `discreteLog` for a large `p` first finds the order of `g`. A base of order at most 2^24 returns its answer (`discreteLog(50154588067499, 266974891273491, 282000011339987)` is `12345` in 0.3 s to 2 s; it took 14.5 s before).
  - `zipfPMF(k, s, n)` with `n` above 1e8 sums the first 1e6 terms and an Euler-Maclaurin tail (relative error about 3e-14), so every `n` returns at once. `n` up to 1e8 gives the same value as before.
  - `binomialTest` sums only the terms within `sqrt(375 n)` of `n p`; every other term is exactly 0, so the results do not change.
  - `binomialTest` with `p` outside (0, 1) or `NaN` returns a `NaN` p-value at once (`binomialTest(5, 1e9, 1)` ran for more than 60 s and gave the same `NaN`).
  - `expn(n, x)` with a tiny `x` returns `e^-x / (n - 1)` once the recurrence stops changing; the value is bit-identical (`expn(1.2e9, 1e-300)` ran for more than 60 s).
  - `sphericalBesselK` returns 0 at two zeros in a row (`sphericalBesselK(1.8e9, 1.8e9)` took 32.8 s).
  - `siegelZ(t)` returns `NaN` at once from `|t|` about 55 (the Borwein coefficients overflow). It returned the same `NaN` before, after a time that grew with t squared.
  - `hermiteH` and `besselK` have no order limit; they return at the first `NaN` or `Infinity` (`besselK` also at two zeros in a row).
  - `gaussQuad` returns `NaN` for a `NaN` interval count.
  - `sphericalBesselY`, `sphericalBesselK` and `expn` return `NaN` for a non-number `x`.
  - `polygamma(n, x)` and the factorial in `sphericalHarmonic` return `Infinity` for a factorial above 170 at once.
  - `mathieuA`, `mathieuB`, `mathieuCe` and `mathieuSe` throw a `RangeError` (`order n must be at most 99, got 100`) where they threw a `TypeError` from an undefined mode.
  
  BREAKING (each call returned before and now throws `RangeError`; the time is the old-build time at or above the limit):
  
  - `besselJ`, `besselY` and `legendreP` with an order above 2500000000 (`besselJ(2.5e9, 5e9)` took 21.1 s, `legendreP(2.5e9, 0.5)` 29.2 s on the old build). `besselJ` with a small `x` returns 0 at any order.
  - `besselJ(n, x)` with `x <= n` (the downward sweep) when the sweep starts above order 1200000000 (`besselJ(5e8, 5e8 - 1)` took 6.0 s and returned `NaN` on the old build; `besselJ(2.5e9, 2.5e9 - 1)` did not finish in 60 s). `hankelH1` and `hankelH2` follow.
  - Each other recurrence family has its own limit (old-build time at 1e9 in brackets; the limit is below the old 20 s point where that time is under 20 s):
    - `jacobiP` above 1000000000 (19.9 s).
    - `gegenbauerC` above 1000000000 (16.5 s).
    - `ferrersP` above 1000000000 (14.9 s).
    - `laguerreL` above 1000000000 (14.7 s).
    - `expn` above 1200000000 for `0 < x <= 1` (12.7 s at 1e9). A tiny `x` exits the recurrence at once with the same value.
    - `sphericalBesselJ/Y/I/K` with an order above 1800000000, and `sphericalBesselJ/I` with `max(n, |x|)` above 1800000000 (`sphericalBesselY(1.5e9, 2e9)` took 15.9 s).
  - `chebyshevT` with an order above 4000000000 (`chebyshevT(3.5e9, 0.5)` took 17.5 s).
  - `polygamma(n, x)` with `x` below -2000000000 (a shift of 2.5e9 took 24.2 s).
  - `besselJZeros(nu, k)` with `k` above 7000000 (`k = 7.5e6` took 22.3 s) or `k * max(1, |nu|)` above 100000000 (`besselJZeros(1e8, 1)` took 22.9 s).
  - `binomialTest(x, n)` with `n` above 100000000000.
  - `rootsLegendre(n)` with `n` above 14000 (`rootsLegendre(14000)` took 20.7 s).
  - `rootsJacobi(n, a, b)` with `n` above 1300 (`rootsJacobi(1200, 0, 0)` took 14.0 s).
  - `gaussQuad(f, a, b, n)` with `n` above 800000000 (`n = 1e9` took 26.1 s with a trivial `f`).
  - `discreteLog(g, h, p)` throws when `p` needs more than 2^24 baby steps and the order of `g` is above 2^24 (or `g` and `p` share a factor). A base of smaller order still returns. A `p` above 2^53 - 1 also throws.
  - `rootsHermite(n)` and `rootsLaguerre(n)` with `n` above 500 now throw `RangeError` at once. They threw an `Error` ("root scan found ...") after 3.5 s to 14 s before, for every `n` above about 200 (`rootsHermite`) and about 450 (`rootsLaguerre`), so no returning call changes.
- e233385: Window functions, frequency grids, special matrices, sample generators, filter designs, curve fits and a few other functions check the size of the result before they allocate, and throw a `RangeError` instead of hanging or running out of memory (Refs #990). `toSamples` (not public) gives one array check to the signal and curve-fit functions. Typed arrays (`Float32Array`, `Int32Array`, `Uint8Array` and the other number typed arrays) stay accepted by the signal and curve-fit functions. `medfilt` clamps a window longer than the signal: `medfilt([1, 5, 2, 8, 3], 1e9)` gives `[3, 3, 3, 3, 3]`, the same as window 9. `stirlingS2` with a long `n` and a small `k` no longer builds a table of `n` rows, so `stirlingS2(1e6, 2)` returns `Infinity` with a small heap. A number `stirlingS2` stops when the result is `Infinity`. A BigNumber `bellNumbers` uses the Bell triangle, so `bellNumbers(bignumber(1100))` takes about 2.5 s.
  
  BREAKING:
  
  - A result of more than 100000000 elements throws `RangeError` from the ten window functions (`blackmanHarrisWindow(1e9)`), `fftfreq`, `rfftfreq`, `unitImpulse`, `firwin`, `stepResponse`, `impulseResponse`, `wiener` (window size), `histogram` (bins plus one), `parallelStatHistogram`, `rootsChebyshevT`, `rootsChebyshevU`, `chirpZTransform` (`m`), `resample` (both modes), `lowpassFilter`, `highpassFilter` and `bandpassFilter` (order), `vander`, `hilbertMatrix`, `invHilbertMatrix`, `pascalMatrix`, `helmertMatrix`, `adjacencyMatrix`, `dirichletSample`, `mvnSample`, `diag` (dense result) and `nthRoots`.
  - `dftMatrix(n)` throws above `n = 3535`, because each entry is a `Complex` object (counted as eight elements). `freqz(b, a, n)` counts eight elements for each point, so it throws above `n = 12500000`.
  - `nthRoots(x, root)` throws above `root = 12500000`.
  - `kaiserWindow(n, beta)` throws `RangeError` for `n > 1000000`.
  - `butter`, `cheby1` and `cheby2` throw `RangeError` for an order above 1000 (`butter(1e4, 0.2)` took about 38 s and returned NaN coefficients).
  - `pickRandom(array, n)` and `quantileSeq(data, N)` throw `RangeError` above 10000000.
  - `format(x, precision)`, `format(x, { precision })` and `print(template, values, precision)` throw `RangeError` for a precision above 10000000.
  - `windowFunction`, `getWindow` (classic names) and `freqz` (a number of points) throw `RangeError` for a result of more than 100000000 elements. `random(size)` and `randomInt(size)` throw `RangeError` for a size of more than 100000000 elements (`random([1e5, 1e5])`).
  - `firls(numtaps, ...)` throws `RangeError` for `numtaps > 3001`. `pascalMatrix(n)` throws above `n = 2000`, and `invHilbertMatrix(n)` throws above `n = 1000`.
  - `dirichletSample` and `mvnSample` count `k + 8` elements per sample, so `dirichletSample([1, 1], 2e7)` throws `RangeError`.
  - A BigNumber `stirlingS2(n, k)` throws `RangeError` when `(n + 1) * (k + 1)` is more than 300000 (for example `stirlingS2(bignumber(1000), bignumber(998))`). Below that limit, a BigNumber `stirlingS2(n, n)` returns BigNumber 1 (it returned number 1); above it, for `n > 546`, it throws.
  - `bartlettPSD(5)`, `welchPSD(5)`, `multiTaperPSD(5)`, `goertzel(4, 1, 8)`, `chirpZTransform(5, 3)`, `resample(5, 4)` and `polymul(3, 3)` threw nothing before and now throw `TypeError` (`signal must be an array or a typed array`). A number argument used to become an array of zeros. `newtonInterp(2, 2, 1)`, `polyFit(2, 2, 1)`, `chebyshevFit` and `legendreFit` with number arguments threw a different error before (duplicate x-values or a rank-deficient system) and now throw the `TypeError`. A Matrix, a string, a `Set`, a `BigInt64Array`, an array-like object, `null` or `undefined` also throws `TypeError` (a Matrix, `null` or `undefined` used to give an empty or NaN result). An `ArrayBuffer` or a `DataView` also throws: an `ArrayBuffer` used to be read as a Float64Array (`goertzel(buffer, 2, 8)` gave a result); pass `new Float64Array(buffer)` instead.
- 64c9721: `matrix` throws `TypeError` for input that is not matrix data, as mathjs does (Fixes #1252, Fixes #1272).
  
  - A scalar (`matrix(5)`, `matrix(bignumber(5))`, `matrix(complex(1, 2))`) throws `Unexpected type of argument in function matrix`. Before, `matrix(5)` returned a dense matrix with no `_size`, so `qr`, `lup`, `eigs`, `schur`, `trace`, `lusolve`, `det`, `inv`, `sqrtm` and `expm` threw unrelated `TypeError`s such as `Cannot read properties of undefined (reading 'length')`.
  - A storage object needs Array `data` and Array `size` on the dense path. On the sparse path it needs Array `data` and `size`, or CSC `index`, `ptr` and `size` (the `values` can be null for a pattern matrix). Before, `matrix({ size: [2] })` built a matrix with `_data` undefined, `matrix({ data: 5, size: [1] })` kept `_data` 5, and a CSC object on the dense path built a dense matrix with no data. The `MathJSDenseMatrix` constructor checks the same rule.
  - A format string as the first argument, other than `'dense'`, `'sparse'` or `'default'`, throws `Unknown matrix type "<format>".`. A boolean is read as a format string, as in mathjs (`matrix(false)` throws `Unknown matrix type "false".`).
  
  BREAKING:
  
  - `matrix(0)`, `matrix(NaN)`, `matrix(null)`, `matrix(false)`, `matrix('')` and `matrix('foo')` returned an empty dense matrix and now throw. `matrix(0, 'sparse')`, `matrix(null, 'sparse')` and `matrix(false, 'sparse')` returned an empty sparse matrix and now throw. Use `matrix()` or `matrix('sparse')` for an empty matrix.
  - The functions that pass a format to `matrix` throw `Unknown matrix type` for an unknown format string. Before, they used the dense format: `zeros(2, 2, 'foo')`, `zeros('foo')`, `ones(2, 'foo')`, `identity('foo')`, `identity('')`, `rotationMatrix('foo')`, `rotationMatrix('')` and `matrixFromFunction([2, 2], 'foo', f)`.
  - `matrix(0)` throws through `evaluate` and through the compat instance (`math.matrix(0)`) too. The compat `zeros`, `ones` and `identity` have their own code and are unchanged.
  
  No non-breaking fix exists: any result that does not throw keeps the silent coercion of an invalid argument, and mathjs 15.2.0 throws for each of these calls. `matrix()`, `matrix([])`, `matrix('dense')`, `matrix('sparse')`, `matrix('default')`, array input, a Matrix and the internal `{ data, size }` and CSC storage objects are unchanged. A second argument that is not a known format (`matrix([[1]], 'foo')`) is still read as dense (#1284). The sparse-constructor scalar case of #1272 (`new MathJSSparseMatrix(5)`) is fixed by #1263.
- 8e50670: Integer sequences and number-theory functions return their saturated value, or throw a `RangeError`, for a huge argument. Before, they looped for ever or ran out of memory (Refs #989). Where a value rounds to `Infinity` for a smaller argument, the function now returns `Infinity` for every larger argument at once: `lucasL(n)` above 1474, `subfactorial(n)` above 170, `doubleFactorial(n)` above 300, `partitions(n)` from 79446, `motzkin(n)` above 654, `schroder(n)` above 407, `pell(n)` above 806, `tribonacci(n)` above 1167, `delannoy(m, n)` when `min(m, n)` is 405 or more, `lahNumber(n, k)` when `n - k` is above 170, `narayana(n, k)` when `min(k, n + 1 - k)` is 262 or more, `eulerianNumber(n, k)` for `n` from 1024 and `1 <= k <= n - 2`, and `bernoulli(n)` for an even `n` above 258 (the sign is `-Infinity` when `n / 2` is even, else `Infinity`). `bernoulli(n)` for an even `n` from 652 returned `NaN` and now returns the signed infinity. `harmonicNumber(n)` above 100 uses the series `ln n + γ + 1/(2n) − 1/(12n²) + 1/(120n⁴) − 1/(252n⁶)`; the value moves by up to 2.7e-12 toward the exact value. `risingFactorial` and `fallingFactorial` return as soon as the product is `NaN` or zero; after an infinity they read the sign and any zero of the remaining factors from `x` and `n`, so a call with a huge `n` returns at once. `combinations` and the factory `combinations` return `Infinity` as soon as the product overflows, so `catalan(2e7)` and `composition(3e7, 1.5e7)` return `Infinity` (they returned `NaN` after seconds; both exact values are above the largest double). `eulerNumbers(n)` stops the recurrence at index 188 and fills the rest with the values it gave before: `NaN` at an even index and 0 at an odd index. `bernoulliPolynomial(n, x)` and `eulerPolynomial(n, x)` return `NaN` at once for `n` above 10000 (the sum is `NaN` from degree 262). `mertens` uses a linear sieve. `prime` and `primePi` use a segmented sieve. `primorial` multiplies its primes in a balanced tree. `integerSqrt` uses a bigint Newton iteration, so `integerSqrt(10n ** 60n)` returns `10n ** 30n` at once; a number argument is floored, and a number below 2 now returns a bigint (`integerSqrt(1)` is `1n`, `integerSqrt(0.5)` is `0n`). `pellSolve(1000000017)` returns its 15570-digit solution in about 0.1 s.
  
  New limits, each for a call that ran for minutes or did not return before:
  
  - `prime(n)` and `primePi(n)` throw `RangeError` when the sieve limit is above 1e9: `prime(n)` for `n` above 48607823, `primePi(n)` for `n` above 1e9 (`primePi(1e9)` took 27 s and now takes about 8 s).
  - `divisors(n)` and `divisorSigma(n, k)` throw `RangeError` when `sqrt(n)` is above 2e9 (`divisors(1e308)`); `divisors(1e18 + 2 ** 10)` still returns its 44 divisors (about 14 s).
  - `mertens(n)` throws `RangeError` for `n` above 100000000 (`mertens(1e9)`).
  - `primorial(n)` throws `RangeError` for `n` above 10000000.
  
  BREAKING (each call returned a value, or ran for a very long time, before):
  
  - The factory `combinations` throws `RangeError` when `n` is not a safe integer, so `composition(1e308, 3)` throws. The exported typed `combinations(1e308, 3)` already returned `Infinity` and still does.
  - `integerPartitionsGen(n)` throws `RangeError` for `n` above 70 (`n` from 71 returned a list of more than 4 million partitions).
  - `fareySequence(n)` throws `RangeError` when `3 n²` exceeds 100000000 (`n` above 5773).
  - `pellSolve(d)` throws `RangeError` when the continued fraction of `√d` needs more than 100000 steps (`pellSolve(2 ** 53 - 1)`).
  - `egyptianFraction(p, q)` throws `RangeError` when `floor(p / q)` is above 10000000 (`egyptianFraction(3e7, 1)` returned 3e7 ones after 5.2 s).
- 4cb2099: `quantileSeq`, `ptp`, `iqr` and `histogram` follow the NaN policy of `mean`, `median` and `describe` (Fixes #1098). NaN propagates by default. `{ skipNaN: true }` or `{ skipna: true }` omits NaN and keeps `±Infinity`. `quantileSeq` takes the option in its options object, also with an array of probabilities and with BigNumber data or probabilities. `ptp(x, opts)`, `iqr(x, opts)` and `histogram(x, bins, opts)` take it as the last argument. A last argument that is not an object is ignored, so `rows.map(ptp)` works as before.
  
  `quantileSeq` interpolates as NumPy `_lerp` does, so `quantileSeq([-Infinity, Infinity, 2, 3], 0.25)` is `-Infinity` and not `NaN`, and `describe` gives the same `q25`. A result can change by a few units in the last place, up to 8 measured, and the new value is the NumPy value (`quantileSeq([3, -1, 5, 7, 2], 0.25, 'median_unbiased')` was 1, is 1.0000000000000002, as NumPy). `histogram` with an infinite value throws `Error`; it returned NaN edges before. `histogram` has no range option, so NaN or an infinite value always makes the range not finite (the `numpy.histogram` error for an automatic range).
  
  BREAKING:
  
  - `quantileSeq` and `iqr` with NaN return `NaN` (`quantileSeq([1, NaN, 2, 3], 0.75)` was 2.25). This includes `sorted: true` (`quantileSeq([1, 2, 3, NaN], 0.5, true)` was 2.5) and Matrix data.
  - `ptp` with NaN is `NaN` at any position (`ptp([1, NaN, 2, 3])` was 2; `ptp([1, NaN, Infinity])` was `Infinity`).
  - `histogram` with NaN throws `Error`. Before, it dropped the NaN, or returned zero counts and NaN edges when the NaN came first. Pass `{ skipNaN: true }` to count the other values.
- 0c767ba: `zeros`, `ones`, `identity`, `range`, `resize`, `hadamardMatrix`, `stirlingS1`, `stirlingS2` and `bellNumbers` check the size of the result before they allocate, and throw a `RangeError` instead of hanging or running out of memory (Refs #990). `functions/src/utils/limits.ts` holds the shared `assertAllocSize` and `assertLoopOrder` checks.
  
  BREAKING:
  
  - A dense result of more than 100000000 elements throws `RangeError` (`zeros(100000, 100000)`, `identity(1e6)`, `range(0, 1e9)`). A sparse result is not limited.
  - `stirlingS1` with `n >= 10000` throws `RangeError` (`n = 9999` still returns, after about 2 s).
  - `hadamardMatrix(16384)` and larger throw `RangeError` (`hadamardMatrix(2**32)` says the result is too large). `hadamardMatrix` also rejects a non-safe-integer `n` (`1e308`) as not a power of 2.
  - `bellNumbers(n)` returns `Infinity` for a number `n > 218`.
  - `resize` and `matrix.resize` throw `RangeError` above the limit. This includes a string (`resize('ab', [1e9])`) and a size with a zero dimension (`resize([1], [1e9, 0])`).
  - `stirlingS2(n, k)` throws `RangeError` when `(n + 1)(k + 1)` exceeds 100000000.
  - `bellNumbers` with a BigNumber `n` above 2000 throws `RangeError`.
  - `range` with bigint bounds throws `RangeError` above the limit (`range(0n, 10n ** 12n)`).

### Patch Changes

- a0945d9: The WASM Bessel kernels use the same limits and early exits as the JS path (Fixes #1113). `bessel_jn_f64` has the zero bound, the power-of-2 rescale and the downward-sweep limit of `besselJ`. `bessel_jn_f64` and `bessel_yn_f64` stop at the first NaN. `besselJ` and `besselY` on a `Float64Array` send only an integer order in the kernel range to the kernel. Every other order stays on the JS path, which returns the JS value or throws the JS `RangeError`. Before, an order above 2147483647 wrapped to another order. Where |x| ≤ |n| the kernel result is bit-identical to the JS result, except the sign of a zero result at the edge of the zero bound. Where |x| > |n| it agrees to 1e-11 relative away from a zero of J_n, because the J0 and J1 kernels differ from JS by up to 2 ulp. The raw WASM exports `chebyshevT`, `hermiteH`, `laguerreL` and `legendreP` return NaN for a non-finite order, stop at the first NaN, and abort with an `Error` above 2147483646 (`laguerreL`: 1000000000). Before, they looped without end at 2147483647.
- f97d51c: `discreteLog` returns a small answer for a modulus above 2^48 and uses less memory for the baby-step table (Fixes #1136, Fixes #1135).
  
  - #1136: `discreteLog(3, 9, 2**53 - 111)` and `discreteLog(6, 36, 9007199254740898)` threw a `RangeError`. They now return 2. The function walks the powers of g once: it returns j at the first `g^j === h`, returns -1 when the walk returns to 1, and throws after 2^24 steps.
  - #1135: the baby-step `Map` of 2^24 entries is a typed-array table (open addressing, two `Uint32Array`s, 8 bytes per slot: a 32-bit hash of the value and the step). `MAX_BABY_STEPS` stays 2^24. Measured with one `node` process per call, back to back: `discreteLog(3, 5, 2**48 - 59)` is 2.3 to 2.9 times faster (32.3 s to 14.0 s at the lowest machine load), and the peak resident memory of a process that loads this function alone goes from 1058 MB to 331 MB. The peak is about 480 MB in a process that loads the full package. The results are equal.
  - The baby steps stop when the powers of `g` return to 1. `discreteLog(2, 11, 2**48 - 1)` (the order of 2 is 48) took 5.8 s and now takes less than 0.1 s.
- 354d57b: `discreteLog(g, h, p)` now solves `g^x = h (mod p)` when `g` and `p` share a factor. It divides the common factors out of `p` and `h`, then runs baby-step giant-step on the reduced modulus. Before, it returned a wrong value. For example, `discreteLog(2, 6, 10)` returned `5` and now returns `4`; `discreteLog(0, 2, 6)` returned `4` and now returns `-1`. A target that shares a factor with the reduced modulus has no solution, so the function returns `-1` and no longer throws a `RangeError` for a large modulus (`discreteLog(6, 0, 2^53 - 1)`). An input that threw a `RangeError` only because `g` and `p` share a factor now returns a value. The `RangeError` stays when the reduced modulus `N` needs more than 2^24 baby steps (`N - 1 > 2^48`) and the order of `g` modulo `N` is above 2^24. Its message now names the caller's `p` and the reduced modulus.
- c0222fa: `lusolve` of a 3-D Array `A` of numbers throws `RangeError: Matrix must be two dimensional (size: [2, 2, 1])`, as it already did for Complex, BigNumber and bigint entries, a DenseMatrix and `lup` (Refs #1247). Before, `lusolve([[[2], [0]], [[0], [1]]], [1, 2])` returned `[[0.5], [2]]`, because the number fast path read a nested Array entry as a number row. A 3-D `b` and every 3-D input of `lsolve`, `usolve`, `lsolveAll`, `usolveAll` and `lup` threw before and still throw.
  
  Every Array `A` whose depth is not 2 now throws before the right-hand side and square checks: a 4-D `A` and `[[[]], [[]]]` throw the two-dimensional `RangeError` (before, `[[[]], [[]]]` threw `lu: matrix must be square (got 2×1)`), and an `A` of mixed depth such as `[[2, 0], [0, [1]]]` throws `TypeError: Matrix decomposition: jagged nested array at row 1` (before, it returned `[[0.5], [2]]`). The check runs only on the typed path, so the number fast path does no extra pass.
- 5b09394: `describe` gives NaN in every field except `nobs` when the input holds a NaN. Before, a NaN gave wrong values in some fields only. `nobs` is the input length. The new option `{ skipNaN: true }` (or `{ skipna: true }`) drops the NaN values first and gives `describe` of the values that remain (`Infinity` is kept). `nobs` counts them. Options that are not a plain object, and unknown options, throw `TypeError` (#1004).
- 6b4e603: A matrix with a very large or very small largest entry is now scaled by an exact power of 2 in `schur`, `qr`, `lq`, `rq`, `ql`, `qrPivoted`, `svd`, `singularValues`, `norm2`, `cond`, `pinv`, `lowRankApprox`, `sqrtm`, `logm` and `condest`, and the result is scaled back (Fixes #1104). `schur([[1, 1e160], [1e160, 1]])` returned NaN; its diagonal is now 1e160 and -1e160 to 15 digits, as in SciPy.
  
  Each routine has a window for the largest entry: 2^±128 for `schur`; 2^-400 to 2^128 for the `svd` family; 2^-20 to 2^128 for `logm`; 2^-20 to 2^400 for `qr`, `lq`, `rq`, `ql` and `sqrtm`; 2^±400 for `qrPivoted` and `condest`. A matrix inside its window takes the same path as before, with bit-identical results. One exception: `sqrtm` of a non-symmetric matrix with a largest entry above 2^256 now gets a scaled Schur step, so its result changes. A larger matrix is scaled to the top of the window. A smaller matrix is scaled to [1, 2).
  
  `logm` of a matrix with a largest entry above 2^128 can change from the 12th digit. Inside the window the absolute cutoffs still apply: `sqrtm` treats a matrix as symmetric when its entries differ by at most 1e-8. In a scaled `svd`, a singular value below about 2^-660 of the largest one can become 0: `svd(diag(1e200, 1, 1e-200))` returns `[1e200, 1, 0]`. When the scale would lose a nonzero entry and the unscaled result is finite, the unscaled result is kept. `logm` of a matrix with complex eigenvalues and a largest entry below 2^-20 now throws, as it already did for the same matrix at unit scale; before, it returned a value.
  
  `normFro`, `DenseMatrix.norm`, `SparseMatrix.norm` and `norm(A, 'fro')` of `[[1e200, 1e200]]` return `1.414e200` instead of `Infinity`, and the norm of a matrix of 1e-200 entries is no longer 0. `lstsq` no longer overflows or underflows when the scale of `b` is subnormal or very large.
- c5ea0d7: `eig` and `eigvals` scale the matrix by a power of 2 before the QR iteration, so a matrix with entries above about 1e154 or below about 1e-146 gives correct eigenvalues. Before, `eig([[1,1e154,0],[1e154,4,1e154],[0,1e154,9]])` and `mathieuA(3, 1e200)` never returned, a nonsymmetric matrix at that scale gave NaN, and a tiny matrix gave wrong values. A non-finite eigenvalue throws a RangeError ("eig: an eigenvalue is not finite"), and the QR iteration throws a RangeError ("eig: QR iteration did not converge") after `maxIterations` iterations for one eigenvalue (default 1000; the option was ignored before). `eigs` throws the RangeError of the native solver for a non-finite entry, where it returned NaN or never returned. Trade: the scaling brings the largest entry into range, so a value far below it can go to zero: `eigvals([[1e300,0],[0,1e-300]])` gives `[1e300, 0]`, not `[1e300, 1e-300]` (#989).
- b1977e7: Brand-based type tests accept a value of a second copy of core (#1033). The typed `sum` keeps Complex, BigNumber and Fraction values exact, sums nested arrays and matrices in the pairwise kernel, and sums along a dimension (#1039). The typed `min` and `max`, and `mean`, `variance` and `std`, keep exact types; complex variance uses the conjugate. A 1-D sparse matrix is a column vector. The typed `dot` keeps exact types and conjugates its first argument. A 1-D Matrix keeps its shape when it converts to an Array. New core exports: `pairwiseSumChecked`, `sumSquaredDeviationsChecked` and `pairwiseDotChecked`.
- 03b5d7a: `summation` and `symbolicProduct` throw a `RangeError` when a bound is not an integer. Before, `summation('i', 'i', 1.5, 3)` returned 4 (it added 1.5 and 2.5) with no error (#1000). A bound larger than 2^53 - 1 in magnitude also throws a `RangeError`; before, such a call never returned.
- 1dec729: `slu` of a non-empty non-square sparse matrix throws `RangeError: Matrix must be square (size: [m, n]); use lup for a rectangular matrix` for every order (Fixes #1226). The CSparse LU is square-only. The order and threshold checks still run first, and the empty-matrix factorization is unchanged. `lusolve(A, b, order, threshold)` of a non-square sparse `A` now throws the solver error `RangeError: Matrix must be square (size: [m, n]); for a rectangular least-squares system use lstsq` before it calls `slu`. That is the error of `lusolve(A, b)` of a non-square sparse `A`. This shape check runs before the order check and the threshold check.
  
  Prior result, for `threshold` 1:
  
  - 2x3 and 1x3 input: orders 0, 1 and 3 threw `Cannot read properties of null (reading 'L')`. Order 2 threw `Cannot set properties of undefined (setting '0')`.
  - 3x2 and 3x1 input: orders 0, 1 and 3 threw `Unexpected type of argument in function divideScalar` (actual: undefined). Order 2 threw `Cannot set properties of undefined (setting '0')`.
  - Order 2 throws the same `Cannot set properties of undefined` error for a small square input (1x1, 2x2, 3x3, a full 6x6). That result is unchanged. A larger non-square input at order 2 (6x9, 9x6) threw the errors of orders 0, 1 and 3.
  - `lusolve(A, b, order, threshold)` of a 2x3 sparse `A` threw `TypeError: Cannot read properties of null (reading 'L')`.
- d297c16: Internal refactor, no change in behaviour (Refs #1212). The matrix `qr` and `qrPivoted` scale R back with the shared `scaleDense` helper in `operations/common.ts`, which the WASM backend also uses. The functions `qr` runs its number path and its Complex path through one scaled call.
- ab37729: Fix the edge inputs of the FFT family (Fixes #1010, Fixes #1090).
  
  - `fft([5])` returned the bare number `5`. It returns one Complex bin, `5 + 0i`, like longer inputs (also `ifft([5])`). A one-element BigNumber, Fraction or numeric string input also gives a Complex bin. A one-element Unit stays a Unit.
  - `ifft(x, n)` threw `Too many arguments`. It takes `n` as NumPy does: the spectrum is cropped or zero-padded to `n` bins (`ifft([1,2,3,4], 2)` is `[1.5, -0.5]`; `n = 6` gives 6 bins). `n` must be a positive integer, and only a 1-D input is supported.
  - `fft([NaN, 1, 2, 3])` gave NaN real parts but imaginary parts `0, 2, 0, -2`, while 64 or more values gave NaN in both parts. A NaN in either part of any input (a number, a Complex or a BigNumber) now makes every bin NaN in both parts, for every length. NumPy keeps the imaginary parts at small lengths, so this differs from NumPy there. Infinity is outside this rule: the parts of a bin next to an infinite input are not specified.
  - `rfft(matrix)` threw `RangeError`, and `rfft([[...],[...]])` returned `undefined` rows. `rfft` takes a Matrix, a typed array and nested arrays, and transforms the last axis (`rfft([[1,2,3,4],[5,6,7,8]])` is `{ re: [[10,-2,-2],[26,-2,-2]], im: [[0,2,0],[0,2,0]] }`). A ragged array throws a `DimensionError`, as `fft` does. The type of `rfft(matrix)` and `rfft(Float64Array)` is `{ re: unknown; im: unknown }`, not `number[][]`.
  - `irfft` returned NaN values for a Matrix half-spectrum. Each part can be an array, a typed array or a Matrix.
  - `fftn([1,2,3,4])` and `fftn(matrix)` threw `TypeError`. `fftn` takes 1-D and N-D input and a Matrix, and returns plain arrays (`fftn([1,2,3,4])` equals `fft`).
  - `periodogram([])` threw `RangeError`. It returns `{ psd: [], frequencies: [] }`, as SciPy does. `periodogram([5])` threw `RangeError`; it is `{ psd: [25], frequencies: [0] }`.
  - `periodogram` with an `nfft` that is not a power of two, or shorter than the signal, threw `RangeError`, gave NaN bins or used the whole signal. Any positive integer `nfft` now works, and a longer signal is cropped to `nfft` samples, as SciPy does. The values equal `scipy.signal.periodogram` with `detrend=False` and the symmetric Hann window (`hann(n, sym=True)`); the SciPy defaults (a boxcar window, constant detrend) give other values. An `nfft` that is not a positive integer throws a `RangeError`. `periodogram(matrix)` threw an accidental `RangeError`; it throws a `TypeError` that names `periodogram`. A typed array is accepted. A nested array gave NaN bins; it throws that `TypeError` too.
  - `multiTaperPSD([])` returned `{ psd: [0], frequencies: [NaN] }` and `multiTaperPSD([5])` returned two entries, the second NaN. An empty signal returns `{ psd: [], frequencies: [] }`, and one sample throws a `RangeError`. An odd `nfft` gave one bin too many, a NaN; the result has `floor(nfft / 2) + 1` bins.
  - `fft2d([])` threw `TypeError` and `fft2d([[]])` returned a padded 1x1 result. Both keep their input shape. `fft2d(matrix)` threw an accidental `TypeError`; it throws `TypeError: fft2d: expected a 2-D array`. A 3-D input gave NaN, and rows of unequal length gave NaN or a cropped spectrum: a 1-D or 3-D input throws that `TypeError`, and unequal rows throw a `RangeError`.
  - `dotDivide([[[]],[[]]], 2)` returned `[[0],[0]]`. It keeps the shape `[[[]],[[]]]`, as mathjs does: a matrix made from a nested array now records the size of every axis (`matrix([[[1,2]],[[3,4]]]).size()` is `[2, 1, 2]`; it was `[2, 1]`), and its `get`, `set`, `map`, `forEach`, `clone` and `toArray` use every axis. `map` keeps the size of the matrix when the callback returns an array. An empty `matrix()` has size `[0]` (it was `[0, 0]`), as in mathjs.
  - `conj(matrix([1,2]))` returned a plain Array. It returns a Matrix, as mathjs does.
  - The `ifft(arr, n)` signature is in the type declarations.
- 52f96d8: `eigs` on a BigNumber or Complex cyclic permutation matrix converges, and the general solver no longer reads small entries as zero (Fixes #1202).
  
  Result before this change, for the 3x3 cyclic permutation matrix times 2^e:
  
  - BigNumber and Complex, e = 0, -20, 40: threw "The eigenvalues failed to converge".
  - BigNumber and Complex, e = -40, -60: returned the eigenvalues 0, 0, 0.
  - BigNumber and Complex eigenvectors: the same failures.
  - BigNumber `[[1, 2], [3, 4]]` times 2^-50: wrong eigenvalues.
  - number matrix: correct (unchanged).
  
  Result now: the eigenvalues are the cube roots of unity times 2^e, and `A v = lambda v` holds, at every scale above.
  
  Result now: a small block beside a huge entry keeps its own eigenvalues. For example, `[[1e20, 0, 0], [0, 1e-5, 1], [0, -1, 1e-5]]` as BigNumber or Complex gives `1e-5 + i`, `1e-5 - i` and `1e20`, and `A v = lambda v` holds.
  
  Causes: the QR iteration of `complexEigs` used the corner entry as the shift, and that shift is 0 for a cyclic matrix, so the matrix never changed. It now takes an exceptional shift every tenth step without convergence. The balance, Hessenberg, deflation, eigenvector and symmetry tests compared entries with absolute tolerances (and the fuzzy `equal`, `smaller` and `larger`, which treat a difference below `absTol` as zero). Each test is now relative to the entries that it compares:
  
  - symmetry: `|a_ij - a_ji| <= precision * max(|a_ij|, |a_ji|)` for each pair.
  - real entries: `|im(a_ij)| <= precision * |a_ij|` for each entry.
  - deflation: the LAPACK `dlahqr` test, relative to the two diagonal entries beside the subdiagonal entry.
  - Hessenberg reduction: only a column of exact zeros skips the elimination.
  - equal eigenvalues and the 2x2 Jordan blocks: relative to the values, and to the largest entry of the block.
  - eigenvector solves: a diagonal entry is exact zero where it matches the eigenvalue, and each other row is divided by its diagonal entry.
  
  Routing change: with the default precision, or a precision given as a number, a BigNumber or Complex matrix whose pairs differed by 1e-14 to 1e-12 went to the general solver; it now goes to the symmetric solver when each pair differs by at most `precision` times its own size, as it already did for a precision given as a BigNumber. For `[[1,2],[2+1e-13,3]]` the eigenvalues move by 4.4e-14, and a Complex matrix whose imaginary parts are within `precision` of the entry sizes returns numbers, not Complex values.
  
  Not fixed: a defective matrix with small entries still returns false eigenvectors (#1242), and a symmetric BigNumber matrix with small entries still returns its diagonal (#1243, `realSymmetric.ts`).
- fbc5277: `BigNumber` `add`, `subtract` and `multiply` round the result to `config.precision` with the configured rounding mode, as decimal.js and mathjs do. Before, the square of a 64-digit value had up to 128 digits, and `add(bignumber('1'), bignumber('1e-30'))` at precision 20 gave `1.000000000000000000000000000001` (now `1`). A repeated product no longer grows without bound: a stage value inside a BigNumber `solveODE` step had 515 digits. An integer `pow` runs its products with guard digits and rounds once. Constructors, `negate` and `abs` keep every digit. Integer arithmetic beyond the precision loses digits, as in mathjs and decimal.js: `add(bignumber('1e30'), bignumber('1'))` at precision 20 gives 10^30 (the 1 is lost), and `factorial(bignumber(60))` at precision 64 has 64 significant digits. `mod` is exact and does not round, so `gcd` and the floored factory `mod` stay exact for integers longer than the precision. `xgcd`, `invmod` and `isPrime` raise the precision for their integer steps. `lcm`, `combinations` of the factory layer (with `composition` and `catalan`), `bellNumbers`, `factorial` and `gamma` of an integer run their steps with guard digits and round the result one time: a result that fits the precision is exact. `log1p`, `asinh`, `acosh`, `atanh` and `acos` keep a small argument and a result near 0 (`log1p(bignumber('1e-40'))` is 1e-40, not 0; `asinh` of a large negative value is finite). The `engineering` notation of `format` keeps every digit of a value. `compare` and `mod` of two values with the same large exponent build no long string. The release is a patch because the documented contract is `config.precision`. Results of more than `precision` digits were a defect, not a feature (Fixes #1118).
- f88c4bc: multiply and pinv of a matrix with a Complex entry no longer throw (#1040).
- 4c361f5: `rankdata`, `spearman`, `spearmanr`, `wilcoxon`, `kruskalWallis`, `mannWhitneyTest`, `friedmanTest`, `wassersteinDistance`, `unwrapPhase`, `kolmogorovSmirnov2Test`, `fisherExact` and `peakWidths` return or throw on NaN, Infinity or an invalid index instead of running forever, and `theilSen` and `rankBiserial` return NaN for NaN input (Fixes #979). The tie scans did `while (a[j] === a[i])` from `j = i`, and `NaN === NaN` is false, so the index never moved. `unwrapPhase` subtracted `2*pi` from an infinite step for ever.
  
  - `rankdata([3, 1, NaN])` returns `[NaN, NaN, NaN]` (SciPy `nan_policy='propagate'`). It did not return before.
  - `spearman([1, NaN, 2, 3], [1, 2, 3, 4])` returns `NaN`. `spearmanr` returns `{ coefficient: NaN, pValue: NaN }`.
  - `wilcoxon([1, NaN, 3, 4], [2, 3, 1, 5])` returns `NaN` for `statistic`, `pValue` and `zStatistic`.
  - `kruskalWallis`, `mannWhitneyTest`, `friedmanTest` and `wassersteinDistance` return `NaN` for a sample with NaN. They did not return before.
  - `kendallTau`, `kendalltau` and `kendallTauTest` return `NaN` for NaN input. Before, the NaN pairs were skipped and `kendallTau([1, NaN, 2, 3], [1, 2, 3, 4])` gave `0.5`.
  - `unwrapPhase([Infinity, 1, 2, -Infinity])` returns `[Infinity, NaN, NaN, NaN]` (NumPy: `[inf, nan, nan, nan]`). `unwrapPhase([1, NaN, 2])` returns `[1, NaN, NaN]`. A finite difference between a sample and the previous unwrapped value that is larger than `2*pi * 2^20` (about `6.59e6`) is reduced with one exact remainder, so `unwrapPhase([0, 1e300])` returns at once. Results for smaller differences do not change.
  - `kolmogorovSmirnov2Test([1, NaN, 2, 3], [1, 2, 3, 4])` returns `{ statistic: NaN, pValue: NaN }`, also for a NaN in the second sample. It did not return before. Infinity stays an ordinary value: `kolmogorovSmirnov2Test([1, Infinity, 2, -Infinity], [1, 2, 3, 4])` is `{ statistic: 0.25, pValue: 1 }`.
  - `fisherExact` throws a `RangeError` unless every table entry is a finite number `>= 0`. Before, `fisherExact([[Infinity, 0], [0, 5]])` did not return, and `[[NaN, 1], [2, 5]]` and `[[-1, 1], [2, 5]]` returned `pValue: 0`. SciPy also raises for a negative entry. A finite table whose loop did not end also throws a `RangeError`: the loop counter does not move above `2^53`, so `fisherExact([[1e300, 0], [0, 5]])` and `[[2 ** 60, 3], [4, 5]]` did not return before. Other tables do not change.
  - `peakWidths` throws a `RangeError` (`peakWidths: peak <k> is not a valid index for x`, where `k` is the position in `peaks`) unless each index is an integer in `[0, x.length)`. Before, `peakWidths([1, 3, 1], [Infinity])` did not return, and `[7]`, `[-1]` and `[1.5]` returned `[0]`, `[NaN]` and `[0]`.
  - `theilSen([1, NaN, 2, 3], [1, 2, 3, 4])` returns `{ slope: NaN, intercept: NaN }`. Before, the NaN pairs were dropped and the slope was `1.75`. A NaN in `y` gives the same result.
  - `rankBiserial([1, NaN, 2, 3], [2, 3, 4, 5])` returns `NaN`. Before, it gave `-0.75`, and `0.25` with the samples swapped.
  
  Other functions that still give a silent value for NaN input are tracked in #1146.
- 3f8840c: `solveODE` checks `tspan` once, for every method (#991). Before this change, RK23 and RK45 checked the shape of `tspan`, but Rosenbrock, RODAS, BDF and Radau read only `tspan[0]` and `tspan[1]`. So `solveODE(f, [1, 0, 0], [0, 40], { method: 'Radau' })` hung. Now every method throws the RK45 text as a `TypeError` for a `tspan` that is not two numbers, and throws `"tspan" must contain finite numbers` as a `RangeError` for a NaN or Infinity entry. Before, a NaN entry returned a silent one-point result, and an Infinity entry ran into the step cap.
  
  Every method now applies one contract to non-finite data. A NaN or Infinity in `y0` throws a `RangeError` (`"y0" must contain finite numbers`) before `f` is called. A non-finite value of `f` at an accepted point, the start point included, throws `solveODE <method>: the derivative is not finite at t=<t>`. A non-finite trial step (a stage outside the domain of `f`) is rejected and the step shrinks, so `y' = -sqrt(y)` now reaches its true end value. When the step cannot shrink further, the run throws `solveODE <method>: step size underflow at t=<t>`. Behaviour changes: a non-finite `y0` throws (before, the NaN propagated or the loop spun); an Infinity from `f` throws; a bad `events` entry throws a `TypeError` before `f` runs; `stiffODESolver` rejects a non-finite `y0`; `solveODESystem` throws a `TypeError` for a `tspan` that is not a finite numeric pair; `solveParabolicPDE` rejects `T = Infinity`; BDF and Radau use the common step size underflow text in place of "Required step size is less than spacing between numbers".
- 4304ad1: `BigNumber.isInteger()` returns false for NaN and Infinity. `gcd` and `lcm` of a BigNumber that is not an integer throw as mathjs does, where they never ended. `nthRoot` of a BigNumber with root 0 throws "Root must be non-zero". `permutations(n, k)` with n above 2^53 ends (#1002). `permutations(n, 0)` is 1 for every n, where mathjs returns n when `n + 1 === n`, and each factor above 2^53 has one rounding. `gcd` and `lcm` of a number that is not an integer (NaN, Infinity, 2.5) throw the mathjs error, where they returned NaN or a snapped value. Because a BigNumber NaN is not an integer, `pow` of a negative BigNumber with a NaN BigNumber exponent gives Complex NaN, and `gamma` and `factorial` of a BigNumber NaN give Infinity, as in mathjs.
- e6c3657: `lusolve` keeps Complex, BigNumber and Fraction entries of an Array `A` or of `b`. The packed Float64 factorization read every entry as a number, so it dropped the imaginary part and the type. An entry that is not a number now takes the typed path, as a DenseMatrix or SparseMatrix `A` already did. A string entry is still read as a number, as in mathjs. Number input is unchanged (Fixes #1219).
  
  Result before the fix:
  
  - `lusolve([[i, 0], [0, 1]], [1, 1])` gave `[[1], [1]]`. It now gives `[[-i], [1]]`.
  - `lusolve([[1, 2], [3, i]], [1, 2])` gave `[[0.6], [0.2]]`. It now gives a Complex solution with `A x = b`.
  - `lusolve([[2, 1], [1, 3]], [complex(5, 1), 10])` gave `[[1.0594...], [2.9801...]]`. It now gives `[[1 + 0.6i], [3 - 0.2i]]`.
  - BigNumber and Fraction entries in an Array `A` or `b` gave a number, such as `0.019999999999999997`. They now give BigNumber `0.02` and Fraction `6/35`.
  - DenseMatrix `A`, SparseMatrix `A` (with and without order and threshold) and `lup` or `slu` factor objects already kept the Complex values.
  - A bigint entry in an Array `A` threw `Cannot convert a BigInt value to a number`, and a bigint entry only in `b` threw `Cannot mix BigInt and other types, use explicit conversions`. The system now solves on the typed path and gives a number solution, such as `[[1], [0.5]]`.
  - The shape errors of an Array `A` do not change with the entry type. A ragged `b`, a `1 x n` `b`, an Array entry of a vector `b` or a `b` of the wrong length throws `RangeError: Dimension mismatch`. A ragged `A` throws `TypeError: Matrix decomposition: jagged nested array at row k`. A non-square `A` throws `Error: lu: matrix must be square (got r×c)`. A 1-D `A` throws `TypeError: Matrix decomposition expected ..., got Array`. These are the errors of a number `A`.
  - Other entries that are not numbers also take the typed path, with the results of mathjs 15.2.0. A string that is not numeric throws `Cannot convert "x" to a number`, and `null`, `undefined` or an object in `A` throws a `TypeError` from `abs`; each threw the singular-matrix error. `undefined` in `b` is read as 0 and an object in `b` throws a `TypeError`; each gave `NaN`. A 3-D Array `A` with an entry that is not a number throws `RangeError: Matrix must be two dimensional`. A 3-D Array `A` of numbers is unchanged.
- f0d9581: The number-only statistics throw a TypeError for Complex, Fraction and BigNumber data instead of returning a wrong number (#1042).
- d9f3a33: `qr` of an empty matrix (`[]`, `[[]]`, `matrix([])`, `m x 0`, `0 x n`, dense or sparse) returns the complete factorization (Q is the m x m identity, 0 x 0 when m is 0; R has the input size) and no longer throws an internal error. Fixes #1205.
- cb23b66: `lup` of an empty matrix returns the factor shapes `L` m x k and `U` k x n (k = min(m, n)), with `p` the identity on the m rows, as `slu` does. `lup(matrix([]))` gave an `L` with size `[0, NaN]` and a `U` with size `[NaN, undefined]`; both are now `[0, 0]`. An input with rows and no columns (`[[]]`, `[[], [], []]`) lost the row count of `L` in `valueOf()` and in the Array result (`L` was `[]`); `L` is now `[[]]` or `[[], [], []]`. `U` of those inputs stays `[]` (0 x 0). Sparse and 0 x n inputs are unchanged. A dense input that is not two-dimensional, other than the empty `[]`, now throws `RangeError: Matrix must be two dimensional (size: ...)`, the error that `det` and `inv` throw for a 3-D input (for a 1-D input they throw `Matrix must be square`). A non-empty 1-D DenseMatrix (`lup(matrix([1, 2]))`) returned `L` of size `[2, NaN]` and `U` of size `[NaN, undefined]`, the Array `lup([1, 2])` returned `{ L: [], U: [], p: [0, 1] }`, and a 3-D input threw an internal `equalScalar` `TypeError`.
- 0c85f33: The typed functions in evaluate's scope give the mathjs result on arrays and matrices: bitNot, nthRoot, not, hypot, gcd, multinomial, pinv, permutations, random, randomInt and pickRandom. The default norm of a matrix is the 2-norm (#1034).
- 01765bf: `quantileSeq` with a NumPy `method`, number data and a number probability now matches `numpy.quantile` 2.3.5 at low and high probability (Fixes #1110). When the virtual index is below 0, or at or above n - 1, both interpolation ends clip to the boundary element. Before, only the left end clipped, so the result blended the minimum with the second value.
  
  Results change for `averaged_inverted_cdf` (`quantileSeq([1, 2], 0.25, 'averaged_inverted_cdf')` was 2, now 1), `interpolated_inverted_cdf`, `hazen` (`quantileSeq([2, 5], 0, 'hazen')` was 3.5, now 2), `weibull` (`quantileSeq([1, 2, 3, 4], 0.1, 'weibull')` was 1.5, now 1), `median_unbiased` (`quantileSeq([3, -1, 5, 7, 2], 0, 'median_unbiased')` was -2.2e-16, now -1) and `normal_unbiased`.
  
  Behaviour change: `closest_observation` now resolves a tie as Hyndman-Fan type 3 and NumPy 2.3.5 do. A tie takes the even order statistic. `quantileSeq([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.25, 'closest_observation')` was 3, now 2; at 0.75 it was 7, now 8. The old values equal NumPy 1.26.4.
  
  When the clipped boundary element is infinite, the result is NaN, as NumPy (`quantileSeq([-Infinity, 1, 2], 0, 'hazen')` was -Infinity). BigNumber data and a BigNumber probability do not use these methods yet (#1130).
- 90a75f9: `multinomial` returns Infinity in about 1024 steps at most when the result overflows a double, instead of looping over the sum of the counts (#1001). `multinomial([1e7, 1e7])` took about 0.75 s and `multinomial([1e9, 1e9])` did not finish. The value is exact for every result that fits a double, as a BigInt product of binomials, and is Infinity when the exact value rounds to Infinity. `parse()` and `compile()` now give the same result as `evaluate()` for plain-number entries. This is a deliberate difference from mathjs, which returns NaN above 170!. Below 170! the result is the correctly rounded value, so it can differ from mathjs in the last bit (`[33, 13]` is 101766230790; mathjs gives 101766230789.99998). BigNumber and boolean entries keep their results on the `parse()` path.
- 00c530e: `eigs` of a real symmetric matrix with small entries no longer returns the diagonal (Fixes #1243). The Jacobi stop test in `realSymmetric` now compares against the largest entry of the matrix, so `eigs(c * A)` equals `c * eigs(A)` for number and BigNumber matrices while the entries of `c * A` are normal numbers. The solver runs for a `Matrix` input and for BigNumber entries; a plain number Array uses the native solver and does not change. A zero matrix returns zeros. Prior result for `[[4,1,2],[1,3,0.5],[2,0.5,5]] * c` (true eigenvalues `c * [2.0965, 3.0722, 6.8313]`): number `c = 2^-60` gave `[2.602e-18, 3.469e-18, 4.337e-18]` (the diagonal sorted, no rotation); number `c = 2^-600` gave `[7.23e-181, 9.64e-181, 1.205e-180]`; BigNumber `c = 1e-18` gave `[3e-18, 4e-18, 5e-18]`; BigNumber `c = 1e-1000` gave `[3e-1000, 4e-1000, 5e-1000]`. Results for `c = 1` are unchanged. For `c = 2^60`, `2^600`, `1e18` and `1e1000` the eigenvalues are unchanged; the eigenvectors now stop at the same relative tolerance as for `c = 1` (largest relative residual of 200 random matrices at `c = 1e200`: 3.1e-13, was 3.9e-15, because the absolute tolerance made a large matrix rotate further).
  
  A graded matrix, where a small diagonal block sits beside large entries, now keeps its small eigenvalues: after the scale test, each pair rotates until `|a_ij| <= prec * sqrt|a_ii| * sqrt|a_jj|` (floored at rounding noise), and the equal-diagonal test compares against `|a_ij|`. Prior result for `[[1,0,0],[0,1e-12,1e-13],[0,1e-13,1e-12]]` (true eigenvalues `0.9e-12, 1.1e-12, 1`) was `1e-12, 1e-12, 1` for number and BigNumber; mathjs 15.2.0 gives the same wrong result. No tolerance is below the rounding error of one rotation, so a subnormal matrix and a `precision` of 0 terminate (a `precision` of 0 did not return for a 6 x 6 matrix with repeated eigenvalues).
  
  Behaviour change: `eigs` now throws a `RangeError` for a `Matrix` or a BigNumber or Complex input with a NaN or Infinity entry, symmetric or not. Before, it returned values that did not depend on the bad entry (for example `[1, 2]` for `matrix([[1, NaN], [NaN, 2]])` and for `matrix([[1, NaN], [3, 2]])`, and `[-Infinity, Infinity]` for an Infinity entry), as mathjs 15.2.0 does. A plain number Array already threw a `RangeError` (#989).
- 0c85f33: number, string and boolean follow mathjs: they map arrays and matrices, an invalid string throws, and boolean('false') is false (#1076).
- 9f8cbaf: `eigs` decides that a computed eigenvalue is real with a tolerance relative to the matrix: `|im| <= 8 * n * eps * max|A_ij|`. The old tolerance was the absolute number `1e-10`. Fixes #1186.
  
  - A matrix of small scale keeps its complex pair. `eigs([[0, -1e-150], [1e-150, 0]])` returns `-1e-150i` and `1e-150i`, with eigenvectors that fit. It returned the real `0` twice, with a residual of about 1.
  - A genuine pair near to real stays a pair at every scale, as in NumPy. `eigs([[1, -1e-12], [1e-12, 1]])` returns `1 - 1e-12i` and `1 + 1e-12i`. It returned the real `1` twice.
  - A repeated real eigenvalue whose copies the solver returns as a pair with an imaginary part of rounding size is real at every scale. Its eigenvectors are two independent real vectors. Before, the two copies got the same eigenvector, and at a large scale they stayed a complex pair.
- 5b284e3: `createInstanceEvaluator(imported, hiddenNames)` takes an optional list of names that the instance scope does not resolve, in safe and unsafe evaluation (#1216). An imported name resolves even when it is in the list. The module-level `evaluate` and `compile` do not change. compat passes its internal-name list.
- d8b3c68: `cov` of a 1-D array with no second vector returns the sample variance, as `numpy.cov` does. It returned `[]` before (#980).
- c4ddb8c: Fixes #1168. `qr` of a small matrix of plain numbers no longer loses a column. The Householder step reads a residual column norm of 1e-15 or less as zero, an absolute test. A matrix with a largest entry in [2^-20, 1) was not scaled, so the residual of a nearly dependent column fell below the test and the reflection was skipped. `qr` now scales every all-number matrix with a largest entry below 1 by an exact power of 2 into [1, 2), and scales R back. Core exports the new window exponent `UNIT_FLOOR_LO = 0` (window start 2^0) from `/internal`. Complex, BigNumber and Fraction matrices are not scaled and still have the defect (#1188).
  
  Value changes: the factors of an all-number matrix with a largest entry in [2^-20, 1) and a column within about 1e-15 (absolute) of the span of earlier columns change from a skipped step to the true reflection. `[[1,1,1],[1,1+3e-10,1],[1,1,1+3e-10]]·2^-19` had a reconstruction error of 5e-11 and a wrong sign of R22; the error is now about 3e-16. Scaling by a power of 2 is exact, so other inputs give the same factors, except where an entry is subnormal before or after scaling.
- b473e94: `eigs` returns the eigenvector of a complex eigenvalue as `Complex` entries, so that `A v = lambda v` holds. Before, the vector held only the real part and was wrong (Fixes #978). When one eigenvalue is complex, every eigenvector holds `Complex` entries, as in mathjs; the vector of a real eigenvalue then has zero imaginary parts. A real spectrum keeps `number[]` vectors. The doc comment of `eig` now says that `vectors[k]` is a row, not a column.
  
  Value change: `eigs(A).eigenvectors[k].vector` is `Complex[]` for every `k` when any eigenvalue is a `Complex`.
- 1629b29: `min` and `max` of a Float64Array propagate NaN on every sequential and parallel path, as the Array path and mathjs do (#1048). This change adds the core primitive `extrema`.
- 680d90a: `eigs` of a matrix with Complex entries keeps the imaginary part of each entry (#1220). The factory scope `complex(x)` built `new Complex(x, undefined)`, so a Complex argument became a Complex that held the entry in `re`, and `abs` read it as its modulus. `complex()` now follows mathjs: no argument or `null` gives 0, it clones a Complex, and it accepts a number, BigNumber, Fraction, bigint, boolean, string, `{re, im}`, `{r, phi}`, `{abs, arg}` and an Array. Before: `eigs([[complex(2,1)]])` gave 2.236 (now 2+i); `eigs([[complex(0,1),0],[0,1]])` gave 1, 1 (now i, 1); `diag(2+i, 5+i)` gave 2.236, 5.099 (now 2+i, 5+i); `[[2+i,1],[0,3]]` gave 2.236, 3 (now 2+i, 3); `[[2,1-i],[1+i,3]]` gave 0.9999999999999991, 4.000000000000001 (now 1.0000000000000002, 4, within 1e-8 of 1 and 4, as mathjs 15.2.0). The public `complex(complexValue)`, `complex({re, im})` and `complex('2+i')` returned a Complex that held the argument in `re`; they now return the Complex. `complex(Matrix)` maps each entry and returns a Matrix. A part of `(re, im)` that is not a number, BigNumber, Fraction, bigint, boolean or numeric string throws a TypeError, as do a single argument of another type (`complex(undefined)`) and a third argument, as in mathjs. `complex(1, undefined)` returned 1 and now throws. The parts of an object convert to numbers. The call shape `(value, index, collection)` converts the value, so `[1, 2].map(complex)` gives 1 and 2. The compat `complex` shim uses the functions `complex` for every input except no argument and a single Complex, which it still returns unchanged; `complex(z, 5)` returned `z` and now throws a TypeError, and a third argument throws.
- 0e2cfea: `qr` throws `RangeError('Matrix must be two dimensional (size: ...)')` for an input that is not two dimensional, as `lup` does (Fixes #1217, Fixes #1251). The size check now runs before the empty-input branch of `_denseQR`, which read only the first two sizes. Prior results: `qr([[[]]])` returned `Q = [[1]]` and `R = [[[]]]`; `qr([[[]], [[]]])` returned the 2 x 2 identity `Q` and `R = [[[]], [[]]]`; `qr(matrix([[[]]]))` returned a 1 x 1 `Q` and an `R` of size `[1, 1, 0]`. A non-empty 3-D Array or DenseMatrix threw an internal `TypeError` from `multiplyScalar`. A non-empty 1-D input (`qr([1, 2])`, `qr(matrix([1, 2]))`) threw `TypeError: row.some is not a function`. The empty vector (`[]`, `matrix([])`) and the two dimensional empty inputs (`[[]]`, `zeros(3, 0)`, `zeros(0, 3)`, `sparse([[]])`) keep their #1205 results.
- 67b7cbb: `hessenbergForm` no longer has an absolute tolerance. Each Householder vector is built from the column divided by its largest absolute entry, so the squares cannot overflow or underflow. A step is skipped only when every entry of its column below the diagonal is exactly zero; a NaN or an infinity propagates as before. At scale 2^-60 the reconstruction error of a random 6×6 matrix was 0.61 and is now about 5e-16. At scale 2^1000 the result was NaN and is now correct. A matrix with entries of size 1 and a tail of size 1e-20 or less lost the tail (error 3 relative to the tail) and now keeps it, with an error below 1e-14 relative to the tail. With A[3][3] = 1e300 the result was NaN and is now correct. Fixes #1199.
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
- 7975f0b: `identity`, `inv` and `det` handle empty matrices (Refs #1230). The inverse of the 0 x 0 matrix is the 0 x 0 matrix, and its determinant is 1. This differs from mathjs 15.2.0, which throws for `identity(0)`.
  
  - `identity(0)`, `identity(0, 0)`, `identity(0, 'dense')` and `identity(0, 'sparse')` return a 0 x 0 matrix. Before, they threw `Parameters in function identity must be positive integers`. The message now says "non-negative integers"; a negative or fractional size still throws. A size with one zero dimension (`identity(0, 3)`, `identity(3, 0)`) returns an empty matrix of that size; before, it threw the same error.
  - `inv(matrix([]))`, `inv` of a 0 x 0 DenseMatrix and `inv(sparse([]))` return a 0 x 0 matrix of the same storage, as `lup(matrix([]))` does. `inv([])` returns `[]`. Before, `inv([])` and `inv(matrix([]))` threw `Matrix must be square (size: [0])`, and the 0 x 0 DenseMatrix and `sparse([])` threw the identity error.
  - `det` of a 0 x 0 DenseMatrix or `sparse([])` returns `1`. Before, both threw `TypeError: Cannot read properties of undefined (reading '-1')`. `det([])` and `det(matrix([]))` still return `1`.
  - `det([[]])` and `det(matrix([[]]))` (1 x 0) throw `RangeError: Matrix must be square`, and so does every Matrix with rows and no columns (`zeros(3, 0)`, dense or sparse). Before, they returned `1`.
  - `inv` of a non-square empty input (`[[]]`, 1 x 0, 0 x 1) still throws `Matrix must be square`.
  - `sqrtm` of a 0 x 0 matrix still throws. A DenseMatrix now gives `Cannot calculate max of an empty array` and `sparse([])` gives `Dimension mismatch (1 != 2)`; before, both gave the identity error. `pow(A, n)`, `expm` and `sylvester` of a 0 x 0 matrix are unchanged.
- b2a29c7: The matrix 2-norm, `qr`, `std`, `corr` and the general `eigs` of BigNumber values no longer overflow or underflow in their squares (Fixes #1257). With `BigNumber.config({ precision: 20, minExponent: -300, maxExponent: 300 })`, the result before the fix was:
  
  - `norm([[3e200, 0], [0, 4e200]], 2)` of BigNumbers returned `Infinity`. The result is now `4e+200`. The same matrix with `3e-200` and `4e-200` returned `0`. The result is now `4e-200`. The factory `norm` of number matrices had the same defect (`Infinity` and `0`, and `NaN` for a large matrix that is not diagonal); the typed `norm` of numbers was already correct.
  - `qr([[3e200, 1], [4e200, 1]])` of BigNumbers returned `NaN` entries in R (the Householder `alphaSquared` overflowed). R[0][0] is now `5e+200` and Q R equals A. `qr([[3e-200, 1], [4e-200, 1]])` returned the matrix itself as R (the squares of the first column underflowed, so the step was skipped). R[0][0] is now `5e-200`. The norm of each column is scaled by a power of 10 only when its squares can leave the configured exponent bounds, so every other result is unchanged. A number matrix already scaled by a power of 2.
  - `std([1e200, 3e200])` of BigNumbers returned `Infinity`. The result is now `1.4142135623730950488e+200`. `std([1e-200, 3e-200])` returned `0`. The result is now `1.4142135623730950488e-200`. Numbers had the same defect (`Infinity` and `0`), and the result is now `1.414213562373095e+200` and `1.414213562373095e-200`. This holds for the typed `std`, the factory `std`, a normalization, `dim` and the options object. The second computation is `std` itself for the values divided by an exact scale, so the result is the result for values of order 1, multiplied by the scale. `std` of equal numbers is 0 at every scale. `std` of equal BigNumbers is 0 when it is 0 for the same digits at order 1: 300 copies of `(1/3)e-200` give `3.005...e-219` (the result before the fix was 0, because the square underflowed), as 300 copies of 1/3 give `3.005...e-19` before and after the fix. `variance` is unchanged: the variance of these values is out of range, and it stays `Infinity` or `0`.
  - `corr` of BigNumber lists of order 1e200 or 1e-200 returned `NaN`; it is now the correlation (0.98198050606196571569 for `[1, 2, 4]` and `[1, 3, 5]`). `corr` of number lists of order 1e200 returned `NaN` as well. For these number lists at order 1e77 to 1e153, each sum of squares was in range and their product was infinite, so `corr` returned `0`. For order 1e-80 the product was subnormal, and the result was `0.9819773085603579`. Both are now `0.98198050606196...`.
  - `eigs([[3e200, 1e200], [2e200, 4e200]])` of BigNumbers returned `NaN, NaN`. It is now `1.9999999999999999999e+200, 5.0000000000000000001e+200` (the exact values are 2e200 and 5e200; the last digit is the rounding of the 20-digit QR iteration). A complex pair is multiplied back as numbers. When the power of 10 is not a finite nonzero number, the result is that of the entries without a scale.
  
  Each function computes the plain result first and scales only when that result is `NaN`, infinite or 0 (`corr` of numbers scales when the product of the two sums of squares is not a positive normal number; `qr` and `eigs` scale when the squares of the largest entry can leave the exponent bounds). So the result of every input that was in range is unchanged: for numbers it is bit-identical, and for BigNumbers it is the same digits.
  
  `hypot`, vector `norm` and `distance` are #1255. In `functions/src/utils/real-scale.ts` the decimal order of a BigNumber is `BigNumber.e`, the exponent of its scientific notation, which is the order that core compares with `minExponent` and `maxExponent`. A count of the digits before the point is that order plus 1. The change of #1255 and this change share one scale helper and one order convention when the second of them merges.
  
  mathjs 15.2.0 with the same exponent bounds (`minE: -300`, `maxE: 300`) gives the results of the code before the fix for every BigNumber input above. With its default bounds, mathjs gives `3e+200` for the BigNumber matrix 2-norm above (the correct norm is `4e+200`). For numbers, mathjs gives `Infinity` and `0` for the norm and `std`, and `NaN` for `corr` of order 1e200 (`0` for order 1e100). The `std` of 10000 copies of the number 0.1 is 0, as before the fix; mathjs gives `1.5876983121143017e-14`.
- d0a18ca: A matrix of a second copy of the matrix package works in every public function (#1041). New export: isNativeMatrix.
- 00d8732: `qr` returns `Q` and `R` with one entry type, from the input. A matrix of numbers and BigNumbers gives BigNumber entries. A matrix with a Complex entry gives Complex entries; its number and BigNumber entries become Complex, as in `det`. Any other matrix keeps its entries as they are. Before, the identity of `Q`, the zeros of `R` and the entries of a skipped Householder step stayed plain numbers. For a matrix of numbers with one Complex entry, every product now uses Complex arithmetic, so the parts of `Q` and `R` can differ from the earlier result by a few units in the last place (at most 7.8e-16 absolute on the 8×8 test matrix). Fixes #1206.
- a41228f: `bignumber` converts an Array or a Matrix element by element and keeps the shape and storage. It converts the value of a Unit and keeps the unit. `bignumber(null)` returns 0. A Fraction converts at the BigNumber precision (it had 16 digits), also through `numeric(x, 'BigNumber')`. A bigint converts without loss. Before, a collection of two or more elements gave a BigNumber NaN, and a one-element or empty collection collapsed to a scalar. A Unit gave a BigNumber NaN and null threw.
  
  quantileSeq with a BigNumber N returns the N quantiles (it returned a BigNumber NaN, #1112). With a BigNumber N or a BigNumber probability, number, bigint and Fraction data give BigNumbers, and Unit data gives Units with a BigNumber value.
  
  solveODE accepts BigNumber `tspan` and `y0` (it threw "multiply: unexpected type undefined").
- 852f6e2: Four small numeric defects.
  
  - A number as the data argument of a stable reduction in core (`pairwiseSum`, `pairwiseDot`, `sumSquaredDeviations`, their `Checked` variants, `neumaierSum`, `neumaierCumsum`, `norm2`, `scaledDistance`, `extrema`) now throws a `TypeError` that names the function. A string, and an object whose `length` is not a non-negative integer, throw the same error. Before, `pairwiseSum(0)` and `sumSquaredDeviations(0)` threw `RangeError: Maximum call stack size exceeded`, and `norm2(5)` gave `0` (#1011).
  - `numberVector` rejects a value that is not an array, typed array, array-like or iterable object. The statistics, signal and linear-algebra functions that take a number vector read a number as `[]`. Before, `zscore(5)` was `[]`, `skewness(5)` was `NaN`, `trapz(5)` was `0` and `signTest(5)` was `{ statistic: 0, pValue: 1 }`. Now each throws a `TypeError` that names the function, for example `zscore: expects an array of numbers, got a number` (#1083).
  - The SVD gave wrong singular values for a matrix whose leading column entry is negative with zeros below it, because the Householder helper returned the non-orthogonal `beta = -2` for that column. Before, `norm([[-3,0],[0,1]], 2)` was `9`, and the singular values were `[9, 1]`. Now the norm is `3` and the singular values are `[3, 1]` (NumPy and mathjs). `pinv`, `lowRankApprox` and `svd` rebuild such a matrix correctly. The default `norm` of a matrix was already the spectral norm (`p = 2`), as in mathjs. A new test pins that default, and the fix above corrects its value for such a matrix: `norm([[-3,0],[0,1]])` was `9` and is `3`. `norm([[1,0],[0,2]])` is `2` (#1082, #995).
  - In `parallel`, `parallelMean`, `parallelVariance` and `parallelStd` on the sequential path pass the data to `pairwiseSum` before they read its length. A number now throws the `TypeError` of core. Before, `parallelMean(1)` gave `0` (#1011).
- 4312c30: The factory `pow` (`factory_pow`), `sqrtm`, `expm`, `sylvester` and `kron` handle empty matrices (Refs #1233). A 0 x 0 input gives a 0 x 0 result of the same container type, as `inv` and `det` do (#1230). `pow(A0, 0)` is the 0 x 0 identity. mathjs 15.2.0 throws for `pow`, `sqrtm`, `expm` and `sylvester` of every 0 x 0 input. The root `pow` export and the compat instance use the typed `pow`, which this change does not touch (#1278).
  
  - `factory_pow([], n)` threw `For A^b, A must be 2 dimensional (A has 1 dimensions)` for every `n`. It returns `[]` for an integer `n`. `pow` of `matrix([])`, of a 0 x 0 DenseMatrix and of `sparse([])` threw the same error. They return a 0 x 0 matrix of the same storage (a new object). A non-integer `n` still throws, and so do `[[]]` and `zeros(3, 0)` (`A must be square`). `zeros(0, 3)` threw the 2 dimensional error and now throws `For A^b, A must be square (size is 0x3)`.
  - `sqrtm([])` returns `[]`. Before, it threw `Matrix must be square (size: [0])`. `sqrtm(matrix([]))` threw the same error and now returns a 0 x 0 DenseMatrix. A 0 x 0 DenseMatrix threw `Cannot calculate max of an empty array`, and `sparse([])` threw `Dimension mismatch (1 != 2)`. They return a 0 x 0 matrix of the same storage. `[[]]` and `zeros(3, 0)` still throw.
  - `expm([])` and `expm(sparse([]))` return `[]`. Before, both threw `DenseMatrix nested array must be a non-empty rectangular array of numbers` (a non-empty sparse matrix returns an Array). `expm([[]])` threw the same message; it now throws `matrixExpm: matrix must be square (got 1×0)`. `expm` of a 0 x n or n x 0 sparse matrix also threw the `DenseMatrix` message and now throws the square error: the shape of a sparse matrix is read before its conversion to an Array. `expm(matrix([]))` and `expm` of a 0 x 0 DenseMatrix already returned a 0 x 0 matrix and are unchanged.
  - `sylvester` of a 0 x 0 system threw `schur: matrix must be square (real Schur decomposition)` for every kind. Three Arrays `[]` return `[]`; a Matrix operand gives a 0 x 0 DenseMatrix. When A is m x m and B is n x n with m or n equal to 0, the result is the empty m x n matrix, and a C of another size throws `RangeError: Dimension mismatch`. When m is 0, a one-dimensional empty C (`[]`, `matrix([])`) is the 0 x n right-hand side, because `[]` is the only Array with 0 rows.
  - `kron` read the size of a Matrix from `toArray()`, which drops the shape of a matrix with a zero row count. `kron` of two 0 x 0 matrices, or of a 0 x 0 matrix and any 2-D operand, returned a matrix of size `[0]` or `[1, 0]`; it returns a 0 x 0 DenseMatrix. `kron(zeros(0, 2), [[1, 2]])` returned size `[1, 0]` and now returns `[0, 4]`. `kron(zeros(2, 0), zeros(0, 3))` returned `[2, 0]` and now returns `[0, 0]`. For operands of at most two dimensions, the result size is the product of the operand sizes. With an operand of three or more dimensions the result is unchanged (#1279). mathjs 15.2.0 returns the earlier sizes. A one-dimensional empty operand (`[]`, `matrix([])`) is still a vector, so `kron([], [[1, 2]])` is `[[]]`, as before. A sparse operand still gives a DenseMatrix.
- e08d7df: `expToTrig` keeps the value of its input (#1087). It pairs the parentheses, so a nested argument is no longer cut at the first `)`, and it adds parentheses around the angle. `expToTrig('exp(i*(x+1))')` now returns `(cos((x+1)) + i*sin((x+1)))`; it returned `(cos((x+1) + i*sin((x+1)))` before (the angle `(x+1` lost its parenthesis, so `cos` closed early). A call is rewritten when its argument is a product with a factor `i` or `-i`, so `exp(x*i)`, `exp(2*i*x)` and `exp(x*-i*y)` are also rewritten. A factor can be an implicit product, so `exp(i*2 x)` gives `(cos((2 x)) + i*sin((2 x)))`. A call stays as written when its exponent is a sum (`exp(i*x+1)`), has an operator other than `*`, `/`, `^`, `!` and `'` (`exp(i*x?1:2)`), or does not balance.
  
  `expToTrig` rewrote these calls before and now leaves them as written:
  
  - A call with a second argument (`exp(i*x, y)`). `exp` uses only its first argument, so the old output had the same value.
  - An exponent with a word operator (`exp(i*x mod 2)`). The exponent is `(i*x) mod 2`, and the old output used `x mod 2` as the angle.
  - An exponent with a matrix or a string as a factor (`exp(i*[1, 2])`, `exp(i*"a")`). The result is `NaN` before and after a rewrite, so no value is lost.
  - An expression where a `%` comes directly before a `'` (`3%'a'`). The scanner cannot tell a transpose from a string there, so the whole expression stays as written.
  
  `trigToExp` and `expToTrig` share one internal scanner, `functions/src/typed/call-rewrite.ts`. The scanner pairs the brackets in one pass, so a deep nest of calls that stay as written takes linear time. In both functions these calls now stay as written, because the output did not parse or changed value before:
  
  - A call that follows a name and white space, or an index (`x sin(y)`, `x[1] exp(i*y)`, `2 in sin(y)`). The output was `x (...)`, which the parser reads as a call of `x`. A call after a number, a constant, a matrix or a word operator (`2 sin(y)`, `[1, 2] sin(y)`, `x mod sin(y)`) is rewritten.
  - A method call (`x.sin(y)`). The output was `x.(...)`.
  - Text in a string literal or a comment (`"sin(x)"`). The rewrite changed the value of the string.
  - In `trigToExp`, a call with no argument or with two or more (`sin()`, `sin(x, y)`). The output was `exp(i*())` or `exp(i*(x, y))`.
- 9a720bf: BigNumber handling fixes (Fixes #1117, #1119, #1120).
  
  - #1117: a Fraction converts to a BigNumber as numerator / denominator at the configured precision, not through a 16-digit number. `add(fraction(1, 3), bignumber(1))` gave 1.3333333333333333 and now gives 1.333... to 64 digits. `quantileSeq([fraction(1, 3), fraction(2, 3), fraction(1)], bignumber(3))` gave 0.49999999999999995 and 0.8333333333333333 for the outer quantiles and now gives 0.5 and 0.8333... to 64 digits. A BigNumber method that takes a Fraction (`BigNumber.add(fraction)`) converts the same way. This departs from mathjs 15.2.0 on purpose: mathjs throws a TypeError for `add(fraction, bignumber)`; MathTS keeps its implicit conversion and now keeps the digits. `bignumber(fraction)` already matched mathjs.
  - #1119: `bignumber()` returns 0, as mathjs. `bignumber(undefined)` throws a TypeError that names `bignumber` (mathjs also throws; the old error was a raw "reading 'isMatrix'"). `bignumber(complex(1, 2))` and `bignumber({})` throw a TypeError, as mathjs (they gave 2.236... and NaN). `bignumber(1, 2)` throws a TypeError ("Too many arguments"), as mathjs (it returned 1). The callback shape `(value, index, collection)` is the exception and converts the value, so `map(x, bignumber)`, `forEach`, `filter`, `matrix.map(bignumber)` and `[1, 2].map(bignumber)` work as before (mathjs throws for the last one only). Other values with no BigNumber form also throw a TypeError, as mathjs: a boxed Number, String or Boolean, a Date, a function, a typed array, a Map and an object with `valueOf` (they converted through `valueOf`). A BigNumber or a Fraction of another library (decimal.js, fraction.js, mathjs) still converts, and now keeps its digits. `bignumber('0x1F')`, `'0b101'`, `'0o17'`, a radix fraction (`'0x1.8'`), a binary exponent (`'0x1p3'` is 8) and the word-size form `'0xFFi8'` parse (they threw a SyntaxError). A word size larger than the value (`'0xFFi999999999'`) gives the value at once. A word size with a fraction (`'0x1.8i8'`), an upper-case `I` and surrounding spaces throw a SyntaxError (mathjs throws a DecimalError). Departures from mathjs 15.2.0 for radix strings: a sign applies after the word-size conversion (`'-0xFFi8'` is 1; mathjs ignores the sign and gives -1); the binary exponent must be at most 100000 in magnitude; the result rounds to the configured precision (mathjs keeps every digit of a radix string, and 20 digits when the string has a binary exponent); `'0x1i8p3'` and `'0xFFi8.0'` throw (mathjs gives 1 and -1).
  - #1120: `solveODE` with `RK23` or `RK45` and a BigNumber `tspan` or `y0` uses the same first-step heuristic as the number path (one shared function). For `y' = -y` on [0, 1], RK23 gave y(1) = 1/3 in 2 steps and now gives 0.3679 (e^-1) in many steps. This departs from mathjs 15.2.0 on purpose: mathjs returns 0.3333333333333334 in 2 steps for the same call. A BigNumber t, y and step size round to the configured precision at each accepted step, so the digits do not grow (RK45 on y'' = -y over [0, 10] with a BigNumber state returned values of 42457 characters; they now have at most 68). A BigNumber result has the step count of the number path and agrees with it to about 1e-14 relative. When the squares of the first-step norm overflow (a state near 1e160), the norm is scaled by the largest magnitude: `RK23`, `RK45`, `Rosenbrock` and `RODAS` with a number state of 1e160 did not return, because the first step was NaN. Every other number-path result keeps the same bits.
- 56e8b0f: `lusolve` throws `RangeError: Dimension mismatch` for a right-hand side of more than one column, on every input kind (Fixes #1231). `lusolve`, `lsolve` and `usolve` solve one column vector, as in mathjs. Before, `lusolve([[2,1],[1,3]], [[1,2],[3,4]])` with an Array `A` returned `[[0],[1]]`, the solution of column 1 only, and dropped column 2. This held for an Array, DenseMatrix or SparseMatrix `b`. A DenseMatrix or SparseMatrix `A` already threw `Dimension mismatch`. With an Array `A`, two more malformed `b` values now throw instead of returning a wrong result: a ragged `b` such as `[[5],[10,1]]` (before: `[[1],[3]]`), and a 1×2 `b` for a 1×1 `A`, such as `lusolve([[2]], [[4,5]])` (before: `[[2]]`). A `b` with an Array entry also throws now: `[5, [10]]`, `[[[5]], [[10]]]` and a 3-D DenseMatrix `b` returned `[[1],[3]]` before, and `[[5], 10]` and `[[5], []]` returned `[[NaN],[NaN]]`. With an Array `A`, a 1-D DenseMatrix `b` of the wrong length and a 1×n row DenseMatrix `b` (n ≥ 2) already threw a plain `Error` (`luSolve: right-hand side length ...`). They now throw `RangeError: Dimension mismatch`. A 1×n row Array `b` already threw that `RangeError`.
- 1906ed4: BigNumber gets the decimal.js names that the factory layer calls, a fractional pow, and full-precision transcendental functions; factory and typed norm, hypot and nthRoot keep BigNumber results (#1043).
- ba3a7bb: Breaking: the `create(all)` instance holds only the mathjs-parity names as own keys. `compat/src/parity-names.generated.ts` lists the 402 own keys of the mathjs 15.2.0 instance `create(all)`. The compat surface has 317 of them, and these 317 are the own keys (measured: `Object.keys(create(all)).length` is 317). The other 85 names of the list, for example `Unit`, `Complex` and `PI`, are not compat names before or after this change. The other 1089 names are inherited from prototype levels below the instance. Every name stays readable, assignable and enumerable.
  
  Why: V8 keeps an object in fast mode only up to 1020 own properties. The instance had 1406, so every `math.x` read was a dictionary lookup. A read of `math.add` cost 18.0 ns per call on Node 26 and 17.7 ns on Node 22, against 9.5 and 10.6 ns for a detached `add`. Now the instance and each prototype level (at most 900 names) stay fast after creation, after every name is read, after `import` and after `config`. Measured with 2e7 reads of one own name and one name on each level, 3 runs: a read costs 2.4 to 7.2 ns on Node 26 and 4.2 to 10.1 ns on Node 22, against 14.8 to 27.4 ns and 13.4 to 19.0 ns before. The `compat-add` wall-clock gate median went from 1.48 to 1.70 down to 0.49 to 0.57 (3 runs each, Node 26). `tools/test/compat-fast-instance.test.mjs` pins this with `%HasFastProperties`.
  
  Changed behaviour for the inherited names:
  
  - `Object.keys(math)`, `Object.entries(math)`, `Object.values(math)` and `Object.getOwnPropertyNames(math)` give the 317 parity names only.
  - A spread `{ ...math }` and `Object.assign({}, math)` copy the parity names only.
  - `Object.hasOwn(math, name)` and `math.hasOwnProperty(name)` are false for an inherited name.
  - `JSON.stringify(math)` writes the parity names only.
  - `delete math[name]` of an inherited name has no effect: the name stays readable with the same value, and `name in math` stays true. JavaScript gives no hook on `delete` of an inherited property without a proxy, and a proxy puts every read back on a slow path.
  - `math.import(otherInstance)` still throws, with another message: `Cannot import "Chain": already exists` (before: `Factory, Object, or Array expected`).
  - `math.import(otherInstance, { silent: true, override: true })` copies only the own names of `otherInstance`, because `import` reads the own keys of an object. Before, it read all 1406 names.
  - `Object.getPrototypeOf(math)` is the first prototype level, not `Object.prototype`.
  - An assignment to a name of a frozen instance throws a `TypeError`. Before, an assignment to a lazy name such as `det` changed the frozen instance. A sealed or non-extensible instance keeps every name writable, as before.
  - An assignment of an inherited name through an object that inherits from the instance (`Object.create(math)`) defines an own property on that object and leaves the instance unchanged, as before.
  
  Replacements: `for (const name in math)` lists all 1406 names, `name in math` is true for every name, and `math[name]` reads every name. `create(math)` with an instance as input now keeps every name, own and inherited.
  
  `importFactory` of `@danielsimonjr/mathts-functions` now sees an inherited name as an existing name. A factory import of such a name without `override` gives "already exists", as for an own name.
  
  Size: the name list adds to the bundle. `compat/dist/index.js` (the unminified build) goes from 19438 to 26821 bytes, and `tools/test/bundle-budget.json` records the new size.
  
  Fixes #1200
- a5a8eff: Every function checks a dimension argument the same way (#1047). A non-integer dim throws a TypeError. An out-of-range dim throws an IndexError with a true relation, as in mathjs. This change adds the core helper `validateDimension`.
- 3e089aa: `simplify` and `derivative` no longer throw `Cannot convert Complex number to Node` when a constant call such as `exp(1)`, `log(2)` or `sin(1)` folds to a real number (Fixes #986). `expand` no longer glues a function name to its argument, and it keeps a constant call whole (Fixes #987). `simplify('2^(1/2)*2^(1/2)')` no longer returns a huge ratio.
  
  Before and after:
  
  - `simplify('exp(1)*x')`: threw, now `2.718281828459045 * x` (mathjs 15.2.0 gives the same).
  - `simplify('log(2)*x')`: threw, now `0.6931471805599453 * x`.
  - `derivative('2^x', 'x')`: threw, now `0.6931471805599453 * 2 ^ x`.
  - `simplify('sin(1)/2')`: threw, now `0.42073549240394825`.
  - `simplify('2^(1/2)*2^(1/2)')`: `4.43365544449e+11 / 2.21682772224e+11`, now `2.0000000000000004` (mathjs gives the same).
  - A fraction next to an irrational constant now folds to a decimal, as in mathjs. `simplify('sqrt(2)/3*x')`: `x * 6.65857e+5 / 1.412496e+6`, now `0.4714045207910317 * x`. `simplify('1/3+sqrt(2)')`: `2.74267e+5 / 1.56944e+5`, now `1.7475468957064284`. An exact result stays a fraction (`simplify('sqrt(4)/3')` is `2 / 3`).
  - `expand('sqrt(2)*(x+1)')`: `sqrt2*x + 2*1`, now `sqrt(2)*x + sqrt(2)`.
  - `expand('exp(1)*(x+1)')`: `exp1*x + 1*1`, now `exp(1)*x + exp(1)`.
  - `expand('sqrt(2)*(x+1)+sqrt( 2)*x')`: the two spellings of `sqrt(2)` now collect, to `2*sqrt(2)*x + sqrt(2)`. Only the whitespace next to `(`, `)` or `,` is ignored: `sqrt(2 e -3)` and `sqrt(2e-3)` stay two constants.
  - `expand('sin(x)*(x+1)')`: `sinx*x + x*1`, now returned unchanged.
  - `expand('2^(1/2)*(8 + x)')`: gave a wrong value, now returned unchanged.
  - `expand('sin(1+2)^2')`: `sin1*1 + 1*2 + 2*1 + 2*2`, now returned unchanged.
  - `pi` and `e` now distribute and collect as constants. `expand('(pi+x)^2')`: `pi*pi + pi*x + x*pi + x*x`, now `pi^2 + 2*pi*x + x^2`. `expand('pi*(x+1)')`: unchanged text, now `pi*x + pi`.
  - An input that is a polynomial in its variables and its constants now comes back in the canonical polynomial form: `expand('x*e')` is `e*x`, and `expand('(x+pi)/2')` is `0.5*pi + 0.5*x`. A constant counts as one more variable, so the size and the time of the expansion are those of a polynomial with that number of variables (#1176). An input above the degree limit that contains a constant is returned unchanged, as before.
  - `symbolicEqual` compares through `simplify`, so two results change, and both now agree with mathjs: `symbolicEqual('1/3+sqrt(2)-sqrt(2)', '1/3')` and `symbolicEqual('sqrt(2)/3+1/3', '(sqrt(2)+1)/3')` were `true` and are now `false`, because the decimal difference is not exactly 0 (#1178). `symbolicEqual('sqrt(2)*sqrt(2)*x', '2*x')` was `false` and is now `true`.
  - `simplify('[1/3,2]*sqrt(2)')`: `[6.65857e+5 / 1.412496e+6, 6.65857e+5 / 2.35416e+5]`, now `[0.4714045207910317, 2.8284271247461903]`.
  
  The `fractionsLimit` option has the same effect as before: `simplify('1/3 + 100', {}, { fractionsLimit: 50 })` is `301 / 3`.
  
  A decimal constant that a fraction with a small denominator reproduces exactly still prints as a ratio, as it did before this change: `simplify('exp(10)*3')` threw, and is now `6.977852205e+9 / 1.05598e+5` (mathjs gives `66079.39738442015`). The value is correct (#1175).
  
  `simplify('sqrt(2)')`, `derivative('sqrt(2)*x', 'x')` and `derivative(symbolicIntegral('1/(x^2+1)', 'x'), 'x')` from #986 already worked before this change. Tests now guard them.
- d21f9cc: The default evaluator binds the imaginary unit `i`. Its operators and functions take a complex value: `+ - * / ^`, unary minus, `exp`, `sin`, `cos`, `tan`, `sqrt`, `cbrt`, `abs` and `log`. `mod` and `nthRoot` throw a `TypeError` on a complex value, as in mathjs. `trigToExp` now puts parentheses around each argument and each result, handles nested calls, and leaves `asin` and `sinh` unchanged. Its output evaluates to the value of its input (#1025).
- 3eadf13: Merge six duplicate internal helper bodies in `functions` into one copy each. The behaviour and the public API do not change.
- 4467c8a: Empty input no longer overflows the stack (#988). `fft([])`, `ifft([])` and `fftn([])` return an empty result, as `fft(new Float64Array(0))` does, and `rfft([])` returns an empty half-spectrum. An input with a zero-length dimension keeps its shape (`fft([[]])` is `[[]]`, `fft(zeros(3, 0))` has size `[3, 0]`), and a jagged nested array throws a `DimensionError`, whichever row is short. `irfft(spec, 0)` and `rfftfreq(0)` return `[]` instead of `[NaN]`, as `fftfreq(0)` does. `closestPair` of a Matrix throws a `TypeError` instead of overflowing the stack.
- 5ba5401: `eigs` lists one eigenvector for each independent direction of an eigenvalue (Fixes #926).
  
  - For `[[2,1,0],[0,2,0],[0,0,3]]`, `eigs` gave two parallel vectors for the eigenvalue 2. It now gives one, as its documentation says: an eigenvalue appears in `eigenvectors` as often as its geometric multiplicity. `values` still lists 2, 2, 3. `eigenvectors` is shorter than `values` for every defective input. A repeated eigenvalue that is not defective keeps all its vectors, and an input without a repeated eigenvalue keeps the same bits.
  - `eig` keeps one row of `vectors` for each eigenvalue, so its shape does not change. Each `repeatedEigenvalues` entry has a new field `indices`: the positions of its copies in `values`. The rows of a defective eigenvalue repeat a direction; the entry tells which rows.
- dd3cb3b: The sparse matrix `forEach` visits every element by default, column by column, as mathjs does. It visits only the stored entries when `skipZeros` is true. The sparse matrix `map` does the same, and it does not store a result that equals zero. This fixes `prod` of a sparse matrix with an implicit zero (it is now 0), `matrixFromFunction(size, fn, 'sparse')` (it returned zeros and did not call `fn`), `math.forEach` and `math.map` of a sparse matrix, and elementwise functions with a non-zero value at zero, such as `log10`, `log2`, `bitNot`, `factorial` and `not` (#985).
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
- a593d34: `lusolve` of an empty system no longer throws "Linear system cannot be solved since matrix is singular". A 0 x 0 system has the empty solution. `lusolve([], [])` returns `[]`. For a `DenseMatrix` or `SparseMatrix` `A` (also with `order` and `threshold`), and for an `lup`/`slu` style factor object with 0 x 0 factors, it returns a 0 x 1 `DenseMatrix`. `lusolve(lup([]), [])` threw `RangeError: Matrix must be two dimensional (size: [0])`, not the singular error; it now returns the same 0 x 1 `DenseMatrix`. The right-hand side can be `[]` or `matrix([])`. An empty input that is not square (`[[]]`, `matrix([[]])`, `sparse([[]])`, factors that are 1 x 0) throws the same dimension error as a non-empty non-square input. A factor object is checked `L` first, then `U`, so `lusolve(lup(zeros(3, 0)), b)` throws the same `Matrix must be square (size: [3, 0])` as before. An Array with an empty row and a non-empty row (`[[], [1]]`) is not an empty system and keeps its earlier errors. A right-hand side of the wrong size (for example `[1]`, or a 1 x 0 or 0 x 2 matrix) throws `Dimension mismatch` for every kind of `A`, `[]` included. The non-square error of an Array `A` is a plain `Error`, as for a non-empty Array `A`. Non-empty systems are unchanged.
- b799410: `qr` of a Complex, BigNumber, Fraction or mixed number/Complex matrix keeps a nearly dependent column. For a Complex, BigNumber or mixed matrix, the Householder step skips a column only when its norm is exactly zero, or when a norm held in a double has a square below 2^-969 (about 1e-146 after the scaling), so the tolerance of `isZero` no longer drops it. A small matrix such as `[[1,1,1],[1,1+3e-10,1],[1,1,1+3e-10]] * 2^-19` now reconstructs to rounding error instead of 5e-11. A Fraction matrix is converted to numbers and is scaled like a number matrix. A number or Complex matrix is scaled by an exact power of 2 into [2^0, 2^400] (the largest real or imaginary part), so a Complex matrix at 1e-300 or 1e300 no longer gives a NaN Q or a wrong R. A BigNumber matrix is not scaled. Fixes #1188.
- d05f7f4: `nintegrate` and `integrate(fn, a, b)` throw a `RangeError` when the integral does not converge or the result is not finite, instead of returning a wrong number. A NaN integrand, a caller-limited `maxDepth` that leaves unresolved error, and convergent `x^-p` on `[0, 1]` for `p` above about 0.67 at the default `maxDepth` now throw; a larger `maxDepth` resolves them. A NaN limit throws `a limit is NaN`. `QuadResult` gains `converged`; `quad`, `dblquad` and `tplquad` report it and never throw for convergence. `tanhSinh` reports `converged` too, and reports `false` for a NaN or infinite integrand. The `nintegrate` type is now `opts?: { tol, maxDepth }` in place of `tol?: number` (#998).
- 64e1e93: `slu` throws `Error('Linear system cannot be solved since matrix is singular')` when the factorization finds no nonzero pivot for a column, the same error as the dense `lusolve`. Before, `slu` threw `TypeError: Cannot read properties of null (reading 'L')` (Fixes #1235). `lusolve(sparse, b, order, threshold)` with an explicit order inherits the fix.
  
  Prior result on main, for `[[1,2],[2,4]]`, `[[1,0,0],[0,0,0],[0,0,1]]`, a matrix with a zero column and a matrix with two equal rows, with orders 0, 1, 3 and thresholds 0, 0.001 and 1: `TypeError: Cannot read properties of null (reading 'L')` from both `slu` and `lusolve`. For a zero matrix (`[[0]]`, `[[0,0],[0,0]]`) only `slu` threw the `TypeError`; `lusolve` already threw the singular `Error`. Order 2 reaches the factorization for a zero matrix and for `[[1,0,0],[0,0,0],[0,0,1]]`, and has the same fix; for the other matrices it throws `TypeError: Cannot set properties of undefined (setting '0')` from `csAmd` (a separate issue, #1239, not changed here). Dense `lusolve` and sparse `lusolve` with the default order already threw the singular `Error`.
  
  Not changed: with threshold 0, the pivot rule can take a diagonal entry that is exactly zero, and `slu` then returns factors with a zero pivot and no error (#1277). With threshold 1, a matrix that is singular only to rounding error (`[[1,2,3],[4,5,6],[7,8,9]]`) still factorizes, as in mathjs.
- 404e8a4: `BigNumber` enforces `minExponent` / `maxExponent`, no longer writes huge exponents as zeros, and overflows an exponent sum above 2^53 (Fixes #1204).
  
  - `valueOf()` builds no zeros. `BigNumber.parse('1e100000000').valueOf()` is `Infinity`, as before, but it no longer builds a string of 100000001 characters first.
  - `toString()` writes exponential notation when the order is at or above `toExpPos` or at or below `toExpNeg`. `BigNumber.parse('1e100000000').toString()` is `'1e+100000000'` (12 characters; it was 100000001 characters). `toExpPos` and `toExpNeg` are new `BigNumberConfig` fields with the defaults `1e6` and `-1e6`. A value with an order below 1e6 keeps its fixed-point output (`1e25` is still `'10000000000000000000000000'`). `toFixed()` still writes fixed-point notation.
  - `minExponent` and `maxExponent` were never read. Their default is now -9.007e15 and 9.007e15 (it was -1e9 and 1e9, not enforced), just below 2^53 - 2^31, so every in-range exponent is an exact integer. A value whose order is above `maxExponent` is `Infinity` or `-Infinity`, and one below `minExponent` is `0`, as in decimal.js. A value with an order of 2e9 (`1e2000000000`) stays finite.
  - An exponent sum above the bound overflows: `1e5000000000000000` squared is `Infinity` (it was `1e+10000000000000000`), and the cube of `3e4503599627370497` is `Infinity` (it was `2.7e+13510798882111492`, an exponent above 2^53 that was rounded).
  - `BigNumber.config()` throws `RangeError` for a bound that is not an integer from -(2^53 - 2^31) to 0 (`minExponent`, `toExpNeg`) or from 0 to 2^53 - 2^31 = 9007197107257344 (`maxExponent`, `toExpPos`). The message names the limit. `parse` still throws `RangeError` for an exponent text above 2^53 - 1; a parsed order from 9.007e15 to 2^53 - 1 is now `Infinity` or `0`.
  - The bounds apply to the result of a function, not to its inner steps. `exp`, `ln`, the trigonometric and hyperbolic functions, `pow`, `hypot` and the constants (`piAt`, `ln2At`) run their inner steps with the widest bounds. With `maxExponent: 5, minExponent: -5`, `sin(1)` keeps all 64 digits, and with `maxExponent: 5, minExponent: -100`, `1000 ** -3` is `1e-9`. `hypot` divides its operands by a power of ten before it squares them, so `hypot(3e5000000000000000, 4e5000000000000000)` is still `5e+5000000000000000`. `asinh` of a value whose square is above 2^53 - 2^31 is `ln(2x)`; it threw an out-of-memory `RangeError` before.
  - `bitAnd`, `bitOr`, `bitXor`, `bitNot` and the shift functions accept a BigNumber integer with an order of 1e6 or more. They read the integer with `toBigInt`, not from the `toString` text.
- 073ec8b: `sparse`, `matrix(data, 'sparse')` and the sparse matrix constructor throw `RangeError: Matrix must be two dimensional (size: [...])` for an input with three or more axes, or with no axis, instead of building an invalid matrix (Fixes #1263). Before, on main:
  
  - `sparse([[[1],[2]],[[3],[4]]])` and `matrix(a3, 'sparse')` built a 2 x 2 matrix with array entries, and `lusolve` of it threw a `TypeError` from `equalScalar`. mathjs 15.2.0 throws that `TypeError` when it builds the matrix.
  - `sparse({ data: a3 })` built the same invalid matrix, and `sparse({ data: 5 })` built a matrix of size `[undefined, 0]`.
  - `sparse(5)` returned an empty 0 x 0 matrix, as did every number, boolean and bigint (`sparse(0)`, `sparse(true)`, `sparse(5n)`). Each now throws the `RangeError` with `size: []`. A string (`sparse('number')`) still builds the empty matrix.
  - `sparse(denseMatrix)` of any dense matrix, 2-D or 3-D, and `sparse(sparseMatrix)` built an invalid matrix: its `size()` threw `TypeError: this._size is not iterable`. A 1-D or 2-D dense matrix and a sparse matrix now build a sparse copy that shares no array with the source, as in mathjs. The copy of a dense matrix keeps its datatype.
  - The sparse matrix constructor accepted a plain object with dense-matrix fields, such as `{ _data: [[1]], _size: [1, 1] }`. It now throws `TypeError: Unsupported type of data (Object)`, as mathjs does.
  
  A 1-D array and a 1-D dense matrix keep their n x 1 column form. An empty 2-D input and every 2-D array build the same matrix as before.
- 2165c36: A factory function takes a DenseMatrix of the matrix package (dense in, dense out). factory_cumsum of a 2-D array and factory_pow of a matrix no longer throw (#1035).
- bf0c777: sqrt, median and corr of a Fraction no longer return a Complex (#1044).
- 29cc252: `slu` of an empty sparse matrix no longer throws an internal error (`Cannot transpose a 2D matrix with no columns` for an input with no columns at order 1, 2 or 3; other internal errors for an input with no rows and one or more columns). For an m x n input with k = min(m, n), it returns an empty factorization with the shapes `lup` uses: `L` is m x k, `U` is k x n, `p` is the identity on the m rows, and `q` is the identity on the n columns (`null` for order 0). An input with no columns at order 0 did not throw: it returned 0 x 0 factors and an empty `p` whatever its row count, and now returns these shapes too. Validation of `order` and `threshold` still runs first.
- d2b506e: `slu(A, 2, threshold)` factorizes a square sparse matrix that has a dense row (Fixes #1239). `csAmd` drops each row with more than `min(n - 2, max(16, 10 * sqrt(n)))` entries: most 1x1 to 4x4 matrices have such a row, and so does a matrix of any size with a full row. `csAmd` drops the dense columns of the transpose in place, but left the dropped entries in the index and value arrays. The next transpose then counted them and built corrupt column pointers, and the product `A' * A` threw `TypeError: Cannot set properties of undefined`. `csAmd` now truncates both arrays after the compaction. Results on main before this change, order 2 and threshold 0.001: 1x1 `[[4]]`, 2x2 `[[4,3],[6,3]]`, 2x2 identity, 3x3 `[[2,1,0],[1,3,1],[0,1,4]]` and a full 6x6 threw `setting '0'`; a 4x4 tridiagonal threw `setting '1'`; a 5x5 tridiagonal and a 6x6 diagonal already factorized and give the same result. A diagonal matrix with one full row threw at sizes 5, 8, 18, 19, 20, 50, 100 and 200. The ordering of each case in this list equals the mathjs 15.2.0 result. A singular matrix with a dense row now throws the singular-matrix `Error` at order 2.
  
  The sparse `transpose` now counts only the entries that the column pointers reach (`ptr[columns]`), not every entry of the index array. A matrix with stale entries after the last column pointer now transposes correctly.
- Updated dependencies [6b4e603]
- Updated dependencies [c5ea0d7]
- Updated dependencies [fe2cf32]
- Updated dependencies [b1977e7]
- Updated dependencies [98a54f8]
- Updated dependencies [db4818f]
- Updated dependencies [d297c16]
- Updated dependencies [fbc5277]
- Updated dependencies [4304ad1]
- Updated dependencies [98a54f8]
- Updated dependencies [1f8ff61]
- Updated dependencies [24e06d4]
- Updated dependencies [f7a4aa7]
- Updated dependencies [c4ddb8c]
- Updated dependencies [b473e94]
- Updated dependencies [1629b29]
- Updated dependencies [2771df1]
- Updated dependencies [d0a18ca]
- Updated dependencies [852f6e2]
- Updated dependencies [9a720bf]
- Updated dependencies [1906ed4]
- Updated dependencies [a5a8eff]
- Updated dependencies [d21f9cc]
- Updated dependencies [5ba5401]
- Updated dependencies [aa18779]
- Updated dependencies [3929108]
- Updated dependencies [404e8a4]
- Updated dependencies [6bc82a2]
- Updated dependencies [db3f34f]
  - @danielsimonjr/mathts-matrix@0.12.0
  - @danielsimonjr/mathts-core@0.29.0
  - @danielsimonjr/mathts-parallel@0.12.0
  - @danielsimonjr/mathts-expression@0.14.1

## 0.86.0

### Minor Changes

- 59581d0: The radix-2 FFT cores read each twiddle from a table of one `Math.cos` and one `Math.sin` call per index. The earlier cores multiplied each twiddle by the step, so the rounding error grew with the index. The round trip `parallelFFT` then `parallelIFFT` at n = 4096 was 640 ULP of the largest sample; it is about 4 ULP now. The spectrum of a power-of-two length changes in the last bits, so this release is minor and not patch. The `workerpool` copy and the `functions` copy give the same bits on one runtime. Two runtimes can still differ in the last bit, because V8 and JavaScriptCore round `Math.cos` and `Math.sin` differently.
- 9f2eefa: **Breaking:** `solve` returns a finite list of roots, and the numeric scan runs only with `{ numeric: true, range: [a, b] }` (#884). `solve('sin(x)=0', 'x')` returned 63 floating-point roots in `[-31π, 31π]`. It now throws an `Error`, because the solutions of `sin(x) = 0` repeat with a period and no finite list holds them. The message names the new function `solveExact`. `solveExact('sin(x)=0', 'x')` returns the plain object `{ roots: ['0', 'pi'], period: '2*pi' }`: the principal roots of one period, and the period as text (`null` for a finite set). Add `k * period` to each root for all roots. The object holds only strings and `null`, so it survives `JSON.stringify`, `structuredClone` and a worker boundary. `solveExact` takes an equation `a*F(p*x + q) = b` with `F` one of `sin`, `cos`, `tan`, `exp`, `log`, `sqrt` or `abs`. A special value gives a multiple of `pi` (`sin(x) = 1/2` is `['pi/6', '5*pi/6']`). Another value gives a symbolic inverse (`sin(x) = 1/3` is `['asin(1/3)', 'pi - asin(1/3)']`). The coefficient of `x` can be a fraction of `pi` (`sin(2*pi*x) = 0` is `['0', '1/2']`, period `'1'`), and so can the offset (`2*sin(3*x + pi/4) = 1` is `['-pi/36', '7*pi/36']`, period `'2*pi/3'`). The roots are real roots: `sin(x) = 2` gives `[]`. No root text holds a rounded digit. A constant with no exact text (`sin(x) = sqrt(2)/3`) throws an `Error` that names the constant, in `solve` and in `solveExact`.
  
  `solve` throws an `Error` for an identity (`x^2 - x^2`, `0*x`): every value is a solution, and no finite list holds them. It returned `[]`, the same as an equation with no root. It throws a `PolynomialDegreeError` (a `RangeError`) that names the limit of 1000 for a polynomial of a higher degree (`x^1001 = 1`); before, the message said that no closed form exists. Any other form with no closed form (`sin(x) = x`, `sin(x)^2 = 1/4`, `1/x = 2`) throws an `Error` that names the numeric option; before, it returned scanned floats.
  
  `solve` reads the polynomial from the syntax tree, not from sample values (`sin(2*pi*x) = 0` returned `[]` and `x^3 - e` returned `NaN` before). Every tolerance is relative to the size of the terms that made the value, so a root is right at any size: `x^2 - 1e12` is `[-1000000, 1000000]` (it was `[]`), `x^2 - 1e-18` is `[-1e-9, 1e-9]` (it was `[0]`), `x - 1e-10` is `[1e-10]` (it was `[0]`), and `x - 1.000000001` is `[1.000000001]` (it was `[1]`). A root snaps to an integer only when that integer is a root. The rounding noise of a sum of constants is zero (`0.1+0.2-0.3+x` gives `[0]`). A linear or quadratic root keeps full precision (`3*x - 1` is `[0.3333333333333333]`; it was rounded to ten digits). A polynomial of degree 4 or more returns all its distinct real roots by Sturm isolation over the whole real line, not from a fixed scan window that missed a root outside it. The scan sorts its result, stays inside `range`, and finds a root of any size. Exports `solveExact`, the error class `PolynomialDegreeError` and the types `ExactSolution`, `SolveOptions` and `SolveResult`.
- e422aa3: **Breaking (output text):** every CAS function that returns a polynomial as text now writes the one canonical form: descending lexicographic order (the first variable is the most significant) and no unit coefficient. `expand('(x+1)^2')` is `x^2 + 2*x + 1`; it was `1 + 2*x + 1*x^2` (#887). The same text now comes from `casExpand`, `factor`, `cancel`, `together`, `apart` and `groebnerBasis`: `expand('(x+y)^2')` is `x^2 + 2*x*y + y^2`, `factor('x^2*y + x*y^2')` is `x*y*(x + y)`, and `groebnerBasis(['x^2-y', 'x*y-1'], ['x', 'y'])` is `['x - y^2', 'y^3 - 1']`. `collect` and `minimalPolynomial` use it too: `collect('x^2-3*x+1', 'x')` is `x^2 - 3*x + 1` (it was `x^2 + -3*x + 1`), and `minimalPolynomial('sqrt(2)', 'x')` is `x^2 - 2` (it was `10*x^2 - 20`). `integrate('3*x^2', 'x')` is `x^3` (it was `1*x^3`). The rational-function integrators share the printer too; a leading negative term there prints `-x^2 + 1`, not `- x^2 + 1`. Code that compares these strings with the old text must change. The value of each result is the same.
  
  The printer never writes a term with a zero coefficient (`-0*x`), and it throws a `TypeError` for two terms with the same exponent vector. A coefficient with an exact fraction keeps it: `expand('x/3 + 1/2')` is `1/3*x + 1/2` (it was `0.333333333333*x + 0.5`). A polynomial whose fractions all have a finite decimal keeps the decimals (`0.5*x + 0.25`). `expand` keeps a small coefficient (`1e-13*x^2`, `1e-11*x`); it dropped every coefficient below `1e-10`. It reads the residue of a cancellation as zero when the residue is small next to the terms that made it (`x + 1e-5*x - x - 1e-5*x` is `0`). `expand` throws a `PolynomialDegreeError` (a `RangeError`) for a polynomial of a degree above 1000, so `expand('(x^0)^1000000000*x')` and `expand('(x+1)^1000000000')` end at once; before, they ran for a long time. `toRadicals` returns `[]` for an expression that is not a polynomial (`toRadicals('sin(x)')` returned invented roots).
- 9188123: `@danielsimonjr/mathts-linalg` exports `DenseMatrix`. `lstsq(A, b)` is a new export of matrix, linalg and functions: the column-pivoted Householder QR least-squares solution of `A x ≈ b`. It accepts any shape and a vector or matrix `b`, and returns the minimum-norm solution for rank-deficient or wide input, as NumPy does. The rectangular `lsolve` error names `lstsq`.
- a1e3395: The factory functions accept the public `SparseMatrix` of `@danielsimonjr/mathts-matrix` (#949). A function that declares a matrix type converts a public `SparseMatrix` argument on entry. About 100 signatures of `dotDivide`, `dotMultiply`, `compare`, `equal`, `gcd`, `atan2`, `ceil`, `floor`, `dotPow`, `nthRoot` and others no longer fail with `size is not a function`, `density is not a function` or `Cannot perform operation on Pattern Sparse Matrix and Scalar value`. The return class follows mathjs. Two sparse operands give a public `SparseMatrix`; this changes `add` (was dense) and `multiply` (was an Array) of two sparse operands. A number added to a sparse operand, and a comparison with a number, give a dense matrix. A boolean result of two sparse operands is a `SparseMatrix` of 1 and 0. A result with a Complex, BigNumber or Fraction entry is a nested Array. A signature that refuses a `SparseMatrix` throws an error that names `toDense()`. The public `equal`, `compare`, `larger`, `smaller`, `largerEq` and `smallerEq` stay scalar-only for every collection. `divide(number, matrix)` in the factory scope no longer throws `Class constructor Complex cannot be invoked without 'new'`.
- 799b0fe: Compat output matches mathjs for `toString` and scalar trig (#889, #891, #892, #737).
  
  Breaking, visible output changes:
  
  - `Fraction#toString` prints the repeating decimal (`1/3` is now `0.(3)`, `1/2` is `0.5`). `format()` still prints the ratio (`1/3`), and a whole value prints without a denominator (`format(fraction(4, 2))` is `2`, not `2/1`).
  - `Matrix#toString` (matrix package, and the compat dense and sparse matrices) prints the nested-array form through `format()`: `[[1, 2], [3, 4]]` for 2-D, nested brackets for 3-D and more. Entries use `format()`: a Fraction entry prints `1/3` and a string entry prints quoted. The sparse matrix no longer prints the `Sparse Matrix [n x m]` listing from `toString`.
  - `Complex#toString` prints `NaN` when a part is NaN and `Infinity` when a part is infinite, as mathjs does (`log(-Infinity)` prints `Infinity`).
  - The compat instance type has no string index signature: `MathInstance` is the functions namespace plus the compat members. Code that read `math[name]` as `unknown` needs a cast.
  
  Workbook cells keep the ratio form for a Fraction result (`1/3`).
  
  Compat scalar `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `exp` and `log` take a number fast path.
  
  Documented exception: `asin(NaN)`, `acos(NaN)` and `log(NaN)` return a real `NaN` (mathjs returns Complex `NaN`); the printed text is the same.
- cee43ac: `fft(number[])` calls the flat kernel for every length from 64 up. A length that is not a power of two now runs the Bluestein kernel of `fft(Float64Array)`, so the spectrum changes in the last bits for lengths such as 65, 100 and 1000. `median` of a flat `number[]`, `Float32Array` or `Float64Array` makes one `Float64Array` copy and selects with quickselect. `median` of two large equal values no longer overflows.
- b95de8a: **Breaking:** Node 20 is dropped (`engines.node` >=22.12); packed-consumer contract (#886, #888, #890, #893, #905, #912, #914, #916, #930).
  
  Every package sets `engines.node` to `>=22.12`, and CI tests 22.x and 24.x.
  
  Every `exports` entry gains a `default` condition equal to `import`, so `require()` of the ES build works at run time on Node >= 22.12 (`mathts-wasm` has top-level await and stays import-only). Node 22.12 prints an `ExperimentalWarning` for it; 22.13 and later do not. On Node 22.11 and earlier, `require()` reports `ERR_REQUIRE_ESM`; use `import()`. TypeScript accepts the `require()` of these packages from CommonJS under `moduleResolution: nodenext`; `node16` reports TS1471. Issue #736 closed docs-only because its acceptance allowed documenting ESM-only; the `default` condition is the `require(esm)` fix.
  
  Published `.d.ts` files name no Node, workerpool, DOM or WebGPU global, so strict `tsc` with no `@types/node` passes. The `mathts-gpu` handle types are the WebGPU global types when the consumer has them, and interfaces of the package when it has not. `mathts-workerpool` ships a `browser` build (the worker is one classic script), so a bundler pulls no Node builtin into `mathts-compat`. README code fences carry a runtime tag. `functions/evaluate` is not a size saving; use `mathts-expression` for a small bundle.
- 9188123: `linsolve`, `lsolve` and `lu` / `luSolve` accept a `SparseMatrix` from `@danielsimonjr/mathts-matrix`. The sparse input is densified with `toDense()` before the solve; `usolve`, `lsolveAll` and `usolveAll` do the same. `densifyForSolver(input, { maxElements })` is the one helper behind them: it tests the input by shape, so it works with a second copy of the matrix package, and it throws a `RangeError` above `maxElements` (default 4096 x 4096). The shared decomposition input also accepts a `SparseMatrix`, so `qr`, `eig`, `svd` and `cholesky` densify it too. Previously these threw `Cannot read properties of undefined (reading 'length')`, `m.size is not a function` or a shape error.

### Patch Changes

- a66847e: `DenseMatrix.toArray()` copies each row straight from the storage. It no longer calls `get()` and its bounds check for every entry, and it honours the offset and the row stride of a view. `lusolve` on nested input reads the packed U factor with one `toFloat64Array()` copy. It no longer builds a nested copy of U, and it returns the n×1 column without a matrix wrapper.
- 9188123: `eig().repeatedEigenvalues` finds Jordan blocks of size 3 and more: a cluster of `m` eigenvalues links up to `2 * eps^(1/m) * ||A||_F` and is accepted when an orthogonal staircase of column-pivoted QR factorizations counts the multiplicity `m`. Distinct eigenvalues at the same spacing are not grouped.
  
  Breaking: `eig` and `eigvals` throw a `RangeError` on `NaN` or infinite input. Previously they returned `null` eigenvalues.
  
  `eig`, `svd`, `qr`, `cholesky`, `lu`, `lstsq` and `condest` accept a `SparseMatrix` from a second loaded copy of the package, and the element limit of `densifyForSolver` applies to them. `lsolve`, `usolve`, `lsolveAll`, `usolveAll` and `lusolve` accept a matrix-package `SparseMatrix` as the right-hand side.
- 9f3f5d6: `cov` and `corrcoef` take `{ rowvar: true }` for the NumPy layout (variables as rows). The default stays observations as rows. `corrcoef([[1, 2, 3], [4, 5, 6]], { rowvar: true })` returns the 2×2 matrix of `np.corrcoef` (#896). Rows of unequal length throw a `RangeError` in both layouts, where they gave `NaN`.
- 2635bbb: `add`, `subtract`, `multiply` and `divide` take a scalar and an Array, a `DenseMatrix` or a `SparseMatrix` and give the per-element results. The scalar is a `number`, `Unit`, `Complex`, `Fraction` or `BigNumber`. `add`, `subtract` and `multiply` accept both operand orders; `divide` accepts the collection first (`divide([1, 2], 2)` is `[0.5, 1]`). `multiply(new Unit(2, 'm'), [1, 2, 3])` threw `Too few arguments` because only `number` had a scalar-by-collection signature (#911). `divide(scalar, collection)` is a matrix division, which mathjs rejects for a vector; it throws a `TypeError` that names `dotDivide`.
- 531b343: Factory `median`, `mode` and `mad`, and `parallelFFT`, declare real return types in the published `.d.ts`. A strict consumer no longer needs a cast on their result. `median` and `mad` of a vector, a 2-D array, a `Float64Array` or a `Matrix` return `number`, and `mode` returns `number[] | number` (`NaN` for an empty input). `parallelFFT` accepts a `readonly number[]` or a `Float64Array` only: a call with a 2-D array, a `Matrix` or a `Float32Array` is now a compile error, because it gave NaN or threw at run time. The release notes of `mathts-statistics@0.4.15` and `mathts-functions@0.85.0` said that an empty `mode` returns `[]`; it returns `NaN`.
- efa8b4f: mod(x, 0) returns x on every path (#923): the typed number, bigint, Fraction and BigNumber kernels now follow the factory and mathjs. lcm(0, 0) and lcm(0n, 0n) return 0, not NaN or a throw. The public mod takes an Array or a matrix and applies the rule to each element, as the factory mod does, so mod([10, 20], 0) is [10, 20].
- 69f09cc: Public factories resolve their own default dependencies. `createParse()` and `createEvaluate()` run with no argument (#883, #924). `createParse(create(all))` builds the AST node constructors on the caller's math scope (#924). The string-to-Node converter on the shared typed instance belongs to `functions`: `createParse` registers none, so `parse` works in every load order (#937). `simplify` tests nodes by their structure, so a node from another parse simplifies like an own node (#937). Caller-supplied dependencies always win. The nodes of `createParse(create(all))` hide the same denylisted names as `math.evaluate` (`import`, `createUnit`, `parse`, ...), and parse reads a config accessor such as compat's `math.config` on each call, so `number: 'BigNumber'` holds. `create(all).typed` has every member of `mathTyped` (`addConversion`, `find`, ...).
- ece9539: `divide(scalar, M)` for a square matrix is `scalar * inv(M)`, as in mathjs. A non-square collection throws mathjs's RangeError (#960).
- f89e84d: `Distribution.sample(n)` returns a `Float64Array` of `n` draws, and `sample()` still returns one number. Before, `sample(5)` returned one number and ignored the argument. `sample(n, opts)` throws `TypeError` (use `sampleN(n, { seed })` for a seeded batch), and a negative, non-integer or non-finite `n` throws `RangeError`, as does `n` above 2**26 (67,108,864; the check runs before the allocation) (#899).
- 2635bbb: `propagateUncertainty` takes CODATA constants in `values`: the expression reads the SI magnitude of each constant, and its `.uncertainty` in SI is the sigma of that input (#910). The central-difference step starts at `relativeStep * max(|x|, sigma)` and then shrinks (when `f` overflows) or grows (when the difference is within rounding of `f`), so `exp(1e10 * x)` at `x = 1e-20` and at `0` give the right partial; the old `1e-30` floor gave `1e72` for `planckTime` and 0 for `exp` at 0. The result lists an input whose partial stays within rounding of 0 in `flat`. A covariance that leaves a constant's own uncertainty out (zero diagonal) throws and names the input. A positional callback `(m, c) => ...` throws an error that names the record form `({m, c}) => ...`. A non-finite sigma throws a `RangeError`, and the negative-variance tolerance is relative to the scale of the quadratic form. A `Unit` passed as `values` throws a `TypeError` that names the expected shape. The JSDoc of `evaluate` states which symbols (`G`, `hbar`, `c`, `h`) the default scope reads as units and which `{ physics: true }` binds as constants (#908, #909).
- 203ff66: The `solveODE` maxIter error for an explicit method (`RK23`, `RK45`) names the stiff methods `BDF`, `Radau`, `Rosenbrock` and `RODAS` as options, and no longer says the system is stiff. `sol.y[i]` is the state at `sol.t[i]`; the layout is documented and pinned. solveODESystem counts accepted steps as solveODE does: maxSteps equal to the steps a run needs succeeds, a rejected attempt does not use it, and its error names maxSteps and carries the stiffness hint. A NaN or infinite start throws a RangeError, and a right-hand side that turns non-finite ends in a step size underflow error.
- b5e7dd8: `welchPSD`, `bartlettPSD`, `stft` and `spectrogram` clamp a defaulted frame length (`frameLength`, `nperseg`, `windowSize`) to the signal length, as `scipy.signal.welch` clamps `nperseg`, so a 64-sample signal returns a 33-bin spectrum. An explicit frame longer than the signal still throws (`spectrogram` returns no frames). A frame that is not a power of two uses an exact-length DFT in `welchPSD`, `bartlettPSD`, `stft` and `istft`, so bin `k` is at `k / frameLength` and an `stft` frame has `nperseg` bins; `istft` reads the frame width from its input, and `istft(stft(x))` reconstructs the signal. `stft([])` returns no frames. `spectrogram` no longer throws for a one-sample window or loops for a `hopSize` below 1 (#897).
- Updated dependencies [a66847e]
- Updated dependencies [3e0fb02]
- Updated dependencies [e6a651b]
- Updated dependencies [9188123]
- Updated dependencies [2635bbb]
- Updated dependencies [aa76758]
- Updated dependencies [9188123]
- Updated dependencies [69f09cc]
- Updated dependencies [799b0fe]
- Updated dependencies [9188123]
- Updated dependencies [50c506c]
- Updated dependencies [b95de8a]
- Updated dependencies [9188123]
  - @danielsimonjr/mathts-matrix@0.11.0
  - @danielsimonjr/mathts-parallel@0.11.0
  - @danielsimonjr/mathts-core@0.28.0
  - @danielsimonjr/mathts-expression@0.14.0
  - @danielsimonjr/mathts-gpu@0.4.0

## 0.85.0

### Minor Changes

- d3313ec: `solvePDE` now throws `RangeError` when the explicit-Euler Fourier number `r = α Δt/Δx²` is outside the stable band `[0, 0.5]` (negative `α` included), unless `{ allowUnstable: true }` is passed. Non-finite `r` and non-finite `left`/`right` always throw. `solveParabolicPDE` validates Dirichlet/Neumann `{ type, value }` (number or `g(t)`) before integrating and rejects Robin, bare numbers, and non-finite coefficients or boundary samples so they cannot spin the BDF loop.
- 6c0194b: Expression lexer and sandbox: `/* */` and `//` comments; `parse("1e")` and `evaluate("1e")` now throw `SyntaxError` (incomplete scientific notation); parenthesis nesting accepts 125 levels per docs; evaluate sanitizes results so host scope objects (e.g. `process`) are not returned by identity; object literals skip forbidden keys at runtime. `substitute` uses resolve + simplifyConstant with constant folding.
- 25f7ffa: **Breaking:** `solve` now rejects non-string (matrix) input with a `TypeError` naming `linsolve` instead of returning `[]`. Quadratics such as `x^2 - 2` return symbolic radical strings (e.g. `sqrt(2)`) rather than floating approximations.
  
  **Breaking:** `evaluate('sum(i, 1, 3, i)')` (and similar four-argument indexed-sum misuse) now throws with guidance to use `summation`, instead of returning a complex variadic sum.
  
  Unify `integrate('1/x')` and `symbolicIntegral('1/x')` on `log(abs(x))`. `casDerivative` delegates to `derivative`. `integrate(fn, a, b)` dispatches numeric quadrature via `quad`. Polynomial `simplify`/`factor` canonicalize perfect squares as `(x+1)^2`.
- 5e692c5: ODE: `maxIter` counts accepted steps; richer max-step errors with stiffness hints; `stiffODESolver(f, tspan, y0)` matches `solveODE` (legacy order via `legacyArgumentOrder`).
- c4daa21: `lusolve` now throws when the LU factor is singular or non-finite, including consistent rank-deficient systems that previously returned a particular solution with free variables set to zero in `usolve`. The pivot floor is `1e-15` times the largest absolute entry (the same cutoff `linsolve` uses on a unit-scale matrix); numeric systems smaller than 1 are equilibrated so that floor stays relative to the matrix. Direct `usolve` still propagates NaN/±Infinity and still solves a tiny nonsingular triangle.
- 39e08ef: Real scalar `log`, `pow`, `nthRoot`, `acosh`, `atanh`, `asin`, and `acos` now match mathjs complex promotion when `predictable` is false. Previously these returned `NaN` for many out-of-domain reals. `predictable: true` preserves real-only `Math.*` results. Compat inverse-trig shims delegate to functions instead of calling `Math.asin` directly.

### Patch Changes

- ef236dc: Linear-time unit parsing with a 10k length cap; decibel (power) and neper (field) units; physics scope binds `e0`/`G`/`c`/`hbar` (bare `e` stays Euler — breaking for callers that read `physicsScope().e` as the elementary charge); CODATA 2022 absolute uncertainties on physical constants, `0` when the constant is exact. Dimensionless CODATA values (`fineStructure`, `weakMixingAngle`, `sackurTetrode`) stay usable as numbers via `valueOf` and also expose `.unc` (their runtime type is object).
- a85e335: Unary element-wise functions (`sin`, `cos`, `exp`, `log`, `sqrt`, `abs`, and the other synchronous trig and arithmetic unaries) accept `number[]`, nested arrays, and Matrix through one shared `Array | Matrix` signature. Flat numeric vectors still use the Float64Array kernel. Mixed elements dispatch per leaf, and `sqrt`/`log` of a negative promote to Complex the same way the scalar does. A Matrix result stays that matrix class while every value is a real number.
- adcebad: Packaging (G27): neutral esbuild bundles no longer resolve Node builtins (workerpool requires are indirect; natural sort is in-repo ESM). `@danielsimonjr/mathts-functions/evaluate` is the same safe evaluate as the root and a smaller bundle. Safe evaluate keeps parse, typed, createUnit, resolve, simplify, derivative, and node constructors unreachable. ESM-only migration note, GitHub blob URLs in package READMEs, and a deterministic README stats check.
- 17f64da: Fraction `toString` uses decimal form when the denominator is a power of ten (`0.1`), and `toJSON` emits numeric `n` and `d` when they are safe integers. `size` returns a Matrix when `config.matrix` is `Matrix`, including for native dense matrices, and that matrix stringifies as `[2, 3]`. `createUnit` replaces an existing unit only when `{ override: true }` is passed. Unit conversions keep exact rational scales, so `1 L` is `1000 mL`.
- e47134f: Document `gammaDist` rate parameterization and add `{ scale }` option for SciPy parity. Positional second argument remains **rate**; `gammaDist(2, { scale: 2 })` matches SciPy `stats.gamma(a=2, scale=2)`.
- 0421fec: Public FFT/signal fixes (dogfood G18): factory `fft` accepts `Float64Array`; `@danielsimonjr/mathts-signal` exports `fft`/`ifft` aliases; `welchPSD`/`bartlettPSD` throw when the signal is shorter than the frame; `resample(x, num)` matches SciPy Fourier resample; `windowFunction` accepts SciPy `(type, length)` argument order.
- b5f036d: Publish public call overloads generated from the live typed-function signatures (add, abs, sqrt, exp, log, trig, mean, variance, std, det, evaluate), keep them in sync with a failing check, fix `Unit` as a type via interface merge, and stop referencing `@webgpu/types` so consumers resolve WebGPU names from the TypeScript DOM lib.
- e817055: `studentTTest(sample, popmean)` runs a one-sample t-test against the hypothesized mean (SciPy `ttest_1samp`) instead of treating a numeric second argument as a second sample and returning NaN. Non-finite or non-array/non-number second arguments throw `TypeError`.
- 43e2715: G26 dogfood: faster number sort/median, blocked GEMM, packed `lusolve`, compat scalar fast path, wasm sin policy band, SVD README note.
- 0badf5b: Add mathjs instance methods (`import`, `typed`, `compile`), matrix `subset` via factory bridge, JSON reviver for Unit/BigNumber, and honest migration guide gap table (dogfood G16).
- e51c0d5: Descriptive statistics: NumPy `{ ddof }` on typed `variance`/`std`, `{ skipNaN: true }` and `nanmean`/`nanmedian`/`nanvariance`, `Float64Array` on median/mode/quantileSeq/mad/corr, constant-input variance fast path for huge magnitudes, and empty `median`/`mad` return `NaN` (empty `mode` returns `NaN`).
- 7247de3: Reject nullish and invalid operands in core scalar helpers and typed `add`/`multiply` instead of crashing on `.im` or coercing strings to Complex.
- a07bf29: Packaging P2 (dogfood G29): ship LICENSE in tarballs, homepage/bugs links, `exports['./package.json']`, honest `sideEffects`, JS source maps from tsdown, and workerpool types that typecheck without `@types/node` (via updated `@danielsimonjr/workerpool` patch).
- 93c6e56: Normalize decomposition inputs: `svd`, `lu`, `qr`, `cholesky`, `eig`, and `matrixSchur` accept `DenseMatrix`, nested arrays, square `Float64Array`, and `{ data, rows, cols }`; ragged and unknown inputs throw `TypeError`. `lusolve` accepts square packed `Float64Array` and that descriptor, and still accepts an `{ L, U, p }` decomposition.
- 064c834: Bind Unicode `π` and `√` in the default evaluate scope; throw on IEEE numeric literal overflow, including decimals; keep compiler and dispatch symbols (`parse`, `typed`, `createUnit`, `resolve`, and the other forbidden calls) out of the safe evaluate namespace and out of the namespace expression callbacks compile against; fix expression README MathML sample and sandbox docs.
- ca97716: `Unit.add` for same-dimension addition; incompatible unit `add`/`subtract` throw `DimensionMismatchError`. `new Unit(NaN, …)` and non-finite numeric values throw `TypeError: Unit value must be finite`.
- 5a0b2e1: SciPy/NumPy parity for dogfood stats leftovers (G30): stable Pearson/linregress p-values, Kendall exact small-n default, NumPy quantile methods, `describe` quartiles, KS norm names and scipy `auto` two-sample p-values, heatmap colorbar/labels.
- Updated dependencies [ef236dc]
- Updated dependencies [adcebad]
- Updated dependencies [ea94cc4]
- Updated dependencies [e4900c1]
- Updated dependencies [17f64da]
- Updated dependencies [8d727a1]
- Updated dependencies [b5f036d]
- Updated dependencies [43e2715]
- Updated dependencies [6c0194b]
- Updated dependencies [7247de3]
- Updated dependencies [e7939a7]
- Updated dependencies [fd3cbef]
- Updated dependencies [72df4ec]
- Updated dependencies [a07bf29]
- Updated dependencies [93c6e56]
- Updated dependencies [064c834]
- Updated dependencies [ca97716]
  - @danielsimonjr/mathts-core@0.27.0
  - @danielsimonjr/mathts-matrix@0.10.1
  - @danielsimonjr/mathts-parallel@0.10.1
  - @danielsimonjr/mathts-gpu@0.3.0
  - @danielsimonjr/mathts-expression@0.13.0

## [Unreleased]

### Minor Changes

- CAS (G21): polynomial `simplify` / `factor` collapse repeated linear factors to powers (e.g. `(x+1)^2`). `integrate('1/x')` and `symbolicIntegral('1/x')` both use `log(abs(x))`. `casDerivative` matches `derivative`. `solve('x^2-2')` returns symbolic `±sqrt(2)`. `integrate(fn, a, b)` uses `quad` for JS functions.

### Breaking Changes

- `solve([[A]], b)` throws with a message naming `linsolve` (was `[]`). Some `solve` results are symbolic strings instead of floats.
- `sum(body, lo, hi, index)` misuse (e.g. `sum(i,1,3,i)` with imaginary unit `i`) throws; use `summation(expr, index, lo, hi)`.

### Patch Changes

- Expression G32a: `substitute` resolves and constant-folds via `simplifyConstant` (Fixes #724).
- Unit `add`/`subtract` throw exported `DimensionMismatchError` when dimensions differ (Fixes #826).
- Synchronous unary element-wise functions (`sin`, `cos`, `tan`, `abs`, `exp`, `log`, …) accept flat `number[]` and return `number[]` with the same values as the `Float64Array` path (Fixes #692).

## 0.84.0

### Minor Changes

- dca8981: Add `mat3ToQuat`, an allocation-free conversion of a column-major 3x3 rotation matrix to a unit quaternion `[w, x, y, z]` (Shepperd method). It uses the out-parameter style of the vec3/quat/mat3 kernels, and it uses the Shepperd branches of `mat4Decompose`.

## 0.83.0

### Minor Changes

- 52e586e: Add `solveBoxLcp`, a dense box-constrained LCP solver by projected Gauss-Seidel (w = A x - b, lo <= x <= hi). It supports friction bounds coupled to another variable (`findex`, |x_j| <= mu x_i), warm start through an in/out `x`, over-relaxation, and a reusable result object, so a solver loop makes no allocation (issue 379).
- 2f73d66: Add a deterministic mode (issue 380). `setDeterministic(true)` from `@danielsimonjr/mathts-core` (or `config({ deterministic: true })` from functions) makes results bit-identical whether or not the WASM tier is loaded: only the WASM kernels measured bit-identical to JS (`abs` on a `Float64Array`) still run, and implicit WebGPU, worker-pool parallelism, the integration and sampling fan-outs, and the WASM matrix backend are skipped. See `docs/determinism.md`.
- ff20f7c: Add allocation-free mat4 and frustum kernels (issue 381): `mat4Multiply`, `mat4Invert`, `mat4Compose`, `mat4Decompose`, `mat4LookAt`, `mat4Perspective` and `mat4Orthographic` (both with a `depthRange` of `'negative-one-to-one'` or `'zero-to-one'`), and `frustumFromMatrix`, `frustumContainsPoint`, `frustumIntersectsSphere` and `frustumIntersectsAabb`. They use the out-parameter style of the vec3/quat/mat3 kernels, and a fixture test pins them to fourJS `Matrix4` and `Frustum` bit for bit on finite input (except `mat4Determinant`, which sums in another order so that V8 inlines it).
- be1a7de: Add `eigSym3`, an allocation-free eigen-decomposition of a symmetric 3x3 matrix (cyclic Jacobi; ascending eigenvalues and an orthonormal right-handed eigenvector matrix), and the inertia-tensor operations `rotateTensor` (R I Rᵀ) and `parallelAxis` (Steiner's theorem). They use the conventions of the fixed-size kernels: column-major 3x3, caller-supplied outputs at offsets (issue 377).

### Patch Changes

- Updated dependencies [2f73d66]
  - @danielsimonjr/mathts-core@0.26.0
  - @danielsimonjr/mathts-parallel@0.10.0
  - @danielsimonjr/mathts-matrix@0.10.0
  - @danielsimonjr/mathts-expression@0.12.7

## 0.82.0

### Minor Changes

- 7dbceb5: Add allocation-free fixed-size kernels for 2-vectors, 3-vectors, quaternions and 3x3 matrices (`vec2Add` … `vec3Cross`, `quatMultiply`, `quatRotate`, `quatIntegrate`, `quatNormalize`, `quatConjugate`, `mat3Multiply`, `mat3MulVec`, `mat3Transpose`, `mat3Inverse`). Each kernel writes into a caller-supplied `out` at an offset, reads all inputs before it writes, and gives the same bits as its allocating twin. A solver loop can call them on `Float64Array` storage without garbage (issue 375).

## 0.81.0

### Minor Changes

- 47dac0f: Three new quaternion conversions: `quaternionToAxisAngle`, `quaternionFromRotationMatrix` and `quaternionFromEuler`. Each new function is the inverse of a function that the package has: `quaternionFromAxisAngle`, `quaternionToRotationMatrix` and `quaternionToEuler`. `quaternionToAxisAngle` gives a unit axis and an angle in `[0, π]`. `quaternionFromRotationMatrix` uses the method of Shepperd.

### Patch Changes

- 790360f: The quaternion functions are in one module and accept a quaternion of any finite, non-zero magnitude, components near `1e200` or `1e-200` included. `quaternionRotate`, `quaternionToRotationMatrix`, `quaternionSlerp`, `quaternionToEuler` and `quaternionLog` gave a wrong result for a non-unit quaternion. The functions now read the quaternion as the rotation of its unit form. `quaternionToEuler` gives angles that rebuild the rotation at pitch ±90°. `quaternionFromAxisAngle` throws on a zero or non-finite axis. The functions that divide by the magnitude throw on the zero quaternion and on a quaternion that is not finite. The exported names and signatures are the same.

## 0.80.1

### Patch Changes

- 2b8dc33: Add or correct the doc comments of exported symbols, so the published declarations describe them. `create` in compat now carries its own doc comment. The change is to comments only: the emitted JavaScript is unchanged.
- Updated dependencies [2b8dc33]
  - @danielsimonjr/mathts-expression@0.12.6
  - @danielsimonjr/mathts-matrix@0.9.6

## 0.80.0

### Minor Changes

- 685a2b4: Non-finite inputs (NaN, +Infinity, -Infinity) no longer hang or give a wrong number.
  
  Behaviour changes (the reason for the minor bump):
  
  - The typed `compare(NaN, x)` and `compare(x, NaN)` return `-1`, the same as mathjs and the factory `compare`. Before, they returned `0`. No function in the package calls the typed `compare`; `sort` and `partitionSelect` use the factory `compare`, which already returned `-1`.
  - New throws:
    - `nextPrime(n)` throws a `RangeError` when `n` is not finite or `n >= Number.MAX_SAFE_INTEGER`. Before, `nextPrime(Infinity)` looped forever, `nextPrime(NaN)` returned `NaN`, and a finite `n` at or above the safe-integer limit gave an inexact result.
    - `range` throws a `RangeError` when an infinite start or end gives an unbounded range. Before, it looped until memory ran out.
    - `shortestPath` throws a `TypeError` when `adj` is not an array, and a `RangeError` when `start` or `end` is not an integer. This changes one finite input: `shortestPath(adj, 0.5, 1)` returned `[]` and now throws. Before, a non-integer `end` looped forever.
    - `quad` (and `nintegrate` and `arcLength`, which call it) throws a `RangeError` for a NaN or infinite bound. Before, an infinite bound bisected to depth 50 and did not end in practice.
    - `owensT` throws a `TypeError` when an argument is missing.
    - `zipfPMF(k, s, Infinity)` throws a `RangeError`. Before, its normalising sum looped forever.
  
  Fixes:
  
  - `gcd`, `lcm` and `xgcd` return `NaN` (`xgcd`: `[NaN, NaN, NaN]`) for a NaN or infinite argument in either position. Before, they looped forever.
  - `isPrime(Infinity)` returns `false`; before, it looped forever. `isPrime(NaN)` returns `false` (was `true`).
  - `owensT(h, Infinity)` returns `(1 - Phi(|h|)) / 2`, and `owensT(h, -Infinity)` the negative value. Before, both did not end. `owensT` with a NaN argument returns `NaN`.
  - `ferrersP` with an infinite degree or order, `siegelZ` / `riemannSiegelZ` at +-Infinity, and `trigamma` / `polygamma` at -Infinity return `NaN`. Before, they looped forever.
  - `acoth`, `asech`, `acsc` and `asec` give the complex result off their real domain (for example `acoth(0.5)`). Before, they threw `TypeError: ... is not a function`, because the core Complex type has no such methods.
  - A NaN in any argument gives `NaN` for `fQuantile`, `gammaQuantile`, `studentTQuantile`, `studentizedRangeCDF`, `studentizedRangeQuantile`, `jacobiSN`, `jacobiCN`, `jacobiDN`, `skellamPMF`, `zipfPMF`, `clamp` (a NaN bound) and `ferrersP` (a NaN `x`). Before, they returned a finite number (for example `studentTQuantile(NaN, 2)` gave about -1000), or threw for a NaN parameter (`studentizedRangeQuantile`, `skellamPMF`). Every distribution object's `quantile(NaN)` also gives `NaN`.
  - `erfc(NaN)` (JS and the AssemblyScript kernel), `normalCDF` with a NaN in any position, `primePi(NaN)`, the three-argument median and `zeta(NaN)` return `NaN`. Before, they returned 2, 1, 0, a sorted element and 1.
  
  Other finite inputs give the same results as before.

## 0.79.0

### Minor Changes

- 2c631ff: **Cost.** Before this change, these signatures sent arrays of 50 000 elements or more to worker threads. Now they run on the calling thread. The table gives the speed of the old worker path divided by the speed of the new synchronous path. The values come from 3 alternating old/new runs (medians of 9) at 5e4, 5e5 and 5e6 elements. A second build ran on the same computer, and the CPU load was 59-100% for most of the runs, so each cell gives the range over the runs. The ratios are not stable enough to give one break-even size.
  
  | Functions                                                         | Old worker path, faster by                                                                                               |
  | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | `erfc`, `erfi`, `digamma`, `lambertW`, `besselK`                  | 1.2-8.6x                                                                                                                 |
  | `normalCDF`                                                       | 0.6-6.1x                                                                                                                 |
  | `sinIntegral`, `fresnelC`, `legendreP`                            | 0.2-4.1x                                                                                                                 |
  | `poissonPMF`                                                      | 0.09-0.67x (the synchronous path is faster)                                                                              |
  | `fft2d`                                                           | 0.3-1.3x                                                                                                                 |
  | `spectrogram`                                                     | 0.16-2.7x                                                                                                                |
  | arithmetic and trigonometry unary ops                             | 0.2-2.1x (`sign`, `floor`, `ceil`, `fix`, `log10` and `atanh` are faster now)                                            |
  | `matmul` (against `computePool.matmul`, 32 to 512 square, 3 runs) | 0.49-1.06x. The workers are about equal to the synchronous path near 96x96 to 128x128, and slower at 64x64 (0.49-0.63x). |
  
  **To use worker threads**, call the path that the `parallel` package documents. The tests in `functions/tests/worker-kernel-paths.test.ts` show that each path reaches the workers (`parallelized === true`) and gives the synchronous result bit for bit:
  
  - Special functions and distributions: `computePool.applyKernel(x, workerKernel(name, ...params))`. `workerKernel` is a new export. It gives the kernel source of the 31 element-wise special functions and the 8 element-wise distributions. Give the scalar parameters in the order of the typed signature. Do not give the array. For example, use `workerKernel('besselK', n)` and `workerKernel('normalCDF', mu, sigma)`. Too few or too many parameters throw an `Error`. Only `normalPDF` and `normalCDF` have optional parameters (mu = 0, sigma = 1).
  - `fft2d` and `spectrogram`: put the frames in one buffer and call `computePool.fftBatch(real, imag, frameCount, frameLength)`.
  - Element-wise arithmetic and trigonometry: the `computePool` method (for example `computePool.add`) or `computePool.applyKernel`.
  - `matmul`: `computePool.matmul`.
  
  **Changed functions.** These typed signatures are now synchronous. They return the value, not a `Promise`, so code that calls `.then` on the result breaks. `await` on the result still works.
  
  - Trigonometry, `Float64Array`: `sin`, `cos`, `tan`, `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`. The WASM tier stays first.
  - Bitwise, `Int32Array`: `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift`, `rightArithShift`, `rightLogShift`. A length mismatch now throws `RangeError('Dimension mismatch (m != n) in element-wise operation')`. Before, the error was `Error('<op>: lengths must match (<m> vs <n>)')`.
  - Matrix helpers: `matmul`, `transpose`, `matvec`, `outer`. `matmul` uses `matmulSequential`, the kernel of the worker path, so the results are equal bit for bit.
  - Matrix operations: `matMul`, `characteristicPolynomial`, `matrixPower`, `matrixLog`, `polarDecomposition`, `jordanForm` and the other functions of `matrix-ops`.
  - Integration: `trapzF64`, `simpsonF64`. They now sum with `pairwiseSum` at every size. Before, a naive loop ran below 65 536 terms. So the last bits of the result change when there are more than 8 terms.
  - Integration, **breaking**: `gaussQuad` and `romberg` are synchronous and return `number`. They do not use the pool. The `workerCount` fan-out moved to the new async exports `parallelGaussQuad` and `parallelRomberg`, with the same options. `gaussQuad` and `romberg` throw a `TypeError` that names the parallel export when `workerCount > 1`. Give the fan-out a self-contained closure such as `(x) => Math.sin(x)`. `Math.sin` itself cannot go to a worker, because its source is `[native code]`.
  - Signal: `fft2d`, `spectrogram`. `parallelFFTMagnitude` and `parallelFFTPower` stay async.
  - Special functions, `Float64Array`: the 31 functions that `workerKernel` names, for example `erfc`, `lgamma`, `besselJ0`, `besselK`, `airyAi`, `fresnelC`. The WASM tier stays first.
  - Distributions, `Float64Array`: `normalPDF`, `normalCDF`, `exponentialPDF`, `exponentialCDF`, `poissonPMF`, `binomialPMF`, `geometricPMF`, `bernoulliPMF`.
  
  **Fixed.** A non-finite order (`NaN`, `Infinity`, `-Infinity`) now gives `NaN` for `besselJ`, `besselY`, `besselK`, `chebyshevT`, `hermiteH`, `laguerreL` and `legendreP`. Before, a call with an infinite order never returned, and a call with a NaN order gave a number (for example `besselK(NaN, x)` gave K1(x)).

### Patch Changes

- Updated dependencies [2c631ff]
- Updated dependencies [2c631ff]
  - @danielsimonjr/mathts-parallel@0.9.0
  - @danielsimonjr/mathts-matrix@0.9.5

## 0.78.0

### Minor Changes

- e898069: The `Float64Array` signatures of the arithmetic functions are now synchronous (#384). `add`, `subtract`, `multiply` (pair, `Float64Array * number`, `number * Float64Array`), `divide`, `unaryMinus`, `abs`, `sign`, `sqrt`, `square`, `cube`, `cbrt`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `sinh`, `cosh` and `tanh` return a `Float64Array` instead of a `Promise<Float64Array>`. `norm`, `min`, `max` and `dot` return a number instead of a `Promise<number>`. `await` on the result still works, but `.then` on the result does not.
  
  The binary ops throw `RangeError: Dimension mismatch (m != n) in element-wise operation` when the lengths differ. Before, the worker pool rejected the Promise. Variadic `add(a, b, c)` on `Float64Array` now works.
  
  Fourteen of these ops (`sign`, `cube`, `cbrt`, `log10`, `log2`, `log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `sinh`, `cosh`, `tanh`) sent arrays of 50,000 elements or more to worker threads. Measured with `tools/benchmarks/sync-unary-kernels.mjs` (the shipped synchronous function after `loadWasm()` against `computePool.applyKernel`, medians of 9, at 5e4 / 5e5 / 5e6 elements): workers are slower on 8 of them (`sign`, `cube`, `cbrt`, `log10`, `round`, `floor`, `ceil`, `fix`: 0.23x to 0.93x). With the WASM tier loaded, workers reach only 0.39x to 0.48x of the speed of the shipped `log10`. Workers are faster on `log2` (1.36x to 1.64x), `log1p` (1.73x to 1.81x), `expm1` (1.56x to 1.68x), `cosh` (1.09x to 1.27x), `sinh` (1.03x to 1.68x) and `tanh` (1.89x to 2.17x). For those, call `computePool.applyKernel` or `parallelMap` from `@danielsimonjr/mathts-parallel` on large arrays.
  
  `thresholdByOp` and `thresholdElements` no longer send these typed calls to workers: `dot`, `norm`, `min`, `max` and the 14 unary ops above always run in the calling thread. A length mismatch in `add`, `subtract`, `multiply` or `divide` now throws `RangeError("Dimension mismatch (m != n) in element-wise operation")`, not the worker error `Error("<op>: lengths must match (m vs n)")`; `dot` throws `Error("Vector lengths must match: m vs n")`, as `dot` on plain arrays does. The standalone helpers `matmul`, `transpose`, `matvec` and `outer` in the same file stay async.

## 0.77.3

### Patch Changes

- Updated dependencies [42f3c97]
  - @danielsimonjr/mathts-core@0.25.0
  - @danielsimonjr/mathts-expression@0.12.5
  - @danielsimonjr/mathts-matrix@0.9.4
  - @danielsimonjr/mathts-parallel@0.8.4

## 0.77.2

### Patch Changes

- Updated dependencies [e7a003e]
  - @danielsimonjr/mathts-core@0.24.0
  - @danielsimonjr/mathts-expression@0.12.4
  - @danielsimonjr/mathts-matrix@0.9.3
  - @danielsimonjr/mathts-parallel@0.8.3

## 0.77.1

### Patch Changes

- Updated dependencies [3628d5a]
  - @danielsimonjr/mathts-core@0.23.0
  - @danielsimonjr/mathts-expression@0.12.3
  - @danielsimonjr/mathts-matrix@0.9.2
  - @danielsimonjr/mathts-parallel@0.8.2

## 0.77.0

### Minor Changes

- 22cb17e: Type the `gcd` results: `gcd(number, number)` returns `number`. `gcd(bigint, bigint)` returns `bigint`. `gcd(BigNumber, BigNumber)` returns `BigNumber`. Export the `GcdFunction` type.

## 0.76.0

### Minor Changes

- 5fa92f7: Add `wilsonInterval`, `newcombePairedInterval` (Newcombe 1998 method 10) and `cohensKappa`.

## 0.75.1

### Patch Changes

- 19fca38: `rootsLegendre` weights are within 1e-15 relative of 60-digit values for n = 2 to 64 (8.3e-14 at n = 16 before). The weight is evaluated at the final Newton node, in double-double, and corrected from the rounded node to the exact root. The call is about 3.4 times slower at n = 64 (0.68 ms against 0.20 ms).

## 0.75.0

### Minor Changes

- c4ba088: Add `chiSquaredSF(x, df)` and `fSF(x, d1, d2)`, survival functions computed directly in the upper tail. `mcnemar` takes its p-value from `chiSquaredSF`, so a far tail is no longer 0.

### Patch Changes

- c491a7e: `kruskalWallis`, `jarqueBera`, `chi2Contingency`, `cochranQ`, `moodMedianTest`, `powerDivergence`, `gTest` and `ljungBox` take their p-value from `chiSquaredSF`, and `fTest` takes its upper tail from `fSF`. A p-value below about 1e-16 was 0 and is now the scipy value.

## 0.74.0

### Minor Changes

- 3e0e278: `evaluateScalar`, `compileScalar` and `compileScalarGradient` read a one-argument `-` as negation, `(-1) * x`. Before, they returned the argument unchanged, so `-x` at x = 3 gave 3 and a gradient of 1. A one-argument `+ * /` still returns its argument. `scalarToNode` is unchanged: a one-argument `-` still maps to a one-argument `subtract`, which `Node.evaluate` refuses.
- ed1ab85: `studentTTwoSidedP(t, df)` is exported. It returns the two-sided Student-t p-value, computed directly in the tail with the regularized incomplete beta.

### Patch Changes

- 05ef781: `binomialTest` divides the included probability by the computed total mass of the n + 1 pmf terms. An equal split now gives a p-value of exactly 1 (it was 0.9999999999998926 at 500 of 1000), and an asymmetric count keeps the scipy value.

## 0.73.0

### Minor Changes

- 6e3a978: `sum`, `mean`, `variance` and `std` on `Float64Array` now return a number instead of a Promise, and `Float32Array` is accepted. `await` still works, but calling `.then` on the result does not. `parallelStat*` functions stay async.
- 2979fc5: `rationalNullspace` accepts `bigint` matrix cells. A `bigint` cell is exact and is read as `new Fraction(cell, 1n)`.
- c042500: `unitToRationalDimension` accepts `options.mapUnit` so a caller can supply the seven-axis dimension of a unit (such as `bit`), and `searchScalars` accepts `dimensions.equal` to replace the default dimension equality in infer mode.

### Patch Changes

- e53b514: `leastSquares` equilibrates the columns before the normal equations, so a well-conditioned system with entries near 1e-9 no longer throws "singular matrix".
- Updated dependencies [09b4dde]
- Updated dependencies [ac4212b]
- Updated dependencies [2a6c91d]
- Updated dependencies [0de3d7a]
- Updated dependencies [2fd73e8]
  - @danielsimonjr/mathts-core@0.22.0
  - @danielsimonjr/mathts-expression@0.12.2
  - @danielsimonjr/mathts-matrix@0.9.1
  - @danielsimonjr/mathts-parallel@0.8.1

## 0.72.0

### Minor Changes

- b8d55ee: Add statistics from the 2026-11 gap analysis (Batch A): weighted statistics (`weightedMean`, `weightedVariance`, `weightedMedian`, `weightedQuantile`), robust and generalized means (`pmean`, `gstd`, `gzscore`, `theilSen`, `siegelSlopes`, `partialCorrelation`), effect sizes (`cohensD`, `hedgesG`, `glassDelta`, `etaSquared`, `rankBiserial`), distributions (`owensT`, skew-normal, truncated normal, inverse gamma, GEV, `skellamPMF`, `zipfPMF`, `nakagamiPDF`, `ricePDF`), nonparametric tests (`signTest`, `runsTest`, `moodMedianTest`, `powerDivergence`, `gTest`, `jackknife`), and distances (`wassersteinDistance`, `energyDistance`, `mutualInformation`, `ecdf`).
- b8d55ee: Add numerical methods: `differentialEvolution`, `simulatedAnnealing` (global optimizers); `minimizeConstrained` (augmented Lagrangian); `rootsHermite`, `rootsLaguerre`, `rootsChebyshevT`, `rootsChebyshevU`, `rootsJacobi`, `gaussHermiteIntegrate`, `gaussLaguerreIntegrate` (Gauss nodes); `tanhSinh`, `clenshawCurtis`, `dblquad`, `tplquad` (quadrature); `finiteDifferenceCoefficients`, `ridders`, `fixedPoint` (finite differences and scalar solvers).
- b8d55ee: Add number-theory, integer-matrix and real-root utilities: modular arithmetic (`modPow`, `prevPrime`, `legendreSymbol`, `sqrtMod`, `isCarmichael`), arithmetic functions and exact integer roots (`isSquarefree`, `radical`, `bigOmega`, `smallOmega`, `liouvilleLambda`, `vonMangoldt`, `mertens`, `isPerfect`, `isPerfectPower`, `isPrimePower`, `integerSqrt`, `integerNthRoot`, `digitSum`, `digitalRoot`, `collatzSteps`, `primorial`), integer sequences and enumerators (`motzkin`, `narayana`, `schroder`, `delannoy`, `pell`, `tribonacci`, `eulerianNumber`, `lahNumber`, `integerPartitionsGen`, `compositionsGen`, `grayCode`, `binomialMod`), Diophantine solvers (`linearDiophantine`, `pellSolve`, `frobeniusNumber`, `zeckendorf`, `sumOfTwoSquares`, `egyptianFraction`, `fareySequence`), integer normal forms (`hermiteNormalForm`, `smithNormalForm`, `lll`), and real-root isolation (`sturmSequence`, `sturmRootCount`, `descartesSignChanges`, `isolateRealRoots`, `realRoots`).
- b8d55ee: Add signal-processing functions: `conv2` and `sinc` re-exports; window family `kaiserWindow`, `gaussianWindow`, `tukeyWindow`, `blackmanHarrisWindow`, `nuttallWindow`, `flattopWindow`, `bohmanWindow`, `parzenWindow`, `cosineWindow`, `exponentialWindow`, `getWindow`; waveforms `chirp`, `squareWave`, `sawtooth`, `gaussPulse`, `unitImpulse`, `sweepPoly`; `lombScargle`; `impulseResponse`, `stepResponse`, `tf2ss`, `ss2tf`, `cont2discrete`, `iirNotch`, `iirPeak`, `tf2zpk`, `sos2tf`; `dtw`.
- b8d55ee: Add special functions: `erfinv`, `erfcinv`, `erfcx`, `dawson`, `expIntegralE1`, `expn`, `sinhIntegral`, `coshIntegral`, `sphericalBesselJ/Y/I/K`, `hankelH1`, `hankelH2`, `besselJZeros`, `wigner3j`, `clebschGordan`, `wigner6j`, `sphericalHarmonic`, `hurwitzZeta`, `dirichletEta`, `bernoulliPolynomial`, `eulerPolynomial`.
- b8d55ee: Add special matrices (`hilbertMatrix`, `invHilbertMatrix`, `hadamardMatrix`, `pascalMatrix`, `dftMatrix`, `hankelMatrix`, `blockDiag`, `khatriRao`, `fiedlerMatrix`, `leslieMatrix`, `helmertMatrix`), linalg extras (`subspaceAngles`, `signm`, `fractionalMatrixPower`, `choleskyUpdate`, `choleskyDowndate`), geometry predicates (`orient2D`, `orient3D`, `inCircle`, `pointInTriangle`, `barycentricCoordinates`, `polygonIsConvex`), polygon operations (`polygonClip`, `minkowskiSum`, `earClipping`) and curve/distance utilities (`douglasPeucker`, `hausdorffDistance`, `frechetDistance`, `closestPair`, `minimumEnclosingCircle`, `catmullRom`, `arcLength`, `curvature`).

### Patch Changes

- 8a731dc: `searchScalars` accepts opt-in `loss` (`'l2' | 'l1' | 'huber'`, default `'l2'`) and `rowWeights`. Ranking and every parameter refit use that same named loss from `fitScalarParameters`. Omitted options leave the seed-7 pin unchanged.
- cb18d71: `searchScalars` accepts an opt-in `invalidRows` policy (`'reject'` or `'penalize'`, default `'reject'`). `'penalize'` ranks a tree that is invalid on some rows as `INVALID_ROW_PENALTY` (`1e8`) times each invalid row with positive weight, plus the chosen `loss` on the valid rows, instead of `+Infinity`. Zero-weight rows are omitted. Omitted, the seed-7 pin is unchanged.
- 67e132f: `searchScalars` accepts opt-in `complexityWeights` (`ScalarComplexityWeights` from `@danielsimonjr/mathts-expression`). The hall of fame, the elitist-truncation complexity tie-break, and adaptive parsimony's complexity key all rank by `scalarComplexity(node, weights)`; omitted weights are `{}`, today's node count, so the seed-7 pin is unchanged. A non-finite weight throws `RangeError` before the first yield.
- 1de5cfb: `searchScalars` accepts opt-in `simplify` (`'off' | 'constants' | 'algebraic'`, default `'off'`). `'constants'` runs the existing `simplifyConstants` on each seed and each bred offspring before the grammar check and the score; `'algebraic'` runs the existing `simplifyScalar`. When `simplifyScalar` throws `ScalarBuildError` or `RangeError`, or its result fails the grammar (including `admit`), or row-wise evaluation on positively weighted rows disagrees with the original, the tree keeps its unsimplified shape. Simplification runs once per seed or offspring, before the refit coin. Enumerated trees are not simplified. Simplification draws no randomness, but different accepted trees can change mutation outcomes relative to `'off'`; two runs with the same mode and seed still match. `ScalarSearchResult.simplifyFallbacks` counts unsimplified fallbacks. Omitted, the seed-7 pin is unchanged.
- 4245556: SR-16: add `runScalarSearch`, a thin wrapper that consumes the `searchScalars` generator and returns the final `ScalarSearchResult`. It accepts `seed` instead of a required `rng` (exactly one of the two), accepts `columns` as a record keyed by variable name, and adds the `bestLossFactor` search option, forwarded to `selectFrontModel` when `modelSelection` is set (a non-finite factor throws `RangeError` before the search starts).
- 80433ef: `searchScalars` honors `grammar.admit` on seeds and mutation offspring. A rejected seed is skipped; a rejected child is a failed mutation attempt. `admit` must be a pure function of the node. When `admit` is omitted the seed-7 pin is unchanged.
- d296f2b: SR-9: dimensional and unit filter for the scalar search. `unitToRationalDimension(unitName)` maps SI units through the existing `Unit` table (angle/solid-angle units to a dimensionless 7-vector; `bit`/`byte` throw `UnitParseError`). `searchScalars` gains opt-in `dimensions` (`symbols`, `target`, `onUnderdetermined`): infer and solve paths both require the scored tree's root dimension to equal `target`; unused listed parameters no longer trigger `'reject'`; violations and inconsistent solves score `Infinity`; underdetermined trees are kept by default. The filter is snapshotted before the first yield. Omitted `dimensions` leaves the search unchanged.
- 9f8c4e7: `searchScalars` keeps one hall entry per canonical tree at add time. When two evaluated trees share a `scalarCanonicalKey`, the survivor has the smaller loss, then the smaller stored complexity, then the one recorded first; a better same-key arrival evicts the old tree and frees its complexity slot. Complexity weights affect reported complexity only, not dedup. Negative complexity weights throw `RangeError`. Omitted options: the seed-7 pin is unchanged.
- f312049: `searchScalars` accepts opt-in `crossoverProbability` (default 0). At 0 the coin is not drawn and the seed-7 pin is unchanged. Above 0, a successful coin draws a second tournament parent and `crossoverSubtrees`; failure falls through to mutation. The inherited parameters stay the first parent's.
- ccb51a6: `searchScalars` accepts an opt-in `fit` object (`restarts`, `maxIterations`, `bounds`, `algorithm`, `initial`) forwarded to `fitScalarParameters`. Omitted fields are today's refit call (restarts 2, maxIterations 8, no bounds, the fitter's default algorithm, the inherited start vector), so the seed-7 pin is unchanged.
- fa0d39c: `searchScalars` accepts an opt-in `signal: AbortSignal`, checked before the initial population and between generations (never mid-draw): already aborted before the first yield the result carries an empty front and `evaluations: 0`; aborted after a yield the last progress is returned as the result, both with the new `stopReason: 'cancelled'`, and a pool the search owns is still terminated. When `signal` and `earlyStop` both apply on the same between-generation check, `'cancelled'` wins. It also accepts opt-in `earlyStop: { loss, generations }`: once the best finite hall loss has been `<= loss` for `generations` consecutive generations (hall after the generation, initial population included) the run ends with `stopReason: 'early-stop'` on the between-generation check after that yield (not after the budget is exhausted). Invalid `earlyStop` still throws before the first yield, including when the signal is already aborted. Omitted, both options change nothing and the seed-7 pin is unchanged.
- 3cb9f92: Raise `SCALAR_PARALLEL_MIN_ROWS` from 100 to 10_000 from SR-14 reused-pool measurement (search driver pool lifetime).
- Updated dependencies [36e8d0c]
  - @danielsimonjr/mathts-expression@0.12.1

## 0.71.0

### Minor Changes

- 78f8a1c: `solveODE`, `freqz` and `zpk2tf` now have precise call signatures and result types (`SolveODESolution`, `ODEMatrixSolution`, `FrequencyResponse`, `TransferFunction`, plus the option and function types) instead of a bare `TypedFunction`. `freqz` and `zpk2tf` threw "Class constructor Complex cannot be invoked without 'new'" on every call; they work now. `qr` accepts a `SparseMatrix` (dense Q and R). `combinations` maps over an `Array` or `Matrix` of `n` or `k`. `polynomialGCD` solves coefficients that are rationals with a common denominator up to 1e6 exactly (scaled to integers) instead of by floating-point Euclid. `multiplicativeOrder` no longer overflows for moduli above about 9.5e7 and runs in the order of phi(n) factoring time rather than O(order). The unused `rankF64Dispatch` and `rankF64JS` sort-bridge exports are removed. Faster: CAS numeric paths (`integrate`, `fourierSeries`, `summation`, `solve` fallback, derivatives) compile the expression once; the Mann-Whitney, Kolmogorov-Smirnov and Shapiro-Wilk bootstraps are O(n) per draw with unchanged seeded results; multi-quantile sorts once; `linregress` fits once; `polymul` has a single path; `spectrogram` and `periodogram` preallocate their outputs.

### Patch Changes

- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
  - @danielsimonjr/mathts-core@0.21.1
  - @danielsimonjr/mathts-expression@0.12.0
  - @danielsimonjr/mathts-matrix@0.9.0
  - @danielsimonjr/mathts-parallel@0.8.0

## 0.70.1

### Patch Changes

- Updated dependencies [3652c57]
  - @danielsimonjr/mathts-core@0.21.0
  - @danielsimonjr/mathts-expression@0.11.1
  - @danielsimonjr/mathts-matrix@0.8.1
  - @danielsimonjr/mathts-parallel@0.7.1

## 0.70.0

### Minor Changes

- b1da434: Add compileScalar, a batch ScalarNode evaluator with per-row validity that matches evaluateScalar.
- fa4e463: Add `inferScalarDimension` and dimension inference types for scalar SI analysis.
- 71f8c3c: Add scalarToNode, nodeToScalar, simplifyScalar, and scalarToTex. Expression re-exports the MathNode and StringOptions types those signatures use.
- 1203b0f: Add `compileScalarGradient` and `CompiledScalarGradient`: batch exact parameter gradients over the M3 scalar register tape (forward lanes per parameter, `DUAL_UNARY_RULES` for unaries).
- e2be2c7: Add guarded `numericallyEquivalent` for scalar trees (`consistent` / `counterexample` / `inconclusive`). Numerical agreement is evidence, not proof of symbolic equivalence.
- 156e4ea: Share one implementation where two functions already ran the same algorithm: Gauss–Jordan solve (`matInv` and the matrix square-root column solver), scalar central differences (`bfgs` and `gradientDescent`), matrix rank, combination-index generation, cumulative max/min, the upper-gamma continued fraction, and chunk assembly.
  
  New public exports: `gaussJordanSolve` (matrix), `centralDifferenceGradient` and `upperGammaQ` (functions). `gaussJordanSolve` reads a missing right-hand-side entry as 0, where the old square-root column solver produced NaN. Other public names and their numeric results stay the same.
- c4f28d5: Add `searchScalars` and related types for single-population evolutionary search over scalar trees: tournament selection, constant fitting via `fitScalarParameters` at `optimizeProbability`, and Pareto hall-of-fame reporting via `paretoFront` / `scoreFront`. A tree that is invalid on any row has infinite loss, so it never reaches the front. Each front row comes with the parameter values behind its loss (`fittedParameters`).
- a01adf3: Add a Pareto hall of fame with log-loss scores and accuracy, score, and best model selection.
- 55f6b3a: Add the `parallel` option to `searchScalars` (M14): `parallel: { timeoutMs?, pool? }` scores each generation's trees on worker threads (`scalar-batch.worker.js`, a second build entry) once `observed` has 100 or more rows. Parameter refits and every random draw stay on the caller thread, so a parallel run equals the serial run for the same seed, bit for bit. `timeoutMs` defaults to 30000 and must be positive; a pool the search starts itself is terminated when the generator ends or is closed. New type export: `ScalarPopulationParallelOptions`. `compileScalar` now evaluates through one shared `evaluateScalarTape` (internal).
- b802c14: Add scalar mutation and crossover operators (`weightedMutation`, default weights, and grammar-checked tree variation). Every operator reaches nodes below a unary call, keeps natural `log` as `log`, and returns `null` instead of a tree that the grammar rejects. The do-nothing operator is exported as `identityMutation`, so the package's matrix `identity` export is unchanged.
- 01e3d57: Fix `simplify` `exactFractions` to read core `Fraction` `numerator`/`denominator` (fixes `0.4 * x` → 2/5). Document `fractionsLimit` default as `Infinity`.
  
  Add `parallelStatMeanAD` as an alias of `parallelStatMAD` and clarify TSDoc: factory `mad` is median absolute deviation; parallel stats are mean absolute deviation.
- b24e3ec: Add `fitScalarParameters` for multi-constant fitting of `ScalarNode` trees to columnar data, and an optional analytic `jacobian` on `levenbergMarquardt` (`LMOptions`).
- b540dfd: Add `frontToLatexTable` and `frontToJson` for scored Pareto-front export. The table is one `tabular` (complexity, loss, score, equation) whose equation cells are `scalarToTex` in math mode (a bare `\cdot` does not compile in a `tabular` cell) and whose loss and score use `toPrecision(precision)`, default 6. The JSON report is `{ schemaVersion: 1, rows: [{ complexity, loss, score, key, tex }] }`; a non-finite `loss` or `score` is written as `'Infinity'`, `'-Infinity'` or `'NaN'` so it survives `JSON.stringify` (an exact fit scores `Infinity`, which JSON would turn into `null`, the linear-scale value). Also exports the types `FrontJson`, `FrontJsonNumber`, `FrontJsonRow` and `FrontLatexTableOptions`.
- 760114e: Add `solveParameterDimensions`: solve the SI dimension of each unknown parameter of a scalar tree. The tree implies one linear equation set per SI component (`+` operands agree, transcendental arguments and non-literal exponents are dimensionless, the root equals `target`); the sets are solved exactly with `rationalNullspace` and the result is `solved`, `underdetermined`, or `inconsistent`. The implementation lives in `scalar-dimension.ts` with `inferScalarDimension` (see the M9 changeset).

### Patch Changes

- c5e752a: Consolidate CAS string helpers (integer-range fold, additive-term derivative, Laplace table walk) per clone batch PR 5.
- 5ec27a9: Sprint 2R clone reduction: `setStringSubset` is the single string-assignment body; functions `_setSubstring` delegates to it (mirrors `getStringSubset` / `_getSubstring`).
- 8ed70e9: Sprint 2R: deduplicate matrix backend helpers and shared decomposition utilities (transpose re-export, `matInv`, `ParallelBackend` element-wise/sumAxis delegation, `JSBackend.norm` → reduction).
- 8b5cac4: Performance: number comparator fast path for `partitionSelect`, `median`, and dependents (P7-7).
- c467f72: Consolidate shape-walk duplicates (sparse matrix from vectors, Index dimension map, numeric-square predicates) per clone sprint PR 3.
- 2761c87: Sprint 2R (#423): `linregress` delegates slope inference to `linearRegression` (`studentTTwoSidedP`); far-tail p-values are tiny positives instead of flushed 0. Changed expectation: `symbolic-equal-tail-review-2026-10-15.test.ts` now asserts `linregress` on the steep near-exact line in (0, 1e-20), matching `I_{ν/(ν+t²)}(ν/2, 1/2)` (scipy.special.betainc / 2·t.sf / mpmath = 1.30816251668737e-32). `numericRealRoots` refines brackets with `findRoot` (Brent, tol 1e-14).
- 1f0c509: Performance: loop-based `max`/`min` on plain arrays (P7-6). Large arrays no longer overflow the stack on Node.
- 0b085aa: Consolidate duplicate single-variable polynomial dense-coefficient fill into `polyToDenseCoefficients` (trimming unchanged per caller).
- ab33deb: Extend `searchScalars` with multi-island evolution (M13b): `populations` independent islands (`rng.fork('island:' + index)`), migration of other islands' best trees into the worst places of each island (`fractionReplaced`), annealing of the constant-perturbation temperature (`initialTemperature`, times 0.995 per generation), and adaptive parsimony in tournament selection (`adaptiveParsimonyScaling`, compared in log space so a large share cannot overflow). Annealing and adaptive parsimony default to on only when `populations > 1`; `populations: 1` is byte-identical to the single-population search. Invalid `populations`, `fractionReplaced`, `initialTemperature` and `adaptiveParsimonyScaling` now throw a `RangeError`.
- 4f8bceb: `polymul`'s below-threshold path delegates to the shared `polyMulJS` convolution kernel (same arithmetic, same `trimPoly`).
- a24444b: Consolidate BigNumber binomial product loops, schoolbook integer polynomial multiply, and binomialExact onto chooseScalar (clone batch PR 2).
- 83d8074: Extract shared `WasmModuleLoader` base (`load` / cached `loadModule` / `getImports`) from the byte-identical copies in `functions` and `matrix` into `core/src/wasm-loader.ts` (`/internal` only). SHA-384 verification stays in each package's Node/browser load paths.
- c987ee5: Speed up `factory_max` and `factory_min` on plain flat number arrays: the leading numbers are compared with the cached number implementations of `isNaN` and `larger` (`smaller`), and the running result is handed to the generic walk at the first element that is not a number. Nested arrays, matrices, subclasses and empty arrays keep the generic path, and so does a dependency that has no number implementation.
- ec7dcdb: Phase 6 P6-4: consolidate L1/Huber fit gradients via `gradRobust` (clone reduction).
- e59fe83: Consolidate log-gamma and accurate erfc/normal-CDF scalars for hypothesis, distributions, and worker kernels; remove duplicate worker log-gamma.
- 234726f: Performance: number fast path for dense `lsolve` / `usolve` (P7-11).
- 3f2d4e5: Consolidate lasso/elastic-net fit shell, noncentral chi-square/F Poisson mixture, and reuse `normalSampleRng` in distribution `sampleN` fallbacks (PR6 numerics batch).
- af7733a: Document the ScalarNode toolkit, compileScalar, and the Pareto front with runnable TSDoc examples.
- 19c4ba7: Export `mulberry32`, `boxMuller`, and `rowMajorStrides` from core; deduplicate tensor, functions, parallel, and worker copies.
- bcfcff4: Consolidate Airy Ai/Bi scalar bodies and incomplete-beta continued fraction for worker-safe serialization.
- 3b240fb: Consolidate duplicate scalar helpers (Euclid GCD snap, gammainc/betainc closed domain, binomial coefficient, graph restart aggregation, trial isPrime) per Sprint 2R clone batch 6.
- 58fdd7a: Share set union and symmetric-difference flatten preamble (clones plan PR-B).
- 914b9b1: Make qr work on Fraction matrices by promoting entries to numbers, and fix Fraction sign().
- 8e16768: Refresh WASM dispatch comments in typed sources and bridges to cite `wasmPolicyAllows` / `functions/src/wasm/policy.ts` (comments only; no threshold or dispatch behavior changes).
- 61d46ad: Share one NUMERIC_LITERAL regex between evaluateScalar and compileScalar.
- 9dc97c5: Phase 6 P6-11: shared `runChainLifecycle` for GPU elementwise chain dispatch (clone reduction).
- 1806a0a: Sprint 2R clone-merge: shared internal `fitOrthogonalSeries` for `chebyshevFit` and `legendreFit` (length check, WASM-threshold dispatch, normal-equation JS path). Public names and behavior unchanged.
- 37c0fd4: Delegate `runUnaryPtr` to `runChainPtr` for the pointer-ABI elementwise path (clone batch M11).
- d8b1733: Performance: number fast path for dense LUP factorization (P7-4).
- 6e7532e: Sprint 2R clone reduction: shared `assertSameShape` for DualTensor/TapedTensor; unified ConditionalNode/RangeNode render helpers; `getStringSubset` barrel export with shared string subset body for functions `subset`.
- 2fd47ee: Phase 6 P6-9: shared `allocAsHeader` on core `/internal` (clone reduction).
- c45524e: Performance: number fast path for plain-array elementwise add/subtract/multiply (P7-5).
- 81b76ea: `curvefit` now calls `levenbergMarquardt` and still returns `number[]` (same signature; it does not throw on the previous fixtures). Its λ schedule, Jacobian step (`1e-8` → `1e-7`), solver (`linsolve` → `inv`), and singular-only catch follow LM. Noise-free linear/exponential fixtures still recover the planted parameters; on a linear `y=2x+1` fit the new path is exact where the old path had a 1-ulp error. `levenbergMarquardt` itself keeps the same iterates (forward Jacobian `h=1e-7`, `pairwiseDot` cost). `svds` uses core `norm2` for overflow-safe normalization. No existing test expectation changed.
- 3400f59: Share `mapBinaryF64` for FFT magnitude/power. Unary `Float64Array` overloads stay as inlined `Math.*` loops: a shared callback was measured megamorphic and slower on the sequential n<50k path.
- bf374b0: Route `solveBVP`, stiff `solveODE`, and `solveDAE` finite-difference Jacobians through `numericJacobian` (`step` / `f0` options); use core `norm2` in `eigsh`, `fsolve`, and Krylov; use `pairwiseDot` (RSS) and `sumSquaredDeviations` (TSS: pairwise mean plus the `(Σd)²/n` correction) in `ols`. No changed test expectations on existing fixtures (new parity and oracle tests only). Refs #422.
- 18f655b: Isolate compat `create(all, config)` from the process-wide functions config via a synchronous `runWithConfig` overlay and a config proxy on the activated factory graph. Fixes audit I-9 (#425).
- 66d5896: Speed up `prod` on plain flat number arrays: the leading numbers are folded with the cached number `multiplyScalar` implementation, and the partial product is handed to the generic fold at the first element that is not a number. Nested arrays, strings, matrices, subclasses and empty arrays keep the generic path, and so does a `multiplyScalar` that has no number implementation.
- ef55d67: Share graph centrality restart dispatch (clones plan PR-E).
- 5b9bf24: Share univariate polynomial string renderer (clones plan PR-D).
- d305864: Share simplify unflatten left/right walk (clones plan PR-C).
- fbd543e: Phase 6 P6-2: consolidate the factory `xgcd` BigNumber and Fraction paths into one `_xgcdRing` loop over a small adapter (clone reduction).
  
  This is not a pure refactor for BigNumber. The old `_xgcdBigNumber` called decimal.js method names (`isInt`, `lt`, `neg`, `minus`) that `@danielsimonjr/mathts-core`'s `BigNumber` does not define, so `factory_xgcd` on two core BigNumbers threw `a.isInt is not a function`. The adapter uses core's names (`isInteger`, `lessThan`, `negate`, `subtract`), so that path now returns `[gcd, x, y]`. The Fraction path and the number path return what they returned before.
- 5dfc421: Sprint 2R: consolidate Nelder–Mead — `minimize` calls `nelderMead` with `stepRule` / `tolRule` `'absolute'`; `nelderMead` adds `NelderMeadOptions` (defaults unchanged, relative step/tolerance). No changed test expectations.
- 936f37e: Sprint 2R clone-merge (G40–G41, G48–G50): share Chebyshev/Legendre basis rows between the poly WASM bridge and `chebyshevFit`/`legendreFit`; unify `asReadReturned`/`withAsTyped` in the WASM bridge helpers; dedupe sort `argsort`/`rank` dispatch. Public API unchanged.
- e6fd1c2: Performance: number comparator fast path for `sort` on plain arrays (P7-9).
- 9ee55f8: Sprint 2R near-clone batch 6: shared `linearFit` (exp/log/power fits), `solveAugmentedNormalEquations` (chebyshev/legendre JS paths and poly WASM fallback), Struve/Kelvin series helpers, `zipIntPoly`, set `selectById`, and `fibPair`. Public names and behavior unchanged.
- d18eed3: Consolidate Welch/Bartlett PSD result packing, Newton/Halley iteration loop, and bandpass/bandstop quadratic root map per clone sprint PR 7.
- 468a9d1: Fix evaluate('5 km to m') by dispatching typed to(Unit, Unit).
- adfa43f: Consolidate Sprint 2R exact clone helpers in arithmetic (ceil/floor snap, matrix 1/∞ norms), flatten, GPU/CPU reductions, and cubic Hermite for ODE/DDE solvers.
- 5b79083: Performance: infer `number` datatype for plain-array element-wise factories (P7-12).
- 0902acd: Speed up dense QR Householder decomposition on plain number matrices by routing inner loops through cached number typed-function implementations, with generic fallback and step resume when a reflection scalar leaves the number domain.
- 2fd47ee: Phase 6 P6-10: consolidate WASM load paths on `WasmModuleLoader` (clone reduction).
- 35ef447: Sprint 2R clone-merge batch 4 (G12, G24–G25, G28–G32): deduplicate mapSlices transpose, matrix-from-vector helpers, min/max reducers, print template interpolation, Decimal and matrix Index extremes. Public API unchanged.
- 5179cec: Consolidate Dijkstra scan, 2-D angle helper, and circumcircle computation (shortest path, angle, circumcircle clone batch).
- fc6c32b: Export `matMul` for dense `number[][]` matrix products and route internal `functions` call sites through it instead of local copies.
- 2b8c5b9: Phase 6 P6-3: shared linearly-implicit stiff driver for Rosenbrock and RODAS (clone reduction).
- 654984e: Phase 6 P6-1: consolidate scalar-mutate pick-and-replace and rotation helpers (clone reduction).
- f915105: Consolidate Sprint 2R near-clone helpers for centrality restart fan-out, matrix row/column slice, sparse CSC tail, factory FFT interleaved conversion, CAS `renderCoeffTimes`, and `rankNearest` k-NN ranking.
- Updated dependencies [45d691e]
- Updated dependencies [cbabf22]
- Updated dependencies [c7ef24d]
- Updated dependencies [5ec27a9]
- Updated dependencies [8ed70e9]
- Updated dependencies [71f8c3c]
- Updated dependencies [156e4ea]
- Updated dependencies [9f5a065]
- Updated dependencies [45d691e]
- Updated dependencies [83d8074]
- Updated dependencies [d7daec0]
- Updated dependencies [7e71f31]
- Updated dependencies [4594b6c]
- Updated dependencies [e591145]
- Updated dependencies [540691c]
- Updated dependencies [dc47a4b]
- Updated dependencies [af7733a]
- Updated dependencies [19c4ba7]
- Updated dependencies [11c4559]
- Updated dependencies [49a347a]
- Updated dependencies [48becfb]
- Updated dependencies [a6cf17a]
- Updated dependencies [cdec291]
- Updated dependencies [6e7532e]
- Updated dependencies [2fd47ee]
- Updated dependencies [0400aa1]
- Updated dependencies [8b0192c]
- Updated dependencies [f5ffe00]
- Updated dependencies [9009676]
- Updated dependencies [bc74de0]
- Updated dependencies [0c02ffe]
- Updated dependencies [b1bdef8]
- Updated dependencies [b2a24a0]
- Updated dependencies [1f52df2]
- Updated dependencies [2fd47ee]
- Updated dependencies [da5e661]
- Updated dependencies [55f6b3a]
- Updated dependencies [67406a8]
- Updated dependencies [974167d]
- Updated dependencies [fc6c32b]
- Updated dependencies [58a5ec7]
  - @danielsimonjr/mathts-matrix@0.8.0
  - @danielsimonjr/mathts-expression@0.11.0
  - @danielsimonjr/mathts-parallel@0.7.0
  - @danielsimonjr/mathts-core@0.20.0

## Unreleased

### Patch Changes

- G19 dogfood: `variance`/`std` `{ ddof }`, `{ skipNaN: true }` and `nanmean`/`nanmedian`/`nanvariance`, `Float64Array` on median/mode/quantileSeq/mad/corr, constant-input variance for `1e308` plateaus, empty median/mad → `NaN`.

- Dense `lsolve` / `usolve` take a number path (P7-11) when the triangle and RHS column are numbers. Results stay bit-identical to the generic loop, including singular and near-singular systems. BigNumber, Fraction, Complex, and mixed-type inputs stay on the generic path.

- Element-wise factories infer a `number` datatype for rectangular plain-array operands (P7-12) so `matAlgo13xDD` / `matAlgo14xDs` resolve the callback once. Mixed, BigNumber, Fraction, Complex, and ragged arrays stay on the generic path. DenseMatrix result datatypes are unchanged.

- Sprint 2R clone-merge: internal `fitOrthogonalSeries` for `chebyshevFit` and `legendreFit` (length check, WASM-threshold dispatch, normal-equation JS path). Public names and behavior unchanged.

- Near-clone numeric batch 6 (Sprint 2R): internal `linearFit`, `solveAugmentedNormalEquations`, Struve/Kelvin series helpers, `zipIntPoly`, set `selectById`, and `fibPair`. Public exports and behavior unchanged.

## 0.69.2

### Patch Changes

- 0b0f0e3: `subtract` accepts plain arrays, Dense matrices and Sparse matrices element-wise, with scalar broadcast in both orders, as `add` does. Before this change `subtract([1, 2, 3], [1, 1, 1])` threw an unexpected-type error.

## 0.69.1

### Patch Changes

- Updated dependencies [61426de]
  - @danielsimonjr/mathts-core@0.19.0
  - @danielsimonjr/mathts-expression@0.10.3
  - @danielsimonjr/mathts-matrix@0.7.9
  - @danielsimonjr/mathts-parallel@0.6.11

## 0.69.0

### Minor Changes

- 02984be: Add `massProperties(shape, density?)` and the `MASS_PROPERTY_SHAPES` catalog (#378): volume (area in 2-D), mass, centroid and inertia about the centroid for sphere, box, capsule, convex polyhedra (vertices with optional faces, else their convex hull), circle, rectangle, 2-D capsule and simple polygons. Polyhedra and polygons are exact (covariance method and shoelace sums).

## 0.68.5

### Patch Changes

- 9e49ca8: `solveODESystem` with a fixed `dt` now takes exactly n steps of `span/n`, ending on `tspan[1]`, when `span/dt` is within 4ε relative of a positive integer n; before, rounding such as `1e-3 / (1e-3/1000) = 1000.0000000000001` made `ceil` add a step and return 1002 states instead of 1001. A `span/dt` that is not near an integer still takes `ceil(span/dt)` steps, with bit-identical output.
  
  `linearRegression` and `linregress` compute the slope standard error from the residuals, √(Σ(y − ŷ)² / ((n − 2)·Σ(x − x̄)²)), with core's pairwise sums; before, `syy − slope·sxy` cancelled on a near-exact fit and went negative when r rounded above 1, so `stdErr` was NaN. The behaviour for fewer than 3 points (a thrown error) is unchanged, and `ols` already used its residuals.

## 0.68.4

### Patch Changes

- 4e4acae: `symbolicEqual` simplifies with the default rules (it passed an empty rule array, so every pair compared false). `linearRegression.pValue` and `ols.pValues` are the two-sided Student-t tail computed directly as the regularized incomplete beta (`studentTTwoSidedP`; `2·(1 − studentTCDF)` rounded a steep slope's tail to 0). `ols` equilibrates the normal matrix by its diagonal before inverting, so an SI-scaled design is no longer refused as singular. `Fraction.fromNumber` returns the last continued-fraction convergent at or below `maxDenominator` (it once returned 739/200 for a cap of 64). Found by the Universal-Physics-Tensor deep dive of 2026-10-15.
- Updated dependencies [4e4acae]
  - @danielsimonjr/mathts-core@0.18.1

## 0.68.3

### Patch Changes

- 0d7853a: `gammaincp` computes the upper regularized incomplete gamma directly in the upper tail (modified Lentz continued fraction for x ≥ a + 1) instead of `1 − gammainc`, which rounded a far tail to 0 (`gammaincp(5, 80)` was 0; Q is 2.5e-28). `findRoot` refuses a `NaN` endpoint value (the sign check `fa · fb > 0` let it through) and takes `xtol`, a separate bracket-width tolerance (default `tol`; 0 stops on the residual alone). `quad` takes `atol`, its absolute panel floor (default the previous 1e-14), so an SI-scaled integrand can lower it. Found by the Universal-Physics-Tensor MathTS-usage review of 2026-10-15.

## 0.68.2

### Patch Changes

- Updated dependencies [15adc89]
  - @danielsimonjr/mathts-core@0.18.0
  - @danielsimonjr/mathts-expression@0.10.2
  - @danielsimonjr/mathts-matrix@0.7.8
  - @danielsimonjr/mathts-parallel@0.6.10

## 0.68.1

### Patch Changes

- Updated dependencies [f31f5ee]
  - @danielsimonjr/mathts-core@0.17.0
  - @danielsimonjr/mathts-expression@0.10.1
  - @danielsimonjr/mathts-matrix@0.7.7
  - @danielsimonjr/mathts-parallel@0.6.9

## 0.68.0

### Minor Changes

- 75416dc: Add a public scalar-expression builder. `@danielsimonjr/mathts-expression` exports `createScalarBuilder`, `SCALAR_FUNCTIONS`, and `SCALAR_FUNCTION_LOWERING`. `@danielsimonjr/mathts-functions` exports `scalar` and `evaluateScalar`. `ln` lowers to natural `log` and `log` lowers to `log10`. Nodes are built from a typed tree. A formula string is rejected.
  
  Publish `@danielsimonjr/mathts-expression@0.10.0` before `@danielsimonjr/mathts-functions@0.68.0`. The functions package still depends on `@danielsimonjr/mathts-expression` `^0.9.0`, which also matches 0.9.0. Tighten that range to `^0.10.0` in the release so 0.68.0 cannot load an expression package that has no builder.

### Patch Changes

- Updated dependencies [75416dc]
  - @danielsimonjr/mathts-expression@0.10.0

## 0.67.0

### Minor Changes

- c9229ac: Physics mode can bind bare `e` as the SI magnitude `1.602176634e-19` when `evaluate`, `compileExpr`, or `parser` is called with `{ physics: true, charge: 'scalar' }`, so `1 - e^2` is ordinary arithmetic. `{ physics: true }` still returns the coulomb Unit. `rationalNullspace` accepts `columns` for a matrix with no rows. `propagateUncertainty` accepts a function, with central differences and an optional curvature probe that is not folded into sigma. `gaussLegendre4` reports the Picard iteration count of each step.

## 0.66.0

### Minor Changes

- 4f6365f: Add `rationalNullspace`, an exact Fraction null space beside the existing numeric `nullspace`. The basis is a primitive integer vector with a positive leading entry, which is the form Buckingham-π dimensional analysis needs.
- dad40d9: Opt-in physics mode: bare `e` is the elementary charge 1.602176634e-19 C when `evaluate`, `compileExpr`, or `parser` is called with `{ physics: true }`, or when the scope comes from `physicsScope()`. The default stays Euler's number. `E` stays unbound for energy, and Euler's number is `exp(1)`.
- 07fd902: Add `gaussLegendre4`, a symplectic 2-stage Gauss–Legendre 4th-order implicit Runge–Kutta ODE integrator, together with its Butcher tableau (`GL4_A`, `GL4_B`, `GL4_C`). It is an ODE solver and is distinct from the quadrature function `gaussQuad`.
- 8b87618: Add `propagateUncertainty`, a first-order (delta-method) uncertainty propagation for scalar expressions. Partials come from the symbolic derivative; independent sigmas or a full covariance may be supplied, but not both.

### Patch Changes

- Updated dependencies [6e751af]
- Updated dependencies [5b7ca6d]
  - @danielsimonjr/mathts-expression@0.9.0
  - @danielsimonjr/mathts-core@0.16.0
  - @danielsimonjr/mathts-matrix@0.7.6
  - @danielsimonjr/mathts-parallel@0.6.8

## 0.65.0

### Minor Changes

- 8b0f960: New `loadWasm()` / `isWasmLoaded()` exports: an explicit opt-in to the AssemblyScript tier. Nothing in the package loaded its WASM binary before, so every function always ran its JavaScript path even though the binary and its bridges shipped. `await loadWasm()` loads the packaged `mathts-as.wasm` after checking its SHA-384 manifest. It resolves `false` when the binary cannot be found (a later call may retry) and rejects when the binary fails the integrity check. Nothing changes for code that does not call it.

### Patch Changes

- 8b0f960: 131 public exports were functions at runtime but not callable in the published types. Among them were `det`, `inv`, `lup`, `qr`, `zeros`, `identity`, `map`, `median`, `subset` and the `factory_*` functions. Most were declared `unknown`; `det` was declared as its own return value, `number | BigNumber | Complex`. Every TypeScript call needed a cast.
  
  The cause was the factories' `typed` dependency type, whose call signature returned `unknown` (or the local result type) instead of a function. It now has a creation overload, `typed(name, signatures, ...more)`, that returns a typed function, and every export is callable. The shared `referTo` type now matches typed-function's variadic `referTo(...names, callback)`, so five factories no longer cast around a curried form that nothing calls. `tools/test/consumer-typecheck.mjs` now asserts, against the packed packages, that every runtime-function export is callable in its `.d.ts` (2,310 exports across all packages).
- 8b0f960: Remove the legacy WASM branches that called 56 kernels the AssemblyScript binary does not export (`dct_wasm`, `laDet`, `statsMean`, `distanceND`, …). Whenever the module was loaded, each one copied its inputs into WASM memory that is never reclaimed, failed, and fell back to JavaScript; `distance` (pairwise) and `intersect` (2-D lines) threw `is not a function` instead. Results are unchanged, the exported names are unchanged, and the bundle is about 3,500 lines smaller.
- 8b0f960: A failed WASM load no longer disables WASM for the rest of the process. Both loaders cached the in-flight load promise and never cleared it, so one bad path or transient fetch error made every later `load()` return the same rejection. It is now cleared however the load settles, and a failed load also drops the compiled module: a binary that compiled but failed to instantiate used to stay cached, so every later `load()` instantiated it again instead of reading the binary it was given.
- 8b0f960: Type fixes from type-checking the test suite, with no runtime change.
  
  - **`solveODE`, `freqz` and `zpk2tf` are declared `TypedFunction`, like every other typed function.** They were published as `any`: their factories' dependencies are untyped, so the result inherited `any` from `typed(...)`, and nothing about a call or its result was checked. Their results are now `unknown`, so narrow them as for any typed function (for example `solveODE(f, [0, 1], y0) as { t: number[]; y: number[][] }`).
  - **The unit-valued physical constants (`speedOfLight`, `planckConstant`, `electronMass`, ...) are declared as core's `UnitInstance`.** They were declared as a stub `{ fixPrefix: boolean }`, so `speedOfLight.toNumeric('m/s')`, `.to(...)` and `.format()` did not compile. The value was always a core `Unit`.
- 8b0f960: Type fixes from type-checking the test suite, with no runtime change.
  
  - **`chiSquareTest`, `kolmogorovSmirnovTest`, `mannWhitneyTest` and `shapiroWilkTest` return their plain result type when no `bootstrap` option is given.** Every call returned `Result | BootstrapResult`, so reading `pValue` from `await mannWhitneyTest(a, b)` did not compile. With a `bootstrap` option the result is still the union, because `bootstrap: 0` falls back to the plain result at run time.
  - **`inv`, `eigs` and `sqrtm` return `unknown`, like every typed function.** The new callable signatures had typed their results as the scalar type their internal dependencies use, which is wrong for a matrix, an `{ values, eigenvectors }` object, or a nested array.
- 8b0f960: `polynomialGCD` (and so `polynomialLCM`, and the CAS rational simplification that uses it) is exact when every coefficient of both inputs is a safe integer: it runs a primitive pseudo-remainder sequence over ℤ[x] in `bigint` and returns the monic result. Floating-point Euclid, still used for non-integer inputs, cannot decide coprimality for high-degree inputs. It returned a spurious factor for 53 of 300 random coprime degree-266/cubic pairs, and missed a real common quadratic of degree-120 multiples.
- 8b0f960: After `loadWasm()`, a function runs its AssemblyScript kernel only where that measured faster, and repeated WASM calls no longer grow memory without bound.
  
  - **A measured dispatch policy (`src/wasm/policy.ts`).** `tools/benchmark/wasm/opt-in.bench.ts` timed every public function that reaches a WASM bridge with the tier off and on (Node 22, reps interleaved, two runs). Loading made many of them slower, so those keep their JavaScript path even when the module is loaded:
    - `welchPSD`/`bartlettPSD`: 4.0–4.6× slower
    - `resultant`, `discriminant`, `newtonInterp`, `lagrangeInterp`: about 4×
    - `chirpZTransform`: 3.3×
    - `polymul`: 2.7×
    - bitwise ops: 2.4–3.3×
    - `goertzel`: 1.7×
    - `cubicSpline`, `polynomialQuotient`: about 1.4×
    - `tan`, `atan`, `cot`, `exp`, `log2`, `expm1`, `sinh`, `tanh`, the Bessel/Airy/elliptic/Carlson functions and `erfc`: no faster, or up to 1.6× slower
  
    WASM stays on where both runs measured it faster:
    - `abs`, `log10` from 1K; `sin` 1K–131K; `log1p` 1K–16K
    - `cos`, `atanh`, `log` from 16K; `sec` 16K–1M
    - fused chains (`fuseUnaryChain`, 0.36–0.77×)
    - `polyFit`/`chebyshevFit`/`legendreFit` (0.34–0.67×)
    - `lgamma` and the sort behind `parallelStatMedian`/`parallelStatQuantile` from 1M elements
  
  - **Bounded WASM memory.** The binary uses the stub runtime, which never frees, so every managed-ABI call left its inputs and result on the heap for good: 200 calls grew memory by 99 MiB (`lgamma`, 16K values) to 403 MiB (`welchPSD`, 65K samples), heading for the 4 GiB limit, where every call would fall back to JS. The bridges now call the binary's new `heap_reset` once each call has copied its results out.
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
  - @danielsimonjr/mathts-matrix@0.7.5
  - @danielsimonjr/mathts-expression@0.8.2
  - @danielsimonjr/mathts-core@0.15.5
  - @danielsimonjr/mathts-parallel@0.6.7

## 0.64.3

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
- Updated dependencies [a13ce7e]
  - @danielsimonjr/mathts-core@0.15.4
  - @danielsimonjr/mathts-expression@0.8.1
  - @danielsimonjr/mathts-gpu@0.2.1
  - @danielsimonjr/mathts-matrix@0.7.4
  - @danielsimonjr/mathts-parallel@0.6.6

## 0.64.2

### Patch Changes

- 8473590: Declare `typed-function` and `workerpool` as registry `npm:` aliases (`npm:@danielsimonjr/typed-function@5.0.0-alpha.4`, `npm:@danielsimonjr/workerpool@10.2.1`) instead of `github:` git dependencies. npm 10 (bundled with Node 20 and 22) failed to install these packages with "git dep preparation failed ... Cannot read properties of null (reading 'edgesOut')". The registry builds are code-identical to the git HEADs that were resolved before, and the import names do not change.
- Updated dependencies [8473590]
  - @danielsimonjr/mathts-core@0.15.2

## 0.64.1

### Patch Changes

- 57c8ffd: Ships the current WASM binary: same exports, a differently optimized code section, and a new SHA-384 manifest. No JavaScript change.
- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
  - @danielsimonjr/mathts-core@0.15.0
  - @danielsimonjr/mathts-expression@0.8.0
  - @danielsimonjr/mathts-matrix@0.7.2
  - @danielsimonjr/mathts-parallel@0.6.5

## 0.64.0

### Minor Changes

- 8789126: Risch Layer 3 (Hermite + Rothstein–Trager / residue formula), prolate spheroidal wave functions, workbook `--expect-hash` and MathML→SVG typesetting.

## 0.63.0

### Minor Changes

- 0592f7b: Restore the `order` option on `derivative()`, and its input validation, after both were
  silently removed.
  
  `derivative(expr, x, { order: n })` computes the nth derivative again, and a non-integer or
  negative `order` throws `TypeError('Option "order" must be a non-negative integer')` instead
  of being accepted. Since the removal, `{ order: 0 }`, `{ order: 2 }` and `{ order: 3 }` all
  returned the **first** derivative, and invalid orders were silently ignored.
  
  Also restores the `simplify` default. The guard had become a truthiness test
  (`options.simplify ? …`), so passing any options object that omitted `simplify` — including
  `{ order: 2 }` — silently disabled simplification. It is `options.simplify !== false` again,
  matching the `{ simplify: true }` default that applies when no options are passed.
  
  Both regressions entered in `d25f00a9` ("Fix dynamic code execution vulnerability in the CAS
  evaluator"), a 56-file commit that also deleted `functions/tests/derivative.test.ts` — which
  is why CI stayed green: the evidence was removed along with the capability. That test is
  restored here and fails against the regressed code, so it gates the behaviour from now on.
  The genuine security fix in that commit (`functions/src/typed/cas.ts`) is untouched.

### Patch Changes

- Updated dependencies [104a1c9]
  - @danielsimonjr/mathts-core@0.14.1
  - @danielsimonjr/mathts-expression@0.7.1

## 0.61.0

### Minor Changes

- feat: positive-discriminant quadratic integration (Risch Layer 2) + Critical Landau–Mignotte fix

  `symbolicIntegral`/`integrate` now integrate rational functions whose denominator has a
  positive-discriminant irreducible quadratic factor (real irrational roots, e.g. 1/(x^2-2) →
  √2/4·log|x-√2| − √2/4·log|x+√2|), via an exact quadratic-surd type. Covers non-monic, shifted, and
  mixed neg/pos-disc denominators; differentiation-verified. Repeated pos-disc and degree-≥3 irreducible
  denominators still return the marker (general Rothstein–Trager / transcendental Risch are future
  layers).

  Also fixes a Critical false-irreducible bug in the polynomial factorizer (factorUnivariateZ, shipped
  0.58.0): the Landau–Mignotte bound used |lc| instead of the coefficient 2-norm, so polynomials with a
  large constant term relative to the leading coefficient (x^2-10000) were wrongly reported irreducible.
  Now uses 2^deg·‖f‖₂. Corrects univariate + multivariate factorization and rational integration; found
  by the Layer 2 adversarial review.

## 0.60.0

### Minor Changes

- feat: complete rational-function integration (Risch Layer 1)

  `symbolicIntegral`/`integrate` now integrate any rational function p(x)/q(x) over ℚ whose
  denominator factors into linear + irreducible-quadratic factors, in closed form (rational part +
  log + arctan): 1/(x^2+1) → atan(x), (3x+2)/(x^2+1) → (3/2)log(x^2+1)+2·atan(x), repeated factors,
  improper inputs, content>1 denominators. Previously these returned an unevaluated marker. Method:
  parse → polynomial-part division → factor the denominator via the #7 engine → exact-ℚ partial
  fractions → per-factor closed form (completing the square for quadratics, reduction formula for
  repeated quadratics). Exact rational arithmetic; differentiation-verified. Honestly bounded:
  degree-≥3 irreducible and positive-discriminant quadratic denominators (real log/atanh) still return
  the marker — Rothstein–Trager / transcendental Risch are documented follow-ups. Existing behavior
  preserved (345-test regression); a final adversarial review caught+fixed a Critical discriminant
  bug before ship.

## 0.59.0

### Minor Changes

- feat: complete multivariate polynomial factorization over ℤ/ℚ (Kronecker) — completes #7

  `factor`/`casFactor` now factor multivariate integer polynomials completely into irreducible factors
  over ℤ/ℚ (was content/monomial/difference-of-squares only): `x^2-y^2` → `(x-y)(x+y)`,
  `(x+y+1)(x+2y+3)` → its linear factors, `(x+y)^2(x+2y)` with multiplicity, 3-variable products,
  non-primitive inputs, with ℚ-irreducibles unchanged. Method: Kronecker substitution reduces to the
  shipped univariate Zassenhaus engine; recombination keeps a candidate iff it exactly divides
  (multiExactDivide arbiter), so no unverified factor is emitted. bigint MultiPoly engine; substituted-
  degree + factor-count caps degrade gracefully. Existing fast-path outputs preserved byte-identical
  (346-test regression unchanged). Oracle-pinned to sympy factor_list (320-case adversarial review, 0
  soundness failures). Together with Layer 1 (univariate) this completes A-list #7. Wang/EEZ remains the
  documented future performance upgrade.

## 0.58.0

### Minor Changes

- feat: complete univariate polynomial factorization over ℤ/ℚ (Zassenhaus)

  `factor`/`casFactor` now factor any single-variable integer polynomial completely into irreducible
  factors over ℤ/ℚ (was rational-linear-roots only): `x^4-1` → `(x-1)(x+1)(x^2+1)`, `x^4+3x^2+2` →
  `(x^2+1)(x^2+2)`, non-monic `4x^2-9` → `(2x-3)(2x+3)`, with ℚ-irreducibles (`x^4+1`) returned
  unchanged. New bigint engine (`functions/src/typed/factorization/`): Yun square-free → factor mod p
  (distinct-degree + deterministic Cantor–Zassenhaus) → Hensel lift to `p^k` → subset recombination,
  with the leading-coefficient method for non-monic inputs and a 24-factor recombination cap.
  Oracle-pinned against sympy `factor_list`. Multivariate factorization (Wang/EEZ) is the follow-up.
  Existing behavior preserved (346-test algebra/cas regression unchanged).

## 0.57.0

### Minor Changes

- feat: `halfspaceIntersection` — vertex enumeration of a bounded polytope (2-D/3-D)

  Given halfspaces `A·x + b ≤ 0` (SciPy's convention) and a strictly interior point, returns the
  polytope's `vertices` plus `incidences` (which halfspaces are tight at each vertex), via the
  dual-hull route — the convex hull of the dual points `aᵢ/−(aᵢ·x₀+bᵢ)`, whose facets map back to
  primal vertices. Boundedness is decided structurally (the dual origin must lie strictly inside the
  dual hull); unbounded input throws, mirroring SciPy's `QhullError`. `d > 3` throws a clear error
  naming what the general case requires rather than returning a wrong answer.

  All tolerances are relative and the dual cloud is normalised to unit scale, so results are invariant
  to rescaling halfspace rows or changing coordinate units. Oracle-pinned against
  `scipy.spatial.HalfspaceIntersection` (21 tests).

## 0.56.0

### Minor Changes

- Special functions: Mathieu characteristic values and angular functions.

  Four new exports for the Mathieu equation `y'' + (a − 2q·cos 2x)·y = 0`:
  - **`mathieuA(n, q)` / `mathieuB(n, q)`** — the characteristic values `a_n(q)` / `b_n(q)`.
  - **`mathieuCe(n, q, x)` / `mathieuSe(n, q, x)`** — the angular Mathieu functions (x in radians).

  Computed via the symmetric-tridiagonal eigenproblem for the Fourier coefficients (one matrix per parity class,
  DLMF §28.4, N=50), reusing the matrix package's symmetric `eig`; eigendecomposition cached per `(class, q)`.
  DLMF/A&S normalization (`(1/π)∫₀^{2π} ce_n² = 1`, so `ce_0(x,0)=1/√2`, `ce_n(x,0)=cos nx`, `se_n(x,0)=sin nx`).
  vs `scipy.special` (mpmath 1.3.0 omits the Mathieu family): `a_n`/`b_n` max relerr ~1.2e-14, `ce_n`/`se_n`
  ~7e-15; the `q→0` limits and the Mathieu-ODE residual are also pinned.

## 0.55.0

### Minor Changes

- Numerics: `solveDDE` — constant-delay differential equation solver.

  New `solveDDE(f, tspan, history, delays, options?)` solves `y'(t) = f(t, y(t), [y(t−τ₁), …])` with a history
  function `φ(t)`, multiple positive constant delays, and vector state, by the method of steps: adaptive BS23
  (Bogacki–Shampine 3(2), the `dde23` pair) with a C¹ cubic-Hermite continuous extension as the history
  interpolant. The step is capped at `min(τ)` so every delayed argument lies in already-computed history (fully
  explicit), and the integrator lands exactly on each `t0 + m·τ` breakpoint so no dense-output interval straddles
  a derivative jump (the initial discontinuity smooths one order per breakpoint). Returns `{ t, y[t], yInterp }`
  (dense-output evaluator). Verified (scipy has no DDE — implementation-independent oracles): method-of-steps
  exact solution of `y'=−y(t−1)` over 3 delay intervals to machine precision (~5e-16); characteristic-root decay
  and period exact-matched; τ→large ODE-degeneration cross-check vs `solveODESystem` Δ 2.4e-10.

## 0.54.0

### Minor Changes

- Numerics: `solveDAE` — semi-explicit index-1 differential-algebraic equation solver.

  New `solveDAE(f, g, tspan, y0, z0?, options?)` solves `y' = f(t,y,z)`, `0 = g(t,y,z)` (index-1 ⟺ `∂g/∂z`
  nonsingular) via variable-order (1–2) variable-step BDF: each step solves the coupled nonlinear system (the
  BDF equation for `y` and `g=0`) by Newton on the block Jacobian, LU-solved through the matrix primitive.
  Consistent `z0` is Newton-refined onto `g(t0,y0,z0)=0` (or solved from scratch when omitted). A higher-index
  input (singular `∂g/∂z`) is detected at initialization and throws, rather than silently integrating to
  garbage. Verified (scipy has no DAE solver — implementation-independent oracles): manufactured/closed-form
  max abs error 2.35e-7; the **constraint residual `|g|` stays ≤8.9e-16** across the trajectory (the defining
  DAE invariant — the algebraic block is solved exactly each step); reduce-to-ODE cross-check vs RK4 2.1e-7.

## 0.53.0

### Minor Changes

- Numerics: `solveParabolicPDE` — general 1-D parabolic PDE via method-of-lines.

  New `solveParabolicPDE` solves `u_t = D(x)·u_xx + c(x)·u_x + f(x,t,u)` on `[x0,x1]×[0,T]` by method-of-lines:
  central 2nd/1st differences on a uniform `nx`-grid → a stiff ODE system integrated by the shipped **BDF**
  solver (implicit, no CFL cap). Dirichlet (`u=g(t)`) and Neumann (`u_x=g(t)`, 2nd-order ghost-node) boundary
  conditions; `D`/`c` accept constants or `x`-functions. Returns `{ x, t, u[t][x] }` (optional `times`
  interpolation). Verified: exact heat `e^{−π²t}sin(πx)` relerr 1.27e-4 at nx=81 with **O(h²) convergence rate
  2.000**; manufactured reaction-diffusion 1.2e-4; scipy `solve_ivp('BDF')` cross-check on the same
  semi-discretization ≤1e-12. The heat-only `solvePDE` is unchanged (this is an additive new entry).

## 0.52.0

### Minor Changes

- Special functions: irregular Coulomb wave function `coulombG` (+ `coulombFG` bundle).

  `coulombG(L, eta, rho)` — the irregular Coulomb wave function, via the Barnett/Steed method (DLMF §33.8:
  CF1 for `F'/F`, complex CF2 for `(G'+iF')/(G+iF)`, Steed recovery through the Wronskian `F'G−FG'=1`), with the
  CF2 coefficients evaluated at the target `L` (no recurrence). `coulombFG(L, eta, rho)` returns `{F, Fp, G, Gp}`
  in one pass. vs `mpmath.coulombg`: max G relerr **6.9e-13** at/above the turning point (`G₀(0,ρ)=cos ρ` to
  machine precision); Wronskian residual **≤6.7e-16** across the corpus. Validated for `ρ ≳ 0.15·ρ_tp`; the
  deep-sub-turning-point corner (large positive η, ρ≪ρ_tp) is the known Steed-method limit and is documented as
  excluded rather than returning a silently-wrong value. `ρ≤0` throws.

## 0.51.0

### Minor Changes

- Stiff ODEs: BDF and Radau IIA solvers + adaptive `solveODESystem`.

  - **`solveODE(..., { method: 'BDF' })`** — variable-order (1–5) variable-step NDF-BDF (scipy's default stiff
    method), simplified-Newton on `(I − c·J)` reusing the matrix-LU path. vs `scipy.integrate.solve_ivp('BDF')`:
    Robertson t=40 Δ≤2.2e-8 (mass invariant exact), Van der Pol μ=1000 Δ=9.5e-7; exact linear-stiff relerr 1.1e-6
    at `tol=1e-8`.
  - **`solveODE(..., { method: 'Radau' })`** — 3-stage order-5 L-stable Radau IIA (real-arithmetic
    simplified-Newton on the collocation system + scipy's embedded error estimate). vs
    `scipy.integrate.solve_ivp('Radau')`: Robertson Δ≤3e-10, Van der Pol μ=1000 Δ=3.3e-9; linear-stiff relerr
    ~1.6e-10.
  - **`solveODESystem` — adaptive by default.** Was fixed-step RK4; now an embedded RK45 (Dormand–Prince) with
    scaled-RMS error control. Passing an explicit `dt` still selects the legacy fixed-step path (back-compat).

  General method-of-lines PDE (beyond the heat-only `solvePDE`), index-1 DAE, and DDE remain future scope with
  recorded designs (rewriting `solvePDE`'s numerics is deliberately left for a sign-off, not auto-changed).

## 0.50.0

### Minor Changes

- Computational-geometry engine: convex hull, Delaunay, Voronoi, spherical Voronoi, alpha shapes.

  Five new scipy.spatial-pinned geometry functions built on a new hull/Delaunay foundation:
  - **`convexHull`** — 2-D monotone-chain + 3-D QuickHull → `{vertices, simplices, area, volume}` (scipy `.area`/
    `.volume` convention). Vertex sets exact; area/volume to 1e-8–1e-10 vs `scipy.spatial.ConvexHull`.
  - **`delaunay`** (2-D) — triangle count matches `scipy.spatial.Delaunay`; empty-circumcircle property holds ∀
    triangle; triangles partition the hull to 1e-10.
  - **`voronoi`** (2-D) — the Delaunay dual (circumcenter vertices, equidistant to generators to 1e-9).
  - **`sphericalVoronoi`** — via the 3-D hull; vertex count `2N−4`, geodesic areas sum to `4πr²` to 1e-8 vs
    `scipy.spatial.SphericalVoronoi`.
  - **`alphaShape`** (2-D) — Delaunay circumradius filter; recovers holes (annulus → 2 boundary loops).

  Also **fixed a real bug**: the `delaunay_wasm` kernel read past its output buffer (returned 1363 triangles vs 197) — its dispatch is disabled; the JS Bowyer–Watson path is always used. Halfspace-intersection / n-D vertex
  enumeration remain future scope (double-description / dual-hull design recorded).

## 0.49.0

### Minor Changes

- Special functions: Riemann–Siegel Z, Lerch transcendent, parabolic-cylinder, and regular Coulomb wave.

  Five new mpmath-pinned (dps=30) special-function exports:
  - **`siegelZ(t)` / `riemannSiegelZ(t)`** — the real Riemann–Siegel Z-function on the critical line
    (`Z(t)=e^{iθ(t)}ζ(½+it)`), with exact θ via complex log-gamma. Max rel err 4.3e-15; abs ~2e-15 near the first
    zeros (t≈14.13/21.02/25.01).
  - **`lerchPhi(z, s, a)`** — Lerch transcendent `Σ zᵏ/(a+k)ˢ` for `|z|<1, a>0` (max rel err 1e-14; cross-checks
    `Liₛ(z)=z·Φ(z,s,1)`).
  - **`parabolicCylinderD(nu, x)`** — parabolic-cylinder `D_ν(x)` via the Whittaker `₁F₁` form (6.4e-15).
  - **`coulombF(L, eta, rho)`** — regular Coulomb wave via DLMF 33.6 ascending series (3.6e-13). Fixed a
    convergence-test bug that truncated `F₀(0,ρ)=sin ρ` on the exactly-zero terms η=0 produces.

  Irregular `coulombG`, Mathieu (`ce_n`/`se_n`, char. values), and spheroidal wave functions remain future scope
  (continued-fraction / eigenvalue-recurrence algorithms) with scoped designs recorded.

## 0.48.0

### Minor Changes

- CAS breadth: real `casExpand`/`casFactor`, multivariate `expand`/`factor`, partial-fraction + by-parts integration.

  - **`casExpand` / `casFactor` are now real** (were crude string stubs: `casExpand('(x+1)^2')` gave
    `'x*x + x*1 + 1*x + 1*1'` and left `(x+1)^3` unchanged; `casFactor` did integer-GCD only, leaving `x^2-1`
    unfactored). Both now delegate to the real `expand`/`factor` engines. `casExpand('(x+1)^2') → '1 + 2*x + 1*x^2'`,
    `casFactor('x^2-1') → '(x - 1)*(x + 1)'` (sympy-pinned).
  - **Multivariate `expand`** (was univariate-gated). N-variable polynomials now expand exactly — `(x+y)^2`,
    `(x+y)(x-y)`, `(x+y+z)^2`, … coefficient-equal to `sympy.expand`.
  - **Multivariate `factor`** — the tractable subset (integer content + common-monomial extraction + monomial
    difference-of-squares), sympy-pinned. Full factorization into irreducibles (Wang/Zassenhaus) is out of scope
    and left partially-factored/unchanged — never a wrong answer.
  - **`symbolicIntegral`** gains **partial-fraction** integration of rational functions (composes `apart` with
    term-wise integration) and **tabular by-parts** for polynomial·{exp,sin,cos}. Verified by differentiate-back
    (`d/dx(∫f) ≡ f`, sympy-checked, max residual ~3e-9). General u-substitution / a Risch integrator remain the
    `integral(…)` marker (surfaced as future scope).

## 0.47.0

### Minor Changes

- Stats breadth: Gaussian-process regression + Dirichlet/Wishart sampling.

  - **`gaussianProcessRegression` / `gpRegression`** (new). GP regression with RBF/squared-exponential and Matérn
    3/2 & 5/2 kernels (`lengthScale`, `signalVariance`, `noise`); `.predict(Xstar)` returns posterior `{mean,
variance, std}`, plus `logMarginalLikelihood`. Cholesky routes to the matrix-package primitive. Matches
    `sklearn.gaussian_process.GaussianProcessRegressor` to machine precision (Δmean ~5e-16, Δstd ~2e-15).
  - **`dirichletSample` / `dirichletPdf` / `wishartSample`** (new). Dirichlet via Gamma-normalization, Wishart via
    Bartlett decomposition, seeded to match `mvnSample`. `dirichletPdf` matches `scipy.stats.dirichlet.pdf` to
    ~1e-12; sample moments converge to the theoretical mean/covariance (`E[W]=df·scale`) within a couple of SE.
    (The Marsaglia–Tsang gamma sampler was extracted to a shared util, removing two pre-existing in-file copies.)

## 0.46.0

### Minor Changes

- Advanced linear algebra: sparse `svds`, ILU/IC preconditioners, O(k²) `minres`, and a `qz` throw fixed.

  - **`svds(A, k)` — sparse/partial SVD** (new). Top-`k` singular triplets via Lanczos (`eigsh` on the smaller
    normal operator `AᵀA`/`AAᵀ`, never formed), for large/sparse `A` where a full SVD is wasteful. Returns
    **descending** singular values (opposite scipy's ascending — documented). Matches `scipy.sparse.linalg.svds`
    to 7–8 digits; Eckart–Young rank-k truncation error pinned.
  - **ILU(0) / IC(0) preconditioners** (new). `cg`/`gmres`/`bicgstab`/`minres` now accept
    `preconditioner: 'ilu' | 'ic'` (plus exported `incompleteLU`/`incompleteCholesky`). Measured iteration
    reductions on an ill-conditioned 2D-Poisson SPD system: IC(0)-CG 12 vs 22 iters, ILU(0)-BiCGSTAB 7 vs 15 —
    same solution.
  - **`minres` — O(k³) → O(k·n)**. Replaced the grow-and-re-solve tridiagonal least-squares with the classic
    Paige–Saunders short recurrence (Lanczos + incremental Givens QR + 3-term `w`-recurrence): one matvec per
    iteration, O(1) other work. Solutions unchanged (pinned vs `scipy.sparse.linalg.minres`).
  - **`qz` no longer throws on all-real non-symmetric pencils.** Its homegrown single-shift `realSchur` failed to
    converge (e.g. `A=[[1,2,0],[0,3,1],[1,0,4]]`, `B=diag(2,1,3)`); the Schur step now routes to the matrix
    package's hardened `matrixSchur` (Hessenberg → Francis double-shift → exceptional-shift stall breaking).
    `generalizedEig` was already scipy-correct (routes through the hardened `eig`) — verified, unchanged.

## 0.45.0

### Minor Changes

- Stiff-ODE follow-ups: matrix `luSolve` + `solveODE` event detection.

  **matrix — new `luSolve(fac, b)` export.** Solves `A·x = b` from an `lu()` factorization (the package had `lu()`
  but no solve step — a real gap). numpy-pinned.

  **functions — `solveODE` linear solve routed onto the matrix LU (threshold hybrid, neutral).** The
  Rosenbrock/RODAS stiff step re-factorized the iteration matrix per RHS with inline elimination; it now factors
  once via matrix `lu()`+`luSolve` for `n ≥ 8` and keeps the inline path for the tiny `n = 1–3` matrices real
  stiff systems use (measured 1.8–8× faster there — `DenseMatrix` allocation overhead dwarfs the trivial work
  until `n ≈ 8`, the same crossover the det/inv fast-paths use). Existing stiff behavior is **bit-for-bit
  unchanged** on the small path; the `n ≥ 8` path is oracle-pinned.

  **functions — `solveODE` event detection (`events` option).** scipy `solve_ivp`-style: `events` is a function
  or array of `g(t, y)` whose zero-crossings are located (cubic-Hermite dense interpolation + bisection), with
  `terminal` (stop at the crossing) and `direction` (±1 sign filter) as function properties or `{event, terminal,
direction}` objects. Returns `tEvents`/`yEvents`; a terminal event truncates the output. Absent the option the
  result shape is unchanged. Event times match `scipy.integrate.solve_ivp(..., events=)` to ~1e-8 or better.

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.7.0

## 0.44.0

### Minor Changes

- Signal: exact Parks–McClellan `remez` (**breaking convention change**) + `buttord` bandpass/bandstop.

  **`remez` — exact Parks–McClellan (BREAKING convention change).** The optimal equiripple FIR designer now
  uses the exact Parks–McClellan / Remez exchange algorithm (a faithful port of the McClellan–Parks–Rabiner
  program `scipy.signal.remez` wraps) instead of the previous Lawson-IRLS approximation. Taps now match
  `scipy.signal.remez` to machine precision (~1e-16) across Type I/II/III/IV, lowpass/highpass/bandpass/
  multiband/weighted/Hilbert/differentiator. **To match scipy exactly the calling convention changed** and this
  is breaking for existing callers: band edges are now normalized to `[0, 0.5]` (fs=1, 0.5=Nyquist), and
  `desired`/the new optional `weight` take **one value per band** (`bands.length/2`), not per edge; an optional
  `type` (`'bandpass'` default / `'differentiator'` / `'hilbert'`) was added. (This mirrors scipy's own
  inconsistency between `remez` and `firls` — `firls` keeps its `1=Nyquist`, per-edge convention.) Callers using
  the old convention must update their band/desired arrays.

  **`buttord` — bandpass/bandstop array form (additive).** `wp`/`ws` now accept `[low, high]` pairs (bandpass /
  bandstop), returning a 2-element `Wn`; scalar lowpass/highpass is unchanged. Order matches
  `scipy.signal.buttord` exactly and `Wn` to ~1e-8 (via scipy's exact bandstop passband-edge optimizer).

## 0.43.3

### Patch Changes

- Update the physical constants to CODATA-2022 (were CODATA-2018, one cycle behind scipy).

  27 measured constants shifted to their CODATA-2022 values, oracle-pinned to `scipy.constants` (e.g.
  `electronMass` 9.1093837015e-31 → 9.1093837139e-31, `fineStructure` 7.2973525693e-3 → 7.2973525643e-3,
  `weakMixingAngle` 0.2229 → 0.22305, plus proton/neutron/atomic masses, Bohr radius/magneton, Rydberg,
  fine-structure-derived quantities, and the Planck units). The five constants fixed exactly by the 2019 SI
  redefinition (`speedOfLight`, `planckConstant`, `elementaryCharge`, `boltzmann`, `avogadro`) and everything
  derived purely from them are unchanged, as is `gravitationConstant`. A new standing oracle test
  (`functions/tests/physical-constants-codata2022.test.ts`) pins every physical constant to scipy so they can't
  silently drift a CODATA cycle behind again.

## 0.43.2

### Patch Changes

- Resolve the deduplication campaign's final decisions: a compat compatibility correction and an internal WasmLoader consolidation.

  **compat (behavior change):** `zeros(n)` and `ones(n)` with a single argument now return a length-`n` **vector** (`[0,0,0]` / `[1,1,1]`), matching mathjs, instead of an `n×n` square matrix. Two-argument `zeros(r, c)` / `ones(r, c)` continue to return an `r×c` matrix. compat's purpose is mathjs compatibility, and the previous square result diverged from mathjs (`math.zeros(3)` is a size-`[3]` vector) — this was a bug. Anyone relying on `zeros(n)` returning a square must now pass `zeros(n, n)`.

  **core / functions / matrix (internal, no runtime behavior change):** the shared WASM-loader logic — the SHA-384 integrity verification (`sha384OfBuffer` / `verifyWasmIntegrity` / `loadWasmManifest`) and packaged-binary resolution (`resolvePackagedWasm` / `defaultWasmLocation`) — was byte-identical in `functions` and `matrix` and is now single-sourced in `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`), with each package injecting its own binary/manifest path. The SHA-384 verify-before-instantiate security invariant is preserved byte-for-byte (Node `crypto.createHash('sha384')` / browser `crypto.subtle.digest('SHA-384')`, mismatch throws), node built-ins stay behind lazy dynamic `import()`, and core's browser-safe `.` entry is unaffected. The per-package `WasmLoader` class stays local (distinct AS allocation models).

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0
  - @danielsimonjr/mathts-matrix@0.6.3
  - @danielsimonjr/mathts-expression@0.6.7
  - @danielsimonjr/mathts-parallel@0.6.3

## 0.43.1

### Patch Changes

- Fix two BigNumber/Complex transcendental correctness bugs found by an mpmath/NumPy oracle audit, and consolidate the fftshift/ifftshift roll algorithm.

  **core (correctness):**
  - `BigNumber.divide` lost all precision when the divisor's coefficient had more digits than the (precision-scaled) dividend — the Newton-iteration step `2 / (g*g)` in `cbrt`/`sqrt` integer-divided to a quotient of `0`. As a result `cbrt(bignumber(2))` returned `4.6e-18` instead of `1.2599…`, and `asinh`/`acosh` on BigNumber degraded to ~11–16 digits. The dividend scale is now widened by `max(0, divisorDigits - dividendDigits)`; the result is **bit-identical** whenever `divisorDigits ≤ dividendDigits`, so no previously-correct division changes.
  - `Complex.acosh` landed on the wrong Riemann sheet for `Re(z) < 0` (`acosh(-1+0.5i)` returned the negated value). It now uses the factored principal form `ln(z + √(z-1)·√(z+1))` (C99 Annex G / DLMF 4.37 / NumPy).

  Every rich-type case of the 12 transcendental scalars (`sinh cosh tanh asinh acosh atanh cbrt log2 log10 log1p expm1 sign`) is now pinned to the mpmath/NumPy oracle by `functions/tests/gap-transcendental-richtype-oracle.test.ts`.

  **functions:** the public `fftshift`/`ifftshift` (`number[]`) and the internal generic complex-FFT toolkit versions now share one `rollBy<T>` algorithm instead of duplicating the roll logic; behavior is unchanged.

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0
  - @danielsimonjr/mathts-expression@0.6.6
  - @danielsimonjr/mathts-matrix@0.6.2
  - @danielsimonjr/mathts-parallel@0.6.2

## 0.43.0

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

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.11.0
  - @danielsimonjr/mathts-expression@0.6.5
  - @danielsimonjr/mathts-matrix@0.6.1
  - @danielsimonjr/mathts-parallel@0.6.1

## 0.42.0

### Minor Changes

- Niche special functions + numerics (B-spline, Monte-Carlo)

  **Special functions:** adds `polylog` (|z|<1 series), `struveH`/`struveL`, `kelvinBer`/
  `kelvinBei` (order 0), and `barnesG` (real) — series/recurrence implementations pinned to
  mpmath dps=25 (machine precision).

  **Numerics:** adds `bsplineFit`/`bsplineEval` (de Boor collocation — interpolation +
  least-squares smoothing, scipy `tck` shape) and `monteCarloIntegrate` (uniform +
  Halton/Sobol quasi-MC over an axis-aligned box, seeded/reproducible). Oracle-pinned vs
  scipy and known integrals.

## 0.41.0

### Minor Changes

- Stiff-solver RODAS + statistics breadth

  **ODE:** `solveODE` gains `method: 'RODAS'` (Hairer-Wanner 4th-order, 6-stage, L-stable
  Rosenbrock) for tight tolerances where the 2nd-order ode23s takes too many steps (256 vs
  1487 steps to reach 1e-8 on a stiff linear system), plus an optional analytic `jac`
  Jacobian for the stiff methods. Verified vs the exact linear-stiff solution and scipy Radau
  on the Robertson problem.

  **Stats:** adds `glm` (generalized linear models via IRLS — Poisson log link, Gamma
  log/inverse), `mvnPdf`/`mvnSample` (multivariate-normal density + Cholesky sampling), and
  `tTestPower` (two-sample t-test power via the noncentral t). Oracle-pinned vs
  statsmodels/scipy.

## 0.40.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.6.0

## 0.40.0

### Minor Changes

- Graph and geometry breadth

  **Graph:** adds `graphColoring` (greedy Welsh-Powell), `maxClique` (Bron-Kerbosch),
  `louvainCommunities` (deterministic Louvain modularity), `katzCentrality`, and
  `isIsomorphic`; `betweennessCentrality` gains a `normalized` option. Oracle-pinned vs
  networkx 3.6.1. **Fix:** undirected `betweennessCentrality(normalized:true)` was 2× too
  large (the rescale divisor was `(n-1)(n-2)/2`; networkx uses `(n-1)(n-2)` for both directed
  and undirected since raw Brandes already double-counts undirected pairs) — now matches
  networkx.

  **Geometry:** adds `quaternionExp`/`quaternionLog`/`quaternionPow` (unit-quaternion
  exponential map, scalar-first `[w,x,y,z]`) and `rayTriangleIntersect` (Möller-Trumbore) /
  `rayPlaneIntersect` / `segmentSegmentClosest`. Oracle-pinned vs scipy `Rotation` and closed
  forms. (SphericalVoronoi / alpha-shapes / halfspace-intersection remain — they need a
  Delaunay/convex-hull engine.)

## 0.39.0

### Minor Changes

- `funm` handles defective matrices; wavelet families db/sym/coif

  `funm(A, f)` no longer throws on defective / repeated-eigenvalue (non-diagonalizable)
  matrices — it now uses confluent Hermite interpolation (Newton divided differences over
  repeated eigenvalue nodes). Derivatives of `f` come from an optional additive `fDerivs`
  argument (machine precision — wired for `cosm`/`sinm`) or an order-tuned finite-difference
  fallback. Verified on Jordan blocks vs closed forms and scipy `expm`/`sqrtm`; the
  distinct-eigenvalue path is unchanged.

  `dwt`/`idwt`/`wavedec`/`waverec` now support the db1-4, sym2-4 and coif1-2 wavelet
  families (previously Haar/db1 only), via a general orthogonal filter bank with a
  periodization boundary. Filter coefficients and single-level transforms match PyWavelets
  1.8.0 bit-for-bit; perfect reconstruction holds for every family. `cwt` is unchanged.

## 0.38.0

### Minor Changes

- `besselK` uniform machine precision + `quantileSeq` interpolation modes

  `besselK`/`besselK0`/`besselK1` now use a uniformly-accurate Numerical-Recipes
  `bessik` method (Temme power series for x<2, Steed continued fraction CF2 for
  x≥2), eliminating the ~1.6e-9 relative-error floor the old series/asymptotic
  split left in x∈[8,11]. Worst-case relative error across x∈[0.1,50] is now
  ~8e-16 (machine precision), verified vs mpmath. The order recurrence for n≥2 is
  unchanged.

  `quantileSeq` gains numpy's `lower`/`higher`/`nearest`/`midpoint` interpolation
  modes via an optional trailing `mode` argument; `linear` remains the default, so
  all existing calls are unchanged. Oracle-pinned vs numpy.

## 0.37.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.5.0

## 0.37.0

### Minor Changes

- `cancel` now performs real univariate symbolic rational cancellation

  `cancel(expr)` reduces univariate integer-coefficient rationals via polynomial GCD
  (`(x^2-1)/(x-1)` → `x + 1`, `(2*x^2-2)/(2*x-2)` → `x + 1`, `(x^3-1)/(x^2-1)` →
  `(x^2+x+1)/(x+1)`), matching `sympy.cancel`, including shared numeric-content
  cancellation. Numeric-fraction, identical-string, multivariate and non-integer paths are
  unchanged.

  Also in this release: `multipleComparison` and `multipleTest` now share one
  Bonferroni/Holm/Benjamini-Hochberg implementation (both public names and signatures
  unchanged, results identical); cross-reference docs clarify that `chiSquareTest` and
  `chi2Contingency` are complementary, not redundant. New implementation-independent
  oracles pin `csd`/`coherence` invariants and `linprog`'s free-variable (`lower=null`)
  bounds path (both were already correct — regression guards).

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.4.6

## 0.36.0

### Minor Changes

- Phase 8 — graph, geometry, interpolation, intervals, and a real CAS engine (final oracle-gap roadmap phase): graph algorithms `bfs`/`dfs`/`floydWarshall`/`bellmanFord`/`closenessCentrality`/`harmonicCentrality`/`maxFlow`/`minCut`/`astar`/`hungarian`; geometry `quaternionSlerp`/`quaternionInverse`/`quaternionToEuler`/`boundingBox`/`procrustes`/`kdTreeKNN`/`kdTreeRadius` and multiset `setIsSuperset`/`setEqual`/`setDisjoint`; N-D `interpn` + a generalized `solveBVP` (beyond the previous 2-unknown limit); `interval`/`Interval` (outward-rounded interval arithmetic — the first verified-bounds numeric type); and a real univariate CAS engine — `expand`/`factor`/`apart`/`together` now perform actual polynomial/rational algebra (verified vs sympy), resolving the Phase-0 pass-through no-ops. All oracle-pinned vs scipy/networkx/sympy.

## 0.35.0

### Minor Changes

- Phase 7 advanced linear algebra (oracle-gap roadmap): iterative Krylov solvers `cg`/`gmres`/`bicgstab`/`minres` (dense or matvec, optional Jacobi preconditioner); `eigsh` (Lanczos k-eigenpairs of a symmetric matrix); structured & indefinite solvers `thomasSolve` (tridiagonal), `solveBanded`, `toeplitzSolve` (Levinson–Durbin), `ldl` (Bunch–Kaufman LDLᵀ); complex matrix functions `funm`/`cosm`/`sinm` (indefinite/complex spectra); and control-theory matrix equations `dlyap` (discrete Lyapunov), `care`/`dare` (continuous/discrete algebraic Riccati via matrix sign function / structure-preserving doubling) for LQR/Kalman design. All oracle-pinned vs scipy.

## 0.34.0

### Minor Changes

- Phase 6 signal processing breadth (oracle-gap roadmap): FFT helpers `rfft`/`irfft`/`fftshift`/`ifftshift`/`fftfreq`/`rfftfreq`/`fftn`; IIR filter design `cheby1`/`cheby2`/`ellip` (elliptic via exact nome/Landen) + `butter` now honors `btype` (high/bandpass/bandstop; 2-arg lowpass unchanged) + `sosfilt`/`zpk2sos`/`bilinear`/`buttord`; FIR + smoothing `firwinBandpass`/`firls`/`remez`/`savgol`/`wiener`/`deconvolve`; wavelets `idwt`/`wavedec`/`waverec`/`cwt`; and spectral/peak analysis `findPeaks`/`peakWidths`/`csd`/`coherence`/`stft`/`istft`/`decimate`. Filter coefficients oracle-pinned vs scipy.signal; resolves the Phase-0 note that `butter`/`firwin` were lowpass/scalar-only.

## 0.33.0

### Minor Changes

- Phase 5 special functions & number theory (oracle-gap roadmap): hypergeometric `hyp0f1`/`hyp1f1`/`hyp2f1` + generic `pFq` (the master functions); `polygamma`/`trigamma` (ψ⁽ⁿ⁾ — only digamma existed); orthogonal polynomials `jacobiP`/`gegenbauerC`; Jacobi elliptic functions `jacobiSN`/`jacobiCN`/`jacobiDN` (AGM; complementing the elliptic integrals); `rootsLegendre` (Gauss–Legendre nodes/weights for custom quadrature); and number-theory fills `continuedFraction`, `eulerNumbers`, signed `stirlingS1`, `discreteLog` (baby-step giant-step), `primitiveRoot`, `multiplicativeOrder`, `kroneckerSymbol`, and lexicographic `permutationsGen`/`combinationsGen` tuple enumerators. All oracle-pinned vs mpmath/scipy/sympy.

## 0.32.0

### Minor Changes

- Phase 4 statistics inference (oracle-gap roadmap): `fitDistribution` (MLE fits for normal/exponential/lognormal/poisson/gamma, gamma via the digamma shape equation); **exact small-n Mann–Whitney p-values by default** (was the normal approximation, materially wrong for small n — matches scipy `method='exact'`), a `kolmogorovSmirnov2Test` opt-in `method:'exact'|'asymp'|'auto'` (asymptotic default unchanged), and `kendallTauTest` (τ + p-value); time-series inference `pacf` (Levinson–Durbin), `ljungBox`, `durbinWatson`, `adfuller` (ADF unit-root, MacKinnon approximate p); noncentral distribution CDFs `noncentralChi2CDF`/`noncentralFCDF`/`noncentralTCDF`; circular statistics `circmean`/`circstd`/`circvar` + `vonMisesPDF`; and paired-categorical tests `mcnemar`/`cochranQ`. All oracle-pinned vs scipy/statsmodels.

## 0.31.0

### Minor Changes

- Phase 3 regression & ML breadth (oracle-gap roadmap): `ols` (multiple/multivariate linear regression with full inference — coefficients, stderr, t/p-values, R²/adjusted-R², F-statistic, residuals); `ridge`/`lasso`/`elasticNet` (regularized regression — closed-form L2, coordinate-descent L1 with exact sparsity, combined L1/L2); `logisticRegression` (binary logistic regression via IRLS with predict/predictProba — the first classifier/GLM); `dbscan` (density-based clustering) + `knnClassify`/`knnRegress` (k-nearest-neighbour classifier/regressor); `gaussianKDE` (1-D Gaussian kernel density estimation, Silverman bandwidth); and `chi2Contingency` (χ² test of independence with Yates correction + Cramér's V) + `multipleTest` (Bonferroni/Holm/Benjamini–Hochberg FDR correction). All oracle-pinned vs scikit-learn / scipy / statsmodels.

## 0.30.0

### Minor Changes

- Phase 2 optimization core (oracle-gap roadmap): `bfgs` — BFGS quasi-Newton minimizer with Armijo line search, numeric or analytic gradient, and optional box projection (the smooth-optimization workhorse complementing Nelder–Mead `minimize`); `nnls` (Lawson–Hanson non-negative least squares) and `lsqBounded` (projected-gradient box-constrained least squares), each returning `{ x, residual }`; and a two-phase-simplex overload of `linprog` — `linprog(c, { A_ub, b_ub, A_eq, b_eq, bounds })` → `{ x, fun, success, status }` supporting equality constraints, variable bounds, and infeasible/unbounded detection (the legacy positional `linprog(c, A_ub, b_ub)` signature is unchanged). All oracle-pinned vs scipy.

## 0.29.0

### Minor Changes

- Phase 1 foundational numeric primitives (oracle-gap roadmap): `numericJacobian(f, x0)` (central-difference Jacobian for F:ℝⁿ→ℝᵐ) and a polymorphic `jacobian` (numeric when the first arg is a function; symbolic path unchanged); open scalar root-finders `newton`/`secant`/`halley` (complementing the bracketing `findRoot`); nonlinear system solver `fsolve`/`root` (damped Newton with backtracking line search); scalar minimizer `minimizeScalar` (Brent); adaptive Gauss–Kronrod `quad` (G7–K15 with error estimate) which also fixes `nintegrate`'s endpoint-singular accuracy (∫₀¹ x^-1/2 was ~1.7e-6 off, now ~1e-10); and full `svd` (re-exported from the matrix package) plus `orth` (column-space basis) on the functions surface. All oracle-pinned vs scipy/numpy/closed forms.

## 0.28.0

### Minor Changes

- Phase 0 correctness & honesty fixes (oracle-gap roadmap). Bug fixes: `invmod` threw on every call; `lambertW`'s documented lower branch (W₋₁) was unimplemented and now works (Halley); `windowFunction` silently returned a rectangular window for unimplemented types (now throws); `stiffODESolver` diverged on stiff systems (fixed-point implicit Euler) and now delegates to the proven L-stable Rosenbrock engine (extracted as the shared `rosenbrockSolve` export); `summation`/`symbolicProduct` silently returned 0/1 on symbolic bounds (now throw); `taylor`/`series`/`seriesCoefficient` produced garbage coefficients past ~order 3 (finite differences) and are now exact via the Cauchy integral; `linprog` could return an infeasible optimum on degenerate cases (extraction now maps each constraint row to one basic variable). Docs honesty: corrected `betainc`'s documented argument order to `(a, b, x)` (the implementation was always correct) and annotated the pass-through CAS transforms (`factor`/`expand`/`apart`/`together`/`casFactor`/`casExpand`) as not-yet-implemented. All fixes oracle-pinned (mpmath/scipy).

## 0.27.0

### Minor Changes

- 1174c41: Add a stiff ODE solver: `solveODE(..., { method: 'Rosenbrock' })`

  `solveODE` previously offered only explicit methods (RK23, RK45), which stall or blow up on **stiff**
  systems — chemical kinetics, electrical circuits, control systems, reaction-diffusion — the backbone
  of engineering/scientific modeling. Added the linearly-implicit **ode23s** method (Shampine &
  Reichelt): 2nd-order, L-stable, with an embedded error estimate for adaptive stepping. It forms a
  finite-difference Jacobian and one LU factorisation of `W = I − h·γ·J` per step (reused for its three
  stage solves), so it takes steps at the slow time-scale where explicit methods would need vanishingly
  small ones.

  ```ts
  // Van der Pol at μ=1000 — explicit RK45 needs ~10⁶ steps; Rosenbrock handles it directly.
  solveODE((t, y) => [y[1], 1000 * (1 - y[0] ** 2) * y[1] - y[0]], [0, 3000], [2, 0], {
    method: 'Rosenbrock',
    tol: 1e-6,
  });
  ```

  Verified against a linear stiff system's exact solution and against `scipy.integrate.solve_ivp`'s BDF
  on stiff Van der Pol. Plain-number state only (the Jacobian and linear solve are numeric); RK23/RK45
  remain the default for non-stiff problems.

## 0.26.0

### Minor Changes

- 199da08: Fix `solveODE` — the JS reference path was fully broken; add initial-step selection

  `solveODE`'s JavaScript path threw `multiply(Array, Array) requires two 2-D matrices` on **every**
  call: the adaptive Runge-Kutta step combined its stages with the mathjs form `multiply(h, a[i], k)`,
  which relies on vector·matrix / vector·vector `multiply` semantics that MathTS's typed `multiply`
  rejects for 1-D operands (it routes those to `dot`). It stayed green in CI only because the test
  environment loads a WASM kernel that takes a different path — but **scalar ODEs** (a non-array `y0`)
  and any consumer without the WASM binary loaded always hit the broken JS path.

  The stage combinations are now computed term-by-term through the scalar-broadcasting `multiply`/`add`
  (a new `stageCombo` helper), so scalar and vector states both work — verified against closed-form
  solutions (`y'=-y → e⁻¹`, logistic, harmonic oscillator, backward integration) for both RK23 and RK45.

  Also added a proper **initial-step heuristic** (`h₀ ≈ 0.01·‖y0‖/‖f(t0,y0)‖`, Hairer): the solver
  previously used the whole time span as its first step, which could slip past an embedded error test
  and silently accept a crude low-order result — RK23 on `y'=-y` returned `1/3` instead of `e⁻¹`. Both
  methods are now robust from the first step without the caller supplying `firstStep`.

## 0.25.1

### Patch Changes

- 4f395c9: Fix `zeta` at negative arguments and improve `besselK` in the transition band

  A fresh sweep of the special-function surface against mpmath (dps=50) and SciPy found everything
  already machine-precision (gamma/erf/digamma/elliptic/besselJ·I, and every distribution CDF/quantile
  even deep in the tails) — except two spots:

  - **`zeta` at negative real arguments** was up to **1.5e-7** off (`zeta(-3)`, exact 1/120): the direct
    Borwein series cancels catastrophically for negative `Re(s)` (its terms grow like `k^|Re s|`). It now
    reflects through the functional equation for `Re(s) < 0` — routing to `zeta(1-s)` with `Re > 1` where
    the series is most accurate — bringing negative arguments to **~1.9e-14** (machine precision).
    Positive, critical-strip, and complex values are unchanged.
  - **`besselK` in the series/asymptotic transition band (x≈8–11)**: the K0/K1 ascending series subtracts
    two `O(I0(x))` terms, so its cancellation error grows with x (~5.3e-9 at the old x=9 crossover). Moving
    the crossover to x=8 (where the asymptotic has overtaken it) caps the peak at **~1.6e-9** (~3× better).
    K is machine-precision below x=5 and above x=15.

  Pinned against mpmath references in `functions/tests/special-accuracy.test.ts`.

## 0.25.0

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

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-parallel@0.6.0
  - @danielsimonjr/mathts-expression@0.6.4
  - @danielsimonjr/mathts-matrix@0.4.5

## 0.24.0

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

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-expression@0.6.3
  - @danielsimonjr/mathts-matrix@0.4.4
  - @danielsimonjr/mathts-parallel@0.5.1

## 0.23.0

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

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-parallel@0.5.0
  - @danielsimonjr/mathts-expression@0.6.2
  - @danielsimonjr/mathts-matrix@0.4.3

## 0.22.0

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

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-parallel@0.4.0
  - @danielsimonjr/mathts-expression@0.6.1
  - @danielsimonjr/mathts-matrix@0.4.2

## 0.21.0

### Minor Changes

- ea044c4: Add a **GPU FFT** (radix-2 Stockham autosort, f32) and fix a threshold bug that was silently
  pessimising `parallelFFT` on the CPU.

  **GPU FFT.** Stockham rather than textbook Cooley-Tukey because it is _self-sorting_: each pass
  scatters into a second buffer, so the output arrives in natural order with **no bit-reversal
  pass** — a bit-reversal is a pure memory shuffle, the one thing a GPU is worst at. All log₂(n)
  passes go into one encoder and one submit. `parallelFFT` / `parallelIFFT` route through it when
  you opt in with `enableGpu()`; with the flag off (the default) they are bit-identical f64.

  Measured against `fftCoreFloat64` (the flat f64 core `parallelFFT` runs on this thread), warm
  JIT, Chrome / NVIDIA Pascal — regenerate with `functions/tests/gpu-fft-bench.browser.test.ts`:

  | n         | CPU f64  | GPU f32  | speedup   |
  | --------- | -------- | -------- | --------- |
  | 65,536    | 16.8 ms  | 14.4 ms  | 1.17×     |
  | 262,144   | 53.4 ms  | 24.0 ms  | **2.23×** |
  | 524,288   | 87.8 ms  | 30.5 ms  | **2.88×** |
  | 1,048,576 | 253.1 ms | 79.7 ms  | **3.18×** |
  | 2,097,152 | 399.9 ms | 116.3 ms | **3.44×** |

  **~2.2–3.4× above the threshold**, and the ratio is genuinely noisy run to run — there is no
  single hero number. f32 error is ~4e-7 peak-relative, even across 20 stages (error growth per
  stage was the risk that could have killed the kernel; Stockham is well-behaved).

  **The FFT's threshold is 262,144 — deliberately higher than `GPU_MIN_ELEMENTS` (65,536).** At
  65,536 the GPU wins by only 1.17×: inside the noise, and nowhere near enough to justify dropping
  f64 for f32. An FFT makes log₂(n) passes over the data, so it amortises the upload more slowly
  than the memory-bound element-wise chain. Sharing one threshold would have been convenient and
  wrong. Below it — and for non-power-of-two lengths, which chirp-z handles — it returns `null` and
  you keep the exact f64 path.

  **Fixed: `parallelFFT` ignored its own tuned threshold.** `shouldParallelize(paddedLength)` was
  called without the op name, so `DEFAULT_THRESHOLD_BY_OP`'s benchmark-tuned `parallelFFT: 'never'`
  was never consulted and the global 50,000 threshold applied instead — every transform above 50k
  silently took the four-step worker path. That path does not pay: **n=2¹⁸, 156 ms via workers vs
  77 ms on this thread** (2× slower) in Chrome; a wash in Node. The tuned decision was right and
  simply never read.

  **`@danielsimonjr/mathts-gpu` now exports `serializeGpu`.** The WebGPU error scope is a _per-device
  LIFO stack_, so two dispatches in flight pop each other's scope and a real validation error can go
  unobserved — returning a zero-filled buffer as a plausible result (for an FFT: a silently empty
  spectrum). The queue must therefore be shared across the whole GPU surface, not per-module.

  Also exported: `fftGpuDispatch`, `resetGpuFft`, `GpuFftOptions`, `GpuFftResult`.

### Patch Changes

- Updated dependencies [ea044c4]
  - @danielsimonjr/mathts-gpu@0.2.0
  - @danielsimonjr/mathts-matrix@0.4.1

## 0.20.2

### Patch Changes

- 7b5f1e1: Make the public `fft` / `ifft` **~137× faster** (n=2¹⁸: 14,889 ms → 108 ms). No API change,
  same f64 results.

  **Correction to 0.20.1.** That release claimed "the public `fft()` was the slowest FFT in the
  library" and quoted 2987 ms → 521 ms. Those numbers were real but they were measured on
  `functions/src/signal/fft.ts` — which is **not** the public export. It backs the convolution
  paths, so speeding it up was worth doing, but it is not what `import { fft } from
'@danielsimonjr/mathts-functions'` gives you. The public `fft` is the mathjs-derived _factory_
  function, and it was far worse than 2987 ms.

  **The real bug: its power-of-2 fast path was dead code.** `_fft` guarded on
  `len === undefined`, meaning "top-level call only" — but `_ndFft` _always_ passes `len` for
  1-D input (`_fft(arr, size[0])`). The condition could never be true, so every call fell through
  to a recursive Cooley-Tukey built out of array spreads (`[..._fft(even), ..._fft(odd)]`) doing
  its scalar arithmetic through typed-function dispatch on Complex objects.

  The guard now says what it meant (`length === arr.length`), and the fast path routes to the flat
  `Float64Array` core rather than to the AssemblyScript WASM kernel — which is itself ~6× _slower_
  than that core (1039 ms vs 170 ms at n=2²⁰), so the "fast path" was a pessimisation stacked on
  dead code.

  Measured through the public export, n=2¹⁸: **14,889 ms → 108 ms**.

  Non-power-of-2 (chirp-z) and non-f64 element types (BigNumber, Fraction, Unit) are untouched —
  `complexToInterleaved` returns `null` for those and they keep their exact semantics. Pinned by
  `functions/tests/fft-factory-correctness.test.ts` (naive-DFT oracle, complex input, Parseval,
  ifft round-trip) and `tests/benchmark/fft-factory-surface.test.ts`.

## 0.20.1

### Patch Changes

- cc1b3e4: Make the public `fft()` ~6× faster. No API change, no precision change.

  `fft()` computed its butterflies in **Complex objects** — a `{ re, im }` allocation per
  twiddle step and per butterfly — while a flat `Float64Array` radix-2 core already existed in
  the same package (the one `parallelFFT` uses) and was ~8× faster for the identical transform.
  The default FFT every consumer reaches was therefore the slowest one in the library.

  Both surfaces now share one core (`signal/fft-core-f64.ts`); `ComplexNumber[]` is materialised
  once at the boundary. Measured, same machine:

  | n         | before  | after      | vs `parallelFFT` (raw Float64Array) |
  | --------- | ------- | ---------- | ----------------------------------- |
  | 262,144   | 607 ms  | **96 ms**  | 33 ms                               |
  | 1,048,576 | 2987 ms | **521 ms** | 170 ms                              |

  The remaining gap to `parallelFFT` is the `ComplexNumber[]` boxing itself, which is inherent
  to that return type — use `parallelFFT` if you want the raw `Float64Array` spectrum.

  Same f64 arithmetic, same 1/n inverse scaling, same results. Pinned by
  `tests/benchmark/fft-public-surface.test.ts`.

## 0.20.0

### Minor Changes

- b7784ef: Add `fuseUnaryChainReduceAsync(ops, xs, reduce)` — apply an element-wise chain and reduce
  it **on the GPU**, returning a `number` instead of an array. `reduce` is
  `'sum' | 'max' | 'min'`.

  Reducing on the device sends `n/256` floats back across the bus instead of `n`. Measured
  end-to-end for `sum(exp(sin(x)))` on an NVIDIA Pascal adapter: **1.35–1.7×** faster than
  the existing GPU path followed by a JS loop, and **2.6–3.8×** faster than the CPU tier
  (WASM chain + JS sum). At n=2²²: 260 ms → 100 ms → **72 ms**. The reproducible figure is the
  **1.39× at n=2²²** (1.31–1.39× across four runs); the 1.7× upper bound comes from n=262,144,
  where the ratio swings 1.19–2.83× run to run.

  Opt-in via `enableGpu()` like every GPU path, so results carry f32 precision; with the
  flag off it is an exact-f64 CPU computation. Reach for it only when you want _just the
  scalar_ — if you also need the transformed array you pay the n-float readback anyway.

  **A standalone GPU reduction is deliberately not offered:** an empty `ops` returns `null`.
  Uploading n floats to produce one number is pure transfer tax and measured 3–9× slower
  than a plain JS sum.

  Also exported: `elementwiseChainReduceGpuDispatch`, `GPU_REDUCE_OPS`, `GpuReduceOp`.

## 0.19.0

### Minor Changes

- abbe883: Fix a 12× JS conversion tax on the GPU path, and correct the acceleration tier order.

  **The bug.** `elementwiseChainGpuDispatch` converted its input with
  `Float32Array.from(f64array)`. That is not the typed-array fast path — it is the generic
  `Array.from` algorithm, which walks the source through the ArrayLike/iterator protocol and
  runs `ToNumber` on every element. Naming the denominators, since they differ:

  - the **conversion alone** was **73× slower** — 433.32 ms versus 5.92 ms for
    `new Float32Array(x)` at n=2²⁰, for an identical result;
  - which made the **end-to-end dispatch 12.2× slower** — **439.80 ms → 36.06 ms** once fixed.

  Three sites were paying it, all on typed-array inputs: the f64→f32 input conversion, the
  f32→f64 conversion on the way back out, and `jsChain`'s copy — that last one slowing the
  **JS fallback tier for every user**, GPU or not.

  **The consequence.** That inflated figure is what made WASM appear to beat the GPU, and
  `functions@0.18.0` shipped a `fuseUnaryChainAsync` tier order of WASM → GPU → JS on the
  strength of it. With the tax removed the GPU is **3.2–8.3× faster than WASM**, so the order
  is now **GPU → WASM → JS**.

  **What changes for you.** Only if you call `enableGpu()`. That flag is the f32-precision
  consent, and the GPU tier will now actually run — so results carry ~7 significant digits
  instead of full f64, and are several times faster. With the flag off (the default) the path
  is exactly WASM → JS and results are bit-identical f64, as before. No result was ever
  incorrect; this is a performance and tier-selection change.

  ⚠️ **The blast radius of the process-global flag grew.** Previously a stray `enableGpu()`
  from a transitive dependency was largely harmless, because WASM ran first and shielded you.
  Now it silently downgrades every chain of ≥65,536 elements to f32. If that matters, pass
  `{ gpu: false }` per call — it overrides the global — or call `disableGpu()`.

  **matrix** (minor, not patch): the exported `DEFAULT_BACKEND_HINTS.gpuThreshold` changes
  100,000 → 65,536 and `DEFAULT_EXTENDED_HINTS.operationThresholds.transpose.gpu` 200,000 →
  65,536, so all GPU thresholds single-source `GPU_MIN_ELEMENTS`. The route is dormant in-tree
  (no `'gpu'` backend is ever registered), but `backendRegistry.register()` is public, so a
  consumer registering `GPUMatrixBackend` would see different routing.

### Patch Changes

- Updated dependencies [abbe883]
  - @danielsimonjr/mathts-matrix@0.4.0

## 0.18.0

### Minor Changes

- 7c53d7f: **GPU element-wise tier: correctness, ergonomics, and architecture follow-ups.**

  - **Domain edges now match JS exactly.** WGSL leaves `log(x<=0)`, `atanh(|x|>=1)` and
    division-by-zero **indeterminate** — an implementation may return anything, and zeros
    in real data are common. The kernels now pin IEEE semantics, so `log(0)` is `-Infinity`
    and `atanh(2)` is `NaN` on every device, not just the one we happened to test. (The old
    oracle test _skipped non-finite expectations_, so this was structurally invisible.)
    Subtlety: the NaN/±Inf bit patterns ride in a **uniform** — WGSL const-folds
    `bitcast<f32>(0x7fc00000u)` even inside a function body and then rejects the result
    ("value nan cannot be represented as 'f32'").
  - **`fuseUnaryChainAsync` now always returns `Float64Array`** (was
    `Float64Array | Float32Array`). That union was a footgun: `.map`/`.filter`/`.set` on it
    are TS2349 errors, so _every_ caller had to `instanceof`-narrow, and
    `new Float64Array(r.buffer)` silently produced garbage on the f32 branch. When the GPU
    runs, the values carry f32 precision inside the f64 container. Callers who want the raw
    f32 buffer can call `elementwiseChainGpuDispatch` directly.
  - **Per-call `{ gpu }` override.** `enableGpu()` is process-global mutable state — any
    dependency flipping it changed _your_ call. `fuseUnaryChainAsync(ops, xs, { gpu })` and
    `elementwiseChainGpuDispatch(..., { gpu })` are now self-describing.
  - **Uses the `mathts-gpu` foundation it was meant to.** The dispatcher had built a private
    pipeline cache and raw `createBuffer` calls, using neither the `ShaderManager` nor the
    `BufferPool` extracted for exactly this. It now uses both: pipelines are compiled **once**
    (no per-call shader compile) and buffers are **recycled**. Pooling is only safe because the
    kernel now bounds-checks against an `n` **uniform** rather than `arrayLength(&inp)` — the
    pool rounds sizes up, so an `arrayLength` guard would have run threads past the real data.
    Net effect is also a large speedup: the GPU chain went from 30.2 ms → **10.5 ms** at
    n=65,536 and 470 ms → **306 ms** at n=1M. (WASM still wins; the tier order is unchanged.)
  - Added `resetGpuElementwise()` to drop cached GPU resources.

## 0.17.2

### Patch Changes

- **Fix: published types did not compile on current TypeScript.**

  Found by compiling the _actually-packed artifacts_ against TypeScript 7 with
  `skipLibCheck: false`, in a clean project — not by checking the repo, which passes for
  reasons a consumer does not share.

  - **Duplicate WebGPU identifiers.** `gpu`/`matrix` shipped a hard
    `/// <reference types="@webgpu/types" />`. TypeScript ≥ 7's `lib.dom` now declares WebGPU
    itself, so the reference collided (`TS2300: Duplicate identifier 'GPUCommandBufferDescriptor'`).
    The reference is gone; `@webgpu/types` is now an **optional peerDependency** — modern TS
    supplies the types from `lib.dom`, and consumers on older TS can add the package.
  - **`ObjectWrappingMap` / `PartitionedMap` did not implement `Map`.** They assigned
    `[Symbol.iterator]` in the constructor through a cast, so it never appeared in the emitted
    type: `implements Map<K, V>` was a lie that only broke downstream (`TS2420`). Both now
    declare a real `[Symbol.iterator]()` whose return type is **derived from `Map` itself**
    (`ReturnType<Map<K, V>[typeof Symbol.iterator]>`), so it stays correct across TS versions —
    older libs say `IterableIterator`, TS ≥ 5.6 says `MapIterator` (which also needs
    `[Symbol.dispose]`).
  - **`functions` shipped a dangling import.** Its emitted `.d.ts` referenced `../types/index.js`,
    but the package's `files` only included `dist/`, so the module did not exist for consumers
    (`TS2307`). `types/` is now shipped.

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.3.2
  - @danielsimonjr/mathts-gpu@0.1.1

## 0.17.1

### Patch Changes

- 8e9aadb: **Fix: WASM was dead in the browser — and it invalidated the GPU tier's ordering.**

  `elementwiseChainDispatch` returned `null` for every call in a browser, so browser users
  silently got the pure-JS scalar path and the WASM tier never ran. Root cause:
  `WasmLoader.getDefaultWasmPath()`'s browser branch made a single relative-URL guess
  (`new URL('./wasm/<file>', import.meta.url)`) with no fallback, while the Node branch walks
  parent directories until it finds the binary. The guess resolved to a path that never
  existed, and the bridge's never-throw contract swallowed the failure as a `null` — so it
  failed silently. Added `resolveBrowserWasm()`, the browser counterpart to the Node resolver,
  probing the same candidate shapes with `fetch(HEAD)`. The SHA-384 integrity check is
  untouched: this only changes _where_ the loader looks, never whether the tamper check runs.

  **Consequence — `fuseUnaryChainAsync` tier order corrected to WASM → GPU → JS.** The GPU tier
  had been benchmarked at "2.3–2.9× faster", but only because its CPU baseline was JS _because
  WASM was dead_. With WASM actually loading (Chrome, NVIDIA Pascal, chain `sin→exp→tanh→cos`):
  WASM is **~1.9× FASTER than the GPU** (16ms vs 30ms at n=65,536; 254ms vs 470ms at n=1M) —
  and f64-exact where the GPU is f32. For element-wise chains the GPU is therefore both slower
  and less precise, so it must never pre-empt WASM. It still earns its place where WASM cannot
  load (~2–2.5× over JS there), and still wins decisively on compute-bound work like a large
  `gpuMatmul`. Pinned by `gpu-vs-wasm.browser.test.ts`, which fails loudly on regression.

- Updated dependencies [8e9aadb]
  - @danielsimonjr/mathts-matrix@0.3.1
  - @danielsimonjr/mathts-parallel@0.3.4

## 0.17.0

### Minor Changes

- 908f19b: Add the opt-in **WebGPU f32 acceleration tier** for fused element-wise chains.

  - `enableGpu()` / `disableGpu()` / `isGpuEnabled()` — the GPU tier is **OFF by
    default**. Opting in is required because the GPU computes in f32 (WGSL has no
    f64), and silently changing an f64 API's precision is not something a caller
    should get by accident.
  - `fuseUnaryChainAsync(ops, xs)` — async sibling of `fuseUnaryChain` that tries
    **GPU (f32) → WASM (f64) → JS (f64)**. It returns a `Float32Array` only when the
    GPU path ran, so the return type _is_ the precision contract. Added as a new
    async function rather than changing `fuseUnaryChain`'s synchronous signature.
  - `elementwiseChainGpuDispatch(ops, xs)` — the never-throw bridge (returns `null`
    to fall back), mirroring the WASM `elementwiseChainDispatch` pattern.

  Only a _fused chain_ is accelerated: a lone element-wise op on the GPU is pure
  transfer tax, while a chain uploads once, runs every op on-device via ping-ponged
  buffers, and reads back once. Measured on an NVIDIA Pascal adapter for
  `sin→exp→tanh→cos` vs the browser CPU path: **2.33x at 65,536 elements, 2.88x at
  262,144, 2.54x at 1M**. The 65,536-element threshold is set from these numbers.

  All 15 supported kernels are validated against JS oracles on a real GPU.
  `erfc`, `expm1` and `log1p` are deliberately excluded: WGSL has no builtin for any of
  them, and for expm1/log1p even the Kahan-compensated forms measured 38%/62% max
  relative error near zero on real hardware (the GPU's fast-math `log()` is inaccurate
  near 1.0). An f32 fast path may be less precise; it may not be wrong. Chains containing
  them fall back to the exact CPU tiers.

  Hardened after adversarial review: device-limit guards + a validation error scope
  (a WebGPU validation error does NOT throw — it invalidates the command buffer, and the
  zero-initialized staging buffer would have been returned as a silently WRONG all-zeros
  result); buffer cleanup on every error path; and device-lost now clears the cached
  device so the tier can recover.

### Patch Changes

- 2353e0a: Fix the WebGPU wrappers (`gpuMatmul`/`gpuAdd`/`gpuTranspose`/`gpuScale`) rejecting
  on a device-initialization failure. An environment can advertise WebGPU and still
  fail to hand out a device (lost adapter, driver refusal, revoked permission), in
  which case `GPUMatrixBackend.initialize()` rejects — and that rejection escaped the
  wrapper, because the init call sat outside the backend's CPU-fallback guard. The GPU
  is a best-effort fast path, never a hard dependency: an init failure now degrades to
  the CPU implementation, matching the documented fallback contract.
- Updated dependencies [b78b8bc]
- Updated dependencies [4b4ccd6]
  - @danielsimonjr/mathts-matrix@0.3.0

## 0.16.1

### Patch Changes

- Updated dependencies [fd3e417]
  - @danielsimonjr/mathts-expression@0.6.0

## 0.16.0

### Minor Changes

- 557e27f: **Statistics/probability gap-closure** (vs NumPy/SciPy, MATLAB, Mathematica — see `docs/roadmap/STATISTICS_GAP_AUDIT_2026-07-06.md`). Closes the audit's ranked P1/P2 gaps, each externally scipy-pinned:

  - **Surfaced 16 already-implemented functions** in the statistics library: `linearRegression`, `polyFit`, `cummax`/`cummin`/`cumprod`, `cumtrapz`, `trapzF64`, `movingAverage`, `ewma`, `detrend`, `acf`, `logsumexp`, `softmax`, `kmeans`, `spectralClustering`, `beta`, `digamma`.
  - **Regression + inference**: `linregress` (slope/intercept/r/pValue/stdErr + CI).
  - **Correlation tests with p-values**: `pearsonr`, `spearmanr`, `kendalltau` → `(coefficient, pValue)`.
  - **Descriptive conveniences**: `ptp`, `variation`, `describe`, `histogram`, `trimmedMean`.
  - **Normality & repeated-measures tests**: `andersonDarlingTest`, `dagostinoTest`, `friedmanTest`, `anova2`, `multipleComparison`.
  - **Common distributions**: `paretoDist`, `rayleighDist`, `triangularDist`, `discreteUniformDist`, `gumbelDist`, `invGaussDist`, `multivariateNormal`.
  - **Resampling & CI**: `bootstrapCI`, `meanCI`, `proportionCI`, `permutationTest`.
  - **Multivariate**: `mahalanobis`, `hotellingT2`.

## 0.15.0

### Minor Changes

- 86f786e: **Statistics/probability completeness — close the breadth gap to matrix-level parity.** Adds the standard distributions, hypothesis tests, and correlation measures a complete package ships, each pinned to an EXTERNAL oracle (scipy 1.17.1), matching the domain's existing scipy-oracle discipline:

  - **Two-sample Kolmogorov–Smirnov** (`kolmogorovSmirnov2Test`) — the commonly-used form; the prior KS was one-sample only.
  - **Levene + Bartlett** variance-homogeneity tests (`leveneTest`, `bartlettTest`).
  - **Hypergeometric + negative-binomial** distributions (`hypergeometricDist`, `negativeBinomialDist`).
  - **Paired t-test** (`studentTTestPaired`), **proportion z-tests** (`proportionZTest`), **binomial test** (`binomialTest`).
  - **Kendall's τ** (`kendallTau`) — completing Pearson/Spearman/Kendall.

  Also adds external scipy pins for three distribution methods previously verified only by inversion round-trips (`poissonDist.cdf`, `logNormalDist.quantile`, `weibullDist.quantile`).

## 0.14.0

### Minor Changes

- 1df691c: **GC12 — `config()` now drives behavior + compat uses the real functions types.**

  - functions gains a `config()` accessor (`config-api.ts`): read the global runtime config, or pass a partial to merge it. Functions read this shared object live at call time (e.g. `identity`/`range`'s `config.matrix === 'Array'` return-type switch, `zeta`'s `config.relTol`), so `config({ matrix: 'Array' })` genuinely changes results. It is process-global (the functions surface is a singleton), not per-instance like mathjs `create()`.
  - compat's `config()` was **inert** (mutated a private object nothing read); it now forwards to `functions.config`, so `math.config({ matrix: 'Array' })` drives the functions surface, and `create(all, { … })` seeds it.
  - Deleted `compat/src/functions.d.ts` — an outdated ambient `declare module` stub (21 functions) whose own header said "until the functions package has proper .d.ts files." It was **shadowing** the real, complete functions types, so `import * as F` saw an empty namespace (even `F.zeta`/`F.cbrt` were invisible). compat now type-checks against the real 829-export surface. This closes GC12's "widen functions.d.ts" at root cause.

  Config is now process-global: a `delegation` test that asserted per-instance isolation was updated to reflect this (isolation was only ever "true" because config did nothing).

### Patch Changes

- f2211c8: **Fix `zeta` on the line Re=1 + add a complex-ζ oracle (GC6).** `zetaComplex` returned `NaN` for the _entire_ vertical line Re=1, but the simple pole is only the point s=1 — `ζ(1+it)` for `t≠0` is finite (e.g. `ζ(1+i) = 0.5822 − 0.9268i`). Fixed the guard (`s.re === 1` → `s.re === 1 && s.im === 0`). Added `gap-zeta-complex-oracle.test.ts` pinning `ζ(complex)` to **mpmath 1.3.0** (dps=40) across all three regions — convergent Re>1, the critical strip, and Re<1 via the functional equation — plus the pole and the first two nontrivial zeros on Re=1/2. Measured accuracy ~1e-14 (convergent/strip), ~1e-11 (reflection); the complex path was already implemented (Gourdon–Sebah / Borwein) but had no external oracle.

## 0.13.3

### Patch Changes

- b550758: Fix `cbrt(number, allRoots)` — the real-number two-argument form now works instead of throwing "Too many arguments in function cbrt (expected: 1, actual: 2)". Both the programmatic `cbrt` and the expression-language `cbrt` gained explicit `number, boolean` / `Complex, boolean` signatures that route through the complex cube-root path: `cbrt(8, true)` returns all three cube roots `[2, -1±i√3]` and `cbrt(8, false)` the principal root (matching mathjs 15). The source previously assumed typed-function would synthesize `number, boolean` via a number→Complex conversion, which the MathTS typed instance does not.
- a267d80: **Fix `expand` distribution bug + add a CAS-vs-sympy oracle (GC11).** `expand('(x + 1)*(x - 2)')` returned `x*x - 2 + 1*x - 2` (value x²+x−4) instead of the correct x²−x−2 — it split each factor on `+` only, so `x - 2` stayed a single term and the `−2` dangled through distribution. Fixed by normalizing binary subtraction to a signed additive term (`x - 2` → `["x", "-2"]`) before distributing. Surfaced by a new external-oracle test (`gap-cas-sympy-oracle.test.ts`) that pins `derivative`/`simplify`/`expand`/`factor`/`rationalize` to **sympy 1.14.0** by numeric agreement at sample points — the implementation-independent discipline (never assert a CAS result against its own re-serialization).

## 0.13.2

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0
  - @danielsimonjr/mathts-expression@0.5.3
  - @danielsimonjr/mathts-matrix@0.2.2

## 0.13.1

### Patch Changes

- 7b2b651: Remove 8 dead (unreachable, unexported, untested) source files surfaced by the upgraded dependency-graph tool: `expression` `ArgumentsError.ts`; `functions` `utils/{function,log,lruQueue,bignumber/constants}.ts` (a closed import subgraph reachable from nothing); `matrix` `types.ts`; `parallel` `workers/compute.worker.ts` (a superseded worker never built — `matrix.worker.ts` is the live one); `wasm` `env/abort.ts` (a custom AssemblyScript abort handler never wired via asconfig, tree-shaken by `asc`). None were reachable from any package entry point or build root, so the published bundles are byte-identical; this is a source-tree cleanup. Verified: build 22/22, wasm build, typecheck 28/28, test 44/44, eslint clean.
- Updated dependencies [7b2b651]
  - @danielsimonjr/mathts-expression@0.5.1
  - @danielsimonjr/mathts-matrix@0.2.1
  - @danielsimonjr/mathts-parallel@0.3.3

## 0.13.0

### Minor Changes

- ce8f929: **Expression-language transforms wired** (the formerly-dormant `expression/src/transform` pocket — 25 transforms, mathjs-verified). Inside the expression language, semantics now match mathjs exactly (verified against mathjs 15 output): indices and dimensions are **one-based** (`A[1]` is the first element — previously zero-based, contradicting the parser's documented one-based design; `A[end]` works; `row(M, 1)`/`column(M, 1)` return the first row/column; `max`/`min`/`sum`/`mean`/`std`/`variance`/`cumsum` accept 1-based `dim` arguments — previously rejected), ranges include their end (`1:3` = `[1,2,3]`), map/filter/forEach callbacks receive one-based index arrays, and `and`/`or`/`??` short-circuit lazily (`rawArgs` — `true or undefinedVar` no longer throws). Each transform factory takes its base function as an **injected dependency** (no parallel implementation layer); the standalone compiler gained `rawArgs` and `end` support; the `MathJSDenseMatrix` bridge now invokes callbacks arity-appropriately (a typed 2-arg expression lambda previously threw "Too many arguments"). The programmatic API is unchanged — only the expression namespace gets transform semantics, exactly like mathjs. **This is a breaking change for expression strings that relied on the old zero-based indexing.**

### Patch Changes

- 598e72d: Wire the 92 formerly-dormant `embeddedDocs` entries (MathTS-native extensions: CAS/algebra, geometry, numeric, probability, signal, special) into the docs index — `help('polyFit')`, `help('gaussQuad')`, `help('besselJ0')`, etc. now work; previously these doc files existed but were invisible to `help()`. The one doc for a nonexistent function (`distribution`, a removed mathjs factory) was deleted rather than wired. A completeness test now pins that every documented function exists in the surface (docs never lie). Combined with the transform wiring, the expression package's dormant-file count drops 127 → ~4.
- Updated dependencies [598e72d]
- Updated dependencies [ce8f929]
  - @danielsimonjr/mathts-expression@0.5.0

## 0.12.1

### Patch Changes

- 8bae740: Remove the runtime import cycle introduced with `typed/polynomial-ideal.ts`: `polyFromExpression` now uses a self-contained recursive-descent polynomial parser instead of importing the factory-scope `parse` (which closed the loop `factories/evaluate → typed/index → typed/algebra → polynomial-ideal → factories/evaluate`). Behavior is unchanged — all Gröbner/eliminate oracle pins pass identically; module cycles are back to 0.

## 0.12.0

### Minor Changes

- 779fcde: B-5 upstream-fix audit (all 61 drift commits since the last mathjs sync; full verdicts in `docs/roadmap/UPSTREAM_FIX_AUDIT_2026-07-05.md`):

  - **`groebnerBasis` rewritten — it was not computing a Gröbner basis at all.** The old code returned the parsed inputs "normalized", through an evaluation-based coefficient extractor that could not distinguish `x` from `x²` — `⟨x²+y²−1, x−y⟩` came back containing `x+y−1`, which does not vanish on the system's solutions. Now: exact AST-parsed polynomial arithmetic + real Buchberger (lex order) with honest iteration/size caps (new `typed/polynomial-ideal.ts`), reduced monic basis, oracle-pinned by ideal-membership vanishing tests.
  - **`eliminate` rewritten — it returned decorative strings, not equations** (`"(A) - (B) [x eliminated]"`) and echoed garbage input. Now computes the real elimination ideal (lex basis with the eliminated variable first, keep elements free of it) and throws on non-equation input.
  - **`laplacian` validates its variables** (empty array / empty strings / missing scope values throw clear errors instead of silent 0).
  - **core `Unit` gains the upstream astronomical/nautical/typography units** (`astronomicalUnit`/`AU`, `lightyear`/`ly`, `parsec`/`pc`, `nauticalMile`/`nmi`, `fathom`, `furlong`, `point`, `pica`) with the upstream prefix-direction fix: `ly`/`pc` accept upward prefixes only (`kpc`, `Mpc`, `Mly` work; `mly`/`mpc` throw instead of silently misparsing), and lowercase `au` stays undefined (Bohr-radius collision). IAU/NIST-pinned.

  Audited clean (no port needed): `discriminant`, `piecewise`, `toRadicals`, `fullSimplify`, `complexExpand`, `reduce`, `rowReduce`.

### Patch Changes

- 5f3b401: B-3: replace the dead `../../../lib/wasm/<file>` legacy fallback in all three wasm loaders (matrix `WasmLoader`, matrix `WASMBackend`, functions `WasmLoader`) with `defaultWasmLocation()` — a package-root-aware resolver that names the canonical `dist/wasm/<file>` location. The old fallback was only correct for the pre-bundling source layout: from a bundled `dist/` it resolved OUTSIDE the repo (the misleading `…/Github/lib/wasm/…` ENOENT warnings), and `<repo-root>/lib/wasm` no longer exists in any layout. The browser branch previously _only_ had the broken legacy URL and never tried the packaged location — it now returns the bundle-relative `./wasm/<file>` URL, which is correct for a served `dist/`. Behavior on the happy path is unchanged (the packaged artifact is found first, and both published tarballs ship it); what changes is that a missing binary now produces an actionable warning pointing at the real expected path, and browser consumers can actually load WASM.
- Updated dependencies [779fcde]
- Updated dependencies [583817d]
- Updated dependencies [538c672]
- Updated dependencies [5f3b401]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-matrix@0.2.0
  - @danielsimonjr/mathts-parallel@0.3.2
  - @danielsimonjr/mathts-expression@0.4.5

## 0.11.3

### Patch Changes

- b6917e1: **`shapiroWilkTest` now computes the correct Royston (1995, AS R94) W statistic and p-value.** The previous implementation used plain Blom order-statistic scores without Royston's polynomial tail-weight corrections (a*n, a*{n-1}) and φ renormalization — W was biased low by up to ~2% at small n (0.9014 vs scipy's 0.9166 on an 8-point sample), and the p-value transform used Shapiro-**Francia** constants (−1.2725 + 1.0521·ln n), the wrong test's normalization. After the fix, W agrees with `scipy.stats.shapiro` to ~2e-10 and p to ~6e-8 across pinned samples (`gap-scipy-and-tail-oracles.test.ts`), with the exact n=3 arcsine distribution and Royston's n≤11 / n≥12 branches. Returned W and p values change — they are now the standard ones users can compare against published tables.

## 0.11.2

### Patch Changes

- 22427a8: Dead-code sweep: remove all 31 verified-unreferenced exports flagged by the fixed dependency-graph unused-analysis (plus 4 cascade orphans), ~630 LOC. None were public API — every symbol was verified unimported by source, tests, docs, and factory name-string dispatch before deletion. Highlights: the mathjs number-only-bundle factory remnants (`createNthRootNumber`, `createCompareTextNumber`, `createEqualScalarNumber`, `createBigNumberClass`, `createComplexClass`, `createArgumentsError`, `createIndexError`), the dead `functions/src/expression/operators.ts` precedence/associativity chain (the live copy is the `expression` package's own), orphan utils (`initial`, `toObject`, `noIndex`/`noSubset`, `endsWith`/`escape`, `operatorPrecedence`), unused JSON/type contracts, `SI_PREFIX_KEYS`, and AssemblyScript complex-constant helpers. The unused-analysis deletion-candidate count is now **0**.
- Updated dependencies [22427a8]
- Updated dependencies [6cd4dfd]
  - @danielsimonjr/mathts-core@0.4.1
  - @danielsimonjr/mathts-expression@0.4.4
  - @danielsimonjr/mathts-parallel@0.3.1

## 0.11.1

### Patch Changes

- 47eb41c: `qz` / `realSchur`: deflate converged complex-conjugate 2×2 blocks. The shifted-QR iteration could only deflate one real eigenvalue at a time, so for a pencil with complex eigenvalue pairs the block counter never decreased and the loop always ran its full 8000-iteration cap after converging (~1s for a 4×4, ~350ms of pure no-op steps for a 2×2 rotation). It now deflates a trailing 2×2 block whose eigenvalues are complex (and stops when the remaining top block is itself a complex pair — the real Schur form cannot reduce it further), cutting the pathological cases to milliseconds. Deflation tolerances also gained an absolute fallback scale so zero-diagonal blocks (pure imaginary spectra) can deflate at all. This was the root cause of the intermittent `gap-qz` vitest-timeout failure under parallel full-suite load.

## 0.11.0

### Minor Changes

- 18871e1: `pow(A, n)` now supports **square-matrix power** for non-negative integer exponents (mathjs parity) — previously `pow` had only scalar signatures and threw `Unexpected type of argument` on a matrix. It uses binary exponentiation on the native `DenseMatrix` backend (accelerated matmul, B2). Element-wise power remains `dotPow`; negative or fractional matrix powers throw a clear error directing to the async `matrixPower(A, p)` (which does the eigendecomposition).

### Patch Changes

- dc14440: Fix the canonical `expm` (matrix exponential), which was **completely broken** — it threw on every input. The public `expm` was the factory-Padé implementation, which was instantiated inside the window where `factoryScope.multiply` is temporarily bound to `multiplyScalar` (for `det`'s scalar-element LU), so it captured a scalar-only multiply and threw `Unexpected type of argument in function multiplyScalar` on any matrix; it also lacked an `Array` signature, throwing `A.size is not a function` on a raw `number[][]`. The canonical `expm` now routes to the native, backend-accelerated `matrixExpm` (DenseMatrix/Array dispatch) — the same implementation that was already tested under the non-canonical name. The dead factory `expm.ts` (272 LOC) was removed. This is part of B2 (route factory matrix ops through the native `DenseMatrix` path).

## 0.10.1

### Patch Changes

- 7860d6a: Two input-validation fixes surfaced while adding WS-1 P2 oracles:

  - `spectralClustering` now throws a clear error when given a non-square adjacency matrix. Previously a non-square input (e.g. a point cloud mistaken for an adjacency matrix) reached the eigensolver and **looped forever**.
  - `voronoiDiagram` now throws a clear `TypeError` when its `bounds` argument is missing or not a 4-tuple, instead of crashing with `Cannot read properties of undefined`.

## 0.10.0

### Minor Changes

- 23642f2: Add `spearman(x, y)` — the Spearman rank correlation coefficient (Pearson correlation of the rank-transformed inputs, ties handled via average ranks). Unlike Pearson, it captures any monotonic relationship, so a monotonic non-linear pair returns ρ = 1. This closes the one remaining gap in the descriptive-statistics domain (`skewness`/`kurtosis`/`cov`/`gmean`/`iqr`/`zscore`/`kruskalWallis`/`wilcoxon`/`fTest` already shipped).

### Patch Changes

- dfb1b25: `kolmogorovSmirnovTest` now throws a clear `TypeError` when its `cdfFn` argument is not a function (e.g. a second sample array passed under the mistaken assumption it is a two-sample test) instead of crashing with an opaque `cdf is not a function`. It remains a one-sample test against a CDF function (default: standard normal).

## 0.9.0

### Minor Changes

- 82bb0b1: **BREAKING (Unit merge complete): one `Unit`.** The former standalone core `Unit` class (the canonical-value subset in `core/src/types/unit.ts`) is retired; `@danielsimonjr/mathts-core`'s `Unit` is now the single, feature-complete merged implementation, and `functions` `unit()`/`to()`/`toBest()`/arithmetic+comparison operators all return that one class (the `to`/`toBest` operator dual-flavor branching is gone).

  Caller migration:

  - Unit arithmetic is at the operator level — use `add`/`subtract`/`multiply`/`divide` from `@danielsimonjr/mathts-functions`, not `unit.add(…)`/`.sub`/`.mul`/`.div`. `u1 / u2` of the same dimension returns a plain dimensionless number (mathjs parity).
  - `unit.equalBase(other)` replaces `unit.dimensionsEqual(other)`; dimensions are a 9-element exponent array, not a struct; `unit.formatUnits()`/`unit.toString()` replace `.notation`.
  - Temperature offsets apply on conversion (`new Unit(20,'degC').value === 20`; `.to('K')` → `293.15 K`); `°C`/`°F`/`°` are accepted.
  - `DimensionMismatchError`/`UnitParseError` are still thrown and exported; `Unit`/`isUnitValue`/`DIMENSIONLESS`/`dim`/`Dimensions`/`UnitDef` keep their import paths. New `UnitInstance` type export for type position.

  Also corrects `eV` to the exact 2019-SI value `1.602176634e-19` J.

### Patch Changes

- c041b4e: Fix Unit arithmetic/comparison and `pinv` Array input.

  - **Unit operators**: dimensional analysis now works through the public API — `add`/`subtract`/`multiply`/`divide`/`abs` and `smaller`/`larger`/`smallerEq`/`largerEq`/`equal`/`unequal`/`compare` on `unit(...)` values (`5 cm + 3 mm = 5.3 cm`, `3 m × 4 m = 12 m²`, `10 m / 2 s = 5 m/s`, `equal(5 cm, 50 mm) = true`); mismatched dimensions throw. The typed operators had been wired to a different `Unit`'s interface, so every `unit()` arithmetic/comparison threw. Both Unit flavors (`unit()` and `to()`/`toBest()`) are supported.
  - **`pinv([[…]])`** (Array input) threw "expected DenseMatrix"; added Array-in/Array-out signatures.

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [c041b4e]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-matrix@0.1.14
  - @danielsimonjr/mathts-expression@0.4.3

## 0.8.0

### Minor Changes

- Degenerate-input hardening for the 2026-06-30 domain gap-closure functions (retroactive code-review + silent-failure pass).

  A 7-reviewer pass over the ~89 new functions found one recurring root cause: they silently returned `NaN`/`Infinity`/garbage on structurally invalid or statistically degenerate input. Policy fix: throw a clear `Error` matching the scipy/numpy semantics the docstrings claim. Covered by `functions/tests/gap-degenerate-inputs.test.ts`.

  - **descriptive-stats**: `gmean`/`hmean` throw on non-positive entries; `zscore`/`skewness`/`kurtosis` throw on constant (zero-variance) input; `skewness`/`kurtosis` return `NaN` (SciPy parity) for a bias-correction requested below its `n` domain; `cov` throws when observations ≤ `ddof`. Empty input stays graceful (`NaN`/`[]`).
  - **numeric-extra**: `logsumexp`/`softmax` use a spread-free O(n) max (was `RangeError` on ~1e5+ vectors); `cumtrapz` throws on an abscissa shorter than `y`.
  - **hypothesis-extra**: `fTest`/`jarqueBera`/`kruskalWallis`/`wilcoxon`/`tukeyHSD` guard degenerate samples; `studentizedRangeQuantile` validates `p∈(0,1)` and brackets adaptively; `studentizedRangeCDF` validates `k≥2`/`df>0` and self-extends its `umax` tail bound.
  - **linalg-extra**: `companion` throws on a zero leading coefficient; `realSchur` throws if QR ever fails to reach (quasi-)triangular form.
  - **geometry-extra**: `slerp` throws on zero-length / antipodal inputs; `quaternionNormalize` throws on zero magnitude.
  - **timeseries-extra**: `acf` guards zero-variance / out-of-range `nlags`; `ewma` guards empty input; `detrend('linear')` returns zeros for `<2` points.
  - **regression-extra**: `linearRegression` throws on `<3` points or a zero-variance predictor.
  - **optimization-extra**: `levenbergMarquardt` re-throws non-singular solver errors instead of swallowing them.
  - **clustering-extra**: `KMeansResult` gains `converged`/`iterations`; `kmeans` validates empty `data` and non-integer/`<1` `k`.
  - **signal-filter-extra**: `butter` validates `N≥1`/`0<Wn<1`; `firwin` validates `numtaps≥2` and rejects zero-sum designs; `lfilterZi` reports a clear pole-at-`z=1` error.
  - **cas-integration**: `symbolicIntegral` returns its `integral(...)` marker (not a thrown "Undefined symbol") for symbolic constant coefficients.

## 0.7.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.1

## 0.6.0

### Minor Changes

- Domain gap-analysis Waves A–D: ~69 new math/scientific functions + an eigs correctness fix.

  All verified against a NumPy/SciPy oracle; each is a thin composition over existing
  primitives (no reduction re-implemented).

  - **Descriptive stats**: `gmean`, `hmean`, `moment`, `skewness`, `kurtosis`, `iqr`,
    `sem`, `zscore`, `cov`, `corrcoef`, `rankdata`.
  - **Elementwise / cumulative / log-domain**: `clamp`, `sigmoid`, `logsumexp`,
    `softmax`, `cumprod`, `cummax`, `cummin`, `cumtrapz`.
  - **Distribution surface**: standalone `normalQuantile`, `studentTCDF/Quantile`,
    `chiSquaredCDF/Quantile`, `fCDF/Quantile`, `gammaCDF/Quantile`, `betaCDF/Quantile`,
    plus the `cauchy`/`laplace`/`logistic` PDF/CDF/quantile families.
  - **Hypothesis tests**: `fTest`, `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`.
  - **Linear algebra**: `tril`, `triu`, `vander`, `toeplitz`, `circulant`, `companion`,
    `logdet`, `laplacianMatrix`, `generalizedEig`.
  - **Calculus**: `hessian`, numeric `gradient`.
  - **Geometry / geodesy**: `haversine`, `slerp`, quaternion algebra
    (`quaternionMultiply`/`Conjugate`/`Normalize`/`FromAxisAngle`/`Rotate`/`ToRotationMatrix`).
  - **Time series & regression**: `movingAverage`, `ewma`, `detrend`, `acf`,
    `linearRegression`.

  **fix: `eigs` returned wrong eigenvalues for every non-symmetric matrix** (even
  upper-triangular ones). The public `eigs` now routes numeric square matrices through
  the correct native orthes/hqr2 solver (symmetric/non-symmetric/complex spectra).

## 0.5.0

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

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-expression@0.4.2
  - @danielsimonjr/mathts-matrix@0.1.12

## 0.4.0

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

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-matrix@0.1.11
  - @danielsimonjr/mathts-expression@0.4.1

## 0.3.0

### Minor Changes

- Gap-closure batch (GC1–GC16):

  - **fix (GC3):** accurate normal/log-normal CDF + quantile. The previous
    Abramowitz-&-Stegun erf approximation collapsed in the tails (`normalCDF(-5)`
    was 3-digit); now ~15-digit via the package's accurate `erfc` + an Acklam/Halley
    inverse-normal. Affects `normalDist`, `logNormalDist`, and `normalCDF`.
  - **fix (GC1):** `variance`/`std` now default to **unbiased** (mathjs parity) and
    accept a `normalization` argument, matching `parallelStatVariance`/`Std`.
  - **feat (GC4):** canonical-name aliases `cumsum`/`ctranspose`/`createUnit`/`apply`/
    `index`, and a real `help(search)`.
  - **feat (GC5):** `Unit` support in `add`/`subtract`/`multiply`/`divide` and the
    comparison operators (`5 cm + 3 mm`, `5 cm > 40 mm`).
  - **feat (GC6):** complex-argument `lgamma`.
  - **feat (GC7):** accelerated `multiply(2D, 2D)` via native DenseMatrix + BackendManager.
  - **feat (GC10):** `BigNumber` path for `acsc`/`asec`/`acot`.
  - **feat (GC16):** `Complex` for `round`/`floor`/`ceil`/`fix`/`sign`; `BigNumber` for
    `gcd`/`lcm`/`atan2`.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @danielsimonjr/mathts-expression@0.4.0
  - @danielsimonjr/mathts-parallel@0.3.0
  - @danielsimonjr/mathts-matrix@0.1.10

## Unreleased

### Changed — eslint `no-explicit-any`/`no-unsafe-function-type` cleanup (subset-2)

- Drove the `functions/src` dirs `utils`, `type`, `core`, `arithmetic`, and
  `complex` toward zero eslint warnings, replacing `any`/`Function` with real
  project types (`MathCollection`, `Matrix`, `Complex`, `BigNumber`, `Fraction`,
  `Unit`, `AlgorithmFunction`, `MatrixCallback`, `TypedFunction`, structural
  `unknown`+documented-narrow casts). Behavior-preserving (no logic changes);
  the functions suite stays green (2902 pass / 41 skip) and `tsc --noEmit` is 0.
- `utils`, `core`, `arithmetic`, `complex`: 0 warnings. `type/`: 0 except the
  single legacy `type/unit/Unit.ts` (still `@ts-nocheck`), which needs a
  dedicated comprehensive typing pass (see code TODO).
- Two documented `eslint-disable` lines remain in `utils/factory.ts` for the
  irreducible generic-dependency `any` default that every untyped factory across
  the repo relies on (tightening it would require annotating every factory's
  deps object).

### Changed — eslint `no-explicit-any`/other cleanup (subset-3, completes `functions/src`)

- Drove the remaining `functions/src` dirs to zero eslint warnings:
  `factories` (354), `expression` (43), `bitwise` (40), `logical` (32),
  `trigonometry` (15), `statistics` (11), `error` (8), `set`, `signal`,
  `wasm`, `typed`, `combinatorics`, `string`, `unit`, `probability`,
  `relational`, and root `types.ts`. Behavior-preserving (no logic changes);
  the functions suite stays green (2902 pass / 41 skip) and `tsc --noEmit` is 0.
- Honest replacements throughout: `factoryScope as any` → `as Parameters<typeof
createX>[0]`; matrix-algorithm casts → `as unknown as AlgorithmFunction` /
  `Parameters<typeof matAlgoX>[n]`; empty-object-type placeholders → real
  `BigNumber`/`Matrix`/`IndexInterface` types; sparse matrix element values →
  `unknown`; `expression/operators` precedence table → structural
  `OperatorProperty`/`OperatorNodeLike` types; `BigNumber` trig methods typed via
  the inherited `decimal.js` surface; `Error.captureStackTrace` via a narrow
  local interface.
- Removed redundant suppressions: stale `@ts-ignore` on `seedrandom` /
  `javascript-natural-sort` imports (already typed by `types/modules.d.ts`) and
  unused `eslint-disable` directives in `typed/cas.ts` / `typed/algebra.ts`.
- `type/unit/Unit.ts` deliberately left untouched (still `@ts-nocheck`) for its
  dedicated typing pass.

## 0.2.14

### Added — WASM acceleration tripled (3-tier gap-fill, effective-wasm 6 → 18)

- **Tier 1 — 11 more transcendentals WASM-accelerated:** `atan, sinh, tanh,
atanh, expm1, log1p, log2, log10, sec, csc, cot` over `Float64Array` ≥ 1024 now
  dispatch to new Rust `simd_*_array` kernels — benchmark-confirmed 1.4–5× over
  JS incl. the JS↔wasm copy (`npm run bench:transcendental`). Measured losers
  left on JS (hardware-fast / fast-JS): `sqrt, cbrt, asin, acos, cosh, asinh,
acosh`.
- **Tier 2 — `erfc` WASM-accelerated:** ~5–7× (its JS is a continued-fraction
  scalar, far costlier than `Math.*`). Verified <1e-12 vs the JS scalar.
- **Tier 3 — op-fusion:** new `fuseUnaryChain(ops, xs)` keeps an array resident
  in wasm across a chain of unary ops, paying the JS↔wasm copy **once** instead
  of per op — 2.4–3.1× over JS for a 4-op chain (`npm run bench:fusion`). Falls
  back to a sequential JS pass when wasm is unavailable.
- Requires the Rust wasm rebuilt (`npm run build:wasm:rust`); 19 new
  `simd_*_array` kernels in `wasm-rust/.../compat/simd_array.rs`. All paths
  verified correct (`tests/diff-elementwise`, `tests/diff-fusion`); full suite
  2882 pass.

## 0.2.13

### Added — elementwise transcendentals now WASM-accelerated

`abs`, `sin`, `cos`, `tan`, `exp`, `log` over `Float64Array` (length ≥ 1024)
now dispatch to the Rust `simd_*_array` kernels instead of plain JS. Benchmarked
net-faster than JS **including** the JS↔wasm copy (`npm run bench:elementwise`):
abs 2.7–5.1×, sin 1.6–2.4×, cos 1.6–2.2×, exp 1.4–2.1×, log 1.5–2.2×, tan 1.35–1.9×.
(`sqrt` excluded — hardware `Math.sqrt` beats wasm+copy; reductions excluded —
JS JITs `sum`/`mean` faster than wasm+copy.) Correctness verified <1e-12 vs JS
(`tests/diff-elementwise.test.mjs`).

These ops previously ran in plain JS: their `ComputePool` thresholds are
`'never'`, so the "parallel" overloads never actually parallelized.

Implementation note: the Rust wasm exports only `memory` (no allocator), and
the loader's `allocateFloat64Array` is AssemblyScript-only (`__new`), so the new
`elementwise/wasm-bridge.ts` manages its own JS-side scratch region over
`module.memory`. (The special-function bridge gracefully falls back to JS for
the Rust backend for the same allocator reason — a future enhancement, not a
defect.)

## 0.2.12

### Added — WASM acceleration now bundled and live

The package now **bundles the Rust wasm** (`dist/wasm/mathts.wasm`) and resolves
it package-relative, so the special-function array bridges (J/Y/Airy/elliptic/
Carlson/lgamma, ≥1024 elements) actually run on wasm instead of silently falling
back to JS. Previously no binary was bundled and the loader's hard-coded
monorepo-relative path resolved outside the installed package.

- `src/wasm/resolve.ts`: robust `resolvePackagedWasm` (walks up probing
  `dist/wasm/`), mirroring the matrix package. `WasmLoader` uses it.
- `scripts/copy-wasm.mjs`: build step copying `lib/wasm/mathts.wasm` +
  `wasm-manifest.json` into `dist/wasm/`.
- 10 previously-skipped wasm integration tests now run and pass.

### Fixed — Rust wasm special functions

The bundled Rust kernels carried the **same** special-function bugs as the JS
path (NR-rational Bessel, unstable `besselJn` recurrence + Miller off-by-one,
Airy asymptotic coefficient recurrence missing the `(2k-1)` factor with wrong
hardcoded `c5/c6`, low-accuracy `erfc`). Ported the same fixes to
`wasm-rust/crates/mathts-wasm/src/{bessel.rs,special/functions.rs}` and rebuilt.
Verified 90/90 vs mpmath (`tests/diff-wasm-rust.test.mjs`). Enabling wasm
therefore does **not** regress the special-function accuracy fixed in 0.2.11.

## 0.2.11

### Fixed (special-function accuracy)

A new differential audit (`npm run test:diff`, mpmath goldens, 187 cases)
found the special-function library carried the same defects as the wasm
kernels. All now pass to <1e-9. Fixes applied consistently across the three
implementations: the typed scalars (`src/typed/special.ts`), the worker-
kernel path, and the wasm-bridge JS fallback (`src/wasm/special/wasm-bridge.ts`).

- **Bessel J0/J1/Y0/Y1**: replaced low-order NR rational approximations
  (~1e-7 for J, ~1e-4 for Y) with ascending series (|x| <= 13) + Hankel
  asymptotic.
- **`besselJ` recurrence**: upward recurrence is unstable for n > x — those
  cases now use Miller's backward recurrence (was: forward whenever n <= 20,
  giving up to ~1e-3 error, e.g. J5(1)); fixed a Miller off-by-one that
  returned J\_{n+1}.
- **`besselK`**: replaced A&S polynomial approximations (~1e-8) with the
  DLMF 10.31.2 ascending series + asymptotic.
- **Airy Ai/Bi**: the asymptotic-coefficient recurrence omitted the (2k-1)
  factor (DLMF 9.7.2), making u_2 onward wrong and corrupting both branches
  (~1e-4 at Ai(-5)); the positive branch additionally used hardcoded c_5/c_6
  that were wrong. Coefficients now generated correctly; series threshold
  raised to |x| = 5 so the crossover stays accurate.
- **`erfc`**: was `1 - erf`, losing precision in the tail (~6e-8); now uses
  the Abramowitz & Stegun 7.1.14 continued fraction directly for the tail.

No public API changes.

## 0.2.10

### Fixed

- **`add` / `multiply` are now variadic over any type (mathjs parity).** They previously declared only a `'number, number, ...number'` variadic, so 3+ arguments of `Complex` (or mixed number/Complex) threw `Too many arguments (expected 2, actual 3)`. This silently broke `polynomialRoot`'s cubic branch, whose rawRoots step calls `add(b, C, divide(Delta0, C))` with a complex cube root `C`. The variadic is now `'any, any, ...any'`, folding pairwise through the binary op. (A prior note had misattributed this to a typed-function "nested-dispatch" bug — typed-function was correct; the gap was purely the number-only variadic signature.)
- **`polynomialRoot`'s cubic branch is functional again** (real, complex, and repeated roots), unblocked by the variadic fix above.

### Changed

- **`solve` (CAS) now delegates degree-≤3 root-finding to `polynomialRoot`** instead of duplicating quadratic/cubic formulas. It retains coefficient extraction, root cleaning (sorted reals then complex), and the numeric fallback for degree ≥ 4 / transcendental equations. Behavior and the public return shape are unchanged.

## 0.2.9

### Minor Changes

- `solve(equation, variable)` (CAS) upgraded from numeric-real-only to a full equation solver: accepts both expression form and `lhs = rhs` form; returns **exact closed-form roots** for polynomials of degree ≤ 3, **including complex conjugates** (`solve('x^2 + 1 = 0', 'x')` → `[Complex(0,1), Complex(0,-1)]`; `solve('x^3 - 8', 'x')` → `[2, Complex(-1, √3), Complex(-1, -√3)]`). Degree ≥ 4 and transcendental equations keep the numeric real-root scan. Real roots are returned first (cleaned of float noise, sorted ascending, deduped) followed by complex roots. The return type widens from `number[]` to `Array<number | Complex>`; existing real-root behavior is unchanged.

## 0.2.8

### Patch Changes

- `Complex` (functions-local) gains long-name aliases `subtract`/`multiply`/`divide`/`negate` (symmetric with the short names already present), so a `Complex` of either origin satisfies either calling convention.
- `MathJSDenseMatrix` now handles 1-D matrices in `toArray`/`map`/`forEach`/`clone` (single-axis indices, flat data). Previously these assumed 2-D and threw `row2 is not iterable` on 1-D results such as `cbrt(x, true)`.
- Repin to `@danielsimonjr/mathts-core@^0.1.5`.

## 0.2.7

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.2.6

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.2.5

### Patch Changes

- Fix `besselY1`, `cosIntegral` (Ci), and `airyAi`/`airyBi` returning wrong values (corrupted coefficients / divergent asymptotic series) in `src/typed/special.ts`, with regression tests. Raised `typed/` line coverage to 92%.

## Unreleased

### Tests

- Raise vitest line coverage of the active typed-dispatch layer (`src/typed/**`)
  from **77.95% to 92.01%** (subtotal over the coverage-scoped `typed/` files).
  Added 12 `cov-*.test.ts` suites under `tests/` (~480 new tests) covering the
  previously-uncovered Complex / Fraction / BigNumber / bigint scalar
  signatures, mixed-type coercion overloads, sequential (below-threshold)
  Float64Array fallbacks, error/edge paths, and the worker-dispatch fan-out
  branches (which the prior suites missed because they never initialized
  `computePool`). All assertions check real, correct mathematics through the
  typed dispatch — no coverage-gaming.
- Every coverage-scoped `typed/` file is now ≥90% line coverage **except**
  `geometry.ts` (81.9%), `numeric.ts` (86.8%), and `signal.ts` (84.4%), whose
  remaining uncovered lines are Rust-WASM kernel-dispatch blocks
  (`if (wasm) { … }`). These are dead in a pure-JS environment because the
  gitignored `lib/wasm/mathts.wasm` artifact is not built (no Rust toolchain in
  CI). The new tests cover every JS-reachable branch of those files; the WASM
  tiers self-skip when the artifact is absent.

### Fixed

- **`special.ts` `besselY1` (small-x, x < 8):** restored the correct
  Numerical-Recipes `bessy1` rational-approximation coefficients and the
  missing leading `x *` factor. Previously `Y1(5)` returned ≈ −0.377 instead of
  the correct +0.1479, which also poisoned `Y_n(5)` via the upward recurrence.
- **`special.ts` `cosIntegral` (Ci):** the convergent power series is now used
  across its reliable range (x ≤ 35) instead of handing moderate x to a
  divergent asymptotic series. Previously `Ci(10)` overflowed to ≈ 6.8e20
  instead of −0.0455; the large-x asymptotic auxiliary-function coefficients and
  `1/x²` normalization were also corrected, with smallest-term truncation.
- **`special.ts` `airyAi` / `airyBi` (negative-x oscillatory asymptotic,
  x < −4.5):** rewrote the branches to use the correct DLMF §9.7 `u_k`
  coefficients and phase structure. Previously they reused the wrong
  exponential-branch `c_k` series, e.g. `Ai(-5)` ≈ 0.138 instead of 0.3508 and
  `Bi(-5)` with the wrong sign/magnitude.

## 0.2.4

### Patch Changes

- Ship TypeScript declarations. The package now emits a `.d.ts` tree via `tsc` (the JS bundle stays on tsup); previously `--dts` was disabled and the published `types` field pointed at a non-existent file, so consumers got `any`. Fixed a TS4023 (`evaluate` inferred an un-nameable `EvaluateOptions` from `expression`) by annotating `evaluate` with `ReturnType<typeof createEvaluate>`. No runtime change (2502 tests still pass).

## 0.2.3

### Patch Changes

- Re-pin `@danielsimonjr/mathts-expression` to `0.2.2` (which now exports `createParser`) so the matched MathTS package set resolves a single `expression` version.

## 0.2.2

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.

## 0.2.1

### Patch Changes

- Fix functions WASM loader artifact filenames + path resolution.

  `functions/src/wasm/WasmLoader.ts` carried two legacy-mathjs artifacts
  of the mathjs-to-MathTS rebrand:
  - It referenced `mathjs-as.wasm` / `mathjs.wasm` instead of the actual
    artifacts `mathts-as.wasm` / `mathts.wasm`. The loader never found
    its binaries, `getModule()` returned null, and consumers
    (`functions/src/typed/{numeric,geometry,signal}.ts`) silently fell
    back to JS with no warning. Every release of mathts-functions since
    the rebrand has shipped with these three modules' WASM paths
    unreachable.
  - The Node branch used `'./lib/wasm/...'` (CWD-relative). Only worked
    when Node launched from the repo root — same pattern matrix fixed in
    the prior release.

  Now resolves through `fileURLToPath(new URL('../../../lib/wasm/...',
import.meta.url))`, mirroring matrix's loaders. The env-var check
  accepts both `MATHTS_WASM_BACKEND` (canonical) and the legacy
  `MATHJS_WASM_BACKEND` for one release. `getDefaultWasmPath` is now
  async; the two callers (`precompile`, `loadModule`) await it.

  Note: this fix alone doesn't ship WASM artifacts inside the npm
  tarball — the cross-package dist-hop issue (audit B-3) is a separate
  build-pipeline change. Once that lands, end-users of mathts-functions
  will get the WASM-accelerated paths that were wired but unreachable
  since the rebrand.

- Updated dependencies [3d218f5]
- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.1.3

## 0.2.0

### Minor Changes

- 65c12de: Fix and extend parallel execution.
  - **workerpool** — `MathWorkerPool` created its pool with `createPool(null)`, so
    workerpool loaded its generic worker instead of the MathTS kernels and every
    named-kernel dispatch threw `Unknown method`. The built `dist/worker.js` is
    now resolved and loaded, so the parallel layer runs in workers for the first
    time. Float64Array chunking is fixed (`subarray` shared the whole buffer →
    `slice`). Adds the generic `applyKernel` (unary) and `applyKernel2` (binary)
    worker kernels and a batched-FFT kernel (`fftBatchChunk` / `fftBatch`).
  - **parallel** — `ComputePool` exposes `applyKernel` / `applyKernel2` / `fftBatch`.
  - **functions** — parallel `Float64Array` overloads for all 10 distribution
    functions and all 28 special functions; `parallelFFTMagnitude` /
    `parallelFFTPower` now dispatch to worker threads; `spectrogram`, `fft2d`, and
    `parallelConv` (with `parallelXCorr` / `parallelAutoCorr`) dispatch their
    independent FFTs to the worker pool; `parallelFFT` / `parallelIFFT` run a
    genuinely parallel single transform via a four-step decomposition. Completes
    the element-wise `Float64Array` overloads across arithmetic and trigonometry,
    and adds a parallel `parallelStatProd` reduction. Adds the parallel all-pairs
    `distanceMatrix` geometry function and the WebGPU-accelerated matrix
    operations `gpuMatmul`, `gpuAdd`, `gpuTranspose`, and `gpuScale` (new async
    exports, transparent CPU fallback, f32 GPU path).

    **Breaking:** `characteristicPolynomial`, `matrixPower`, `matrixLog`,
    `polarDecomposition`, `jordanForm`, `spectrogram`, `fft2d`, `parallelIFFT`,
    and `parallelStatProd`'s `Float64Array` overload are now async — their
    O(n^3) products / FFT batches / reductions are offloaded to the worker pool.

### Patch Changes

- Updated dependencies [65c12de]
  - @danielsimonjr/mathts-parallel@0.2.0

## 0.1.3

### Patch Changes (Security — additive)

- 3ef899c: WASM modules now verify a SHA-384 manifest before instantiation.
  At load time the runtime hashes the freshly read buffer
  (`crypto.createHash('sha384')` in Node, `crypto.subtle.digest` in
  browsers) and compares against `wasm-manifest.json` written by
  `tools/generate-wasm-manifest.mjs`. A mismatch throws before any module
  is compiled, blocking silent code-injection via tampered .wasm payloads.
  Manifest defaults to soft-fail when absent for legacy compat;
  `{ required: true }` makes it fail-closed. Affected files:
  `functions/src/wasm/integrity.ts` (new), `functions/src/wasm/WasmLoader.ts`
  (Node + browser load paths). Adds
  `functions/tests/security/wasm-integrity.test.ts` (5 tests).

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

- Updated dependencies [e771b4e]
  - @danielsimonjr/mathts-core@0.1.1
  - @danielsimonjr/mathts-matrix@0.1.1
  - @danielsimonjr/mathts-parallel@0.1.1
  - @danielsimonjr/mathts-expression@0.1.1
