# Unused Files and Exports Analysis

**Generated**: 2026-07-04

## Summary

- **Potentially unused files**: 0
- **Potentially unused exports**: 359
  - **Unreferenced anywhere (deletion candidates)**: 73
  - **Referenced in-module (type contracts / helpers backing live exports)**: 286

## Potentially Unused Files

These files are not imported by any other file in the codebase:

## Unreferenced Anywhere (deletion candidates)

Not imported by any other file AND not referenced within their own module — the true dead-code candidates. Verify each isn't consumed by a mechanism the
parser can't see (dynamic access, docs examples, published-API contract) before deleting.

### `core/src/types/unit-prefixes.ts`

- `SI_PREFIX_KEYS` (constant)

### `matrix/src/backends/WasmLoader.ts`

- `initWasm` (function)

### `matrix/src/config.ts`

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

### `matrix/src/operations/sqrtm.ts`

- `matrixSqrtNewtonInternal` (function)

### `functions/src/arithmetic/nthRoot.ts`

- `createNthRootNumber` (constant)

### `functions/src/error/ArgumentsError.ts`

- `createArgumentsError` (function)

### `functions/src/error/IndexError.ts`

- `createIndexError` (function)

### `functions/src/expression/operators.ts`

- `getAssociativity` (function)
- `isAssociativeWith` (function)

### `functions/src/relational/compareText.ts`

- `createCompareTextNumber` (constant)

### `functions/src/relational/equalScalar.ts`

- `createEqualScalarNumber` (constant)

### `functions/src/type/bignumber/BigNumber.ts`

- `createBigNumberClass` (constant)

### `functions/src/type/complex/Complex.ts`

- `createComplexClass` (constant)

### `functions/src/type/matrix/types.ts`

- `DenseMatrixJSON` (interface)
- `SparseMatrixJSON` (interface)
- `MatrixEntry` (interface)
- `MathNumericValue` (type)

### `functions/src/utils/array.ts`

- `initial` (function)
- `ArrayOrScalar` (type)

### `functions/src/utils/map.ts`

- `toObject` (function)

### `functions/src/utils/noop.ts`

- `noIndex` (function)
- `noSubset` (function)

### `functions/src/utils/string.ts`

- `endsWith` (function)
- `escape` (function)

### `functions/src/wasm/bitwise/wasm-bridge.ts`

- `resetBitwiseWasm` (function)

### `functions/src/wasm/bridges/common.ts`

- `resetScratch` (function)

### `functions/src/wasm/interpolation/wasm-bridge.ts`

- `resetTridiagWasm` (function)

### `functions/src/wasm/poly/wasm-bridge.ts`

- `resetPolyWasm` (function)

### `functions/src/wasm/sort/wasm-bridge.ts`

- `rankF64Dispatch` (function)

### `functions/src/wasm/special/wasm-bridge.ts`

- `resetCarlsonWasm` (function)
- `resetBesselWasm` (function)
- `resetAiryWasm` (function)
- `resetEllipticWasm` (function)
- `resetLgammaWasm` (function)

### `functions/src/wasm/WasmLoader.ts`

- `initWasm` (function)

### `expression/src/error/IndexError.ts`

- `createIndexError` (function)

### `expression/src/utils/array.ts`

- `validateIndexSourceSize` (function)
- `isEmptyIndex` (function)
- `filterRegExp` (function)
- `identify` (function)
- `generalize` (function)
- `initial` (function)
- `ArrayOrScalar` (type)

### `expression/src/utils/collection.ts`

- `containsCollections` (function)
- `scatter` (function)

### `expression/src/utils/is.ts`

- `isBigInt` (function)
- `isBoolean` (function)
- `isDate` (function)
- `isRegExp` (function)
- `isPartitionedMap` (function)
- `isNull` (function)
- `isUndefined` (function)

### `expression/src/utils/map.ts`

- `isObjectWrappingMap` (function)

### `expression/src/utils/mathml.ts`

- `operatorPrecedence` (function)

### `expression/src/utils/string.ts`

- `endsWith` (function)

### `parallel/src/strategies/chunk.ts`

- `memorySizeBytes` (function)

### `workbook/src/parser.ts`

- `importWorkbook` (function)

### `assembly/src/types/complex.ts`

- `complexFromReal` (function)
- `complexFromImaginary` (function)
- `COMPLEX_ZERO` (constant)
- `COMPLEX_ONE` (constant)
- `COMPLEX_I` (constant)
- `COMPLEX_NEG_ONE` (constant)

## Referenced In-Module (type contracts / helpers backing live exports)

Not imported cross-file, but referenced within their own module — they type or
support exports that ARE used, so they cannot be deleted in isolation. Mostly
interfaces typing live guards and per-package API completeness, not rot.

### `packages/workerpool/src/fft-core.ts`

- `fftBitReverse` (function) — 1 in-file ref

### `core/src/config.ts`

- `ConfigOptions` (interface) — 2 in-file refs
- `MathJsConfig` (type) — 1 in-file ref

### `core/src/factory.ts`

- `sortFactories` (function) — 1 in-file ref
- `create` (function) — 7 in-file refs
- `isFactory` (function) — 10 in-file refs
- `assertDependencies` (function) — 1 in-file ref
- `isOptionalDependency` (function) — 1 in-file ref
- `stripOptionalNotation` (function) — 1 in-file ref
- `FactoryFunction` (interface) — 12 in-file refs
- `LegacyFactory` (interface) — 9 in-file refs
- `FactoryMeta` (interface) — 3 in-file refs
- `DependencyName` (type) — 4 in-file refs
- `CreateFunction` (type) — 1 in-file ref

### `core/src/typed/mathts-typed.ts`

- `MathTSTyped` (interface) — 4 in-file refs
- `MathTSTypeDef` (interface) — 1 in-file ref
- `SignatureImpl` (type) — 7 in-file refs
- `SignatureRecord` (type) — 3 in-file refs

### `matrix/src/backends/WasmLoader.ts`

- `WasmLoader` (class) — 9 in-file refs
- `Allocation` (interface) — 10 in-file refs
- `LoadingMetrics` (interface) — 2 in-file refs

### `matrix/src/config.ts`

- `setConfig` (function) — 10 in-file refs
- `BackendConfig` (interface) — 3 in-file refs
- `AdaptiveTuningConfig` (interface) — 2 in-file refs
- `ProfilingConfig` (interface) — 1 in-file ref
- `BackendPreference` (type) — 2 in-file refs
- `DEFAULT_CONFIG` (constant) — 2 in-file refs

### `functions/src/algebra/simplify/util.ts`

- `OpNodeLike` (interface) — 8 in-file refs
- `FuncNodeLike` (interface) — 4 in-file refs

### `functions/src/algebra/solver/lsolveAll.ts`

- `DenseMatrix` (interface) — 29 in-file refs

### `functions/src/algebra/solver/usolveAll.ts`

- `DenseMatrix` (interface) — 29 in-file refs

### `functions/src/algebra/sparse/csAmd.ts`

- `SparseMatrixData` (interface) — 9 in-file refs

### `functions/src/algebra/sparse/csChol.ts`

- `SparseMatrixData` (interface) — 4 in-file refs
- `SymbolicAnalysis` (interface) — 1 in-file ref
- `CholResult` (interface) — 1 in-file ref

### `functions/src/algebra/sparse/csCounts.ts`

- `SparseMatrixData` (interface) — 3 in-file refs

### `functions/src/algebra/sparse/csLu.ts`

- `SparseMatrixData` (interface) — 4 in-file refs
- `SymbolicAnalysis` (interface) — 1 in-file ref
- `LuResult` (interface) — 1 in-file ref

### `functions/src/algebra/sparse/csSpsolve.ts`

- `SparseMatrixData` (interface) — 2 in-file refs

### `functions/src/algebra/sparse/csSqr.ts`

- `SparseMatrixData` (interface) — 3 in-file refs
- `SymbolicAnalysis` (interface) — 3 in-file refs

### `functions/src/algebra/sparse/csSymperm.ts`

- `SparseMatrixData` (interface) — 3 in-file refs

### `functions/src/arithmetic/ceil.ts`

- `createCeilNumber` (constant) — 1 in-file ref

### `functions/src/arithmetic/fix.ts`

- `createFixNumber` (constant) — 1 in-file ref

### `functions/src/arithmetic/floor.ts`

- `createFloorNumber` (constant) — 1 in-file ref

### `functions/src/arithmetic/utils/nodeOperations.ts`

- `MathNode` (interface) — 7 in-file refs
- `name` (constant) — 5 in-file refs
- `dependencies` (constant) — 1 in-file ref

### `functions/src/core/create.ts`

- `create` (function) — 11 in-file refs
- `ImportOptions` (interface) — 1 in-file ref
- `FactoriesInput` (type) — 4 in-file refs

### `functions/src/core/function/config.ts`

- `ConfigFunction` (interface) — 2 in-file refs
- `MatrixOption` (type) — 1 in-file ref
- `NumberOption` (type) — 1 in-file ref
- `ConfigOptions` (type) — 5 in-file refs
- `EmitFunction` (type) — 1 in-file ref
- `MATRIX_OPTIONS` (constant) — 6 in-file refs
- `NUMBER_OPTIONS` (constant) — 6 in-file refs

### `functions/src/core/function/import.ts`

- `ImportOptions` (interface) — 5 in-file refs
- `path` (constant) — 3 in-file refs

### `functions/src/core/function/typed.ts`

- `TypedSignatures` (type) — 4 in-file refs
- `TypeTest` (type) — 1 in-file ref
- `TypeConversion` (type) — 3 in-file refs
- `TypeDefinition` (type) — 2 in-file refs
- `createTyped` (constant) — 2 in-file refs

### `functions/src/expression/operators.ts`

- `getPrecedence` (function) — 2 in-file refs
- `properties` (constant) — 6 in-file refs

### `functions/src/matrix/native-accel.ts`

- `isLargeNumericSquare` (function) — 2 in-file refs
- `isNumericSquare` (function) — 1 in-file ref
- `NATIVE_MATRIX_THRESHOLD` (constant) — 2 in-file refs

### `functions/src/matrix/sqrtm.ts`

- `Matrix` (interface) — 33 in-file refs

### `functions/src/matrix/utils/zerosAndOnes.ts`

- `BigNumberConstructor` (interface) — 1 in-file ref
- `BigNumber` (interface) — 13 in-file refs
- `MatrixConstructor` (interface) — 1 in-file ref
- `Matrix` (interface) — 17 in-file refs
- `Config` (interface) — 1 in-file ref

### `functions/src/probability/random.ts`

- `createRandomNumber` (constant) — 1 in-file ref

### `functions/src/relational/compare.ts`

- `createCompareNumber` (constant) — 1 in-file ref

### `functions/src/relational/equal.ts`

- `createEqualNumber` (constant) — 1 in-file ref

### `functions/src/relational/larger.ts`

- `createLargerNumber` (constant) — 1 in-file ref

### `functions/src/relational/largerEq.ts`

- `createLargerEqNumber` (constant) — 1 in-file ref

### `functions/src/relational/smaller.ts`

- `createSmallerNumber` (constant) — 1 in-file ref

### `functions/src/relational/smallerEq.ts`

- `createSmallerEqNumber` (constant) — 1 in-file ref

### `functions/src/relational/unequal.ts`

- `createUnequalNumber` (constant) — 1 in-file ref

### `functions/src/type/bignumber/BigNumber.ts`

- `BigNumberJSON` (interface) — 4 in-file refs
- `ConfigChangeEvent` (interface) — 4 in-file refs
- `BigNumberClass` (interface) — 3 in-file refs
- `BigNumberInstance` (interface) — 9 in-file refs

### `functions/src/type/chain/Chain.ts`

- `ChainJSON` (interface) — 4 in-file refs
- `ChainInstance` (interface) — 14 in-file refs
- `ChainConstructor` (interface) — 9 in-file refs

### `functions/src/type/complex/Complex.ts`

- `ComplexJSON` (interface) — 6 in-file refs
- `PolarCoordinates` (interface) — 2 in-file refs
- `ComplexFormatOptions` (interface) — 3 in-file refs
- `PolarInput` (interface) — 4 in-file refs
- `AbsArgInput` (interface) — 2 in-file refs
- `ComplexConstructor` (interface) — 1 in-file ref

### `functions/src/type/matrix/MatrixIndex.ts`

- `IndexDimension` (type) — 6 in-file refs
- `IndexForEachCallback` (type) — 1 in-file ref

### `functions/src/type/matrix/types.ts`

- `BigNumberLike` (interface) — 13 in-file refs
- `ComplexLike` (interface) — 9 in-file refs
- `FractionLike` (interface) — 9 in-file refs
- `DenseMatrixInterface` (interface) — 5 in-file refs
- `SparseMatrixInterface` (interface) — 3 in-file refs
- `MatrixFormatOptions` (interface) — 1 in-file ref
- `RangeJSON` (interface) — 1 in-file ref
- `RangeFormatOptions` (interface) — 1 in-file ref
- `NestedArray` (type) — 6 in-file refs
- `MapCallback` (type) — 1 in-file ref
- `ForEachCallback` (type) — 1 in-file ref
- `RangeForEachCallback` (type) — 1 in-file ref
- `RangeMapCallback` (type) — 1 in-file ref

### `functions/src/type/resultset/ResultSet.ts`

- `ResultSetJSON` (interface) — 4 in-file refs
- `ResultSetInstance` (interface) — 8 in-file refs
- `ResultSetConstructor` (interface) — 4 in-file refs

### `functions/src/type/unit/physicalConstants.ts`

- `UnitInstance` (interface) — 2 in-file refs

### `functions/src/utils/array.ts`

- `validate` (function) — 7 in-file refs
- `processSizesWildcard` (function) — 1 in-file ref
- `unsqueeze` (function) — 3 in-file refs
- `map` (function) — 5 in-file refs
- `forEach` (function) — 5 in-file refs
- `join` (function) — 2 in-file refs
- `last` (function) — 6 in-file refs
- `checkBroadcastingRules` (function) — 2 in-file refs
- `broadcastArrays` (function) — 1 in-file ref
- `stretch` (function) — 1 in-file ref
- `clone` (function) — 1 in-file ref
- `IdentifiedValue` (interface) — 3 in-file refs
- `NestedArray` (type) — 80 in-file refs

### `functions/src/utils/bignumber/bitwise.ts`

- `bitwise` (function) — 4 in-file refs

### `functions/src/utils/bignumber/formatter.ts`

- `toEngineering` (function) — 1 in-file ref
- `toExponential` (function) — 5 in-file refs
- `toFixed` (function) — 5 in-file refs

### `functions/src/utils/factory.ts`

- `sortFactories` (function) — 1 in-file ref
- `create` (function) — 7 in-file refs
- `assertDependencies` (function) — 1 in-file ref
- `isOptionalDependency` (function) — 1 in-file ref
- `DependencyName` (type) — 4 in-file refs
- `CreateFunction` (type) — 1 in-file ref

### `functions/src/utils/is.ts`

- `BigNumber` (interface) — 2 in-file refs
- `Complex` (interface) — 1 in-file ref
- `Fraction` (interface) — 1 in-file ref
- `Unit` (interface) — 2 in-file refs
- `DenseMatrix` (interface) — 2 in-file refs
- `SparseMatrix` (interface) — 1 in-file ref
- `Range` (interface) — 1 in-file ref
- `ResultSet` (interface) — 1 in-file ref
- `Help` (interface) — 1 in-file ref
- `Chain` (interface) — 1 in-file ref
- `Node` (interface) — 19 in-file refs
- `AccessorNode` (interface) — 1 in-file ref
- `ArrayNode` (interface) — 1 in-file ref
- `AssignmentNode` (interface) — 1 in-file ref
- `BlockNode` (interface) — 1 in-file ref
- `ConditionalNode` (interface) — 1 in-file ref
- `ConstantNode` (interface) — 1 in-file ref
- `FunctionAssignmentNode` (interface) — 1 in-file ref
- `FunctionNode` (interface) — 1 in-file ref
- `IndexNode` (interface) — 1 in-file ref
- `ObjectNode` (interface) — 1 in-file ref
- `OperatorNode` (interface) — 2 in-file refs
- `ParenthesisNode` (interface) — 1 in-file ref
- `RangeNode` (interface) — 1 in-file ref
- `RelationalNode` (interface) — 1 in-file ref
- `SymbolNode` (interface) — 1 in-file ref
- `PartitionedMap` (interface) — 1 in-file ref

### `functions/src/utils/map.ts`

- `assign` (function) — 1 in-file ref
- `ObjectWrappingMap` (class) — 5 in-file refs
- `PartitionedMap` (class) — 2 in-file refs

### `functions/src/utils/string.ts`

- `stringify` (function) — 2 in-file refs
- `GeneralFormatOptions` (type) — 1 in-file ref

### `functions/src/wasm/elementwise/wasm-bridge.ts`

- `WASM_ELEMENTWISE_THRESHOLD` (constant) — 2 in-file refs
- `WASM_ELEMENTWISE_OPS` (constant) — 1 in-file ref

### `functions/src/wasm/integrity.ts`

- `sha384OfBuffer` (function) — 1 in-file ref
- `WasmManifest` (interface) — 4 in-file refs

### `functions/src/wasm/interpolation/wasm-bridge.ts`

- `tridiagSolveJS` (function) — 1 in-file ref
- `WASM_TRIDIAG_THRESHOLD` (constant) — 1 in-file ref

### `functions/src/wasm/signal/wasm-bridge.ts`

- `applyWindowJS` (function) — 2 in-file refs
- `goertzelJS` (function) — 1 in-file ref
- `bartlettPSDJS` (function) — 1 in-file ref
- `chirpZTransformJS` (function) — 1 in-file ref

### `functions/src/wasm/sort/wasm-bridge.ts`

- `sortF64JS` (function) — 1 in-file ref
- `argsortF64JS` (function) — 2 in-file refs
- `rankF64JS` (function) — 1 in-file ref

### `functions/src/wasm/special/wasm-bridge.ts`

- `besselJ0JS` (function) — 1 in-file ref
- `besselJ1JS` (function) — 1 in-file ref
- `besselJnJS` (function) — 1 in-file ref
- `besselY0JS` (function) — 1 in-file ref
- `besselY1JS` (function) — 1 in-file ref
- `besselYnJS` (function) — 1 in-file ref
- `airyAiJS` (function) — 1 in-file ref
- `airyBiJS` (function) — 1 in-file ref
- `ellipticKJS` (function) — 1 in-file ref
- `ellipticEJS` (function) — 1 in-file ref

### `functions/src/wasm/WasmLoader.ts`

- `WasmLoader` (class) — 7 in-file refs
- `LoadingMetrics` (interface) — 2 in-file refs

### `expression/src/evaluator/evaluate.ts`

- `EvaluateOptions` (interface) — 7 in-file refs

### `expression/src/node/Node.ts`

- `CompiledExpression` (interface) — 1 in-file ref

### `expression/src/utils/array.ts`

- `validate` (function) — 7 in-file refs
- `validateIndex` (function) — 1 in-file ref
- `resize` (function) — 5 in-file refs
- `reshape` (function) — 2 in-file refs
- `processSizesWildcard` (function) — 1 in-file ref
- `squeeze` (function) — 3 in-file refs
- `unsqueeze` (function) — 3 in-file refs
- `flatten` (function) — 2 in-file refs
- `filter` (function) — 3 in-file refs
- `getArrayDataType` (function) — 1 in-file ref
- `last` (function) — 6 in-file refs
- `concat` (function) — 4 in-file refs
- `broadcastSizes` (function) — 2 in-file refs
- `checkBroadcastingRules` (function) — 2 in-file refs
- `broadcastTo` (function) — 1 in-file ref
- `broadcastArrays` (function) — 1 in-file ref
- `stretch` (function) — 1 in-file ref
- `get` (function) — 2 in-file refs
- `clone` (function) — 1 in-file ref
- `IdentifiedValue` (interface) — 3 in-file refs
- `NestedArray` (type) — 80 in-file refs

### `expression/src/utils/bignumber/formatter.ts`

- `toEngineering` (function) — 1 in-file ref
- `toExponential` (function) — 5 in-file refs
- `toFixed` (function) — 5 in-file refs

### `expression/src/utils/collection.ts`

- `deepForEach` (function) — 1 in-file ref
- `reduce` (function) — 5 in-file refs

### `expression/src/utils/factory.ts`

- `sortFactories` (function) — 1 in-file ref
- `create` (function) — 7 in-file refs
- `isFactory` (function) — 10 in-file refs
- `assertDependencies` (function) — 1 in-file ref
- `isOptionalDependency` (function) — 1 in-file ref
- `stripOptionalNotation` (function) — 1 in-file ref
- `FactoryFunction` (interface) — 13 in-file refs
- `LegacyFactory` (interface) — 10 in-file refs
- `FactoryMeta` (interface) — 3 in-file refs
- `DependencyName` (type) — 4 in-file refs
- `CreateFunction` (type) — 1 in-file ref

### `expression/src/utils/is.ts`

- `isFraction` (function) — 2 in-file refs
- `isDenseMatrix` (function) — 3 in-file refs
- `isSparseMatrix` (function) — 3 in-file refs
- `isRange` (function) — 4 in-file refs
- `isIndex` (function) — 3 in-file refs
- `isResultSet` (function) — 3 in-file refs
- `isAssignmentNode` (function) — 3 in-file refs
- `isBlockNode` (function) — 3 in-file refs
- `isConditionalNode` (function) — 3 in-file refs
- `isRangeNode` (function) — 3 in-file refs
- `isRelationalNode` (function) — 3 in-file refs
- `isChain` (function) — 3 in-file refs
- `BigNumber` (interface) — 2 in-file refs
- `Complex` (interface) — 1 in-file ref
- `Fraction` (interface) — 1 in-file ref
- `Unit` (interface) — 2 in-file refs
- `DenseMatrix` (interface) — 2 in-file refs
- `SparseMatrix` (interface) — 1 in-file ref
- `Range` (interface) — 1 in-file ref
- `ResultSet` (interface) — 1 in-file ref
- `Help` (interface) — 1 in-file ref
- `Chain` (interface) — 1 in-file ref
- `Node` (interface) — 18 in-file refs
- `AccessorNode` (interface) — 1 in-file ref
- `ArrayNode` (interface) — 1 in-file ref
- `AssignmentNode` (interface) — 1 in-file ref
- `BlockNode` (interface) — 1 in-file ref
- `ConditionalNode` (interface) — 1 in-file ref
- `ConstantNode` (interface) — 1 in-file ref
- `FunctionAssignmentNode` (interface) — 1 in-file ref
- `FunctionNode` (interface) — 1 in-file ref
- `IndexNode` (interface) — 1 in-file ref
- `ObjectNode` (interface) — 1 in-file ref
- `OperatorNode` (interface) — 2 in-file refs
- `ParenthesisNode` (interface) — 1 in-file ref
- `RangeNode` (interface) — 1 in-file ref
- `RelationalNode` (interface) — 1 in-file ref
- `SymbolNode` (interface) — 1 in-file ref
- `PartitionedMap` (interface) — 1 in-file ref

### `expression/src/utils/latex.ts`

- `latexSymbols` (constant) — 3 in-file refs

### `expression/src/utils/map.ts`

- `assign` (function) — 1 in-file ref

### `expression/src/utils/mathml.ts`

- `numberToMathML` (function) — 1 in-file ref

### `expression/src/utils/string.ts`

- `compareText` (function) — 2 in-file refs

### `parallel/src/ComputePool.ts`

- `tensordotChunkKernel` (function) — 1 in-file ref

### `workbook/src/doc.ts`

- `DescribeDoc` (interface) — 1 in-file ref

### `workbook/src/rpc.ts`

- `JsonRpcRequest` (interface) — 1 in-file ref
- `JsonRpcResponse` (interface) — 1 in-file ref
- `JsonRpcEvent` (interface) — 3 in-file refs
- `HandleResult` (interface) — 3 in-file refs

### `workbook/src/session.ts`

- `WorkbookEventLite` (interface) — 2 in-file refs
