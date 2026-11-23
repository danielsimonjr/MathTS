import { besselJ0, bitAnd, gammaPDF, csc, parallelIFFT } from '@danielsimonjr/mathts-functions';

const special: number = besselJ0(1);
const bitwise: number = bitAnd(1, 2);
const distribution: number = gammaPDF(2, 3, 1);
const inverse: Promise<{ real: Float64Array; imag: Float64Array }> = parallelIFFT(
  new Float64Array(0),
  new Float64Array(0)
);
const cosecant: number = csc(2);
void [special, bitwise, distribution, inverse, cosecant];
