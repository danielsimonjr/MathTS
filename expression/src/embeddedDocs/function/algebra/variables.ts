export const variablesDocs = {
  name: 'variables',
  category: 'Algebra',
  syntax: ['variables(expr)'],
  description: 'Extract free variable names from an expression string, excluding math keywords.',
  examples: ['variables(\'x^2 + 2*y + sin(z)\')', 'variables(\'pi * r^2\')'],
  seealso: ['substitute'],
};
