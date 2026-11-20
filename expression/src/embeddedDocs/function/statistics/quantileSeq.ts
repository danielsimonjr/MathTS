export const quantileSeqDocs = {
  name: 'quantileSeq',
  category: 'Statistics',
  syntax: [
    'quantileSeq(A, prob[, sorted])',
    'quantileSeq(A, [prob1, prob2, ...][, sorted])',
    'quantileSeq(A, N[, sorted])',
    'quantileSeq(A, prob, method)',
    'quantileSeq(A, prob, dim)',
    'quantileSeq(A, prob, method, dim)',
  ],
  description:
    'Compute the prob order quantile of a matrix or a list with values. The sequence is sorted and the middle value is returned. Supported types of sequence values are: Number, BigNumber, Unit Supported types of probability are: Number, BigNumber. \n\nThe optional method is a NumPy method name, and the default is linear. It applies to every type of value and of probability.\n\nIn case of a (multi dimensional) array or matrix, the prob order quantile of all elements will be calculated.',
  examples: [
    'quantileSeq([3, -1, 5, 7], 0.5)',
    'quantileSeq([3, -1, 5, 7], [1/3, 2/3])',
    'quantileSeq([3, -1, 5, 7], 2)',
    'quantileSeq([-1, 3, 5, 7], 0.5, true)',
    "quantileSeq([1, 2, 3, 4], 0.1, 'inverted_cdf')",
  ],
  seealso: ['mean', 'median', 'min', 'max', 'prod', 'std', 'sum', 'variance'],
};
