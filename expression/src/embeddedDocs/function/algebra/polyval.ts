export const polyvalDocs = {
  name: 'polyval',
  category: 'Algebra',
  syntax: ['polyval(coeffs, x)'],
  description:
    'Evaluate a polynomial at a given point using Horner method. Coefficients ordered by ascending power.',
  examples: ['polyval([1, 2, 3], 2)', 'polyval([1, 0, -1], 3)'],
  seealso: ['polyder', 'polyadd', 'polymul'],
};
