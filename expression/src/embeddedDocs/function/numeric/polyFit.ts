export const polyFitDocs = {
  name: 'polyFit',
  category: 'Numeric',
  syntax: ['polyFit(xs, ys, degree)'],
  description:
    'Least-squares polynomial fit. Returns coefficients [a0, a1, ..., ad] for p(x) = a0 + a1*x + ... + ad*x^d.',
  examples: ['polyFit([0,1,2,3], [0,1,4,9], 2)'],
  seealso: ['linearInterp', 'lagrangeInterp'],
};
