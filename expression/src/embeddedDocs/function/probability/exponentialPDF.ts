export const exponentialPDFDocs = {
  name: 'exponentialPDF',
  category: 'Probability',
  syntax: ['exponentialPDF(x, lambda)'],
  description: 'Compute the exponential probability density function: lambda * exp(-lambda * x) for x >= 0.',
  examples: ['exponentialPDF(0, 1)', 'exponentialPDF(1, 1)', 'exponentialPDF(0, 2)'],
  seealso: ['exponentialCDF'],
};
