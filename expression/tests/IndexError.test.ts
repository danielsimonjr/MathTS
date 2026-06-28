import { describe, it, expect } from 'vitest';
import { IndexError, createIndexError } from '../src/error/IndexError.js';

describe('IndexError - construction: two-arg form (index, max)', () => {
  it('creates an IndexError with 2 args', () => {
    const err = new IndexError(5, 3);
    expect(err).toBeInstanceOf(IndexError);
    expect(err).toBeInstanceOf(RangeError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets name to "IndexError"', () => {
    const err = new IndexError(5, 3);
    expect(err.name).toBe('IndexError');
  });

  it('sets isIndexError to true', () => {
    const err = new IndexError(5, 3);
    expect(err.isIndexError).toBe(true);
  });

  it('stores the index', () => {
    const err = new IndexError(5, 3);
    expect(err.index).toBe(5);
  });

  it('defaults min to 0 in two-arg form', () => {
    const err = new IndexError(5, 3);
    expect(err.min).toBe(0);
  });

  it('stores max as provided in two-arg form', () => {
    const err = new IndexError(5, 3);
    expect(err.max).toBe(3);
  });

  it('produces "index >= max" message when index is out of range high', () => {
    const err = new IndexError(5, 3);
    // index (5) >= max (3), so message uses max-1 = 2
    expect(err.message).toBe('Index out of range (5 > 2)');
  });

  it('produces "index < min" message when index is negative (below min 0)', () => {
    const err = new IndexError(-1, 5);
    // index (-1) < min (0)
    expect(err.message).toBe('Index out of range (-1 < 0)');
  });
});

describe('IndexError - construction: three-arg form (index, min, max)', () => {
  it('creates an IndexError with 3 args', () => {
    const err = new IndexError(10, 1, 5);
    expect(err).toBeInstanceOf(IndexError);
  });

  it('stores index, min, and max', () => {
    const err = new IndexError(10, 1, 5);
    expect(err.index).toBe(10);
    expect(err.min).toBe(1);
    expect(err.max).toBe(5);
  });

  it('produces "index >= max" message (high side) in three-arg form', () => {
    const err = new IndexError(10, 1, 5);
    // 10 >= 5, message uses max-1 = 4
    expect(err.message).toBe('Index out of range (10 > 4)');
  });

  it('produces "index < min" message (low side) in three-arg form', () => {
    const err = new IndexError(0, 1, 5);
    // 0 < 1
    expect(err.message).toBe('Index out of range (0 < 1)');
  });

  it('produces generic message when within range', () => {
    // index=3, min=1, max=5: 3 >= 1 and 3 < 5, so within range
    const err = new IndexError(3, 1, 5);
    expect(err.message).toBe('Index out of range (3)');
  });
});

describe('IndexError - construction: one-arg form (just index)', () => {
  // With one arg, the constructor uses the two-arg branch (max === undefined),
  // setting actualMin = 0 and actualMax = min (which is undefined).
  // Since 7 < 0 is false, and actualMax is undefined, the message is generic.
  it('creates generic out-of-range message', () => {
    const err = new IndexError(7);
    expect(err.message).toBe('Index out of range (7)');
  });

  it('min defaults to 0, max is undefined', () => {
    const err = new IndexError(7);
    // With 1 arg: max===undefined => actualMin=0, actualMax=min=undefined
    expect(err.min).toBe(0);
    expect(err.max).toBeUndefined();
  });

  it('stores index', () => {
    const err = new IndexError(7);
    expect(err.index).toBe(7);
  });
});

describe('IndexError - prototype chain', () => {
  it('instanceof RangeError', () => {
    expect(new IndexError(1, 5)).toBeInstanceOf(RangeError);
  });

  it('instanceof Error', () => {
    expect(new IndexError(1, 5)).toBeInstanceOf(Error);
  });

  it('has a stack trace', () => {
    const err = new IndexError(1, 5);
    expect(typeof err.stack).toBe('string');
  });
});

describe('IndexError - throw and catch', () => {
  it('can be thrown and caught', () => {
    expect(() => {
      throw new IndexError(5, 3);
    }).toThrow(IndexError);
  });

  it('message is preserved in catch', () => {
    try {
      throw new IndexError(5, 0, 3);
    } catch (e) {
      const err = e as IndexError;
      expect(err.message).toBe('Index out of range (5 > 2)');
      expect(err.isIndexError).toBe(true);
    }
  });

  it('can be caught as RangeError', () => {
    expect(() => {
      throw new IndexError(5, 3);
    }).toThrow(RangeError);
  });
});

describe('createIndexError - factory function', () => {
  it('creates an IndexError with 2 args', () => {
    const err = createIndexError(5, 3);
    expect(err).toBeInstanceOf(IndexError);
    expect(err.index).toBe(5);
    expect(err.max).toBe(3);
  });

  it('creates an IndexError with 3 args', () => {
    const err = createIndexError(10, 1, 5);
    expect(err).toBeInstanceOf(IndexError);
    expect(err.index).toBe(10);
    expect(err.min).toBe(1);
    expect(err.max).toBe(5);
  });

  it('creates an IndexError with 1 arg', () => {
    const err = createIndexError(7);
    expect(err).toBeInstanceOf(IndexError);
    expect(err.message).toBe('Index out of range (7)');
  });
});
