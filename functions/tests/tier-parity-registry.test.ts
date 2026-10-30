/**
 * PR 7 — every accelerated tier id must name the test file that checks numeric agreement.
 * Does not duplicate the parity suites; only locks the registry to live policy/op lists.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wasmDispatchPolicy, type WasmBand } from '../src/wasm/policy.js';
import { GPU_ELEMENTWISE_OPS } from '../src/gpu/elementwise-gpu.js';
import { WASM_ELEMENTWISE_OPS } from '../src/wasm/elementwise/wasm-bridge.js';
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
 * Some parity tests loop over a whole op list instead of naming each op. A row that cites such a
 * list by name is only valid for ids that are members of it, so the symbol cannot vouch for an op
 * the loop never visits.
 */
type Families = Readonly<Record<string, ReadonlySet<string>>>;

const LOOPED_FAMILIES: Families = {
  WASM_ELEMENTWISE_OPS: new Set(WASM_ELEMENTWISE_OPS.map((op) => `array_${op}_ptr`)),
  GPU_ELEMENTWISE_OPS: new Set(GPU_ELEMENTWISE_OPS),
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-identifier match. A bare substring test lets `sin` be satisfied by `asin`, `log` by
 * `log2`, and `abs` by `Math.abs`, so a row would pass for a test that never mentions the op.
 */
export function mentionsSymbol(source: string, symbol: string): boolean {
  return new RegExp(`(?<![\\w$.])${escapeRegExp(symbol)}(?![\\w$])`).test(source);
}

/**
 * Returns human-readable errors; empty means the registry matches `requiredIds` and every
 * row's test file exists and cites its symbol as a whole identifier.
 */
export function checkTierParityRegistry(
  rows: readonly TierParityRow[],
  requiredIds: readonly string[],
  root: string,
  families: Families = LOOPED_FAMILIES
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
    const family = families[row.symbol];
    if (family && !family.has(row.id)) {
      errors.push(`${row.id} is not in ${row.symbol}, so the loop over it never checks that id`);
    }
    const testPath = join(root, row.test);
    if (!existsSync(testPath)) {
      errors.push(`test file missing for ${row.id}: ${row.test}`);
      continue;
    }
    const source = readFileSync(testPath, 'utf8');
    if (!mentionsSymbol(source, row.symbol)) {
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

  it('fails when a registry row has no live id', () => {
    const rows = [
      ...(registry as TierParityRow[]),
      { id: 'gone', tier: 'wasm', test: 'x', symbol: 'x' },
    ];
    const errors = checkTierParityRegistry(rows, requiredIds, repoRoot);
    expect(errors.some((e) => e.includes('unexpected registry row') && e.includes('gone'))).toBe(
      true
    );
  });

  it('every elementwise WASM policy key is visited by the looped parity test', () => {
    for (const id of Object.keys(wasmPolicy).filter((k) => /^array_.+_ptr$/.test(k))) {
      expect(LOOPED_FAMILIES.WASM_ELEMENTWISE_OPS.has(id), id).toBe(true);
    }
  });
});

describe('checkTierParityRegistry on a fixture workspace', () => {
  function withFixture(files: Record<string, string>, run: (root: string) => void): void {
    const root = mkdtempSync(join(tmpdir(), 'tier-parity-'));
    try {
      for (const [rel, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, rel)), { recursive: true });
        writeFileSync(join(root, rel), text);
      }
      run(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const row = (symbol: string, id = 'sin'): TierParityRow => ({
    id,
    tier: 'gpu',
    test: 't.test.ts',
    symbol,
  });

  it('accepts an identifier that is present', () => {
    withFixture({ 't.test.ts': 'const ORACLE = { sin: Math.sin };' }, (root) => {
      expect(checkTierParityRegistry([row('sin')], ['sin'], root, {})).toEqual([]);
    });
  });

  it('does not let a longer identifier or a member access satisfy the symbol', () => {
    withFixture({ 't.test.ts': 'Math.asin(x); Math.sin(x); log2(x); sinh(x);' }, (root) => {
      expect(checkTierParityRegistry([row('sin')], ['sin'], root, {})).toHaveLength(1);
      expect(checkTierParityRegistry([row('log', 'log')], ['log'], root, {})).toHaveLength(1);
    });
  });

  it('reports a missing test file and a symbol that is absent', () => {
    withFixture({ 't.test.ts': 'nothing here' }, (root) => {
      expect(checkTierParityRegistry([row('sin')], ['sin'], root, {})[0]).toMatch(
        /does not contain/
      );
      const missing = { ...row('sin'), test: 'nope.test.ts' };
      expect(checkTierParityRegistry([missing], ['sin'], root, {})[0]).toMatch(/test file missing/);
    });
  });

  it('rejects a row that cites a looped list the id is not a member of', () => {
    withFixture({ 't.test.ts': 'for (const op of LOOP) {}' }, (root) => {
      const families = { LOOP: new Set(['a']) };
      expect(checkTierParityRegistry([row('LOOP', 'a')], ['a'], root, families)).toEqual([]);
      const errors = checkTierParityRegistry([row('LOOP', 'b')], ['b'], root, families);
      expect(errors[0]).toMatch(/never checks that id/);
    });
  });
});
