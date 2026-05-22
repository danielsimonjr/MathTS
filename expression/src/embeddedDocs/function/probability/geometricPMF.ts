export const geometricPMFDocs = {
  name: 'geometricPMF',
  category: 'Probability',
  syntax: ['geometricPMF(k, p)'],
  description:
    'Compute the geometric probability mass function: (1-p)^(k-1) * p for k = 1, 2, 3, ... Models the number of trials until the first success.',
  examples: ['geometricPMF(1, 0.5)', 'geometricPMF(3, 0.5)', 'geometricPMF(1, 1)'],
  seealso: ['bernoulliPMF', 'binomialPMF'],
};
