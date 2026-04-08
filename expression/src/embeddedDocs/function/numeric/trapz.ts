export const trapzDocs = {
  name: 'trapz',
  category: 'Numeric',
  syntax: ['trapz(y)', 'trapz(y, x)'],
  description: 'Numerical integration using the trapezoidal rule. If x is omitted, uniform spacing (h=1) is assumed.',
  examples: ['trapz([1, 2, 3], [0, 1, 2])', 'trapz([0, 1, 0])'],
  seealso: ['simpson', 'romberg', 'gaussQuad'],
};
