import { describe, it, expect } from 'vitest';
import * as E from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

describe('expression public API smoke', () => {
  const entries = Object.entries(E).filter(([, v]) => isFn(v));
  it('exports parser / node factories', () => {
    expect(entries.length).toBeGreaterThan(5);
    const names = new Set(entries.map(([n]) => n));
    expect(names.has('createParser') || names.has('createNode')).toBe(true);
    for (const name of ['createConstantNode', 'createSymbolNode', 'createOperatorNode']) {
      const fn = (E as Record<string, unknown>)[name];
      if (!isFn(fn)) continue;
      try {
        fn();
      } catch {
        /* factory may need a math instance */
      }
    }
  });
});
