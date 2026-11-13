/**
 * Public types of the worker pool, written here so that the published declarations name no
 * type of the `workerpool` package and no DOM or Node global (`Transferable`, `Worker`, `URL`).
 * A consumer with `skipLibCheck: false` and without `@types/node` can then load them.
 *
 * @packageDocumentation
 */
import { Transfer as WorkerpoolTransfer } from 'workerpool';

/**
 * An object that a worker call can transfer instead of copy: an `ArrayBuffer`, a
 * `MessagePort`, an `ImageBitmap`, ... The DOM `Transferable` union is not available
 * to every consumer, so the public type is any object.
 */
export type TransferableLike = object;

export interface ExecOptions<T = unknown> {
  on?: (payload: unknown) => void;
  transfer?: TransferableLike[];
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

/** A task result that carries a message plus the objects to transfer with it. */
export interface TransferDescriptor<T = unknown> {
  message: T;
  transfer: TransferableLike[];
}

/** The pool object of the `workerpool` package, reduced to the members MathTS uses. */
export interface Pool {
  exec<T>(
    method: string | ((...args: unknown[]) => T),
    params?: unknown[],
    options?: ExecOptions
  ): WorkerpoolPromise<T>;
  proxy<T extends Record<string, (...args: unknown[]) => unknown>>(): Promise<WorkerProxy<T>>;
  stats(): PoolStats;
  terminate(force?: boolean, timeout?: number): Promise<void>;
}

/** The functions of a worker object as seen from the pool. */
export type WorkerProxy<T extends Record<string, (...args: unknown[]) => unknown>> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => WorkerpoolPromise<ReturnType<T[K]>>;
};

/** Wraps a task result with the objects to transfer (zero-copy) to the other thread. */
export const Transfer: new <T = unknown>(
  message: T,
  transfer: TransferableLike[]
) => TransferDescriptor<T> = WorkerpoolTransfer;
export type Transfer<T = unknown> = TransferDescriptor<T>;
