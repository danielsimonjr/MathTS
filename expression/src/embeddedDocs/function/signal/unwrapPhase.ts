export const unwrapPhaseDocs = {
  name: 'unwrapPhase',
  category: 'Signal',
  syntax: ['unwrapPhase(phase)'],
  description: 'Unwrap phase angles by adding multiples of 2*pi to remove discontinuities.',
  examples: ['unwrapPhase([0, 1, 2, 3, -2.28])'],
  seealso: ['groupDelay', 'fft'],
};
