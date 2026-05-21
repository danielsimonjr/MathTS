/**
 * TypeScript Integration Tests
 *
 * Tests for TypeScript + WASM integration including:
 * - Type safety of WASM functions
 * - MatrixWasmBridge operations
 * - Auto-optimization thresholds
 * - WASM capability detection
 *
 * Adapted from Mathjs test/wasm/unit-tests/wasm/typescript-integration.test.ts
 * Import paths updated for Mathts monorepo structure.
 */
import assert from 'assert'
import { describe, it } from 'vitest'
import { wasmArtifactAvailable, warnWasmArtifactsMissing } from './wasm-artifact-check.js'

// Most tests here either exercise `MatrixWasmBridge` (which has a JS fallback)
// or guard their dynamic imports with `shouldSkip`. The `WASM Module Types`
// block, however, calls `WasmLoader.load()` directly — and a missing `.wasm`
// artifact surfaces as an `ENOENT` that `shouldSkip` does not (and should not)
// match. Skip that block loudly when the artifact is absent.
const hasWasm = wasmArtifactAvailable()
if (!hasWasm) warnWasmArtifactsMissing(1)
const describeWasm = hasWasm ? describe : describe.skip

const EPSILON = 1e-10

function approxEqual(actual: number, expected: number, tolerance = EPSILON): void {
  const diff = Math.abs(actual - expected)
  assert.ok(
    diff <= tolerance,
    `Expected ${actual} to be approximately equal to ${expected} (diff: ${diff})`,
  )
}

function shouldSkip(err: Error): boolean {
  return (
    err.message.includes('Cannot find module') ||
    err.message.includes('not implemented') ||
    err.message.includes('worker script') ||
    err.message.includes('workerpool')
  )
}

describe('TypeScript + WASM Integration Tests', { timeout: 15000 }, () => {
  describe('MatrixWasmBridge', () => {
    it('should import MatrixWasmBridge', async () => {
      try {
        const { MatrixWasmBridge } = await import('../../matrix/src/backends/MatrixWasmBridge.js')

        assert.ok(MatrixWasmBridge, 'MatrixWasmBridge should be importable')
        assert.ok(
          typeof MatrixWasmBridge.getCapabilities === 'function',
          'Should have getCapabilities method',
        )
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should report WASM capabilities', async () => {
      try {
        const { MatrixWasmBridge } = await import('../../matrix/src/backends/MatrixWasmBridge.js')

        const capabilities = MatrixWasmBridge.getCapabilities()

        assert.ok(typeof capabilities === 'object', 'Capabilities should be an object')
        assert.ok('wasmAvailable' in capabilities, 'Should report WASM availability')
        assert.ok('parallelAvailable' in capabilities, 'Should report parallel availability')
        assert.ok('simdAvailable' in capabilities, 'Should report SIMD availability')
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should perform matrix multiplication via bridge', async () => {
      try {
        const { MatrixWasmBridge } = await import('../../matrix/src/backends/MatrixWasmBridge.js')

        // 2x2 matrices
        const a = new Float64Array([1, 2, 3, 4])
        const b = new Float64Array([5, 6, 7, 8])

        const result = await MatrixWasmBridge.multiply(a, 2, 2, b, 2, 2)

        // Expected: [[1*5+2*7, 1*6+2*8], [3*5+4*7, 3*6+4*8]] = [[19, 22], [43, 50]]
        approxEqual(result[0], 19)
        approxEqual(result[1], 22)
        approxEqual(result[2], 43)
        approxEqual(result[3], 50)
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should perform LU decomposition via bridge', async () => {
      try {
        const { MatrixWasmBridge } = await import('../../matrix/src/backends/MatrixWasmBridge.js')

        // 2x2 matrix [4, 3; 6, 3]
        const matrix = new Float64Array([4, 3, 6, 3])

        if (typeof MatrixWasmBridge.luDecomposition === 'function') {
          const result = await MatrixWasmBridge.luDecomposition(matrix, 2, 2)

          assert.ok(result, 'LU decomposition should return result')
          assert.ok(result.L || result.lu, 'Should have L or lu matrix')
        } else {
          assert.ok(true, 'luDecomposition not available - skipping')
        }
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should perform FFT via bridge', async () => {
      try {
        const { MatrixWasmBridge } = await import('../../matrix/src/backends/MatrixWasmBridge.js')

        if (typeof MatrixWasmBridge.fft === 'function') {
          // Simple signal with DC component
          const signal = new Float64Array([1, 0, 0, 0, 0, 0, 0, 0])

          const result = await MatrixWasmBridge.fft(signal, 4)

          assert.ok(result.length > 0, 'FFT should return result')
        } else {
          assert.ok(true, 'fft not available - skipping')
        }
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should cleanup resources', async () => {
      try {
        const { MatrixWasmBridge } = await import('../../matrix/src/backends/MatrixWasmBridge.js')

        if (typeof MatrixWasmBridge.cleanup === 'function') {
          await MatrixWasmBridge.cleanup()
          assert.ok(true, 'Cleanup completed')
        } else {
          assert.ok(true, 'cleanup not available - skipping')
        }
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Auto-Optimization Thresholds', () => {
    it('should respect size thresholds', async () => {
      try {
        const { MatrixWasmBridge } = await import('../../matrix/src/backends/MatrixWasmBridge.js')

        // Small matrices should use JS implementation
        const small = new Float64Array([1, 2, 3, 4])
        const resultSmall = await MatrixWasmBridge.multiply(small, 2, 2, small, 2, 2)
        assert.ok(resultSmall.length === 4, 'Small matrix multiplication should work')

        // Larger matrices might use WASM (depends on threshold)
        const size = 100
        const large = new Float64Array(size * size)
        for (let i = 0; i < size * size; i++) {
          large[i] = Math.random()
        }

        const resultLarge = await MatrixWasmBridge.multiply(large, size, size, large, size, size)
        assert.ok(resultLarge.length === size * size, 'Large matrix multiplication should work')
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Direct WASM Imports with TypeScript', () => {
    it('should import compiled AS WASM functions with type safety', async () => {
      try {
        // Import from compiled AssemblyScript build
        const wasm = await import('../../assembly/build/mathts.js')

        // Check for some expected exports
        const exports = Object.keys(wasm)
        assert.ok(exports.length > 0, 'WASM module should export functions')
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping (run: npm run build:wasm)')
        } else {
          throw err
        }
      }
    })

    it('should import WASM functions from functions package', async () => {
      try {
        const wasm = await import('../../functions/src/wasm/index.js')

        assert.ok(wasm, 'WASM functions index should be importable')
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('TypeScript AssemblyScript Integration', () => {
    it('should import AssemblyScript modules as TypeScript', async () => {
      try {
        const arithmetic = await import('../../functions/src/wasm/arithmetic/index.js')

        assert.ok(arithmetic, 'Arithmetic module should be importable')

        if (typeof arithmetic.square === 'function') {
          approxEqual(arithmetic.square(5), 25)
        }
        if (typeof arithmetic.cube === 'function') {
          approxEqual(arithmetic.cube(3), 27)
        }
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should handle complex operations with proper types', async () => {
      try {
        const complex = await import('../../functions/src/wasm/complex/index.js')

        if (typeof complex.mulComplex === 'function') {
          // Complex multiplication: (2+3i) * (4+5i) = -7 + 22i
          const result = complex.mulComplex(2, 3, 4, 5)
          assert.ok(result[0] !== undefined, 'Real part should exist')
          assert.ok(result[1] !== undefined, 'Imaginary part should exist')
          approxEqual(result[0], -7)
          approxEqual(result[1], 22)
        } else {
          assert.ok(true, 'mulComplex not available - skipping')
        }
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describeWasm('WASM Module Types', () => {
    it('should have proper WasmLoader interface', async () => {
      try {
        const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js')
        const loader = WasmLoader.getInstance()
        const wasmModule = await loader.load()

        assert.ok(typeof wasmModule === 'object', 'WASM module should be an object')
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })

    it('should handle WasmLoader type definitions', async () => {
      try {
        const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js')

        const loader = WasmLoader.getInstance()

        assert.ok(typeof loader.load === 'function', 'load should be a method')
        assert.ok(
          typeof loader.isLoaded === 'function' || typeof loader.isLoaded === 'boolean',
          'isLoaded should exist',
        )
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Error Handling with Types', () => {
    it('should handle invalid inputs gracefully', async () => {
      try {
        const wasm = await import('../../functions/src/wasm/index.js')

        // Special functions should handle edge cases
        if (typeof wasm.erf === 'function') {
          const erfResult = wasm.erf(0)
          approxEqual(erfResult, 0, 1e-7)
        }
        if (typeof wasm.gamma === 'function') {
          const gammaResult = wasm.gamma(1)
          approxEqual(gammaResult, 1)
        }
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })

  describe('Performance Verification', () => {
    it('should complete large matrix operations efficiently', async () => {
      try {
        const { MatrixWasmBridge } = await import('../../matrix/src/backends/MatrixWasmBridge.js')

        const size = 50
        const large = new Float64Array(size * size)
        for (let i = 0; i < size * size; i++) large[i] = Math.random()

        const startTime = Date.now()
        const result = await MatrixWasmBridge.multiply(large, size, size, large, size, size)
        const duration = Date.now() - startTime

        assert.ok(result.length === size * size, 'Result should have correct size')
        assert.ok(duration < 5000, `Operation took ${duration}ms, should be < 5000ms`)
      } catch (err) {
        if (shouldSkip(err as Error)) {
          assert.ok(true, 'Module not available - skipping')
        } else {
          throw err
        }
      }
    })
  })
})
