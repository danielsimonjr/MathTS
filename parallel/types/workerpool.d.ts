/**
 * Stub type declarations for workerpool.
 * The actual workerpool package ships raw .ts sources without pre-built .d.ts files.
 * This stub prevents TypeScript from diving into the raw source during type-checking.
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

  export interface WorkerpoolPromise<T, E = unknown> extends Promise<T> {
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
    constructor(script?: string | PoolOptions, options?: PoolOptions);
    exec<T>(method: string | ((...args: unknown[]) => T), params?: unknown[], options?: ExecOptions): WorkerpoolPromise<T>;
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

  export function pool(script?: string | PoolOptions, options?: PoolOptions): Pool;

  export function worker(methods?: Record<string, (...args: unknown[]) => unknown>, options?: {
    onTerminate?: (code: number | undefined) => void | PromiseLike<void>;
    abortListenerTimeout?: number;
  }): void;

  export function workerEmit(payload: unknown): void;
}
