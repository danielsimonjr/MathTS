export const binomialPMFDocs = {
  name: 'binomialPMF',
  category: 'Probability',
  syntax: ['binomialPMF(k, n, p)'],
  description:
    'Compute the binomial probability mass function: C(n, k) * p^k * (1-p)^(n-k). Computed in log-space to avoid overflow.',
  examples: ['binomialPMF(3, 10, 0.5)', 'binomialPMF(0, 5, 0.3)', 'binomialPMF(5, 5, 0.3)'],
  seealso: ['poissonPMF', 'bernoulliPMF', 'combinations'],
};
