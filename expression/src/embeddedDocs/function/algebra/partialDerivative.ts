export const partialDerivativeDocs = {
  name: 'partialDerivative',
  category: 'Algebra',
  syntax: ['partialDerivative(expr, var)'],
  description: 'Compute a partial derivative of an expression string using basic symbolic rules.',
  examples: ["partialDerivative('x^2', 'x')"],
  seealso: ['polyder', 'tangentLine', 'derivative'],
};
