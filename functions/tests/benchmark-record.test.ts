import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { wasmDispatchPolicy, wasmPolicyAllows } from '../src/wasm/policy.js';

/**
 * `docs/BENCHMARK_RESULTS.md` is written from `docs/benchmarks/wasm-public-call.json` by
 * `tools/benchmark/wasm/gen-benchmark-results.mjs`. These tests tie that record to the code
 * it describes, so the document cannot state a dispatch band or a WASM call that the shipped
 * policy does not have.
 */

interface RecordedRow {
  name: string;
  n: number;
  kernels: string[];
}
interface BenchRecord {
  policy: Record<string, { min: number; max?: number }>;
  runs: { kernel: RecordedRow[]; public: RecordedRow[] };
}

const record = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../docs/benchmarks/wasm-public-call.json', import.meta.url)),
    'utf8'
  )
) as BenchRecord;

describe('wasm-public-call.json against functions/src/wasm/policy.ts', () => {
  it('records the dispatch policy that the package ships', () => {
    expect(record.policy).toEqual(wasmDispatchPolicy());
  });

  it('a public call ran its AS kernel exactly where the shipped policy allows it', () => {
    expect(record.runs.public.length).toBeGreaterThan(0);
    for (const row of record.runs.public) {
      const kernel = `array_${row.name}_ptr`;
      const allowed = wasmPolicyAllows(kernel, row.n);
      expect(row.kernels.includes(kernel), `${row.name} at n=${row.n}`).toBe(allowed);
    }
  });

  it('the kernel pass, with the policy overridden, ran the kernel in every row', () => {
    expect(record.runs.kernel.length).toBeGreaterThan(0);
    for (const row of record.runs.kernel) {
      expect(row.kernels, `${row.name} at n=${row.n}`).toContain(`array_${row.name}_ptr`);
    }
  });
});
