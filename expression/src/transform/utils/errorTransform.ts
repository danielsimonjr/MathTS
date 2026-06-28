import { IndexError } from '../../error/IndexError.js';

interface IndexErrorLike {
  isIndexError?: boolean;
  index: number;
  min: number;
  max?: number;
}

/**
 * Transform zero-based indices to one-based indices in errors
 * @param {Error} err
 * @returns {Error | IndexError} Returns the transformed error
 */
export function errorTransform(err: unknown): unknown {
  const e = err as IndexErrorLike;
  if (e && e.isIndexError) {
    return new IndexError(e.index + 1, e.min + 1, e.max !== undefined ? e.max + 1 : undefined);
  }

  return err;
}
