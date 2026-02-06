# Unused Files and Exports Analysis

**Generated**: 2026-02-06

## Summary

- **Potentially unused files**: 63
- **Potentially unused exports**: 176

## Potentially Unused Files

These files are not imported by any other file in the codebase:

- `src/bigint.ts`
- `src/bignumber/bitwise.ts`
- `src/bignumber/constants.ts`
- `src/bignumber/nearlyEqual.ts`
- `src/collection.ts`
- `src/complex.ts`
- `src/constants.ts`
- `src/create.ts`
- `src/customs.d.ts`
- `src/emitter.ts`
- `src/error/ArgumentsError.ts`
- `src/error/IndexError.ts`
- `src/factory.ts`
- `src/function/typed.ts`
- `src/latex.d.ts`
- `src/latex.ts`
- `src/log.ts`
- `src/node.ts`
- `src/noop.ts`
- `src/optimizeCallback.ts`
- `src/print.ts`
- `src/product.ts`
- `src/scope.ts`
- `src/snapshot.ts`
- `src/string.d.ts`
- `src/typed-function.d.ts`
- `src/types/bigint.ts`
- `src/types/boolean.ts`
- `src/types/chain/Chain.ts`
- `src/types/chain/function/chain.ts`
- `src/types/matrix/DenseMatrix.ts`
- `src/types/matrix/FibonacciHeap.ts`
- `src/types/matrix/function/index.ts`
- `src/types/matrix/function/matrix.ts`
- `src/types/matrix/function/sparse.ts`
- `src/types/matrix/ImmutableDenseMatrix.ts`
- `src/types/matrix/Matrix.ts`
- `src/types/matrix/MatrixIndex.ts`
- `src/types/matrix/Range.ts`
- `src/types/matrix/Spa.ts`
- `src/types/matrix/SparseMatrix.ts`
- `src/types/matrix/utils/matAlgo01xDSid.ts`
- `src/types/matrix/utils/matAlgo02xDS0.ts`
- `src/types/matrix/utils/matAlgo03xDSf.ts`
- `src/types/matrix/utils/matAlgo04xSidSid.ts`
- `src/types/matrix/utils/matAlgo05xSfSf.ts`
- `src/types/matrix/utils/matAlgo06xS0S0.ts`
- `src/types/matrix/utils/matAlgo07xSSf.ts`
- `src/types/matrix/utils/matAlgo08xS0Sid.ts`
- `src/types/matrix/utils/matAlgo09xS0Sf.ts`
- `src/types/matrix/utils/matAlgo10xSids.ts`
- `src/types/matrix/utils/matAlgo11xS0s.ts`
- `src/types/matrix/utils/matAlgo12xSfs.ts`
- `src/types/matrix/utils/matrixAlgorithmSuite.ts`
- `src/types/number.ts`
- `src/types/resultset/ResultSet.ts`
- `src/types/string.ts`
- `src/types/unit/function/createUnit.ts`
- `src/types/unit/function/splitUnit.ts`
- `src/types/unit/function/unit.ts`
- `src/types/unit/physicalConstants.ts`
- `src/types/unit/Unit.ts`
- `src/utils.ts`

## Potentially Unused Exports

These exports are not imported by any other file in the codebase:

### `src/array.ts`

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
- `clone` (function)
- `IdentifiedValue` (interface)
- `NestedArray` (type)
- `ArrayOrScalar` (type)

### `src/bignumber/formatter.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toFixed` (function)

### `src/factory/factory.ts`

- `MathTSConfig` (interface)
- `FactoryFunction` (interface)
- `FactoryDependencies` (interface)
- `FactoryImport` (type)
- `addFactory` (constant)
- `add` (constant)

### `src/function/config.ts`

- `ConfigFunction` (interface)
- `MatrixOption` (type)
- `NumberOption` (type)
- `ConfigOptions` (type)
- `EmitFunction` (type)
- `MATRIX_OPTIONS` (constant)
- `NUMBER_OPTIONS` (constant)

### `src/function/import.ts`

- `path` (constant)

### `src/function.ts`

- `memoizeCompare` (function)

### `src/is.ts`

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
- `isHelp` (function)
- `isFunction` (function)
- `isDate` (function)
- `isRegExp` (function)
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

### `src/map.ts`

- `createEmptyMap` (function)
- `createMap` (function)
- `toObject` (function)
- `assign` (function)

### `src/number.ts`

- `safeNumberType` (function)
- `splitNumber` (function)
- `toEngineering` (function)
- `toFixed` (function)
- `toExponential` (function)
- `toPrecision` (function)
- `roundDigits` (function)
- `digits` (function)
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

### `src/object.ts`

- `clone` (function)
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

### `src/string.ts`

- `stringify` (function)
- `escape` (function)
- `compareText` (function)

### `src/typed/mathts-typed.ts`

- `initTypedWasm` (function)
- `TypeDef` (interface)
- `ConversionDef` (interface)
- `MathTSTypeDef` (interface)
- `isNumber` (constant)
- `isFloat64Array` (constant)
- `isComplex` (constant)
- `isMatrix` (constant)
- `isUnit` (constant)
- `MATHTS_TYPES` (constant)

### `src/types/bignumber.ts`

- `BigNumberConfig` (interface)
- `RoundingMode` (type)

### `src/types/interfaces.ts`

- `MatrixBackend` (interface)
- `IMatrix` (interface)
- `IBigNumber` (interface)
- `MatrixDimensions` (interface)
- `BackendType` (type)
- `NumericType` (type)

### `src/types.ts`

- `SparseMatrix` (interface)
- `Unit` (interface)
- `MatrixConstructor` (interface)
- `Complex` (type)

