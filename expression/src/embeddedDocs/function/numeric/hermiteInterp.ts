export const hermiteInterpDocs = {
  name: 'hermiteInterp',
  category: 'Numeric',
  syntax: ['hermiteInterp(xs, ys, dys, x)'],
  description:
    'Hermite interpolation using function values and derivatives at data points. Constructs the unique polynomial matching both values and first derivatives.',
  examples: ['hermiteInterp([0, 1], [0, 1], [1, 1], 0.5)'],
  seealso: ['lagrangeInterp', 'cubicSpline', 'pchipInterp'],
};
