import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkerPool } from '../src/WorkerPool.js'

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
  public terminated = false
  public lastMessage: any = null
  public onmessage: ((e: any) => void) | null = null
  public onerror: ((e: any) => void) | null = null
  // simulated message events the test will inject
  postMessage(msg: any) {
    this.lastMessage = msg
    // do nothing — hang
  }
  terminate() {
    this.terminated = true
  }
}

class HangingPool extends WorkerPool {
  public createdWorkers: FakeWorker[] = []

  // Override the private createWorker via prototype hack.
  // (TypeScript: cast to any, JavaScript: dynamic.)
  protected async createWorker(): Promise<any> {
    const w = new FakeWorker()
    this.createdWorkers.push(w)
    return w as any
  }
}

// Patch the WorkerPool prototype so HangingPool's createWorker is reachable.
;(WorkerPool.prototype as any).createWorker = async function () {
  // default fallback — should not be reached in HangingPool tests
  throw new Error('createWorker stub not overridden')
}

describe('WorkerPool.execute() timeout contract', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('rejects with a timeout error when the worker never replies', async () => {
    const pool: any = Object.create(HangingPool.prototype)
    pool.workers = []
    pool.availableWorkers = []
    pool.taskQueue = []
    pool.activeTasks = new Map()
    pool.maxWorkers = 1
    pool.workerScript = '/* fake */'
    pool.isNode = false
    pool.createdWorkers = []

    // Manually seed one fake worker.
    const w = new FakeWorker()
    pool.createdWorkers.push(w)
    pool.workers.push(w)
    pool.availableWorkers.push(w)

    const start = Date.now()
    await expect(
      pool.execute({ payload: 1 }, undefined, 50)
    ).rejects.toThrow(/timed? ?out|timeout/i)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(40)
    expect(w.terminated).toBe(true)
  })

  it('replaces a terminated worker so the pool stays usable', async () => {
    const pool: any = Object.create(HangingPool.prototype)
    pool.workers = []
    pool.availableWorkers = []
    pool.taskQueue = []
    pool.activeTasks = new Map()
    pool.maxWorkers = 1
    pool.workerScript = '/* fake */'
    pool.isNode = false
    pool.createdWorkers = []

    // Override createWorker to mint a new fake on demand.
    pool.createWorker = async function () {
      const nw = new FakeWorker()
      this.createdWorkers.push(nw)
      return nw
    }

    // Seed first worker (will be the hung one).
    const first = await pool.createWorker()
    pool.workers.push(first)
    pool.availableWorkers.push(first)

    await expect(pool.execute({ payload: 1 }, undefined, 50)).rejects.toThrow()

    // After the timeout, pool must have a fresh worker available.
    expect(first.terminated).toBe(true)
    expect(pool.workers.length).toBe(1) // one alive
    expect(pool.workers[0]).not.toBe(first)
    expect(pool.availableWorkers.length).toBe(1)
  })
})
