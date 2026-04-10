export const discriminantDocs = {
  name: 'discriminant',
  category: 'Algebra',
  syntax: ['discriminant(coeffs)'],
  description: 'Compute the discriminant of a polynomial. For quadratic ax^2+bx+c: b^2-4ac.',
  examples: ['discriminant([-1, 0, 1])', 'discriminant([1, 1, 1])'],
  seealso: ['degree', 'polynomialRoot'],
};
