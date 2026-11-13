import { describe, it, expect } from 'vitest';
import { cov, corrcoef } from '@danielsimonjr/mathts-functions';

/**
 * WS-A API contracts (issues #896, #897, #899, #900, #923 and the ODE message items).
 * Reference values come from NumPy / SciPy and are pinned here so CI needs no Python.
 */

const arrClose = (a: number[], b: number[], digits = 12): void => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
};

describe('#896 — cov / corrcoef rowvar option', () => {
  it('corrcoef default layout is observations as rows (rowvar=false), unchanged', () => {
    // 3 observations x 2 variables: columns are variables.
    const obs = [
      [1, 2],
      [2, 4],
      [3, 6],
    ];
    const r = corrcoef(obs);
    expect(r.length).toBe(2);
    expect(r[0].length).toBe(2);
    arrClose(r[0], [1, 1]);
    arrClose(r[1], [1, 1]);
  });

  it('corrcoef({ rowvar: true }) takes variables as rows (np.corrcoef([[1,2,3],[4,5,6]]))', () => {
    // NumPy: np.corrcoef([[1,2,3],[4,5,6]]) -> [[1,1],[1,1]], shape 2x2.
    const r = corrcoef(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      { rowvar: true }
    );
    expect(r.length).toBe(2);
    expect(r[0].length).toBe(2);
    arrClose(r[0], [1, 1]);
    arrClose(r[1], [1, 1]);
  });

  it('corrcoef({ rowvar: true }) matches the transpose of the default layout on 3 variables', () => {
    // Variables as rows: a, b, c. NumPy np.corrcoef(rows) gives the 3x3 Pearson matrix.
    const rows = [
      [1, 2, 3, 4, 5],
      [2, 1, 4, 3, 5],
      [5, 4, 3, 2, 1],
    ];
    const cols = rows[0].map((_, j) => rows.map((r) => r[j]));
    const byRows = corrcoef(rows, { rowvar: true });
    const byCols = corrcoef(cols);
    expect(byRows.length).toBe(3);
    for (let i = 0; i < 3; i++) arrClose(byRows[i], byCols[i]);
    expect(byRows[0][1]).toBeCloseTo(0.8, 12); // r = 8/10 for x=1..5, y=[2,1,4,3,5]
  });

  it('cov({ rowvar: true }) matches np.cov on variables as rows', () => {
    // np.cov([[1,2,3],[4,5,6]]) -> [[1,1],[1,1]] (ddof=1).
    const c = cov(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      undefined,
      1,
      { rowvar: true }
    ) as number[][];
    arrClose(c[0], [1, 1]);
    arrClose(c[1], [1, 1]);
  });

  it('cov default layout is unchanged (rowvar=false)', () => {
    const c = cov([
      [1, 2],
      [2, 4],
      [3, 6],
    ]) as number[][];
    arrClose(c[0], [1, 2]);
    arrClose(c[1], [2, 4]);
  });

  it('rowvar with the two-vector form throws (no silent ignore)', () => {
    expect(() => cov([1, 2, 3], [4, 5, 6], 1, { rowvar: true })).toThrow(/rowvar/);
  });
});
