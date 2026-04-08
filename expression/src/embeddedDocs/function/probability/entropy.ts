export const entropyDocs = {
  name: 'entropy',
  category: 'Probability',
  syntax: ['entropy(probs)'],
  description: 'Compute the Shannon entropy of a discrete probability distribution in bits: H(P) = -sum(p_i * log2(p_i)).',
  examples: ['entropy([0.5, 0.5])', 'entropy([0.25, 0.25, 0.25, 0.25])', 'entropy([1, 0])'],
  seealso: ['jsDivergence', 'kldivergence'],
};
