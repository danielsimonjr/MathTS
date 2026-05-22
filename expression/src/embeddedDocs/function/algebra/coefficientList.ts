export const coefficientListDocs = {
  name: 'coefficientList',
  category: 'Algebra',
  syntax: ['coefficientList(coeffs)'],
  description:
    'Extract the coefficient list of a polynomial, trimming leading zeros from the high end.',
  examples: ['coefficientList([1, 2, 0, 0])'],
  seealso: ['degree', 'polyval'],
};
