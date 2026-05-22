export const erfcDocs = {
  name: 'erfc',
  category: 'Special',
  syntax: ['erfc(x)'],
  description:
    'Compute the complementary error function erfc(x) = 1 - erf(x). Uses the Abramowitz & Stegun rational approximation.',
  examples: ['erfc(0)', 'erfc(1)', 'erfc(0.5)', 'erfc(-1)'],
  seealso: ['erf'],
};
