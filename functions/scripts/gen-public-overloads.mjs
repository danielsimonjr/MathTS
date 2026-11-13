#!/usr/bin/env node
/**
 * Generate `functions/types/public-overloads.generated.d.ts` from
 * `public-overloads.manifest.json`.
 *
 * Each overload is derived from a live `mathTyped` / `typed(name, …)` signature
 * key and the return annotation on that signature. `Array | Matrix` and the
 * element-wise array/matrix keys follow the container rule in
 * `typed/f64-kernels.ts` (number stays number[], a Matrix stays that Matrix,
 * and sqrt/log-style `number | Complex` scalar returns widen the array).
 *
 * Manifest entry keys: `name`, `source`, `mathTypedPattern` (where the signature block starts),
 * `fallback` (overload lines appended last, for the `'...'` rest signature) and `sigTypes`
 * (a typed-function type name to a public type, for this export only). A `sigTypes` name that
 * matches no signature part of the export is an error. It sets parameter types of the keys that
 * the generator reads as written. The element-wise `Array | Matrix` key follows the container
 * rule and ignores it.
 *
 * `--check` fails when the generated file, or the public option aliases, drift.
 * `--root=<dir>` reads the manifest and the sources from another package folder.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `--root=<dir>` reads the manifest and the sources from another package folder (tests use it). */
const rootOption = process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length);
const ROOT = resolve(rootOption ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const MANIFEST = join(ROOT, 'types/public-overloads.manifest.json');
const OUT = join(ROOT, 'types/public-overloads.generated.d.ts');

/** typed-function type name → public TypeScript type. */
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
  Array: 'number[] | number[][]',
  Matrix: 'Matrix',
  SparseMatrix: 'SparseMatrix',
  DenseMatrix: 'DenseMatrix',
  Object: 'StatReduceOptions',
  'number | BigNumber': 'number | BigNumber',
  any: 'unknown',
  Scalar: 'number | BigNumber | Complex',
  'Array | Matrix': 'number[] | Matrix',
};

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

const PARAM_NAMES = ['a', 'b', 'c', 'd', 'e'];

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
  const body = source.slice(open + 1, close);
  return { body, keys: parseSigKeys(body) };
}

function parseSigKeys(body) {
  const keys = [];
  for (const line of body.split('\n')) {
    const q = line.match(/^\s*'([^']+)':/);
    if (q) {
      keys.push(q[1]);
      continue;
    }
    const u = line.match(/^\s*(\w+):/);
    if (u && UNQUOTED_SIG_KEYS.has(u[1])) keys.push(u[1]);
  }
  return keys;
}

function aliasMap(source) {
  const map = new Map();
  // One alias per line (prettier keeps it so). The value may hold `;` (an object type), so it
  // runs to the last `;` of the line, before an optional `//` comment.
  for (const match of source.matchAll(/^type (\w+) = (.+?);[ \t]*(?:\/\/[^\n]*)?$/gm)) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

function expandType(type, aliases, depth = 0) {
  if (depth > 8) return type;
  return type
    .split('|')
    .map((part) => {
      const trimmed = part.trim();
      const match = trimmed.match(/^(\w+)((?:\[\])*)$/);
      if (!match) return trimmed;
      const [, name, brackets] = match;
      if (aliases.has(name))
        return `${expandType(aliases.get(name), aliases, depth + 1)}${brackets}`;
      if (SIG_TYPE[name]) return `${SIG_TYPE[name]}${brackets}`;
      return trimmed;
    })
    .join(' | ');
}

function keyAt(body, key, from) {
  const quoted = body.indexOf(`'${key}':`, from);
  if (quoted >= 0) return quoted;
  const match = body.slice(from).match(new RegExp(`(?:^|\\n)\\s*${key}:`));
  return match ? from + match.index : -1;
}

function signatureChunk(body, key, nextKey) {
  const at = keyAt(body, key, 0);
  if (at < 0) return '';
  const end = nextKey ? keyAt(body, nextKey, at + key.length + 1) : -1;
  return body.slice(at, end > at ? end : at + 1200);
}

function parseReturn(chunk, aliases) {
  const paren = chunk.indexOf('(');
  if (paren < 0) return null;
  let depth = 0;
  for (let i = paren; i < chunk.length; i++) {
    const ch = chunk[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        const annotated = chunk.slice(i + 1).match(/^\s*:\s*([^{=>]+?)\s*(?:=>|\{)/);
        return annotated ? expandType(annotated[1].trim(), aliases) : null;
      }
    }
  }
  return null;
}

function scalarReturnOf(body, aliases) {
  const keys = parseSigKeys(body);
  const index = keys.indexOf('number');
  if (index < 0) return 'number';
  const parsed = parseReturn(signatureChunk(body, 'number', keys[index + 1]), aliases);
  return parsed ?? 'number';
}

/** Container rule from unaryOnArray / unaryOnMatrix. */
function containerTypes(scalar) {
  const parts = scalar.split('|').map((part) => part.trim());
  const complex = parts.includes('Complex') && parts.includes('number');
  if (complex) {
    return {
      array: '(number | Complex)[]',
      array2: '(number | Complex)[][]',
      dense: 'DenseMatrix | (number | Complex)[][]',
      sparse: 'SparseMatrix | (number | Complex)[][]',
    };
  }
  if (scalar === 'number') {
    return {
      array: 'number[]',
      array2: 'number[][]',
      dense: 'DenseMatrix',
      sparse: 'SparseMatrix',
    };
  }
  return {
    array: `(${scalar})[]`,
    array2: `(${scalar})[][]`,
    dense: 'DenseMatrix',
    sparse: 'SparseMatrix',
  };
}

/**
 * A typed-function type name, or a union of them such as `Float64Array | Float32Array`.
 * `overrides` is the manifest `sigTypes` of one export. It replaces the public type of a name
 * for that export only. The bare `Array` key maps to `number[] | number[][]`, which is wrong for
 * an export that takes a vector only.
 */
function mapSigType(part, overrides = {}) {
  const lookup = (name) => overrides[name] ?? SIG_TYPE[name];
  if (lookup(part)) return lookup(part);
  const alternatives = part.split('|').map((alt) => alt.trim());
  if (alternatives.length > 1 && alternatives.every((alt) => lookup(alt))) {
    return alternatives.map((alt) => lookup(alt)).join(' | ');
  }
  throw new Error(`unmapped typed-function type "${part}"`);
}

function splitKey(key) {
  return key.split(',').map((part) => part.trim());
}

function paramsOf(parts, overrides) {
  const rendered = [];
  parts.forEach((part, i) => {
    if (part.startsWith('...')) {
      const inner = part.slice(3);
      rendered.push(`...rest: ${mapSigType(inner, overrides)}[]`);
      return;
    }
    const name = PARAM_NAMES[i] ?? `x${i}`;
    rendered.push(`${name}: ${mapSigType(part, overrides)}`);
  });
  return rendered.join(', ');
}

function overload(params, ret) {
  return `  (${params}): ${ret};`;
}

function overloadsForKey(key, body, exportName, aliases, nextKey, overrides) {
  // The rest key has no fixed parameter list; its overloads come from the manifest `fallback`.
  if (key === '...') return [];
  const chunk = signatureChunk(body, key, nextKey);
  const elementwise =
    chunk.includes('unaryCollection') ||
    chunk.includes('elementwiseNumber') ||
    chunk.includes('elementwiseMatrixNumber');
  const containers = containerTypes(scalarReturnOf(body, aliases));

  if (elementwise && key === 'Array | Matrix') {
    return [
      overload('a: number[]', containers.array),
      overload('a: number[][]', containers.array2),
      overload('a: readonly ElementwiseLeaf[]', 'unknown[]'),
      overload('a: DenseMatrix', containers.dense),
      overload('a: SparseMatrix', containers.sparse),
    ];
  }

  if (elementwise && (key.includes('Array') || key.includes('Matrix'))) {
    const parts = splitKey(key);
    const params = parts
      .map((part, i) => {
        const name = PARAM_NAMES[i] ?? `x${i}`;
        if (part === 'Array') return `${name}: ${containers.array}`;
        if (part === 'DenseMatrix') return `${name}: DenseMatrix`;
        if (part === 'SparseMatrix') return `${name}: SparseMatrix`;
        if (part === 'Matrix') return `${name}: Matrix`;
        return `${name}: ${mapSigType(part, overrides)}`;
      })
      .join(', ');
    const hasArray = parts.includes('Array');
    const hasDense = parts.includes('DenseMatrix') || parts.includes('Matrix');
    const hasSparse = parts.includes('SparseMatrix');
    let ret = containers.array;
    if (hasDense && !hasArray) ret = containers.dense;
    else if (hasSparse && !hasArray && !hasDense) ret = containers.sparse;
    return [overload(params, ret)];
  }

  let ret = parseReturn(chunk, aliases);
  if (ret === null && chunk.includes('trigFromAngleUnit')) ret = 'number | Complex';
  if (ret === null || ret === 'unknown') {
    const explicitUnknown = /\)\s*:\s*unknown\b/.test(chunk);
    if (!explicitUnknown) {
      throw new Error(`${exportName} signature "${key}" has no return annotation`);
    }
    ret = 'unknown';
  }

  const lines = [overload(paramsOf(splitKey(key), overrides), ret)];
  if (exportName === 'det' && key === 'Array | Matrix') {
    lines.unshift(overload('A: readonly number[][]', 'number'));
    lines.unshift(overload('A: number[][]', 'number'));
  }
  return lines;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function optionKeys(source, typeName) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const start = withoutComments.search(new RegExp(`export (?:type|interface) ${typeName}\\b`));
  if (start < 0) throw new Error(`could not read ${typeName}`);
  const open = withoutComments.indexOf('{', start);
  if (open < 0) throw new Error(`could not read ${typeName}`);
  let depth = 0;
  let close = -1;
  for (let i = open; i < withoutComments.length; i++) {
    if (withoutComments[i] === '{') depth++;
    else if (withoutComments[i] === '}') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) throw new Error(`could not read ${typeName}`);
  const body = withoutComments.slice(open + 1, close);
  return [...body.matchAll(/(?:^|\n)\s*(?:readonly\s+)?(\w+)\??:/g)].map((item) => item[1]).sort();
}

function assertOptionSync() {
  const stats = readFileSync(join(ROOT, 'src/statistics/numeric-data.ts'), 'utf8');
  const statsPublic = readFileSync(join(ROOT, 'types/stat-reduce-options.d.ts'), 'utf8');
  const evaluate = readFileSync(join(ROOT, 'src/factories/evaluate.ts'), 'utf8');
  const evaluatePublic = readFileSync(join(ROOT, 'types/physics-evaluate-options.d.ts'), 'utf8');
  const left = optionKeys(stats, 'StatReduceOptions').join(',');
  const right = optionKeys(statsPublic, 'StatReduceOptions').join(',');
  if (left !== right) {
    throw new Error(`StatReduceOptions drifted (source ${left} vs public ${right})`);
  }
  const physicsLeft = optionKeys(evaluate, 'PhysicsEvaluateOptions').join(',');
  const physicsRight = optionKeys(evaluatePublic, 'PhysicsEvaluateOptions').join(',');
  if (physicsLeft !== physicsRight) {
    throw new Error(
      `PhysicsEvaluateOptions drifted (source ${physicsLeft} vs public ${physicsRight})`
    );
  }
}

function buildFile(manifest) {
  assertOptionSync();
  const lines = [
    '// Generated by functions/scripts/gen-public-overloads.mjs — do not edit.',
    "import type { Complex, Fraction, BigNumber, Dual, UnitInstance } from '@danielsimonjr/mathts-core';",
    "import type { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';",
    "import type { StatReduceOptions } from './stat-reduce-options.js';",
    "import type { PhysicsEvaluateOptions } from './physics-evaluate-options.js';",
    '',
    'export type Matrix = DenseMatrix | SparseMatrix;',
    'export type ElementwiseLeaf = number | bigint | Complex | Fraction | BigNumber | UnitInstance | Dual;',
    '',
  ];
  for (const entry of manifest.exports) {
    const source = readFileSync(join(ROOT, entry.source), 'utf8');
    const aliases = aliasMap(source);
    const { body, keys } = mathTypedBody(source, entry.name, entry.mathTypedPattern);
    if (keys.length === 0) throw new Error(`${entry.name}: no signatures parsed`);
    const sigTypes = entry.sigTypes ?? {};
    const sigParts = new Set(keys.flatMap((key) => splitKey(key)));
    for (const name of Object.keys(sigTypes)) {
      if (!sigParts.has(name)) {
        throw new Error(
          `${entry.name}: sigTypes "${name}" matches no signature part (parts: ${[...sigParts].join('; ')})`
        );
      }
    }
    const iface = `${capitalize(entry.name)}Callable`;
    lines.push(`export interface ${iface} {`);
    const seen = new Set();
    const specific = [];
    const fallback = [];
    keys.forEach((key, index) => {
      for (const line of overloadsForKey(
        key,
        body,
        entry.name,
        aliases,
        keys[index + 1],
        sigTypes
      )) {
        if (seen.has(line)) continue;
        seen.add(line);
        if (/\(\s*a: unknown\b/.test(line) || line.includes('...rest:')) fallback.push(line);
        else specific.push(line);
      }
    });
    // `fallback` in the manifest holds overloads that a signature key cannot express, such as
    // the `'...'` rest signature. They come last, after every specific overload.
    lines.push(...specific, ...fallback, ...(entry.fallback ?? []).map((line) => `  ${line}`));
    lines.push('  readonly name: string;');
    lines.push(
      '  readonly signatures: Readonly<Record<string, (...args: readonly unknown[]) => unknown>>;'
    );
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
let next;
try {
  next = buildFile(manifest);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
if (check) {
  if (!existsSync(OUT)) {
    console.error(
      'public-overloads.generated.d.ts missing; run: node functions/scripts/gen-public-overloads.mjs'
    );
    process.exit(1);
  }
  const prev = readFileSync(OUT, 'utf8');
  if (next !== prev) {
    console.error(
      'public-overloads.generated.d.ts is stale; run: node functions/scripts/gen-public-overloads.mjs'
    );
    process.exit(1);
  }
  console.log('public-overloads.generated.d.ts is up to date');
  process.exit(0);
}
writeFileSync(OUT, next);
console.log(`wrote ${OUT}`);
