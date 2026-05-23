export const tangentLineDocs = {
  name: 'tangentLine',
  category: 'Algebra',
  syntax: ['tangentLine(f, x0)'],
  description:
    'Compute the tangent line to a function at a given point. Returns [slope, intercept].',
  examples: ['tangentLine(x => x**2, 3)'],
  seealso: ['partialDerivative', 'polyder'],
};
