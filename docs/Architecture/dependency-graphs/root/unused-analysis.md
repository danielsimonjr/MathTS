# Unused Files and Exports Analysis

**Generated**: 2026-04-04

## Summary

- **Potentially unused files**: 1
- **Potentially unused exports**: 198

## Potentially Unused Files

These files are not imported by any other file in the codebase:

- `packages/workerpool/src/index.ts`

## Potentially Unused Exports

These exports are not imported by any other file in the codebase:

### `core/src/factory/factory.ts`

- `MathTSConfig` (interface)
- `FactoryFunction` (interface)
- `FactoryDependencies` (interface)
- `FactoryImport` (type)

### `core/src/typed/mathts-typed.ts`

- `TypeDef` (interface)
- `ConversionDef` (interface)
- `MathTSTypeDef` (interface)

### `core/src/types/bignumber.ts`

- `BigNumberConfig` (interface)
- `RoundingMode` (type)

### `core/src/types/interfaces.ts`

- `MatrixBackend` (interface)
- `IMatrix` (interface)
- `IBigNumber` (interface)
- `MatrixDimensions` (interface)
- `BackendType` (type)
- `NumericType` (type)

### `matrix/src/backends/WasmLoader.ts`

- `initWasm` (function)
- `WasmLoader` (class)
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

### `matrix/src/types/Matrix.ts`

- `MatrixDimensions` (interface)
- `MatrixIndex` (interface)
- `MatrixType` (type)

### `expression/src/error/IndexError.ts`

- `createIndexError` (function)

### `expression/src/node/Node.ts`

- `CompiledExpression` (interface)
- `StringOptions` (interface)
- `createNode` (constant)

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
- `map` (function)
- `forEach` (function)
- `filter` (function)
- `filterRegExp` (function)
- `join` (function)
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
- `isComplex` (function)
- `isFraction` (function)
- `isUnit` (function)
- `isDenseMatrix` (function)
- `isSparseMatrix` (function)
- `isRange` (function)
- `isIndex` (function)
- `isBoolean` (function)
- `isResultSet` (function)
- `isDate` (function)
- `isRegExp` (function)
- `isPartitionedMap` (function)
- `isObjectWrappingMap` (function)
- `isNull` (function)
- `isUndefined` (function)
- `isArrayNode` (function)
- `isAssignmentNode` (function)
- `isBlockNode` (function)
- `isConditionalNode` (function)
- `isFunctionAssignmentNode` (function)
- `isIndexNode` (function)
- `isObjectNode` (function)
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

### `expression/src/utils/map.ts`

- `assign` (function)
- `PartitionedMap` (class)

### `expression/src/utils/number.ts`

- `splitNumber` (function)
- `toEngineering` (function)
- `toFixed` (function)
- `toExponential` (function)
- `toPrecision` (function)
- `roundDigits` (function)
- `digits` (function)
- `nearlyEqual` (function)
- `copysign` (function)
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

### `expression/src/utils/object.ts`

- `mapObject` (function)
- `extend` (function)
- `deepExtend` (function)
- `deepFlatten` (function)
- `canDefineProperty` (function)
- `lazy` (function)
- `traverse` (function)
- `isLegacyFactory` (function)
- `get` (function)
- `set` (function)
- `pick` (function)

### `expression/src/utils/string.ts`

- `endsWith` (function)
- `stringify` (function)
- `escape` (function)
- `compareText` (function)

### `parallel/src/ComputePool.ts`

- `ComputePoolConfig` (interface)

### `parallel/src/strategies/chunk.ts`

- `memorySizeBytes` (function)

### `workbook/src/graph.ts`

- `detectCycles` (function)

### `workbook/src/types.ts`

- `WorkbookMetadata` (interface)
- `RuntimeConfig` (interface)
- `ExecutionMode` (type)

### `assembly/src/types/complex.ts`

- `complexFromReal` (function)
- `complexFromImaginary` (function)
- `COMPLEX_ZERO` (constant)
- `COMPLEX_ONE` (constant)
- `COMPLEX_I` (constant)
- `COMPLEX_NEG_ONE` (constant)

