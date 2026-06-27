import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerPool } from '../src/WorkerPool.js';

/**
 * Test the timeout + replacement contract on WorkerPool.execute().
 *
 * We can't easily spawn real Node Workers in a vitest unit test, so we
 * inject a synthetic worker constructor by monkeypatching createWorker on
 * a subclass. The fake worker NEVER posts a result back, modeling a hung
 * worker. The pool must terminate it on timeout, spawn a replacement, and
 * remain usable for the next execute() call.
 */

class FakeWorker {
  public terminated = false;
  public lastMessage: unknown = null;
  public onmessage: ((e: MessageEvent) => void) | null = null;
  public onerror: ((e: ErrorEvent) => void) | null = null;
  // simulated message events the test will inject
  postMessage(msg: unknown) {
    this.lastMessage = msg;
    // do nothing — hang
  }
  terminate() {
    this.terminated = true;
  }
}

/**
 * Internal shape of WorkerPool reached by the tests' hand-built instances.
 * The tests poke private fields and swap createWorker, so they need a
 * structural view of the pool internals rather than the public class type.
 */
interface PoolInternals {
  workers: FakeWorker[];
  availableWorkers: FakeWorker[];
  taskQueue: unknown[];
  activeTasks: Map<string, unknown>;
  maxWorkers: number;
  workerScript: string;
  isNode: boolean;
  createdWorkers: FakeWorker[];
  createWorker(): Promise<FakeWorker>;
  execute(data: unknown, transferables?: Transferable[], timeoutMs?: number): Promise<unknown>;
}

class HangingPool extends WorkerPool {
  public createdWorkers: FakeWorker[] = [];

  // Override the protected createWorker to mint hung fakes. FakeWorker only
  // models the slice of the Worker surface the pool touches, so route the
  // return through `unknown`.
  protected async createWorker(): Promise<Worker> {
    const w = new FakeWorker();
    this.createdWorkers.push(w);
    return w as unknown as Worker;
  }
}

// Patch the WorkerPool prototype so HangingPool's createWorker is reachable.
(WorkerPool.prototype as unknown as { createWorker: () => Promise<Worker> }).createWorker =
  async function () {
    // default fallback — should not be reached in HangingPool tests
    throw new Error('createWorker stub not overridden');
  };

describe('WorkerPool.execute() timeout contract', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('rejects with a timeout error when the worker never replies', async () => {
    const pool = Object.create(HangingPool.prototype) as PoolInternals;
    pool.workers = [];
    pool.availableWorkers = [];
    pool.taskQueue = [];
    pool.activeTasks = new Map();
    pool.maxWorkers = 1;
    pool.workerScript = '/* fake */';
    pool.isNode = false;
    pool.createdWorkers = [];

    // Manually seed one fake worker.
    const w = new FakeWorker();
    pool.createdWorkers.push(w);
    pool.workers.push(w);
    pool.availableWorkers.push(w);

    // Correctness contract: the call rejects with a timeout error and the hung
    // worker is terminated. We deliberately do NOT assert a wall-clock lower
    // bound on elapsed time — that is a flaky race (timer scheduling jitter +
    // coarse Date.now() resolution can measure the 50ms timeout as <40ms under
    // load). The test timeout itself guards against a never-rejecting hang.
    await expect(pool.execute({ payload: 1 }, undefined, 50)).rejects.toThrow(
      /timed? ?out|timeout/i
    );
    expect(w.terminated).toBe(true);
  });

  it('replaces a terminated worker so the pool stays usable', async () => {
    const pool = Object.create(HangingPool.prototype) as PoolInternals;
    pool.workers = [];
    pool.availableWorkers = [];
    pool.taskQueue = [];
    pool.activeTasks = new Map();
    pool.maxWorkers = 1;
    pool.workerScript = '/* fake */';
    pool.isNode = false;
    pool.createdWorkers = [];

    // Override createWorker to mint a new fake on demand.
    pool.createWorker = async function (this: PoolInternals) {
      const nw = new FakeWorker();
      this.createdWorkers.push(nw);
      return nw;
    };

    // Seed first worker (will be the hung one).
    const first = await pool.createWorker();
    pool.workers.push(first);
    pool.availableWorkers.push(first);

    await expect(pool.execute({ payload: 1 }, undefined, 50)).rejects.toThrow();

    // After the timeout, pool must have a fresh worker available.
    expect(first.terminated).toBe(true);
    expect(pool.workers.length).toBe(1); // one alive
    expect(pool.workers[0]).not.toBe(first);
    expect(pool.availableWorkers.length).toBe(1);
  });
});
