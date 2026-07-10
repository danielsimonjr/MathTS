# WebGPU Spec 1a — Extract `@danielsimonjr/mathts-gpu` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the WebGPU foundation out of `matrix/src/backends/gpu/` into a new shared, publishable `@danielsimonjr/mathts-gpu` leaf package, rewire matrix onto it with its public surface preserved, and harden the shared GPU device — a pure refactor with the whole repo green in headless CI (no GPU execution).

**Architecture:** A new leaf package `gpu` holds the generic, domain-free foundation — `detect` (capability probing), `GPUContext` (device/adapter lifecycle, now with a never-throw single-flight `initialize`), `BufferPool`, a **generic** `ShaderManager` (compile/cache/pipeline + a shader **registration** API, but _zero_ built-in kernels), and a shared `getGpuDevice()` singleton. Matrix depends on `gpu`, keeps its matmul/transpose/reduce WGSL strings (`BUILTIN_SHADERS`) locally and registers them onto a `ShaderManager` at `GPUBackend` init, and re-exports the foundation symbols from its own index so no downstream consumer breaks. `BatchExecutor`/`Sync` stay in matrix (YAGNI — unused by matmul).

**Tech Stack:** TypeScript (strict), ESM (`.js` import specifiers), tsup (`--dts`), vitest (node environment, headless), `@webgpu/types`, Turborepo, Changesets, npm workspaces.

## Global Constraints

- **Strict TypeScript, zero relaxations.** `gpu/tsconfig.json` extends `../tsconfig.base.json` and does NOT override `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, or `noFallthroughCasesInSwitch` (all inherit `true`). Mirror `matrix/tsconfig.json`, not `numbers/tsconfig.json`.
- **ESLint-zero, honestly.** `eslint .` reports **0 problems** (warnings included). No `any` (rule is `warn`, but the repo bar is zero problems), no `@ts-nocheck`, no blanket disables. New code must be as clean as the moved code.
- **Import extensions are `.js`** in every `gpu/src` and `matrix/src` file (ESM bundler resolution). Match the existing matrix style — NOT tensor's bare style.
- **`gpu` ships ZERO domain kernels.** No `BUILTIN_SHADERS`, no matmul/transpose/reduce WGSL, no matrix-specific pipeline names anywhere under `gpu/src/`. The generic `ShaderManager` exposes only a name→code registration API.
- **matrix public surface is preserved.** Every symbol matrix currently re-exports through `matrix/src/backends/index.ts` (which does `export ... from './gpu/index.js'`) must still resolve after the refactor. Back-compat is non-negotiable.
- **0 dependency-graph cycles, 0 new dormant files.** `npm run docs:deps` must show a `matrix → gpu` edge, no back-edge, no cycle, and no newly-orphaned file. `gpu/src/*` must all be reachable from `gpu/src/index.ts`.
- **Never-throw shared device.** `getGpuDevice()` returns `Promise<GPUDevice | null>` and never rejects; `GPUContext.initialize()` never throws (concurrent callers await one in-flight promise; unsupported environment resolves `false`).
- **Conventional Commits**, one atomic commit per task. Commit message footer, verbatim:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
  Use a HEREDOC for the message. Give `git commit` a generous timeout (~540000 ms) — the pre-commit hook runs eslint + prettier.
- **Verify each push L==R.** After `git push origin main`, confirm `git rev-parse HEAD` equals `git ls-remote origin -h refs/heads/main`.
- **`main` is protected.** Never amend/force-push a pushed commit. A bad commit gets a NEW follow-up commit.
- **Out of scope for ALL tasks:** the `enableGpu()` flag, any `*GpuDispatch`, any `functions/` change, any new kernel, any GPU execution. This is a pure refactor.

---

## File Structure

**New package `gpu/` (leaf):**
| File | Responsibility |
|---|---|
| `gpu/package.json` | Package manifest — `@danielsimonjr/mathts-gpu`, version `0.1.0`, ESM, tsup `--dts` build, `@webgpu/types` devDep. |
| `gpu/tsconfig.json` | Extends base; `types: ["@webgpu/types","node"]`; includes `src/**`, excludes `tests`. |
| `gpu/vitest.config.ts` | node environment, `tests/**/*.test.ts`. |
| `gpu/README.md` | One-paragraph description + CDG nickname note. |
| `gpu/src/detect.ts` | WebGPU capability probing (moved verbatim from matrix). |
| `gpu/src/GPUContext.ts` | Device/adapter lifecycle; **hardened** never-throw single-flight `initialize`. |
| `gpu/src/BufferPool.ts` | GPU buffer recycling (moved verbatim). |
| `gpu/src/ShaderManager.ts` | **Generic** compile/cache/pipeline infra + name→code registration API. NO builtins. |
| `gpu/src/device.ts` | Shared `getGpuDevice()` / `resetGpuDevice()` single-flight singleton. |
| `gpu/src/index.ts` | Barrel — re-exports the whole foundation surface. |
| `gpu/tests/*.test.ts` | Headless unit tests (detect / context / device / shader-manager / bufferpool). |

**Matrix changes:**
| File | Change |
|---|---|
| `matrix/src/backends/gpu/detect.ts` | **Delete** (moved to gpu). |
| `matrix/src/backends/gpu/GPUContext.ts` | **Delete** (moved to gpu). |
| `matrix/src/backends/gpu/BufferPool.ts` | **Delete** (moved to gpu). |
| `matrix/src/backends/gpu/ShaderManager.ts` | **Delete** (generic half moved to gpu; builtins → `builtin-shaders.ts`). |
| `matrix/src/backends/gpu/builtin-shaders.ts` | **Create** — `BUILTIN_SHADERS` + `registerBuiltinShaders(sm)`. |
| `matrix/src/backends/gpu/index.ts` | **Rewrite** — re-export foundation from the gpu package + local builtins/BatchExecutor/Sync. |
| `matrix/src/backends/gpu/BatchExecutor.ts` | Retarget type imports to the package; `getBuiltinPipeline` → `getRegisteredPipeline`. |
| `matrix/src/backends/gpu/Sync.ts` | Retarget type imports to the package. |
| `matrix/src/backends/GPUBackend.ts` | Import foundation from the package; register builtins at init; `getBuiltinPipeline` → `getRegisteredPipeline`. |
| `matrix/src/backends/GPUMatrixBackend.ts` | Import `hasWebGPU`/`detectGPUCapabilities`/`GPUCapabilities` from the package. |
| `matrix/tests/gpu/{initialization,integration,operations}.test.ts` | Retarget deleted-file imports to the package / `builtin-shaders.js`. |
| `matrix/package.json` | Add `"@danielsimonjr/mathts-gpu": "^0.1.0"` dependency. |

**Repo wiring:** root `package.json` workspaces `+= "gpu"`; `.changeset/webgpu-spec1a-extract-gpu.md`; regenerated `docs/Architecture/*`; `CLAUDE.md`, `README.md`, `ROADMAP.md`, `CHANGELOG.md`, `TODO.md`.

---

## Task 1: Scaffold the `gpu` package and move `detect.ts`

**Files:**

- Create: `gpu/package.json`, `gpu/tsconfig.json`, `gpu/vitest.config.ts`, `gpu/README.md`, `gpu/src/index.ts`, `gpu/src/detect.ts`
- Modify: root `package.json` (workspaces array)
- Delete (git): none yet (matrix keeps its `detect.ts` until Task 4)
- Test: `gpu/tests/detect.test.ts`

**Interfaces:**

- Produces: package `@danielsimonjr/mathts-gpu`; `detect.ts` exports `hasWebGPU()`, `isBrowser()`, `getGPUAdapter(options?)`, `detectGPUCapabilities(preferHighPerformance?)`, `isGPUSuitableForMatrixOps(caps, minBufferSize?)`, `getRecommendedWorkgroupSize(caps)`, `getMaxMatrixSize(caps, bytesPerElement?)`, and types `GPUAdapterInfo`, `GPUCapabilities`. `gpu/src/index.ts` re-exports all of them.

- [ ] **Step 1: Add `gpu` to the root workspaces.** Edit root `package.json` — in the `"workspaces"` array, add `"gpu"` immediately after `"compat"` (before `"plot"`):

```json
    "assembly",
    "compat",
    "gpu",
    "plot"
```

- [ ] **Step 2: Create `gpu/package.json`.**

```json
{
  "name": "@danielsimonjr/mathts-gpu",
  "version": "0.1.0",
  "description": "Shared WebGPU foundation for MathTS — device/context lifecycle, buffer pool, and a generic shader manager (no domain kernels)",
  "author": "Daniel Simon Jr.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "clean": "rm -rf dist",
    "build:prod": "tsup src/index.ts --format esm --dts --clean --minify --treeshake"
  },
  "devDependencies": {
    "@types/node": "^25.5.2",
    "@webgpu/types": "^0.1.67",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^4.1.5"
  },
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/danielsimonjr/mathts",
    "directory": "gpu"
  },
  "keywords": ["math", "webgpu", "gpu", "typescript", "compute"]
}
```

- [ ] **Step 3: Create `gpu/tsconfig.json`** (mirrors matrix; strict inherited from base):

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["@webgpu/types", "node"],
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "../node_modules/**"]
}
```

- [ ] **Step 4: Create `gpu/vitest.config.ts`:**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create `gpu/README.md`:**

```markdown
# @danielsimonjr/mathts-gpu

The shared WebGPU foundation for MathTS: `GPUContext` (device/adapter
lifecycle), a shared `getGpuDevice()` singleton, `BufferPool`, `detect`
(capability probing), and a **generic** `ShaderManager` (compile/cache/pipeline
infra + a name→code shader registration API). This package ships **no domain
kernels** — matrix-specific WGSL (matmul/transpose/reduce) lives in
`@danielsimonjr/mathts-matrix`, which registers those shaders onto a
`ShaderManager` at backend init.

WebGPU is browser-only (`navigator.gpu`); in Node every entry point degrades
gracefully — `getGpuDevice()` resolves to `null` and `GPUContext.initialize()`
resolves `false` without throwing.

Tracked by CDG/DGT (`create-dependency-graph`) as a leaf: `matrix → gpu`,
`functions → gpu` (functions edge lands in a later spec), with no back-edge.
```

- [ ] **Step 6: Move `detect.ts` into the package.** Copy `matrix/src/backends/gpu/detect.ts` to `gpu/src/detect.ts` **verbatim** (it has no relative imports, so nothing to rewrite). Do NOT delete the matrix copy yet — matrix still imports it until Task 4.

- [ ] **Step 7: Create `gpu/src/index.ts`** (barrel — detect only for now):

```ts
/**
 * @danielsimonjr/mathts-gpu — shared WebGPU foundation for MathTS.
 * @packageDocumentation
 */

export {
  hasWebGPU,
  isBrowser,
  getGPUAdapter,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
  type GPUAdapterInfo,
  type GPUCapabilities,
} from './detect.js';
```

- [ ] **Step 8: Install so the workspace links.** Run: `npm install`
      Expected: completes; `node_modules/@danielsimonjr/mathts-gpu` symlinks to `gpu/`.

- [ ] **Step 9: Write the failing test** — `gpu/tests/detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  hasWebGPU,
  isBrowser,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
  type GPUCapabilities,
} from '../src/detect.js';

const NO_CAPS: GPUCapabilities = {
  supported: false,
  adapterInfo: null,
  maxBufferSize: 0,
  maxWorkgroupSize: [0, 0, 0],
  maxStorageBufferBindingSize: 0,
  maxComputeInvocationsPerWorkgroup: 0,
  maxComputeWorkgroupsPerDimension: 0,
  isFallbackAdapter: false,
  features: [],
};

describe('detect (headless Node)', () => {
  it('reports no WebGPU and no browser', () => {
    expect(hasWebGPU()).toBe(false);
    expect(isBrowser()).toBe(false);
  });

  it('detectGPUCapabilities resolves unsupported without throwing', async () => {
    const caps = await detectGPUCapabilities();
    expect(caps.supported).toBe(false);
  });

  it('isGPUSuitableForMatrixOps is false for unsupported caps', () => {
    expect(isGPUSuitableForMatrixOps(NO_CAPS)).toBe(false);
  });

  it('getRecommendedWorkgroupSize returns [1,1,1] for unsupported caps', () => {
    expect(getRecommendedWorkgroupSize(NO_CAPS)).toEqual([1, 1, 1]);
  });

  it('getMaxMatrixSize returns 0 for unsupported caps', () => {
    expect(getMaxMatrixSize(NO_CAPS)).toBe(0);
  });
});
```

- [ ] **Step 10: Run the test to verify it passes (the code is already moved).**
      Run: `cd gpu && npx vitest run tests/detect.test.ts`
      Expected: 5 passed. (If the file didn't resolve, that's the RED signal — fix the move/barrel, then re-run to GREEN.)

- [ ] **Step 11: Build + typecheck + lint the new package.**
      Run: `cd gpu && npx tsup src/index.ts --format esm --dts --clean && npx tsc --noEmit && npx eslint src --ext .ts`
      Expected: dist emitted (`dist/index.js` + `dist/index.d.ts`); tsc 0 errors; eslint 0 problems.

- [ ] **Step 12: Commit.**

```bash
git add gpu/package.json gpu/tsconfig.json gpu/vitest.config.ts gpu/README.md \
        gpu/src/index.ts gpu/src/detect.ts gpu/tests/detect.test.ts \
        package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(gpu): scaffold @danielsimonjr/mathts-gpu leaf + move detect

First slice of WebGPU Spec 1a: create the shared GPU foundation package
(ESM, tsup --dts, @webgpu/types) and move the WebGPU capability-detection
module (detect.ts) into it verbatim. Headless tests confirm the Node
degradation path (no navigator.gpu → unsupported, no throw). Matrix still
carries its own copy until the rewire task; nothing in matrix changes yet.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

---

## Task 2: Add hardened `GPUContext` and the shared `getGpuDevice()` singleton

**Files:**

- Create: `gpu/src/GPUContext.ts` (moved + hardened), `gpu/src/device.ts`
- Modify: `gpu/src/index.ts` (add GPUContext + device exports)
- Test: `gpu/tests/context.test.ts`, `gpu/tests/device.test.ts`

**Interfaces:**

- Consumes: `./detect.js` (`hasWebGPU`, `getGPUAdapter`, `detectGPUCapabilities`, `type GPUCapabilities`).
- Produces:
  - `GPUContext` class with `getDevice(): GPUDevice` (throws if uninitialized), `async initialize(options?): Promise<boolean>` (**never throws**; concurrent callers share one in-flight promise; unsupported → `false`), plus the existing `status`/`isReady`/`capabilities`/`createBuffer`/`createComputePipeline`/`createBindGroup`/`readBuffer`/`dispatchCompute`/`destroy` surface.
  - `getGlobalGPUContext(): GPUContext`, `initializeGlobalGPU(options?)`, `destroyGlobalGPU()`.
  - Types `GPUContextOptions`, `GPUContextStatus`, `DeviceLostEvent`.
  - `device.ts`: `getGpuDevice(options?: GPUContextOptions): Promise<GPUDevice | null>` (single-flight, never throws), `resetGpuDevice(): void`.

- [ ] **Step 1: Move `GPUContext.ts` verbatim.** Copy `matrix/src/backends/gpu/GPUContext.ts` to `gpu/src/GPUContext.ts`. Its import `from './detect.js'` already resolves inside the package. Do NOT delete the matrix copy.

- [ ] **Step 2: Harden `initialize` in `gpu/src/GPUContext.ts`.** Add a private field and replace the whole `async initialize(...)` method (currently `GPUContext.ts:100-170`) with a single-flight wrapper delegating to a new `_doInitialize`. First add the field beside the other private fields (after `private label: string;`):

```ts
  private _initPromise: Promise<boolean> | null = null;
```

Then replace the existing `initialize` method with:

```ts
  /**
   * Initialize the GPU context.
   *
   * Never throws: concurrent callers await the same in-flight promise, and an
   * unsupported environment / missing adapter resolves to `false`.
   */
  async initialize(options: GPUContextOptions = {}): Promise<boolean> {
    if (this._status === 'ready') {
      return true;
    }
    if (this._initPromise) {
      return this._initPromise;
    }
    this._initPromise = this._doInitialize(options);
    try {
      return await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  private async _doInitialize(options: GPUContextOptions): Promise<boolean> {
    this._status = 'initializing';

    try {
      // Check WebGPU support
      if (!hasWebGPU()) {
        throw new Error('WebGPU is not supported in this environment');
      }

      // Detect capabilities
      this._capabilities = await detectGPUCapabilities(options.preferHighPerformance ?? true);

      if (!this._capabilities.supported) {
        throw new Error('WebGPU adapter not available');
      }

      // Get adapter
      this.adapter = await getGPUAdapter({
        powerPreference: options.preferHighPerformance ? 'high-performance' : 'low-power',
      });

      if (!this.adapter) {
        throw new Error('Failed to get GPU adapter');
      }

      // Request device with required features and limits
      const deviceDescriptor: GPUDeviceDescriptor = {
        label: this.label,
        requiredFeatures: options.requiredFeatures || [],
        requiredLimits: options.requiredLimits || {},
      };

      this.device = await this.adapter.requestDevice(deviceDescriptor);

      if (!this.device) {
        throw new Error('Failed to get GPU device');
      }

      // Setup device lost handler
      this.device.lost.then((info) => {
        this._status = 'lost';
        const event: DeviceLostEvent = {
          reason: info.reason,
          message: info.message,
        };
        this.deviceLostCallbacks.forEach((cb) => cb(event));
      });

      // Setup error handler
      this.device.onuncapturederror = (event: GPUUncapturedErrorEvent) => {
        console.error('GPU uncaptured error:', event.error);
        this._lastError = new Error(`GPU Error: ${event.error.message}`);
      };

      this._status = 'ready';
      return true;
    } catch (error) {
      this._status = 'error';
      this._lastError = error as Error;
      return false;
    }
  }
```

The old `throw new Error('Already initializing')` branch is intentionally gone — concurrency is handled by `_initPromise`. Everything else in the file (all the `create*`/`readBuffer`/`dispatchCompute`/`destroy` methods and the global helpers) stays unchanged.

- [ ] **Step 3: Create `gpu/src/device.ts`:**

```ts
/**
 * Shared GPU device singleton.
 *
 * All library consumers (matrix, and later functions) share ONE GPU device.
 * Concurrent first-callers coalesce onto a single in-flight initialization
 * promise; the result is cached. Never throws — an unavailable device
 * (no adapter, unsupported environment, init failure) resolves to `null`.
 */

import { getGlobalGPUContext, type GPUContextOptions } from './GPUContext.js';

let inFlightDevice: Promise<GPUDevice | null> | null = null;

/**
 * Get the shared GPU device, or `null` if unavailable. Coalesces concurrent
 * calls onto one in-flight promise and caches the result. Never rejects.
 */
export function getGpuDevice(options?: GPUContextOptions): Promise<GPUDevice | null> {
  if (inFlightDevice) {
    return inFlightDevice;
  }
  inFlightDevice = (async () => {
    const ctx = getGlobalGPUContext();
    try {
      const ok = await ctx.initialize(options);
      return ok ? ctx.getDevice() : null;
    } catch {
      return null;
    }
  })();
  return inFlightDevice;
}

/**
 * Clear the cached device promise so the next `getGpuDevice()` re-initializes.
 * Use after a device-lost event, or between tests.
 */
export function resetGpuDevice(): void {
  inFlightDevice = null;
}
```

- [ ] **Step 4: Extend the barrel `gpu/src/index.ts`.** Add, after the `detect.js` re-export block:

```ts
export {
  GPUContext,
  getGlobalGPUContext,
  initializeGlobalGPU,
  destroyGlobalGPU,
  type GPUContextOptions,
  type GPUContextStatus,
  type DeviceLostEvent,
} from './GPUContext.js';

export { getGpuDevice, resetGpuDevice } from './device.js';
```

- [ ] **Step 5: Write the failing tests** — `gpu/tests/context.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GPUContext, getGlobalGPUContext } from '../src/GPUContext.js';

describe('GPUContext (headless Node)', () => {
  it('getDevice throws before initialization', () => {
    const ctx = new GPUContext();
    expect(() => ctx.getDevice()).toThrow(/not initialized/);
  });

  it('initialize resolves false in Node without throwing', async () => {
    const ctx = new GPUContext();
    await expect(ctx.initialize()).resolves.toBe(false);
  });

  it('concurrent initialize calls share one result and never throw', async () => {
    const ctx = new GPUContext();
    const [a, b] = await Promise.all([ctx.initialize(), ctx.initialize()]);
    expect(a).toBe(false);
    expect(b).toBe(false);
  });

  it('getGlobalGPUContext returns a stable singleton', () => {
    expect(getGlobalGPUContext()).toBe(getGlobalGPUContext());
  });
});
```

And `gpu/tests/device.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { getGpuDevice, resetGpuDevice } from '../src/device.js';

describe('getGpuDevice (headless Node)', () => {
  afterEach(() => resetGpuDevice());

  it('resolves to null without throwing when no GPU is present', async () => {
    await expect(getGpuDevice()).resolves.toBeNull();
  });

  it('coalesces concurrent calls onto one in-flight promise', () => {
    const p1 = getGpuDevice();
    const p2 = getGpuDevice();
    expect(p1).toBe(p2);
  });

  it('resetGpuDevice clears the cached promise', async () => {
    const p1 = getGpuDevice();
    await p1;
    resetGpuDevice();
    const p2 = getGpuDevice();
    expect(p2).not.toBe(p1);
  });
});
```

- [ ] **Step 6: Run the tests.**
      Run: `cd gpu && npx vitest run tests/context.test.ts tests/device.test.ts`
      Expected: all passed (context 4, device 3). The concurrency assertion `p1 === p2` proves single-flight; a throw on concurrent `initialize` would fail the third context test.

- [ ] **Step 7: Build + typecheck + lint.**
      Run: `cd gpu && npx tsup src/index.ts --format esm --dts --clean && npx tsc --noEmit && npx eslint src --ext .ts`
      Expected: dist emitted; tsc 0 errors; eslint 0 problems.

- [ ] **Step 8: Commit.**

```bash
git add gpu/src/GPUContext.ts gpu/src/device.ts gpu/src/index.ts \
        gpu/tests/context.test.ts gpu/tests/device.test.ts
git commit -m "$(cat <<'EOF'
feat(gpu): hardened GPUContext + shared getGpuDevice singleton

Move GPUContext into the gpu package and harden initialize(): concurrent
callers now await one in-flight promise instead of throwing 'Already
initializing', and an unsupported environment resolves false — never throws.
Add getGpuDevice()/resetGpuDevice(): the single, shared, never-throw device
singleton matrix and functions will both consume. Headless tests cover the
Node null path and the single-flight coalescing.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

---

## Task 3: Add `BufferPool` and the generic `ShaderManager` (registration API, no builtins)

**Files:**

- Create: `gpu/src/BufferPool.ts` (moved verbatim), `gpu/src/ShaderManager.ts` (generic + registration)
- Modify: `gpu/src/index.ts` (add BufferPool + ShaderManager exports)
- Test: `gpu/tests/bufferpool.test.ts`, `gpu/tests/shader-manager.test.ts`

**Interfaces:**

- Consumes: `./GPUContext.js` (`GPUContext` type).
- Produces:
  - `BufferPool` class + type `BufferPoolOptions` (existing API: `acquire`, `acquireStorageBuffer`, `acquireUniformBuffer`, `release`, `getStats`, `destroy`, …).
  - `ShaderManager` class + types `ShaderSource`, `PipelineConfig`. Generic methods `getShaderModule(name, code)`, `getPipeline(shaderName, entryPoint, code?, layout?)`, `clearCache()`, `getStats()`, **plus** the registration API: `registerShader(name: string, code: string): void`, `hasRegisteredShader(name: string): boolean`, `getRegisteredShaderSource(name: string): string` (throws on unknown), `getRegisteredShaderModule(name: string): GPUShaderModule`, `getRegisteredPipeline(name: string, entryPoint?: string): GPUComputePipeline`, `precompileRegistered(): void`. **No `BUILTIN_SHADERS`, no `getBuiltin*`.**

- [ ] **Step 1: Move `BufferPool.ts` verbatim.** Copy `matrix/src/backends/gpu/BufferPool.ts` to `gpu/src/BufferPool.ts` (its `import { GPUContext } from './GPUContext.js'` resolves in-package). Do NOT delete the matrix copy.

- [ ] **Step 2: Create the generic `gpu/src/ShaderManager.ts`.** This is the old ShaderManager with `BUILTIN_SHADERS` / `getBuiltinShader` / `getBuiltinPipeline` / `precompileBuiltins` **removed** and a generic name→code registration API added. Full file:

```ts
/**
 * GPU Shader Manager (generic)
 *
 * Compiles and caches WGSL shader modules + compute pipelines, and holds a
 * generic name→code registry. Ships NO domain kernels — consumers register
 * their own WGSL (e.g. matrix registers its matmul/transpose/reduce shaders).
 */

import { GPUContext } from './GPUContext.js';

interface ShaderCacheEntry {
  module: GPUShaderModule;
  pipelines: Map<string, GPUComputePipeline>;
  createdAt: number;
}

/** Shader source definition. */
export interface ShaderSource {
  code: string;
  entryPoint: string;
  label?: string;
}

/** Pipeline configuration. */
export interface PipelineConfig {
  entryPoint: string;
  layout?: GPUPipelineLayout | 'auto';
  label?: string;
}

/**
 * Shader Manager for compiling and caching GPU shaders + a name→code registry.
 */
export class ShaderManager {
  private context: GPUContext;
  private cache: Map<string, ShaderCacheEntry> = new Map();
  private registered: Map<string, string> = new Map();

  constructor(context: GPUContext) {
    this.context = context;
  }

  /** Get or compile a shader module by name. */
  getShaderModule(name: string, code: string): GPUShaderModule {
    const existing = this.cache.get(name);
    if (existing) {
      return existing.module;
    }

    const module = this.context.createShaderModule(code, name);
    this.cache.set(name, {
      module,
      pipelines: new Map(),
      createdAt: Date.now(),
    });
    return module;
  }

  /** Get or create a compute pipeline. */
  getPipeline(
    shaderName: string,
    entryPoint: string,
    code?: string,
    layout?: GPUPipelineLayout | 'auto'
  ): GPUComputePipeline {
    const pipelineKey = `${shaderName}:${entryPoint}`;

    let entry = this.cache.get(shaderName);
    if (entry) {
      const pipeline = entry.pipelines.get(pipelineKey);
      if (pipeline) {
        return pipeline;
      }
    } else if (code) {
      this.getShaderModule(shaderName, code);
      entry = this.cache.get(shaderName)!;
    } else {
      throw new Error(`Shader not found: ${shaderName}`);
    }

    const pipeline = this.context.createComputePipeline(
      entry.module,
      entryPoint,
      layout,
      pipelineKey
    );
    entry.pipelines.set(pipelineKey, pipeline);
    return pipeline;
  }

  /** Register a named shader's WGSL source (no compilation — pure bookkeeping). */
  registerShader(name: string, code: string): void {
    this.registered.set(name, code);
  }

  /** Whether a shader name has been registered. */
  hasRegisteredShader(name: string): boolean {
    return this.registered.has(name);
  }

  /** Get a registered shader's WGSL source (throws if unregistered). */
  getRegisteredShaderSource(name: string): string {
    const code = this.registered.get(name);
    if (!code) {
      throw new Error(`Unknown registered shader: ${name}`);
    }
    return code;
  }

  /** Compile + cache a registered shader module by name. */
  getRegisteredShaderModule(name: string): GPUShaderModule {
    return this.getShaderModule(`registered:${name}`, this.getRegisteredShaderSource(name));
  }

  /** Get or create a compute pipeline for a registered shader. */
  getRegisteredPipeline(name: string, entryPoint: string = 'main'): GPUComputePipeline {
    return this.getPipeline(`registered:${name}`, entryPoint, this.getRegisteredShaderSource(name));
  }

  /** Precompile every registered shader's module + default pipeline. */
  precompileRegistered(): void {
    for (const name of this.registered.keys()) {
      this.getRegisteredShaderModule(name);
      this.getRegisteredPipeline(name);
    }
  }

  /** Clear the compiled-shader cache (registrations are retained). */
  clearCache(): void {
    this.cache.clear();
  }

  /** Cache statistics. */
  getStats(): { cachedShaders: number; cachedPipelines: number } {
    let cachedShaders = 0;
    let cachedPipelines = 0;
    for (const entry of this.cache.values()) {
      cachedShaders++;
      cachedPipelines += entry.pipelines.size;
    }
    return { cachedShaders, cachedPipelines };
  }
}
```

- [ ] **Step 3: Extend the barrel `gpu/src/index.ts`.** Add, after the `device.js` re-export:

```ts
export { BufferPool, type BufferPoolOptions } from './BufferPool.js';

export { ShaderManager, type ShaderSource, type PipelineConfig } from './ShaderManager.js';
```

- [ ] **Step 4: Write the failing tests** — `gpu/tests/shader-manager.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ShaderManager } from '../src/ShaderManager.js';
import type { GPUContext } from '../src/GPUContext.js';

// Registration bookkeeping needs no GPU device — a stub context suffices.
const stubContext = {} as GPUContext;

describe('ShaderManager registration (headless)', () => {
  it('registers and reports a shader source', () => {
    const sm = new ShaderManager(stubContext);
    sm.registerShader('foo', 'CODE_FOO');
    expect(sm.hasRegisteredShader('foo')).toBe(true);
    expect(sm.getRegisteredShaderSource('foo')).toBe('CODE_FOO');
  });

  it('reports unregistered shaders as absent', () => {
    const sm = new ShaderManager(stubContext);
    expect(sm.hasRegisteredShader('bar')).toBe(false);
  });

  it('throws when requesting an unregistered shader source', () => {
    const sm = new ShaderManager(stubContext);
    expect(() => sm.getRegisteredShaderSource('bar')).toThrow(/Unknown registered shader/);
  });

  it('ships no domain kernels (empty registry on construction)', () => {
    const sm = new ShaderManager(stubContext);
    expect(sm.hasRegisteredShader('matmul')).toBe(false);
  });
});
```

And `gpu/tests/bufferpool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BufferPool } from '../src/BufferPool.js';
import type { GPUContext } from '../src/GPUContext.js';

const stubContext = {} as GPUContext;

describe('BufferPool (headless)', () => {
  it('reports empty stats before any acquisition', () => {
    // autoEvict:false → no setInterval timer left dangling in the test run
    const pool = new BufferPool(stubContext, { autoEvict: false });
    const stats = pool.getStats();
    expect(stats.totalBuffers).toBe(0);
    expect(stats.inUseBuffers).toBe(0);
    expect(stats.cachedBuffers).toBe(0);
  });
});
```

- [ ] **Step 5: Run the tests.**
      Run: `cd gpu && npx vitest run tests/shader-manager.test.ts tests/bufferpool.test.ts`
      Expected: shader-manager 4 passed, bufferpool 1 passed.

- [ ] **Step 6: Run the whole gpu suite + build + typecheck + lint (full package gate).**
      Run: `cd gpu && npx vitest run && npx tsup src/index.ts --format esm --dts --clean && npx tsc --noEmit && npx eslint src --ext .ts`
      Expected: all tests passed (detect 5, context 4, device 3, shader-manager 4, bufferpool 1); dist emitted; tsc 0; eslint 0.

- [ ] **Step 7: Commit.**

```bash
git add gpu/src/BufferPool.ts gpu/src/ShaderManager.ts gpu/src/index.ts \
        gpu/tests/shader-manager.test.ts gpu/tests/bufferpool.test.ts
git commit -m "$(cat <<'EOF'
feat(gpu): BufferPool + generic ShaderManager with registration API

Complete the gpu foundation: move BufferPool verbatim and add the GENERIC
ShaderManager — compile/cache/pipeline infra plus a name->code registration
API (registerShader/getRegisteredPipeline/precompileRegistered). The builtin
matrix kernels (BUILTIN_SHADERS/getBuiltin*) are intentionally NOT here; the
gpu leaf ships zero domain kernels. Headless tests cover registration
bookkeeping and empty pool stats.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

---

## Task 4: Rewire matrix onto `@danielsimonjr/mathts-gpu` (atomic — delete copies, keep surface)

This task must land as one commit: deleting matrix's foundation copies and repointing every consumer (source AND tests) happens together, or the matrix build/tests break. The deliverable is the **matrix suite green** with its public surface unchanged.

**Files:**

- Modify: `matrix/package.json` (add gpu dependency)
- Delete: `matrix/src/backends/gpu/detect.ts`, `matrix/src/backends/gpu/GPUContext.ts`, `matrix/src/backends/gpu/BufferPool.ts`, `matrix/src/backends/gpu/ShaderManager.ts`
- Create: `matrix/src/backends/gpu/builtin-shaders.ts`
- Modify: `matrix/src/backends/gpu/index.ts`, `matrix/src/backends/GPUBackend.ts`, `matrix/src/backends/GPUMatrixBackend.ts`, `matrix/src/backends/gpu/BatchExecutor.ts`, `matrix/src/backends/gpu/Sync.ts`
- Modify (tests): `matrix/tests/gpu/initialization.test.ts`, `matrix/tests/gpu/integration.test.ts`, `matrix/tests/gpu/operations.test.ts`

**Interfaces:**

- Consumes (from Tasks 1–3, via `@danielsimonjr/mathts-gpu`): `GPUContext`, `type GPUContextOptions`, `getGlobalGPUContext`, `BufferPool`, `ShaderManager` (with `registerShader`/`getRegisteredPipeline`/`precompileRegistered`), `hasWebGPU`, `detectGPUCapabilities`, `getRecommendedWorkgroupSize`, `type GPUCapabilities`, `getGpuDevice`, `resetGpuDevice`, and all `detect`/context types.
- Produces: `matrix/src/backends/gpu/builtin-shaders.ts` exports `BUILTIN_SHADERS` (the 7-kernel object, `as const`) and `registerBuiltinShaders(sm: ShaderManager): void`. matrix's public surface (via `backends/index.ts`) is unchanged.

- [ ] **Step 1: Add the dependency + install.** In `matrix/package.json`, add to `"dependencies"` (keep alphabetical after `mathts-core`):

```json
  "dependencies": {
    "@danielsimonjr/mathts-core": "^0.6.0",
    "@danielsimonjr/mathts-gpu": "^0.1.0",
    "@danielsimonjr/mathts-parallel": "^0.3.3"
  },
```

Run: `npm install`
Expected: `matrix/node_modules/@danielsimonjr/mathts-gpu` links to `gpu/` (version `0.1.0` satisfies `^0.1.0`).

- [ ] **Step 2: Build the gpu package (matrix imports its `dist/`).**
      Run: `cd gpu && npx tsup src/index.ts --format esm --dts --clean`
      Expected: `gpu/dist/index.js` + `gpu/dist/index.d.ts` present. (Downstream typecheck/tests resolve the package from `dist/`.)

- [ ] **Step 3: Create `matrix/src/backends/gpu/builtin-shaders.ts`.** Move the `BUILTIN_SHADERS` object out of the old ShaderManager verbatim (all 7 kernels: `matrixAdd`, `matrixSub`, `matrixMul`, `scalarMul`, `matmul`, `transpose`, `sumReduce`) and add the registration helper:

```ts
/**
 * Matrix-domain WGSL kernels.
 *
 * These live in matrix — the @danielsimonjr/mathts-gpu foundation ships no
 * domain kernels. GPUBackend registers them onto a ShaderManager at init.
 */

import type { ShaderManager } from '@danielsimonjr/mathts-gpu';

export const BUILTIN_SHADERS = {
  /** Matrix addition shader */
  matrixAdd: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;
    @group(0) @binding(3) var<uniform> params: vec4<u32>; // rows, cols, _, _

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let rows = params.x;
      let cols = params.y;
      let row = gid.y;
      let col = gid.x;

      if (row >= rows || col >= cols) { return; }

      let idx = row * cols + col;
      result[idx] = a[idx] + b[idx];
    }
  `,

  /** Matrix subtraction shader */
  matrixSub: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;
    @group(0) @binding(3) var<uniform> params: vec4<u32>;

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let rows = params.x;
      let cols = params.y;
      let row = gid.y;
      let col = gid.x;

      if (row >= rows || col >= cols) { return; }

      let idx = row * cols + col;
      result[idx] = a[idx] - b[idx];
    }
  `,

  /** Element-wise multiplication shader */
  matrixMul: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;
    @group(0) @binding(3) var<uniform> params: vec4<u32>;

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let rows = params.x;
      let cols = params.y;
      let row = gid.y;
      let col = gid.x;

      if (row >= rows || col >= cols) { return; }

      let idx = row * cols + col;
      result[idx] = a[idx] * b[idx];
    }
  `,

  /** Scalar multiplication shader */
  scalarMul: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read_write> result: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<f32>; // scalar, length, _, _

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let scalar = params.x;
      let length = u32(params.y);
      let idx = gid.x;

      if (idx >= length) { return; }

      result[idx] = a[idx] * scalar;
    }
  `,

  /** Matrix multiplication (naive) shader */
  matmul: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;
    @group(0) @binding(3) var<uniform> params: vec4<u32>; // M, N, K, _

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let M = params.x;
      let N = params.y;
      let K = params.z;
      let row = gid.y;
      let col = gid.x;

      if (row >= M || col >= N) { return; }

      var sum: f32 = 0.0;
      for (var k: u32 = 0u; k < K; k = k + 1u) {
        sum = sum + a[row * K + k] * b[k * N + col];
      }

      result[row * N + col] = sum;
    }
  `,

  /** Matrix transpose shader */
  transpose: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read_write> result: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<u32>; // rows, cols, _, _

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let rows = params.x;
      let cols = params.y;
      let row = gid.y;
      let col = gid.x;

      if (row >= rows || col >= cols) { return; }

      result[col * rows + row] = a[row * cols + col];
    }
  `,

  /** Sum reduction shader (first pass) */
  sumReduce: `
    @group(0) @binding(0) var<storage, read> input: array<f32>;
    @group(0) @binding(1) var<storage, read_write> output: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<u32>; // inputLength, outputLength, _, _

    var<workgroup> shared: array<f32, 256>;

    @compute @workgroup_size(256)
    fn main(
      @builtin(local_invocation_id) lid: vec3<u32>,
      @builtin(workgroup_id) wid: vec3<u32>
    ) {
      let inputLength = params.x;
      let idx = wid.x * 512u + lid.x;

      var sum: f32 = 0.0;
      if (idx < inputLength) {
        sum = input[idx];
      }
      if (idx + 256u < inputLength) {
        sum = sum + input[idx + 256u];
      }
      shared[lid.x] = sum;

      workgroupBarrier();

      for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
        if (lid.x < s) {
          shared[lid.x] = shared[lid.x] + shared[lid.x + s];
        }
        workgroupBarrier();
      }

      if (lid.x == 0u) {
        output[wid.x] = shared[0];
      }
    }
  `,
} as const;

/** Register every builtin matrix kernel onto a ShaderManager. */
export function registerBuiltinShaders(sm: ShaderManager): void {
  for (const [name, code] of Object.entries(BUILTIN_SHADERS)) {
    sm.registerShader(name, code);
  }
}
```

> Copy the WGSL strings byte-for-byte from the old `matrix/src/backends/gpu/ShaderManager.ts` (`BUILTIN_SHADERS`, lines 45–214) to avoid drift — the block above is that content.

- [ ] **Step 4: Delete the four extracted files from matrix.**

```bash
git rm matrix/src/backends/gpu/detect.ts \
       matrix/src/backends/gpu/GPUContext.ts \
       matrix/src/backends/gpu/BufferPool.ts \
       matrix/src/backends/gpu/ShaderManager.ts
```

- [ ] **Step 5: Rewrite `matrix/src/backends/gpu/index.ts`** so the foundation re-exports from the package (preserving matrix's public surface) and the non-extracted pieces stay local:

```ts
/**
 * GPU Backend Exports
 *
 * WebGPU infrastructure for accelerated matrix operations. The generic
 * foundation now lives in @danielsimonjr/mathts-gpu and is re-exported here
 * so matrix's public surface is unchanged. Matrix-domain kernels and the
 * (unextracted) batch/sync helpers stay local.
 */

// Shared foundation (re-exported from the gpu leaf for back-compat)
export {
  hasWebGPU,
  isBrowser,
  getGPUAdapter,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
  GPUContext,
  getGlobalGPUContext,
  initializeGlobalGPU,
  destroyGlobalGPU,
  getGpuDevice,
  resetGpuDevice,
  BufferPool,
  ShaderManager,
  type GPUAdapterInfo,
  type GPUCapabilities,
  type GPUContextOptions,
  type GPUContextStatus,
  type DeviceLostEvent,
  type BufferPoolOptions,
  type ShaderSource,
  type PipelineConfig,
} from '@danielsimonjr/mathts-gpu';

// Matrix-domain kernels (stay in matrix)
export { BUILTIN_SHADERS, registerBuiltinShaders } from './builtin-shaders.js';

// Batch Executor (not extracted — YAGNI)
export {
  BatchExecutor,
  type BatchOperation,
  type BatchOperationType,
  type BatchResult,
  type BatchOptions,
} from './BatchExecutor.js';

// Synchronization (not extracted — YAGNI)
export {
  SyncManager,
  createSyncManager,
  type SyncStrategy,
  type TransferDirection,
  type TransferRequest,
  type TransferResult,
  type SyncConfig,
} from './Sync.js';
```

> This keeps every name that `matrix/src/backends/index.ts:64-79` re-exports resolvable, so `backends/index.ts` needs **no** change.

- [ ] **Step 6: Rewire `matrix/src/backends/GPUBackend.ts`.** Replace the import block (`GPUBackend.ts:7-17`) with:

```ts
import {
  GPUContext,
  type GPUContextOptions,
  getGlobalGPUContext,
  BufferPool,
  ShaderManager,
  hasWebGPU,
  detectGPUCapabilities,
  getRecommendedWorkgroupSize,
  type GPUCapabilities,
} from '@danielsimonjr/mathts-gpu';
import { registerBuiltinShaders } from './builtin-shaders.js';
```

Replace the shader-manager setup (`GPUBackend.ts:137-141`, the `// Create shader manager` / `// Precompile builtin shaders` block) with:

```ts
// Create shader manager and register the matrix-domain kernels
this.shaderManager = new ShaderManager(this.context);
registerBuiltinShaders(this.shaderManager);
this.shaderManager.precompileRegistered();
```

Change the four builtin-pipeline lookups from `getBuiltinPipeline` to `getRegisteredPipeline` (same string args):

- `GPUBackend.ts:225` → `const pipeline = shaders.getRegisteredPipeline('matrixAdd');`
- `GPUBackend.ts:280` → `const pipeline = shaders.getRegisteredPipeline('matmul');`
- `GPUBackend.ts:325` → `const pipeline = shaders.getRegisteredPipeline('transpose');`
- `GPUBackend.ts:368` → `const pipeline = shaders.getRegisteredPipeline('scalarMul');`

- [ ] **Step 7: Rewire `matrix/src/backends/GPUMatrixBackend.ts`.** Change line 19 from `from './gpu/index.js'` to the package:

```ts
import { hasWebGPU, detectGPUCapabilities, type GPUCapabilities } from '@danielsimonjr/mathts-gpu';
```

- [ ] **Step 8: Rewire `matrix/src/backends/gpu/BatchExecutor.ts`.** Change the three type imports (lines 10–12) to the package:

```ts
import type { GPUContext } from '@danielsimonjr/mathts-gpu';
import type { ShaderManager } from '@danielsimonjr/mathts-gpu';
import type { BufferPool } from '@danielsimonjr/mathts-gpu';
```

Replace the pipeline lookup (`BatchExecutor.ts:343-346`) — the old `Parameters<ShaderManager['getBuiltinPipeline']>` cast is gone; `getPipelineName` already returns `string`, and `getRegisteredPipeline` takes a `string`:

```ts
const pipelineName = this.getPipelineName(op.type);
const pipeline = this.shaders.getRegisteredPipeline(pipelineName);
```

- [ ] **Step 9: Rewire `matrix/src/backends/gpu/Sync.ts`.** Change the two type imports (lines 11–12) to the package:

```ts
import type { GPUContext } from '@danielsimonjr/mathts-gpu';
import type { BufferPool } from '@danielsimonjr/mathts-gpu';
```

- [ ] **Step 10: Retarget the matrix GPU test imports.** These headless tests import from the now-deleted files; repoint them.

`matrix/tests/gpu/initialization.test.ts` — the `detect` import (lines 9–17) and the `GPUContext` import (lines 18–22) move to the package, and `BUILTIN_SHADERS` (line 23) moves to `builtin-shaders.js`. Change:

- line 17: `} from '../../src/backends/gpu/detect.js';` → `} from '@danielsimonjr/mathts-gpu';`
- line 22: `} from '../../src/backends/gpu/GPUContext.js';` → `} from '@danielsimonjr/mathts-gpu';`
- line 23: `import { BUILTIN_SHADERS } from '../../src/backends/gpu/ShaderManager.js';` → `import { BUILTIN_SHADERS } from '../../src/backends/gpu/builtin-shaders.js';`
  (The `GPUBackend` import at lines 24–28 stays — `GPUBackend` remains in matrix.)

`matrix/tests/gpu/integration.test.ts` — change:

- line 9: `import { GPUContext } from '../../src/backends/gpu/GPUContext.js';` → `import { GPUContext } from '@danielsimonjr/mathts-gpu';`
- line 10: `import { BufferPool } from '../../src/backends/gpu/BufferPool.js';` → `import { BufferPool } from '@danielsimonjr/mathts-gpu';`
- line 11: `import { ShaderManager, BUILTIN_SHADERS } from '../../src/backends/gpu/ShaderManager.js';` → split into two:

```ts
import { ShaderManager } from '@danielsimonjr/mathts-gpu';
import { BUILTIN_SHADERS } from '../../src/backends/gpu/builtin-shaders.js';
```

(The `BatchExecutor` and `Sync` imports at lines 12–20 stay — both remain in matrix.)

`matrix/tests/gpu/operations.test.ts` — the four dynamic imports of `BUILTIN_SHADERS` (lines 391, 399, 409, 417) change their specifier:

- `await import('../../src/backends/gpu/ShaderManager.js')` → `await import('../../src/backends/gpu/builtin-shaders.js')` (all four occurrences).

- [ ] **Step 11: Sweep for any missed reference to a deleted file.**
      Run: `grep -rn "gpu/detect\|gpu/GPUContext\|gpu/BufferPool\|gpu/ShaderManager" matrix/src matrix/tests`
      Expected: **no output.** Any hit is a missed rewire — fix it before proceeding. Also confirm no lingering builtin-pipeline calls:
      Run: `grep -rn "getBuiltinPipeline\|precompileBuiltins\|getBuiltinShader" matrix/src matrix/tests`
      Expected: **no output.**

- [ ] **Step 12: Build gpu (fresh) then run the matrix gate.**
      Run: `npx turbo build --filter=@danielsimonjr/mathts-gpu && cd matrix && npm run build && npm run typecheck && npx vitest run tests/gpu && npx eslint src --ext .ts`
      Expected: gpu + matrix build clean; matrix typecheck 0 errors; the three `tests/gpu/*` suites GREEN (they mock the device / assert on WGSL strings — no GPU needed); eslint 0 problems.

- [ ] **Step 13: Run the FULL matrix suite (regression) + downstream typecheck.**
      Run: `cd matrix && npm run test && cd .. && npm run typecheck`
      Expected: full matrix suite GREEN (matmul/decompositions unchanged); root `turbo run typecheck` 0 errors across all 23 packages (functions/compat, which consume matrix's public surface, still resolve every re-exported GPU symbol).

- [ ] **Step 14: Commit.**

```bash
git add matrix/package.json package-lock.json \
        matrix/src/backends/gpu/index.ts matrix/src/backends/gpu/builtin-shaders.ts \
        matrix/src/backends/gpu/BatchExecutor.ts matrix/src/backends/gpu/Sync.ts \
        matrix/src/backends/GPUBackend.ts matrix/src/backends/GPUMatrixBackend.ts \
        matrix/tests/gpu/initialization.test.ts matrix/tests/gpu/integration.test.ts \
        matrix/tests/gpu/operations.test.ts
git add -A matrix/src/backends/gpu/   # stage the deletions of the 4 moved files
git commit -m "$(cat <<'EOF'
refactor(matrix): consume @danielsimonjr/mathts-gpu; keep public surface

Delete matrix's copies of detect/GPUContext/BufferPool/ShaderManager and import
the foundation from the new gpu leaf. Matrix-domain WGSL (BUILTIN_SHADERS) moves
to builtin-shaders.ts; GPUBackend registers those kernels onto the shared
ShaderManager at init (getBuiltinPipeline -> getRegisteredPipeline). BatchExecutor
and Sync stay local (YAGNI), retargeted to the package for their type imports.
gpu/index.ts re-exports the whole foundation so matrix's public surface — and
every downstream consumer — is unchanged. Matrix suite (incl. the headless GPU
tests) stays green; no GPU execution.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

> Note: `git rm` in Step 4 already staged the deletions; the extra `git add -A matrix/src/backends/gpu/` is a belt-and-suspenders guard in case the files were only removed on disk.

---

## Task 5: Changesets, regenerated dependency docs, and doc sync

**Files:**

- Create: `.changeset/webgpu-spec1a-extract-gpu.md`
- Regenerate: `docs/Architecture/*` (via `npm run docs:deps`)
- Modify: `CLAUDE.md`, `README.md` (if it states a package count/list), `ROADMAP.md`, `CHANGELOG.md`, `TODO.md`

**Interfaces:**

- Consumes: the landed package + rewire from Tasks 1–4.
- Produces: a matrix `minor` changeset (gpu publishes fresh at `0.1.0` with no bump); dependency docs showing `matrix → gpu`, 0 cycles; synced human docs.

- [ ] **Step 1: Create the changeset** — `.changeset/webgpu-spec1a-extract-gpu.md`:

```markdown
---
'@danielsimonjr/mathts-matrix': minor
---

Extract the WebGPU foundation (device/context, buffer pool, and a generic
shader manager) into a new shared `@danielsimonjr/mathts-gpu` leaf package.
matrix's `GPUBackend` now imports the foundation from that package and registers
its builtin matrix kernels onto the shared `ShaderManager`; the shared GPU device
is coalesced behind a single, never-throw in-flight `getGpuDevice()`. Every GPU
foundation symbol remains re-exported from `@danielsimonjr/mathts-matrix`, so no
downstream consumer breaks. Pure refactor — no behavior change.
```

> **gpu has no changeset entry by design.** It is a brand-new package at `0.1.0`; `changeset publish` publishes it fresh (it is not yet on the registry), while a bumping changeset would overshoot to `0.2.0`. This lands exactly the intended initial `0.1.0`. Record this rationale in the CHANGELOG entry (Step 4).

- [ ] **Step 2: Regenerate the dependency documentation.**
      Run: `npm run docs:deps`
      Expected: exits clean; `docs/Architecture/*` updated. Do NOT hand-edit these generated files.

- [ ] **Step 3: Verify the graph is correct (second-method check).**
      Run:

```bash
grep -c "mathts-gpu" docs/Architecture/dependency-graph.json
node tools/query-dependency-graph/query-dependency-graph.mjs --check-browser-safety
```

Expected: `mathts-gpu` appears in the graph JSON (matrix depends on it; gpu is a leaf). Confirm there is a `matrix → gpu` edge and **no** cycle — inspect the `cycles` field:

```bash
grep -n "\"cycles\"" docs/Architecture/dependency-graph.json
```

Expected: cycles is empty (`[]`). Also confirm no NEW dormant/orphaned file was introduced by scanning `docs/Architecture/unused-analysis.md` for anything under `gpu/src/` — every `gpu/src/*` file must be reachable from `gpu/src/index.ts` (there should be zero gpu orphans).

- [ ] **Step 4: Update `CHANGELOG.md`.** Under `## [Unreleased]`, add a new `### Added` block (above the existing workbook block):

```markdown
### Added — `@danielsimonjr/mathts-gpu`: shared WebGPU foundation (Spec 1a)

New leaf package holding the generic WebGPU foundation extracted from
`matrix/src/backends/gpu/`: `GPUContext` (device/adapter lifecycle),
`BufferPool`, `detect` (capability probing), a **generic** `ShaderManager`
(compile/cache/pipeline + a name→code registration API, no domain kernels),
and a shared `getGpuDevice()` singleton. The device path is hardened to
**never throw**: concurrent `GPUContext.initialize()` callers await one
in-flight promise, and an unavailable device resolves to `null`/`false`.

`@danielsimonjr/mathts-matrix` now depends on this package (minor bump) and
re-exports the whole foundation for back-compat, so no downstream consumer
breaks. `BUILTIN_SHADERS` (matmul/transpose/reduce WGSL) stays in matrix and
is registered onto the shared `ShaderManager` at `GPUBackend` init. Pure
refactor — no behavior change; the full matrix suite (incl. headless GPU
tests) stays green. First slice of the WebGPU acceleration epic
(design: `docs/superpowers/specs/2026-07-10-webgpu-acceleration-design.md`).

The new package publishes at its initial `0.1.0` (no bumping changeset, so it
does not overshoot); matrix takes a minor bump for the new dependency + surface
reshuffle.
```

- [ ] **Step 5: Sync `CLAUDE.md`.** Three edits:
  1. Change the workspace count `22 npm workspace packages` → `23 npm workspace packages`.
  2. In the workspace list, add a `gpu/` line (near matrix, before the focused re-export packages):
     ```
     gpu/                       # @danielsimonjr/mathts-gpu - shared WebGPU foundation (GPUContext/BufferPool/ShaderManager/detect; no domain kernels)
     ```
  3. In the **Dependency Graph** block, add `gpu` to matrix's forward edges and the reverse section:
     - `matrix      → core, parallel, gpu`
     - add under the "← is depended on by" list: `gpu            ← matrix`
  4. In the **Matrix Backends** section, append to the `GPUBackend` bullet a note that the foundation now lives in `@danielsimonjr/mathts-gpu` (matrix re-exports it; matrix keeps the matmul/transpose/reduce WGSL and registers it at init).

Verify each count/claim with `honest-claude` (grep the actual workspaces array — it must show 23 entries).

- [ ] **Step 6: Check `README.md`.** Run `grep -n "workspace\|packages\|22\|matrix" README.md`. If it states a package count or lists packages, update it to include `gpu` / `23`. If it says nothing structural, note "README current" and make no edit.

- [ ] **Step 7: Update `ROADMAP.md`.** Locate the "Unified f32 WebGPU path — not pursued" line (~line 81) and the WebGPU acceleration-tier candidate section. Mark Spec 1a as landed (foundation extracted; `@danielsimonjr/mathts-gpu` shipped) and note the design doc supersedes the earlier "not pursued" line. Point the next step at Spec 1b (flag + Float32 matmul routing).

- [ ] **Step 8: Update `TODO.md`.** In the Active/Pending queue, add a WebGPU epic entry reflecting: Spec 1a ✅ done (gpu package extracted, matrix rewired), Spec 1b next (`enableGpu()` + Float32 matmul routing), Spec 2+ (functions `*GpuDispatch`).

- [ ] **Step 9: Final whole-repo gate (verification-before-completion).**
      Run: `npm run build && npm run typecheck && npm run test && npx eslint . && npm run docs:deps`
      Expected: all 23 packages build; typecheck 0 errors; full test suite GREEN; `eslint .` **0 problems**; `docs:deps` clean with 0 cycles and the `matrix → gpu` edge. (This re-runs docs:deps last so the committed artifacts match the final tree — if it produces a diff, stage it.)

- [ ] **Step 10: Commit.**

```bash
git add .changeset/webgpu-spec1a-extract-gpu.md docs/Architecture/ \
        CLAUDE.md README.md ROADMAP.md CHANGELOG.md TODO.md
git commit -m "$(cat <<'EOF'
docs(gpu): changeset + regenerated deps + doc sync for Spec 1a

Add the matrix minor changeset (gpu publishes fresh at 0.1.0 — no bumping
changeset, so it lands exactly the initial version). Regenerate the dependency
graph (matrix -> gpu, leaf, 0 cycles, 0 new dormant). Sync CLAUDE.md (23
workspaces + gpu in the dependency graph + Matrix Backends note), ROADMAP
(Spec 1a landed; 1b next), CHANGELOG (Unreleased), and TODO (WebGPU epic).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

- [ ] **Step 11: Push the whole branch and verify L==R.**
      Run: `git push origin main`
      Then verify:

```bash
[ "$(git rev-parse HEAD)" = "$(git ls-remote origin -h refs/heads/main | cut -f1)" ] && echo "L==R OK" || echo "MISMATCH"
```

Expected: `L==R OK`.

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-07-10-webgpu-acceleration-design.md`, Spec 1a section):

- Extract `GPUContext`/`BufferPool`/`detect` + generic `ShaderManager` → Tasks 1–3. ✅
- Split `ShaderManager` (generic → gpu; `BUILTIN_SHADERS` stays in matrix, registered by `GPUBackend`) → Task 3 (generic) + Task 4 (`builtin-shaders.ts` + registration). ✅
- Do NOT extract `BatchExecutor`/`Sync` → Task 4 keeps them in matrix (type imports retargeted). ✅
- Breaking-change handling: keep `GPUContext`/`GPUBackend`/`getGlobalGPUContext`/`getGlobalGPUBackend`/`GPUCapabilities` re-exported from matrix → Task 4 Step 5 (`gpu/index.ts` re-export) + `backends/index.ts` unchanged; `GPUBackend`/`getGlobalGPUBackend` stay in matrix untouched. ✅
- matrix changeset = minor; new gpu changeset = initial 0.1.0 (publishes) → Task 5 Step 1 (matrix minor; gpu ships at 0.1.0, publishes fresh — rationale documented). ✅
- Shared-device hardening (`getGpuDevice()` single-flight `Promise<GPUDevice|null>`; fix `GPUContext.initialize` throw) → Task 2. ✅
- Package shape (ESM, `type:module`, tsup `--dts`, `@webgpu/types` dev); wire into workspace list + turbo + matrix dep; functions untouched → Task 1 (package + workspace), Task 4 (matrix dep). Turbo needs no per-package config (root `turbo.json` tasks are generic). ✅
- Gates: typecheck / build / matrix test green / docs:deps 0 cycles+0 new dormant / eslint 0 → Task 5 Step 9 (full gate) + per-task gates. ✅
- Out of scope (flag, `*GpuDispatch`, functions, new kernel) → honored; none appear. ✅

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Every code step shows complete content; every command shows expected output. ✅

**3. Type consistency:** `registerShader`/`hasRegisteredShader`/`getRegisteredShaderSource`/`getRegisteredShaderModule`/`getRegisteredPipeline`/`precompileRegistered` are defined identically in Task 3 (ShaderManager) and consumed with matching signatures in Task 4 (`registerBuiltinShaders`, `GPUBackend`, `BatchExecutor`). `getGpuDevice(options?: GPUContextOptions): Promise<GPUDevice|null>` / `resetGpuDevice(): void` consistent between Task 2 definition and Task 4 re-export. `GPUContextOptions` imported as `type` where used as a type. Barrel export names match the consuming import names in `matrix/src/backends/gpu/index.ts`. ✅
