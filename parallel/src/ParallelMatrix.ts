/**
 * ParallelMatrix provides parallel/multicore operations for matrix computations
 * Uses SharedArrayBuffer for zero-copy data sharing between workers
 */

import { WorkerPool } from './WorkerPool.js'

export interface MatrixData {
  data: Float64Array | SharedArrayBuffer
  rows: number
  cols: number
  isShared: boolean
}

export interface ParallelConfig {
  minSizeForParallel?: number
  workerScript?: string
  maxWorkers?: number
  useSharedMemory?: boolean
}

/**
 * Resolve the path to the built matrix worker script (`dist/matrix.worker.js`).
 *
 * The worker thread runs a real JavaScript file — `worker_threads.Worker`
 * cannot execute the uncompiled `src/matrix.worker.ts`. tsup emits the worker
 * to `dist/matrix.worker.js` (it is a build entry point), so this module must
 * point the pool at the built artifact regardless of whether `ParallelMatrix`
 * itself is loaded from `src/` (tests) or `dist/`.
 *
 * Mirrors `resolveDefaultWorkerScript` in `packages/workerpool/src/index.ts`.
 *
 * @returns Absolute path (Node) or URL href (browser) to the worker script.
 */
function resolveMatrixWorkerScript(): string {
  const isNode =
    typeof process !== 'undefined' &&
    !!process.versions &&
    !!process.versions.node

  // Browser: the consuming bundler rewrites the worker URL. The built worker
  // is a sibling of the bundled module.
  if (!isNode) {
    return new URL('./matrix.worker.js', import.meta.url).href
  }

  // Node: worker_threads needs a real file on disk. When this module runs
  // from src/ (tests, ts loader) the worker lives in ../dist/; when it runs
  // from dist/ it is a sibling.
  const candidates = [
    new URL('../dist/matrix.worker.js', import.meta.url),
    new URL('./matrix.worker.js', import.meta.url),
  ]
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require('node:fs') as typeof import('node:fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fileURLToPath } = require('node:url') as typeof import('node:url')
    for (const url of candidates) {
      const filePath = fileURLToPath(url)
      if (existsSync(filePath)) return filePath
    }
  } catch {
    // Resolution failed — fall through to the first candidate as a best
    // effort; WorkerPool will surface a clear error if it does not exist.
  }
  return candidates[0].href
}

export class ParallelMatrix {
  private static workerPool: WorkerPool | null = null
  private static config: Required<ParallelConfig> = {
    minSizeForParallel: 1000,
    workerScript: resolveMatrixWorkerScript(),
    maxWorkers: 0, // 0 means auto-detect
    useSharedMemory: typeof SharedArrayBuffer !== 'undefined'
  }

  public static configure(config: ParallelConfig): void {
    this.config = { ...this.config, ...config }
    if (this.workerPool) {
      this.workerPool.terminate()
      this.workerPool = null
    }
  }

  private static getWorkerPool(): WorkerPool {
    if (!this.workerPool) {
      this.workerPool = new WorkerPool(
        this.config.workerScript,
        this.config.maxWorkers || undefined
      )
    }
    return this.workerPool
  }

  /**
   * Determines if an operation should use parallel processing
   */
  private static shouldUseParallel(size: number): boolean {
    return size >= this.config.minSizeForParallel
  }

  /**
   * Convert regular array to SharedArrayBuffer if possible
   */
  private static toSharedBuffer(data: number[] | Float64Array): Float64Array {
    if (!this.config.useSharedMemory) {
      return data instanceof Float64Array ? data : new Float64Array(data)
    }

    const buffer = new SharedArrayBuffer(data.length * Float64Array.BYTES_PER_ELEMENT)
    const sharedArray = new Float64Array(buffer)
    sharedArray.set(data)
    return sharedArray
  }

  /**
   * Number of contiguous row blocks to split a matrix into for the worker
   * pool. Capped so we never produce empty blocks.
   */
  private static blockCount(rows: number): number {
    const pool = this.getWorkerPool()
    return Math.max(1, Math.min(pool.workerCount, rows))
  }

  /**
   * Parallel matrix multiplication: C = A * B
   * Divides work across multiple workers by rows of A. Each worker returns its
   * computed row block, which is copied into the result buffer.
   */
  public static async multiply(
    aData: number[] | Float64Array,
    aRows: number,
    aCols: number,
    bData: number[] | Float64Array,
    bRows: number,
    bCols: number
  ): Promise<Float64Array> {
    const totalSize = aRows * aCols + bRows * bCols

    if (!this.shouldUseParallel(totalSize)) {
      // Use sequential implementation for small matrices
      return this.multiplySequential(aData, aRows, aCols, bData, bRows, bCols)
    }

    const pool = this.getWorkerPool()
    const blocks = this.blockCount(aRows)
    const rowsPerWorker = Math.ceil(aRows / blocks)

    // Convert to shared buffers for zero-copy transfer when available.
    const aShared = this.toSharedBuffer(aData)
    const bShared = this.toSharedBuffer(bData)
    const result = new Float64Array(aRows * bCols)

    const tasks: Promise<{ startRow: number; block: Float64Array }>[] = []
    for (let i = 0; i < blocks; i++) {
      const startRow = i * rowsPerWorker
      const endRow = Math.min(startRow + rowsPerWorker, aRows)

      if (startRow >= aRows) break

      tasks.push(
        pool
          .execute<unknown, Float64Array>({
            operation: 'multiply',
            aData: aShared,
            aRows,
            aCols,
            bData: bShared,
            bRows,
            bCols,
            startRow,
            endRow,
          })
          .then((block) => ({ startRow, block }))
      )
    }

    const blockResults = await Promise.all(tasks)
    for (const { startRow, block } of blockResults) {
      result.set(block, startRow * bCols)
    }
    return result
  }

  /**
   * Sequential matrix multiplication fallback
   */
  private static multiplySequential(
    aData: number[] | Float64Array,
    aRows: number,
    aCols: number,
    bData: number[] | Float64Array,
    bRows: number,
    bCols: number
  ): Float64Array {
    const result = new Float64Array(aRows * bCols)

    for (let i = 0; i < aRows; i++) {
      for (let j = 0; j < bCols; j++) {
        let sum = 0
        for (let k = 0; k < aCols; k++) {
          sum += aData[i * aCols + k] * bData[k * bCols + j]
        }
        result[i * bCols + j] = sum
      }
    }

    return result
  }

  /**
   * Run an element-wise binary operation across the worker pool, copying each
   * worker's returned slice into the result buffer.
   */
  private static async elementwise(
    operation: 'add' | 'subtract' | 'elementMultiply',
    aData: number[] | Float64Array,
    bData: number[] | Float64Array,
    size: number,
    op: (a: number, b: number) => number
  ): Promise<Float64Array> {
    if (size === 0) return new Float64Array(0)

    if (!this.shouldUseParallel(size)) {
      const result = new Float64Array(size)
      for (let i = 0; i < size; i++) {
        result[i] = op(aData[i], bData[i])
      }
      return result
    }

    const pool = this.getWorkerPool()
    const blocks = Math.max(1, Math.min(pool.workerCount, size))
    const chunkSize = Math.ceil(size / blocks)

    const aShared = this.toSharedBuffer(aData)
    const bShared = this.toSharedBuffer(bData)
    const result = new Float64Array(size)

    const tasks: Promise<{ start: number; block: Float64Array }>[] = []
    for (let i = 0; i < blocks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, size)

      if (start >= size) break

      tasks.push(
        pool
          .execute<unknown, Float64Array>({
            operation,
            aData: aShared,
            bData: bShared,
            start,
            end,
          })
          .then((block) => ({ start, block }))
      )
    }

    const blockResults = await Promise.all(tasks)
    for (const { start, block } of blockResults) {
      result.set(block, start)
    }
    return result
  }

  /**
   * Parallel matrix addition: C = A + B
   */
  public static async add(
    aData: number[] | Float64Array,
    bData: number[] | Float64Array,
    size: number
  ): Promise<Float64Array> {
    return this.elementwise('add', aData, bData, size, (a, b) => a + b)
  }

  /**
   * Parallel matrix subtraction: C = A - B
   */
  public static async subtract(
    aData: number[] | Float64Array,
    bData: number[] | Float64Array,
    size: number
  ): Promise<Float64Array> {
    return this.elementwise('subtract', aData, bData, size, (a, b) => a - b)
  }

  /**
   * Parallel element-wise (Hadamard) multiplication: C[i] = A[i] * B[i]
   */
  public static async elementMultiply(
    aData: number[] | Float64Array,
    bData: number[] | Float64Array,
    size: number
  ): Promise<Float64Array> {
    return this.elementwise('elementMultiply', aData, bData, size, (a, b) => a * b)
  }

  /**
   * Parallel scalar multiplication: C[i] = A[i] * scalar
   */
  public static async scale(
    aData: number[] | Float64Array,
    scalar: number,
    size: number
  ): Promise<Float64Array> {
    if (size === 0) return new Float64Array(0)

    if (!this.shouldUseParallel(size)) {
      const result = new Float64Array(size)
      for (let i = 0; i < size; i++) {
        result[i] = aData[i] * scalar
      }
      return result
    }

    const pool = this.getWorkerPool()
    const blocks = Math.max(1, Math.min(pool.workerCount, size))
    const chunkSize = Math.ceil(size / blocks)

    const aShared = this.toSharedBuffer(aData)
    const result = new Float64Array(size)

    const tasks: Promise<{ start: number; block: Float64Array }>[] = []
    for (let i = 0; i < blocks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, size)

      if (start >= size) break

      tasks.push(
        pool
          .execute<unknown, Float64Array>({
            operation: 'scale',
            aData: aShared,
            scalar,
            start,
            end,
          })
          .then((block) => ({ start, block }))
      )
    }

    const blockResults = await Promise.all(tasks)
    for (const { start, block } of blockResults) {
      result.set(block, start)
    }
    return result
  }

  /**
   * Parallel dot product: sum(A[i] * B[i])
   */
  public static async dotProduct(
    aData: number[] | Float64Array,
    bData: number[] | Float64Array,
    size: number
  ): Promise<number> {
    if (size === 0) return 0

    if (!this.shouldUseParallel(size)) {
      let sum = 0
      for (let i = 0; i < size; i++) {
        sum += aData[i] * bData[i]
      }
      return sum
    }

    const pool = this.getWorkerPool()
    const blocks = Math.max(1, Math.min(pool.workerCount, size))
    const chunkSize = Math.ceil(size / blocks)

    const aShared = this.toSharedBuffer(aData)
    const bShared = this.toSharedBuffer(bData)

    const tasks: Promise<number>[] = []
    for (let i = 0; i < blocks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, size)

      if (start >= size) break

      tasks.push(
        pool.execute<unknown, number>({
          operation: 'dot',
          aData: aShared,
          bData: bShared,
          start,
          end,
        })
      )
    }

    const partials = await Promise.all(tasks)
    return partials.reduce((acc, v) => acc + v, 0)
  }

  /**
   * Parallel sum of array elements
   */
  public static async sum(
    aData: number[] | Float64Array,
    size: number
  ): Promise<number> {
    if (size === 0) return 0

    if (!this.shouldUseParallel(size)) {
      let sum = 0
      for (let i = 0; i < size; i++) {
        sum += aData[i]
      }
      return sum
    }

    const pool = this.getWorkerPool()
    const blocks = Math.max(1, Math.min(pool.workerCount, size))
    const chunkSize = Math.ceil(size / blocks)

    const aShared = this.toSharedBuffer(aData)

    const tasks: Promise<number>[] = []
    for (let i = 0; i < blocks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, size)

      if (start >= size) break

      tasks.push(
        pool.execute<unknown, number>({
          operation: 'sum',
          aData: aShared,
          start,
          end,
        })
      )
    }

    const partials = await Promise.all(tasks)
    return partials.reduce((acc, v) => acc + v, 0)
  }

  /**
   * Parallel matrix transpose: B = A^T
   *
   * Each worker transposes a contiguous block of source rows and returns it
   * in a slice-relative column-major layout; the parent scatters each block
   * into the final result.
   */
  public static async transpose(
    data: number[] | Float64Array,
    rows: number,
    cols: number
  ): Promise<Float64Array> {
    const totalSize = rows * cols

    if (!this.shouldUseParallel(totalSize)) {
      const result = new Float64Array(totalSize)
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          result[j * rows + i] = data[i * cols + j]
        }
      }
      return result
    }

    const pool = this.getWorkerPool()
    const blocks = this.blockCount(rows)
    const rowsPerWorker = Math.ceil(rows / blocks)

    const dataShared = this.toSharedBuffer(data)
    const result = new Float64Array(totalSize)

    const tasks: Promise<{ startRow: number; rowCount: number; block: Float64Array }>[] = []
    for (let i = 0; i < blocks; i++) {
      const startRow = i * rowsPerWorker
      const endRow = Math.min(startRow + rowsPerWorker, rows)

      if (startRow >= rows) break

      const rowCount = endRow - startRow
      tasks.push(
        pool
          .execute<unknown, Float64Array>({
            operation: 'transpose',
            data: dataShared,
            rows,
            cols,
            startRow,
            endRow,
          })
          .then((block) => ({ startRow, rowCount, block }))
      )
    }

    const blockResults = await Promise.all(tasks)
    // Each block holds the transpose of rows [startRow, startRow+rowCount):
    // out[j * rowCount + r] = A[(startRow + r) * cols + j]. Scatter it into
    // the cols x rows result: result[j * rows + (startRow + r)].
    for (const { startRow, rowCount, block } of blockResults) {
      for (let j = 0; j < cols; j++) {
        for (let r = 0; r < rowCount; r++) {
          result[j * rows + (startRow + r)] = block[j * rowCount + r]
        }
      }
    }
    return result
  }

  /**
   * Worker pool statistics, or `null` when the pool has not been created.
   */
  public static getStats(): {
    totalWorkers: number
    busyWorkers: number
    idleWorkers: number
    pendingTasks: number
    activeTasks: number
  } | null {
    if (!this.workerPool) return null
    const total = this.workerPool.workerCount
    const busy = this.workerPool.activeTaskCount
    return {
      totalWorkers: total,
      busyWorkers: Math.min(busy, total),
      idleWorkers: Math.max(0, total - busy),
      pendingTasks: this.workerPool.queuedTaskCount,
      activeTasks: busy,
    }
  }

  /**
   * Terminate the worker pool (cleanup)
   */
  public static async terminate(): Promise<void> {
    if (this.workerPool) {
      await this.workerPool.terminate()
      this.workerPool = null
    }
  }
}
