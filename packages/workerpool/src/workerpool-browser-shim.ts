/**
 * Browser shim for the Node-oriented `workerpool` npm package.
 *
 * The upstream `workerpool` package resolves its `import`/`require` export
 * condition to `./src/index.js`, whose `WorkerHandler.js` does
 * `require('./generated/embeddedWorker')` — a build-time artifact that only
 * exists in the package's prebuilt `dist/` bundle, NOT in the published
 * `src/` tree. A browser bundler (vite/esbuild/rollup) that follows the
 * `import` condition therefore fails with:
 *
 *   [UNRESOLVED_IMPORT] Could not resolve './generated/embeddedWorker'
 *     in node_modules/workerpool/src/WorkerHandler.js
 *
 * `workerpool` is a Node worker-thread abstraction. In the browser, parallel
 * compute should use native `Worker` / WebGPU, not this Node pool. This shim
 * is aliased in for `workerpool` (and `workerpool/wasm`) in the browser test
 * bundle (see `vitest.config.browser.ts`) so the WebGPU smoke test can build
 * and run. It provides the small API surface that
 * `@danielsimonjr/mathts-workerpool` references at import time
 * (`pool`, `Pool`, `Transfer`, `worker`, plus the wasm-subpath feature
 * detectors) without dragging in the Node `embeddedWorker` artifact.
 *
 * The browser smoke test only exercises WebGPU (`gpuMatmul`), so the pool is
 * never actually driven here. If a browser code path ever does need a real
 * worker pool, replace this shim with a native-`Worker`-backed implementation
 * behind the same interface rather than bundling the Node `workerpool`.
 *
 * @packageDocumentation
 */

export interface PoolOptions {
  minWorkers?: number | 'max';
  maxWorkers?: number;
  workerType?: 'auto' | 'web' | 'thread';
  workerTerminateTimeout?: number;
}

export interface ExecOptions {
  on?: (payload: unknown) => void;
  transfer?: unknown[];
  timeout?: number;
}

export interface PoolStats {
  totalWorkers: number;
  busyWorkers: number;
  idleWorkers: number;
  pendingTasks: number;
  activeTasks: number;
}

const NOT_SUPPORTED =
  'workerpool browser shim: the Node worker pool is not available in the browser bundle. ' +
  'Use native Worker / WebGPU for parallel compute in browser environments.';

/**
 * Minimal `Pool` stub. Construction and inspection are safe (so the module
 * graph imports cleanly); `exec` rejects because no Node worker backend exists
 * in the browser. The WebGPU smoke test never calls `exec`.
 */
export class Pool {
  constructor(_script?: string | null, _options?: PoolOptions) {}

  exec(_method: unknown, _params?: unknown[], _options?: ExecOptions): Promise<never> {
    return Promise.reject(new Error(NOT_SUPPORTED));
  }

  proxy(): Promise<Record<string, never>> {
    return Promise.resolve({});
  }

  stats(): PoolStats {
    return {
      totalWorkers: 0,
      busyWorkers: 0,
      idleWorkers: 0,
      pendingTasks: 0,
      activeTasks: 0,
    };
  }

  terminate(_force?: boolean, _timeout?: number): Promise<void> {
    return Promise.resolve();
  }
}

/** Factory mirroring `workerpool.pool(...)`. */
export function pool(script?: string | null, options?: PoolOptions): Pool {
  return new Pool(script, options);
}

/**
 * `Transfer` wrapper mirroring `workerpool.Transfer`. Holds the payload + the
 * transferable list; in the browser shim it is inert (no zero-copy handoff
 * happens because the pool never dispatches).
 */
export class Transfer {
  message: unknown;
  transfer: unknown[];
  constructor(message: unknown, transfer: unknown[]) {
    this.message = message;
    this.transfer = transfer;
  }
}

/**
 * `worker(...)` registration stub. In the real package this is the worker-side
 * entry that registers methods with the host; inside the main browser bundle it
 * is a no-op (worker code never runs on the main thread).
 */
export function worker(_methods?: Record<string, (...args: unknown[]) => unknown>): void {
  /* no-op in the browser main-thread bundle */
}

// --- `workerpool/wasm` subpath feature detectors -----------------------------
// `@danielsimonjr/mathts-workerpool` dynamically imports `workerpool/wasm` for
// these; the same alias maps that subpath here so they resolve in the browser.

/** WebAssembly availability (browser-native check). */
export function canUseWasm(): boolean {
  return typeof WebAssembly !== 'undefined';
}

/** SharedArrayBuffer availability (browser-native check). */
export function canUseSharedMemory(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

export default { pool, Pool, Transfer, worker, canUseWasm, canUseSharedMemory };
