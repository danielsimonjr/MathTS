/**
 * GPU Batch Executor
 *
 * Manages batched GPU command submission for reduced overhead.
 * Queues multiple operations and executes them together for efficiency.
 *
 * @packageDocumentation
 */

import type { GPUContext } from './GPUContext.js';
import type { ShaderManager } from './ShaderManager.js';
import type { BufferPool } from './BufferPool.js';

/**
 * Operation types that can be batched
 */
export type BatchOperationType =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'scale'
  | 'matmul'
  | 'transpose'
  | 'reduce_sum'
  | 'reduce_max'
  | 'reduce_min';

/**
 * Configuration for a batched operation
 */
export interface BatchOperation {
  /** Operation type */
  type: BatchOperationType;
  /** Input buffer A */
  inputA: GPUBuffer;
  /** Input buffer B (optional for unary ops) */
  inputB?: GPUBuffer;
  /** Output buffer */
  output: GPUBuffer;
  /** Dimensions */
  dimensions: {
    rows: number;
    cols: number;
    k?: number; // For matmul
  };
  /** Scalar value (for scale operation) */
  scalar?: number;
}

/**
 * Result of batch execution
 */
export interface BatchResult {
  /** Success status */
  success: boolean;
  /** Number of operations executed */
  operationCount: number;
  /** Execution time in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Options for batch execution
 */
export interface BatchOptions {
  /** Maximum operations per batch before auto-flush */
  maxBatchSize?: number;
  /** Auto-flush when batch is full */
  autoFlush?: boolean;
  /** Wait for GPU completion before returning */
  waitForCompletion?: boolean;
}

/**
 * GPU Batch Executor
 *
 * Accumulates GPU operations and executes them in batches to reduce
 * command submission overhead. Uses command buffers efficiently.
 *
 * @example
 * ```typescript
 * const executor = new BatchExecutor(context, shaders, bufferPool);
 *
 * executor.add(a, b, output, { rows: 100, cols: 100 });
 * executor.matmul(a, b, output, { rows: 100, cols: 100, k: 100 });
 *
 * await executor.flush();
 * ```
 */
export class BatchExecutor {
  private context: GPUContext;
  private shaders: ShaderManager;
  private bufferPool: BufferPool;
  private operations: BatchOperation[] = [];
  private options: Required<BatchOptions>;

  /**
   * Create a new batch executor
   */
  constructor(
    context: GPUContext,
    shaders: ShaderManager,
    bufferPool: BufferPool,
    options: BatchOptions = {}
  ) {
    this.context = context;
    this.shaders = shaders;
    this.bufferPool = bufferPool;
    this.options = {
      maxBatchSize: options.maxBatchSize ?? 100,
      autoFlush: options.autoFlush ?? true,
      waitForCompletion: options.waitForCompletion ?? true,
    };
  }

  /**
   * Get current batch size
   */
  get size(): number {
    return this.operations.length;
  }

  /**
   * Check if batch is empty
   */
  get isEmpty(): boolean {
    return this.operations.length === 0;
  }

  /**
   * Check if batch is full
   */
  get isFull(): boolean {
    return this.operations.length >= this.options.maxBatchSize;
  }

  /**
   * Queue an add operation
   */
  add(
    inputA: GPUBuffer,
    inputB: GPUBuffer,
    output: GPUBuffer,
    dimensions: { rows: number; cols: number }
  ): void {
    this.queueOperation({
      type: 'add',
      inputA,
      inputB,
      output,
      dimensions,
    });
  }

  /**
   * Queue a subtract operation
   */
  subtract(
    inputA: GPUBuffer,
    inputB: GPUBuffer,
    output: GPUBuffer,
    dimensions: { rows: number; cols: number }
  ): void {
    this.queueOperation({
      type: 'subtract',
      inputA,
      inputB,
      output,
      dimensions,
    });
  }

  /**
   * Queue an element-wise multiply operation
   */
  multiply(
    inputA: GPUBuffer,
    inputB: GPUBuffer,
    output: GPUBuffer,
    dimensions: { rows: number; cols: number }
  ): void {
    this.queueOperation({
      type: 'multiply',
      inputA,
      inputB,
      output,
      dimensions,
    });
  }

  /**
   * Queue a scale operation
   */
  scale(
    input: GPUBuffer,
    output: GPUBuffer,
    scalar: number,
    dimensions: { rows: number; cols: number }
  ): void {
    this.queueOperation({
      type: 'scale',
      inputA: input,
      output,
      dimensions,
      scalar,
    });
  }

  /**
   * Queue a matrix multiplication operation
   */
  matmul(
    inputA: GPUBuffer,
    inputB: GPUBuffer,
    output: GPUBuffer,
    dimensions: { rows: number; cols: number; k: number }
  ): void {
    this.queueOperation({
      type: 'matmul',
      inputA,
      inputB,
      output,
      dimensions,
    });
  }

  /**
   * Queue a transpose operation
   */
  transpose(input: GPUBuffer, output: GPUBuffer, dimensions: { rows: number; cols: number }): void {
    this.queueOperation({
      type: 'transpose',
      inputA: input,
      output,
      dimensions,
    });
  }

  /**
   * Queue a sum reduction operation
   */
  reduceSum(input: GPUBuffer, output: GPUBuffer, dimensions: { rows: number; cols: number }): void {
    this.queueOperation({
      type: 'reduce_sum',
      inputA: input,
      output,
      dimensions,
    });
  }

  /**
   * Queue operation (internal)
   */
  private queueOperation(op: BatchOperation): void {
    this.operations.push(op);

    if (this.options.autoFlush && this.isFull) {
      this.flushSync();
    }
  }

  /**
   * Flush all queued operations (async)
   */
  async flush(): Promise<BatchResult> {
    if (this.isEmpty) {
      return {
        success: true,
        operationCount: 0,
        duration: 0,
      };
    }

    const start = performance.now();
    const operationCount = this.operations.length;

    try {
      // Create command encoder
      const encoder = this.context.createCommandEncoder();

      // Encode all operations
      for (const op of this.operations) {
        this.encodeOperation(encoder, op);
      }

      // Submit commands
      const commandBuffer = encoder.finish();
      this.context.submitCommands([commandBuffer]);

      // Wait for completion if requested
      if (this.options.waitForCompletion) {
        await this.context.getDevice().queue.onSubmittedWorkDone();
      }

      // Clear operations
      this.operations = [];

      return {
        success: true,
        operationCount,
        duration: performance.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        operationCount,
        duration: performance.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Flush synchronously (fire and forget)
   */
  flushSync(): void {
    if (this.isEmpty) return;

    try {
      const encoder = this.context.createCommandEncoder();

      for (const op of this.operations) {
        this.encodeOperation(encoder, op);
      }

      const commandBuffer = encoder.finish();
      this.context.submitCommands([commandBuffer]);

      this.operations = [];
    } catch {
      // Fire and forget - errors are ignored
    }
  }

  /**
   * Encode a single operation into the command encoder
   */
  private encodeOperation(encoder: GPUCommandEncoder, op: BatchOperation): void {
    // Get the appropriate pipeline
    const pipelineName = this.getPipelineName(op.type) as Parameters<
      ShaderManager['getBuiltinPipeline']
    >[0];
    const pipeline = this.shaders.getBuiltinPipeline(pipelineName);

    // Create bind group entries
    const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: op.inputA } }];

    if (op.inputB) {
      entries.push({ binding: 1, resource: { buffer: op.inputB } });
    }

    entries.push({
      binding: op.inputB ? 2 : 1,
      resource: { buffer: op.output },
    });

    // Create params buffer
    const params = this.createParamsBuffer(op);
    entries.push({
      binding: entries.length,
      resource: { buffer: params },
    });

    // Create bind group
    const bindGroup = this.context.getDevice().createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries,
    });

    // Begin compute pass
    const passEncoder = encoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);

    // Calculate workgroups
    const [wgX, wgY, wgZ] = this.calculateWorkgroups(op);
    passEncoder.dispatchWorkgroups(wgX, wgY, wgZ);

    passEncoder.end();
  }

  /**
   * Get pipeline name for operation type
   */
  private getPipelineName(type: BatchOperationType): string {
    const mapping: Record<BatchOperationType, string> = {
      add: 'matrixAdd',
      subtract: 'matrixSub',
      multiply: 'matrixMul',
      divide: 'matrixDiv',
      scale: 'scalarMul',
      matmul: 'matmul',
      transpose: 'transpose',
      reduce_sum: 'sumReduce',
      reduce_max: 'maxReduce',
      reduce_min: 'minReduce',
    };
    return mapping[type] || 'matrixAdd';
  }

  /**
   * Create params buffer for operation
   */
  private createParamsBuffer(op: BatchOperation): GPUBuffer {
    const { rows, cols, k } = op.dimensions;

    let data: Uint32Array;
    if (op.type === 'matmul' && k !== undefined) {
      data = new Uint32Array([rows, cols, k, 0]);
    } else if (op.type === 'scale' && op.scalar !== undefined) {
      // For scalar ops, we need to encode the scalar as float
      const floatArray = new Float32Array([op.scalar]);
      const uintView = new Uint32Array(floatArray.buffer);
      data = new Uint32Array([rows, cols, uintView[0], 0]);
    } else {
      data = new Uint32Array([rows, cols, 0, 0]);
    }

    const buffer = this.bufferPool.acquireUniformBuffer(16, 'batch-params');
    this.context.writeBuffer(buffer, data);
    return buffer;
  }

  /**
   * Calculate workgroup dispatch counts
   */
  private calculateWorkgroups(op: BatchOperation): [number, number, number] {
    const { rows, cols } = op.dimensions;
    const workgroupSize = 16;

    if (op.type === 'reduce_sum' || op.type === 'reduce_max' || op.type === 'reduce_min') {
      const total = rows * cols;
      return [Math.ceil(total / 256), 1, 1];
    }

    return [Math.ceil(cols / workgroupSize), Math.ceil(rows / workgroupSize), 1];
  }

  /**
   * Clear all queued operations without executing
   */
  clear(): void {
    this.operations = [];
  }

  /**
   * Get statistics about the batch executor
   */
  getStats(): {
    queuedOperations: number;
    maxBatchSize: number;
    autoFlush: boolean;
  } {
    return {
      queuedOperations: this.operations.length,
      maxBatchSize: this.options.maxBatchSize,
      autoFlush: this.options.autoFlush,
    };
  }
}
