# Remaining Integration Tasks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the integration of synced mathjs factories into the native MathTS architecture, wire the expression evaluator to activated factories, and prepare for release.

**Architecture:** Progressive factory activation via tiered dependency resolution. Each tier activates factories whose deps are met, injects results back into scope, unlocking the next tier.

**Tech Stack:** TypeScript 5.3+, Vitest, typed-function dispatch, MathJSDenseMatrix bridge

**Status as of 2026-04-03:** 96/231 factories active, expression compiler done, matrix bridge done.

---

## Remaining Sprint Tasks

### Sprint 3.10: Parallel benchmarks
- [x] Parallel operation benchmarks — DONE (parallel/tests/benchmark.test.ts)

### Sprint 3.11: FFT WASM acceleration
- [ ] FFT WASM acceleration — implement FFT in AssemblyScript with SIMD butterfly operations
- [ ] Parallel FFT for large arrays — threshold-based dispatch to workers

### Sprint 3.12: Eigendecomposition WASM
- [ ] WASM eig/svd — QR iteration and bidiagonalization in AssemblyScript
- [ ] Parallel divide-and-conquer eigensolve for large matrices

### Sprint 6.28: Release Preparation
- [ ] npm publishing setup — configure packages, CI publish workflow
- [ ] Bundle size optimization — tree-shaking, minification, code splitting
- [ ] Performance regression tests — benchmark suite for CI
- [ ] v1.0.0 release — changelog, tag, publish

---

## Integration Tasks

### Task 1: Resolve deep factory dependency chains (unlocks ~135 factories)

The remaining 135 factories need inter-factory dependencies resolved. The critical chain is:

```
equalScalar (done) → equal → compare → larger/smaller/etc
addScalar (done) → add (needs matrix overload wiring)
multiplyScalar (done) → multiply (needs matrix overload)
subtractScalar (done) → subtract (needs matrix overload)
```

- [ ] **Step 1: Activate `equal`, `unequal` with number/BigNumber/Complex/Fraction overloads**
  - These need `equalScalar` (done) + `DenseMatrix` (bridged) + `concat`
  - `concat` needs `isInteger` which needs... trace the full chain

- [ ] **Step 2: Activate `add`, `subtract`, `multiply` with matrix overloads**
  - These are the biggest unlocks — ~40 factories depend on them
  - They need the matrix algorithm suite (matAlgo01-14) from `functions/src/type/matrix/utils/`
  - Wire `createMatrixAlgorithmSuite` through the factory scope

- [ ] **Step 3: Cascade activation — keep activating tiers until no more unlock**
  - After add/subtract/multiply: `divide`, `pow`, `mod`, `gcd`, `lcm`
  - After those: `norm`, `inv`, `pinv`, `det` (full version), `eigs`
  - After those: `solve`, `lusolve`, `qr` (full), `lup` (full)

- [ ] **Step 4: Activate relational factories**
  - `compare`, `equal`, `larger`, `smaller`, `largerEq`, `smallerEq`, `unequal`, `compareText`

- [ ] **Step 5: Activate set/probability/statistics factories**
  - Sets: `setCartesian`, `setDifference`, `setDistinct`, `setIntersect`
  - Probability: `kldivergence`
  - Statistics: `corr`

- [ ] **Step 6: Update factory count and verify**
  ```bash
  npx vitest run functions/tests/
  npx turbo build --filter=@mathts/functions --force
  ```

### Task 2: Wire expression evaluator to factory scope

- [ ] **Step 1: Create `functions/src/factories/evaluate.ts`**
  Import `createEvaluate` from `@mathts/expression`, pass it the parse function and a math scope built from all activated factories.

- [ ] **Step 2: Export `evaluate` from functions package**
  ```typescript
  export { evaluate } from './factories/evaluate.js';
  ```

- [ ] **Step 3: Write tests**
  ```typescript
  evaluate('2 + 3')          // 5
  evaluate('sin(pi/2)')      // 1
  evaluate('sqrt(16)')       // 4
  evaluate('x^2', {x: 3})   // 9
  evaluate('det([[1,2],[3,4]])')  // -2
  ```

- [ ] **Step 4: Verify build and tests**

### Task 3: SparseMatrix bridge (real implementation)

- [ ] **Step 1: Implement `MathJSSparseMatrix`** with CSC storage
  - `_values`, `_index`, `_ptr`, `_size`, `_datatype`
  - `.storage()` → `'sparse'`
  - Interop with native `SparseMatrix` from `@mathts/matrix`

- [ ] **Step 2: Register in factory scope**

- [ ] **Step 3: Activate algebra factories that need sparse**
  - `csChol`, `csLu`, `csSymperm`, `slu`, etc.

### Task 4: Final verification

- [ ] `npx turbo build` — all 10 packages
- [ ] `npx turbo typecheck` — all 14 tasks
- [ ] `npx vitest run --exclude "tests/wasm/**"` — all tests pass
- [ ] Update CLAUDE.md with new factory count and integration status
- [ ] Update docs/Planning/PRIORITY_STATUS.md

---

## NOT in scope (deferred)

- Workbook ↔ expression integration (user deferred)
- Unit subsystem (2 factories, low priority)
- Scientific calculator / ISE Workbench / Deno notebook (feature plans)
- Rust WASM migration (separate track)
