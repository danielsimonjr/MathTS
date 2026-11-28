/**
 * std / variance expression transforms with mathjs 15.3.0 dim conversion (#1786).
 */
import { IndexError } from '@danielsimonjr/mathts-core/internal';
import { mathjsLastDimToZeroBase } from './mathjs-last-dim-to-zero-base.js';

type TypedAnySig = (args: unknown[]) => unknown;
type TypedFn = {
  (name: string, signatures: Record<string, TypedAnySig>): unknown;
};

type IndexErrorLike = { isIndexError?: boolean; index: number; min: number; max?: number };

function mapTransformStatisticsError(err: unknown): unknown {
  const e = err as IndexErrorLike;
  if (e?.isIndexError === true) {
    return new IndexError(e.index + 1, e.min + 1, e.max !== undefined ? e.max + 1 : undefined);
  }
  if (err instanceof Error && /dim must be a non-negative integer \(got -1\)/.test(err.message)) {
    return new IndexError(0, 1);
  }
  if (err instanceof Error && err.message.includes('String "biased" is not a valid number')) {
    return new Error('Cannot convert "biased" to a number');
  }
  return err;
}

function callWithMathjsDim(fn: (...args: unknown[]) => unknown, args: unknown[]): unknown {
  try {
    return fn(...mathjsLastDimToZeroBase(args));
  } catch (err) {
    throw mapTransformStatisticsError(err);
  }
}

/** Build `std` transform with mathjs one-based `dim` handling. */
export function buildMathjsStdTransform(instance: Record<string, unknown>): unknown {
  const typed = instance.typed as TypedFn | undefined;
  const std = instance.std as ((...args: unknown[]) => unknown) | undefined;
  if (typeof typed !== 'function' || typeof std !== 'function') return undefined;
  return typed('std', {
    '...any': function mathjsStdTransform(args: unknown[]): unknown {
      return callWithMathjsDim(std, args);
    },
  });
}

/** Build `variance` transform with mathjs one-based `dim` handling. */
export function buildMathjsVarianceTransform(instance: Record<string, unknown>): unknown {
  const typed = instance.typed as TypedFn | undefined;
  const variance = instance.variance as ((...args: unknown[]) => unknown) | undefined;
  if (typeof typed !== 'function' || typeof variance !== 'function') return undefined;
  return typed('variance', {
    '...any': function mathjsVarianceTransform(args: unknown[]): unknown {
      return callWithMathjsDim(variance, args);
    },
  });
}
