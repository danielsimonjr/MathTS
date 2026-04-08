export const normalPDFDocs = {
  name: 'normalPDF',
  category: 'Probability',
  syntax: ['normalPDF(x)', 'normalPDF(x, mu, sigma)'],
  description: 'Compute the normal (Gaussian) probability density function. With one argument, uses the standard normal (mu=0, sigma=1).',
  examples: ['normalPDF(0)', 'normalPDF(0, 0, 1)', 'normalPDF(1, 0, 2)'],
  seealso: ['normalCDF', 'erf'],
};
