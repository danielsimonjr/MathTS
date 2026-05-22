export const exponentialCDFDocs = {
  name: 'exponentialCDF',
  category: 'Probability',
  syntax: ['exponentialCDF(x, lambda)'],
  description:
    'Compute the exponential cumulative distribution function: 1 - exp(-lambda * x) for x >= 0.',
  examples: ['exponentialCDF(1, 1)', 'exponentialCDF(0, 1)', 'exponentialCDF(2, 0.5)'],
  seealso: ['exponentialPDF'],
};
