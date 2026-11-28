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

/**
 * λ± of the 2x2 block [[a, b], [c, d]] — the mathjs 15.3.0 formula (#1791).
 *
 * λ± = tr/2 ± sqrt(tr² − 4·det)/2 with det = ad − bc.
 */
export function createEigenvalues2x2({ addScalar, subtract, multiplyScalar, sqrt }: Dependencies) {
  return (a: Scalar, b: Scalar, c: Scalar, d: Scalar): [Scalar, Scalar] => {
    const trA = addScalar(a, d) as Scalar;
    const detA = subtract(multiplyScalar(a, d) as Scalar, multiplyScalar(b, c) as Scalar) as Scalar;
    const x = multiplyScalar(trA, 0.5) as Scalar;
    const y = multiplyScalar(
      sqrt(
        subtract(multiplyScalar(trA, trA) as Scalar, multiplyScalar(4, detA) as Scalar) as Scalar
      ) as Scalar,
      0.5
    ) as Scalar;
    return [addScalar(x, y) as Scalar, subtract(x, y) as Scalar];
  };
}