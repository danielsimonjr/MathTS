export const bernoulliPMFDocs = {
  name: 'bernoulliPMF',
  category: 'Probability',
  syntax: ['bernoulliPMF(k, p)'],
  description: 'Compute the Bernoulli probability mass function: p if k=1, (1-p) if k=0. The simplest discrete distribution.',
  examples: ['bernoulliPMF(1, 0.7)', 'bernoulliPMF(0, 0.7)', 'bernoulliPMF(1, 0.5)'],
  seealso: ['binomialPMF', 'geometricPMF'],
};
