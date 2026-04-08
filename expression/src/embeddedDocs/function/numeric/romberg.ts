export const rombergDocs = {
  name: 'romberg',
  category: 'Numeric',
  syntax: ['romberg(f, a, b)', 'romberg(f, a, b, tol)'],
  description: 'Adaptive numerical integration using Romberg method (Richardson extrapolation on the trapezoidal rule). Converges to the specified tolerance (default 1e-12).',
  examples: ['romberg(Math.sin, 0, Math.PI)', 'romberg(x => 1/x, 1, 2)'],
  seealso: ['trapz', 'simpson', 'gaussQuad'],
};
