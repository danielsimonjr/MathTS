import { describe, it, expect } from 'vitest';
import { tensordotRange } from '../src/tensordot-range.js';

function rowMajorStrides(shape: readonly number[]): number[] {
  const strides = new Array<number>(shape.length);
  let s = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    strides[i] = s;
    s *= shape[i];
  }
  return strides;
}

function flatIndex(idx: number[], strides: readonly number[]): number {
  let f = 0;
  for (let i = 0; i < idx.length; i++) f += idx[i] * strides[i];
  return f;
}

/** Independent nested-loop tensordot oracle (small shapes only). */
function naiveTensordotRange(
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
  const aStr = rowMajorStrides(aShape);
  const bStr = rowMajorStrides(bShape);
  const aFree: number[] = [];
  const bFree: number[] = [];
  const cA = new Set(axesA);
  const cB = new Set(axesB);
  for (let i = 0; i < aShape.length; i++) if (!cA.has(i)) aFree.push(i);
  for (let i = 0; i < bShape.length; i++) if (!cB.has(i)) bFree.push(i);
  const contractSizes = axesA.map((ax) => aShape[ax]);
  const out = new Float64Array(outEnd - outStart);
  const outStr = rowMajorStrides(resultShape);

  for (let outFlat = outStart; outFlat < outEnd; outFlat++) {
    const outIdx = new Array<number>(resultShape.length).fill(0);
    let rem = outFlat;
    for (let d = 0; d < resultShape.length; d++) {
      outIdx[d] = Math.floor(rem / outStr[d]);
      rem -= outIdx[d] * outStr[d];
    }
    const aFreeVals = outIdx.slice(0, aFree.length);
    const bFreeVals = outIdx.slice(aFree.length);

    let acc = 0;
    const walk = (depth: number, contract: number[]) => {
      if (depth === contractSizes.length) {
        const aIdx = new Array(aShape.length).fill(0);
        const bIdx = new Array(bShape.length).fill(0);
        for (let fi = 0; fi < aFree.length; fi++) aIdx[aFree[fi]] = aFreeVals[fi];
        for (let fi = 0; fi < bFree.length; fi++) bIdx[bFree[fi]] = bFreeVals[fi];
        for (let ci = 0; ci < axesA.length; ci++) {
          aIdx[axesA[ci]] = contract[ci];
          bIdx[axesB[ci]] = contract[ci];
        }
        acc += a[flatIndex(aIdx, aStr)] * b[flatIndex(bIdx, bStr)];
        return;
      }
      for (let v = 0; v < contractSizes[depth]; v++) {
        contract[depth] = v;
        walk(depth + 1, contract);
      }
    };
    walk(0, new Array(contractSizes.length).fill(0));
    out[outFlat - outStart] = acc;
  }
  return out;
}

describe('tensordotRange pin (P6-8)', () => {
  it('matches naive oracle for rank-3 × rank-2 contraction on a sub-range', () => {
    const aShape = [2, 3, 4];
    const bShape = [4, 5];
    const axesA = [2];
    const axesB = [0];
    const resultShape = [2, 3, 5];

    const a = new Float64Array(aShape.reduce((p, d) => p * d, 1));
    const b = new Float64Array(bShape.reduce((p, d) => p * d, 1));
    for (let i = 0; i < a.length; i++) a[i] = Math.sin(i * 0.7);
    for (let i = 0; i < b.length; i++) b[i] = Math.cos(i * 0.3);

    const outStart = 3;
    const outEnd = 17;
    const got = tensordotRange(a, aShape, b, bShape, axesA, axesB, resultShape, outStart, outEnd);
    const ref = naiveTensordotRange(
      a,
      aShape,
      b,
      bShape,
      axesA,
      axesB,
      resultShape,
      outStart,
      outEnd
    );
    expect(Array.from(got)).toEqual(Array.from(ref));
  });

  it('full range matches sub-range concatenation', () => {
    const aShape = [2, 2];
    const bShape = [2, 3];
    const a = new Float64Array([1, 2, 3, 4]);
    const b = new Float64Array([1, 0, 0, 1, 2, 3]);
    const resultShape = [2, 3];

    const full = tensordotRange(a, aShape, b, bShape, [1], [0], resultShape, 0, 6);
    const part0 = tensordotRange(a, aShape, b, bShape, [1], [0], resultShape, 0, 3);
    const part1 = tensordotRange(a, aShape, b, bShape, [1], [0], resultShape, 3, 6);
    expect(Array.from(full)).toEqual([...part0, ...part1]);
  });
});
