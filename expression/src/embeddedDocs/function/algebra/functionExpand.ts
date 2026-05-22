export const functionExpandDocs = {
  name: 'functionExpand',
  category: 'Algebra',
  syntax: ['functionExpand(expr)'],
  description:
    'Expand special function expressions: exp(a+b) => exp(a)*exp(b), ln(a*b) => ln(a)+ln(b).',
  examples: ["functionExpand('exp(a+b)')", "functionExpand('ln(a*b)')"],
  seealso: ['expand', 'trigExpand'],
};
