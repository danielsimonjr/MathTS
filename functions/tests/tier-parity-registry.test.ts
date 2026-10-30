/**
 * PR 7 — every accelerated tier id must name the test file that checks numeric agreement.
 * Does not duplicate the parity suites; only locks the registry to live policy/op lists.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wasmDispatchPolicy, type WasmBand } from '../src/wasm/policy.js';
import { GPU_ELEMENTWISE_OPS } from '../src/gpu/elementwise-gpu.js';
import registry from './tier-parity-registry.json' with { type: 'json' };

export interface TierParityRow {
  id: string;
  tier: string;
  test: string;
  symbol: string;
}

/** ComputePool methods exercised in `parallel/tests/ComputePool.coverage.test.ts`. */
export const COMPUTE_POOL_COVERAGE_OPS = [
  'exec',
  'prod',
  'pow',
  'sign',
  'applyKernel',
  'applyKernel2',
  'tensordot',
  'integrateFanOut',
  'distributionSampleFanOut',
  'fftBatch',
  'distanceMatrix',
  'bitOr',
  'bitXor',
  'rightArithShift',
  'rightLogShift',
] as const;

const MATRIX_WASM_OPS = ['multiply'] as const;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

function requiredTierIds(
  wasmPolicy: Readonly<Record<string, WasmBand>>,
  gpuOps: readonly string[]
): string[] {
  return [...Object.keys(wasmPolicy), ...gpuOps, ...MATRIX_WASM_OPS, ...COMPUTE_POOL_COVERAGE_OPS];
}

/**
 * Returns human-readable errors; empty means the registry matches `requiredIds` and every
 * row's test file exists and contains its symbol.
 */
export function checkTierParityRegistry(
  rows: readonly TierParityRow[],
  requiredIds: readonly string[],
  root: string
): string[] {
  const errors: string[] = [];
  const byId = new Map<string, TierParityRow>();
  for (const row of rows) {
    if (byId.has(row.id)) {
      errors.push(`duplicate registry id: ${row.id}`);
      continue;
    }
    byId.set(row.id, row);
  }

  for (const id of requiredIds) {
    if (!byId.has(id)) {
      errors.push(`missing registry row for id: ${id}`);
    }
  }

  for (const row of rows) {
    if (!requiredIds.includes(row.id)) {
      errors.push(`unexpected registry row (no live id): ${row.id}`);
    }
    const testPath = join(root, row.test);
    if (!existsSync(testPath)) {
      errors.push(`test file missing for ${row.id}: ${row.test}`);
      continue;
    }
    const source = readFileSync(testPath, 'utf8');
    if (!source.includes(row.symbol)) {
      errors.push(`${row.test} does not contain symbol "${row.symbol}" (id ${row.id})`);
    }
  }

  return errors;
}

describe('tier-parity registry', () => {
  const wasmPolicy = wasmDispatchPolicy();
  const requiredIds = requiredTierIds(wasmPolicy, GPU_ELEMENTWISE_OPS);

  it('lists every WASM policy key, GPU op, matrix multiply, and ComputePool coverage op', () => {
    const errors = checkTierParityRegistry(registry as TierParityRow[], requiredIds, repoRoot);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  it('fails when a WASM policy key has no registry row', () => {
    const fakePolicy = { ...wasmPolicy, fake_kernel_ptr: { min: 1 } };
    const errors = checkTierParityRegistry(
      registry as TierParityRow[],
      requiredTierIds(fakePolicy, GPU_ELEMENTWISE_OPS),
      repoRoot
    );
    expect(errors.some((e) => e.includes('fake_kernel_ptr'))).toBe(true);
  });
});
