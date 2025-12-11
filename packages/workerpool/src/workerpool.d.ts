/**
 * Type declarations for workerpool
 */

declare module 'workerpool' {
  export interface PoolOptions {
    minWorkers?: number | 'max';
    maxWorkers?: number;
    workerType?: 'auto' | 'web' | 'thread';
    workerTerminateTimeout?: number;
    forkArgs?: string[];
    forkOpts?: object;
    onCreateWorker?: () => void;
    onTerminateWorker?: () => void;
    emitStdStreams?: boolean;
  }

  export interface ExecOptions {
    on?: (payload: unknown) => void;
    transfer?: Transferable[];
    timeout?: number;
  }

  export interface PoolStats {
    totalWorkers: number;
    busyWorkers: number;
    idleWorkers: number;
    pendingTasks: number;
    activeTasks: number;
  }

  export interface Pool {
    exec<T = unknown>(method: string, params?: unknown[], options?: ExecOptions): Promise<T>;
    proxy(): Promise<Record<string, (...args: unknown[]) => Promise<unknown>>>;
    stats(): PoolStats;
    terminate(force?: boolean, timeout?: number): Promise<void>;
  }

  export function pool(script?: string | null, options?: PoolOptions): Pool;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function worker(methods: Record<string, (...args: any[]) => any>): void;

  export class Transfer {
    constructor(value: unknown, transferList?: Transferable[]);
    value: unknown;
    transferList: Transferable[];
  }

  export function isMainThread(): boolean;

  export const platform: string;
  export const cpus: number;
}
