import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';

/** Scalar types supported by the 2x2 eigenvalue solve */
type Scalar = number | BigNumber | Complex;

interface Dependencies {
  addScalar: (a: Scalar, b: Scalar) => Scalar;
  subtract: (a: Scalar, b: Scalar) => Scalar;
  multiplyScalar: (a: Scalar, b: Scalar) => Scalar;
  sqrt: (x: Scalar) => Scalar;
}

const EPS = Number.EPSILON;

/** The exact integer mantissa and binary exponent of a finite double. */
function bitsOf(x: number): { m: bigint; e: number } {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  const hi = dv.getUint32(0);
  const lo = dv.getUint32(4);
  const sign = (hi >>> 31) & 1;
  const expField = (hi >>> 20) & 0x7ff;
  const frac = (hi & 0xfffff) * 2 ** 32 + lo;
  let m = BigInt(frac);
  let e: number;
  if (expField === 0) {
    e = -1074;
  } else {
    m |= 1n << 52n;
    e = expField - 1075;
  }
  if (sign) m = -m;
  return { m, e };
}

/**
 * λ± of the 2x2 block [[a, b], [c, d]], shared by both general `eigs` solvers.
 *
 * λ± = tr/2 ± sqrt(tr² − 4·det)/2 with det = ad − bc, the mathjs formula. Its
 * subtraction cancels when the pair is split by little more than the rounding
 * of the products: the discriminant of a genuine complex pair can come out as
 * zero or with the wrong sign, and the pair is lost (#1186). When the float
 * discriminant is within its own rounding error, the sign is therefore decided
 * by an exact integer evaluation of the same discriminant, (a−d)² + 4bc, whose
 * terms never cancel. A complex pair whose imaginary part is rounding noise of
 * the block still rounds to a repeated real eigenvalue, as #1186 requires.
 */
export function createEigenvalues2x2({ addScalar, subtract, multiplyScalar, sqrt }: Dependencies) {
  return (a: Scalar, b: Scalar, c: Scalar, d: Scalar): [Scalar, Scalar] => {
    const trA = addScalar(a, d) as Scalar;
    const x = multiplyScalar(trA, 0.5) as Scalar;
    const bc = multiplyScalar(b, c) as Scalar;
    const det = subtract(multiplyScalar(a, d) as Scalar, bc) as Scalar;
    let disc = subtract(multiplyScalar(trA, trA) as Scalar, multiplyScalar(4, det) as Scalar) as
      number | BigNumber;

    if (
      typeof a === 'number' &&
      typeof b === 'number' &&
      typeof c === 'number' &&
      typeof d === 'number'
    ) {
      const discNum = typeof disc === 'number' ? disc : Number(disc);
      const trNum = typeof trA === 'number' ? Math.abs(trA) : Math.abs(Number(trA));
      const adMag = Math.abs(a) * Math.abs(d);
      const bcMag = Math.abs(b) * Math.abs(c);
      const relError = 32 * EPS * (trNum * trNum + 4 * (adMag + bcMag));
      if (Number.isFinite(relError) && Math.abs(discNum) <= relError) {
        const exact = exactDiscriminant(a, b, c, d);
        if (exact !== null) disc = exact;
      }
    }

    const y = multiplyScalar(sqrt(disc as Scalar) as Scalar, 0.5) as Scalar;
    // A complex pair whose imaginary part is the rounding noise of the block is
    // a repeated real eigenvalue (#1186): round only the noise. A complex-typed
    // block carries every scalar as a Complex object, including the real y of a
    // real pair, so only a nonzero imaginary part rounds.
    if (typeof y !== 'number' && y !== null && typeof y === 'object' && 'im' in y) {
      const imAbs = Math.abs((y as Complex).im);
      const blockScale = Math.max(
        Math.abs(Number(a)),
        Math.abs(Number(b)),
        Math.abs(Number(c)),
        Math.abs(Number(d))
      );
      if (imAbs > 0 && Number.isFinite(blockScale) && imAbs <= 8 * EPS * blockScale) {
        return [x, x];
      }
    }
    return [addScalar(x, y) as Scalar, subtract(x, y) as Scalar];
  };

  /** (a−d)² + 4bc of four finite doubles, exactly, as a double (null outside the double range). */
  function exactDiscriminant(a: number, b: number, c: number, d: number): number | null {
    const A = bitsOf(a);
    const B = bitsOf(b);
    const C = bitsOf(c);
    const D = bitsOf(d);
    const e0 = Math.min(A.e, D.e);
    let ad: bigint;
    try {
      ad = (A.m << BigInt(A.e - e0)) - (D.m << BigInt(D.e - e0));
    } catch {
      return null;
    }
    const bcE = B.e + C.e;
    const sqE = 2 * e0;
    const e1 = Math.min(sqE, bcE);
    let sum: bigint;
    try {
      sum = ad * ad * (1n << BigInt(sqE - e1)) + 4n * B.m * C.m * (1n << BigInt(bcE - e1));
    } catch {
      return null;
    }
    if (e1 < -1074 || e1 > 1024) return null;
    return Number(sum) * 2 ** e1;
  }
}
