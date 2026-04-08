export const gammaincDocs = {
  name: 'gammainc',
  category: 'Special',
  syntax: ['gammainc(a, x)'],
  description: 'Compute the regularized lower incomplete gamma function P(a, x) = gamma(a, x) / Gamma(a). Uses series expansion for small x and continued fraction for large x.',
  examples: ['gammainc(1, 1)', 'gammainc(0.5, 1)', 'gammainc(3, 2)'],
  seealso: ['gamma', 'lgamma'],
};
