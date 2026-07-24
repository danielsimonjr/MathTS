/**
 * Configuration interface for math.js
 *
 * Consolidated onto core: this file used to duplicate
 * `core/src/config.ts`'s `ConfigOptions`/`MathJsConfig`/`DEFAULT_CONFIG`
 * byte-for-byte. The implementation now lives once in
 * `@danielsimonjr/mathts-core/internal` (see the `project-all-libraries-build-on-core`
 * principle and the cross-package dedup pass, docs/Architecture/duplicate-symbols.json).
 * Thin re-export so existing `../core/config.js` / `./config.js` imports across
 * `functions/src/` keep working unchanged.
 */
export type { ConfigOptions, MathJsConfig } from '@danielsimonjr/mathts-core/internal';
export { DEFAULT_CONFIG } from '@danielsimonjr/mathts-core/internal';
