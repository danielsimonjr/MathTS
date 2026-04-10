export const powerExpandDocs = {
  name: 'powerExpand',
  category: 'Algebra',
  syntax: ['powerExpand(expr)'],
  description: 'Expand powers: (a*b)^n => a^n * b^n and (a^m)^n => a^(m*n).',
  examples: ['powerExpand(\'(a*b)^3\')', 'powerExpand(\'(a^2)^3\')'],
  seealso: ['expand', 'fullSimplify'],
};
