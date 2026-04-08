export const betaDocs = {
  name: 'beta',
  category: 'Special',
  syntax: ['beta(a, b)'],
  description: 'Compute the beta function B(a, b) = Gamma(a) * Gamma(b) / Gamma(a+b). Computed via the log-gamma function to avoid overflow.',
  examples: ['beta(2, 3)', 'beta(0.5, 0.5)', 'beta(1, 5)'],
  seealso: ['gamma', 'lgamma'],
};
