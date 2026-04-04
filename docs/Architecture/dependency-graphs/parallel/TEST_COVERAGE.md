# Test Coverage Analysis

**Generated**: 2026-04-04

## Summary

| Metric | Count |
|--------|-------|
| Total Source Files | 14 |
| Total Test Files | 10 |
| Source Files with Tests | 8 |
| Source Files without Tests | 6 |
| Coverage | 57.1% |

---

## Source Files Without Test Coverage

The following 6 source files are not directly imported by any test file:

### root/

- `src/WorkerPool.ts` → Expected test: `tests/unit/root/WorkerPool.test.ts`
- `src/index.ts` → Expected test: `tests/unit/root/index.test.ts`
- `src/matrix.worker.ts` → Expected test: `tests/unit/root/matrix.worker.test.ts`

### operations/

- `src/operations/index.ts` → Expected test: `tests/unit/operations/index.test.ts`

### strategies/

- `src/strategies/index.ts` → Expected test: `tests/unit/strategies/index.test.ts`

### workers/

- `src/workers/compute.worker.ts` → Expected test: `tests/unit/workers/compute.worker.test.ts`

---

## Source Files With Test Coverage

| Source File | Test Files |
|-------------|------------|
| `src/ComputePool.ts` | `ComputePool.test.ts`, `elementwise.test.ts`, `matmul.test.ts`, `threshold.test.ts` |
| `src/ParallelMatrix.ts` | `ParallelMatrix.test.ts` |
| `operations/elementwise.ts` | `elementwise.test.ts` |
| `operations/map.ts` | `map-extended.test.ts`, `map.test.ts` |
| `operations/matmul.ts` | `matmul.test.ts` |
| `operations/reduce.ts` | `reduce.test.ts` |
| `strategies/chunk.ts` | `chunk.test.ts`, `chunk-extended.test.ts` |
| `strategies/threshold.ts` | `threshold.test.ts` |

---

## Test File Details

| Test File | Imports from Source |
|-----------|---------------------|
| `tests/chunk.test.ts` | 1 files |
| `tests/ComputePool.test.ts` | 1 files |
| `operations/elementwise.test.ts` | 2 files |
| `operations/map-extended.test.ts` | 1 files |
| `operations/map.test.ts` | 1 files |
| `operations/matmul.test.ts` | 2 files |
| `operations/reduce.test.ts` | 1 files |
| `operations/threshold.test.ts` | 2 files |
| `tests/ParallelMatrix.test.ts` | 1 files |
| `strategies/chunk-extended.test.ts` | 1 files |
