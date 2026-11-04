import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkerPool } from '../src/WorkerPool.js';

/**
 * A worker that crashes must fail only the task it was running; the other workers keep their
 * tasks, and the pool replaces the crashed worker so its capacity is not lost. Workers are
 * synthetic: they record what was posted and nothing ever runs.
 */

class FakeWorker {
  public terminated = false;
  public posted: { id: string }[] = [];
  postMessage(msg: { id: string }): void {
    this.posted.push(msg);
  }
  terminate(): void {
    this.terminated = true;
  }
}

interface Internals {
  workers: FakeWorker[];
  availableWorkers: FakeWorker[];
  activeTasks: Map<string, unknown>;
  taskQueue: unknown[];
  handleWorkerError(worker: FakeWorker, error: { message: string }): void;
  handleWorkerMessage(
    worker: FakeWorker,
    message: { id: string; type: string; data?: unknown }
  ): void;
}

// The base constructor starts spawning before subclass fields exist, so the roster lives here.
let spawned: FakeWorker[] = [];

class FakePool extends WorkerPool {
  get created(): FakeWorker[] {
    return spawned;
  }
  protected async createWorker(): Promise<Worker> {
    const w = new FakeWorker();
    spawned.push(w);
    return w as unknown as Worker;
  }
  get internals(): Internals {
    return this as unknown as Internals;
  }
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function readyPool(size: number): Promise<FakePool> {
  spawned = [];
  const pool = new FakePool('/* fake */', size);
  await tick();
  expect(pool.workerCount).toBe(size);
  return pool;
}

describe('WorkerPool: a worker error is isolated to its own task', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects only the crashed worker task; the others stay pending and can still finish', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = await readyPool(3);
    const [w1, w2, w3] = pool.created as [FakeWorker, FakeWorker, FakeWorker];

    const settled: Record<string, string> = {};
    const track = (name: string, p: Promise<unknown>): void => {
      p.then(
        (v) => (settled[name] = `ok:${String(v)}`),
        (e: Error) => (settled[name] = `err:${e.message}`)
      );
    };
    track('t1', pool.execute({ n: 1 }));
    track('t2', pool.execute({ n: 2 }));
    track('t3', pool.execute({ n: 3 }));
    expect(pool.activeTaskCount).toBe(3);

    pool.internals.handleWorkerError(w2, { message: 'boom' });
    await tick();

    expect(settled['t2']).toBe('err:Worker error: boom');
    expect(settled['t1']).toBeUndefined();
    expect(settled['t3']).toBeUndefined();
    expect(pool.activeTaskCount).toBe(2);
    expect(w2.terminated).toBe(true);
    expect(w1.terminated).toBe(false);
    expect(w3.terminated).toBe(false);

    pool.internals.handleWorkerMessage(w1, { id: w1.posted[0]!.id, type: 'result', data: 'a' });
    pool.internals.handleWorkerMessage(w3, { id: w3.posted[0]!.id, type: 'result', data: 'c' });
    await tick();
    expect(settled['t1']).toBe('ok:a');
    expect(settled['t3']).toBe('ok:c');
  });

  it('replaces the crashed worker, so capacity is restored and queued work resumes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = await readyPool(2);
    const [w1, w2] = pool.created as [FakeWorker, FakeWorker];

    const p1 = pool.execute({ n: 1 });
    const p2 = pool.execute({ n: 2 });
    p2.catch(() => undefined);
    const queued = pool.execute({ n: 3 }); // both workers busy: waits in the queue
    expect(pool.queuedTaskCount).toBe(1);

    pool.internals.handleWorkerError(w2, { message: 'crash' });
    await expect(p2).rejects.toThrow(/crash/);
    await tick();

    expect(pool.workerCount).toBe(2);
    expect(pool.internals.workers).not.toContain(w2);
    expect(pool.created).toHaveLength(3);
    const replacement = pool.created[2]!;
    // The replacement picked up the queued task.
    expect(replacement.posted).toHaveLength(1);
    expect(pool.queuedTaskCount).toBe(0);

    pool.internals.handleWorkerMessage(w1, { id: w1.posted[0]!.id, type: 'result', data: 1 });
    pool.internals.handleWorkerMessage(replacement, {
      id: replacement.posted[0]!.id,
      type: 'result',
      data: 3,
    });
    await expect(p1).resolves.toBe(1);
    await expect(queued).resolves.toBe(3);
  });

  it('ignores an error from a worker that was already evicted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = await readyPool(1);
    const [w1] = pool.created as [FakeWorker];
    pool.internals.handleWorkerError(w1, { message: 'first' });
    await tick();
    pool.internals.handleWorkerError(w1, { message: 'again' });
    await tick();
    expect(pool.created).toHaveLength(2); // one replacement, not two
    expect(pool.workerCount).toBe(1);
  });

  it('returns a healthy worker to the free list when its task is already gone', async () => {
    const pool = await readyPool(2);
    const [w1] = pool.created as [FakeWorker, FakeWorker];
    void pool.execute({ n: 1 }).catch(() => undefined);
    expect(pool.internals.availableWorkers).not.toContain(w1);
    const id = w1.posted[0]!.id;

    // The task was dropped (rejected elsewhere); the worker's late reply must not strand it.
    pool.internals.activeTasks.delete(id);
    pool.internals.handleWorkerMessage(w1, { id, type: 'result', data: 'late' });
    expect(pool.internals.availableWorkers).toContain(w1);
    // ... and a second late reply does not list it twice.
    pool.internals.handleWorkerMessage(w1, { id, type: 'result', data: 'later' });
    expect(pool.internals.availableWorkers.filter((w) => w === w1)).toHaveLength(1);
  });

  it('does not re-add an evicted worker that replies late', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = await readyPool(1);
    const [w1] = pool.created as [FakeWorker];
    void pool.execute({ n: 1 }).catch(() => undefined);
    pool.internals.handleWorkerError(w1, { message: 'dead' });
    await tick();
    pool.internals.handleWorkerMessage(w1, { id: 'whatever', type: 'result' });
    expect(pool.internals.availableWorkers).not.toContain(w1);
  });
});

describe('WorkerPool: construction and ids', () => {
  it.each([-1, 2.5, Number.NaN, Infinity])('rejects maxWorkers = %s', (bad) => {
    spawned = [];
    expect(() => new FakePool('/* fake */', bad)).toThrow(
      /maxWorkers must be a non-negative integer/
    );
  });

  it('treats maxWorkers = 0 as auto-detect (the ParallelConfig convention)', async () => {
    spawned = [];
    const pool = new FakePool('/* fake */', 0);
    await pool.initialize();
    expect(spawned.length).toBeGreaterThan(0);
    pool.terminate();
  });

  it('gives every task a distinct incrementing id', async () => {
    const pool = await readyPool(2);
    const [w1, w2] = pool.created as [FakeWorker, FakeWorker];
    void pool.execute(1);
    void pool.execute(2);
    const a = w1.posted[0]!.id;
    const b = w2.posted[0]!.id;
    expect(a).toMatch(/^task_\d+$/);
    expect(b).toMatch(/^task_\d+$/);
    expect(Number(b.slice(5))).toBe(Number(a.slice(5)) + 1);
  });
});
