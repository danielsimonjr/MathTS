/**
 * Runtime configuration accessor (GC12) — standalone module.
 *
 * `factoryScope.config` is a proxy over the same logical config every activated
 * factory captured as its `config` dependency (see factories/scope.ts). Functions
 * read it live at call time — e.g. `identity`/`range`'s `config.matrix === 'Array'`
 * return-type switch and `parseNumber`'s `config.number`. Process-wide updates go
 * through `config()` and mutate `DEFAULT_CONFIG` in place; synchronous per-call
 * overlays use {@link runWithConfig}.
 *
 * Kept in its own file (not factories/index.ts) so the export resolves cleanly
 * across the package boundary rather than being lost in that module's very large
 * generated declaration file.
 */
import { DEFAULT_CONFIG, type ConfigOptions } from './core/config.js';
import { pushConfigOverlay, popConfigOverlay } from './factories/scope.js';

/**
 * Run `fn` while factories see `overlay` merged on the config proxy stack.
 *
 * Nested calls push additional overlays; the stack is restored in `finally`, including
 * when `fn` throws. Overlays are **synchronous only**: if `fn` returns a Promise and
 * config is read after an `await`, the overlay is already popped and reads fall back
 * to `DEFAULT_CONFIG`.
 *
 * A barrel-level `evaluate` invoked from inside an overlay still sees that overlay
 * until the outer `runWithConfig` returns (same-turn re-entry).
 *
 * @example
 * ```ts
 * import { config, runWithConfig, evaluate } from '@danielsimonjr/mathts-functions';
 *
 * runWithConfig({ number: 'Fraction' }, () => {
 *   expect(evaluate('1/2').s).toBe(1);
 * });
 * expect(config().number).toBe('number');
 * ```
 */
export function runWithConfig<T>(overlay: Partial<ConfigOptions>, fn: () => T): T {
  pushConfigOverlay(overlay as ConfigOptions);
  try {
    return fn();
  } finally {
    popConfigOverlay();
  }
}

/**
 * Read or update the global MathTS runtime config. Call with no argument to
 * read the current config; pass a partial to merge it (in place on
 * `DEFAULT_CONFIG`) and get the updated copy back. mathjs-compatible
 * `math.config(...)`.
 *
 * Does not read or write active {@link runWithConfig} overlays; compat
 * `create(all, config)` uses overlays instead of mutating this singleton.
 */
export function config(options?: Partial<ConfigOptions>): ConfigOptions {
  if (options) Object.assign(DEFAULT_CONFIG, options);
  return { ...DEFAULT_CONFIG };
}
