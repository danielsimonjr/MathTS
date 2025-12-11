/**
 * Type declarations for workerpool (danielsimonjr fork)
 * Re-exports types from the TypeScript source
 */

declare module 'workerpool' {
  export type WorkerType = 'auto' | 'web' | 'process' | 'thread';
  export type QueueStrategy = 'fifo' | 'lifo';

  export interface PoolOptions {
    minWorkers?: number | 'max';
    maxWorkers?: number;
    maxQueueSize?: number;
    workerType?: WorkerType;
    queueStrategy?: QueueStrategy;
    script?: string;
    workerTerminateTimeout?: number;
    forkArgs?: string[];
    forkOpts?: object;
    workerOpts?: object;
    workerThreadOpts?: object;
    emitStdStreams?: boolean;
    onCreateWorker?: (arg: WorkerArg) => WorkerArg | void;
    onTerminateWorker?: (arg: WorkerArg) => void;
    debugPortStart?: number;
  }

  export interface WorkerArg {
    forkArgs?: string[];
    forkOpts?: object;
    workerOpts?: object;
    workerThreadOpts?: object;
    script?: string;
  }

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

  export interface WorkerpoolPromise<T, E = unknown> extends Promise<T> {
    readonly resolved: boolean;
    readonly rejected: boolean;
    readonly pending: boolean;
    cancel(): this;
    timeout(delay: number): this;
    always<TResult>(fn: () => TResult | PromiseLike<TResult>): WorkerpoolPromise<TResult, unknown>;
  }

  export interface Pool {
    exec<T = unknown>(
      method: string | ((...args: unknown[]) => T),
      params?: unknown[],
      options?: ExecOptions
    ): WorkerpoolPromise<T, unknown>;
    proxy<T extends Record<string, (...args: unknown[]) => unknown>>(): Promise<{
      [K in keyof T]: (...args: Parameters<T[K]>) => WorkerpoolPromise<ReturnType<T[K]>>;
    }>;
    stats(): PoolStats;
    terminate(force?: boolean, timeout?: number): Promise<void>;
  }

  export function pool(script?: string | null, options?: PoolOptions): Pool;

  export function worker(
    methods: Record<string, (...args: unknown[]) => unknown>,
    options?: { onTerminate?: (code: number | undefined) => void | PromiseLike<void> }
  ): void;

  export class Transfer {
    constructor(value: unknown, transferList?: Transferable[]);
    message: unknown;
    transfer: Transferable[];
  }

  export function isMainThread(): boolean;

  export const platform: string;
  export const cpus: number;
}
