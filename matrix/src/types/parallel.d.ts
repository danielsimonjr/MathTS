/**
 * Type declarations for @danielsimonjr/mathts-parallel package
 * This provides type safety until the parallel package has proper exports
 */
declare module '@danielsimonjr/mathts-parallel' {
  export interface ComputePoolConfig {
    minWorkers?: number;
    maxWorkers?: number;
    workerType?: 'web' | 'node';
  }

  export interface ParallelResult<T> {
    result: T;
    duration: number;
    chunks: number;
    parallelized: boolean;
    workersUsed: number;
  }

  export interface PoolStats {
    totalWorkers: number;
    busyWorkers: number;
    idleWorkers: number;
    pendingTasks: number;
  }

  export class ComputePool {
    constructor(config?: Partial<ComputePoolConfig>);
    initialize(): Promise<boolean>;
    terminate(): Promise<void>;
    isReady(): boolean;
    stats(): PoolStats;

    // Reduction operations
    sum(data: Float64Array): Promise<ParallelResult<number>>;

    // Element-wise operations
    elementwise(
      a: Float64Array,
      b: Float64Array,
      op: 'add' | 'subtract' | 'multiply' | 'divide'
    ): Promise<ParallelResult<Float64Array>>;
    add(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
    subtract(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
    multiply(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
    divide(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>>;
    scale(data: Float64Array, scalar: number): Promise<ParallelResult<Float64Array>>;

    // Matrix operations
    matmul(
      a: Float64Array,
      aRows: number,
      aCols: number,
      b: Float64Array,
      bCols: number
    ): Promise<ParallelResult<Float64Array>>;
    transpose(
      data: Float64Array,
      rows: number,
      cols: number
    ): Promise<ParallelResult<Float64Array>>;
    dot(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>>;
  }

  export const computePool: ComputePool;
}
