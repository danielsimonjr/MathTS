export const gaussQuadDocs = {
  name: 'gaussQuad',
  category: 'Numeric',
  syntax: ['gaussQuad(f, a, b)', 'gaussQuad(f, a, b, n)'],
  description: 'Numerical integration using Gauss-Legendre quadrature with n points (2-5, default 5). Exact for polynomials up to degree 2n-1.',
  examples: ['gaussQuad(x => x**2, 0, 1, 3)', 'gaussQuad(Math.exp, 0, 1)'],
  seealso: ['trapz', 'simpson', 'romberg'],
};
