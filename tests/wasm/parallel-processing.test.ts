/**
 * Parallel Processing Tests
 *
 * Tests for parallel/multi-core processing including:
 * - ParallelMatrix operations
 * - Worker pool management
 * - SharedArrayBuffer usage
 * - Parallel WASM hybrid processing
 * - Sequential fallback behavior
 *
 * Adapted from Mathjs test/wasm/unit-tests/wasm/parallel-processing.test.ts
 * Import paths updated for Mathts monorepo structure.
 */
import assert from 'assert'
import { describe, it, afterAll } from 'vitest'

const EPSILON = 1e-10

function approxEqual(actual: number, expected: number, tolerance = EPSILON): void {
  const diff = Math.abs(actual - expected)
  assert.ok(
    diff <= tolerance,
    `Expected ${actual} to be approximately equal to ${expected} (diff: ${diff})`,
  )
}

function approxArrayEqual(
  actual: ArrayLike<number>,
  expected: number[],
  tolerance = EPSILON,
): void {
  assert.strictEqual(actual.length, expected.length, 'Array lengths should match')
  for (let i = 0; i < expected.length; i++) {
    approxEqual(actual[i], expected[i], tolerance)
  }
}

function shouldSkip(err: Error): boolean {
  return (
    err.message.includes('Cannot find module') ||
    err.message.includes('workerpool') ||
    err.message.includes('worker script') ||
    err.message.includes('not implemented')
  )
}

describe('Parallel Processing Tests', { timeout: 30000 }, () => {
  describe('ParallelMatrix Class', () => {
    it('should import ParallelMatrix module', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        assert.ok(ParallelMatrix, 'ParallelMatrix should be importable')
        assert.ok(typeof ParallelMatrix.configure === 'function', 'Should have configure method')
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should configure parallel processing options', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        ParallelMatrix.configure({
          minSizeForParallel: 500,
          maxWorkers: 2,
          useSharedMemory: false,
        })

        assert.ok(true, 'Configuration accepted')

        // Reset to defaults
        ParallelMatrix.configure({
          minSizeForParallel: 1000,
        })
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Parallel Matrix Addition', () => {
    it('should add small arrays sequentially', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array([1, 2, 3, 4, 5])
        const b = new Float64Array([5, 4, 3, 2, 1])

        const result = await ParallelMatrix.add(a, b, 5)

        approxArrayEqual(result, [6, 6, 6, 6, 6])
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should add large arrays in parallel', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        ParallelMatrix.configure({ minSizeForParallel: 100 })

        const size = 1000
        const a = new Float64Array(size)
        const b = new Float64Array(size)

        for (let i = 0; i < size; i++) {
          a[i] = i
          b[i] = size - i
        }

        const result = await ParallelMatrix.add(a, b, size)

        assert.strictEqual(result.length, size)
        approxEqual(result[0], size)
        approxEqual(result[500], size)
        approxEqual(result[999], size)

        ParallelMatrix.configure({ minSizeForParallel: 1000 })
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Parallel Matrix Subtraction', () => {
    it('should subtract arrays', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array([10, 20, 30, 40, 50])
        const b = new Float64Array([1, 2, 3, 4, 5])

        const result = await ParallelMatrix.subtract(a, b, 5)

        approxArrayEqual(result, [9, 18, 27, 36, 45])
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Parallel Scalar Multiplication', () => {
    it('should scale arrays', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array([1, 2, 3, 4, 5])

        const result = await ParallelMatrix.scale(a, 2.5, 5)

        approxArrayEqual(result, [2.5, 5, 7.5, 10, 12.5])
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Parallel Element-wise Multiplication', () => {
    it('should perform Hadamard product', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array([1, 2, 3, 4])
        const b = new Float64Array([5, 6, 7, 8])

        const result = await ParallelMatrix.elementMultiply(a, b, 4)

        approxArrayEqual(result, [5, 12, 21, 32])
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Parallel Matrix Transpose', () => {
    it('should transpose matrix', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        // 2x3 matrix [[1,2,3],[4,5,6]]
        const a = new Float64Array([1, 2, 3, 4, 5, 6])

        const result = await ParallelMatrix.transpose(a, 2, 3)

        // 3x2 result [[1,4],[2,5],[3,6]]
        approxArrayEqual(result, [1, 4, 2, 5, 3, 6])
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Parallel Dot Product', () => {
    it('should compute dot product', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array([1, 2, 3, 4])
        const b = new Float64Array([5, 6, 7, 8])

        // Dot product: 1*5 + 2*6 + 3*7 + 4*8 = 70
        const result = await ParallelMatrix.dotProduct(a, b, 4)

        approxEqual(result, 70)
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Parallel Sum', () => {
    it('should compute sum', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        const result = await ParallelMatrix.sum(a, 10)

        approxEqual(result, 55)
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Parallel Matrix Multiplication', () => {
    it('should multiply small matrices sequentially', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        // A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]]
        // C = A * B = [[19, 22], [43, 50]]
        const A = new Float64Array([1, 2, 3, 4])
        const B = new Float64Array([5, 6, 7, 8])

        const result = await ParallelMatrix.multiply(A, 2, 2, B, 2, 2)

        approxArrayEqual(result, [19, 22, 43, 50])
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should multiply non-square matrices', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        // A (2x3) * B (3x2)
        const A = new Float64Array([1, 2, 3, 4, 5, 6])
        const B = new Float64Array([7, 8, 9, 10, 11, 12])

        const result = await ParallelMatrix.multiply(A, 2, 3, B, 3, 2)

        approxArrayEqual(result, [58, 64, 139, 154])
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Worker Pool Management', () => {
    it('should provide pool statistics', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array([1, 2, 3])
        await ParallelMatrix.add(a, a, 3)

        const stats = ParallelMatrix.getStats()

        if (stats) {
          assert.ok(typeof stats.totalWorkers === 'number', 'Should have totalWorkers')
          assert.ok(typeof stats.busyWorkers === 'number', 'Should have busyWorkers')
          assert.ok(typeof stats.idleWorkers === 'number', 'Should have idleWorkers')
          assert.ok(typeof stats.pendingTasks === 'number', 'Should have pendingTasks')
        }
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should terminate worker pool', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array([1, 2, 3])
        await ParallelMatrix.add(a, a, 3)

        await ParallelMatrix.terminate()

        const stats = ParallelMatrix.getStats()
        assert.strictEqual(stats, null, 'Stats should be null after termination')
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should reinitialize after termination', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        await ParallelMatrix.terminate()

        const a = new Float64Array([1, 2, 3, 4])
        const b = new Float64Array([4, 3, 2, 1])

        const result = await ParallelMatrix.add(a, b, 4)

        approxArrayEqual(result, [5, 5, 5, 5])
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('SharedArrayBuffer Support', () => {
    it('should detect SharedArrayBuffer availability', async () => {
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined'
      assert.ok(typeof hasSharedArrayBuffer === 'boolean')
    })

    it('should work without SharedArrayBuffer', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        ParallelMatrix.configure({
          useSharedMemory: false,
          minSizeForParallel: 100,
        })

        const size = 200
        const a = new Float64Array(size)
        const b = new Float64Array(size)

        for (let i = 0; i < size; i++) {
          a[i] = i
          b[i] = 1
        }

        const result = await ParallelMatrix.add(a, b, size)

        approxEqual(result[0], 1)
        approxEqual(result[99], 100)
        approxEqual(result[199], 200)

        ParallelMatrix.configure({ minSizeForParallel: 1000 })
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Sequential Fallback', () => {
    it('should use sequential path for small operations', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        ParallelMatrix.configure({ minSizeForParallel: 100000 })

        const startTime = Date.now()
        const a = new Float64Array([1, 2, 3, 4, 5])
        const b = new Float64Array([5, 4, 3, 2, 1])

        const result = await ParallelMatrix.add(a, b, 5)
        const duration = Date.now() - startTime

        assert.ok(duration < 50, `Sequential should be fast, took ${duration}ms`)
        approxArrayEqual(result, [6, 6, 6, 6, 6])

        ParallelMatrix.configure({ minSizeForParallel: 1000 })
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle empty arrays', async () => {
      try {
        const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')

        const a = new Float64Array(0)
        const b = new Float64Array(0)

        const result = await ParallelMatrix.add(a, b, 0)

        assert.strictEqual(result.length, 0)
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  afterAll(async () => {
    try {
      const { ParallelMatrix } = await import('../../parallel/src/ParallelMatrix.js')
      await ParallelMatrix.terminate()
    } catch {
      // Ignore cleanup errors
    }
  })
})
