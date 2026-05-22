export const cubicSplineDocs = {
  name: 'cubicSpline',
  category: 'Numeric',
  syntax: ['cubicSpline(xs, ys)'],
  description:
    'Natural cubic spline interpolation. Returns a function that evaluates the spline at any point. Uses natural boundary conditions (second derivative = 0 at endpoints).',
  examples: ['const s = cubicSpline([0,1,2,3], [0,1,4,9]); s(1.5)'],
  seealso: ['linearInterp', 'pchipInterp', 'hermiteInterp'],
};
