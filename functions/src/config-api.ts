/**
 * Runtime configuration accessor (GC12) — standalone module.
 *
 * `factoryScope.config` is the SAME object every activated factory captured as
 * its `config` dependency (see factories/scope.ts). Functions read it live at
 * call time — e.g. `identity`/`range`'s `config.matrix === 'Array'` return-type
 * switch and `zeta`'s `config.relTol` digit count. Mutating this object's
 * properties therefore drives real behavior; reassigning it would NOT (the
 * captured reference would go stale), so we Object.assign in place.
 *
 * Kept in its own file (not factories/index.ts) so the export resolves cleanly
 * across the package boundary rather than being lost in that module's very large
 * generated declaration file.
 */
import { factoryScope } from './factories/scope.js';
import type { ConfigOptions } from './core/config.js';

/**
 * Read or update the global MathTS runtime config. Call with no argument to
 * read the current config; pass a partial to merge it (in place) and get the
 * updated copy back. mathjs-compatible `math.config(...)`.
 *
 * Note: the MathTS functions surface is a singleton, so config is process-global
 * (not per-instance like mathjs `create()`).
 */
export function config(options?: Partial<ConfigOptions>): ConfigOptions {
  const shared = factoryScope.config as ConfigOptions;
  if (options) Object.assign(shared, options);
  return { ...shared };
}
