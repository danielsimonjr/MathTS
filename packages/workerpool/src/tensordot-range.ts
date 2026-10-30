/**
 * Pure-JS tensordot over a contiguous range `[outStart, outEnd)` of output elements.
 *
 * Shared by the worker `tensordotChunk` handler and `@danielsimonjr/mathts-parallel`
 * sequential fallback. Imports only workerpool-local modules so `dist/worker.js`
 * stays free of external package imports.
 */

import { forEachMultiIndex } from './multi-index.js';
import { _tdRowMajorStrides } from './worker-numerics.js';

function flatIndex(idx: readonly number[], strides: readonly number[]): number {
  let flat = 0;
  for (let i = 0; i < idx.length; i++) flat += idx[i] * strides[i];
  return flat;
}

/**
 * Contracts axis `axesA[i]` of `a` with axis `axesB[i]` of `b`. Result layout is
 * free-A axes first, then free-B axes (NumPy convention).
 */
export function tensordotRange(
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

  const contractedSizes = axesA.map((ax) => aShape[ax]);

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
      for (let ci = 0; ci < axesA.length; ci++) aIdx[axesA[ci]] = contractVals[ci];

      const bIdx = new Array<number>(bRank).fill(0);
      for (let fi = 0; fi < bFreeAxes.length; fi++) bIdx[bFreeAxes[fi]] = bFreeVals[fi];
      for (let ci = 0; ci < axesB.length; ci++) bIdx[axesB[ci]] = contractVals[ci];

      acc += a[flatIndex(aIdx, aStrides)] * b[flatIndex(bIdx, bStrides)];
    });

    result[outFlat - outStart] = acc;
  }

  return result;
}
