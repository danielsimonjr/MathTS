/**
 * GPU Buffer Pool
 *
 * Manages GPU buffer allocation, deallocation, and reuse.
 * Reduces allocation overhead by recycling buffers.
 */

import { GPUContext } from './GPUContext.js';

/**
 * Buffer pool entry
 */
interface BufferEntry {
  buffer: GPUBuffer;
  size: number;
  usage: GPUBufferUsageFlags;
  inUse: boolean;
  lastUsed: number;
  label?: string;
}

/**
 * Options for buffer pool
 */
export interface BufferPoolOptions {
  /** Maximum total memory to cache (bytes) */
  maxCacheSize?: number;
  /** Time after which unused buffers are evicted (ms) */
  evictionTimeout?: number;
  /** Whether to enable automatic eviction */
  autoEvict?: boolean;
  /** Interval for automatic eviction (ms) */
  evictionInterval?: number;
}

const DEFAULT_MAX_CACHE_SIZE = 512 * 1024 * 1024; // 512MB
const DEFAULT_EVICTION_TIMEOUT = 30000; // 30 seconds
const DEFAULT_EVICTION_INTERVAL = 10000; // 10 seconds

/**
 * GPU Buffer Pool for efficient buffer management
 */
export class BufferPool {
  private context: GPUContext;
  private buffers: Map<string, BufferEntry[]> = new Map();
  private maxCacheSize: number;
  private evictionTimeout: number;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;
  private currentCacheSize: number = 0;

  constructor(context: GPUContext, options: BufferPoolOptions = {}) {
    this.context = context;
    this.maxCacheSize = options.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.evictionTimeout = options.evictionTimeout ?? DEFAULT_EVICTION_TIMEOUT;

    if (options.autoEvict !== false) {
      this.startAutoEviction(options.evictionInterval ?? DEFAULT_EVICTION_INTERVAL);
    }
  }

  /**
   * Generate a key for buffer categorization
   */
  private getBufferKey(size: number, usage: GPUBufferUsageFlags): string {
    // Round up to nearest power of 2 for better reuse
    const roundedSize = this.roundUpToPowerOf2(size);
    return `${roundedSize}_${usage}`;
  }

  /**
   * Round up to nearest power of 2
   */
  private roundUpToPowerOf2(n: number): number {
    if (n <= 0) return 1;
    let power = 1;
    while (power < n && power < Number.MAX_SAFE_INTEGER) {
      power *= 2;
    }
    return power;
  }

  /**
   * Acquire a buffer from the pool or create a new one
   */
  acquire(size: number, usage: GPUBufferUsageFlags, label?: string): GPUBuffer {
    const key = this.getBufferKey(size, usage);
    const entries = this.buffers.get(key);

    // Try to find an available buffer
    if (entries) {
      for (const entry of entries) {
        if (!entry.inUse && entry.size >= size) {
          entry.inUse = true;
          entry.lastUsed = Date.now();
          entry.label = label;
          return entry.buffer;
        }
      }
    }

    // Create new buffer
    const roundedSize = this.roundUpToPowerOf2(size);
    const buffer = this.context.createBuffer(roundedSize, usage, label);

    // Add to pool
    const entry: BufferEntry = {
      buffer,
      size: roundedSize,
      usage,
      inUse: true,
      lastUsed: Date.now(),
      label,
    };

    if (!this.buffers.has(key)) {
      this.buffers.set(key, []);
    }
    this.buffers.get(key)!.push(entry);
    this.currentCacheSize += roundedSize;

    // Evict if over cache limit
    if (this.currentCacheSize > this.maxCacheSize) {
      this.evictOldBuffers();
    }

    return buffer;
  }

  /**
   * Release a buffer back to the pool
   */
  release(buffer: GPUBuffer): void {
    for (const entries of this.buffers.values()) {
      for (const entry of entries) {
        if (entry.buffer === buffer) {
          entry.inUse = false;
          entry.lastUsed = Date.now();
          return;
        }
      }
    }
  }

  /**
   * Create a storage buffer from the pool
   */
  acquireStorageBuffer(
    size: number,
    label?: string,
    readable: boolean = true,
    writable: boolean = true
  ): GPUBuffer {
    let usage = GPUBufferUsage.STORAGE;
    if (readable) {
      usage |= GPUBufferUsage.COPY_SRC;
    }
    if (writable) {
      usage |= GPUBufferUsage.COPY_DST;
    }
    return this.acquire(size, usage, label);
  }

  /**
   * Create a staging buffer from the pool
   */
  acquireStagingBuffer(size: number, label?: string): GPUBuffer {
    return this.acquire(size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, label);
  }

  /**
   * Create a uniform buffer from the pool
   */
  acquireUniformBuffer(size: number, label?: string): GPUBuffer {
    return this.acquire(size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label);
  }

  /**
   * Evict old unused buffers
   */
  evictOldBuffers(): void {
    const now = Date.now();
    const timeout = this.evictionTimeout;

    for (const [key, entries] of this.buffers.entries()) {
      const remaining: BufferEntry[] = [];

      for (const entry of entries) {
        if (!entry.inUse && now - entry.lastUsed > timeout) {
          // Evict this buffer
          entry.buffer.destroy();
          this.currentCacheSize -= entry.size;
        } else {
          remaining.push(entry);
        }
      }

      if (remaining.length === 0) {
        this.buffers.delete(key);
      } else {
        this.buffers.set(key, remaining);
      }
    }
  }

  /**
   * Force eviction to reduce cache to target size
   */
  evictToSize(targetSize: number): void {
    if (this.currentCacheSize <= targetSize) {
      return;
    }

    // Sort entries by last used time
    const allEntries: Array<{ key: string; entry: BufferEntry; index: number }> = [];
    for (const [key, entries] of this.buffers.entries()) {
      entries.forEach((entry, index) => {
        if (!entry.inUse) {
          allEntries.push({ key, entry, index });
        }
      });
    }

    // Sort oldest first
    allEntries.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed);

    // Evict until under target
    for (const { key, entry, index } of allEntries) {
      if (this.currentCacheSize <= targetSize) {
        break;
      }

      const entries = this.buffers.get(key)!;
      entry.buffer.destroy();
      this.currentCacheSize -= entry.size;
      entries.splice(index, 1);

      if (entries.length === 0) {
        this.buffers.delete(key);
      }
    }
  }

  /**
   * Start automatic eviction timer
   */
  startAutoEviction(interval: number): void {
    this.stopAutoEviction();
    this.evictionTimer = setInterval(() => {
      this.evictOldBuffers();
    }, interval);
  }

  /**
   * Stop automatic eviction timer
   */
  stopAutoEviction(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalBuffers: number;
    inUseBuffers: number;
    cachedBuffers: number;
    currentCacheSize: number;
    maxCacheSize: number;
  } {
    let totalBuffers = 0;
    let inUseBuffers = 0;

    for (const entries of this.buffers.values()) {
      totalBuffers += entries.length;
      inUseBuffers += entries.filter((e) => e.inUse).length;
    }

    return {
      totalBuffers,
      inUseBuffers,
      cachedBuffers: totalBuffers - inUseBuffers,
      currentCacheSize: this.currentCacheSize,
      maxCacheSize: this.maxCacheSize,
    };
  }

  /**
   * Clear all buffers and reset pool
   */
  clear(): void {
    this.stopAutoEviction();

    for (const entries of this.buffers.values()) {
      for (const entry of entries) {
        entry.buffer.destroy();
      }
    }

    this.buffers.clear();
    this.currentCacheSize = 0;
  }

  /**
   * Destroy the pool
   */
  destroy(): void {
    this.clear();
  }
}
