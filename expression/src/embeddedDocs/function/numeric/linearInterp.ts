export const linearInterpDocs = {
  name: 'linearInterp',
  category: 'Numeric',
  syntax: ['linearInterp(xs, ys, x)'],
  description: 'Linear interpolation between data points. Finds the interval containing x and linearly interpolates. Extrapolates outside the data range.',
  examples: ['linearInterp([0, 1], [0, 1], 0.5)', 'linearInterp([0, 1, 2], [0, 1, 4], 1.5)'],
  seealso: ['lagrangeInterp', 'cubicSpline', 'pchipInterp'],
};
