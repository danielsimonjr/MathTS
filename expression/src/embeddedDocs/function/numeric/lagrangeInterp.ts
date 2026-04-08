export const lagrangeInterpDocs = {
  name: 'lagrangeInterp',
  category: 'Numeric',
  syntax: ['lagrangeInterp(xs, ys, x)'],
  description: 'Lagrange polynomial interpolation. Evaluates the unique polynomial of degree n-1 passing through n data points at the given x.',
  examples: ['lagrangeInterp([0, 1, 2], [0, 1, 4], 1.5)'],
  seealso: ['linearInterp', 'hermiteInterp', 'cubicSpline'],
};
