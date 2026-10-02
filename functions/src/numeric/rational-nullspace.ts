/**
 * Exact rational null space.
 *
 * The numeric `nullspace` reduces with floating-point pivots and a 1e-10 cutoff.
 * Dimensional analysis (Buckingham-π) needs the null space of a matrix of small
 * rational exponents, where that cutoff can drop a real pivot or return a basis
 * that is only approximately dimensionless. This routine reduces over
 * {@link Fraction} (bigint numerator and denominator) and returns an integer
 * basis: each vector is scaled to content 1, and its first nonzero entry is
 * positive. That is the same normalization the Buckingham-π enumerator uses.
 *
 * @packageDocumentation
 */

import { Fraction, isFraction } from '@danielsimonjr/mathts-core';

/** One exact null-space basis of a rational matrix. */
export interface RationalNullspaceResult {
  /**
   * Basis vectors, one per free column, in increasing column order.
   * Each entry is an integer {@link Fraction} (denominator 1).
   */
  readonly basis: Fraction[][];
  /** Rank of the matrix: the number of nonzero rows after exact RREF. */
  readonly rank: number;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a / gcd(a, b)) * b;
}

function entryToFraction(value: number | Fraction, row: number, col: number): Fraction {
  if (isFraction(value)) return value;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(
      `rationalNullspace: entry [${row}, ${col}] must be a finite number or a Fraction`
    );
  }
  return Number.isInteger(value) ? new Fraction(value, 1) : Fraction.fromNumber(value);
}

/** Scale a fraction vector to a primitive integer vector with a positive leading entry. */
function integerize(vec: Fraction[]): Fraction[] {
  let scale = 1n;
  for (const f of vec) {
    if (f.numerator !== 0n) scale = lcm(scale, f.denominator);
  }
  const ints = vec.map((f) => (f.numerator * scale) / f.denominator);
  let content = 0n;
  for (const x of ints) {
    if (x !== 0n) content = gcd(content, x);
  }
  if (content === 0n) content = 1n;
  const reduced = ints.map((x) => x / content);
  const first = reduced.find((x) => x !== 0n) ?? 0n;
  const sign = first < 0n ? -1n : 1n;
  return reduced.map((x) => new Fraction(sign * x, 1n));
}

/**
 * Exact reduced row echelon form. Returns the pivot columns.
 * Pivot selection matches the Buckingham enumerator: the first nonzero entry
 * at or below the current row, not a floating-point partial pivot.
 */
function rref(matrix: Fraction[][]): number[] {
  const rows = matrix.length;
  const cols = rows === 0 ? 0 : matrix[0].length;
  const pivotCols: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let pivotRow = -1;
    for (let i = r; i < rows; i++) {
      if (matrix[i][c].numerator !== 0n) {
        pivotRow = i;
        break;
      }
    }
    if (pivotRow === -1) continue;
    if (pivotRow !== r) {
      const swap = matrix[r];
      matrix[r] = matrix[pivotRow];
      matrix[pivotRow] = swap;
    }
    const pivot = matrix[r][c];
    for (let j = 0; j < cols; j++) matrix[r][j] = matrix[r][j].div(pivot);
    for (let i = 0; i < rows; i++) {
      if (i === r || matrix[i][c].numerator === 0n) continue;
      const factor = matrix[i][c];
      for (let j = 0; j < cols; j++) {
        matrix[i][j] = matrix[i][j].sub(factor.mul(matrix[r][j]));
      }
    }
    pivotCols.push(c);
    r++;
  }
  return pivotCols;
}

/**
 * Exact null space of a matrix with rational entries.
 *
 * Numbers are converted with {@link Fraction.fromNumber} (continued fraction,
 * denominator at most 10^6). Pass {@link Fraction} entries when the exponent
 * is already an exact ratio, such as `1/3`.
 *
 * The numeric {@link nullspace} is unchanged. This function does not replace it.
 *
 * @example
 * ```ts
 * // period, length, gravity — one dimensionless group T² · g / L
 * rationalNullspace([
 *   [0, 1, 1],
 *   [1, 0, -2],
 * ]);
 * // { rank: 2, basis: [[2, -1, 1]] }
 * ```
 */
export function rationalNullspace(
  matrix: ReadonlyArray<ReadonlyArray<number | Fraction>>
): RationalNullspaceResult {
  if (matrix.length === 0) return { basis: [], rank: 0 };

  const cols = matrix[0].length;
  for (let i = 0; i < matrix.length; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== cols) {
      throw new TypeError(
        `rationalNullspace: row ${i} has length ${matrix[i]?.length ?? 'n/a'}; expected ${cols}`
      );
    }
  }

  const reduced = matrix.map((row, i) => row.map((value, j) => entryToFraction(value, i, j)));
  const pivotCols = rref(reduced);
  const pivotSet = new Set(pivotCols);
  const basis: Fraction[][] = [];
  const zero = new Fraction(0n, 1n);
  const one = new Fraction(1n, 1n);

  for (let free = 0; free < cols; free++) {
    if (pivotSet.has(free)) continue;
    const vec: Fraction[] = new Array(cols);
    for (let j = 0; j < cols; j++) vec[j] = zero;
    vec[free] = one;
    for (let i = 0; i < pivotCols.length; i++) {
      vec[pivotCols[i]] = zero.sub(reduced[i][free]);
    }
    basis.push(integerize(vec));
  }

  return { basis, rank: pivotCols.length };
}
