/**
 * The two tensordot range kernels as they were before P6-8, verbatim except for names, so a
 * differential test compares the shared `tensordotRange` with what shipped. Not imported by `src`.
 *
 *  - `legacyParallelKernel`: `tensordotChunkKernel` from `parallel/src/ComputePool.ts` (sequential
 *    path), strides from core, axes copied with `Array.from`.
 *  - `legacyWorkerKernel`: the body of `tensordotChunk` in `packages/workerpool/src/worker.ts`
 *    (worker path), strides from `worker-numerics`, buffers unwrapped by the caller.
 */
import { rowMajorStrides } from '@danielsimonjr/mathts-core';
import { forEachMultiIndex } from '../../src/multi-index.js';
import { _tdRowMajorStrides } from '../../src/worker-numerics.js';

function flatIndex(idx: readonly number[], strides: readonly number[]): number {
  let flat = 0;
  for (let i = 0; i < idx.length; i++) flat += idx[i] * strides[i];
  return flat;
}

export function legacyParallelKernel(
  a: Float64Array,
  aShape: readonly number[],
  b: Float64Array,
  bShape: readonly number[],
  axesA: readonly number[],
  axesB: readonly number[],
  resultShape: readonly number[],
  outStart: number,
  outEnd: number
): Float64Array {
  const aStrides = rowMajorStrides(aShape);
  const bStrides = rowMajorStrides(bShape);
  const outStrides = rowMajorStrides(resultShape);

  const aRank = aShape.length;
  const bRank = bShape.length;
  const contractedAxesA = Array.from(axesA);
  const contractedAxesB = Array.from(axesB);
  const contractedSetA = new Set(contractedAxesA);
  const contractedSetB = new Set(contractedAxesB);

  const aFreeAxes: number[] = [];
  const bFreeAxes: number[] = [];
  for (let i = 0; i < aRank; i++) if (!contractedSetA.has(i)) aFreeAxes.push(i);
  for (let i = 0; i < bRank; i++) if (!contractedSetB.has(i)) bFreeAxes.push(i);

  const contractedSizes = contractedAxesA.map((ax) => aShape[ax]);

  const chunkLen = outEnd - outStart;
  const result = new Float64Array(chunkLen);

  const outRank = resultShape.length;
  const outIdx = new Array<number>(outRank);

  for (let outFlat = outStart; outFlat < outEnd; outFlat++) {
    let rem = outFlat;
    for (let d = 0; d < outRank; d++) {
      outIdx[d] = Math.floor(rem / outStrides[d]);
      rem -= outIdx[d] * outStrides[d];
    }

    const aFreeVals = outIdx.slice(0, aFreeAxes.length);
    const bFreeVals = outIdx.slice(aFreeAxes.length);

    let acc = 0;
    forEachMultiIndex(contractedSizes, (contractVals) => {
      const aIdx = new Array<number>(aRank).fill(0);
      for (let fi = 0; fi < aFreeAxes.length; fi++) aIdx[aFreeAxes[fi]] = aFreeVals[fi];
      for (let ci = 0; ci < contractedAxesA.length; ci++)
        aIdx[contractedAxesA[ci]] = contractVals[ci];

      const bIdx = new Array<number>(bRank).fill(0);
      for (let fi = 0; fi < bFreeAxes.length; fi++) bIdx[bFreeAxes[fi]] = bFreeVals[fi];
      for (let ci = 0; ci < contractedAxesB.length; ci++)
        bIdx[contractedAxesB[ci]] = contractVals[ci];

      acc += a[flatIndex(aIdx, aStrides)] * b[flatIndex(bIdx, bStrides)];
    });

    result[outFlat - outStart] = acc;
  }

  return result;
}

export function legacyWorkerKernel(
  aBuffer: ArrayBuffer,
  aShape: number[],
  bBuffer: ArrayBuffer,
  bShape: number[],
  axesA: number[],
  axesB: number[],
  resultShape: number[],
  outStart: number,
  outEnd: number
): ArrayBuffer {
  const a = new Float64Array(aBuffer);
  const b = new Float64Array(bBuffer);

  const aStrides = _tdRowMajorStrides(aShape);
  const bStrides = _tdRowMajorStrides(bShape);
  const outStrides = _tdRowMajorStrides(resultShape);

  const aRank = aShape.length;
  const bRank = bShape.length;
  const contractedSetA = new Set(axesA);
  const contractedSetB = new Set(axesB);

  const aFreeAxes: number[] = [];
  const bFreeAxes: number[] = [];
  for (let i = 0; i < aRank; i++) if (!contractedSetA.has(i)) aFreeAxes.push(i);
  for (let i = 0; i < bRank; i++) if (!contractedSetB.has(i)) bFreeAxes.push(i);

  const contractedSizes = axesA.map((ax: number) => aShape[ax]);

  const chunkLen = outEnd - outStart;
  const result = new Float64Array(chunkLen);
  const outRank = resultShape.length;
  const outIdx = new Array<number>(outRank);

  for (let outFlat = outStart; outFlat < outEnd; outFlat++) {
    let rem = outFlat;
    for (let d = 0; d < outRank; d++) {
      outIdx[d] = Math.floor(rem / outStrides[d]);
      rem -= outIdx[d] * outStrides[d];
    }

    const aFreeVals = outIdx.slice(0, aFreeAxes.length);
    const bFreeVals = outIdx.slice(aFreeAxes.length);

    let acc = 0;
    forEachMultiIndex(contractedSizes, (contractVals: number[]) => {
      const aIdx = new Array<number>(aRank).fill(0);
      for (let fi = 0; fi < aFreeAxes.length; fi++) aIdx[aFreeAxes[fi]] = aFreeVals[fi];
      for (let ci = 0; ci < axesA.length; ci++) aIdx[axesA[ci]] = contractVals[ci];

      const bIdx = new Array<number>(bRank).fill(0);
      for (let fi = 0; fi < bFreeAxes.length; fi++) bIdx[bFreeAxes[fi]] = bFreeVals[fi];
      for (let ci = 0; ci < axesB.length; ci++) bIdx[axesB[ci]] = contractVals[ci];

      acc += a[flatIndex(aIdx, aStrides)] * b[flatIndex(bIdx, bStrides)];
    });

    result[outFlat - outStart] = acc;
  }

  return result.buffer;
}
