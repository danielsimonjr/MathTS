# MathTS Sprint Tracker

## Current Status: Phase 1 - Core Foundation

### Prerequisites (COMPLETE ✅)

- [x] typed-function-ts converted to TypeScript (98% test coverage, 1137 tests)
- [x] workerpool-ts with WASM queue implementations
- [x] AssemblyScript infrastructure proven (24.5x queue performance)

---

## Completed Sprints

### Sprint 0: AssemblyScript WASM Backend

**Status**: COMPLETE ✅  
**Completed**: April 2026  
**Commits**: `e88cd9460` – `55dea0d71`

| #   | Task                                                          | Status | Notes                             |
| --- | ------------------------------------------------------------ | ------ | --------------------------------- |
| 0.1 | Set up `assembly/` AssemblyScript workspace                  | ✅     | AssemblyScript modules            |
| 0.2 | Author 63 WASM modules in AssemblyScript                     | ✅     | 63 modules, ~18,500 lines         |
| 0.3 | Expose 826 exports via AssemblyScript bindings               | ✅     | `lib/wasm/mathjs.wasm` — 669 KB   |
| 0.4 | Implement JS↔WASM bridge in `assembly/src/bindings/`         | ✅     |                                   |
| 0.5 | Write WASM-vs-JS benchmark                                   | ✅     | `test/benchmark/wasm.bench.ts`    |
| 0.6 | Update `backendManager` to prefer WASM                       | ✅     | Fallback chain: WASM → JS         |
| 0.7 | Add `npm run build:wasm` and `npm run bench:wasm` scripts    | ✅     |                                   |
| 0.8 | Resolve all 166→0 test failures                             | ✅     | Mocha + Vitest: 0 failures        |

**Key results**:

- 826 exported functions across algebra, arithmetic, matrix, signal, statistics, trigonometry
- Binary: `lib/wasm/mathjs.wasm` — 669 KB (release build)
- Performance: 2–55x faster than JS fallback (operation-dependent)

**Selected benchmark results** (WASM vs JS):

| Operation                 | JS     | WASM    | Speedup   |
| ------------------------- | ------ | ------- | --------- |
| Matrix multiply 200×200   | 20ms   | 2.7ms   | **7.4x**  |
| Dot product 1000 elements | 0.05ms | 0.002ms | **27.6x** |
| Determinant 100×100       | 1.5ms  | 0.2ms   | **6.9x**  |

---

## Phase 1: Core Foundation (Weeks 1-4)

### Sprint 1: Project Setup & Core Types

**Status**: 🟡 Ready to Start  
**Target**: Week 1

| #   | Task                                     | Status | Est. Hours | Notes                          |
| --- | ---------------------------------------- | ------ | ---------- | ------------------------------ |
| 1.1 | Initialize monorepo with pnpm workspaces | ⬜     | 2          | `pnpm-workspace.yaml`          |
| 1.2 | Configure TypeScript, Vitest, ESLint     | ⬜     | 2          | Strict mode                    |
| 1.3 | Link typed-function-ts package           | ⬜     | 1          | npm workspace                  |
| 1.4 | Link workerpool-ts package               | ⬜     | 1          | npm workspace                  |
| 1.5 | Create core package structure            | ⬜     | 2          | `packages/core/`               |
| 1.6 | Implement base interfaces                | ⬜     | 4          | MathTSValue, Scalar, IMatrix   |
| 1.7 | Implement number type                    | ⬜     | 2          | Wrapper with typed integration |
| 1.8 | Write core type tests                    | ⬜     | 4          | Vitest                         |

**Sprint 1 Commands**:

```bash
# Initialize
mkdir mathts && cd mathts
pnpm init
pnpm add -D typescript vitest @vitest/coverage-v8 eslint

# Link existing packages
pnpm add @danielsimonjr/mathts-typed-function@github:danielsimonjr/typed-function#develop
pnpm add @danielsimonjr/mathts-workerpool@github:danielsimonjr/workerpool#master
```

---

### Sprint 2: Complex & Fraction Types

**Status**: ⬜ Blocked by Sprint 1  
**Target**: Week 2

| #   | Task                               | Status | Est. Hours | Notes               |
| --- | ---------------------------------- | ------ | ---------- | ------------------- |
| 2.1 | Implement Complex class            | ⬜     | 6          | re, im, arithmetic  |
| 2.2 | Complex arithmetic operations      | ⬜     | 4          | add, sub, mul, div  |
| 2.3 | Complex transcendental functions   | ⬜     | 4          | exp, log, sqrt, pow |
| 2.4 | Implement Fraction class           | ⬜     | 4          | Exact rational      |
| 2.5 | Fraction arithmetic with GCD       | ⬜     | 3          | Reduce fractions    |
| 2.6 | BigNumber integration (decimal.js) | ⬜     | 3          | Wrapper class       |
| 2.7 | Write comprehensive tests          | ⬜     | 6          | Edge cases          |

---

### Sprint 3: typed-function Integration

**Status**: ⬜ Blocked by Sprint 2  
**Target**: Week 3

| #   | Task                         | Status | Est. Hours | Notes                    |
| --- | ---------------------------- | ------ | ---------- | ------------------------ |
| 3.1 | Create MathTS typed instance | ⬜     | 4          | Configure typed-function |
| 3.2 | Register core types          | ⬜     | 4          | Type definitions         |
| 3.3 | Define type conversions      | ⬜     | 4          | number↔Complex, etc.     |
| 3.4 | Implement factory pattern    | ⬜     | 6          | Function creation        |
| 3.5 | Dependency injection system  | ⬜     | 4          | For function deps        |
| 3.6 | Test typed dispatch          | ⬜     | 6          | All type combinations    |

---

### Sprint 4: Basic Matrix Implementation

**Status**: ⬜ Blocked by Sprint 3  
**Target**: Week 4

| #   | Task                        | Status | Est. Hours | Notes                    |
| --- | --------------------------- | ------ | ---------- | ------------------------ |
| 4.1 | Create matrix package       | ⬜     | 2          | Package structure        |
| 4.2 | Implement Matrix base class | ⬜     | 4          | Abstract interface       |
| 4.3 | Implement DenseMatrix       | ⬜     | 8          | Row-major storage        |
| 4.4 | Matrix indexing and slicing | ⬜     | 4          | Views (no copy)          |
| 4.5 | Implement JSBackend         | ⬜     | 6          | Pure TypeScript ops      |
| 4.6 | Basic operations            | ⬜     | 6          | add, multiply, transpose |
| 4.7 | Matrix tests                | ⬜     | 6          | Comprehensive            |

---

## Quick Reference: Key Files to Create

### Sprint 1 Files

```
mathts/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.js
└── packages/
    └── core/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            └── types/
                ├── interfaces.ts
                ├── number.ts
                └── index.ts
```

### Sprint 2 Files

```
packages/core/src/types/
├── complex.ts
├── fraction.ts
└── bignumber.ts
```

### Sprint 3 Files

```
packages/core/src/
├── typed/
│   ├── mathts-typed.ts
│   └── type-definitions.ts
└── factory/
    ├── factory.ts
    └── dependencies.ts
```

### Sprint 4 Files

```
packages/matrix/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types/
    │   ├── Matrix.ts
    │   └── DenseMatrix.ts
    └── backends/
        ├── Backend.ts
        ├── JSBackend.ts
        └── index.ts
```

---

## Phase 2-6 Overview

| Phase | Weeks | Focus              | Key Deliverables              |
| ----- | ----- | ------------------ | ----------------------------- |
| 2     | 5-8   | WASM Acceleration  | AssemblyScript matmul, LU, QR |
| 3     | 9-12  | Parallel Execution | ComputePool, parallel ops     |
| 4     | 13-16 | WebGPU             | Compute shaders, GPU backend  |
| 5     | 17-24 | Function Library   | 80%+ mathjs functions         |
| 6     | 25-28 | Integration        | Main package, docs, release   |

---

## Metrics to Track

| Metric                 | Current | Phase 1 Target | Final Target  |
| ---------------------- | ------- | -------------- | ------------- |
| Test Coverage          | N/A     | 80%            | 95%           |
| Bundle Size (core)     | N/A     | <20KB          | <15KB         |
| matmul 1000x1000 (JS)  | N/A     | <2s            | <150ms (WASM) |
| Type-checked functions | 0       | 50             | 200+          |

---

## Notes

- Start with `pnpm` for workspace management
- Use `vitest` for testing (faster than Jest)
- AssemblyScript for WASM (reuse patterns from workerpool)
- Keep bundles tree-shakeable from day 1
