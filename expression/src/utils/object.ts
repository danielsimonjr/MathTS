/**
 * Object cloning, extension, deep-equality, and traversal helpers.
 *
 * Consolidated onto core: the implementations live once in
 * `@danielsimonjr/mathts-core/internal` (see `number.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../utils/object.js` imports keep working while the single source lives in core.
 */
export {
  canDefineProperty,
  clone,
  deepExtend,
  deepFlatten,
  deepStrictEqual,
  extend,
  get,
  hasOwnProperty,
  isLegacyFactory,
  lazy,
  mapObject,
  pick,
  pickShallow,
  set,
  traverse,
} from '@danielsimonjr/mathts-core/internal';
