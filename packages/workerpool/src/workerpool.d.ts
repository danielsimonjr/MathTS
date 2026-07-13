/**
 * Ambient type declarations for `workerpool` (danielsimonjr fork,
 * `github:danielsimonjr/workerpool`).
 *
 * The installed fork's `package.json` promises `types`/`exports["."].types`
 * pointing at generated files (`types/index.d.ts`, `dist/ts/index.d.ts`, ...),
 * but those are build outputs that are never committed to the fork's repo and
 * never generated on install (no `prepare` script runs for a `github:`
 * dependency) — so the package resolves as fully untyped at runtime.
 *
 * This file is the canonical (single-source-of-truth) shim. It is included in
 * `@danielsimonjr/mathts-workerpool`'s own build (via `include` in
 * tsconfig.json) *and* copied into its published `dist/` by
 * `scripts/postbuild.mjs`, which also prepends a triple-slash reference to
 * the built `dist/index.d.ts` pointing at the copy (tsup's dts bundler drops
 * triple-slash directives written directly in `src/`, so this has to happen
 * post-build). Downstream consumers — internal packages and published npm
 * consumers alike — get real ambient types for `workerpool` without needing
 * their own shim or a `paths` override.
 *
 * IMPORTANT: this file must stay a global *script* (no top-level `import`/
 * `export` statement) so `declare module 'workerpool' { ... }` is parsed as a
 * brand-new ambient module declaration rather than a *module augmentation*
 * (which requires `workerpool` to already resolve to a typed module — it
 * doesn't, see above — and fails with TS2665 "Invalid module name in
 * augmentation"). Do not `import`/`export` anything at the top level here.
 */
declare module 'workerpool' {
  export interface ExecOptions<T = unknown> {
    on?: (payload: unknown) => void;
    transfer?: Transferable[];
    metadata?: T;
  }

  export interface PoolStats {
    totalWorkers: number;
    busyWorkers: number;
    idleWorkers: number;
    pendingTasks: number;
    activeTasks: number;
  }

  export interface PoolOptions {
    minWorkers?: number | 'max';
    maxWorkers?: number;
    maxQueueSize?: number;
    workerType?: 'auto' | 'web' | 'process' | 'thread';
    queueStrategy?: 'fifo' | 'lifo';
    script?: string;
    workerTerminateTimeout?: number;
    forkArgs?: string[];
    forkOpts?: Record<string, unknown>;
    workerOpts?: Record<string, unknown>;
    workerThreadOpts?: Record<string, unknown>;
    emitStdStreams?: boolean;
    onCreateWorker?: (arg: Record<string, unknown>) => Record<string, unknown> | void;
    onTerminateWorker?: (arg: Record<string, unknown>) => void;
    debugPortStart?: number;
  }

  export interface WorkerpoolPromise<T> extends Promise<T> {
    readonly resolved: boolean;
    readonly rejected: boolean;
    readonly pending: boolean;
    cancel(): this;
    timeout(delay: number): this;
  }

  export type WorkerProxy<T extends Record<string, (...args: unknown[]) => unknown>> = {
    [K in keyof T]: (...args: Parameters<T[K]>) => WorkerpoolPromise<ReturnType<T[K]>>;
  };

  export class Pool {
    // `script` also accepts a bare `PoolOptions` (single-argument overload) or
    // `null` (explicit "no custom worker script") — `createPool(null, options)`
    // is the common form used by MathWorkerPool's default initialization path.
    constructor(script?: string | PoolOptions | null, options?: PoolOptions);
    exec<T>(
      method: string | ((...args: unknown[]) => T),
      params?: unknown[],
      options?: ExecOptions
    ): WorkerpoolPromise<T>;
    proxy<T extends Record<string, (...args: unknown[]) => unknown>>(): Promise<WorkerProxy<T>>;
    stats(): PoolStats;
    terminate(force?: boolean, timeout?: number): Promise<void>;
  }

  export interface TransferDescriptor<T = unknown> {
    message: T;
    transfer: Transferable[];
  }

  export class Transfer<T = unknown> {
    message: T;
    transfer: Transferable[];
    constructor(message: T, transfer: Transferable[]);
  }

  export class CancellationError extends Error {}
  export class TimeoutError extends Error {}
  export class TerminateError extends Error {}

  export function pool(script?: string | PoolOptions | null, options?: PoolOptions): Pool;

  export function worker(
    methods?: Record<string, (...args: unknown[]) => unknown>,
    options?: {
      onTerminate?: (code: number | undefined) => void | PromiseLike<void>;
      abortListenerTimeout?: number;
    }
  ): void;

  export function workerEmit(payload: unknown): void;
}
