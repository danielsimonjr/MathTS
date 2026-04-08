export const normalCDFDocs = {
  name: 'normalCDF',
  category: 'Probability',
  syntax: ['normalCDF(x)', 'normalCDF(x, mu, sigma)'],
  description: 'Compute the normal (Gaussian) cumulative distribution function P(X <= x). With one argument, uses the standard normal (mu=0, sigma=1).',
  examples: ['normalCDF(0)', 'normalCDF(1.96)', 'normalCDF(0, 5, 2)'],
  seealso: ['normalPDF', 'erf', 'erfc'],
};
