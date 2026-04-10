# Test Coverage Analysis

**Generated**: 2026-04-10

## Summary

| Metric | Count |
|--------|-------|
| Total Source Files | 95 |
| Total Test Files | 12 |
| Source Files with Tests | 12 |
| Source Files without Tests | 83 |
| Coverage | 12.6% |

---

## Source Files Without Test Coverage

The following 83 source files are not directly imported by any test file:

### root/

- `src/array.ts` → Expected test: `tests/unit/root/array.test.ts`
- `src/bigint.ts` → Expected test: `tests/unit/root/bigint.test.ts`
- `src/collection.ts` → Expected test: `tests/unit/root/collection.test.ts`
- `src/complex.ts` → Expected test: `tests/unit/root/complex.test.ts`
- `src/constants.ts` → Expected test: `tests/unit/root/constants.test.ts`
- `src/create.ts` → Expected test: `tests/unit/root/create.test.ts`
- `src/customs.d.ts` → Expected test: `tests/unit/root/customs.d.test.ts`
- `src/customs.ts` → Expected test: `tests/unit/root/customs.test.ts`
- `src/emitter.ts` → Expected test: `tests/unit/root/emitter.test.ts`
- `src/factory.ts` → Expected test: `tests/unit/root/factory.test.ts`
- `src/function.ts` → Expected test: `tests/unit/root/function.test.ts`
- `src/is.ts` → Expected test: `tests/unit/root/is.test.ts`
- `src/latex.d.ts` → Expected test: `tests/unit/root/latex.d.test.ts`
- `src/latex.ts` → Expected test: `tests/unit/root/latex.test.ts`
- `src/log.ts` → Expected test: `tests/unit/root/log.test.ts`
- `src/lruQueue.ts` → Expected test: `tests/unit/root/lruQueue.test.ts`
- `src/map.ts` → Expected test: `tests/unit/root/map.test.ts`
- `src/node.ts` → Expected test: `tests/unit/root/node.test.ts`
- `src/noop.ts` → Expected test: `tests/unit/root/noop.test.ts`
- `src/number.ts` → Expected test: `tests/unit/root/number.test.ts`
- `src/object.ts` → Expected test: `tests/unit/root/object.test.ts`
- `src/optimizeCallback.ts` → Expected test: `tests/unit/root/optimizeCallback.test.ts`
- `src/print.ts` → Expected test: `tests/unit/root/print.test.ts`
- `src/product.ts` → Expected test: `tests/unit/root/product.test.ts`
- `src/scope.ts` → Expected test: `tests/unit/root/scope.test.ts`
- `src/snapshot.ts` → Expected test: `tests/unit/root/snapshot.test.ts`
- `src/string.d.ts` → Expected test: `tests/unit/root/string.d.test.ts`
- `src/string.ts` → Expected test: `tests/unit/root/string.test.ts`
- `src/switch.ts` → Expected test: `tests/unit/root/switch.test.ts`
- `src/typed-function.d.ts` → Expected test: `tests/unit/root/typed-function.d.test.ts`
- `src/types.ts` → Expected test: `tests/unit/root/types.test.ts`
- `src/version.ts` → Expected test: `tests/unit/root/version.test.ts`

### bignumber/

- `src/bignumber/bitwise.ts` → Expected test: `tests/unit/bignumber/bitwise.test.ts`
- `src/bignumber/constants.ts` → Expected test: `tests/unit/bignumber/constants.test.ts`
- `src/bignumber/formatter.ts` → Expected test: `tests/unit/bignumber/formatter.test.ts`
- `src/bignumber/nearlyEqual.ts` → Expected test: `tests/unit/bignumber/nearlyEqual.test.ts`

### error/

- `src/error/ArgumentsError.ts` → Expected test: `tests/unit/error/ArgumentsError.test.ts`
- `src/error/DimensionError.ts` → Expected test: `tests/unit/error/DimensionError.test.ts`
- `src/error/IndexError.ts` → Expected test: `tests/unit/error/IndexError.test.ts`

### function/

- `src/function/config.ts` → Expected test: `tests/unit/function/config.test.ts`
- `src/function/import.ts` → Expected test: `tests/unit/function/import.test.ts`
- `src/function/typed.ts` → Expected test: `tests/unit/function/typed.test.ts`

### types/

- `src/types/bigint.ts` → Expected test: `tests/unit/types/bigint.test.ts`
- `src/types/boolean.ts` → Expected test: `tests/unit/types/boolean.test.ts`
- `src/types/chain/Chain.ts` → Expected test: `tests/unit/types/Chain.test.ts`
- `src/types/chain/function/chain.ts` → Expected test: `tests/unit/types/chain.test.ts`
- `src/types/index.ts` → Expected test: `tests/unit/types/index.test.ts`
- `src/types/interfaces.ts` → Expected test: `tests/unit/types/interfaces.test.ts`
- `src/types/matrix/DenseMatrix.ts` → Expected test: `tests/unit/types/DenseMatrix.test.ts`
- `src/types/matrix/FibonacciHeap.ts` → Expected test: `tests/unit/types/FibonacciHeap.test.ts`
- `src/types/matrix/ImmutableDenseMatrix.ts` → Expected test: `tests/unit/types/ImmutableDenseMatrix.test.ts`
- `src/types/matrix/Matrix.ts` → Expected test: `tests/unit/types/Matrix.test.ts`
- `src/types/matrix/MatrixIndex.ts` → Expected test: `tests/unit/types/MatrixIndex.test.ts`
- `src/types/matrix/Range.ts` → Expected test: `tests/unit/types/Range.test.ts`
- `src/types/matrix/Spa.ts` → Expected test: `tests/unit/types/Spa.test.ts`
- `src/types/matrix/SparseMatrix.ts` → Expected test: `tests/unit/types/SparseMatrix.test.ts`
- `src/types/matrix/function/index.ts` → Expected test: `tests/unit/types/index.test.ts`
- `src/types/matrix/function/matrix.ts` → Expected test: `tests/unit/types/matrix.test.ts`
- `src/types/matrix/function/sparse.ts` → Expected test: `tests/unit/types/sparse.test.ts`
- `src/types/matrix/utils/broadcast.ts` → Expected test: `tests/unit/types/broadcast.test.ts`
- `src/types/matrix/utils/matAlgo01xDSid.ts` → Expected test: `tests/unit/types/matAlgo01xDSid.test.ts`
- `src/types/matrix/utils/matAlgo02xDS0.ts` → Expected test: `tests/unit/types/matAlgo02xDS0.test.ts`
- `src/types/matrix/utils/matAlgo03xDSf.ts` → Expected test: `tests/unit/types/matAlgo03xDSf.test.ts`
- `src/types/matrix/utils/matAlgo04xSidSid.ts` → Expected test: `tests/unit/types/matAlgo04xSidSid.test.ts`
- `src/types/matrix/utils/matAlgo05xSfSf.ts` → Expected test: `tests/unit/types/matAlgo05xSfSf.test.ts`
- `src/types/matrix/utils/matAlgo06xS0S0.ts` → Expected test: `tests/unit/types/matAlgo06xS0S0.test.ts`
- `src/types/matrix/utils/matAlgo07xSSf.ts` → Expected test: `tests/unit/types/matAlgo07xSSf.test.ts`
- `src/types/matrix/utils/matAlgo08xS0Sid.ts` → Expected test: `tests/unit/types/matAlgo08xS0Sid.test.ts`
- `src/types/matrix/utils/matAlgo09xS0Sf.ts` → Expected test: `tests/unit/types/matAlgo09xS0Sf.test.ts`
- `src/types/matrix/utils/matAlgo10xSids.ts` → Expected test: `tests/unit/types/matAlgo10xSids.test.ts`
- `src/types/matrix/utils/matAlgo11xS0s.ts` → Expected test: `tests/unit/types/matAlgo11xS0s.test.ts`
- `src/types/matrix/utils/matAlgo12xSfs.ts` → Expected test: `tests/unit/types/matAlgo12xSfs.test.ts`
- `src/types/matrix/utils/matAlgo13xDD.ts` → Expected test: `tests/unit/types/matAlgo13xDD.test.ts`
- `src/types/matrix/utils/matAlgo14xDs.ts` → Expected test: `tests/unit/types/matAlgo14xDs.test.ts`
- `src/types/matrix/utils/matrixAlgorithmSuite.ts` → Expected test: `tests/unit/types/matrixAlgorithmSuite.test.ts`
- `src/types/number.ts` → Expected test: `tests/unit/types/number.test.ts`
- `src/types/resultset/ResultSet.ts` → Expected test: `tests/unit/types/ResultSet.test.ts`
- `src/types/string.ts` → Expected test: `tests/unit/types/string.test.ts`
- `src/types/unit/Unit.ts` → Expected test: `tests/unit/types/Unit.test.ts`
- `src/types/unit/function/createUnit.ts` → Expected test: `tests/unit/types/createUnit.test.ts`
- `src/types/unit/function/splitUnit.ts` → Expected test: `tests/unit/types/splitUnit.test.ts`
- `src/types/unit/function/unit.ts` → Expected test: `tests/unit/types/unit.test.ts`
- `src/types/unit/physicalConstants.ts` → Expected test: `tests/unit/types/physicalConstants.test.ts`

---

## Source Files With Test Coverage

| Source File | Test Files |
|-------------|------------|
| `src/config.ts` | `config.test.ts` |
| `factory/factory.ts` | `factory.test.ts`, `version.test.ts` |
| `factory/index.ts` | `factory.test.ts`, `version.test.ts` |
| `src/index.ts` | `version.test.ts` |
| `src/shared.ts` | `shared.test.ts` |
| `typed/index.ts` | `version.test.ts` |
| `typed/mathts-typed.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `version.test.ts` |
| `typed/type-bridge.ts` | `type-bridge.test.ts`, `version.test.ts` |
| `types/bignumber.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `bignumber-math.test.ts`, `bignumber.test.ts`, `version.test.ts` |
| `types/complex.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `complex.test.ts`, `version.test.ts` |
| `types/fraction.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `fraction.test.ts`, `version.test.ts` |
| `src/utils.ts` | `utils.test.ts` |

---

## Test File Details

| Test File | Imports from Source |
|-----------|---------------------|
| `tests/config.test.ts` | 1 files |
| `factory/factory.test.ts` | 2 files |
| `tests/shared.test.ts` | 1 files |
| `typed/mathts-typed-extended.test.ts` | 4 files |
| `typed/mathts-typed.test.ts` | 4 files |
| `typed/type-bridge.test.ts` | 4 files |
| `types/bignumber-math.test.ts` | 1 files |
| `types/bignumber.test.ts` | 1 files |
| `types/complex.test.ts` | 1 files |
| `types/fraction.test.ts` | 1 files |
| `tests/utils.test.ts` | 1 files |
| `tests/version.test.ts` | 9 files |
