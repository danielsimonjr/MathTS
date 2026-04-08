export const poissonPMFDocs = {
  name: 'poissonPMF',
  category: 'Probability',
  syntax: ['poissonPMF(k, lambda)'],
  description: 'Compute the Poisson probability mass function: e^(-lambda) * lambda^k / k!. Computed in log-space to avoid overflow.',
  examples: ['poissonPMF(0, 1)', 'poissonPMF(3, 2.5)', 'poissonPMF(5, 5)'],
  seealso: ['binomialPMF', 'exponentialPDF'],
};
