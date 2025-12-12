/**
 * Chunking Strategies for Parallel Operations
 *
 * Provides utilities for dividing large arrays into chunks
 * for parallel processing across multiple workers.
 *
 * @packageDocumentation
 */

/**
 * Result of a chunking operation
 */
export interface ChunkResult<T> {
  /** The chunked data */
  chunks: T[];
  /** Metadata about each chunk */
  chunkInfo: ChunkInfo[];
  /** Total number of elements */
  totalElements: number;
  /** Number of workers/chunks */
  numChunks: number;
}

/**
 * Information about a single chunk
 */
export interface ChunkInfo {
  /** Start index in the original array */
  startIndex: number;
  /** End index (exclusive) in the original array */
  endIndex: number;
  /** Length of this chunk */
  length: number;
  /** Chunk index */
  chunkIndex: number;
}

/**
 * Options for chunking operations
 */
export interface ChunkOptions {
  /** Minimum elements per chunk (default: 1000) */
  minChunkSize?: number;
  /** Maximum number of chunks (default: number of CPUs) */
  maxChunks?: number;
  /** Target chunk size (default: auto-calculated) */
  targetChunkSize?: number;
  /** Whether to balance chunk sizes evenly (default: true) */
  balanced?: boolean;
}

/**
 * Default chunking options
 */
const DEFAULT_CHUNK_OPTIONS: Required<ChunkOptions> = {
  minChunkSize: 1000,
  maxChunks: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  targetChunkSize: 0, // 0 = auto
  balanced: true,
};

/**
 * Calculate optimal number of chunks for a given array size
 *
 * @param totalElements - Total number of elements
 * @param options - Chunking options
 * @returns Optimal number of chunks
 */
export function calculateOptimalChunks(
  totalElements: number,
  options: ChunkOptions = {}
): number {
  const { minChunkSize, maxChunks, targetChunkSize } = {
    ...DEFAULT_CHUNK_OPTIONS,
    ...options,
  };

  if (totalElements === 0) return 0;

  // If target chunk size is specified, use it
  if (targetChunkSize > 0) {
    return Math.min(maxChunks, Math.ceil(totalElements / targetChunkSize));
  }

  // Calculate based on min chunk size
  const maxPossibleChunks = Math.floor(totalElements / minChunkSize);
  return Math.max(1, Math.min(maxChunks, maxPossibleChunks));
}

/**
 * Chunk a Float64Array into multiple smaller arrays
 *
 * @param data - The array to chunk
 * @param options - Chunking options
 * @returns Chunked data with metadata
 */
export function chunkFloat64Array(
  data: Float64Array,
  options: ChunkOptions = {}
): ChunkResult<Float64Array> {
  const { minChunkSize, balanced } = { ...DEFAULT_CHUNK_OPTIONS, ...options };
  const totalElements = data.length;

  if (totalElements === 0) {
    return {
      chunks: [],
      chunkInfo: [],
      totalElements: 0,
      numChunks: 0,
    };
  }

  const numChunks = calculateOptimalChunks(totalElements, options);

  if (numChunks <= 1) {
    return {
      chunks: [data],
      chunkInfo: [
        {
          startIndex: 0,
          endIndex: totalElements,
          length: totalElements,
          chunkIndex: 0,
        },
      ],
      totalElements,
      numChunks: 1,
    };
  }

  const chunks: Float64Array[] = [];
  const chunkInfo: ChunkInfo[] = [];

  if (balanced) {
    // Divide evenly
    const baseChunkSize = Math.floor(totalElements / numChunks);
    const remainder = totalElements % numChunks;

    let currentIndex = 0;
    for (let i = 0; i < numChunks; i++) {
      // Distribute remainder evenly
      const thisChunkSize = baseChunkSize + (i < remainder ? 1 : 0);
      const endIndex = currentIndex + thisChunkSize;

      chunks.push(data.subarray(currentIndex, endIndex));
      chunkInfo.push({
        startIndex: currentIndex,
        endIndex,
        length: thisChunkSize,
        chunkIndex: i,
      });

      currentIndex = endIndex;
    }
  } else {
    // Use fixed chunk size
    const chunkSize = Math.max(minChunkSize, Math.ceil(totalElements / numChunks));

    let currentIndex = 0;
    let chunkIndex = 0;
    while (currentIndex < totalElements) {
      const endIndex = Math.min(currentIndex + chunkSize, totalElements);
      const thisChunkSize = endIndex - currentIndex;

      chunks.push(data.subarray(currentIndex, endIndex));
      chunkInfo.push({
        startIndex: currentIndex,
        endIndex,
        length: thisChunkSize,
        chunkIndex,
      });

      currentIndex = endIndex;
      chunkIndex++;
    }
  }

  return {
    chunks,
    chunkInfo,
    totalElements,
    numChunks: chunks.length,
  };
}

/**
 * Chunk a generic array into multiple smaller arrays
 *
 * @param data - The array to chunk
 * @param options - Chunking options
 * @returns Chunked data with metadata
 */
export function chunkArray<T>(data: T[], options: ChunkOptions = {}): ChunkResult<T[]> {
  const { balanced } = { ...DEFAULT_CHUNK_OPTIONS, ...options };
  const totalElements = data.length;

  if (totalElements === 0) {
    return {
      chunks: [],
      chunkInfo: [],
      totalElements: 0,
      numChunks: 0,
    };
  }

  const numChunks = calculateOptimalChunks(totalElements, options);

  if (numChunks <= 1) {
    return {
      chunks: [data],
      chunkInfo: [
        {
          startIndex: 0,
          endIndex: totalElements,
          length: totalElements,
          chunkIndex: 0,
        },
      ],
      totalElements,
      numChunks: 1,
    };
  }

  const chunks: T[][] = [];
  const chunkInfo: ChunkInfo[] = [];

  if (balanced) {
    const baseChunkSize = Math.floor(totalElements / numChunks);
    const remainder = totalElements % numChunks;

    let currentIndex = 0;
    for (let i = 0; i < numChunks; i++) {
      const thisChunkSize = baseChunkSize + (i < remainder ? 1 : 0);
      const endIndex = currentIndex + thisChunkSize;

      chunks.push(data.slice(currentIndex, endIndex));
      chunkInfo.push({
        startIndex: currentIndex,
        endIndex,
        length: thisChunkSize,
        chunkIndex: i,
      });

      currentIndex = endIndex;
    }
  } else {
    const chunkSize = Math.ceil(totalElements / numChunks);

    let currentIndex = 0;
    let chunkIndex = 0;
    while (currentIndex < totalElements) {
      const endIndex = Math.min(currentIndex + chunkSize, totalElements);
      const thisChunkSize = endIndex - currentIndex;

      chunks.push(data.slice(currentIndex, endIndex));
      chunkInfo.push({
        startIndex: currentIndex,
        endIndex,
        length: thisChunkSize,
        chunkIndex,
      });

      currentIndex = endIndex;
      chunkIndex++;
    }
  }

  return {
    chunks,
    chunkInfo,
    totalElements,
    numChunks: chunks.length,
  };
}

/**
 * Merge chunked results back into a single array
 *
 * @param chunks - Array of chunk results
 * @returns Merged array
 */
export function mergeFloat64Chunks(chunks: Float64Array[]): Float64Array {
  if (chunks.length === 0) return new Float64Array(0);
  if (chunks.length === 1) return chunks[0];

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float64Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Merge generic array chunks
 *
 * @param chunks - Array of chunk results
 * @returns Merged array
 */
export function mergeArrayChunks<T>(chunks: T[][]): T[] {
  if (chunks.length === 0) return [];
  if (chunks.length === 1) return chunks[0];

  return chunks.flat();
}

/**
 * Determine if an array should be parallelized based on size
 *
 * @param elementCount - Number of elements
 * @param threshold - Minimum elements for parallelization (default: 10000)
 * @returns Whether parallelization is recommended
 */
export function shouldParallelize(elementCount: number, threshold: number = 10000): boolean {
  return elementCount >= threshold;
}

/**
 * Calculate the memory size of a Float64Array in bytes
 *
 * @param data - The array
 * @returns Size in bytes
 */
export function memorySizeBytes(data: Float64Array): number {
  return data.byteLength;
}

/**
 * Create a range partitioner for parallel iteration
 *
 * @param start - Start of range (inclusive)
 * @param end - End of range (exclusive)
 * @param options - Chunking options
 * @returns Array of [start, end] pairs for each chunk
 */
export function partitionRange(
  start: number,
  end: number,
  options: ChunkOptions = {}
): Array<[number, number]> {
  const totalElements = end - start;
  const numChunks = calculateOptimalChunks(totalElements, options);

  if (numChunks <= 1) {
    return [[start, end]];
  }

  const partitions: Array<[number, number]> = [];
  const baseChunkSize = Math.floor(totalElements / numChunks);
  const remainder = totalElements % numChunks;

  let currentIndex = start;
  for (let i = 0; i < numChunks; i++) {
    const thisChunkSize = baseChunkSize + (i < remainder ? 1 : 0);
    const endIndex = currentIndex + thisChunkSize;

    partitions.push([currentIndex, endIndex]);
    currentIndex = endIndex;
  }

  return partitions;
}

/**
 * Create a 2D partition for matrix operations
 *
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @param options - Chunking options
 * @returns Array of [rowStart, rowEnd, colStart, colEnd] tuples
 */
export function partition2D(
  rows: number,
  cols: number,
  options: ChunkOptions = {}
): Array<[number, number, number, number]> {
  // For matrices, partition by rows (more cache-friendly)
  const rowPartitions = partitionRange(0, rows, options);

  return rowPartitions.map(([rowStart, rowEnd]) => [rowStart, rowEnd, 0, cols]);
}
