# @danielsimonjr/mathts-compat

## 0.7.19

### Patch Changes

- f14d001: Accept MathJS string infinity norm orders for vectors and the positive infinity norm order for matrices.
- f14d001: Expose the named MathJS documentation catalog and add help entries for fraction numerator and denominator.
- f14d001: Expose MathJS factory bundles for permutations, Catalan numbers, multinomial coefficients, Stirling numbers of the second kind, and Bell numbers.
- f14d001: Accept preferred unit lists and a display offset in the default MathJS-compatible toBest.
- f14d001: Expose selected MathJS Fourier transform, inverse Fourier transform, and matrix square-root dependency bundles.
- f14d001: Expose selected MathJS eigenvalue, norm, rotation, Schur, Sylvester, Lyapunov, matrix exponential, and Riemann zeta factory bundles. Match MathJS class factory metadata in the dependency catalog.
- f14d001: Support complex arguments and an optional logarithm base in the default MathJS-compatible log1p.
- f14d001: Support unit-valued operands in the default MathJS-compatible cube root and rounding to a target unit.
- f14d001: Expose selected MathJS gamma and factorial factory bundles with BigNumber precision and input handling.
- f14d001: Expose MathJS JSON reviver and version factory bundles. Selected instances report the installed MathTS compatibility package version.
- f14d001: Expose MathJS factory bundles for median, median absolute deviation, variance, standard deviation, quantiles, and their applicable expression transforms.
- f14d001: Expose selected MathJS correlation, extended greatest common divisor, and modular inverse factory bundles.
- f14d001: Preserve MathJS display unit prefixes on physical constants imported by name or read from a compatibility instance. Use BigNumber magnitudes when a compatibility instance is configured for BigNumber arithmetic.
- f14d001: Expose MathJS factory bundles for solving linear systems by LU factorization and for solving ordinary differential equations.
- f14d001: Resolve the compatibility package version as a symbol in expressions.
- f14d001: Expose MathJS expression simplification, symbolic equality, differentiation, and rationalization factory bundles. Selected parsers register string-to-node conversion with their own typed dispatcher.
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
- Updated dependencies [f14d001]
  - @danielsimonjr/mathts-functions@0.89.17
  - @danielsimonjr/mathts-expression@0.14.5

## 0.7.18

### Patch Changes

- 057ba46: Expose MathJS expression transform factories for map, filter, and forEach.
- 057ba46: Expose MathJS factory bundles for filter frequency response, Kullback–Leibler divergence, and integer compositions.
- 057ba46: Expose MathJS expression transform factories for min, max, sum, cumsum, mean, and mapSlices.
- 057ba46: Expose MathJS expression transform factories for or, bitOr, nullish, column, row, and concat.
- 057ba46: Expose MathJS Parser, parser, Help, and help factory bundles for selected instances.
- 057ba46: Expose MathJS factory bundles for combinations with and without replacement.
- 057ba46: Expose MathJS expression transform factories for and, bitAnd, diff, index, print, range, and subset.
- 057ba46: Expose MathJS factory bundles for bigint, boolean, and string conversions.
- 057ba46: Expose MathJS factory bundles for the Range constructor and JSON replacer.
- 057ba46: Expose MathJS factory bundles for the numerator and denominator of fractions, including nested collections.
- Updated dependencies [057ba46]
- Updated dependencies [057ba46]
- Updated dependencies [057ba46]
- Updated dependencies [057ba46]
- Updated dependencies [057ba46]
- Updated dependencies [057ba46]
- Updated dependencies [057ba46]
- Updated dependencies [057ba46]
  - @danielsimonjr/mathts-functions@0.89.16

## 0.7.17

### Patch Changes

- fa760f9: Expose selected MathJS factories for leafCount, pinv, and zpk2tf. Accept expression strings in leafCount.
- fa760f9: Expose MathJS factory bundles for compiling expressions and taking multiset unions.
- fa760f9: Expose MathJS factory bundles for unit conversion, best-unit selection, splitting measurements across units, and sparse matrix construction.
- fa760f9: Expose the MathJS divide factory bundle, including right division using the injected inverse factory.
- fa760f9: Expose MathJS factory bundles for geometric intersections and symbolic variable resolution.
- fa760f9: Expose MathJS factory bundles for calculating means and finding polynomial roots.
- Updated dependencies [fa760f9]
- Updated dependencies [fa760f9]
- Updated dependencies [fa760f9]
- Updated dependencies [fa760f9]
- Updated dependencies [fa760f9]
- Updated dependencies [fa760f9]
  - @danielsimonjr/mathts-functions@0.89.15

## 0.7.16

### Patch Changes

- 1e8bb2b: Expose 51 selected MathJS 15.2 physical constant factory bundles with the values and units supplied by MathJS.
- Updated dependencies [1e8bb2b]
  - @danielsimonjr/mathts-functions@0.89.14

## 0.7.15

### Patch Changes

- 96c3d0d: Expose selected MathJS factory bundles for matrix powers and decompositions, units, expression parsing, and evaluation. Honor the matrix factory when selected assignment nodes update arrays.
- Updated dependencies [96c3d0d]
  - @danielsimonjr/mathts-functions@0.89.13

## 0.7.14

### Patch Changes

- 22f4d3e: Expose the selected MathJS multiply factory and its dependency bundle for scalar, vector, dense, and sparse multiplication.
- Updated dependencies [22f4d3e]
  - @danielsimonjr/mathts-functions@0.89.12

## 0.7.13

### Patch Changes

- e9c3b59: Expose selected MathJS dependency bundles for minimum, maximum, cumulative sum, sum, product, count, and symmetric difference.
- Updated dependencies [e9c3b59]
  - @danielsimonjr/mathts-functions@0.89.11

## 0.7.12

### Patch Changes

- c38f2cc: Expose selected MathJS dependency bundles for QR and LUP decompositions, the sparse accumulator, and the Fibonacci heap.
- 8a05164: Expose selected MathJS dependency bundles for 13 expression node constructors.
- c38f2cc: Expose selected MathJS dependency bundles for index construction, immutable matrices, set operations, rows, and columns.
- Updated dependencies [c38f2cc]
- Updated dependencies [8a05164]
- Updated dependencies [c38f2cc]
  - @danielsimonjr/mathts-functions@0.89.10

## 0.7.11

### Patch Changes

- e649d66: Expose MathJS dependency bundles for triangular solves, range generation, distance, log1p, and Bernoulli numbers.
- cd4f430: Expose selected MathJS factory bundles for bignumber, fraction, complex, and numeric conversions.
- cd4f430: Expose more selected MathJS arithmetic and matrix factories, including scalar division, elementwise division, logarithms, and roots.
- Updated dependencies [e649d66]
- Updated dependencies [cd4f430]
- Updated dependencies [cd4f430]
  - @danielsimonjr/mathts-functions@0.89.9

## 0.7.10

### Patch Changes

- aafaf92: Expose native MathJS factory bundles for rounding, modular arithmetic, matrix construction, sorting, and set size.
- 602aec8: Expose MathJS factory bundles for Chain, chain, and ResultSet.
- Updated dependencies [aafaf92]
- Updated dependencies [602aec8]
  - @danielsimonjr/mathts-functions@0.89.8

## 0.7.9

### Patch Changes

- 9ed1bee: Expose native MathJS dependency bundles for mode and mapSlices, including empty-input errors and injectable dimension validation.
- 75fc560: Expose the MathJS number factory and dependency bundle, including signed word-size literals, radix fractions, and JSON revival.
- Updated dependencies [9ed1bee]
- Updated dependencies [75fc560]
  - @danielsimonjr/mathts-functions@0.89.7

## 0.7.8

### Patch Changes

- b6915dd: Expose more native MathJS factory bundles for bit shifts, matrix operations, comparisons, and numeric functions.
- c71620c: Expose native MathJS dependency bundles for binary, hexadecimal, and octal formatting and cube roots.
- Updated dependencies [b6915dd]
- Updated dependencies [c71620c]
  - @danielsimonjr/mathts-functions@0.89.6

## 0.7.7

### Patch Changes

- 3ae5e5d: Expose native MathJS factory bundles for matrix creation and manipulation.
- 3ae5e5d: Expose native MathJS dependency bundles for binary operations, comparisons, and numeric predicates.
- 3ae5e5d: Expose MathJS addition and subtraction factories for selected scalar and matrix instances.
- Updated dependencies [3ae5e5d]
- Updated dependencies [3ae5e5d]
- Updated dependencies [3ae5e5d]
  - @danielsimonjr/mathts-functions@0.89.5

## 0.7.6

### Patch Changes

- 59fd216: Expose selected scalar arithmetic, comparison, and numeric factories with their MathJS dependency bundles.
- 59fd216: Accept arrays of factories and bind instance create options to the original factory selection.
- 59fd216: Expose the MathJS sine factory, its dependency bundle, and the class and typed factories it uses.
- fa2f915: Expose native MathJS matrix, comparison, concatenation, and atan2 factory bundles.
- fa2f915: Expose MathJS square-root and negation factory bundles with their declared dependencies.
- fa2f915: Apply instance settings when resolving and invoking functions from selected compatibility factory bundles.
- fa2f915: Expose the MathJS mathematical constant factories and their dependency bundles, including configured precision for selected instances.
- fa2f915: Expose more MathJS collection, formatting, and random factories and their dependency bundles.
- 59fd216: Expose the MathJS trigonometric and hyperbolic factories and their minimal dependency bundles.
- Updated dependencies [59fd216]
- Updated dependencies [59fd216]
- Updated dependencies [59fd216]
- Updated dependencies [fa2f915]
- Updated dependencies [fa2f915]
- Updated dependencies [fa2f915]
- Updated dependencies [fa2f915]
- Updated dependencies [59fd216]
  - @danielsimonjr/mathts-functions@0.89.4

## 0.7.5

### Patch Changes

- 0f1826b: Accept nested expression arrays and expression matrices in compat evaluate and compile, keeping their shape and sharing the supplied scope across expressions.
- e405551: Load custom mathjs factory bundles passed to compat create, including nested bundles with dependencies.
- 158b82c: Expose MathJS constructors, type predicates, fraction helpers, and factory directly from compat.
- 158b82c: Expose a read-only MathJS-compatible global config and the random, randomInt, and pickRandom named imports.
- 0f1826b: Keep each compat instance's custom typed functions, type registrations, and conversions isolated.
- 158b82c: Expose existing MathTS mathematical functions as named imports through the MathJS compatibility package.
- 0f1826b: Provide direct mathjs-style imports for evaluate, compile, parse, Parser, parser, and chain.
- 158b82c: Match MathJS setUnion ordering in compat, including duplicate elements and matrix inputs.
- 158b82c: Expose MathJS physical constants, number predicates, and typed as named imports.
- 158b82c: Bind chain and its Chain constructor to the same instance and expose Chain as a named import.
- Updated dependencies [e405551]
- Updated dependencies [0f1826b]
- Updated dependencies [158b82c]
  - @danielsimonjr/mathts-functions@0.89.3

## 0.7.4

### Patch Changes

- 2e88a10: Match mathjs 15.2 instance constants, including configured BigNumber precision, alternate names, and physical values. Use the same resolved constants for direct calls, interpreted expressions, and compiled expressions. Emit instance configuration changes with previous, current, and changed values.
- 2e88a10: Give compat mathjs-style random, randomInt, and pickRandom streams scoped to an instance. Direct, interpreted, and compiled calls share the same streams and honor changes to randomSeed.
- Updated dependencies [2e88a10]
- Updated dependencies [2e88a10]
  - @danielsimonjr/mathts-functions@0.89.2

## 0.7.3

### Patch Changes

- 7704089: Publish the source changes that were missing from the previous npm versions so that the runtime dependencies expose the contracts used by the functions bundle. Compute determinants, means, and covariances without premature overflow. Apply instance precision to BigNumber arithmetic, simplify exact radical identities before numerical approximation, and clarify errors for untracked autodiff operands.
- Updated dependencies [7704089]
  - @danielsimonjr/mathts-core@0.30.1
  - @danielsimonjr/mathts-matrix@0.13.1
  - @danielsimonjr/mathts-functions@0.89.1

## 0.7.2

### Patch Changes

- 291a3e9: `fraction`, `number` and `transpose` are typed-functions, as in mathjs. As a callback of `map`, `forEach`, `filter`, the `map` and `forEach` methods of a Matrix and of a SparseMatrix, `mapSlices`, `chain` and `evaluate`, each one now reads the value alone. Before, a callback adapter passed the index as the second argument: `map([1, 4], fraction)` threw `Fraction denominator cannot be zero`, and `map(['1', '4'], number)` threw about a unit. The compat `fraction` is the same function, with the no-argument and `undefined` calls that give 0. A call with a type that mathjs rejects now throws a TypeError: `number(undefined)`, `number({})`, `number(complex)`, `fraction(complex)`, `fraction(1, 2, 3)`, `fraction(1, null)` and a `Date` or a typed array as the argument. `transpose()` throws a TypeError too. (Refs #1160)
- Updated dependencies [90ff360]
- Updated dependencies [576726b]
- Updated dependencies [04df2cc]
- Updated dependencies [576726b]
- Updated dependencies [884eada]
- Updated dependencies [576726b]
- Updated dependencies [576726b]
- Updated dependencies [0c124c0]
- Updated dependencies [576726b]
- Updated dependencies [67c9b6f]
- Updated dependencies [291a3e9]
- Updated dependencies [291a3e9]
- Updated dependencies [291a3e9]
- Updated dependencies [90ff360]
- Updated dependencies [576726b]
  - @danielsimonjr/mathts-functions@0.89.0
  - @danielsimonjr/mathts-parallel@0.12.2

## 0.7.1

### Patch Changes

- 33acba1: `std`, `corr`, `skewness`, `kurtosis`, `describe`, the factory 2-norm, `parallelStatStd`, `parallelStatNorm`, the pool `variance` and the statistics that use the same sum now compute the result again with an exact power-of-2 scale when a sum of squares is below 2^-800 or overflows. Before, subnormal squares lost digits: `std([1e-160, 3e-160])` had a relative error of 5.6e-6, and `std` of data of order 1e-170 was 0. `skewness` and `kurtosis` do the same when the third or fourth powers leave the range. `linregress`, `linearRegression`, `partialCorrelation`, the effect sizes, the t tests, `fTest`, `bartlettTest`, `jarqueBera`, `dagostinoTest`, `acf`, `pacf`, `ljungBox`, `distance2D`, `distance3D`, `distanceND` and `gaussianKDE` use the same core helpers. `linregress` and `linearRegression` keep a finite slope when the two scales differ by more than the double range. Core adds `SQUARES_SAFE_MIN`, `ROOT_SAFE_MIN`, `squareSumsKeepDigits`, `powerOfTwoBelow`, `powerOfTwoScaleOf`, `scaleForVariance`, `divideByScale` and `stdFromSquaredDeviations`. Compat `std` and `variance` now use the functions implementations: they honour the dimension argument, the variadic form and BigNumber data, as mathjs does. (Refs #1280)
- a5bc409: `add`, `subtract` and `mod` of two Arrays broadcast like mathjs and NumPy. The axes are right-aligned and an axis of size 1 stretches, so `add([9, 8], zeros([2, 1]))` is `[[9, 8], [9, 8]]` and `add([[1, 2], [3, 4]], [10, 20])` is `[[11, 22], [13, 24]]`. Before, the walk paired the first axes. Shapes that cannot broadcast throw `RangeError`, for example `add([[1, 2, 3]], [1, 2])`. `add(matrix([1, 2]), [[1, 2], [3, 4]])` follows from the same rule. The compat `add` and `subtract` send operands of different sizes to the same function: `create(all).add(matrix([1, 2]), matrix([[1, 2], [3, 4]]))` threw `Matrix dimensions must match` and is now `[[2, 4], [4, 6]]`. (Refs #1302)
- 789a41a: A result matrix takes its size from the operands, not from its nested data. `multiply`, `add` and `subtract` of 0 x 0 matrices keep the size `[0, 0]`, `sparse(zeros(0, 3))` keeps the size 0 x 3, and compat `matrix(x, format)` keeps the size of a native matrix with a zero dimension. `freqz` throws a `RangeError` for a coefficient matrix that is not a vector. Compat `divide` of two native `DenseMatrix` operands gives a native `DenseMatrix`. (Refs #1337)
- 33acba1: The public types of `median`, `mode` and `mad` give the number type for a `readonly number[]` argument, and `median('x')`, `median({})`, `median()`, `mad()`, `mode()` and `mode(array, 0)` are compile errors. A spread of a plain array (`median(...xs)`) no longer compiles: pass the array. `matrix()` and `sparse()` return the new public type `BridgeMatrix`, and `bignumber()` of a scalar returns `BigNumber`. So `median`, `mode`, `mad`, `mean`, `variance` and `std` of `matrix(x)` compile. The statistics functions take the new public type `MatrixValue`. Compat `matrix()` and `sparse()` return the same `BridgeMatrix`. At run time, `mode` of a Matrix inside the argument list throws a `TypeError` in place of the false NaN message. `parallelFFT`, `parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `dct`, `dst`, `hilbertTransform`, `polymul`, `newtonInterp`, `polyFit` and the other callers of the shared sample copy throw a `TypeError` for an array entry with no numeric reading (a nested array such as the column `[[1], [3], [5]]`, an object, `undefined`, a string that is no number). A BigNumber, a Fraction and a numeric string entry still convert, and `''`, `' '`, `true` and `null` read as 0, 0, 1 and 0. `parallelStatStd` and `parallelStatVariance` throw the `TypeError` of `std` for an unknown normalization string. (Refs #964, Refs #1359)
- 789a41a: `expm` of a matrix returns a matrix of the same class and storage. Before, `expm(matrix(A))` returned a native `DenseMatrix` with no `size` method, and `expm(sparse(A))` returned an Array. Now a dense matrix gives a dense matrix, a sparse matrix gives a sparse matrix of its own kind, and an Array gives an Array. A matrix with one or three dimensions now throws the square error with its real size. A matrix that is not square throws a `RangeError` at every site, as in mathjs; before, the same rule threw a plain `Error` at some sites. Each message stays the same, except `eigsh`: an empty input throws `eigsh: dense matrix input must be non-empty`, and a ragged input throws `eigsh: dense matrix input must be square`. A `catch` of `Error` still catches the error. `pinv`, `re`, `im`, `arg` and `setDistinct` of a matrix give a matrix (they gave an Array); `pinv([])` is `[]`, and a 1-D matrix gives a 1-D result. (Refs #1264)
- 8879eea: `matrix(data, format)` checks its format, as in mathjs. A format other than `'dense'`, `'default'` or `'sparse'` throws `Unknown matrix type "foo".` (a boolean is read as a string), and a format that is not a string or boolean throws a `TypeError`. `matrix(sparseMatrix, 'dense')` and `matrix(sparseMatrix, 'default')` return a dense matrix with the same entries; before, they returned the sparse matrix. `matrix(m)` of a matrix, and `matrix(data)` of an Array, give a copy, as in mathjs. (Refs #1284)
- 789a41a: `pow` of a 0 x 0 matrix returns a 0 x 0 matrix of the same kind: `pow([], 2)` is `[]`, and a Matrix gives a Matrix. Before, the call threw `TypeError`. A 0 x 3 matrix throws the square `RangeError`, and the exponent rule (a non-negative integer) holds for an empty matrix too. `pow` and `sqrtm` of a non-empty Matrix now return a Matrix, as mathjs does (a sparse matrix gives a dense matrix); an Array still gives an Array. A call of the `compat` adapter with a native `DenseMatrix` now returns a public `DenseMatrix` for a result with a zero dimension, where it returned `[]` or threw: `sqrtm`, `sylvester`, `kron`, `inv`, `map`, `larger`, `equal` and the factors of `qr`. (Refs #1278)
- 8879eea: `zeros` and `ones` take an Array size, three or more sizes and a format, as in mathjs. `zeros([2, 3, 2])` is a 2 x 3 x 2 Array, `zeros(2, 3, 2)` is a matrix of size [2, 3, 2], `zeros([])` is `[]` and `zeros(2, 2, 'sparse')` is a sparse matrix. `zeros(n)` is still a `number[]` and `zeros(r, c)` is still a native DenseMatrix. (Refs #1288)
- 8879eea: `matrix(undefined)` throws a `TypeError`, as in mathjs, and `matrix(undefined, 'sparse')` does too. Before, an explicit `undefined` data argument gave an empty matrix. A call with no argument, `matrix()`, is still an empty dense matrix, and `matrix(data, undefined)` is still read as no format. (Refs #1284)
- a5bc409: `multiply` takes a 1-D operand, as mathjs does. A vector times a vector is the scalar product (`multiply([1, 2], [3, 4])` is 11, and it conjugates a Complex entry of the left vector, as `dot` does). A matrix times a vector and a vector times a matrix give a vector. A length mismatch throws `RangeError` with the mathjs text, and an operand of 3 or more dimensions throws `Error` with the mathjs text. `evaluate('[1,2]*[3,4]')` gives 11. The compat instance sends a 1-D operand to the same function: `create(all).multiply([[1, 2], [3, 4]], [1, 1])` threw `TypeError` and is now `[3, 7]`. A compat result of a 1-D matrix now has the mathjs shape, not a 1 x n row: `subtract(matrix([3, 4]), 1)` was `[[2, 3]]` and is `[2, 3]`, `multiply(matrix([1, 3, 4]), matrix([[-1], [0], [-2]]))` was `[[-9]]` and is `[-9]`, and `multiply(matrix([-3, 4, 4]), matrix([0, -4, 0]))` threw and is `-16`. A product with an empty axis follows mathjs: `multiply([[1], [2]], [[]])` threw `TypeError` and is `[[], []]`, and `multiply([[], []], [])` was `[0, 0]` and throws `TypeError`. (Refs #1007)
- Updated dependencies [8879eea]
- Updated dependencies [9cda207]
- Updated dependencies [a7c47d4]
- Updated dependencies [44d5dd0]
- Updated dependencies [b866b34]
- Updated dependencies [a5bc409]
- Updated dependencies [3b2ffe6]
- Updated dependencies [9cda207]
- Updated dependencies [9cda207]
- Updated dependencies [ba1fdea]
- Updated dependencies [2df36db]
- Updated dependencies [33acba1]
- Updated dependencies [c12439a]
- Updated dependencies [a5bc409]
- Updated dependencies [c12439a]
- Updated dependencies [789a41a]
- Updated dependencies [f4df499]
- Updated dependencies [2df36db]
- Updated dependencies [aaa52d3]
- Updated dependencies [8879eea]
- Updated dependencies [3b2ffe6]
- Updated dependencies [33acba1]
- Updated dependencies [f4df499]
- Updated dependencies [b866b34]
- Updated dependencies [6c87a8b]
- Updated dependencies [44d5dd0]
- Updated dependencies [789a41a]
- Updated dependencies [44d5dd0]
- Updated dependencies [a50902c]
- Updated dependencies [789a41a]
- Updated dependencies [a50902c]
- Updated dependencies [a50902c]
- Updated dependencies [4966096]
- Updated dependencies [44d5dd0]
- Updated dependencies [8879eea]
- Updated dependencies [89f1ec7]
- Updated dependencies [c12439a]
- Updated dependencies [789a41a]
- Updated dependencies [aaa52d3]
- Updated dependencies [a7c47d4]
- Updated dependencies [3b2ffe6]
- Updated dependencies [a50902c]
- Updated dependencies [3b2ffe6]
- Updated dependencies [a50902c]
- Updated dependencies [3b2ffe6]
- Updated dependencies [8879eea]
- Updated dependencies [aaa52d3]
- Updated dependencies [4966096]
- Updated dependencies [44d5dd0]
- Updated dependencies [6c87a8b]
- Updated dependencies [a50902c]
- Updated dependencies [a50902c]
- Updated dependencies [a5bc409]
- Updated dependencies [9cda207]
- Updated dependencies [8879eea]
- Updated dependencies [a5bc409]
- Updated dependencies [2df36db]
- Updated dependencies [c12439a]
- Updated dependencies [c12439a]
- Updated dependencies [6c87a8b]
- Updated dependencies [44d5dd0]
- Updated dependencies [8879eea]
- Updated dependencies [a5bc409]
- Updated dependencies [ba1fdea]
- Updated dependencies [a5bc409]
- Updated dependencies [b866b34]
- Updated dependencies [6c87a8b]
- Updated dependencies [aaa52d3]
- Updated dependencies [89f1ec7]
- Updated dependencies [b866b34]
- Updated dependencies [89f1ec7]
- Updated dependencies [33acba1]
- Updated dependencies [c12439a]
- Updated dependencies [8879eea]
- Updated dependencies [33acba1]
- Updated dependencies [8879eea]
- Updated dependencies [89f1ec7]
- Updated dependencies [44d5dd0]
- Updated dependencies [a7c47d4]
- Updated dependencies [f4df499]
- Updated dependencies [3b2ffe6]
- Updated dependencies [2df36db]
- Updated dependencies [6c87a8b]
- Updated dependencies [c12439a]
- Updated dependencies [44d5dd0]
- Updated dependencies [2df36db]
- Updated dependencies [aaa52d3]
- Updated dependencies [a7c47d4]
- Updated dependencies [ba1fdea]
- Updated dependencies [4966096]
- Updated dependencies [33acba1]
- Updated dependencies [b866b34]
  - @danielsimonjr/mathts-functions@0.88.0
  - @danielsimonjr/mathts-core@0.30.0
  - @danielsimonjr/mathts-matrix@0.13.0
  - @danielsimonjr/mathts-parallel@0.12.1

## 0.7.0

### Minor Changes

- 5b284e3: A compat instance from `create(all)` no longer exposes the internal names of the functions namespace (#1216). The 80 names are the 64 `factory_*` functions and 16 ALL_CAPS tuning constants (`ARRAY_WORKER_THRESHOLD`, `CAS_BATCH_THRESHOLD`, `CENTRALITY_WORKER_THRESHOLD`, `DEFAULT_MUTATION_WEIGHTS`, `DIST_WORKER_THRESHOLD`, `EVALUATE_SCOPE_OMIT`, `GAUSS_WORKER_THRESHOLD`, `GL4_A`, `GL4_B`, `GL4_C`, `GPU_ELEMENTWISE_OPS`, `GPU_MIN_ELEMENTS`, `GPU_REDUCE_OPS`, `MASS_PROPERTY_SHAPES`, `MUTATE_CONSTANT_NEGATE_PROBABILITY`, `WASM_INTERP_THRESHOLD`). They are gone from `in`, `for...in`, property reads, the `MathInstance` type, `math.chain`, and `math.evaluate` / `math.compile` / `math.parser()`. They stay exported from `@danielsimonjr/mathts-functions`. The list is `compat/src/internal-names.generated.ts`, written by `compat/scripts/gen-internal-names.mjs`; its `--check` in CI fails when the functions namespace adds an internal name that the list does not hold.
  
  Measured on `create(all)`:
  
  |                                            | 0.6.0 (published) | main before this change | this change |
  | ------------------------------------------ | ----------------- | ----------------------- | ----------- |
  | `for...in` names                           | 1406              | 1406                    | 1326        |
  | `Object.keys` names                        | 1406              | 317                     | 317         |
  | the 80 names reachable through `in`        | 80                | 80                      | 0           |
  | the 80 names that `math.evaluate` resolves | 72                | 72                      | 0           |
  | the 80 names that `math.parser()` resolves | 72                | 72                      | 0           |
  
  `EARTH_RADIUS_KM` stays: it is the default radius of `haversine`, a physical constant. The mathjs constants `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2` and `SQRT1_2` stay. A factory object that you pass to `create` keeps all its names: only a name whose value is the value of the functions namespace is hidden, so `create({ MY_CONST: 5, R: 8.31 })`, `create({ ...all, X1: 7 })` and `create({ ...all, GL4_A: 99 })` keep `MY_CONST`, `R`, `X1` and `GL4_A` as in 0.6.0 (#1250). `math.import({ GL4_A: 5 })` now makes `GL4_A` resolve to 5 in `math.evaluate`; in 0.6.0 it threw `Cannot import "GL4_A": already exists`. The expression scope does not read instance properties, as in 0.6.0: `create({ ...all, GL4_A: 99 }).evaluate('GL4_A')` gave the internal table and now throws `Undefined symbol`.
  
  `math.parser()` of a `create(all)` instance now evaluates with the evaluator of its instance. In 0.6.0 it used the module scope of the functions package, so it resolved the internal names, did not resolve a name from `math.import`, and ignored the instance config (after `math.config({ number: 'BigNumber' })`, `math.parser().evaluate('1/3')` returned a number and now returns a BigNumber). A `parser` that you pass to `create` in your own factory object is not changed.
  
  This change is breaking because 0.6.0 exposes all of these names. No non-breaking path is worth it: the names are tuning constants and internal factories, not mathjs API.
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

### Patch Changes

- b1977e7: Brand-based type tests accept a value of a second copy of core (#1033). The typed `sum` keeps Complex, BigNumber and Fraction values exact, sums nested arrays and matrices in the pairwise kernel, and sums along a dimension (#1039). The typed `min` and `max`, and `mean`, `variance` and `std`, keep exact types; complex variance uses the conjugate. A 1-D sparse matrix is a column vector. The typed `dot` keeps exact types and conjugates its first argument. A 1-D Matrix keeps its shape when it converts to an Array. New core exports: `pairwiseSumChecked`, `sumSquaredDeviationsChecked` and `pairwiseDotChecked`.
- 8edf4e2: `bignumber` converts an Array or a Matrix element by element, as mathjs does. Before, `bignumber([1, 2])` gave -Infinity, and null, a boolean, a bigint and a Fraction gave ±Infinity. A scalar call keeps the `BigNumber` return type. `bignumber()` still returns 0.
- 680d90a: `eigs` of a matrix with Complex entries keeps the imaginary part of each entry (#1220). The factory scope `complex(x)` built `new Complex(x, undefined)`, so a Complex argument became a Complex that held the entry in `re`, and `abs` read it as its modulus. `complex()` now follows mathjs: no argument or `null` gives 0, it clones a Complex, and it accepts a number, BigNumber, Fraction, bigint, boolean, string, `{re, im}`, `{r, phi}`, `{abs, arg}` and an Array. Before: `eigs([[complex(2,1)]])` gave 2.236 (now 2+i); `eigs([[complex(0,1),0],[0,1]])` gave 1, 1 (now i, 1); `diag(2+i, 5+i)` gave 2.236, 5.099 (now 2+i, 5+i); `[[2+i,1],[0,3]]` gave 2.236, 3 (now 2+i, 3); `[[2,1-i],[1+i,3]]` gave 0.9999999999999991, 4.000000000000001 (now 1.0000000000000002, 4, within 1e-8 of 1 and 4, as mathjs 15.2.0). The public `complex(complexValue)`, `complex({re, im})` and `complex('2+i')` returned a Complex that held the argument in `re`; they now return the Complex. `complex(Matrix)` maps each entry and returns a Matrix. A part of `(re, im)` that is not a number, BigNumber, Fraction, bigint, boolean or numeric string throws a TypeError, as do a single argument of another type (`complex(undefined)`) and a third argument, as in mathjs. `complex(1, undefined)` returned 1 and now throws. The parts of an object convert to numbers. The call shape `(value, index, collection)` converts the value, so `[1, 2].map(complex)` gives 1 and 2. The compat `complex` shim uses the functions `complex` for every input except no argument and a single Complex, which it still returns unchanged; `complex(z, 5)` returned `z` and now throws a TypeError, and a third argument throws.
- d0a18ca: A matrix of a second copy of the matrix package works in every public function (#1041). New export: isNativeMatrix.
- 0ebdaa3: `math.import(otherInstance)` on a compat instance throws one `TypeError` ("import of a math instance is not supported; import its functions (an object of functions or factories) instead"), also when the instance sits inside an array or object, when it comes from another bundled copy of compat (a `Symbol.for('mathts.compat.instance')` brand on the instance's own prototype level marks it), and with `override` or `silent` (Refs #1222). mathjs 15.2.0 throws for every such call too, with messages that depend on the instance content. Before, on main: `create({}).import(create(all))` threw `Signature "Array" is defined twice`; `create(all).import(inst, {override:true})` threw `Factory, Object, or Array expected`; `{silent:true}` threw `Signature "Array" is defined twice`; `create(all).import(create(all))` threw `Cannot import "Chain": already exists`. `import({ T: [1, 2, 3] })` keeps the mathjs message `Factory, Object, or Array expected` (same in mathjs 15.2.0; with `silent` it is skipped). The check reads data properties only, so a getter in the imported object runs once, as before. Plain objects, arrays and factories import as before.
- 852f6e2: Four small numeric defects.
  
  - A number as the data argument of a stable reduction in core (`pairwiseSum`, `pairwiseDot`, `sumSquaredDeviations`, their `Checked` variants, `neumaierSum`, `neumaierCumsum`, `norm2`, `scaledDistance`, `extrema`) now throws a `TypeError` that names the function. A string, and an object whose `length` is not a non-negative integer, throw the same error. Before, `pairwiseSum(0)` and `sumSquaredDeviations(0)` threw `RangeError: Maximum call stack size exceeded`, and `norm2(5)` gave `0` (#1011).
  - `numberVector` rejects a value that is not an array, typed array, array-like or iterable object. The statistics, signal and linear-algebra functions that take a number vector read a number as `[]`. Before, `zscore(5)` was `[]`, `skewness(5)` was `NaN`, `trapz(5)` was `0` and `signTest(5)` was `{ statistic: 0, pValue: 1 }`. Now each throws a `TypeError` that names the function, for example `zscore: expects an array of numbers, got a number` (#1083).
  - The SVD gave wrong singular values for a matrix whose leading column entry is negative with zeros below it, because the Householder helper returned the non-orthogonal `beta = -2` for that column. Before, `norm([[-3,0],[0,1]], 2)` was `9`, and the singular values were `[9, 1]`. Now the norm is `3` and the singular values are `[3, 1]` (NumPy and mathjs). `pinv`, `lowRankApprox` and `svd` rebuild such a matrix correctly. The default `norm` of a matrix was already the spectral norm (`p = 2`), as in mathjs. A new test pins that default, and the fix above corrects its value for such a matrix: `norm([[-3,0],[0,1]])` was `9` and is `3`. `norm([[1,0],[0,2]])` is `2` (#1082, #995).
  - In `parallel`, `parallelMean`, `parallelVariance` and `parallelStd` on the sequential path pass the data to `pairwiseSum` before they read its length. A number now throws the `TypeError` of core. Before, `parallelMean(1)` gave `0` (#1011).
- Updated dependencies [a0945d9]
- Updated dependencies [f97d51c]
- Updated dependencies [354d57b]
- Updated dependencies [c0222fa]
- Updated dependencies [5b09394]
- Updated dependencies [6b4e603]
- Updated dependencies [c5ea0d7]
- Updated dependencies [fe2cf32]
- Updated dependencies [f1a4b33]
- Updated dependencies [b1977e7]
- Updated dependencies [98a54f8]
- Updated dependencies [e233385]
- Updated dependencies [db4818f]
- Updated dependencies [03b5d7a]
- Updated dependencies [1dec729]
- Updated dependencies [d297c16]
- Updated dependencies [ab37729]
- Updated dependencies [52f96d8]
- Updated dependencies [fbc5277]
- Updated dependencies [f88c4bc]
- Updated dependencies [4c361f5]
- Updated dependencies [3f8840c]
- Updated dependencies [4304ad1]
- Updated dependencies [e6c3657]
- Updated dependencies [f0d9581]
- Updated dependencies [d9f3a33]
- Updated dependencies [cb23b66]
- Updated dependencies [0c85f33]
- Updated dependencies [01765bf]
- Updated dependencies [90a75f9]
- Updated dependencies [00c530e]
- Updated dependencies [0c85f33]
- Updated dependencies [98a54f8]
- Updated dependencies [1f8ff61]
- Updated dependencies [9f8cbaf]
- Updated dependencies [5b284e3]
- Updated dependencies [d8b3c68]
- Updated dependencies [24e06d4]
- Updated dependencies [f7a4aa7]
- Updated dependencies [c4ddb8c]
- Updated dependencies [b473e94]
- Updated dependencies [1629b29]
- Updated dependencies [64c9721]
- Updated dependencies [680d90a]
- Updated dependencies [0e2cfea]
- Updated dependencies [67b7cbb]
- Updated dependencies [2771df1]
- Updated dependencies [7975f0b]
- Updated dependencies [b2a29c7]
- Updated dependencies [d0a18ca]
- Updated dependencies [00d8732]
- Updated dependencies [a41228f]
- Updated dependencies [852f6e2]
- Updated dependencies [4312c30]
- Updated dependencies [e08d7df]
- Updated dependencies [9a720bf]
- Updated dependencies [56e8b0f]
- Updated dependencies [1906ed4]
- Updated dependencies [ba3a7bb]
- Updated dependencies [a5a8eff]
- Updated dependencies [3e089aa]
- Updated dependencies [d21f9cc]
- Updated dependencies [3eadf13]
- Updated dependencies [8e50670]
- Updated dependencies [4467c8a]
- Updated dependencies [5ba5401]
- Updated dependencies [dd3cb3b]
- Updated dependencies [aa18779]
- Updated dependencies [a593d34]
- Updated dependencies [3929108]
- Updated dependencies [b799410]
- Updated dependencies [d05f7f4]
- Updated dependencies [4cb2099]
- Updated dependencies [64e1e93]
- Updated dependencies [404e8a4]
- Updated dependencies [073ec8b]
- Updated dependencies [2165c36]
- Updated dependencies [bf0c777]
- Updated dependencies [29cc252]
- Updated dependencies [0c767ba]
- Updated dependencies [6bc82a2]
- Updated dependencies [db3f34f]
- Updated dependencies [d2b506e]
  - @danielsimonjr/mathts-functions@0.87.0
  - @danielsimonjr/mathts-matrix@0.12.0
  - @danielsimonjr/mathts-core@0.29.0
  - @danielsimonjr/mathts-parallel@0.12.0

## 0.6.0

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

- aa76758: `evaluate('0.75 inch')` and `unit(0.75, 'inch')` store one exact value, and `60 mile/hour` agrees on both paths (#955). The `sin(200 grad)` result moves to the exact value, which is closer to sin(π) = 0.
- 69f09cc: Public factories resolve their own default dependencies. `createParse()` and `createEvaluate()` run with no argument (#883, #924). `createParse(create(all))` builds the AST node constructors on the caller's math scope (#924). The string-to-Node converter on the shared typed instance belongs to `functions`: `createParse` registers none, so `parse` works in every load order (#937). `simplify` tests nodes by their structure, so a node from another parse simplifies like an own node (#937). Caller-supplied dependencies always win. The nodes of `createParse(create(all))` hide the same denylisted names as `math.evaluate` (`import`, `createUnit`, `parse`, ...), and parse reads a config accessor such as compat's `math.config` on each call, so `number: 'BigNumber'` holds. `create(all).typed` has every member of `mathTyped` (`addConversion`, `find`, ...).
- Updated dependencies [59581d0]
- Updated dependencies [a66847e]
- Updated dependencies [9f2eefa]
- Updated dependencies [3e0fb02]
- Updated dependencies [e6a651b]
- Updated dependencies [9188123]
- Updated dependencies [e422aa3]
- Updated dependencies [9f3f5d6]
- Updated dependencies [2635bbb]
- Updated dependencies [2635bbb]
- Updated dependencies [aa76758]
- Updated dependencies [531b343]
- Updated dependencies [9188123]
- Updated dependencies [efa8b4f]
- Updated dependencies [69f09cc]
- Updated dependencies [ece9539]
- Updated dependencies [a1e3395]
- Updated dependencies [799b0fe]
- Updated dependencies [cee43ac]
- Updated dependencies [f89e84d]
- Updated dependencies [2635bbb]
- Updated dependencies [9188123]
- Updated dependencies [203ff66]
- Updated dependencies [b5e7dd8]
- Updated dependencies [b95de8a]
- Updated dependencies [9188123]
  - @danielsimonjr/mathts-functions@0.86.0
  - @danielsimonjr/mathts-matrix@0.11.0
  - @danielsimonjr/mathts-parallel@0.11.0
  - @danielsimonjr/mathts-core@0.28.0

## 0.5.0

### Minor Changes

- 0badf5b: Add mathjs instance methods (`import`, `typed`, `compile`), matrix `subset` via factory bridge, JSON reviver for Unit/BigNumber, and honest migration guide gap table (dogfood G16).
- 39e08ef: Real scalar `log`, `pow`, `nthRoot`, `acosh`, `atanh`, `asin`, and `acos` now match mathjs complex promotion when `predictable` is false. Previously these returned `NaN` for many out-of-domain reals. `predictable: true` preserves real-only `Math.*` results. Compat inverse-trig shims delegate to functions instead of calling `Math.asin` directly.

### Patch Changes

- 17f64da: Fraction `toString` uses decimal form when the denominator is a power of ten (`0.1`), and `toJSON` emits numeric `n` and `d` when they are safe integers. `size` returns a Matrix when `config.matrix` is `Matrix`, including for native dense matrices, and that matrix stringifies as `[2, 3]`. `createUnit` replaces an existing unit only when `{ override: true }` is passed. Unit conversions keep exact rational scales, so `1 L` is `1000 mL`.
- b5f036d: Publish public call overloads generated from the live typed-function signatures (add, abs, sqrt, exp, log, trig, mean, variance, std, det, evaluate), keep them in sync with a failing check, fix `Unit` as a type via interface merge, and stop referencing `@webgpu/types` so consumers resolve WebGPU names from the TypeScript DOM lib.
- 43e2715: G26 dogfood: faster number sort/median, blocked GEMM, packed `lusolve`, compat scalar fast path, wasm sin policy band, SVD README note.
- a07bf29: Packaging P2 (dogfood G29): ship LICENSE in tarballs, homepage/bugs links, `exports['./package.json']`, honest `sideEffects`, JS source maps from tsdown, and workerpool types that typecheck without `@types/node` (via updated `@danielsimonjr/workerpool` patch).
- Updated dependencies [ef236dc]
- Updated dependencies [a85e335]
- Updated dependencies [adcebad]
- Updated dependencies [e4900c1]
- Updated dependencies [17f64da]
- Updated dependencies [e47134f]
- Updated dependencies [0421fec]
- Updated dependencies [8d727a1]
- Updated dependencies [b5f036d]
- Updated dependencies [e817055]
- Updated dependencies [43e2715]
- Updated dependencies [d3313ec]
- Updated dependencies [6c0194b]
- Updated dependencies [0badf5b]
- Updated dependencies [e51c0d5]
- Updated dependencies [7247de3]
- Updated dependencies [25f7ffa]
- Updated dependencies [e7939a7]
- Updated dependencies [5e692c5]
- Updated dependencies [72df4ec]
- Updated dependencies [c4daa21]
- Updated dependencies [a07bf29]
- Updated dependencies [93c6e56]
- Updated dependencies [064c834]
- Updated dependencies [39e08ef]
- Updated dependencies [ca97716]
- Updated dependencies [5a0b2e1]
  - @danielsimonjr/mathts-core@0.27.0
  - @danielsimonjr/mathts-functions@0.85.0
  - @danielsimonjr/mathts-matrix@0.10.1
  - @danielsimonjr/mathts-parallel@0.10.1

## 0.4.52

### Patch Changes

- Updated dependencies [dca8981]
  - @danielsimonjr/mathts-functions@0.84.0

## 0.4.51

### Patch Changes

- Updated dependencies [52e586e]
- Updated dependencies [2f73d66]
- Updated dependencies [ff20f7c]
- Updated dependencies [be1a7de]
  - @danielsimonjr/mathts-functions@0.83.0
  - @danielsimonjr/mathts-core@0.26.0
  - @danielsimonjr/mathts-parallel@0.10.0
  - @danielsimonjr/mathts-matrix@0.10.0

## 0.4.50

### Patch Changes

- Updated dependencies [7dbceb5]
  - @danielsimonjr/mathts-functions@0.82.0

## 0.4.49

### Patch Changes

- Updated dependencies [47dac0f]
- Updated dependencies [790360f]
  - @danielsimonjr/mathts-functions@0.81.0

## 0.4.48

### Patch Changes

- 2b8dc33: Add or correct the doc comments of exported symbols, so the published declarations describe them. `create` in compat now carries its own doc comment. The change is to comments only: the emitted JavaScript is unchanged.
- Updated dependencies [2b8dc33]
  - @danielsimonjr/mathts-functions@0.80.1
  - @danielsimonjr/mathts-matrix@0.9.6

## 0.4.47

### Patch Changes

- Updated dependencies [685a2b4]
  - @danielsimonjr/mathts-functions@0.80.0

## 0.4.46

### Patch Changes

- Updated dependencies [2c631ff]
- Updated dependencies [2c631ff]
- Updated dependencies [2c631ff]
  - @danielsimonjr/mathts-functions@0.79.0
  - @danielsimonjr/mathts-parallel@0.9.0
  - @danielsimonjr/mathts-matrix@0.9.5

## 0.4.45

### Patch Changes

- Updated dependencies [e898069]
  - @danielsimonjr/mathts-functions@0.78.0

## 0.4.44

### Patch Changes

- Updated dependencies [42f3c97]
  - @danielsimonjr/mathts-core@0.25.0
  - @danielsimonjr/mathts-functions@0.77.3
  - @danielsimonjr/mathts-matrix@0.9.4
  - @danielsimonjr/mathts-parallel@0.8.4

## 0.4.43

### Patch Changes

- Updated dependencies [e7a003e]
  - @danielsimonjr/mathts-core@0.24.0
  - @danielsimonjr/mathts-functions@0.77.2
  - @danielsimonjr/mathts-matrix@0.9.3
  - @danielsimonjr/mathts-parallel@0.8.3

## 0.4.42

### Patch Changes

- Updated dependencies [3628d5a]
  - @danielsimonjr/mathts-core@0.23.0
  - @danielsimonjr/mathts-functions@0.77.1
  - @danielsimonjr/mathts-matrix@0.9.2
  - @danielsimonjr/mathts-parallel@0.8.2

## 0.4.41

### Patch Changes

- Updated dependencies [22cb17e]
  - @danielsimonjr/mathts-functions@0.77.0

## 0.4.40

### Patch Changes

- Updated dependencies [5fa92f7]
  - @danielsimonjr/mathts-functions@0.76.0

## 0.4.39

### Patch Changes

- Updated dependencies [c491a7e]
- Updated dependencies [c4ba088]
  - @danielsimonjr/mathts-functions@0.75.0

## 0.4.38

### Patch Changes

- Updated dependencies [05ef781]
- Updated dependencies [3e0e278]
- Updated dependencies [ed1ab85]
  - @danielsimonjr/mathts-functions@0.74.0

## 0.4.37

### Patch Changes

- Updated dependencies [09b4dde]
- Updated dependencies [ac4212b]
- Updated dependencies [6e3a978]
- Updated dependencies [2a6c91d]
- Updated dependencies [2979fc5]
- Updated dependencies [e53b514]
- Updated dependencies [0de3d7a]
- Updated dependencies [c042500]
- Updated dependencies [2fd73e8]
  - @danielsimonjr/mathts-core@0.22.0
  - @danielsimonjr/mathts-functions@0.73.0
  - @danielsimonjr/mathts-matrix@0.9.1
  - @danielsimonjr/mathts-parallel@0.8.1

## 0.4.36

### Patch Changes

- Updated dependencies [8a731dc]
- Updated dependencies [b8d55ee]
- Updated dependencies [b8d55ee]
- Updated dependencies [cb18d71]
- Updated dependencies [67e132f]
- Updated dependencies [1de5cfb]
- Updated dependencies [4245556]
- Updated dependencies [80433ef]
- Updated dependencies [d296f2b]
- Updated dependencies [9f8c4e7]
- Updated dependencies [f312049]
- Updated dependencies [ccb51a6]
- Updated dependencies [b8d55ee]
- Updated dependencies [b8d55ee]
- Updated dependencies [fa0d39c]
- Updated dependencies [b8d55ee]
- Updated dependencies [b8d55ee]
- Updated dependencies [3cb9f92]
  - @danielsimonjr/mathts-functions@0.72.0

## 0.4.35

### Patch Changes

- 78f8a1c: `create()` wraps each function with the instance config on first access instead of wrapping all of them up front. Wrappers are memoized (`math.add === math.add`), `Object.keys(math)` is unchanged, and a frozen instance keeps working (the wrapper is served from a closure when the property cannot be redefined).
- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
  - @danielsimonjr/mathts-functions@0.71.0
  - @danielsimonjr/mathts-core@0.21.1
  - @danielsimonjr/mathts-matrix@0.9.0
  - @danielsimonjr/mathts-parallel@0.8.0

## 0.4.34

### Patch Changes

- Updated dependencies [3652c57]
  - @danielsimonjr/mathts-core@0.21.0
  - @danielsimonjr/mathts-functions@0.70.1
  - @danielsimonjr/mathts-matrix@0.8.1
  - @danielsimonjr/mathts-parallel@0.7.1

## 0.4.33

### Patch Changes

- 18f655b: Isolate compat `create(all, config)` from the process-wide functions config via a synchronous `runWithConfig` overlay and a config proxy on the activated factory graph. Fixes audit I-9 (#425).
- Updated dependencies [b1da434]
- Updated dependencies [45d691e]
- Updated dependencies [fa4e463]
- Updated dependencies [c5e752a]
- Updated dependencies [cbabf22]
- Updated dependencies [c7ef24d]
- Updated dependencies [5ec27a9]
- Updated dependencies [8ed70e9]
- Updated dependencies [8b5cac4]
- Updated dependencies [71f8c3c]
- Updated dependencies [c467f72]
- Updated dependencies [2761c87]
- Updated dependencies [1f0c509]
- Updated dependencies [0b085aa]
- Updated dependencies [1203b0f]
- Updated dependencies [ab33deb]
- Updated dependencies [e2be2c7]
- Updated dependencies [156e4ea]
- Updated dependencies [4f8bceb]
- Updated dependencies [a24444b]
- Updated dependencies [9f5a065]
- Updated dependencies [83d8074]
- Updated dependencies [c987ee5]
- Updated dependencies [ec7dcdb]
- Updated dependencies [d7daec0]
- Updated dependencies [7e71f31]
- Updated dependencies [e59fe83]
- Updated dependencies [c4f28d5]
- Updated dependencies [234726f]
- Updated dependencies [a01adf3]
- Updated dependencies [e591145]
- Updated dependencies [3f2d4e5]
- Updated dependencies [af7733a]
- Updated dependencies [19c4ba7]
- Updated dependencies [bcfcff4]
- Updated dependencies [3b240fb]
- Updated dependencies [11c4559]
- Updated dependencies [58fdd7a]
- Updated dependencies [914b9b1]
- Updated dependencies [8e16768]
- Updated dependencies [61d46ad]
- Updated dependencies [9dc97c5]
- Updated dependencies [1806a0a]
- Updated dependencies [37c0fd4]
- Updated dependencies [a6cf17a]
- Updated dependencies [55f6b3a]
- Updated dependencies [d8b1733]
- Updated dependencies [6e7532e]
- Updated dependencies [2fd47ee]
- Updated dependencies [c45524e]
- Updated dependencies [81b76ea]
- Updated dependencies [3400f59]
- Updated dependencies [bf374b0]
- Updated dependencies [0400aa1]
- Updated dependencies [18f655b]
- Updated dependencies [66d5896]
- Updated dependencies [ef55d67]
- Updated dependencies [8b0192c]
- Updated dependencies [5b9bf24]
- Updated dependencies [d305864]
- Updated dependencies [fbd543e]
- Updated dependencies [5dfc421]
- Updated dependencies [936f37e]
- Updated dependencies [e6fd1c2]
- Updated dependencies [f5ffe00]
- Updated dependencies [9ee55f8]
- Updated dependencies [9009676]
- Updated dependencies [d18eed3]
- Updated dependencies [bc74de0]
- Updated dependencies [0c02ffe]
- Updated dependencies [b1bdef8]
- Updated dependencies [468a9d1]
- Updated dependencies [b2a24a0]
- Updated dependencies [1f52df2]
- Updated dependencies [adfa43f]
- Updated dependencies [b802c14]
- Updated dependencies [5b79083]
- Updated dependencies [0902acd]
- Updated dependencies [2fd47ee]
- Updated dependencies [35ef447]
- Updated dependencies [55f6b3a]
- Updated dependencies [01e3d57]
- Updated dependencies [67406a8]
- Updated dependencies [974167d]
- Updated dependencies [5179cec]
- Updated dependencies [fc6c32b]
- Updated dependencies [2b8c5b9]
- Updated dependencies [b24e3ec]
- Updated dependencies [654984e]
- Updated dependencies [f915105]
- Updated dependencies [b540dfd]
- Updated dependencies [58a5ec7]
- Updated dependencies [760114e]
  - @danielsimonjr/mathts-functions@0.70.0
  - @danielsimonjr/mathts-matrix@0.8.0
  - @danielsimonjr/mathts-parallel@0.7.0
  - @danielsimonjr/mathts-core@0.20.0

## 0.4.32

### Patch Changes

- Updated dependencies [61426de]
  - @danielsimonjr/mathts-core@0.19.0
  - @danielsimonjr/mathts-functions@0.69.1
  - @danielsimonjr/mathts-matrix@0.7.9
  - @danielsimonjr/mathts-parallel@0.6.11

## 0.4.31

### Patch Changes

- Updated dependencies [02984be]
  - @danielsimonjr/mathts-functions@0.69.0

## 0.4.30

### Patch Changes

- Updated dependencies [15adc89]
  - @danielsimonjr/mathts-core@0.18.0
  - @danielsimonjr/mathts-functions@0.68.2
  - @danielsimonjr/mathts-matrix@0.7.8
  - @danielsimonjr/mathts-parallel@0.6.10

## 0.4.29

### Patch Changes

- Updated dependencies [f31f5ee]
  - @danielsimonjr/mathts-core@0.17.0
  - @danielsimonjr/mathts-functions@0.68.1
  - @danielsimonjr/mathts-matrix@0.7.7
  - @danielsimonjr/mathts-parallel@0.6.9

## 0.4.28

### Patch Changes

- Updated dependencies [75416dc]
  - @danielsimonjr/mathts-functions@0.68.0

## 0.4.27

### Patch Changes

- Updated dependencies [c9229ac]
  - @danielsimonjr/mathts-functions@0.67.0

## 0.4.26

### Patch Changes

- Updated dependencies [4f6365f]
- Updated dependencies [5b7ca6d]
- Updated dependencies [dad40d9]
- Updated dependencies [07fd902]
- Updated dependencies [8b87618]
  - @danielsimonjr/mathts-functions@0.66.0
  - @danielsimonjr/mathts-core@0.16.0
  - @danielsimonjr/mathts-matrix@0.7.6
  - @danielsimonjr/mathts-parallel@0.6.8

## 0.4.25

### Patch Changes

- 8b0f960: Two type fixes, with no runtime change.
  
  - **`chain()` now type-checks.** `chain(3).add(4).multiply(2).done()` failed to compile: the `Chain` index signature returned `Chain | unknown`, which is `unknown`. `Chain` is now `ChainMethods & ChainUnwrap`, so every function name returns the next `Chain` and `done()`/`valueOf()` still return `unknown`.
  - **`MathJSConfig` declares every key `config()` returns.** The returned object is the merged functions runtime config, but the type listed only five keys, so reading `relTol`, `absTol`, `numberFallback`, `predictable` or `legacySubset` did not compile. `number` also accepts `'bigint'`, which the runtime config supports.
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
  - @danielsimonjr/mathts-matrix@0.7.5
  - @danielsimonjr/mathts-functions@0.65.0
  - @danielsimonjr/mathts-core@0.15.5
  - @danielsimonjr/mathts-parallel@0.6.7

## 0.4.24

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
- Updated dependencies [a13ce7e]
  - @danielsimonjr/mathts-core@0.15.4
  - @danielsimonjr/mathts-functions@0.64.3
  - @danielsimonjr/mathts-matrix@0.7.4
  - @danielsimonjr/mathts-parallel@0.6.6

## 0.4.23

### Patch Changes

- 593c70e: The published `.d.ts` files no longer import from `typed-function`, which neither package declares as a dependency. Consumers with `skipLibCheck: false` got TS7016 errors (138 in matrix, 39 in compat), because the import resolved to an untyped `typed-function@4.2.2` copy hoisted by other packages. The typed-function exports now use the `TypedFunction` type that `@danielsimonjr/mathts-core` re-exports, so the declarations resolve through a declared dependency.
- Updated dependencies [593c70e]
  - @danielsimonjr/mathts-matrix@0.7.3

## 0.4.22

### Patch Changes

- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
  - @danielsimonjr/mathts-core@0.15.0
  - @danielsimonjr/mathts-functions@0.64.1
  - @danielsimonjr/mathts-matrix@0.7.2
  - @danielsimonjr/mathts-parallel@0.6.5

## 0.4.21

### Patch Changes

- Updated dependencies [8789126]
  - @danielsimonjr/mathts-functions@0.64.0

## 0.4.20

### Patch Changes

- Updated dependencies [104a1c9]
- Updated dependencies [0592f7b]
  - @danielsimonjr/mathts-core@0.14.1
  - @danielsimonjr/mathts-functions@0.63.0

## 0.4.18

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.61.0

## 0.4.17

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.60.0

## 0.4.16

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.59.0

## 0.4.15

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.58.0

## 0.4.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.57.0

## 0.4.13

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.56.0

## 0.4.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.55.0

## 0.4.11

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.54.0

## 0.4.10

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.53.0

## 0.4.9

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.52.0

## 0.4.8

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.51.0

## 0.4.7

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.50.0

## 0.4.6

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.49.0

## 0.4.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.48.0

## 0.4.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.47.0

## 0.4.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.46.0

## 0.4.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.7.0
  - @danielsimonjr/mathts-functions@0.45.0

## 0.4.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.44.0

## 0.4.0

### Minor Changes

- Resolve the deduplication campaign's final decisions: a compat compatibility correction and an internal WasmLoader consolidation.

  **compat (behavior change):** `zeros(n)` and `ones(n)` with a single argument now return a length-`n` **vector** (`[0,0,0]` / `[1,1,1]`), matching mathjs, instead of an `n×n` square matrix. Two-argument `zeros(r, c)` / `ones(r, c)` continue to return an `r×c` matrix. compat's purpose is mathjs compatibility, and the previous square result diverged from mathjs (`math.zeros(3)` is a size-`[3]` vector) — this was a bug. Anyone relying on `zeros(n)` returning a square must now pass `zeros(n, n)`.

  **core / functions / matrix (internal, no runtime behavior change):** the shared WASM-loader logic — the SHA-384 integrity verification (`sha384OfBuffer` / `verifyWasmIntegrity` / `loadWasmManifest`) and packaged-binary resolution (`resolvePackagedWasm` / `defaultWasmLocation`) — was byte-identical in `functions` and `matrix` and is now single-sourced in `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`), with each package injecting its own binary/manifest path. The SHA-384 verify-before-instantiate security invariant is preserved byte-for-byte (Node `crypto.createHash('sha384')` / browser `crypto.subtle.digest('SHA-384')`, mismatch throws), node built-ins stay behind lazy dynamic `import()`, and core's browser-safe `.` entry is unaffected. The per-package `WasmLoader` class stays local (distinct AS allocation models).

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0
  - @danielsimonjr/mathts-functions@0.43.2
  - @danielsimonjr/mathts-matrix@0.6.3
  - @danielsimonjr/mathts-parallel@0.6.3

## 0.3.32

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0
  - @danielsimonjr/mathts-functions@0.43.1
  - @danielsimonjr/mathts-matrix@0.6.2
  - @danielsimonjr/mathts-parallel@0.6.2

## 0.3.31

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.43.0
  - @danielsimonjr/mathts-core@0.11.0
  - @danielsimonjr/mathts-matrix@0.6.1
  - @danielsimonjr/mathts-parallel@0.6.1

## 0.3.30

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.42.0

## 0.3.29

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.41.0

## 0.3.28

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.6.0
  - @danielsimonjr/mathts-functions@0.40.1

## 0.3.27

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.40.0

## 0.3.26

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.39.0

## 0.3.25

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.38.0

## 0.3.24

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.5.0
  - @danielsimonjr/mathts-functions@0.37.1

## 0.3.23

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @danielsimonjr/mathts-functions@0.37.0
  - @danielsimonjr/mathts-matrix@0.4.6

## 0.3.22

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.36.0

## 0.3.21

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.35.0

## 0.3.20

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.34.0

## 0.3.19

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.33.0

## 0.3.18

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.32.0

## 0.3.17

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.31.0

## 0.3.16

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.30.0

## 0.3.15

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.29.0

## 0.3.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.28.0

## 0.3.13

### Patch Changes

- Updated dependencies [1174c41]
  - @danielsimonjr/mathts-functions@0.27.0

## 0.3.12

### Patch Changes

- Updated dependencies [199da08]
  - @danielsimonjr/mathts-functions@0.26.0

## 0.3.11

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-functions@0.25.0
  - @danielsimonjr/mathts-parallel@0.6.0
  - @danielsimonjr/mathts-matrix@0.4.5

## 0.3.10

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-functions@0.24.0
  - @danielsimonjr/mathts-matrix@0.4.4
  - @danielsimonjr/mathts-parallel@0.5.1

## 0.3.9

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-functions@0.23.0
  - @danielsimonjr/mathts-parallel@0.5.0
  - @danielsimonjr/mathts-matrix@0.4.3

## 0.3.8

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-functions@0.22.0
  - @danielsimonjr/mathts-parallel@0.4.0
  - @danielsimonjr/mathts-matrix@0.4.2

## 0.3.7

### Patch Changes

- Updated dependencies [ea044c4]
  - @danielsimonjr/mathts-functions@0.21.0
  - @danielsimonjr/mathts-matrix@0.4.1

## 0.3.6

### Patch Changes

- Updated dependencies [b7784ef]
  - @danielsimonjr/mathts-functions@0.20.0

## 0.3.5

### Patch Changes

- Updated dependencies [abbe883]
  - @danielsimonjr/mathts-functions@0.19.0
  - @danielsimonjr/mathts-matrix@0.4.0

## 0.3.4

### Patch Changes

- Updated dependencies [7c53d7f]
  - @danielsimonjr/mathts-functions@0.18.0

## 0.3.3

### Patch Changes

- Updated dependencies [b78b8bc]
- Updated dependencies [2353e0a]
- Updated dependencies [908f19b]
- Updated dependencies [4b4ccd6]
  - @danielsimonjr/mathts-matrix@0.3.0
  - @danielsimonjr/mathts-functions@0.17.0

## 0.3.2

### Patch Changes

- Updated dependencies [557e27f]
  - @danielsimonjr/mathts-functions@0.16.0

## 0.3.1

### Patch Changes

- Updated dependencies [86f786e]
  - @danielsimonjr/mathts-functions@0.15.0

## 0.3.0

### Minor Changes

- 1df691c: **GC12 — `config()` now drives behavior + compat uses the real functions types.**

  - functions gains a `config()` accessor (`config-api.ts`): read the global runtime config, or pass a partial to merge it. Functions read this shared object live at call time (e.g. `identity`/`range`'s `config.matrix === 'Array'` return-type switch, `zeta`'s `config.relTol`), so `config({ matrix: 'Array' })` genuinely changes results. It is process-global (the functions surface is a singleton), not per-instance like mathjs `create()`.
  - compat's `config()` was **inert** (mutated a private object nothing read); it now forwards to `functions.config`, so `math.config({ matrix: 'Array' })` drives the functions surface, and `create(all, { … })` seeds it.
  - Deleted `compat/src/functions.d.ts` — an outdated ambient `declare module` stub (21 functions) whose own header said "until the functions package has proper .d.ts files." It was **shadowing** the real, complete functions types, so `import * as F` saw an empty namespace (even `F.zeta`/`F.cbrt` were invisible). compat now type-checks against the real 829-export surface. This closes GC12's "widen functions.d.ts" at root cause.

  Config is now process-global: a `delegation` test that asserted per-instance isolation was updated to reflect this (isolation was only ever "true" because config did nothing).

### Patch Changes

- Updated dependencies [1df691c]
- Updated dependencies [f2211c8]
  - @danielsimonjr/mathts-functions@0.14.0

## 0.2.11

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0
  - @danielsimonjr/mathts-functions@0.13.2
  - @danielsimonjr/mathts-matrix@0.2.2

## 0.2.10

### Patch Changes

- Updated dependencies [598e72d]
- Updated dependencies [ce8f929]
  - @danielsimonjr/mathts-functions@0.13.0

## 0.2.9

### Patch Changes

- Updated dependencies [779fcde]
- Updated dependencies [583817d]
- Updated dependencies [538c672]
- Updated dependencies [5f3b401]
  - @danielsimonjr/mathts-functions@0.12.0
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-matrix@0.2.0
  - @danielsimonjr/mathts-parallel@0.3.2

## 0.2.8

### Patch Changes

- Updated dependencies [dc14440]
- Updated dependencies [18871e1]
  - @danielsimonjr/mathts-functions@0.11.0

## 0.2.7

### Patch Changes

- Updated dependencies [dfb1b25]
- Updated dependencies [23642f2]
  - @danielsimonjr/mathts-functions@0.10.0

## 0.2.6

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [c041b4e]
- Updated dependencies [c041b4e]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0
  - @danielsimonjr/mathts-functions@0.9.0
  - @danielsimonjr/mathts-matrix@0.1.14

## 0.2.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.8.0

## 0.2.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.1
  - @danielsimonjr/mathts-functions@0.7.0

## 0.2.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.6.0

## 0.2.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0
  - @danielsimonjr/mathts-functions@0.5.0
  - @danielsimonjr/mathts-matrix@0.1.12

## 0.2.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0
  - @danielsimonjr/mathts-functions@0.4.0
  - @danielsimonjr/mathts-matrix@0.1.11

## 0.2.0

### Minor Changes

- - **feat (GC12):** fluent `chain` API — `math.chain(3).add(4).multiply(2).done()`.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @danielsimonjr/mathts-functions@0.3.0
  - @danielsimonjr/mathts-parallel@0.3.0
  - @danielsimonjr/mathts-matrix@0.1.10

## 0.1.9

### Patch Changes

- `add`/`subtract`/`multiply` are now variadic (mathjs parity): they fold over all arguments instead of dropping the 3rd+ operand. Previously `add(1, 2, 3)` returned `3` and `multiply(2, 3, 4)` returned `6`. Matrix operands and 2-arg calls are unchanged.
- Repin to `@danielsimonjr/mathts-core@^0.1.5` and `@danielsimonjr/mathts-functions@^0.2.8`.

## 0.1.8

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.7

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.6

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.5` (special-function fixes) for the matched set.

## Unreleased

### Tests

- Raise vitest line coverage of `compat/src/**` to 100% (`shims.ts` 159/159 lines, up from 95%). Added 19 tests across two new files:
  - `tests/coverage-gaps.test.ts` — factory pass-through (same `Fraction`/`BigNumber`/`DenseMatrix`/`SparseMatrix` instance returned unchanged), empty `sparse()` constructor, `det()` edge cases (0x0 empty matrix returns 1, `TypeError` on `SparseMatrix` input, 4x4 singular matrix returns 0 via the LU pivot-underflow path), and `size()` on matrix objects.
  - `tests/delegation.test.ts` — `create(all)` builds a mathjs-compatible instance whose arithmetic/statistics/rounding/type-creation surface delegates to the core types and functions ops, with per-instance config isolation.
- Add a `test:coverage` npm script to `compat/package.json` for parity with sibling packages.

## 0.1.5

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.4` (which now ships type declarations) to keep the matched MathTS set on one version.

## 0.1.4

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.3` to keep the matched MathTS package set on a single `expression`/`functions` version.

## 0.1.3

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.

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
  - @danielsimonjr/mathts-functions@0.1.1
  - @danielsimonjr/mathts-parallel@0.1.1
