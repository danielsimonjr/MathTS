import { describe, it, expect } from 'vitest';
import { MathWorkerPool } from '../src/index.js';
import { UNARY_KERNELS, applyUnary, type UnaryFn } from '../src/unary-kernels.js';

const FNS: UnaryFn[] = ['abs', 'sqrt', 'exp', 'log', 'sin', 'cos', 'tan', 'negate', 'square'];

const reference: Record<UnaryFn, (x: number) => number> = {
  abs: Math.abs,
  sqrt: Math.sqrt,
  exp: Math.exp,
  log: Math.log,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  negate: (x) => -x,
  square: (x) => x * x,
};

/** Count `new Float64Array(length >= minLength)` while `run` executes. */
function countLargeF64(minLength: number, run: () => void): number {
  const Original = globalThis.Float64Array;
  let count = 0;
  const Counting: typeof Float64Array = new Proxy(Original, {
    construct(target, args, newTarget): object {
      const first = args[0];
      if (typeof first === 'number' && first >= minLength) count++;
      else if (
        first !== null &&
        typeof first === 'object' &&
        (first as ArrayLike<number>).length >= minLength
      )
        count++;
      return Reflect.construct(target, args, newTarget === Counting ? target : newTarget);
    },
  });
  (globalThis as { Float64Array: unknown }).Float64Array = Counting;
  try {
    run();
  } finally {
    (globalThis as { Float64Array: unknown }).Float64Array = Original;
  }
  return count;
}

describe('UNARY_KERNELS', () => {
  const input = Float64Array.of(0.5, -0, 0, 1, -1, 2.5, -3.25, Infinity, -Infinity, NaN);

  it.each(FNS)('%s equals the Math function bit for bit', (fn) => {
    const got = applyUnary(fn, input);
    expect(got.length).toBe(input.length);
    for (let i = 0; i < input.length; i++) {
      expect(Object.is(got[i], reference[fn](input[i]))).toBe(true);
    }
  });

  it('reads `length` elements from `start` and returns a new array', () => {
    const got = UNARY_KERNELS.square(Float64Array.of(9, 9, 2, 3, 4, 9), 2, 3);
    expect(Array.from(got)).toEqual([4, 9, 16]);
  });

  it('does not change the input', () => {
    const x = Float64Array.of(1, 2, 3);
    applyUnary('negate', x);
    expect(Array.from(x)).toEqual([1, 2, 3]);
  });
});

describe('MathWorkerPool.unary in-process path', () => {
  it('calls the shared kernel once, with the caller array and no input copy', async () => {
    const n = 4096;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = i * 1e-3;

    const original = UNARY_KERNELS.sin;
    const calls: Array<{ data: Float64Array; start: number; length: number }> = [];
    UNARY_KERNELS.sin = (data, start, length) => {
      calls.push({ data, start, length });
      return original(data, start, length);
    };
    const pool = new MathWorkerPool({ maxWorkers: 2 });
    let out: Awaited<ReturnType<typeof pool.unary>> | undefined;
    let large = 0;
    try {
      // The pool is not initialized: the call cannot reach a worker.
      let pending: Promise<Awaited<ReturnType<typeof pool.unary>>> | undefined;
      large = countLargeF64(n, () => {
        pending = pool.unary(x, 'sin');
      });
      out = await pending;
    } finally {
      UNARY_KERNELS.sin = original;
    }

    expect(calls).toHaveLength(1);
    expect(calls[0].data).toBe(x);
    expect(calls[0].start).toBe(0);
    expect(calls[0].length).toBe(n);
    // One array of length n is built: the result. Copying the input would make it two.
    expect(large).toBe(1);
    expect(out?.parallelized).toBe(false);
    expect(out?.chunks).toBe(1);
    for (let i = 0; i < n; i++) expect(out!.result[i]).toBe(Math.sin(x[i]));
  });
});
