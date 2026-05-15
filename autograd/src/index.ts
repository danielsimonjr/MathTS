/**
 * @danielsimonjr/mathts-autograd — forward + reverse-mode automatic
 * differentiation for the MathTS rank-N Tensor type.
 *
 * v0.1.0 ships:
 *   - forwardGrad(fn, x): dual-number AD; returns { value, jacobian }.
 *   - reverseGrad(fn, x, cotangent?): tape-based reverse-mode AD;
 *     returns { value, gradient }.
 *
 * Tasks 6/7 populate this barrel. Task 5 scaffolds the package.
 *
 * @packageDocumentation
 */
export { DualTensor } from './dual-tensor.js';
export { forwardGrad } from './forward-grad.js';
export { Tape, TapedTensor } from './tape.js';
export { reverseGrad } from './reverse-grad.js';
