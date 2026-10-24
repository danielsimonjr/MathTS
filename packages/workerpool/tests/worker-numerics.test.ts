import { describe, it, expect } from 'vitest';
import { mulberry32, rowMajorStrides } from '@danielsimonjr/mathts-core';
import { _workerMulberry32, _tdRowMajorStrides } from '../src/worker-numerics.js';

/** Independent oracle: first 8 outputs of origin/main `makeMulberry32(42)`. */
const MULBERRY32_42_FIRST_8 = [
  0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
  0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129,
];

describe('worker-numerics parity with core', () => {
  it('mulberry32 copy matches core for the first 8 outputs at seed 42', () => {
    const coreRng = mulberry32(42);
    const workerRng = _workerMulberry32(42);
    const fromCore: number[] = [];
    const fromWorker: number[] = [];
    for (let i = 0; i < 8; i++) {
      fromCore.push(coreRng());
      fromWorker.push(workerRng());
    }
    expect(fromWorker).toEqual(fromCore);
    expect(fromWorker).toEqual(MULBERRY32_42_FIRST_8);
  });

  it('rowMajorStrides copy matches core', () => {
    expect(_tdRowMajorStrides([2, 3, 4])).toEqual(rowMajorStrides([2, 3, 4]));
    expect(_tdRowMajorStrides([])).toEqual(rowMajorStrides([]));
    expect(_tdRowMajorStrides([0, 5])).toEqual(rowMajorStrides([0, 5]));
  });
});
