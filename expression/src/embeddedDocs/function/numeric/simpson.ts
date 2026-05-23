export const simpsonDocs = {
  name: 'simpson',
  category: 'Numeric',
  syntax: ['simpson(f, a, b)', 'simpson(f, a, b, n)'],
  description:
    "Numerical integration using Simpson's 1/3 rule. Divides [a,b] into n subintervals (default 100, must be even).",
  examples: ['simpson(x => x**2, 0, 1)', 'simpson(Math.sin, 0, Math.PI)'],
  seealso: ['trapz', 'romberg', 'gaussQuad'],
};
