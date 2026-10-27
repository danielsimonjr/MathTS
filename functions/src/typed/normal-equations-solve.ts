/**
 * Gaussian elimination with partial pivoting on an augmented normal-equations
 * matrix `[A^T A | A^T y]` (k × (k+1)). Used by polynomial-basis least-squares
 * JS fallbacks; not exported from the package barrel.
 */

/** Returns coefficients or `null` when `|pivot| < 1e-14`. */
export function solveAugmentedNormalEquations(ATA: number[][]): number[] | null {
  const k = ATA.length;
  for (let col = 0; col < k; col++) {
    let maxRow = col;
    let maxVal = Math.abs(ATA[col][col]);
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(ATA[row][col]) > maxVal) {
        maxVal = Math.abs(ATA[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-14) return null;
    if (maxRow !== col) [ATA[col], ATA[maxRow]] = [ATA[maxRow], ATA[col]];
    for (let row = col + 1; row < k; row++) {
      const factor = ATA[row][col] / ATA[col][col];
      for (let j = col; j <= k; j++) ATA[row][j] -= factor * ATA[col][j];
    }
  }

  const coeffs = new Array<number>(k);
  for (let i = k - 1; i >= 0; i--) {
    coeffs[i] = ATA[i][k];
    for (let j = i + 1; j < k; j++) coeffs[i] -= ATA[i][j] * coeffs[j];
    coeffs[i] /= ATA[i][i];
  }
  return coeffs;
}
