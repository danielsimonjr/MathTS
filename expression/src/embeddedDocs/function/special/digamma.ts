export const digammaDocs = {
  name: 'digamma',
  category: 'Special',
  syntax: ['digamma(x)'],
  description:
    'Compute the digamma (psi) function, the logarithmic derivative of the gamma function: psi(x) = d/dx ln(Gamma(x)). Uses asymptotic expansion with recurrence relation.',
  examples: ['digamma(1)', 'digamma(2)', 'digamma(0.5)'],
  seealso: ['gamma', 'lgamma'],
};
