/**
 * GPU-CPU Synchronization Strategy
 *
 * Implements efficient patterns for synchronizing data between
 * CPU and GPU memory. Minimizes transfer latency and enables
 * overlapping of CPU and GPU work.
 *
 * @packageDocumentation
 */

import type { GPUContext } from '@danielsimonjr/mathts-gpu';
import type { BufferPool } from '@danielsimonjr/mathts-gpu';

/**
 * Synchronization strategy type
 */
export type SyncStrategy =
  | 'immediate' // Sync immediately after each operation
  | 'lazy' // Sync only when data is needed on CPU
  | 'double-buffer' // Use two buffers to overlap transfer and compute
  | 'streaming'; // Stream data in chunks

/**
 * Transfer direction
 */
export type TransferDirection = 'cpu-to-gpu' | 'gpu-to-cpu';

/**
 * Transfer request
 */
export interface TransferRequest {
  /** Unique ID for this request */
  id: number;
  /** Source buffer */
  source: GPUBuffer | Float32Array;
  /** Destination buffer */
  destination: GPUBuffer | Float32Array;
  /** Transfer direction */
  direction: TransferDirection;
  /** Byte offset in source */
  sourceOffset?: number;
  /** Byte offset in destination */
  destOffset?: number;
  /** Number of bytes to transfer */
  size: number;
  /** Priority (higher = more urgent) */
  priority?: number;
}

/**
 * Transfer result
 */
export interface TransferResult {
  /** Request ID */
  id: number;
  /** Success status */
  success: boolean;
  /** Transfer time in milliseconds */
  duration: number;
  /** Bytes transferred */
  bytesTransferred: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  /** Default strategy */
  strategy: SyncStrategy;
  /** Chunk size for streaming (bytes) */
  chunkSize?: number;
  /** Maximum pending transfers */
  maxPendingTransfers?: number;
  /** Auto-coalesce nearby transfers */
  coalesceTransfers?: boolean;
}

/**
 * GPU-CPU Synchronization Manager
 *
 * Manages data transfer between CPU and GPU with various strategies
 * optimized for different use cases.
 *
 * @example
 * ```typescript
 * const sync = new SyncManager(context, bufferPool, {
 *   strategy: 'double-buffer',
 * });
 *
 * // Upload data to GPU
 * await sync.upload(cpuData, gpuBuffer);
 *
 * // Download results from GPU
 * const result = await sync.download(gpuBuffer);
 * ```
 */
export class SyncManager {
  private context: GPUContext;
  private config: Required<SyncConfig>;
  private pendingTransfers: Map<number, Promise<TransferResult>> = new Map();
  private nextRequestId = 0;
  private stagingBuffers: GPUBuffer[] = [];

  // Statistics
  private totalUploads = 0;
  private totalDownloads = 0;
  private totalBytesUploaded = 0;
  private totalBytesDownloaded = 0;

  constructor(
    context: GPUContext,
    _bufferPool: BufferPool, // Reserved for future pool integration
    config: Partial<SyncConfig> = {}
  ) {
    this.context = context;
    this.config = {
      strategy: config.strategy ?? 'lazy',
      chunkSize: config.chunkSize ?? 1024 * 1024, // 1MB default
      maxPendingTransfers: config.maxPendingTransfers ?? 16,
      coalesceTransfers: config.coalesceTransfers ?? true,
    };
  }

  /**
   * Upload data from CPU to GPU
   */
  async upload(
    cpuData: Float32Array | Float64Array | Uint32Array | Int32Array,
    gpuBuffer: GPUBuffer,
    options: { offset?: number; size?: number } = {}
  ): Promise<TransferResult> {
    const id = this.nextRequestId++;
    const start = performance.now();

    try {
      const offset = options.offset ?? 0;
      const size = options.size ?? cpuData.byteLength;

      // Write data to GPU buffer
      this.context.writeBuffer(gpuBuffer, cpuData, offset);

      // Wait for queue to complete (for immediate strategy)
      if (this.config.strategy === 'immediate') {
        await this.context.getDevice().queue.onSubmittedWorkDone();
      }

      this.totalUploads++;
      this.totalBytesUploaded += size;

      return {
        id,
        success: true,
        duration: performance.now() - start,
        bytesTransferred: size,
      };
    } catch (error) {
      return {
        id,
        success: false,
        duration: performance.now() - start,
        bytesTransferred: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Download data from GPU to CPU
   */
  async download(
    gpuBuffer: GPUBuffer,
    options: { offset?: number; size?: number } = {}
  ): Promise<Float32Array> {
    const offset = options.offset ?? 0;
    const size = options.size ?? gpuBuffer.size;

    this.totalDownloads++;
    this.totalBytesDownloaded += size;

    const buffer = await this.context.readBuffer(gpuBuffer, offset, size);
    return new Float32Array(buffer);
  }

  /**
   * Download data using double-buffering for overlap
   */
  async downloadDoubleBuffered(gpuBuffer: GPUBuffer, size: number): Promise<Float32Array> {
    // Acquire two staging buffers (second is for double buffering future use)
    const staging1 = this.getOrCreateStagingBuffer(size);
    // Reserved for true double buffering: const _staging2 = this.getOrCreateStagingBuffer(size);

    // Copy to first staging buffer
    const encoder = this.context.createCommandEncoder();
    encoder.copyBufferToBuffer(gpuBuffer, 0, staging1, 0, size);
    this.context.submitCommands([encoder.finish()]);

    // While GPU is copying, prepare to read from previous buffer
    // (This is simplified - real double buffering would track previous operations)

    // Map and read
    await staging1.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(staging1.getMappedRange().slice(0));
    staging1.unmap();

    return data;
  }

  /**
   * Stream large data in chunks
   */
  async uploadStreaming(
    cpuData: Float32Array,
    gpuBuffer: GPUBuffer,
    onProgress?: (progress: number) => void
  ): Promise<TransferResult> {
    const id = this.nextRequestId++;
    const start = performance.now();
    const chunkSize = this.config.chunkSize / 4; // Convert bytes to float32 elements
    const totalElements = cpuData.length;
    let transferred = 0;

    try {
      for (let offset = 0; offset < totalElements; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, totalElements);
        const chunk = cpuData.subarray(offset, end);

        this.context.writeBuffer(
          gpuBuffer,
          chunk,
          offset * 4 // byte offset
        );

        transferred = end;

        if (onProgress) {
          onProgress(transferred / totalElements);
        }

        // Yield to allow other work
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Wait for all transfers to complete
      await this.context.getDevice().queue.onSubmittedWorkDone();

      this.totalUploads++;
      this.totalBytesUploaded += totalElements * 4;

      return {
        id,
        success: true,
        duration: performance.now() - start,
        bytesTransferred: totalElements * 4,
      };
    } catch (error) {
      return {
        id,
        success: false,
        duration: performance.now() - start,
        bytesTransferred: transferred * 4,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Download large data in chunks
   */
  async downloadStreaming(
    gpuBuffer: GPUBuffer,
    totalSize: number,
    onProgress?: (progress: number) => void
  ): Promise<Float32Array> {
    const result = new Float32Array(totalSize / 4);
    const chunkSize = this.config.chunkSize;
    let downloaded = 0;

    while (downloaded < totalSize) {
      const remaining = totalSize - downloaded;
      const currentChunkSize = Math.min(chunkSize, remaining);

      const chunk = await this.download(gpuBuffer, {
        offset: downloaded,
        size: currentChunkSize,
      });

      result.set(chunk, downloaded / 4);
      downloaded += currentChunkSize;

      if (onProgress) {
        onProgress(downloaded / totalSize);
      }
    }

    return result;
  }

  /**
   * Batch multiple transfers
   */
  async batchTransfer(
    requests: Array<{
      data: Float32Array;
      buffer: GPUBuffer;
      direction: TransferDirection;
    }>
  ): Promise<TransferResult[]> {
    const results: TransferResult[] = [];
    const start = performance.now();

    // Group by direction for efficiency
    const uploads = requests.filter((r) => r.direction === 'cpu-to-gpu');
    const downloads = requests.filter((r) => r.direction === 'gpu-to-cpu');

    // Process uploads first (they can be queued quickly)
    for (const req of uploads) {
      const result = await this.upload(req.data, req.buffer);
      results.push(result);
    }

    // Then process downloads (they need to wait for GPU)
    for (const req of downloads) {
      const id = this.nextRequestId++;
      try {
        const data = await this.download(req.buffer);
        req.data.set(data);
        results.push({
          id,
          success: true,
          duration: performance.now() - start,
          bytesTransferred: data.byteLength,
        });
      } catch (error) {
        results.push({
          id,
          success: false,
          duration: performance.now() - start,
          bytesTransferred: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Create or reuse a staging buffer
   */
  private getOrCreateStagingBuffer(size: number): GPUBuffer {
    // Round up to power of 2 for reusability
    const alignedSize = this.roundToPowerOf2(size);

    // Check for existing buffer
    for (const buffer of this.stagingBuffers) {
      if (buffer.size >= alignedSize) {
        return buffer;
      }
    }

    // Create new staging buffer
    const buffer = this.context.createStagingBuffer(alignedSize, 'sync-staging');
    this.stagingBuffers.push(buffer);
    return buffer;
  }

  /**
   * Round up to next power of 2
   */
  private roundToPowerOf2(n: number): number {
    if (n <= 0) return 256;
    n--;
    n |= n >> 1;
    n |= n >> 2;
    n |= n >> 4;
    n |= n >> 8;
    n |= n >> 16;
    return n + 1;
  }

  /**
   * Wait for all pending transfers to complete
   */
  async flush(): Promise<void> {
    await this.context.getDevice().queue.onSubmittedWorkDone();
    await Promise.all(this.pendingTransfers.values());
    this.pendingTransfers.clear();
  }

  /**
   * Get synchronization statistics
   */
  getStats(): {
    totalUploads: number;
    totalDownloads: number;
    totalBytesUploaded: number;
    totalBytesDownloaded: number;
    pendingTransfers: number;
    stagingBuffersCount: number;
    strategy: SyncStrategy;
  } {
    return {
      totalUploads: this.totalUploads,
      totalDownloads: this.totalDownloads,
      totalBytesUploaded: this.totalBytesUploaded,
      totalBytesDownloaded: this.totalBytesDownloaded,
      pendingTransfers: this.pendingTransfers.size,
      stagingBuffersCount: this.stagingBuffers.length,
      strategy: this.config.strategy,
    };
  }

  /**
   * Destroy sync manager and release resources
   */
  destroy(): void {
    for (const buffer of this.stagingBuffers) {
      buffer.destroy();
    }
    this.stagingBuffers = [];
    this.pendingTransfers.clear();
  }
}

/**
 * Create a sync manager with the recommended configuration
 */
export function createSyncManager(
  context: GPUContext,
  bufferPool: BufferPool,
  strategy: SyncStrategy = 'lazy'
): SyncManager {
  return new SyncManager(context, bufferPool, { strategy });
}
