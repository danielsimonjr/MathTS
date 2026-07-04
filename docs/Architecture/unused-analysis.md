# Unused Files and Exports Analysis

**Generated**: 2026-07-04

## Summary

- **Potentially unused files**: 0
- **Potentially unused exports**: 463

## Potentially Unused Files

These files are not imported by any other file in the codebase:

## Potentially Unused Exports

These exports are not imported by any other file in the codebase:

### `packages/workerpool/src/fft-core.ts`

- `fftBitReverse` (function)

### `core/src/config.ts`

- `ConfigOptions` (interface)
- `MathJsConfig` (type)

### `core/src/is.ts`

- `isBigInt` (function)
- `isComplex` (function)
- `isFraction` (function)
- `isUnit` (function)
- `isString` (function)
- `isMatrix` (function)
- `isCollection` (function)
- `isDenseMatrix` (function)
- `isSparseMatrix` (function)
- `isRange` (function)
- `isIndex` (function)
- `isBoolean` (function)
- `isResultSet` (function)
- `isHelp` (function)
- `isFunction` (function)
- `isDate` (function)
- `isRegExp` (function)
- `isMap` (function)
- `isPartitionedMap` (function)
- `isObjectWrappingMap` (function)
- `isNull` (function)
- `isUndefined` (function)
- `isAccessorNode` (function)
- `isArrayNode` (function)
- `isAssignmentNode` (function)
- `isBlockNode` (function)
- `isConditionalNode` (function)
- `isConstantNode` (function)
- `rule2Node` (function)
- `isFunctionAssignmentNode` (function)
- `isFunctionNode` (function)
- `isIndexNode` (function)
- `isNode` (function)
- `isObjectNode` (function)
- `isOperatorNode` (function)
- `isParenthesisNode` (function)
- `isRangeNode` (function)
- `isRelationalNode` (function)
- `isSymbolNode` (function)
- `isChain` (function)
- `typeOf` (function)
- `BigNumber` (interface)
- `Complex` (interface)
- `Fraction` (interface)
- `Unit` (interface)
- `Matrix` (interface)
- `DenseMatrix` (interface)
- `SparseMatrix` (interface)
- `Range` (interface)
- `IndexDimension` (interface)
- `Index` (interface)
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
- `isArray` (constant)

### `core/src/number.ts`

- `isInteger` (function)
- `safeNumberType` (function)
- `format` (function)
- `normalizeFormatOptions` (function)
- `splitNumber` (function)
- `toEngineering` (function)
- `toFixed` (function)
- `toExponential` (function)
- `toPrecision` (function)
- `roundDigits` (function)
- `digits` (function)
- `copysign` (function)
- `isPowZeroAtInfinity` (function)
- `SplitValue` (interface)
- `NumberTypeConfig` (interface)
- `FormatOptions` (interface)
- `NormalizedFormatOptions` (interface)
- `sign` (constant)
- `log2` (constant)
- `log10` (constant)
- `log1p` (constant)
- `cbrt` (constant)
- `expm1` (constant)
- `acosh` (constant)
- `asinh` (constant)
- `atanh` (constant)
- `cosh` (constant)
- `sinh` (constant)
- `tanh` (constant)

### `core/src/typed/mathts-typed.ts`

- `MathTSTyped` (interface)
- `MathTSTypeDef` (interface)
- `SignatureImpl` (type)
- `SignatureRecord` (type)

### `matrix/src/backends/WasmLoader.ts`

- `initWasm` (function)
- `WasmLoader` (class)
- `Allocation` (interface)
- `LoadingMetrics` (interface)

### `matrix/src/config.ts`

- `setConfig` (function)
- `resetConfig` (function)
- `setBackendPreference` (function)
- `setBackendThreshold` (function)
- `setBackendEnabled` (function)
- `getRecommendedBackend` (function)
- `forceBackend` (function)
- `enableProfiling` (function)
- `disableProfiling` (function)
- `enableAdaptiveTuning` (function)
- `disableAdaptiveTuning` (function)
- `configureAdaptiveTuning` (function)
- `BackendConfig` (interface)
- `AdaptiveTuningConfig` (interface)
- `ProfilingConfig` (interface)
- `BackendPreference` (type)
- `DEFAULT_CONFIG` (constant)

### `matrix/src/operations/sqrtm.ts`

- `matrixSqrtNewtonInternal` (function)

### `matrix/src/types/dense/arithmetic.ts`

- `add` (function)
- `subtract` (function)
- `multiplyElementwise` (function)
- `multiply` (function)
- `scale` (function)
- `transpose` (function)

### `matrix/src/types/dense/reduction.ts`

- `sum` (function)
- `mean` (function)
- `min` (function)
- `max` (function)
- `norm` (function)
- `trace` (function)

### `functions/src/algebra/simplify/util.ts`

- `OpNodeLike` (interface)
- `FuncNodeLike` (interface)

### `functions/src/algebra/solver/lsolveAll.ts`

- `DenseMatrix` (interface)

### `functions/src/algebra/solver/usolveAll.ts`

- `DenseMatrix` (interface)

### `functions/src/algebra/sparse/csAmd.ts`

- `SparseMatrixData` (interface)

### `functions/src/algebra/sparse/csChol.ts`

- `SparseMatrixData` (interface)
- `SymbolicAnalysis` (interface)
- `CholResult` (interface)

### `functions/src/algebra/sparse/csCounts.ts`

- `SparseMatrixData` (interface)

### `functions/src/algebra/sparse/csLu.ts`

- `SparseMatrixData` (interface)
- `SymbolicAnalysis` (interface)
- `LuResult` (interface)

### `functions/src/algebra/sparse/csSpsolve.ts`

- `SparseMatrixData` (interface)

### `functions/src/algebra/sparse/csSqr.ts`

- `SparseMatrixData` (interface)
- `SymbolicAnalysis` (interface)

### `functions/src/algebra/sparse/csSymperm.ts`

- `SparseMatrixData` (interface)

### `functions/src/arithmetic/ceil.ts`

- `createCeilNumber` (constant)

### `functions/src/arithmetic/fix.ts`

- `createFixNumber` (constant)

### `functions/src/arithmetic/floor.ts`

- `createFloorNumber` (constant)

### `functions/src/arithmetic/nthRoot.ts`

- `createNthRootNumber` (constant)

### `functions/src/arithmetic/utils/nodeOperations.ts`

- `MathNode` (interface)
- `name` (constant)
- `dependencies` (constant)

### `functions/src/core/create.ts`

- `create` (function)
- `ImportOptions` (interface)
- `FactoriesInput` (type)

### `functions/src/core/function/config.ts`

- `ConfigFunction` (interface)
- `MatrixOption` (type)
- `NumberOption` (type)
- `ConfigOptions` (type)
- `EmitFunction` (type)
- `MATRIX_OPTIONS` (constant)
- `NUMBER_OPTIONS` (constant)

### `functions/src/core/function/import.ts`

- `ImportOptions` (interface)
- `path` (constant)

### `functions/src/core/function/typed.ts`

- `TypedSignatures` (type)
- `TypeTest` (type)
- `TypeConversion` (type)
- `TypeDefinition` (type)
- `createTyped` (constant)

### `functions/src/error/ArgumentsError.ts`

- `createArgumentsError` (function)

### `functions/src/error/IndexError.ts`

- `createIndexError` (function)

### `functions/src/expression/operators.ts`

- `getPrecedence` (function)
- `getAssociativity` (function)
- `isAssociativeWith` (function)
- `properties` (constant)

### `functions/src/matrix/expm.ts`

- `Matrix` (interface)

### `functions/src/matrix/native-accel.ts`

- `isLargeNumericSquare` (function)
- `isNumericSquare` (function)
- `NATIVE_MATRIX_THRESHOLD` (constant)

### `functions/src/matrix/sqrtm.ts`

- `Matrix` (interface)

### `functions/src/matrix/utils/zerosAndOnes.ts`

- `BigNumberConstructor` (interface)
- `BigNumber` (interface)
- `MatrixConstructor` (interface)
- `Matrix` (interface)
- `Config` (interface)

### `functions/src/probability/random.ts`

- `createRandomNumber` (constant)

### `functions/src/relational/compare.ts`

- `createCompareNumber` (constant)

### `functions/src/relational/compareText.ts`

- `createCompareTextNumber` (constant)

### `functions/src/relational/equal.ts`

- `createEqualNumber` (constant)

### `functions/src/relational/equalScalar.ts`

- `createEqualScalarNumber` (constant)

### `functions/src/relational/larger.ts`

- `createLargerNumber` (constant)

### `functions/src/relational/largerEq.ts`

- `createLargerEqNumber` (constant)

### `functions/src/relational/smaller.ts`

- `createSmallerNumber` (constant)

### `functions/src/relational/smallerEq.ts`

- `createSmallerEqNumber` (constant)

### `functions/src/relational/unequal.ts`

- `createUnequalNumber` (constant)

### `functions/src/type/bignumber/BigNumber.ts`

- `BigNumberJSON` (interface)
- `ConfigChangeEvent` (interface)
- `BigNumberClass` (interface)
- `BigNumberInstance` (interface)
- `createBigNumberClass` (constant)

### `functions/src/type/chain/Chain.ts`

- `ChainJSON` (interface)
- `ChainInstance` (interface)
- `ChainConstructor` (interface)

### `functions/src/type/complex/Complex.ts`

- `ComplexJSON` (interface)
- `PolarCoordinates` (interface)
- `ComplexFormatOptions` (interface)
- `PolarInput` (interface)
- `AbsArgInput` (interface)
- `ComplexConstructor` (interface)
- `createComplexClass` (constant)

### `functions/src/type/matrix/MatrixIndex.ts`

- `IndexDimension` (type)
- `IndexForEachCallback` (type)

### `functions/src/type/matrix/types.ts`

- `BigNumberLike` (interface)
- `ComplexLike` (interface)
- `FractionLike` (interface)
- `DenseMatrixInterface` (interface)
- `SparseMatrixInterface` (interface)
- `MatrixFormatOptions` (interface)
- `DenseMatrixJSON` (interface)
- `SparseMatrixJSON` (interface)
- `RangeJSON` (interface)
- `MatrixEntry` (interface)
- `RangeFormatOptions` (interface)
- `MathNumericValue` (type)
- `NestedArray` (type)
- `MapCallback` (type)
- `ForEachCallback` (type)
- `RangeForEachCallback` (type)
- `RangeMapCallback` (type)

### `functions/src/type/resultset/ResultSet.ts`

- `ResultSetJSON` (interface)
- `ResultSetInstance` (interface)
- `ResultSetConstructor` (interface)

### `functions/src/type/unit/physicalConstants.ts`

- `UnitInstance` (interface)

### `functions/src/utils/array.ts`

- `validate` (function)
- `processSizesWildcard` (function)
- `unsqueeze` (function)
- `map` (function)
- `forEach` (function)
- `join` (function)
- `last` (function)
- `initial` (function)
- `checkBroadcastingRules` (function)
- `broadcastArrays` (function)
- `stretch` (function)
- `clone` (function)
- `IdentifiedValue` (interface)
- `NestedArray` (type)
- `ArrayOrScalar` (type)

### `functions/src/utils/bignumber/bitwise.ts`

- `bitwise` (function)

### `functions/src/utils/bignumber/formatter.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toFixed` (function)

### `functions/src/utils/emitter.ts`

- `mixin` (function)
- `EmitterMixin` (interface)

### `functions/src/utils/factory.ts`

- `sortFactories` (function)
- `create` (function)
- `assertDependencies` (function)
- `isOptionalDependency` (function)
- `DependencyName` (type)
- `CreateFunction` (type)

### `functions/src/utils/is.ts`

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

### `functions/src/utils/map.ts`

- `toObject` (function)
- `assign` (function)
- `ObjectWrappingMap` (class)
- `PartitionedMap` (class)

### `functions/src/utils/noop.ts`

- `noIndex` (function)
- `noSubset` (function)

### `functions/src/utils/string.ts`

- `endsWith` (function)
- `stringify` (function)
- `escape` (function)
- `GeneralFormatOptions` (type)

### `functions/src/wasm/bitwise/wasm-bridge.ts`

- `resetBitwiseWasm` (function)

### `functions/src/wasm/bridges/common.ts`

- `resetScratch` (function)

### `functions/src/wasm/elementwise/wasm-bridge.ts`

- `WASM_ELEMENTWISE_THRESHOLD` (constant)
- `WASM_ELEMENTWISE_OPS` (constant)

### `functions/src/wasm/integrity.ts`

- `sha384OfBuffer` (function)
- `WasmManifest` (interface)

### `functions/src/wasm/interpolation/wasm-bridge.ts`

- `tridiagSolveJS` (function)
- `resetTridiagWasm` (function)
- `WASM_TRIDIAG_THRESHOLD` (constant)

### `functions/src/wasm/poly/wasm-bridge.ts`

- `resetPolyWasm` (function)

### `functions/src/wasm/signal/wasm-bridge.ts`

- `applyWindowJS` (function)
- `goertzelJS` (function)
- `bartlettPSDJS` (function)
- `chirpZTransformJS` (function)

### `functions/src/wasm/sort/wasm-bridge.ts`

- `sortF64JS` (function)
- `argsortF64JS` (function)
- `rankF64JS` (function)
- `rankF64Dispatch` (function)

### `functions/src/wasm/special/wasm-bridge.ts`

- `besselJ0JS` (function)
- `besselJ1JS` (function)
- `besselJnJS` (function)
- `besselY0JS` (function)
- `besselY1JS` (function)
- `besselYnJS` (function)
- `airyAiJS` (function)
- `airyBiJS` (function)
- `resetCarlsonWasm` (function)
- `resetBesselWasm` (function)
- `resetAiryWasm` (function)
- `resetEllipticWasm` (function)
- `resetLgammaWasm` (function)
- `ellipticKJS` (function)
- `ellipticEJS` (function)

### `functions/src/wasm/WasmLoader.ts`

- `initWasm` (function)
- `WasmLoader` (class)
- `LoadingMetrics` (interface)

### `expression/src/error/IndexError.ts`

- `createIndexError` (function)

### `expression/src/evaluator/evaluate.ts`

- `EvaluateOptions` (interface)

### `expression/src/node/Node.ts`

- `CompiledExpression` (interface)

### `expression/src/utils/array.ts`

- `validate` (function)
- `validateIndexSourceSize` (function)
- `validateIndex` (function)
- `isEmptyIndex` (function)
- `resize` (function)
- `reshape` (function)
- `processSizesWildcard` (function)
- `squeeze` (function)
- `unsqueeze` (function)
- `flatten` (function)
- `filter` (function)
- `filterRegExp` (function)
- `identify` (function)
- `generalize` (function)
- `getArrayDataType` (function)
- `last` (function)
- `initial` (function)
- `concat` (function)
- `broadcastSizes` (function)
- `checkBroadcastingRules` (function)
- `broadcastTo` (function)
- `broadcastArrays` (function)
- `stretch` (function)
- `get` (function)
- `clone` (function)
- `IdentifiedValue` (interface)
- `NestedArray` (type)
- `ArrayOrScalar` (type)

### `expression/src/utils/bignumber/formatter.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toFixed` (function)

### `expression/src/utils/collection.ts`

- `containsCollections` (function)
- `deepForEach` (function)
- `reduce` (function)
- `scatter` (function)

### `expression/src/utils/factory.ts`

- `sortFactories` (function)
- `create` (function)
- `isFactory` (function)
- `assertDependencies` (function)
- `isOptionalDependency` (function)
- `stripOptionalNotation` (function)
- `FactoryFunction` (interface)
- `LegacyFactory` (interface)
- `FactoryMeta` (interface)
- `DependencyName` (type)
- `CreateFunction` (type)

### `expression/src/utils/is.ts`

- `isBigInt` (function)
- `isFraction` (function)
- `isDenseMatrix` (function)
- `isSparseMatrix` (function)
- `isRange` (function)
- `isIndex` (function)
- `isBoolean` (function)
- `isResultSet` (function)
- `isDate` (function)
- `isRegExp` (function)
- `isPartitionedMap` (function)
- `isNull` (function)
- `isUndefined` (function)
- `isAssignmentNode` (function)
- `isBlockNode` (function)
- `isConditionalNode` (function)
- `isRangeNode` (function)
- `isRelationalNode` (function)
- `isChain` (function)
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

### `expression/src/utils/latex.ts`

- `latexSymbols` (constant)

### `expression/src/utils/map.ts`

- `assign` (function)
- `isObjectWrappingMap` (function)

### `expression/src/utils/mathml.ts`

- `numberToMathML` (function)
- `operatorPrecedence` (function)

### `expression/src/utils/string.ts`

- `endsWith` (function)
- `compareText` (function)

### `parallel/src/ComputePool.ts`

- `tensordotChunkKernel` (function)

### `parallel/src/strategies/chunk.ts`

- `memorySizeBytes` (function)

### `workbook/src/doc.ts`

- `DescribeDoc` (interface)

### `workbook/src/parser.ts`

- `importWorkbook` (function)

### `workbook/src/rpc.ts`

- `JsonRpcRequest` (interface)
- `JsonRpcResponse` (interface)
- `JsonRpcEvent` (interface)
- `HandleResult` (interface)

### `workbook/src/session.ts`

- `WorkbookEventLite` (interface)

### `assembly/src/types/complex.ts`

- `complexFromReal` (function)
- `complexFromImaginary` (function)
- `COMPLEX_ZERO` (constant)
- `COMPLEX_ONE` (constant)
- `COMPLEX_I` (constant)
- `COMPLEX_NEG_ONE` (constant)
