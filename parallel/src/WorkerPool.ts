/**
 * WorkerPool manages a pool of Web Workers for parallel computation
 * Supports both Node.js (worker_threads) and browser (Web Workers)
 */

import { importModule } from '@danielsimonjr/mathts-core/internal';
import type { TransferableLike } from '@danielsimonjr/mathts-workerpool';

/**
 * A worker of the pool: the global `Worker` class instance when the compiling project has the
 * DOM or Node worker types, and a minimal handle when it has not. The published declarations
 * must load without either (`skipLibCheck: false`, no `@types/node`, no DOM lib).
 */
export type PoolWorker = typeof globalThis extends { Worker: { prototype: infer W } }
  ? W
  : { postMessage(message: unknown, transfer?: TransferableLike[]): void; terminate(): unknown };

interface WorkerTask<T = unknown, R = unknown> {
  id: string;
  data: T;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
  transferables?: TransferableLike[];
  /**
   * Timer handle used to enforce execute()'s timeoutMs parameter.
   * Cleared on resolve/reject.
   */
  timeoutHandle?: ReturnType<typeof setTimeout>;
  /**
   * The worker currently executing this task. Set by executeTask so the
   * timeout handler can terminate the right worker.
   */
  worker?: PoolWorker;
}

interface WorkerMessage<T = unknown> {
  id: string;
  type: 'task' | 'result' | 'error';
  data?: T;
  error?: string;
}

/** Monotonic task id source, shared by all pools so ids are unique per process. */
let taskCounter = 0;

/**
 * Runs tasks on a set of workers and queues tasks when no worker is free.
 *
 * The pool uses `worker_threads` when `process.versions.node` is defined, and
 * module Web Workers otherwise. When the caller gives no worker count, the
 * count is `navigator.hardwareConcurrency - 1` (minimum 2), or 4 when that
 * value is not available. A worker error rejects only the tasks that worker was
 * running; the crashed worker is terminated, evicted and replaced so the pool keeps
 * its capacity, and the other workers are untouched.
 * `terminate` rejects all queued and active tasks and stops all workers.
 */
export class WorkerPool {
  private workers: PoolWorker[] = [];
  private availableWorkers: PoolWorker[] = [];
  // FIFO queue. `shift()` is O(n) but queues here hold a handful of chunk tasks (one
  // per worker per operation), so an index-based ring buffer would not pay for itself.
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<string, WorkerTask> = new Map();
  private maxWorkers: number;
  private workerScript: string;
  private isNode: boolean;
  private terminated = false;
  /** Workers that have delivered at least one message (so their script loads). */
  private readyWorkers = new WeakSet<PoolWorker>();
  /** Consecutive crashes of workers that never became ready. */
  private startupFailures = 0;

  constructor(workerScript: string, maxWorkers?: number) {
    if (typeof workerScript !== 'string' || workerScript.length === 0) {
      throw new TypeError('WorkerPool requires a workerScript URL or path');
    }
    // 0 (and undefined) mean auto-detect, the convention `ParallelConfig` documents.
    if (maxWorkers !== undefined && (!Number.isInteger(maxWorkers) || maxWorkers < 0)) {
      throw new RangeError(
        `WorkerPool: maxWorkers must be a non-negative integer, 0 for auto (got ${maxWorkers})`
      );
    }
    this.workerScript = workerScript;
    this.maxWorkers = maxWorkers || this.getOptimalWorkerCount();
    this.isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
    // initialize() is async. A rejection here (invalid file:// URL, worker_threads
    // import failure) must not surface as an unhandled rejection from the constructor.
    void this.initialize().catch((err: unknown) => {
      console.error('WorkerPool: failed to initialize workers:', err);
    });
  }

  private getOptimalWorkerCount(): number {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      return Math.max(2, navigator.hardwareConcurrency - 1);
    }
    return 4; // fallback
  }

  private async initialize(): Promise<void> {
    // Spawn all workers concurrently; each one joins the pool as soon as it is ready.
    await Promise.all(
      Array.from({ length: this.maxWorkers }, async () => {
        const worker = await this.createWorker();
        if (this.terminated) {
          // terminate() ran while this worker was starting; it is not in `workers`, so
          // nothing else would ever stop it.
          worker.terminate();
          return;
        }
        this.workers.push(worker);
        this.availableWorkers.push(worker);
        // A task may have been submitted (and queued) before this worker
        // finished spawning — initialize() is fire-and-forget from the
        // constructor. Drain the queue now that a worker is available.
        this.processQueue();
      })
    );
  }

  /** `worker_threads`, imported once per pool and shared by every concurrent spawn. */
  private workerThreadsModule?: Promise<typeof import('node:worker_threads')>;

  private nodeWorkerThreads(): Promise<typeof import('node:worker_threads')> {
    this.workerThreadsModule ??= importModule('node:worker_threads') as Promise<
      typeof import('node:worker_threads')
    >;
    return this.workerThreadsModule;
  }

  protected async createWorker(): Promise<PoolWorker> {
    let worker: PoolWorker;

    if (this.isNode) {
      // Node.js worker_threads
      const { Worker: NodeWorker } = await this.nodeWorkerThreads();
      // Node's worker_threads Worker rejects raw file:// strings — it requires
      // either an absolute/relative path or a URL object. Wrap file:// URLs in
      // `new URL`; pass plain paths through unchanged.
      const script = this.workerScript.startsWith('file://')
        ? new URL(this.workerScript)
        : this.workerScript;
      const nodeWorker = new NodeWorker(script);

      // Node's worker_threads.Worker is an EventEmitter — it does NOT support
      // the browser-style `worker.onmessage = fn` / `worker.onerror = fn`
      // assignment (that just sets an inert property). Listeners must be
      // registered via `.on(...)`, and the 'message' event delivers the
      // posted value directly (not wrapped in a MessageEvent).
      nodeWorker.on('message', (data: WorkerMessage) => {
        this.handleWorkerMessage(worker, data);
      });
      nodeWorker.on('error', (error: Error) => {
        this.handleWorkerError(worker, { message: error.message } as ErrorEvent);
      });

      worker = nodeWorker as unknown as PoolWorker;
    } else {
      // Browser Web Worker
      worker = new Worker(this.workerScript, { type: 'module' });

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(worker, event.data);
      };

      worker.onerror = (error: ErrorEvent) => {
        this.handleWorkerError(worker, error);
      };
    }

    return worker;
  }

  private handleWorkerMessage(worker: PoolWorker, message: WorkerMessage): void {
    this.readyWorkers.add(worker);
    this.startupFailures = 0;
    const task = this.activeTasks.get(message.id);
    if (!task) {
      // The task is gone (timed out or rejected) but the worker is still a member of the
      // pool and now idle: give it back, unless it was evicted, is already free, or is
      // still running another task (a script that posts twice for one id).
      if (
        this.workers.includes(worker) &&
        !this.availableWorkers.includes(worker) &&
        !this.isBusy(worker)
      ) {
        this.availableWorkers.push(worker);
        this.processQueue();
      }
      return;
    }

    this.activeTasks.delete(message.id);
    if (task.timeoutHandle) {
      clearTimeout(task.timeoutHandle);
      task.timeoutHandle = undefined;
    }

    if (message.type === 'result') {
      task.resolve(message.data);
    } else if (message.type === 'error') {
      task.reject(new Error(message.error || 'Worker error'));
    }

    // Return worker to pool and process next task
    this.availableWorkers.push(worker);
    this.processQueue();
  }

  private handleWorkerError(worker: PoolWorker, error: ErrorEvent): void {
    console.error('Worker error:', error);
    if (!this.workers.includes(worker)) return; // already evicted (timeout/terminate)
    // Reject only the tasks this worker was running.
    for (const [id, task] of this.activeTasks) {
      if (task.worker === worker) {
        this.activeTasks.delete(id);
        this.clearTaskTimer(task);
        task.reject(new Error(`Worker error: ${error.message}`));
      }
    }
    if (!this.readyWorkers.has(worker)) {
      // The worker died before ever answering: the script itself is likely broken
      // (bad path, top-level throw). Cap the respawns so a deterministic failure
      // does not loop forever, and fail the queued tasks instead of hanging them.
      this.startupFailures++;
      if (this.startupFailures >= WorkerPool.MAX_STARTUP_FAILURES) {
        this.workers = this.workers.filter((w) => w !== worker);
        this.availableWorkers = this.availableWorkers.filter((w) => w !== worker);
        try {
          worker.terminate();
        } catch {
          /* already dead */
        }
        const reason = new Error(
          `WorkerPool: ${this.startupFailures} consecutive workers failed before becoming ready (${error.message}); not respawning`
        );
        for (const task of this.taskQueue.splice(0)) {
          this.clearTaskTimer(task);
          task.reject(reason);
        }
        return;
      }
    }
    void this.evictAndReplace(worker);
  }

  /** Consecutive never-ready worker crashes tolerated before the pool stops respawning. */
  static readonly MAX_STARTUP_FAILURES = 3;

  private isBusy(worker: PoolWorker): boolean {
    for (const task of this.activeTasks.values()) {
      if (task.worker === worker) return true;
    }
    return false;
  }

  /** Terminate a crashed worker, drop it from the roster and spawn a replacement. */
  private async evictAndReplace(dead: PoolWorker): Promise<void> {
    try {
      dead.terminate();
    } catch {
      /* swallow — replacement is what matters */
    }
    this.workers = this.workers.filter((w) => w !== dead);
    this.availableWorkers = this.availableWorkers.filter((w) => w !== dead);
    if (this.terminated) return;
    try {
      const replacement = await this.createWorker();
      if (this.terminated) {
        replacement.terminate();
        return;
      }
      this.workers.push(replacement);
      this.availableWorkers.push(replacement);
      this.processQueue();
    } catch (err) {
      console.error('WorkerPool: failed to spawn replacement worker:', err);
    }
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift()!;
      const worker = this.availableWorkers.shift()!;
      this.executeTask(worker, task);
    }
  }

  private executeTask(worker: PoolWorker, task: WorkerTask): void {
    this.activeTasks.set(task.id, task);
    task.worker = worker;

    const message: WorkerMessage = {
      id: task.id,
      type: 'task',
      data: task.data,
    };

    if (task.transferables && task.transferables.length > 0) {
      worker.postMessage(message, task.transferables);
    } else {
      worker.postMessage(message);
    }
  }

  /**
   * Handle a timed-out task: terminate the offending worker, evict it from
   * the pool, spawn a replacement so subsequent calls still find a free
   * worker, and reject the task.
   */
  private async handleTaskTimeout(task: WorkerTask, timeoutMs: number): Promise<void> {
    const queuedAt = this.taskQueue.indexOf(task);
    if (queuedAt >= 0) {
      // No worker ever picked this task up (all busy, or none has started). It must still
      // fail on time, and it must not run later with its timer gone.
      this.taskQueue.splice(queuedAt, 1);
      task.reject(new Error(`Worker task timed out after ${timeoutMs}ms`));
      return;
    }
    if (!this.activeTasks.has(task.id)) return; // already resolved
    this.activeTasks.delete(task.id);

    const dead = task.worker;
    if (dead) {
      try {
        dead.terminate();
      } catch {
        /* swallow — replacement is what matters */
      }
      // Evict from pool roster.
      this.workers = this.workers.filter((w) => w !== dead);
      this.availableWorkers = this.availableWorkers.filter((w) => w !== dead);

      // Spawn a replacement so the pool keeps its capacity.
      try {
        const replacement = await this.createWorker();
        if (this.terminated) {
          replacement.terminate();
          task.reject(new Error(`Worker task timed out after ${timeoutMs}ms`));
          return;
        }
        this.workers.push(replacement);
        this.availableWorkers.push(replacement);
        this.processQueue();
      } catch (err) {
        // Best effort — log only; do not mask the timeout error below.
        console.error('WorkerPool: failed to spawn replacement worker:', err);
      }
    }

    task.reject(new Error(`Worker task timed out after ${timeoutMs}ms`));
  }

  /**
   * Submit work to the pool.
   *
   * @param data Payload sent to the worker.
   * @param transferables Optional transferables for zero-copy postMessage.
   * @param timeoutMs Optional timeout in milliseconds. When the worker does
   *   not reply within `timeoutMs` the worker is `terminate()`d, a fresh
   *   replacement is spawned, and the returned promise rejects. Pass `0`
   *   or omit to disable the timeout (legacy behaviour).
   */
  public async execute<T = unknown, R = unknown>(
    data: T,
    transferables?: TransferableLike[],
    timeoutMs?: number
  ): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      if (this.terminated) {
        reject(new Error('WorkerPool terminated'));
        return;
      }
      // The pool stores tasks heterogeneously (WorkerTask<unknown, unknown>);
      // the worker reply is opaque, so narrow it back to R at this boundary.
      const task: WorkerTask = {
        id: this.generateTaskId(),
        data,
        resolve: (value) => resolve(value as R),
        reject,
        transferables,
      };

      if (typeof timeoutMs === 'number' && timeoutMs > 0) {
        task.timeoutHandle = setTimeout(() => {
          // Fire-and-forget; handleTaskTimeout itself rejects the task.
          void this.handleTaskTimeout(task, timeoutMs);
        }, timeoutMs);
      }

      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.shift()!;
        this.executeTask(worker, task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  private generateTaskId(): string {
    return `task_${++taskCounter}`;
  }

  public async terminate(): Promise<void> {
    this.terminated = true;
    // Cancel all pending tasks
    for (const task of this.taskQueue) {
      this.clearTaskTimer(task);
      task.reject(new Error('WorkerPool terminated'));
    }
    this.taskQueue = [];

    // Cancel all active tasks
    for (const task of this.activeTasks.values()) {
      this.clearTaskTimer(task);
      task.reject(new Error('WorkerPool terminated'));
    }
    this.activeTasks.clear();

    // Terminate all workers
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
  }

  private clearTaskTimer(task: WorkerTask): void {
    if (task.timeoutHandle !== undefined) {
      clearTimeout(task.timeoutHandle);
      task.timeoutHandle = undefined;
    }
  }

  public get activeTaskCount(): number {
    return this.activeTasks.size;
  }

  public get queuedTaskCount(): number {
    return this.taskQueue.length;
  }

  public get workerCount(): number {
    return this.workers.length;
  }
}
