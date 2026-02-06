# Unused Files and Exports Analysis

**Generated**: 2026-02-06

## Summary

- **Potentially unused files**: 321
- **Potentially unused exports**: 176

## Potentially Unused Files

These files are not imported by any other file in the codebase:

- `src/algebra/decomposition/lup.ts`
- `src/algebra/decomposition/qr.ts`
- `src/algebra/decomposition/schur.ts`
- `src/algebra/decomposition/slu.ts`
- `src/algebra/derivative.ts`
- `src/algebra/leafCount.ts`
- `src/algebra/lyap.ts`
- `src/algebra/polynomialRoot.ts`
- `src/algebra/rationalize.ts`
- `src/algebra/resolve.ts`
- `src/algebra/simplify.ts`
- `src/algebra/simplifyConstant.ts`
- `src/algebra/simplifyCore.ts`
- `src/algebra/solver/lsolve.ts`
- `src/algebra/solver/lsolveAll.ts`
- `src/algebra/solver/lusolve.ts`
- `src/algebra/solver/usolve.ts`
- `src/algebra/solver/usolveAll.ts`
- `src/algebra/sparse/csChol.ts`
- `src/algebra/sylvester.ts`
- `src/algebra/symbolicEqual.ts`
- `src/arithmetic/abs.ts`
- `src/arithmetic/add.ts`
- `src/arithmetic/addScalar.ts`
- `src/arithmetic/cbrt.ts`
- `src/arithmetic/ceil.ts`
- `src/arithmetic/cube.ts`
- `src/arithmetic/divide.ts`
- `src/arithmetic/divideScalar.ts`
- `src/arithmetic/dotDivide.ts`
- `src/arithmetic/dotMultiply.ts`
- `src/arithmetic/dotPow.ts`
- `src/arithmetic/exp.ts`
- `src/arithmetic/expm1.ts`
- `src/arithmetic/fix.ts`
- `src/arithmetic/gcd.ts`
- `src/arithmetic/hypot.ts`
- `src/arithmetic/invmod.ts`
- `src/arithmetic/lcm.ts`
- `src/arithmetic/log.ts`
- `src/arithmetic/log10.ts`
- `src/arithmetic/log1p.ts`
- `src/arithmetic/log2.ts`
- `src/arithmetic/multiply.ts`
- `src/arithmetic/multiplyScalar.ts`
- `src/arithmetic/norm.ts`
- `src/arithmetic/nthRoot.ts`
- `src/arithmetic/nthRoots.ts`
- `src/arithmetic/pow.ts`
- `src/arithmetic/round.ts`
- `src/arithmetic/sign.ts`
- `src/arithmetic/sqrt.ts`
- `src/arithmetic/square.ts`
- `src/arithmetic/subtract.ts`
- `src/arithmetic/subtractScalar.ts`
- `src/arithmetic/unaryMinus.ts`
- `src/arithmetic/unaryPlus.ts`
- `src/arithmetic/utils/nodeOperations.ts`
- `src/arithmetic/xgcd.ts`
- `src/bitwise/bitAnd.ts`
- `src/bitwise/bitNot.ts`
- `src/bitwise/bitOr.ts`
- `src/bitwise/bitXor.ts`
- `src/bitwise/leftShift.ts`
- `src/bitwise/rightArithShift.ts`
- `src/bitwise/rightLogShift.ts`
- `src/combinatorics/bellNumbers.ts`
- `src/combinatorics/catalan.ts`
- `src/combinatorics/composition.ts`
- `src/combinatorics/stirlingS2.ts`
- `src/complex/arg.ts`
- `src/complex/conj.ts`
- `src/complex/im.ts`
- `src/complex/re.ts`
- `src/expression/embeddedDocs/function/probability/distribution.ts`
- `src/expression/function/compile.ts`
- `src/expression/function/evaluate.ts`
- `src/expression/function/help.ts`
- `src/expression/function/parser.ts`
- `src/expression/Help.ts`
- `src/expression/node/AccessorNode.ts`
- `src/expression/node/ArrayNode.ts`
- `src/expression/node/AssignmentNode.ts`
- `src/expression/node/BlockNode.ts`
- `src/expression/node/ConditionalNode.ts`
- `src/expression/node/ConstantNode.ts`
- `src/expression/node/FunctionAssignmentNode.ts`
- `src/expression/node/FunctionNode.ts`
- `src/expression/node/IndexNode.ts`
- `src/expression/node/ObjectNode.ts`
- `src/expression/node/OperatorNode.ts`
- `src/expression/node/ParenthesisNode.ts`
- `src/expression/node/RangeNode.ts`
- `src/expression/node/RelationalNode.ts`
- `src/expression/node/SymbolNode.ts`
- `src/expression/parse.ts`
- `src/expression/Parser.ts`
- `src/expression/transform/and.transform.ts`
- `src/expression/transform/bitAnd.transform.ts`
- `src/expression/transform/bitOr.transform.ts`
- `src/expression/transform/column.transform.ts`
- `src/expression/transform/concat.transform.ts`
- `src/expression/transform/cumsum.transform.ts`
- `src/expression/transform/diff.transform.ts`
- `src/expression/transform/filter.transform.ts`
- `src/expression/transform/forEach.transform.ts`
- `src/expression/transform/index.transform.ts`
- `src/expression/transform/map.transform.ts`
- `src/expression/transform/mapSlices.transform.ts`
- `src/expression/transform/max.transform.ts`
- `src/expression/transform/mean.transform.ts`
- `src/expression/transform/min.transform.ts`
- `src/expression/transform/nullish.transform.ts`
- `src/expression/transform/or.transform.ts`
- `src/expression/transform/print.transform.ts`
- `src/expression/transform/quantileSeq.transform.ts`
- `src/expression/transform/range.transform.ts`
- `src/expression/transform/row.transform.ts`
- `src/expression/transform/std.transform.ts`
- `src/expression/transform/subset.transform.ts`
- `src/expression/transform/sum.transform.ts`
- `src/expression/transform/variance.transform.ts`
- `src/expression/types.ts`
- `src/geometry/distance.ts`
- `src/geometry/intersect.ts`
- `src/logical/and.ts`
- `src/logical/not.ts`
- `src/logical/nullish.ts`
- `src/logical/or.ts`
- `src/logical/xor.ts`
- `src/matrix/column.ts`
- `src/matrix/concat.ts`
- `src/matrix/count.ts`
- `src/matrix/cross.ts`
- `src/matrix/ctranspose.ts`
- `src/matrix/det.ts`
- `src/matrix/diag.ts`
- `src/matrix/diff.ts`
- `src/matrix/dot.ts`
- `src/matrix/eigs.ts`
- `src/matrix/expm.ts`
- `src/matrix/fft.ts`
- `src/matrix/filter.ts`
- `src/matrix/flatten.ts`
- `src/matrix/forEach.ts`
- `src/matrix/getMatrixDataType.ts`
- `src/matrix/identity.ts`
- `src/matrix/ifft.ts`
- `src/matrix/inv.ts`
- `src/matrix/kron.ts`
- `src/matrix/map.ts`
- `src/matrix/mapSlices.ts`
- `src/matrix/matrixFromColumns.ts`
- `src/matrix/matrixFromFunction.ts`
- `src/matrix/matrixFromRows.ts`
- `src/matrix/ones.ts`
- `src/matrix/partitionSelect.ts`
- `src/matrix/pinv.ts`
- `src/matrix/range.ts`
- `src/matrix/reshape.ts`
- `src/matrix/resize.ts`
- `src/matrix/rotate.ts`
- `src/matrix/rotationMatrix.ts`
- `src/matrix/row.ts`
- `src/matrix/size.ts`
- `src/matrix/sort.ts`
- `src/matrix/sqrtm.ts`
- `src/matrix/squeeze.ts`
- `src/matrix/subset.ts`
- `src/matrix/trace.ts`
- `src/matrix/transpose.ts`
- `src/matrix/zeros.ts`
- `src/numeric/solveODE.ts`
- `src/probability/bernoulli.ts`
- `src/probability/combinations.ts`
- `src/probability/combinationsWithRep.ts`
- `src/probability/factorial.ts`
- `src/probability/gamma.ts`
- `src/probability/kldivergence.ts`
- `src/probability/lgamma.ts`
- `src/probability/multinomial.ts`
- `src/probability/permutations.ts`
- `src/probability/pickRandom.ts`
- `src/probability/random.ts`
- `src/probability/randomInt.ts`
- `src/relational/compare.ts`
- `src/relational/compareNatural.ts`
- `src/relational/compareText.ts`
- `src/relational/deepEqual.ts`
- `src/relational/equal.ts`
- `src/relational/equalScalar.ts`
- `src/relational/equalText.ts`
- `src/relational/larger.ts`
- `src/relational/largerEq.ts`
- `src/relational/smaller.ts`
- `src/relational/smallerEq.ts`
- `src/relational/unequal.ts`
- `src/set/setCartesian.ts`
- `src/set/setDifference.ts`
- `src/set/setDistinct.ts`
- `src/set/setIntersect.ts`
- `src/set/setIsSubset.ts`
- `src/set/setMultiplicity.ts`
- `src/set/setPowerset.ts`
- `src/set/setSize.ts`
- `src/set/setSymDifference.ts`
- `src/set/setUnion.ts`
- `src/special/erf.ts`
- `src/special/zeta.ts`
- `src/statistics/corr.ts`
- `src/statistics/cumsum.ts`
- `src/statistics/mad.ts`
- `src/statistics/max.ts`
- `src/statistics/mean.ts`
- `src/statistics/median.ts`
- `src/statistics/min.ts`
- `src/statistics/mode.ts`
- `src/statistics/prod.ts`
- `src/statistics/quantileSeq.ts`
- `src/statistics/std.ts`
- `src/statistics/sum.ts`
- `src/statistics/variance.ts`
- `src/string/bin.ts`
- `src/string/format.ts`
- `src/string/hex.ts`
- `src/string/oct.ts`
- `src/string/print.ts`
- `src/trigonometry/acos.ts`
- `src/trigonometry/acosh.ts`
- `src/trigonometry/acot.ts`
- `src/trigonometry/acoth.ts`
- `src/trigonometry/acsc.ts`
- `src/trigonometry/acsch.ts`
- `src/trigonometry/asec.ts`
- `src/trigonometry/asech.ts`
- `src/trigonometry/asin.ts`
- `src/trigonometry/asinh.ts`
- `src/trigonometry/atan.ts`
- `src/trigonometry/atan2.ts`
- `src/trigonometry/atanh.ts`
- `src/trigonometry/cos.ts`
- `src/trigonometry/cosh.ts`
- `src/trigonometry/cot.ts`
- `src/trigonometry/coth.ts`
- `src/trigonometry/csc.ts`
- `src/trigonometry/csch.ts`
- `src/trigonometry/sec.ts`
- `src/trigonometry/sech.ts`
- `src/trigonometry/sin.ts`
- `src/trigonometry/sinh.ts`
- `src/trigonometry/tan.ts`
- `src/trigonometry/tanh.ts`
- `src/type/bigint.ts`
- `src/type/bignumber/function/bignumber.ts`
- `src/type/boolean.ts`
- `src/type/chain/Chain.ts`
- `src/type/chain/function/chain.ts`
- `src/type/complex/function/complex.ts`
- `src/type/fraction/function/fraction.ts`
- `src/type/matrix/DenseMatrix.ts`
- `src/type/matrix/FibonacciHeap.ts`
- `src/type/matrix/function/index.ts`
- `src/type/matrix/function/matrix.ts`
- `src/type/matrix/function/sparse.ts`
- `src/type/matrix/ImmutableDenseMatrix.ts`
- `src/type/matrix/Matrix.ts`
- `src/type/matrix/MatrixIndex.ts`
- `src/type/matrix/Range.ts`
- `src/type/matrix/Spa.ts`
- `src/type/matrix/SparseMatrix.ts`
- `src/type/number.ts`
- `src/type/resultset/ResultSet.ts`
- `src/type/string.ts`
- `src/type/unit/function/createUnit.ts`
- `src/type/unit/function/splitUnit.ts`
- `src/type/unit/function/unit.ts`
- `src/type/unit/physicalConstants.ts`
- `src/type/unit/Unit.ts`
- `src/unit/to.ts`
- `src/unit/toBest.ts`
- `src/utils/clone.ts`
- `src/utils/hasNumericValue.ts`
- `src/utils/isBounded.ts`
- `src/utils/isFinite.ts`
- `src/utils/isInteger.ts`
- `src/utils/isNaN.ts`
- `src/utils/isNegative.ts`
- `src/utils/isNumeric.ts`
- `src/utils/isPositive.ts`
- `src/utils/isPrime.ts`
- `src/utils/isZero.ts`
- `src/utils/log.ts`
- `src/utils/numeric.ts`
- `src/utils/parseNumber.ts`
- `src/utils/snapshot.ts`
- `src/utils/typeOf.ts`
- `src/wasm/algebra/equations.ts`
- `src/wasm/algebra/polynomial.ts`
- `src/wasm/algebra/solver.ts`
- `src/wasm/algebra/sparse/amd.ts`
- `src/wasm/algebra/sparse/operations.ts`
- `src/wasm/arithmetic/advanced.ts`
- `src/wasm/arithmetic/basic.ts`
- `src/wasm/arithmetic/logarithmic.ts`
- `src/wasm/bitwise/operations.ts`
- `src/wasm/combinatorics/basic.ts`
- `src/wasm/matrix/algorithms.ts`
- `src/wasm/matrix/basic.ts`
- `src/wasm/matrix/broadcast.ts`
- `src/wasm/matrix/functions.ts`
- `src/wasm/matrix/rotation.ts`
- `src/wasm/matrix/sparse.ts`
- `src/wasm/MatrixWasmBridge.ts`
- `src/wasm/numeric/calculus.ts`
- `src/wasm/numeric/interpolation.ts`
- `src/wasm/numeric/rational.ts`
- `src/wasm/numeric/rootfinding.ts`
- `src/wasm/probability/distributions.ts`
- `src/wasm/trigonometry/basic.ts`
- `src/wasm/unit/conversion.ts`
- `src/wasm/utils/checks.ts`

## Potentially Unused Exports

These exports are not imported by any other file in the codebase:

### `src/arithmetic/floor.ts`

- `createFloorNumber` (constant)

### `src/core/create.ts`

- `MathJsInstance` (interface)
- `ImportOptions` (interface)
- `FactoriesInput` (type)

### `src/core/function/config.ts`

- `ConfigFunction` (interface)
- `MatrixOption` (type)
- `NumberOption` (type)
- `ConfigOptions` (type)
- `EmitFunction` (type)
- `MATRIX_OPTIONS` (constant)
- `NUMBER_OPTIONS` (constant)

### `src/core/function/import.ts`

- `ImportOptions` (interface)
- `path` (constant)

### `src/core/function/typed.ts`

- `TypedSignatures` (type)
- `TypeTest` (type)
- `TypeConversion` (type)
- `TypeDefinition` (type)
- `createTyped` (constant)

### `src/error/ArgumentsError.ts`

- `createArgumentsError` (function)

### `src/error/IndexError.ts`

- `createIndexError` (function)

### `src/expression/node/Node.ts`

- `CompiledExpression` (interface)
- `createNode` (constant)

### `src/expression/transform/types.ts`

- `ComplexLike` (interface)
- `FractionLike` (interface)
- `CompiledExpression` (interface)
- `MathValue` (type)
- `PredicateFunction` (type)
- `TypedCallback` (type)

### `src/signal/conv.ts`

- `ConvMode` (type)

### `src/signal/fft.ts`

- `FFTResult` (interface)

### `src/type/bignumber/BigNumber.ts`

- `BigNumberJSON` (interface)
- `ConfigChangeEvent` (interface)
- `BigNumberClass` (interface)
- `BigNumberInstance` (interface)
- `createBigNumberClass` (constant)

### `src/type/complex/Complex.ts`

- `PolarCoordinates` (interface)
- `ComplexFormatOptions` (interface)
- `createComplexClass` (constant)

### `src/type/fraction/Fraction.ts`

- `FractionJSON` (interface)
- `FractionConstructor` (interface)
- `FractionValue` (type)
- `createFractionClass` (constant)

### `src/type/local/Complex.ts`

- `ComplexJSON` (interface)
- `PolarForm` (interface)
- `ComplexLike` (interface)

### `src/type/local/Decimal.ts`

- `DecimalConfig` (interface)
- `ROUND_UP` (constant)
- `ROUND_DOWN` (constant)
- `ROUND_CEIL` (constant)
- `ROUND_FLOOR` (constant)
- `ROUND_HALF_UP` (constant)
- `ROUND_HALF_DOWN` (constant)
- `ROUND_HALF_EVEN` (constant)
- `ROUND_HALF_CEIL` (constant)
- `ROUND_HALF_FLOOR` (constant)
- `EUCLID` (constant)

### `src/type/local/Fraction.ts`

- `FractionJSON` (interface)
- `FractionLike` (interface)

### `src/type/matrix/types.ts`

- `ComplexLike` (interface)
- `FractionLike` (interface)
- `DenseMatrixInterface` (interface)
- `SparseMatrixInterface` (interface)
- `MathNumericValue` (type)
- `ElementwiseOperation` (type)
- `AlgorithmFunction` (type)

### `src/utils/array.ts`

- `last` (function)
- `initial` (function)
- `checkBroadcastingRules` (function)
- `broadcastArrays` (function)
- `stretch` (function)
- `clone` (function)
- `IdentifiedValue` (interface)
- `NestedArray` (type)
- `ArrayOrScalar` (type)

### `src/utils/bignumber/bitwise.ts`

- `bitwise` (function)

### `src/utils/bignumber/constants.ts`

- `createBigNumberE` (constant)
- `createBigNumberPhi` (constant)
- `createBigNumberTau` (constant)

### `src/utils/bignumber/formatter.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toFixed` (function)

### `src/utils/emitter.ts`

- `mixin` (function)
- `EmitterMixin` (interface)

### `src/utils/factory.ts`

- `sortFactories` (function)
- `create` (function)
- `assertDependencies` (function)
- `isOptionalDependency` (function)
- `DependencyName` (type)
- `CreateFunction` (type)
- `createLog` (constant)

### `src/utils/function.ts`

- `memoizeCompare` (function)
- `MemoizeCache` (interface)
- `MemoizedFunction` (interface)

### `src/utils/is.ts`

- `BigNumber` (interface)
- `Complex` (interface)
- `Fraction` (interface)
- `Unit` (interface)
- `DenseMatrix` (interface)
- `SparseMatrix` (interface)
- `Range` (interface)
- `ResultSet` (interface)
- `Help` (interface)
- `Chain` (interface)
- `Node` (interface)
- `AccessorNode` (interface)
- `ArrayNode` (interface)
- `AssignmentNode` (interface)
- `BlockNode` (interface)
- `ConditionalNode` (interface)
- `ConstantNode` (interface)
- `FunctionAssignmentNode` (interface)
- `FunctionNode` (interface)
- `IndexNode` (interface)
- `ObjectNode` (interface)
- `OperatorNode` (interface)
- `ParenthesisNode` (interface)
- `RangeNode` (interface)
- `RelationalNode` (interface)
- `SymbolNode` (interface)
- `PartitionedMap` (interface)

### `src/utils/latex.ts`

- `latexSymbols` (constant)

### `src/utils/map.ts`

- `assign` (function)

### `src/utils/noop.ts`

- `noIndex` (function)
- `noSubset` (function)

### `src/utils/number.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toPrecision` (function)
- `roundDigits` (function)
- `SplitValue` (interface)
- `NumberTypeConfig` (interface)
- `FormatOptions` (interface)
- `NormalizedFormatOptions` (interface)

### `src/utils/object.ts`

- `mapObject` (function)
- `canDefineProperty` (function)
- `traverse` (function)
- `get` (function)
- `set` (function)
- `pick` (function)

### `src/wasm/algebra/decomposition.ts`

- `luDecompositionSIMD` (function)

### `src/wasm/algebra/sparse/utilities.ts`

- `csPermute` (function)
- `csLeaf` (function)
- `csSpsolve` (function)

### `src/wasm/geometry/operations.ts`

- `intersectLineCircle` (function)
- `intersectLineSphere` (function)
- `intersectCircles` (function)
- `projectPointOnLine2D` (function)
- `distancePointToLine2D` (function)
- `distancePointToPlane` (function)
- `polygonCentroid2D` (function)
- `polygonArea2D` (function)
- `pointInConvexPolygon2D` (function)

### `src/wasm/matrix/eigs.ts`

- `eigsSymmetricSIMD` (function)

### `src/wasm/matrix/linalg.ts`

- `lsolveUnit` (function)
- `lsolveMultiple` (function)
- `usolveMultiple` (function)

### `src/wasm/matrix/multiply.ts`

- `multiplyBlockedSIMD` (function)

### `src/wasm/signal/fft.ts`

- `powerSpectrum` (function)
- `magnitudeSpectrum` (function)
- `phaseSpectrum` (function)
- `crossCorrelation` (function)
- `autoCorrelation` (function)
- `fftSIMD` (function)

### `src/wasm/simd/operations.ts`

- `simdAddF64` (function)
- `simdMatVecMulF64` (function)
- `simdMeanF64` (function)
- `simdAddF32` (function)
- `simdAddI32` (function)
- `simdComplexMulF64` (function)
- `simdSupported` (function)

### `src/wasm/statistics/select.ts`

- `selectKSmallest` (function)
- `selectKLargest` (function)
- `selectQuantile` (function)
- `partitionSelectIndex` (function)

### `src/wasm/WasmLoader.ts`

- `initWasm` (function)
- `WasmLoader` (class)
- `LoadingMetrics` (interface)

