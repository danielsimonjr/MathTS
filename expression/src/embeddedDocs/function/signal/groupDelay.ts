export const groupDelayDocs = {
  name: 'groupDelay',
  category: 'Signal',
  syntax: ['groupDelay(b, a)', 'groupDelay(b, a, w)'],
  description: 'Compute the group delay of a digital filter defined by numerator (b) and denominator (a) polynomial coefficients.',
  examples: ['groupDelay([1, 2, 1], [1])'],
  seealso: ['unwrapPhase', 'fft'],
};
