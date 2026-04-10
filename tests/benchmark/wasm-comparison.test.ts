import { describe, it, expect } from 'vitest';

describe('WASM Backend Comparison', () => {
  // Helper
  function bench(name: string, fn: () => void, iterations = 10000): number {
    for (let i = 0; i < 100; i++) fn(); // warmup
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    return performance.now() - start;
  }

  describe('Scalar Operations', () => {
    it('sin: JS baseline', () => {
      const t = bench('sin', () => Math.sin(1.5));
      console.log(`  JS sin: ${t.toFixed(2)}ms / 10K ops`);
      expect(t).toBeLessThan(50);
    });
  });

  describe('Array Operations', () => {
    const n = 10000;
    const a = new Float64Array(n).fill(1);
    const b = new Float64Array(n).fill(2);

    it('array add: JS baseline', () => {
      const t = bench('array_add', () => {
        const c = new Float64Array(n);
        for (let i = 0; i < n; i++) c[i] = a[i] + b[i];
      }, 1000);
      console.log(`  JS array add (${n}): ${t.toFixed(2)}ms / 1K ops`);
      expect(t).toBeLessThan(500);
    });
  });

  describe('Matrix Operations', () => {
    it('100x100 multiply: JS baseline', () => {
      const n = 100;
      const a = new Float64Array(n * n);
      const b = new Float64Array(n * n);
      for (let i = 0; i < n * n; i++) { a[i] = Math.random(); b[i] = Math.random(); }

      const t = bench('matmul', () => {
        const c = new Float64Array(n * n);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) sum += a[i*n+k] * b[k*n+j];
            c[i*n+j] = sum;
          }
      }, 10);
      console.log(`  JS matmul 100x100: ${t.toFixed(2)}ms / 10 ops`);
      expect(t).toBeLessThan(2000);
    });
  });
});
