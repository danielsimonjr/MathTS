# Test Coverage Analysis

**Generated**: 2026-02-06

## Summary

| Metric | Count |
|--------|-------|
| Total Source Files | 14 |
| Total Test Files | 5 |
| Source Files with Tests | 5 |
| Source Files without Tests | 9 |
| Coverage | 35.7% |

---

## Source Files Without Test Coverage

The following 9 source files are not directly imported by any test file:

### root/

- `src/ParallelMatrix.ts` → Expected test: `tests/unit/root/ParallelMatrix.test.ts`
- `src/WorkerPool.ts` → Expected test: `tests/unit/root/WorkerPool.test.ts`
- `src/index.ts` → Expected test: `tests/unit/root/index.test.ts`
- `src/matrix.worker.ts` → Expected test: `tests/unit/root/matrix.worker.test.ts`

### operations/

- `src/operations/index.ts` → Expected test: `tests/unit/operations/index.test.ts`
- `src/operations/map.ts` → Expected test: `tests/unit/operations/map.test.ts`
- `src/operations/reduce.ts` → Expected test: `tests/unit/operations/reduce.test.ts`

### strategies/

- `src/strategies/index.ts` → Expected test: `tests/unit/strategies/index.test.ts`

### workers/

- `src/workers/compute.worker.ts` → Expected test: `tests/unit/workers/compute.worker.test.ts`

---

## Source Files With Test Coverage

| Source File | Test Files |
|-------------|------------|
| `src/ComputePool.ts` | `ComputePool.test.ts`, `elementwise.test.ts`, `matmul.test.ts`, `threshold.test.ts` |
| `operations/elementwise.ts` | `elementwise.test.ts` |
| `operations/matmul.ts` | `matmul.test.ts` |
| `strategies/chunk.ts` | `chunk.test.ts` |
| `strategies/threshold.ts` | `threshold.test.ts` |

---

## Test File Details

| Test File | Imports from Source |
|-----------|---------------------|
| `tests/chunk.test.ts` | 1 files |
| `tests/ComputePool.test.ts` | 1 files |
| `operations/elementwise.test.ts` | 2 files |
| `operations/matmul.test.ts` | 2 files |
| `operations/threshold.test.ts` | 2 files |
