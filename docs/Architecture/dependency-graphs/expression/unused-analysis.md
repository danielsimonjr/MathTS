# Unused Files and Exports Analysis

**Generated**: 2026-04-04

## Summary

- **Potentially unused files**: 46
- **Potentially unused exports**: 135

## Potentially Unused Files

These files are not imported by any other file in the codebase:

- `src/embeddedDocs/function/probability/distribution.ts`
- `src/error/ArgumentsError.ts`
- `src/function/compile.ts`
- `src/function/evaluate.ts`
- `src/function/help.ts`
- `src/function/parser.ts`
- `src/node/AccessorNode.ts`
- `src/node/ArrayNode.ts`
- `src/node/AssignmentNode.ts`
- `src/node/BlockNode.ts`
- `src/node/ConditionalNode.ts`
- `src/node/ConstantNode.ts`
- `src/node/FunctionAssignmentNode.ts`
- `src/node/FunctionNode.ts`
- `src/node/IndexNode.ts`
- `src/node/ObjectNode.ts`
- `src/node/OperatorNode.ts`
- `src/node/ParenthesisNode.ts`
- `src/node/RangeNode.ts`
- `src/node/RelationalNode.ts`
- `src/node/SymbolNode.ts`
- `src/transform/and.transform.ts`
- `src/transform/bitAnd.transform.ts`
- `src/transform/bitOr.transform.ts`
- `src/transform/column.transform.ts`
- `src/transform/concat.transform.ts`
- `src/transform/cumsum.transform.ts`
- `src/transform/diff.transform.ts`
- `src/transform/filter.transform.ts`
- `src/transform/forEach.transform.ts`
- `src/transform/index.transform.ts`
- `src/transform/map.transform.ts`
- `src/transform/mapSlices.transform.ts`
- `src/transform/max.transform.ts`
- `src/transform/mean.transform.ts`
- `src/transform/min.transform.ts`
- `src/transform/nullish.transform.ts`
- `src/transform/or.transform.ts`
- `src/transform/print.transform.ts`
- `src/transform/quantileSeq.transform.ts`
- `src/transform/range.transform.ts`
- `src/transform/row.transform.ts`
- `src/transform/std.transform.ts`
- `src/transform/subset.transform.ts`
- `src/transform/sum.transform.ts`
- `src/transform/variance.transform.ts`

## Potentially Unused Exports

These exports are not imported by any other file in the codebase:

### `src/error/IndexError.ts`

- `createIndexError` (function)

### `src/node/Node.ts`

- `CompiledExpression` (interface)
- `StringOptions` (interface)
- `createNode` (constant)

### `src/utils/array.ts`

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

### `src/utils/bignumber/formatter.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toFixed` (function)

### `src/utils/collection.ts`

- `containsCollections` (function)
- `deepForEach` (function)
- `reduce` (function)
- `scatter` (function)

### `src/utils/factory.ts`

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

### `src/utils/is.ts`

- `isFraction` (function)
- `isDenseMatrix` (function)
- `isSparseMatrix` (function)
- `isIndex` (function)
- `isBoolean` (function)
- `isResultSet` (function)
- `isDate` (function)
- `isRegExp` (function)
- `isPartitionedMap` (function)
- `isObjectWrappingMap` (function)
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

### `src/utils/latex.ts`

- `latexSymbols` (constant)

### `src/utils/map.ts`

- `assign` (function)

### `src/utils/number.ts`

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

### `src/utils/object.ts`

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

### `src/utils/string.ts`

- `endsWith` (function)
- `compareText` (function)

