/**
 * Drop-in re-export of `@danielsimonjr/mathts-functions`.
 *
 * Universal-Physics-Tensor loads this module dynamically and calls `parse`
 * and `simplify`. The rest of the surface is the same module so a specifier
 * change does not drop an export.
 *
 * @packageDocumentation
 */

export * from '@danielsimonjr/mathts-functions';
