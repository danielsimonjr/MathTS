/**
 * Transpose a 2D array (private helper). Consolidated onto the canonical
 * `_switch` in `@danielsimonjr/mathts-core` (core/src/switch.ts) as part of the
 * 2026-07 dedup campaign — this file is now a thin re-export so there is a
 * single body (functions depends on core, so no cycle). The former local copy
 * was byte-equivalent 2D-transpose logic.
 * @private
 */
export { _switch } from '@danielsimonjr/mathts-core/internal';
