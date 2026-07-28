import { describe, it, expect, vi, afterEach } from 'vitest';
import { WorkerPool } from '../src/WorkerPool.js';

class FakeWorker {
  public terminated = false;
  public lastMessage: unknown = null;
  public listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  // For Node-like workers:
  on(event: string, fn: (...args: unknown[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  // Browser-like
  public onmessage: ((e: MessageEvent) => void) | null = null;
  public onerror: ((e: ErrorEvent) => void) | null = null;

  postMessage(msg: unknown, _transferables?: Transferable[]) {
    this.lastMessage = msg;
  }

  terminate() {
    this.terminated = true;
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
    if (this.listeners['message']) {
      for (const fn of this.listeners['message']) {
        fn({ data }); // worker pool node branch listener is function(data: WorkerMessage) but it receives the raw object
      }
    }
  }

  simulateError(errorMsg: string) {
    if (this.onerror) {
      this.onerror({ message: errorMsg } as ErrorEvent);
    }
    if (this.listeners['error']) {
      for (const fn of this.listeners['error']) {
        fn(new Error(errorMsg));
      }
    }
  }
}

// Intercept `import('worker_threads')` dynamically to return our FakeWorker
vi.mock('worker_threads', () => {
    return { Worker: FakeWorker };
});

class TestPool extends WorkerPool {
    // We get the workers for testing via exposing the private `workers` array.
    public getWorkers(): FakeWorker[] {
        return (this as unknown as { workers: FakeWorker[] }).workers;
    }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 50));

interface MockMessage {
    id: string;
    type: string;
    data?: unknown;
}

describe('WorkerPool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('instantiates and creates the specified worker count', async () => {
    const pool = new TestPool('dummy.js', 2);
    await flushPromises(); // wait for initialization

    expect(pool.workerCount).toBe(2);
    expect(pool.getWorkers().length).toBe(2);
  });

  it('uses optimal worker count when maxWorkers is not provided', async () => {
    // navigator.hardwareConcurrency fallback returns Math.max(2, hardwareConcurrency - 1)
    // If we're in Vitest (JSDOM environment maybe? we see 3 which means hardwareConcurrency=4),
    // we'll just assert it uses a number > 0.
    const pool = new TestPool('dummy.js');
    await flushPromises();

    expect(pool.workerCount).toBeGreaterThan(0);
    expect(pool.getWorkers().length).toBeGreaterThan(0);
  });

  it('executes tasks and returns results', async () => {
    const pool = new TestPool('dummy.js', 1);
    await flushPromises();

    const execPromise = pool.execute({ foo: 'bar' });

    expect(pool.activeTaskCount).toBe(1);
    expect(pool.queuedTaskCount).toBe(0);

    const worker = pool.getWorkers()[0];
    const msg = worker.lastMessage as MockMessage;

    expect(msg.type).toBe('task');
    expect(msg.data).toEqual({ foo: 'bar' });

    if (worker.listeners['message']) {
        for(const fn of worker.listeners['message']) {
            fn({
                id: msg.id,
                type: 'result',
                data: 'baz',
            });
        }
    } else {
        worker.simulateMessage({
            id: msg.id,
            type: 'result',
            data: 'baz',
        });
    }

    const result = await execPromise;
    expect(result).toBe('baz');

    // Task completes, active count should be back to 0
    expect(pool.activeTaskCount).toBe(0);
  });

  it('rejects on explicit worker error message', async () => {
    const pool = new TestPool('dummy.js', 1);
    await flushPromises();

    const execPromise = pool.execute({ foo: 'bar' });

    const worker = pool.getWorkers()[0];
    const msg = worker.lastMessage as MockMessage;

    if (worker.listeners['message']) {
        for(const fn of worker.listeners['message']) {
            fn({
                id: msg.id,
                type: 'error',
                error: 'Simulated task error',
            });
        }
    } else {
        worker.simulateMessage({
            id: msg.id,
            type: 'error',
            error: 'Simulated task error',
        });
    }

    await expect(execPromise).rejects.toThrow('Simulated task error');
  });

  it('rejects tasks when the worker emits an error event', async () => {
    const pool = new TestPool('dummy.js', 1);
    await flushPromises();

    const execPromise = pool.execute({ foo: 'bar' });
    const worker = pool.getWorkers()[0];

    // Simulate worker crashing
    worker.simulateError('Worker crashed');

    await expect(execPromise).rejects.toThrow('Worker error: Worker crashed');
  });

  it('queues tasks when no workers are available', async () => {
    const pool = new TestPool('dummy.js', 1);
    await flushPromises();

    const p1 = pool.execute(1);
    const p2 = pool.execute(2);

    expect(pool.activeTaskCount).toBe(1);
    expect(pool.queuedTaskCount).toBe(1);

    const worker = pool.getWorkers()[0];
    const firstMsg = worker.lastMessage as MockMessage;

    // Complete the first task
    if (worker.listeners['message']) {
        for(const fn of worker.listeners['message']) { fn({ id: firstMsg.id, type: 'result', data: 'res1' }); }
    } else {
        worker.simulateMessage({ id: firstMsg.id, type: 'result', data: 'res1' });
    }

    await p1;

    // After p1 resolves, p2 should become active
    expect(pool.activeTaskCount).toBe(1);
    expect(pool.queuedTaskCount).toBe(0);

    const secondMsg = worker.lastMessage as MockMessage;
    expect(secondMsg.id).not.toBe(firstMsg.id);

    // Complete the second task
    if (worker.listeners['message']) {
        for(const fn of worker.listeners['message']) { fn({ id: secondMsg.id, type: 'result', data: 'res2' }); }
    } else {
        worker.simulateMessage({ id: secondMsg.id, type: 'result', data: 'res2' });
    }

    await p2;
  });

  it('terminates all workers and rejects all pending tasks', async () => {
    const pool = new TestPool('dummy.js', 2);
    await flushPromises();

    // Fill pool + queue 1 task
    const p1 = pool.execute(1);
    const p2 = pool.execute(2);
    const p3 = pool.execute(3);

    expect(pool.activeTaskCount).toBe(2);
    expect(pool.queuedTaskCount).toBe(1);
    expect(pool.workerCount).toBe(2);

    const workers = pool.getWorkers().slice();

    await pool.terminate();

    expect(pool.activeTaskCount).toBe(0);
    expect(pool.queuedTaskCount).toBe(0);
    expect(pool.workerCount).toBe(0);

    for (const w of workers) {
      expect(w.terminated).toBe(true);
    }

    await expect(p1).rejects.toThrow('WorkerPool terminated');
    await expect(p2).rejects.toThrow('WorkerPool terminated');
    await expect(p3).rejects.toThrow('WorkerPool terminated');
  });
});
