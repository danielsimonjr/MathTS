export const jsDivergenceDocs = {
  name: 'jsDivergence',
  category: 'Probability',
  syntax: ['jsDivergence(p, q)'],
  description:
    'Compute the Jensen-Shannon divergence between two probability distributions in bits. Always non-negative and symmetric: JSD(P||Q) = JSD(Q||P).',
  examples: ['jsDivergence([0.5, 0.5], [0.5, 0.5])', 'jsDivergence([1, 0], [0, 1])'],
  seealso: ['entropy', 'kldivergence'],
};
