/**
 * Compat-only mathjs 15.3.0 `eigs` (#1561).
 *
 * The native `eigs` in `@danielsimonjr/mathts-functions` keeps the correct
 * MathTS solver; compat binds the mathjs factory from a separate functions
 * subpath so the main functions entry stays off the heavy mathjs port.
 */
import { eigsMathjsFactory } from '@danielsimonjr/mathts-functions/eigs-mathjs';

export const compatMathjsEigs = eigsMathjsFactory;
