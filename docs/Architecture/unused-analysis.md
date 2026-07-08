# Unused Files and Exports Analysis

**Generated**: 2026-07-08

## Summary

- **Potentially unused files**: 0
- **Dormant files** (runtime code on disk, unreachable from any entry/build root): 8
  - **Orphaned (reachable from nothing — delete/wire candidates)**: 0
  - **Test-only (exercised by a test, ships nothing)**: 8
- **Potentially unused exports**: 231
  - **Unreferenced anywhere (deletion candidates)**: 0
  - **Referenced in-module (type contracts / helpers backing live exports)**: 231

## Dormant Files — Orphaned (delete/wire candidates)

Runtime source files reachable from NO root and NO test. Each is either dead code
to delete, or a root the tool cannot see (a new build/worker entry, a
`new URL()`-loaded script, or a side-effect-only module) — in which case wire it
or seed it. Verify before deleting.

_None._

## Dormant Files — Test-only (ships nothing, but exercised)

Not reachable from any package entry point, but imported by a test — deliberately
kept, standalone-tested code (e.g. legacy signal kernels) or a helper a test drives
directly. Not dead; not shipped. No action needed.

### `functions` (2)

- `functions/src/signal/conv.ts`
- `functions/src/signal/fft.ts`

### `parallel` (2)

- `parallel/src/ParallelMatrix.ts`
- `parallel/src/WorkerPool.ts`

### `plot` (4)

- `plot/src/coerce.ts`
- `plot/src/scale.ts`
- `plot/src/svg.ts`
- `plot/src/types.ts`

## Potentially Unused Files

These files are not imported by any other file in the codebase:

## Unreferenced Anywhere (deletion candidates)

Not imported by any other file AND not referenced within their own module — the true dead-code candidates. Verify each isn't consumed by a mechanism the
parser can't see (dynamic access, docs examples, published-API contract) before deleting.

## Referenced In-Module (type contracts / helpers backing live exports)

Not imported cross-file, but referenced within their own module — they type or
support exports that ARE used, so they cannot be deleted in isolation. Mostly
interfaces typing live guards and per-package API completeness, not rot.

### `core/src/config.ts`

- `MathJsConfig` (type) — 1 in-file ref

### `core/src/factory.ts`

- `create` (function) — 7 in-file refs
- `isFactory` (function) — 10 in-file refs
- `assertDependencies` (function) — 1 in-file ref
- `isOptionalDependency` (function) — 1 in-file ref
- `stripOptionalNotation` (function) — 1 in-file ref
- `LegacyFactory` (interface) — 9 in-file refs
- `FactoryMeta` (interface) — 3 in-file refs
- `DependencyName` (type) — 4 in-file refs
- `CreateFunction` (type) — 1 in-file ref

### `core/src/typed/mathts-typed.ts`

- `MathTSTyped` (interface) — 4 in-file refs
- `MathTSTypeDef` (interface) — 1 in-file ref
- `SignatureImpl` (type) — 7 in-file refs
- `SignatureRecord` (type) — 3 in-file refs

### `matrix/src/backends/wasm/integrity.ts`

- `WasmManifest` (interface) — 4 in-file refs

### `matrix/src/backends/WasmLoader.ts`

- `Allocation` (interface) — 10 in-file refs
- `LoadingMetrics` (interface) — 2 in-file refs

### `matrix/src/config.ts`

- `BackendConfig` (interface) — 3 in-file refs
- `AdaptiveTuningConfig` (interface) — 2 in-file refs
- `ProfilingConfig` (interface) — 1 in-file ref
- `BackendPreference` (type) — 2 in-file refs

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

- `properties` (constant) — 2 in-file refs

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

- `BigNumberJSON` (interface) — 2 in-file refs
- `BigNumberClass` (interface) — 1 in-file ref
- `BigNumberInstance` (interface) — 3 in-file refs

### `functions/src/type/chain/Chain.ts`

- `ChainJSON` (interface) — 4 in-file refs
- `ChainInstance` (interface) — 14 in-file refs
- `ChainConstructor` (interface) — 9 in-file refs

### `functions/src/type/complex/Complex.ts`

- `ComplexJSON` (interface) — 4 in-file refs
- `PolarCoordinates` (interface) — 1 in-file ref
- `ComplexFormatOptions` (interface) — 1 in-file ref
- `PolarInput` (interface) — 3 in-file refs
- `AbsArgInput` (interface) — 2 in-file refs
- `ComplexConstructor` (interface) — 1 in-file ref

### `functions/src/type/local/Decimal.ts`

- `Decimal` (class) — 161 in-file refs
- `DecimalConfig` (interface) — 3 in-file refs
- `ROUND_UP` (constant) — 3 in-file refs
- `ROUND_DOWN` (constant) — 3 in-file refs
- `ROUND_CEIL` (constant) — 4 in-file refs
- `ROUND_FLOOR` (constant) — 4 in-file refs
- `ROUND_HALF_UP` (constant) — 5 in-file refs
- `ROUND_HALF_DOWN` (constant) — 3 in-file refs
- `ROUND_HALF_EVEN` (constant) — 3 in-file refs
- `ROUND_HALF_CEIL` (constant) — 3 in-file refs
- `ROUND_HALF_FLOOR` (constant) — 3 in-file refs
- `EUCLID` (constant) — 2 in-file refs

### `functions/src/type/matrix/MatrixIndex.ts`

- `IndexDimension` (type) — 6 in-file refs
- `IndexForEachCallback` (type) — 1 in-file ref

### `functions/src/type/matrix/types.ts`

- `BigNumberLike` (interface) — 12 in-file refs
- `ComplexLike` (interface) — 8 in-file refs
- `FractionLike` (interface) — 8 in-file refs
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

### `functions/src/typed/polynomial-ideal.ts`

- `normalize` (function) — 8 in-file refs
- `polyAdd` (function) — 2 in-file refs
- `polyNeg` (function) — 2 in-file refs
- `polySub` (function) — 3 in-file refs
- `polyMul` (function) — 5 in-file refs
- `polyReduce` (function) — 3 in-file refs
- `Term` (interface) — 2 in-file refs
- `Poly` (type) — 42 in-file refs

### `functions/src/utils/array.ts`

- `validate` (function) — 7 in-file refs
- `processSizesWildcard` (function) — 1 in-file ref
- `unsqueeze` (function) — 3 in-file refs
- `map` (function) — 5 in-file refs
- `forEach` (function) — 5 in-file refs
- `join` (function) — 2 in-file refs
- `last` (function) — 5 in-file refs
- `checkBroadcastingRules` (function) — 2 in-file refs
- `broadcastArrays` (function) — 1 in-file ref
- `stretch` (function) — 1 in-file ref
- `clone` (function) — 1 in-file ref
- `IdentifiedValue` (interface) — 3 in-file refs
- `NestedArray` (type) — 79 in-file refs

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
- `OperatorNode` (interface) — 1 in-file ref
- `ParenthesisNode` (interface) — 1 in-file ref
- `RangeNode` (interface) — 1 in-file ref
- `RelationalNode` (interface) — 1 in-file ref
- `SymbolNode` (interface) — 1 in-file ref
- `PartitionedMap` (interface) — 1 in-file ref

### `functions/src/utils/map.ts`

- `assign` (function) — 1 in-file ref
- `ObjectWrappingMap` (class) — 4 in-file refs
- `PartitionedMap` (class) — 2 in-file refs

### `functions/src/utils/string.ts`

- `stringify` (function) — 2 in-file refs
- `GeneralFormatOptions` (type) — 1 in-file ref

### `functions/src/wasm/integrity.ts`

- `WasmManifest` (interface) — 4 in-file refs

### `functions/src/wasm/WasmLoader.ts`

- `WasmLoader` (class) — 7 in-file refs
- `LoadingMetrics` (interface) — 2 in-file refs

### `expression/src/evaluator/evaluate.ts`

- `EvaluateOptions` (interface) — 7 in-file refs

### `expression/src/node/Node.ts`

- `CompiledExpression` (interface) — 1 in-file ref

### `expression/src/utils/array.ts`

- `IdentifiedValue` (interface) — 3 in-file refs
- `NestedArray` (type) — 79 in-file refs

### `expression/src/utils/factory.ts`

- `FactoryFunction` (interface) — 13 in-file refs
- `FactoryMeta` (interface) — 3 in-file refs
- `DependencyName` (type) — 4 in-file refs
- `CreateFunction` (type) — 1 in-file ref

### `expression/src/utils/is.ts`

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

### `expression/src/utils/mathml.ts`

- `numberToMathML` (function) — 1 in-file ref

### `parallel/src/ComputePool.ts`

- `tensordotChunkKernel` (function) — 1 in-file ref

### `workbook/src/doc.ts`

- `DescribeDoc` (interface) — 1 in-file ref

### `workbook/src/html.ts`

- `ToHtmlOptions` (interface) — 1 in-file ref

### `workbook/src/rpc.ts`

- `JsonRpcResponse` (interface) — 1 in-file ref
- `JsonRpcEvent` (interface) — 3 in-file refs
- `HandleResult` (interface) — 3 in-file refs

### `workbook/src/session.ts`

- `WorkbookEventLite` (interface) — 2 in-file refs

### `workbook/src/svg.ts`

- `ChartSpec` (interface) — 1 in-file ref
