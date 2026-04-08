export const pchipInterpDocs = {
  name: 'pchipInterp',
  category: 'Numeric',
  syntax: ['pchipInterp(xs, ys, x)'],
  description: 'Shape-preserving Piecewise Cubic Hermite Interpolating Polynomial (PCHIP). Unlike cubic splines, PCHIP preserves monotonicity and avoids overshoot.',
  examples: ['pchipInterp([0, 1, 2, 3], [0, 1, 4, 9], 1.5)'],
  seealso: ['linearInterp', 'cubicSpline', 'hermiteInterp'],
};
