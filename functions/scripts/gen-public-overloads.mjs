#!/usr/bin/env node
/**
 * Generate `functions/types/public-overloads.generated.d.ts` from
 * `public-overloads.manifest.json`, validated against live `mathTyped` signature
 * keys in the referenced source files. Run with `--check` to fail when out of sync.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'types/public-overloads.manifest.json');
const OUT = join(ROOT, 'types/public-overloads.generated.d.ts');

const SIG_TYPE = {
  number: 'number',
  f64: 'number',
  i32: 'number',
  i64: 'bigint',
  bigint: 'bigint',
  boolean: 'boolean',
  string: 'string',
  Complex: 'Complex',
  Fraction: 'Fraction',
  BigNumber: 'BigNumber',
  Unit: 'UnitInstance',
  Dual: 'Dual',
  Float64Array: 'Float64Array',
  Float32Array: 'Float32Array',
  Int32Array: 'Int32Array',
  Array: 'number[]',
  Matrix: 'DenseMatrix',
  SparseMatrix: 'DenseMatrix',
  DenseMatrix: 'DenseMatrix',
  'Array | Matrix': 'number[] | DenseMatrix',
  Object: 'StatReduceOptions',
  'number | BigNumber': 'number | BigNumber',
  any: 'unknown',
};

const RETURN_TYPE = {
  number: 'number',
  f64: 'number',
  i32: 'number',
  i64: 'bigint',
  bigint: 'bigint',
  Complex: 'Complex',
  Fraction: 'Fraction',
  BigNumber: 'BigNumber',
  Unit: 'UnitInstance',
  Dual: 'Dual',
  Float64Array: 'Float64Array',
  Float32Array: 'Float32Array',
  Array: 'number',
  Matrix: 'DenseMatrix',
  SparseMatrix: 'DenseMatrix',
  'Array | Matrix': 'number[] | DenseMatrix',
  unknown: 'unknown',
  Scalar: 'MathNumericType',
};

/** @param {string} source @param {string} exportName @param {string} [pattern] */
function mathTypedBody(source, exportName, pattern) {
  const needle = pattern ?? `mathTyped('${exportName}'`;
  const mathIdx = source.indexOf(needle);
  if (mathIdx < 0) throw new Error(`${exportName}: mathTyped block not found (${needle})`);
  const open = source.indexOf('{', mathIdx);
  if (open < 0) throw new Error(`${exportName}: mathTyped block not found`);
  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) throw new Error(`${exportName}: unclosed mathTyped block`);
  return { body: source.slice(open + 1, close), keys: parseSigKeys(source.slice(open + 1, close)) };
}

const UNQUOTED_SIG_KEYS = new Set([
  'number',
  'bigint',
  'boolean',
  'string',
  'Complex',
  'Fraction',
  'BigNumber',
  'Dual',
  'Unit',
  'Float64Array',
  'Float32Array',
  'Int32Array',
  'Array',
  'Matrix',
  'Object',
  'any',
  'SparseMatrix',
  'DenseMatrix',
]);

function parseSigKeys(body) {
  const keys = [];
  for (const line of body.split('\n')) {
    const q = line.match(/^\s*'([^']+)':/);
    if (q) {
      if (!q[1].includes('...')) keys.push(q[1]);
      continue;
    }
    const u = line.match(/^\s*(\w+):/);
    if (u && UNQUOTED_SIG_KEYS.has(u[1])) keys.push(u[1]);
  }
  return keys;
}

function parseReturnForKey(body, key) {
  const quoted = `'${key}'`;
  const idx = body.indexOf(`${quoted}:`);
  const alt = body.indexOf(`${key}:`);
  const at = idx >= 0 ? idx : alt;
  if (at < 0) return 'unknown';
  const chunk = body.slice(at, at + 500);
  const ret = chunk.match(/\):\s*([\w|]+)\s*=>/) || chunk.match(/\):\s*([\w|]+)\s*\{/);
  if (ret) return RETURN_TYPE[ret[1]] ?? ret[1];
  const ret2 = chunk.match(/:\s*([\w|]+)\s*=>/);
  if (ret2) return RETURN_TYPE[ret2[1]] ?? ret2[1];
  const ret3 = chunk.match(/function\s+\w+\([^)]*\):\s*([\w|]+)/);
  if (ret3) return RETURN_TYPE[ret3[1]] ?? ret3[1];
  return 'unknown';
}

function sigKeyToOverload(key, body, exportName) {
  let ret = parseReturnForKey(body, key);
  if (exportName === 'det' && key === 'Array | Matrix') {
    ret = 'number';
  }
  if (key === 'Array | Matrix' && (exportName === 'sin' || exportName === 'add')) {
    ret = 'number[] | DenseMatrix';
  }
  if (exportName === 'add') {
    if (key === 'Array, Array' || key === 'Array, number' || key === 'number, Array') {
      ret = 'number[]';
    }
    if (
      key === 'DenseMatrix, DenseMatrix' ||
      key === 'SparseMatrix, SparseMatrix' ||
      key === 'DenseMatrix, number' ||
      key === 'number, DenseMatrix' ||
      key === 'SparseMatrix, number' ||
      key === 'number, SparseMatrix'
    ) {
      ret = 'DenseMatrix';
    }
  }
  if (exportName === 'variance' || exportName === 'mean') {
    if (key.includes('DenseMatrix') && key.includes('BigNumber')) {
      ret = 'number';
    }
  }
  const parts = key.split(/,\s*/);
  const params = parts.map((part, i) => {
    const t = SIG_TYPE[part] ?? part;
    const name = i === 0 ? 'a' : i === 1 ? 'b' : `x${i}`;
    return `${name}: ${t}`;
  });
  return `  (${params.join(', ')}): ${ret};`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildFile(manifest) {
  const lines = [
    '// Generated by functions/scripts/gen-public-overloads.mjs — do not edit.',
    "import type { Complex, Fraction, BigNumber, Dual, UnitInstance } from '@danielsimonjr/mathts-core';",
    "import type { DenseMatrix } from '@danielsimonjr/mathts-matrix';",
    "import type { StatReduceOptions } from './stat-reduce-options.js';",
    "import type { PhysicsEvaluateOptions } from './physics-evaluate-options.js';",
    '',
  ];
  for (const entry of manifest.exports) {
    const source = readFileSync(join(ROOT, entry.source), 'utf8');
    const { body, keys } = mathTypedBody(source, entry.name, entry.mathTypedPattern);
    const iface = `${capitalize(entry.name)}Callable`;
    lines.push(`export interface ${iface} {`);
    for (const key of keys) {
      lines.push(sigKeyToOverload(key, body, entry.name));
    }
    if (entry.name === 'det') {
      lines.push('  (A: number[][]): number;');
      lines.push('  (A: readonly number[][]): number;');
    }
    lines.push(`  (...args: unknown[]): unknown;`);
    lines.push('}');
    lines.push(`export type Public${capitalize(entry.name)} = ${iface};`, '');
  }
  lines.push(
    'export interface EvaluateCallable {',
    '  (expr: string, scope?: Record<string, unknown>, options?: PhysicsEvaluateOptions): number;',
    '  (exprs: string[], scope?: Record<string, unknown>, options?: PhysicsEvaluateOptions): number[];',
    '}',
    'export type PublicEvaluate = EvaluateCallable;',
    ''
  );
  return `${lines.join('\n')}\n`;
}

const check = process.argv.includes('--check');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const next = buildFile(manifest);
if (check) {
  if (!existsSync(OUT)) {
    console.error('public-overloads.generated.d.ts missing; run: node functions/scripts/gen-public-overloads.mjs');
    process.exit(1);
  }
  const prev = readFileSync(OUT, 'utf8');
  if (next !== prev) {
    console.error('public-overloads.generated.d.ts is stale; run: node functions/scripts/gen-public-overloads.mjs');
    process.exit(1);
  }
  console.log('public-overloads.generated.d.ts is up to date');
  process.exit(0);
}
writeFileSync(OUT, next);
console.log(`wrote ${OUT}`);
