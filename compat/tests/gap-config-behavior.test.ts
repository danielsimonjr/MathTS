import { describe, it, expect, afterEach } from 'vitest';
import { create, all } from '../src/index.js';

/**
 * GC12 — `math.config(...)` must actually DRIVE behavior, not just store a
 * copy. Before this, `config()` mutated a private `currentConfig` that nothing
 * read, so `config({ matrix: 'Array' })` was a silent no-op. It now forwards to
 * the shared functions config that the computation layer reads at call time
 * (e.g. `cbrt`'s all-roots return type, `config.matrix === 'Array' ? array :
 * matrix`). Config in the MathTS singleton is process-global, so each test
 * restores the default.
 */
const math = create(all);

afterEach(() => {
  math.config({ matrix: 'Matrix' });
});

const isPlainArray = (x: unknown): boolean => Array.isArray(x);
const isMatrixLike = (x: unknown): boolean =>
  !Array.isArray(x) && typeof (x as { toArray?: unknown })?.toArray === 'function';

describe('GC12: math.config() drives behavior', () => {
  it('config() with no argument returns the current config', () => {
    const cfg = math.config();
    expect(cfg).toBeTypeOf('object');
    expect(cfg.matrix).toBe('Matrix');
  });

  it("config({ matrix: 'Array' }) makes matrix-returning ops return arrays", () => {
    // default: identity() returns a Matrix
    expect(isMatrixLike(math.range(1, 4))).toBe(true);

    math.config({ matrix: 'Array' });
    expect(math.config().matrix).toBe('Array');
    // now the same call returns a plain Array
    const id = math.range(1, 4);
    expect(isPlainArray(id)).toBe(true);
    expect((id as unknown[]).length).toBe(3);
  });

  it("config({ matrix: 'Matrix' }) restores matrix output", () => {
    math.config({ matrix: 'Array' });
    expect(isPlainArray(math.range(1, 4))).toBe(true);
    math.config({ matrix: 'Matrix' });
    expect(isMatrixLike(math.range(1, 4))).toBe(true);
  });

  it('config() merges partial updates without dropping other keys', () => {
    const before = math.config();
    math.config({ matrix: 'Array' });
    const after = math.config();
    // matrix changed, but the numeric-tolerance keys are preserved
    expect(after.matrix).toBe('Array');
    expect(after.relTol).toBe(before.relTol);
    expect(after.absTol).toBe(before.absTol);
  });
});
