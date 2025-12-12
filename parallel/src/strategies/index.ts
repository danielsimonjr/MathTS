/**
 * Parallel Strategies
 *
 * Strategies for chunking, threshold-based dispatch, and workload distribution.
 *
 * @packageDocumentation
 */

// Chunking strategies
export {
  calculateOptimalChunks,
  chunkFloat64Array,
  chunkArray,
  mergeFloat64Chunks,
  mergeArrayChunks,
  shouldParallelize as shouldChunkParallelize,
  partitionRange,
  partition2D,
  type ChunkOptions,
  type ChunkResult,
  type ChunkInfo,
} from './chunk.js';

// Threshold-based dispatch
export {
  ThresholdDispatcher,
  thresholdDispatcher,
  shouldParallelize,
  dispatch,
  calculateChunks,
  DEFAULT_THRESHOLDS,
  type ThresholdConfig,
  type OperationCategory,
  type ExecutionMode,
  type DispatchResult,
} from './threshold.js';
