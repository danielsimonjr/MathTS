import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkerPool } from '../src/WorkerPool.js';

/**
 * Lifecycle edges of the pool that the timeout contract depends on: a task that waits in
 * the queue must still time out, and a pool that is terminated must leave no live worker
 * and no pending timer behind. Workers are synthetic; none is ever started.
 */

class FakeWorker {
  public terminated = false;
  public lastMessage: unknown = null;
  postMessage(msg: unknown): void {
    this.lastMessage = msg;
  }
  terminate(): void {
    this.terminated = true;
  }
}

/** Shape of the pool internals that the tests seed by hand. */
interface PoolInternals {
  workers: FakeWorker[];
  availableWorkers: FakeWorker[];
  taskQueue: unknown[];
  activeTasks: Map<string, unknown>;
  maxWorkers: number;
  workerScript: string;
  isNode: boolean;
  processQueue(): void;
  execute(data: unknown, transferables?: Transferable[], timeoutMs?: number): Promise<unknown>;
  terminate(): Promise<void>;
}

function bareParts(): PoolInternals {
  const pool = Object.create(WorkerPool.prototype) as PoolInternals;
  pool.workers = [];
  pool.availableWorkers = [];
  pool.taskQueue = [];
  pool.activeTasks = new Map();
  pool.maxWorkers = 1;
  pool.workerScript = '/* fake */';
  pool.isNode = false;
  return pool;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('WorkerPool: a task that waits in the queue', () => {
  it('times out instead of hanging when no worker is free', async () => {
    const pool = bareParts();
    const outcome = await Promise.race([
      pool.execute({ payload: 1 }, undefined, 30).then(
        () => 'resolved' as const,
        (error: Error) => error
      ),
      sleep(1_000).then(() => 'hung' as const),
    ]);
    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toMatch(/timed out after 30ms/);
    expect(pool.taskQueue).toHaveLength(0);
  });

  it('is gone from the queue, so a worker that appears later never runs it', async () => {
    const pool = bareParts();
    await expect(pool.execute({ payload: 1 }, undefined, 20)).rejects.toThrow(/timed out/);
    const worker = new FakeWorker();
    pool.workers.push(worker);
    pool.availableWorkers.push(worker);
    pool.processQueue();
    expect(worker.lastMessage).toBeNull();
    expect(pool.activeTasks.size).toBe(0);
  });
});

describe('WorkerPool.terminate()', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops a worker that was still starting when it was called', async () => {
    const created: FakeWorker[] = [];
    const gates: (() => void)[] = [];
    class GatedPool extends WorkerPool {
      protected async createWorker(): Promise<Worker> {
        const worker = new FakeWorker();
        created.push(worker);
        await new Promise<void>((resolve) => gates.push(resolve));
        return worker as unknown as Worker;
      }
    }
    const pool = new GatedPool('/* fake */', 3);
    expect(created).toHaveLength(1);
    await pool.terminate();
    gates[0]!();
    await sleep(20);
    expect(created[0]!.terminated).toBe(true);
    // The loop stopped: no second and third worker were spawned after the terminate.
    expect(created).toHaveLength(1);
    expect(pool.workerCount).toBe(0);
  });

  it('rejects execute() calls that come after it', async () => {
    const pool = bareParts();
    await pool.terminate();
    await expect(pool.execute({ payload: 1 }, undefined, 30)).rejects.toThrow(/terminated/);
  });

  it('cancels the timers of the tasks it rejects', async () => {
    vi.useFakeTimers();
    const pool = bareParts();
    const worker = new FakeWorker();
    pool.workers.push(worker);
    pool.availableWorkers.push(worker);
    const active = pool.execute({ payload: 1 }, undefined, 60_000);
    const queued = pool.execute({ payload: 2 }, undefined, 60_000);
    const outcomes = Promise.allSettled([active, queued]);
    expect(vi.getTimerCount()).toBe(2);
    await pool.terminate();
    expect(vi.getTimerCount()).toBe(0);
    const settled = await outcomes;
    expect(settled.map((s) => s.status)).toEqual(['rejected', 'rejected']);
  });
});
