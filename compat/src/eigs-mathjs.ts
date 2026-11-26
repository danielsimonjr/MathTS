/**
 * Compat-only mathjs 15.3.0 `eigs` (#1561).
 *
 * Native `@danielsimonjr/mathts-functions` `eigs` stays `correctEigs`. This
 * module instantiates the mathjs factory port that lives under
 * `compat/src/mathjs-eigs/` so the critical functions library is not the
 * home of mathjs quirks (precision collapse, non-unit vectors, value order).
 */
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { createEigs } from './mathjs-eigs/eigs.js';

const config = mathFunctions.config();
const scope: Record<string, unknown> = {
  ...(mathFunctions as unknown as Record<string, unknown>),
  config,
  typed: mathFunctions.factory_mathjsCompat.createCompatTyped(),
};

export const compatMathjsEigs = createEigs(scope) as (...args: unknown[]) => unknown;
