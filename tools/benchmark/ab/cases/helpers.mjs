import { mulberry32 } from '../util.mjs';

/** @param {number} rows @param {number} cols @param {number} seed */
export function randomMatrix(rows, cols, seed) {
  const rand = mulberry32(seed);
  const m = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) row.push(rand() * 2 - 1);
    m.push(row);
  }
  return m;
}
