/**
 * GPU Backend for Matrix Operations
 *
 * WebGPU-accelerated matrix operations for large matrices.
 */

import {
  GPUContext,
  type GPUContextOptions,
  getGlobalGPUContext,
  BufferPool,
  ShaderManager,
  hasWebGPU,
  detectGPUCapabilities,
  getRecommendedWorkgroupSize,
  type GPUCapabilities,
} from '@danielsimonjr/mathts-gpu';
import { registerBuiltinShaders } from './gpu/builtin-shaders.js';

/**
 * GPU Backend status
 */
export type GPUBackendStatus = 'uninitialized' | 'initializing' | 'ready' | 'error' | 'unsupported';

/**
 * Options for GPU backend
 */
export interface GPUBackendOptions extends GPUContextOptions {
  /** Use global GPU context instead of creating a new one */
  useGlobalContext?: boolean;
  /** Buffer pool options */
  bufferPoolOptions?: {
    maxCacheSize?: number;
    evictionTimeout?: number;
  };
  /** Threshold for using GPU (matrix size) */
  threshold?: number;
}

const DEFAULT_THRESHOLD = 256; // 256x256 = 65536 elements

/**
 * GPU Backend for accelerated matrix operations
 */
export class GPUBackend {
  private context: GPUContext | null = null;
  private bufferPool: BufferPool | null = null;
  private shaderManager: ShaderManager | null = null;
  private _status: GPUBackendStatus = 'uninitialized';
  private _capabilities: GPUCapabilities | null = null;
  private _lastError: Error | null = null;
  private threshold: number;
  private workgroupSize: [number, number, number] = [16, 16, 1];
  private useGlobalContext: boolean;

  constructor(options: GPUBackendOptions = {}) {
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.useGlobalContext = options.useGlobalContext ?? true;
  }

  /**
   * Get the current status
   */
  get status(): GPUBackendStatus {
    return this._status;
  }

  /**
   * Check if backend is ready
   */
  get isReady(): boolean {
    return this._status === 'ready';
  }

  /**
   * Get capabilities
   */
  get capabilities(): GPUCapabilities | null {
    return this._capabilities;
  }

  /**
   * Get last error
   */
  get lastError(): Error | null {
    return this._lastError;
  }

  /**
   * Initialize the GPU backend
   */
  async initialize(options: GPUBackendOptions = {}): Promise<boolean> {
    if (this._status === 'ready') {
      return true;
    }

    if (this._status === 'initializing') {
      throw new Error('Already initializing');
    }

    this._status = 'initializing';

    try {
      // Check WebGPU support
      if (!hasWebGPU()) {
        this._status = 'unsupported';
        this._lastError = new Error('WebGPU is not supported');
        return false;
      }

      // Detect capabilities
      this._capabilities = await detectGPUCapabilities(options.preferHighPerformance ?? true);

      if (!this._capabilities.supported) {
        this._status = 'unsupported';
        this._lastError = new Error('WebGPU adapter not available');
        return false;
      }

      // Get or create context
      if (this.useGlobalContext) {
        this.context = getGlobalGPUContext();
      } else {
        this.context = new GPUContext({ label: 'GPUBackend' });
      }

      // Initialize context
      const success = await this.context.initialize(options);
      if (!success) {
        this._status = 'error';
        this._lastError = this.context.lastError;
        return false;
      }

      // Create buffer pool
      this.bufferPool = new BufferPool(this.context, options.bufferPoolOptions);

      // Create shader manager and register the matrix-domain kernels
      this.shaderManager = new ShaderManager(this.context);
      registerBuiltinShaders(this.shaderManager);
      this.shaderManager.precompileRegistered();

      // Get recommended workgroup size
      this.workgroupSize = getRecommendedWorkgroupSize(this._capabilities);

      this._status = 'ready';
      return true;
    } catch (error) {
      this._status = 'error';
      this._lastError = error as Error;
      return false;
    }
  }

  /**
   * Check if GPU should be used for the given matrix size
   */
  shouldUseGPU(rows: number, cols: number): boolean {
    if (!this.isReady) {
      return false;
    }
    return rows >= this.threshold || cols >= this.threshold;
  }

  /**
   * Calculate workgroup counts for a matrix
   */
  calculateWorkgroups(rows: number, cols: number): [number, number, number] {
    const [wgX, wgY] = this.workgroupSize;
    return [Math.ceil(cols / wgX), Math.ceil(rows / wgY), 1];
  }

  /**
   * Get the GPU context
   */
  getContext(): GPUContext {
    if (!this.context || !this.isReady) {
      throw new Error('GPUBackend not initialized');
    }
    return this.context;
  }

  /**
   * Get the buffer pool
   */
  getBufferPool(): BufferPool {
    if (!this.bufferPool || !this.isReady) {
      throw new Error('GPUBackend not initialized');
    }
    return this.bufferPool;
  }

  /**
   * Get the shader manager
   */
  getShaderManager(): ShaderManager {
    if (!this.shaderManager || !this.isReady) {
      throw new Error('GPUBackend not initialized');
    }
    return this.shaderManager;
  }

  /**
   * Add two matrices element-wise
   */
  async add(a: Float32Array, b: Float32Array, rows: number, cols: number): Promise<Float32Array> {
    const ctx = this.getContext();
    const pool = this.getBufferPool();
    const shaders = this.getShaderManager();

    const size = rows * cols * 4; // f32 = 4 bytes

    // Create buffers
    const bufferA = pool.acquireStorageBuffer(size, 'matrix-a', true, true);
    const bufferB = pool.acquireStorageBuffer(size, 'matrix-b', true, true);
    const bufferResult = pool.acquireStorageBuffer(size, 'matrix-result', true, false);
    const bufferParams = pool.acquireUniformBuffer(16, 'params'); // 4 u32s

    // Write data
    ctx.writeBuffer(bufferA, a);
    ctx.writeBuffer(bufferB, b);
    ctx.writeBuffer(bufferParams, new Uint32Array([rows, cols, 0, 0]));

    // Get pipeline
    const pipeline = shaders.getRegisteredPipeline('matrixAdd');

    // Create bind group
    const bindGroup = ctx.createBindGroup(pipeline.getBindGroupLayout(0), [
      { binding: 0, resource: { buffer: bufferA } },
      { binding: 1, resource: { buffer: bufferB } },
      { binding: 2, resource: { buffer: bufferResult } },
      { binding: 3, resource: { buffer: bufferParams } },
    ]);

    // Dispatch
    ctx.dispatchCompute(pipeline, [bindGroup], this.calculateWorkgroups(rows, cols));

    // Read result
    const resultData = await ctx.readBuffer(bufferResult);

    // Release buffers
    pool.release(bufferA);
    pool.release(bufferB);
    pool.release(bufferResult);
    pool.release(bufferParams);

    return new Float32Array(resultData);
  }

  /**
   * Multiply two matrices
   */
  async matmul(
    a: Float32Array,
    b: Float32Array,
    M: number,
    K: number,
    N: number
  ): Promise<Float32Array> {
    const ctx = this.getContext();
    const pool = this.getBufferPool();
    const shaders = this.getShaderManager();

    const sizeA = M * K * 4;
    const sizeB = K * N * 4;
    const sizeResult = M * N * 4;

    // Create buffers
    const bufferA = pool.acquireStorageBuffer(sizeA, 'matmul-a', true, true);
    const bufferB = pool.acquireStorageBuffer(sizeB, 'matmul-b', true, true);
    const bufferResult = pool.acquireStorageBuffer(sizeResult, 'matmul-result', true, false);
    const bufferParams = pool.acquireUniformBuffer(16, 'params');

    // Write data
    ctx.writeBuffer(bufferA, a);
    ctx.writeBuffer(bufferB, b);
    ctx.writeBuffer(bufferParams, new Uint32Array([M, N, K, 0]));

    // Get pipeline
    const pipeline = shaders.getRegisteredPipeline('matmul');

    // Create bind group
    const bindGroup = ctx.createBindGroup(pipeline.getBindGroupLayout(0), [
      { binding: 0, resource: { buffer: bufferA } },
      { binding: 1, resource: { buffer: bufferB } },
      { binding: 2, resource: { buffer: bufferResult } },
      { binding: 3, resource: { buffer: bufferParams } },
    ]);

    // Dispatch
    ctx.dispatchCompute(pipeline, [bindGroup], this.calculateWorkgroups(M, N));

    // Read result
    const resultData = await ctx.readBuffer(bufferResult);

    // Release buffers
    pool.release(bufferA);
    pool.release(bufferB);
    pool.release(bufferResult);
    pool.release(bufferParams);

    return new Float32Array(resultData);
  }

  /**
   * Transpose a matrix
   */
  async transpose(a: Float32Array, rows: number, cols: number): Promise<Float32Array> {
    const ctx = this.getContext();
    const pool = this.getBufferPool();
    const shaders = this.getShaderManager();

    const size = rows * cols * 4;

    // Create buffers
    const bufferA = pool.acquireStorageBuffer(size, 'transpose-a', true, true);
    const bufferResult = pool.acquireStorageBuffer(size, 'transpose-result', true, false);
    const bufferParams = pool.acquireUniformBuffer(16, 'params');

    // Write data
    ctx.writeBuffer(bufferA, a);
    ctx.writeBuffer(bufferParams, new Uint32Array([rows, cols, 0, 0]));

    // Get pipeline
    const pipeline = shaders.getRegisteredPipeline('transpose');

    // Create bind group
    const bindGroup = ctx.createBindGroup(pipeline.getBindGroupLayout(0), [
      { binding: 0, resource: { buffer: bufferA } },
      { binding: 1, resource: { buffer: bufferResult } },
      { binding: 2, resource: { buffer: bufferParams } },
    ]);

    // Dispatch
    ctx.dispatchCompute(pipeline, [bindGroup], this.calculateWorkgroups(rows, cols));

    // Read result
    const resultData = await ctx.readBuffer(bufferResult);

    // Release buffers
    pool.release(bufferA);
    pool.release(bufferResult);
    pool.release(bufferParams);

    return new Float32Array(resultData);
  }

  /**
   * Scale a matrix by a scalar
   */
  async scale(a: Float32Array, scalar: number): Promise<Float32Array> {
    const ctx = this.getContext();
    const pool = this.getBufferPool();
    const shaders = this.getShaderManager();

    const size = a.length * 4;

    // Create buffers
    const bufferA = pool.acquireStorageBuffer(size, 'scale-a', true, true);
    const bufferResult = pool.acquireStorageBuffer(size, 'scale-result', true, false);
    const bufferParams = pool.acquireUniformBuffer(16, 'params');

    // Write data
    ctx.writeBuffer(bufferA, a);
    ctx.writeBuffer(bufferParams, new Float32Array([scalar, a.length, 0, 0]));

    // Get pipeline
    const pipeline = shaders.getRegisteredPipeline('scalarMul');

    // Create bind group
    const bindGroup = ctx.createBindGroup(pipeline.getBindGroupLayout(0), [
      { binding: 0, resource: { buffer: bufferA } },
      { binding: 1, resource: { buffer: bufferResult } },
      { binding: 2, resource: { buffer: bufferParams } },
    ]);

    // Dispatch
    const workgroups = Math.ceil(a.length / 256);
    ctx.dispatchCompute(pipeline, [bindGroup], [workgroups, 1, 1]);

    // Read result
    const resultData = await ctx.readBuffer(bufferResult);

    // Release buffers
    pool.release(bufferA);
    pool.release(bufferResult);
    pool.release(bufferParams);

    return new Float32Array(resultData);
  }

  /**
   * Get backend statistics
   */
  getStats(): {
    status: GPUBackendStatus;
    capabilities: GPUCapabilities | null;
    bufferPool: { totalBuffers: number; inUseBuffers: number; cachedBuffers: number } | null;
    shaders: { cachedShaders: number; cachedPipelines: number } | null;
  } {
    return {
      status: this._status,
      capabilities: this._capabilities,
      bufferPool: this.bufferPool?.getStats() || null,
      shaders: this.shaderManager?.getStats() || null,
    };
  }

  /**
   * Destroy the backend
   */
  destroy(): void {
    if (this.bufferPool) {
      this.bufferPool.destroy();
      this.bufferPool = null;
    }

    if (this.shaderManager) {
      this.shaderManager.clearCache();
      this.shaderManager = null;
    }

    if (this.context && !this.useGlobalContext) {
      this.context.destroy();
    }
    this.context = null;

    this._status = 'uninitialized';
  }
}

/**
 * Global GPU backend instance
 */
let globalBackend: GPUBackend | null = null;

/**
 * Get the global GPU backend
 */
export function getGlobalGPUBackend(): GPUBackend {
  if (!globalBackend) {
    globalBackend = new GPUBackend({ useGlobalContext: true });
  }
  return globalBackend;
}

/**
 * Initialize the global GPU backend
 */
export async function initializeGlobalGPUBackend(options?: GPUBackendOptions): Promise<boolean> {
  const backend = getGlobalGPUBackend();
  return backend.initialize(options);
}

/**
 * Destroy the global GPU backend
 */
export function destroyGlobalGPUBackend(): void {
  if (globalBackend) {
    globalBackend.destroy();
    globalBackend = null;
  }
}
