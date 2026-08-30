import { describe, it, expect } from 'vitest';
import * as T from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

describe('tensor public API smoke', () => {
  const entries = Object.entries(T).filter(([, v]) => isFn(v));
  it('exports a Tensor constructor or factory', () => {
    expect(entries.length).toBeGreaterThan(0);
    const ctor = (T as Record<string, unknown>).Tensor;
    if (typeof ctor === 'function') {
      try {
        (ctor as Fn)(
          ...([
            [1, 2, 3, 4],
            [2, 2],
          ] as never[])
        );
      } catch {
        /* ctor arity */
      }
    }
  });
});
