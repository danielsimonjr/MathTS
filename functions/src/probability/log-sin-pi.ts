/**
 * Logarithm of sin(πz) continued from the positive real interval (0, 1)
 * along the upper or lower half-plane, for log-gamma reflection.
 *
 * @param re - Real part of z.
 * @param im - Imaginary part of z. Signed zero selects the side of the cut.
 * @returns Log modulus and unwrapped phase.
 */
export function logSinPiForReflection(re: number, im: number): { re: number; im: number } {
  const height = Math.PI * Math.abs(im);
  const decay = Math.exp(-2 * height);
  const angle = Math.PI * (re - Math.round(re));
  const sin = Math.sin(angle);
  // sin(πz) = (i/2) exp(-iπz) (1 - exp(2iπz)) in the upper half-plane.
  // Evaluate the final factor without subtracting nearly equal numbers at a pole.
  const real = -Math.expm1(-2 * height) + 2 * decay * sin * sin;
  const imaginary = -2 * decay * sin * Math.cos(angle);
  const phase = Math.PI * (0.5 - re) + Math.atan2(imaginary, real);
  return {
    re: height - Math.LN2 + Math.log(Math.hypot(real, imaginary)),
    im: im < 0 || Object.is(im, -0) ? -phase : phase,
  };
}
