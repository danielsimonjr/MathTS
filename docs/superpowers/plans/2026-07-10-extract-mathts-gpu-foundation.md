# Plan: Extract @danielsimonjr/mathts-gpu Foundation

**Spec:** `docs/superpowers/specs/2026-07-10-webgpu-acceleration-design.md` §Spec 1a

**Goal:** Extract the WebGPU foundation (GPUContext, BufferPool, ShaderManager, detect) from `matrix/src/backends/gpu/` into a new leaf package `@danielsimonjr/mathts-gpu`, rewire matrix to depend on it, and add back-compat re-export shims. This unblocks GPU acceleration across packages while remaining **headless-CI-verifiable, zero new GPU features, no new code**.

**Scope:** Pure refactor + breaking-change handling. No new functionality. No changes to functions. No GPU dispatch wiring. Proof: build + tests + CDG gate all pass headless.

**Why this slice first:** Extracts the API boundary and shared-device foundation that any GPU tier (matmul, functions, etc.) will depend on. Reduces risk for future specs: each layer can then wire independently without re-plumbing the foundation.

---

## Architecture (after this plan)

```
core ─┬─► matrix ──┐
      │   (devDep: @webgpu/types)   │
      │   (dep: @danielsimonjr/mathts-gpu)   │
      │                                ├─ exports { GPUContext, BufferPool, ... }
      │                                └─ GPUBackend uses gpu foundation + registers builtin WGSL
      │
      └─► [NEW] gpu (leaf)
            (devDep: @webgpu/types)
            exports { GPUContext, BufferPool, ShaderManager, detect }
            (no back-edge to matrix/functions/core)
```

CDG outcome: gpu is a true leaf. matrix→gpu, no back-edge. 0 new cycles.

---

## Tasks (8 total, sequential, all pure refactor)

### Task 1: Create gpu/ workspace package structure

- Create `gpu/` directory in monorepo root (sibling to matrix, functions, core, etc.)
- Create `gpu/package.json` (name: `@danielsimonjr/mathts-gpu`, version: `0.1.0`, main: `dist/index.js`, types: `dist/index.d.ts`, exports: `"."`, devDeps: `@webgpu/types`, scripts: `build`/`typecheck`/`lint`/`test` matching the standard)
- Create `gpu/tsconfig.json` (extends `../../tsconfig.base.json`, compilerOptions: `"typeRoots": ["../../node_modules/@types"]`, include: `["src/**/*.ts"]`)
- Create `gpu/src/` directory (empty, placeholder for extracted files)
- Create `gpu/README.md` (brief: WebGPU foundation library for MathTS; exported by matrix for back-compat; shared device, buffer pool, shader infrastructure)

**Verification:** `ls gpu/` shows package.json/tsconfig/src/README; `npm run build --filter=gpu` 0 errors (build fails because src is empty — expected; moving on).

---

### Task 2: Extract GPUContext, BufferPool, detect to gpu/src

- Copy (via git mv internally) `matrix/src/backends/gpu/GPUContext.ts` → `gpu/src/GPUContext.ts` (0 changes)
- Copy `matrix/src/backends/gpu/BufferPool.ts` → `gpu/src/BufferPool.ts` (0 changes)
- Copy `matrix/src/backends/gpu/detect.ts` → `gpu/src/detect.ts` (0 changes)
- Verify all three import only from `@webgpu/types` / Node.js builtins (no matrix/functions/core refs) — they do ✓

**Verification:** Each file compiles standalone (tsc --noEmit). No imports of other matrix backend files.

---

### Task 3: Split ShaderManager.ts

- Copy `matrix/src/backends/gpu/ShaderManager.ts` → `gpu/src/ShaderManager.ts`
- **In gpu/src/ShaderManager.ts:** delete lines 47–181 (the entire `BUILTIN_SHADERS` const definition, all matmul/transpose/reduce WGSL)
- **In gpu/src/ShaderManager.ts:** update the export comment to note "The BUILTIN_SHADERS for matrix operations are registered separately by matrix/src/backends/GPUBackend.ts"
- Create `matrix/src/backends/gpu/ShaderManager.builtin-wgsl.ts` (new file) that contains:
  - Export const `BUILTIN_SHADERS` (copy the 47–181 lines from the original)
  - Comment: "Matrix operation WGSL kernels, registered into a shared ShaderManager by GPUBackend.ts"
- Keep `matrix/src/backends/gpu/ShaderManager.ts` **in matrix**, importing from `'@danielsimonjr/mathts-gpu'` (read-only proxy, for back-compat if anyone imports from matrix's gpu/ directly; remove this file once matrix re-exports are in place)

**Verification:** gpu/src/ShaderManager.ts compiles (type-checks the shader registration signature without the builtin WGSL). matrix/src/backends/gpu/ShaderManager.builtin-wgsl.ts compiles.

---

### Task 4: Create gpu/src/index.ts (public API)

- Export `{ GPUContext, BufferPool, ShaderManager, detect }` from the extracted files
- No other exports (Sync/BatchExecutor stay in matrix, per YAGNI)
- Include a JSDoc header: "WebGPU foundation library for MathTS. Provides a shared GPU device, buffer pool, shader manager, and capability detection. Used internally by matrix and (future) function accelerators."

**Verification:** `tsc --noEmit gpu/src/index.ts` 0 errors.

---

### Task 5: Rewire matrix/src/backends/ imports to use gpu package

- In `matrix/src/backends/gpu/index.ts`: change imports from local paths to package import:
  - `import { GPUContext } from './GPUContext'` → `import { GPUContext } from '@danielsimonjr/mathts-gpu'`
  - `import { BufferPool } from './BufferPool'` → `import { BufferPool } from '@danielsimonjr/mathts-gpu'`
  - `import { ShaderManager } from './ShaderManager'` → `import { ShaderManager } from '@danielsimonjr/mathts-gpu'`
  - `import { detect } from './detect'` → `import { detect } from '@danielsimonjr/mathts-gpu'`
  - Keep the re-exports: `export { ... } from '@danielsimonjr/mathts-gpu'` (this is matrix's back-compat re-export)
- In `matrix/src/backends/GPUBackend.ts`: rewire the imports (same pattern)
- Verify `matrix/src/backends/gpu/index.ts` is now a simple re-export barrel: `export { ... } from '@danielsimonjr/mathts-gpu'` and nothing else
- Delete the old local files: `matrix/src/backends/gpu/{GPUContext,BufferPool,detect}.ts` (move operations preserve git history; the ShaderManager proxy stays for now)

**Verification:** `npm run build --filter=matrix` 0 errors, matrix's GPU re-exports still work.

---

### Task 6: Add back-compat re-exports to matrix/src/index.ts

- In `matrix/src/index.ts`, add:
  ```typescript
  // Re-export WebGPU foundation for back-compat (deprecated — use @danielsimonjr/mathts-gpu directly)
  export {
    GPUContext,
    BufferPool,
    ShaderManager,
    detect,
    getGlobalGPUContext,
    getGlobalGPUBackend,
    GPUCapabilities,
  } from '@danielsimonjr/mathts-gpu';
  ```
- This ensures existing code importing from `'@danielsimonjr/mathts-matrix'` continues to work (breaking-change mitigation)

**Verification:** `tsc --noEmit matrix/src/index.ts` 0 errors; the re-export chain resolves.

---

### Task 7: Add changesets

- Create `.changeset/gpu-initial.md`: scope `@danielsimonjr/mathts-gpu` (minor), brief: "WebGPU foundation library extracted from matrix (GPUContext, BufferPool, ShaderManager, detect). No new features; shared infrastructure for GPU acceleration tiers."
- Create `.changeset/matrix-gpu-extract.md`: scope `@danielsimonjr/mathts-matrix` (minor), brief: "Depend on new @danielsimonjr/mathts-gpu foundation library. Re-export GPU foundation for back-compat. No behavior change."
- Verify no mixed-changeset violations: `npx changeset status` shows gpu (new) + matrix (minor only) as the release set.

**Verification:** `npx changeset status` 0 errors, plan shows gpu 0.1.0 + matrix minor bump.

---

### Task 8: Full verification gate & commit

- `npm run build` (all 23 packages, must be 23/23)
- `npx turbo run typecheck` (30/30)
- `npx turbo run lint` (all packages 0 problems)
- `npm run docs:deps` (0 cycles, 0 new dormant, regen produces 0 diff)
- `npm run check:browser-safety` (22 browser-safe packages, 0 leaks)
- `git status --short` (only changesets + git-tracked moved files + prettier autofmt in Architecture)
- Commit atomically: `"refactor(gpu): extract WebGPU foundation from matrix into @danielsimonjr/mathts-gpu"` with standard footer
- Push to origin/main, verify L==R

**Verification:** All gates green; L==R at the commit hash.

---

## Risks & mitigations

| Risk                                        | Mitigation                                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import cycles on rewire                     | Task 5 scopes the rewire to local files only; CDG gate (Task 8) confirms 0 cycles.                                                                                     |
| Back-compat breakage for public imports     | Task 6 adds re-export shims; any code importing GPU from matrix continues to work.                                                                                     |
| ShaderManager split misses a use case       | ShaderManager is only used by GPUBackend + (future) GPU functions; both are accounted for. Review GPU imports repo-wide before commit (Grep confirms zero other uses). |
| GPU device lifetime issue (concurrent init) | Not fixed in this plan (that's Spec 1b hardening); this plan just moves files, doesn't change device logic.                                                            |
| TypeScript symbol resolution in gpu pkg     | gpu has @webgpu/types devDep; matrix keeps it for its own code; CDG typecheck gate confirms.                                                                           |

---

## Files touched summary

**Created:**

- gpu/ (directory + package.json, tsconfig.json, src/, README.md)
- gpu/src/GPUContext.ts, BufferPool.ts, detect.ts, ShaderManager.ts, index.ts
- matrix/src/backends/gpu/ShaderManager.builtin-wgsl.ts
- .changeset/gpu-initial.md, .changeset/matrix-gpu-extract.md

**Modified:**

- matrix/src/backends/gpu/index.ts (rewire imports + re-export)
- matrix/src/backends/GPUBackend.ts (rewire imports)
- matrix/src/index.ts (add re-export shims)

**Deleted:**

- matrix/src/backends/gpu/GPUContext.ts, BufferPool.ts, detect.ts (moved to gpu/)
- matrix/src/backends/gpu/ShaderManager.ts (split: generic → gpu/src/, builtin WGSL → matrix)

**Build artifacts:**

- docs/Architecture/\* (regen, expected Prettier change)

---

## Implementation strategy

This is a **pure refactor with no new features**, so it's:

1. **TDD:** No tests fail; existing tests continue to pass (matrix build/typecheck/tests 0 new failures).
2. **One implementer:** Tasks 1–8 form a single atomic refactor (no independent parallelism).
3. **Single review + final opus:** Implementer's work is reviewed once (all tasks together), then final opus review of the entire refactor.
4. **Changeset + push:** After review approval, implement the changeset merge and `changeset version` bump (plot@0.2.0 was 0.1.0+minor in prior session; gpu is new 0.1.0, matrix bumps minor).

All gates (build/typecheck/lint/CDG/browser-safety) must be green before commit.
