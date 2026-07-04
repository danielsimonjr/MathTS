/**
 * The relocated, feature-complete `Unit` — the mathjs-derived unit system now
 * living in core and wired to core's own primitives (Unit-merge Phase 1.2).
 *
 * `createUnitClass` is the raw factory (exported for callers that want to build a
 * Unit against a custom dependency set); `Unit` is that factory already
 * instantiated with core's `unitDependencies`, ready to use.
 */
import { createUnitClass } from './Unit.js';
import { unitDependencies } from './dependencies.js';
import type { UnitConstructor } from './unit-types.js';

export { createUnitClass } from './Unit.js';
export { unitDependencies } from './dependencies.js';
export type * from './unit-types.js';

/** The core `Unit` class, pre-wired to core's numeric primitives. */
export const Unit: UnitConstructor = createUnitClass(
  unitDependencies as unknown as Parameters<typeof createUnitClass>[0]
) as UnitConstructor;
