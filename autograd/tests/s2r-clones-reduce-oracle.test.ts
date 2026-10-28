/**
 * Sprint clone-merge M16 (TapedTensor.sum / mean backward scatter) — independent
 * oracles with Object.is on every gradient element. Reference scatter is
 * duplicated here (not imported from tape.ts) so refactors cannot drift silently.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '../src/tape.js';

function resolveAxes(axis: number | ReadonlyArray<number> | undefined, rank: number): number[] {
  if (axis === undefined) {
    return Array.from({ length: rank }, (_, i) => i);
  }
  if (typeof axis === 'number') {
    return [axis];
  }
  return [...axis].sort((a, b) => a - b);
}

/** Independent copy of the pre-merge reduced-broadcast backward scatter. */
function oracleReducedScatter(
  inputShape: ReadonlyArray<number>,
  outputGrad: Float64Array,
  outShape: ReadonlyArray<number>,
  axis: number | ReadonlyArray<number> | undefined,
  keepDims: boolean,
  mode: 'sum' | 'mean'
): Float64Array {
  const axes = resolveAxes(axis, inputShape.length);
  const axisSet = new Set(axes);
  const N =
    mode === 'mean' ? axes.reduce((prod: number, ax: number) => prod * inputShape[ax], 1) : 1;

  const outStrides = Tensor.rowMajorStrides(outShape);
  const grad = new Float64Array(Tensor.sizeOf(inputShape));
  const inputSize = grad.length;
  const inCoords = new Array<number>(inputShape.length).fill(0);

  for (let n = 0; n < inputSize; n++) {
    let outFlat = 0;
    let outDim = 0;
    for (let k = 0; k < inputShape.length; k++) {
      if (axisSet.has(k)) {
        if (keepDims) outDim++;
      } else {
        outFlat += inCoords[k] * outStrides[outDim];
        outDim++;
      }
    }
    const g = outputGrad[outFlat];
    grad[n] = mode === 'mean' ? g / N : g;

    for (let k = inputShape.length - 1; k >= 0; k--) {
      if (++inCoords[k] < inputShape[k]) break;
      inCoords[k] = 0;
    }
  }
  return grad;
}

function assertGradObjectIs(actual: Float64Array, expected: Float64Array, label: string): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      throw new Error(
        `${label}: grad[${i}] Object.is mismatch: actual=${actual[i]} expected=${expected[i]}`
      );
    }
    expect(Object.is(actual[i], expected[i])).toBe(true);
  }
}

function runTapeBackward(
  data: Float64Array,
  shape: ReadonlyArray<number>,
  op: 'sum' | 'mean',
  axis: number | ReadonlyArray<number> | undefined,
  keepDims: boolean,
  upstream: Float64Array
): Float64Array {
  const tape = new Tape();
  const { id } = tape.allocate(data.length);
  const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
  const out = op === 'sum' ? leaf.sum(axis, { keepDims }) : leaf.mean(axis, { keepDims });
  tape.backward(out.id, new Float64Array(upstream));
  return tape.getInputGrad(id)!;
}

type ReduceCase = {
  label: string;
  shape: number[];
  data: number[];
  axis?: number | number[];
  keepDims?: boolean;
  upstream?: number[];
  op: 'sum' | 'mean';
};

const CASES: ReduceCase[] = [
  {
    label: 'sum all keepDims false',
    shape: [2, 3],
    data: [1, 2, 3, 4, 5, 6],
    op: 'sum',
  },
  {
    label: 'sum axis=1 keepDims true',
    shape: [2, 3],
    data: [1, -0, 3, 4, 5, 6],
    axis: 1,
    keepDims: true,
    upstream: [0.5, -2],
    op: 'sum',
  },
  {
    label: 'sum axes [0,1] keepDims false scalar upstream',
    shape: [2, 2],
    data: [1, 2, 3, 4],
    axis: [0, 1],
    op: 'sum',
  },
  {
    label: 'mean axis=0 N=3 not power of two',
    shape: [3, 2],
    data: [1, 2, 3, 4, 5, 6],
    axis: 0,
    upstream: [1, 1],
    op: 'mean',
  },
  {
    label: 'mean axis=1 N=5',
    shape: [2, 5],
    data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    axis: 1,
    upstream: [2, -1],
    op: 'mean',
  },
  {
    label: 'mean all N=7',
    shape: [7],
    data: [1, 2, 3, 4, 5, 6, 7],
    op: 'mean',
  },
  {
    label: 'mean axis length 1 matches sum scale',
    shape: [4, 1],
    data: [2, 3, 4, 5],
    axis: 1,
    keepDims: true,
    upstream: [1, 1, 1, 1],
    op: 'mean',
  },
  {
    label: 'sum NaN Infinity -0 broadcast',
    shape: [2, 2],
    data: [NaN, Infinity, -0, 1],
    axis: 0,
    upstream: [1, -1],
    op: 'sum',
  },
  {
    label: 'mean NaN Infinity -0 divide by N=2',
    shape: [2, 2],
    data: [NaN, 2, -0, Infinity],
    op: 'mean',
  },
  {
    label: 'sum multiple axes N product 6',
    shape: [2, 3, 1],
    data: [1, 2, 3, 4, 5, 6],
    axis: [0, 1],
    keepDims: false,
    upstream: [7],
    op: 'sum',
  },
  {
    label: 'mean multiple axes N=6',
    shape: [2, 3],
    data: [1, 1, 1, 2, 2, 2],
    axis: [0, 1],
    op: 'mean',
  },
];

describe('TapedTensor sum/mean backward oracle — Object.is vs independent scatter', () => {
  for (const c of CASES) {
    it(`${c.op} ${c.label}`, () => {
      const data = new Float64Array(c.data);
      const shape = c.shape;
      const keepDims = c.keepDims ?? false;
      const primal = new Tensor(shape, data);
      const outT =
        c.op === 'sum' ? primal.sum(c.axis, { keepDims }) : primal.mean(c.axis, { keepDims });
      const upstream = new Float64Array(c.upstream ?? outT.data.length).fill(1);

      const expected = oracleReducedScatter(shape, upstream, outT.shape, c.axis, keepDims, c.op);
      const actual = runTapeBackward(data, shape, c.op, c.axis, keepDims, upstream);
      assertGradObjectIs(actual, expected, c.label);
    });
  }

  it('mean length-1 axis gradient equals sum on the same call', () => {
    const data = new Float64Array([2, 3, 4, 5]);
    const shape = [4, 1];
    const axis = 1;
    const keepDims = true;
    const upstream = new Float64Array([1, 2, 3, 4]);
    const sumGrad = runTapeBackward(data, shape, 'sum', axis, keepDims, upstream);
    const meanGrad = runTapeBackward(data, shape, 'mean', axis, keepDims, upstream);
    assertGradObjectIs(meanGrad, sumGrad, 'mean vs sum axis len 1');
  });

  it('negative axis throws on forward (tensor validates before backward)', () => {
    const tape = new Tape();
    const { id } = tape.allocate(4);
    const leaf = new TapedTensor([2, 2], new Float64Array([1, 2, 3, 4]), tape, id);
    expect(() => leaf.sum(-1)).toThrow(/axis -1 out of range/);
    expect(() => leaf.mean(-1)).toThrow(/axis -1 out of range/);
  });
});
