export const eliminateDocs = {
  name: 'eliminate',
  category: 'Algebra',
  syntax: ['eliminate(system, var)'],
  description: 'Eliminate a variable from a system of equations using Gaussian elimination.',
  examples: ['eliminate([\'2*x + 3*y = 5\', \'x + y = 2\'], \'x\')'],
  seealso: ['variables', 'substitute'],
};
