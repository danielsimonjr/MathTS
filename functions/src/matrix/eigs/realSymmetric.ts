import { clone } from '../../utils/object.js';
import type BigNumber from 'bignumber.js';

/** Scalar types for real symmetric eigenvalue computation */
type Scalar = number | BigNumber;

// Type definitions
/** Result for a single eigenvector with its corresponding eigenvalue */
interface EigenvectorResult {
  value: Scalar;
  vector: Scalar[];
}

/** Result of real symmetric eigenvalue computation */
interface EigenResult {
  values: Scalar[];
  eigenvectors?: EigenvectorResult[];
}

/** Configuration object */
interface Config {
  relTol: number | BigNumber;
}

/** Dependencies for createRealSymmetric */
interface Dependencies {
  config: Config;
  addScalar: (a: Scalar, b: Scalar) => Scalar;
  subtract: (a: Scalar, b: Scalar) => Scalar;
  abs: (x: Scalar) => number | BigNumber;
  atan: (x: Scalar) => Scalar;
  cos: (x: Scalar) => Scalar;
  sin: (x: Scalar) => Scalar;
  multiplyScalar: (a: Scalar, b: Scalar) => Scalar;
  inv: (x: Scalar) => Scalar;
  bignumber: (x: number | string) => BigNumber;
  multiply: (...args: Scalar[]) => Scalar;
  add: (...args: Scalar[]) => Scalar;
}

/**
 * Create the function that computes the eigenvalues and the optional eigenvectors of a
 * real symmetric matrix.
 */
export function createRealSymmetric({
  config,
  addScalar,
  subtract,
  abs,
  atan,
  cos,
  sin,
  multiplyScalar,
  inv,
  bignumber,
  multiply,
  add,
}: Dependencies) {
  // BigNumber comparison helpers — JavaScript's >=/</<= operators don't work
  // with Decimal.js objects because valueOf() returns strings, causing
  // lexicographic comparison instead of numeric (e.g., "1" < "5e-13").
  function bigLt(a: Scalar, b: Scalar): boolean {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    return (a as BigNumber).lt(b as BigNumber);
  }
  function bigLte(a: Scalar, b: Scalar): boolean {
    if (typeof a === 'number' && typeof b === 'number') return a <= b;
    return (a as BigNumber).lte(b as BigNumber);
  }

  /**
   * Compute eigenvalues and optionally eigenvectors of a real symmetric matrix
   * @param arr the matrix
   * @param _N size of the matrix (not used)
   * @param prec precision threshold
   * @param type data type ('number' or 'BigNumber')
   * @param computeVectors whether to compute eigenvectors
   */
  function main(
    arr: Scalar[][],
    _N: number,
    prec: number | BigNumber = config.relTol,
    type: 'number' | 'BigNumber',
    computeVectors: boolean
  ): EigenResult {
    if (type === 'number') {
      return diag(arr as number[][], prec as number, computeVectors);
    }

    if (type === 'BigNumber') {
      return diagBig(arr as BigNumber[][], prec as BigNumber, computeVectors);
    }

    throw TypeError('Unsupported data type: ' + type);
  }

  // diagonalization implementation for number (efficient)
  function diag(x: number[][], precision: number, computeVectors: boolean): EigenResult {
    const N = x.length;

    // both tolerances are relative to the matrix scale (largest entry), so
    // eigs(c * A) = c * eigs(A) for every c (#1243)
    let scale = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        scale = Math.max(scale, Math.abs(x[i][j]));
      }
    }
    // initial error
    let Vab = getAij(x);
    // No tolerance is below the rounding error of one rotation. A rotation
    // combines off-diagonal entries only (the diagonal sets the angle), so the
    // error is relative to the largest off-diagonal entry, not to the scale:
    // a block beside a huge diagonal entry keeps its own accuracy. Where the
    // products underflow the error is 4N subnormal units (Number.MIN_VALUE).
    // The tolerance itself is the smaller of mathjs's absolute |precision / N|
    // and the scale-relative |precision / N| * scale (#1561): for a matrix at a
    // subunit scale the relative form keeps the solve scale-invariant (#1243),
    // and for a matrix at a unit-or-larger scale it is exactly mathjs's
    // tolerance, so the rotations — and therefore the values — match the
    // mathjs 15.3.0 oracle.
    const off = Vab[1];
    const tiny = 4 * N * Number.MIN_VALUE;
    const e0 = Math.max(Math.abs(precision / N) * Math.min(scale, 1), Number.EPSILON * off, tiny);
    let psi: number;
    let Sij: number[][] | undefined;
    if (computeVectors) {
      Sij = new Array(N);
      // Sij is Identity Matrix
      for (let i = 0; i < N; i++) {
        Sij[i] = Array(N).fill(0);
        Sij[i][i] = 1.0;
      }
    }
    while (Math.abs(Vab[1]) > e0) {
      const i = Vab[0][0];
      const j = Vab[0][1];
      psi = getTheta(x[i][i], x[j][j], x[i][j]);
      x = x1(x, psi, i, j);
      if (computeVectors) Sij = Sij1(Sij!, psi, i, j);
      Vab = getAij(x);
    }
    // a small diagonal block beside large entries passes the test above with
    // its own off-diagonals still at its own scale: rotate each pair until
    // |a_ij| <= prec * sqrt|a_ii| * sqrt|a_jj|, floored at rounding noise (#1243)
    const noise = Math.max(4 * N * Number.EPSILON * off, tiny);
    for (
      let p = getGradedPair(x, Math.abs(precision), noise);
      p;
      p = getGradedPair(x, Math.abs(precision), noise)
    ) {
      const [i, j] = p;
      psi = getTheta(x[i][i], x[j][j], x[i][j]);
      x = x1(x, psi, i, j);
      if (computeVectors) Sij = Sij1(Sij!, psi, i, j);
    }
    const Ei = Array(N).fill(0); // eigenvalues
    for (let i = 0; i < N; i++) {
      Ei[i] = x[i][i];
    }
    return sorting(clone(Ei), Sij, computeVectors);
  }

  // diagonalization implementation for bigNumber
  function diagBig(x: BigNumber[][], precision: BigNumber, computeVectors: boolean): EigenResult {
    const N = x.length;
    // both tolerances are relative to the matrix scale (largest entry) (#1243)
    let scale: BigNumber = bignumber(0);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = abs(x[i][j]) as BigNumber;
        if (bigLt(scale, a)) scale = a;
      }
    }
    // initial error
    let Vab = getAijBig(x);
    // no tolerance is below one unit of the working precision, relative to
    // the largest off-diagonal entry (see diag); the tolerance is the smaller
    // of mathjs's absolute |precision / N| and the scale-relative form (#1561,
    // see diag)
    const Big = scale.constructor as unknown as { precision: number };
    const unit = multiplyScalar(bignumber(`1e-${Big.precision}`), Vab[1]) as BigNumber;
    const absPrecOverN = abs(multiplyScalar(precision, bignumber(1 / N))) as BigNumber;
    const e0scaled = multiplyScalar(absPrecOverN, scale) as BigNumber;
    const e0tol = bigLt(absPrecOverN, e0scaled) ? absPrecOverN : e0scaled;
    const e0 = bigLt(e0tol, unit) ? unit : e0tol;
    let psi: BigNumber;
    let Sij: BigNumber[][] | undefined;
    if (computeVectors) {
      Sij = new Array(N);
      // Sij is Identity Matrix
      for (let i = 0; i < N; i++) {
        Sij[i] = Array(N).fill(bignumber(0));
        Sij[i][i] = bignumber(1);
      }
    }
    while (bigLt(e0, abs(Vab[1]))) {
      const i = Vab[0][0];
      const j = Vab[0][1];
      psi = getThetaBig(x[i][i], x[j][j], x[i][j]);
      x = x1Big(x, psi, i, j);
      if (computeVectors) Sij = Sij1Big(Sij!, psi, i, j);
      Vab = getAijBig(x);
    }
    // per-pair test as in diag; the noise floor uses the working precision
    const noiseBig = multiplyScalar(bignumber(4 * N), unit) as BigNumber;
    const precAbs = abs(precision) as BigNumber;
    for (
      let p = getGradedPairBig(x, precAbs, noiseBig);
      p;
      p = getGradedPairBig(x, precAbs, noiseBig)
    ) {
      const [i, j] = p;
      psi = getThetaBig(x[i][i], x[j][j], x[i][j]);
      x = x1Big(x, psi, i, j);
      if (computeVectors) Sij = Sij1Big(Sij!, psi, i, j);
    }
    const Ei: BigNumber[] = Array(N).fill(bignumber(0)); // eigenvalues
    for (let i = 0; i < N; i++) {
      Ei[i] = x[i][i];
    }
    return sorting(clone(Ei) as Scalar[], Sij as Scalar[][] | undefined, computeVectors);
  }

  // get angle
  function getTheta(aii: number, ajj: number, aij: number): number {
    const denom = ajj - aii;
    if (Math.abs(denom) <= (config.relTol as number) * Math.abs(aij)) {
      return Math.PI / 4.0;
    } else {
      return 0.5 * Math.atan((2.0 * aij) / (ajj - aii));
    }
  }

  // get angle for BigNumber
  function getThetaBig(aii: BigNumber, ajj: BigNumber, aij: BigNumber): BigNumber {
    const denom = subtract(ajj, aii) as BigNumber;
    if (bigLte(abs(denom), multiplyScalar(bignumber(config.relTol as number), abs(aij)))) {
      return (bignumber(-1) as BigNumber & { acos(): BigNumber })
        .acos()
        .div(4) as unknown as BigNumber;
    } else {
      return multiplyScalar(
        bignumber(0.5),
        atan(multiply(bignumber(2), aij, inv(denom)))
      ) as BigNumber;
    }
  }

  // update eigenvectors
  function Sij1(Sij: number[][], theta: number, i: number, j: number): number[][] {
    const N = Sij.length;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const Ski: number[] = Array(N).fill(0);
    const Skj: number[] = Array(N).fill(0);
    for (let k = 0; k < N; k++) {
      Ski[k] = c * Sij[k][i] - s * Sij[k][j];
      Skj[k] = s * Sij[k][i] + c * Sij[k][j];
    }
    for (let k = 0; k < N; k++) {
      Sij[k][i] = Ski[k];
      Sij[k][j] = Skj[k];
    }
    return Sij;
  }

  // update eigenvectors for BigNumber
  function Sij1Big(Sij: BigNumber[][], theta: BigNumber, i: number, j: number): BigNumber[][] {
    const N = Sij.length;
    const c = cos(theta) as BigNumber;
    const s = sin(theta) as BigNumber;
    const Ski: BigNumber[] = Array(N).fill(bignumber(0));
    const Skj: BigNumber[] = Array(N).fill(bignumber(0));
    for (let k = 0; k < N; k++) {
      Ski[k] = subtract(multiplyScalar(c, Sij[k][i]), multiplyScalar(s, Sij[k][j])) as BigNumber;
      Skj[k] = addScalar(multiplyScalar(s, Sij[k][i]), multiplyScalar(c, Sij[k][j])) as BigNumber;
    }
    for (let k = 0; k < N; k++) {
      Sij[k][i] = Ski[k];
      Sij[k][j] = Skj[k];
    }
    return Sij;
  }

  // update matrix for BigNumber
  function x1Big(Hij: BigNumber[][], theta: BigNumber, i: number, j: number): BigNumber[][] {
    const N = Hij.length;
    const c = bignumber((cos(theta) as BigNumber).toString());
    const s = bignumber((sin(theta) as BigNumber).toString());
    const c2 = multiplyScalar(c, c) as BigNumber;
    const s2 = multiplyScalar(s, s) as BigNumber;
    const Aki: BigNumber[] = Array(N).fill(bignumber(0));
    const Akj: BigNumber[] = Array(N).fill(bignumber(0));
    // 2cs Hij
    const csHij = multiply(bignumber(2), c, s, Hij[i][j]) as BigNumber;
    //  Aii
    const Aii = addScalar(
      subtract(multiplyScalar(c2, Hij[i][i]), csHij),
      multiplyScalar(s2, Hij[j][j])
    ) as BigNumber;
    const Ajj = add(
      multiplyScalar(s2, Hij[i][i]),
      csHij,
      multiplyScalar(c2, Hij[j][j])
    ) as BigNumber;
    // 0  to i
    for (let k = 0; k < N; k++) {
      Aki[k] = subtract(multiplyScalar(c, Hij[i][k]), multiplyScalar(s, Hij[j][k])) as BigNumber;
      Akj[k] = addScalar(multiplyScalar(s, Hij[i][k]), multiplyScalar(c, Hij[j][k])) as BigNumber;
    }
    // Modify Hij
    Hij[i][i] = Aii;
    Hij[j][j] = Ajj;
    Hij[i][j] = bignumber(0);
    Hij[j][i] = bignumber(0);
    // 0  to i
    for (let k = 0; k < N; k++) {
      if (k !== i && k !== j) {
        Hij[i][k] = Aki[k];
        Hij[k][i] = Aki[k];
        Hij[j][k] = Akj[k];
        Hij[k][j] = Akj[k];
      }
    }
    return Hij;
  }

  // update matrix
  function x1(Hij: number[][], theta: number, i: number, j: number): number[][] {
    const N = Hij.length;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const c2 = c * c;
    const s2 = s * s;
    const Aki = Array(N).fill(0);
    const Akj = Array(N).fill(0);
    //  Aii
    const Aii = c2 * Hij[i][i] - 2 * c * s * Hij[i][j] + s2 * Hij[j][j];
    const Ajj = s2 * Hij[i][i] + 2 * c * s * Hij[i][j] + c2 * Hij[j][j];
    // 0  to i
    for (let k = 0; k < N; k++) {
      Aki[k] = c * Hij[i][k] - s * Hij[j][k];
      Akj[k] = s * Hij[i][k] + c * Hij[j][k];
    }
    // Modify Hij
    Hij[i][i] = Aii;
    Hij[j][j] = Ajj;
    Hij[i][j] = 0;
    Hij[j][i] = 0;
    // 0  to i
    for (let k = 0; k < N; k++) {
      if (k !== i && k !== j) {
        Hij[i][k] = Aki[k];
        Hij[k][i] = Aki[k];
        Hij[j][k] = Akj[k];
        Hij[k][j] = Akj[k];
      }
    }
    return Hij;
  }

  // get max off-diagonal value from Upper Diagonal
  function getAij(Mij: number[][]): [[number, number], number] {
    const N = Mij.length;
    let maxMij = 0;
    let maxIJ: [number, number] = [0, 1];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (Math.abs(maxMij) < Math.abs(Mij[i][j])) {
          maxMij = Math.abs(Mij[i][j]);
          maxIJ = [i, j];
        }
      }
    }
    return [maxIJ, maxMij];
  }

  // get max off-diagonal value from Upper Diagonal (BigNumber version)
  function getAijBig(Mij: BigNumber[][]): [[number, number], BigNumber] {
    const N = Mij.length;
    let maxMij: BigNumber = bignumber(0);
    let maxIJ: [number, number] = [0, 1];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (bigLt(abs(maxMij), abs(Mij[i][j]))) {
          maxMij = abs(Mij[i][j]) as BigNumber;
          maxIJ = [i, j];
        }
      }
    }
    return [maxIJ, maxMij];
  }

  // largest off-diagonal pair with |a_ij| > max(tol * sqrt|a_ii| * sqrt|a_jj|, floor),
  // or null when every pair passes (#1243)
  function getGradedPair(M: number[][], tol: number, floor: number): [number, number] | null {
    const N = M.length;
    const root = M.map((row, i) => Math.sqrt(Math.abs(row[i])));
    let best = 0;
    let pair: [number, number] | null = null;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = Math.abs(M[i][j]);
        if (a > best && a > Math.max(tol * root[i] * root[j], floor)) {
          best = a;
          pair = [i, j];
        }
      }
    }
    return pair;
  }

  // BigNumber version of getGradedPair
  function getGradedPairBig(
    M: BigNumber[][],
    tol: BigNumber,
    floor: BigNumber
  ): [number, number] | null {
    const N = M.length;
    const root = M.map((row, i) => (abs(row[i]) as BigNumber & { sqrt(): BigNumber }).sqrt());
    let best: BigNumber = bignumber(0);
    let pair: [number, number] | null = null;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = abs(M[i][j]) as BigNumber;
        const t = multiplyScalar(multiplyScalar(tol, root[i]), root[j]) as BigNumber;
        if (bigLt(best, a) && bigLt(t, a) && bigLt(floor, a)) {
          best = a;
          pair = [i, j];
        }
      }
    }
    return pair;
  }

  // sort results by absolute value
  function sorting(E: Scalar[], S: Scalar[][] | undefined, computeVectors: boolean): EigenResult {
    const N = E.length;
    const values: Scalar[] = Array(N);
    let vecs: Scalar[][] | undefined;
    if (computeVectors) {
      vecs = Array(N);
      for (let k = 0; k < N; k++) {
        vecs[k] = Array(N);
      }
    }
    for (let i = 0; i < N; i++) {
      let minID = 0;
      let minE = E[0];
      for (let j = 0; j < E.length; j++) {
        if (bigLt(abs(E[j]), abs(minE))) {
          minID = j;
          minE = E[minID];
        }
      }
      values[i] = E.splice(minID, 1)[0];
      if (computeVectors) {
        for (let k = 0; k < N; k++) {
          vecs![i][k] = S![k][minID];
          S![k].splice(minID, 1);
        }
      }
    }
    if (!computeVectors) return { values };
    const eigenvectors = vecs!.map((vector, i) => ({
      value: values[i],
      vector,
    }));
    return { values, eigenvectors };
  }

  return main;
}
