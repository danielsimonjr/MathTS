/**
 * Structural utilities over {@link ScalarNode}: traversal, metrics, and
 * PySR-style canonical form with a stable structural key.
 *
 * @packageDocumentation
 */

import {
  ScalarBuildError,
  SCALAR_FUNCTION_LOWERING,
  type LoweredScalarFn,
  type ScalarNode,
  type ScalarOperator,
} from './scalar-builder.js';

const LOWERED_FUNCTIONS: ReadonlySet<string> = new Set(Object.values(SCALAR_FUNCTION_LOWERING));

function isLoweredScalarFn(fn: string): fn is LoweredScalarFn {
  return LOWERED_FUNCTIONS.has(fn);
}

/**
 * Per-node weights for {@link scalarComplexity}.
 *
 * Omitted fields default to 1, which is PySR's `complexity_of_operators`,
 * `complexity_of_constants`, and `complexity_of_variables` default.
 * A `symbol` record supplies per-name weights; a name that is absent from
 * the record still weighs 1. Weights are summed across the stored tree and
 * then rounded with `Math.round` (PySR rounds to the nearest integer after
 * the sum; the half-tie rule here is JavaScript's, not Julia's half-to-even).
 */
export interface ScalarComplexityWeights {
  /** Weight of one operator node. Default 1 for every {@link ScalarOperator}. */
  readonly op?: Partial<Record<ScalarOperator, number>>;
  /** Weight of one call node, keyed by the lowered name (`ln` is `log`). Default 1. */
  readonly call?: Partial<Record<LoweredScalarFn, number>>;
  /** Weight of one number node. Default 1. PySR `complexity_of_constants`. */
  readonly number?: number;
  /** Weight of one symbol node: one number for every name, or a per-name record. Default 1. */
  readonly symbol?: number | Readonly<Record<string, number>>;
}

type Factor = { base: ScalarNode; exp: number };

function spell(value: number): string {
  if (Number.isNaN(value)) {
    return 'NaN';
  }
  if (Object.is(value, -0)) {
    return '-0';
  }
  if (value === Infinity) {
    return 'Infinity';
  }
  if (value === -Infinity) {
    return '-Infinity';
  }
  return value.toString();
}

function assertPowerArity(args: readonly ScalarNode[]): void {
  if (args.length !== 2) {
    throw new ScalarBuildError(`'^' needs exactly 2 args, got ${args.length}`);
  }
}

function assertCallFn(fn: string): LoweredScalarFn {
  if (!isLoweredScalarFn(fn)) {
    throw new ScalarBuildError(`unknown scalar function '${String(fn)}'`);
  }
  return fn;
}

/**
 * Preorder walk. The root is visited first, at `depth` 0, then each child
 * left to right. `depth` here is not {@link scalarDepth}: a leaf visited by
 * this function has depth 0 when it is the root, while `scalarDepth` of any
 * leaf is 1.
 */
export function forEachScalar(
  node: ScalarNode,
  visit: (n: ScalarNode, depth: number) => void
): void {
  function walk(n: ScalarNode, depth: number): void {
    visit(n, depth);
    if (n.kind === 'call') {
      walk(n.arg, depth + 1);
    } else if (n.kind === 'op') {
      for (const child of n.args) {
        walk(child, depth + 1);
      }
    }
  }
  walk(node, 0);
}

/**
 * Post-order immutable map. Children are mapped first. `fn` then receives
 * the node with those children and its return value replaces the node.
 * The replacement is not walked again.
 *
 * When a child result is the same reference and `fn` returns the rebuilt
 * node, the original node reference is kept. The input tree is never mutated,
 * including a deep-frozen input.
 */
export function mapScalar(node: ScalarNode, fn: (n: ScalarNode) => ScalarNode): ScalarNode {
  let rebuilt: ScalarNode;
  if (node.kind === 'number' || node.kind === 'symbol') {
    rebuilt = node;
  } else if (node.kind === 'call') {
    const newArg = mapScalar(node.arg, fn);
    rebuilt = newArg === node.arg ? node : { kind: 'call', fn: node.fn, arg: newArg };
  } else {
    const newArgs = node.args.map((child) => mapScalar(child, fn));
    const sameArgs = newArgs.every((child, i) => child === node.args[i]);
    rebuilt = sameArgs ? node : { kind: 'op', op: node.op, args: newArgs };
  }
  const result = fn(rebuilt);
  if (result === rebuilt && rebuilt === node) {
    return node;
  }
  return result;
}

/** Number of nodes in the stored tree. An empty `+` is one node. */
export function scalarSize(node: ScalarNode): number {
  let count = 0;
  forEachScalar(node, () => {
    count += 1;
  });
  return count;
}

/**
 * Stored-tree depth. A number or symbol is 1. A call is `1 + scalarDepth(arg)`.
 * An operator is `1 + max(child depths)`, or 1 when it has no children.
 */
export function scalarDepth(node: ScalarNode): number {
  if (node.kind === 'number' || node.kind === 'symbol') {
    return 1;
  }
  if (node.kind === 'call') {
    return 1 + scalarDepth(node.arg);
  }
  if (node.args.length === 0) {
    return 1;
  }
  let maxChild = 0;
  for (const child of node.args) {
    const d = scalarDepth(child);
    if (d > maxChild) {
      maxChild = d;
    }
  }
  return 1 + maxChild;
}

function symbolWeight(name: string, weights: ScalarComplexityWeights): number {
  const w = weights.symbol;
  if (w === undefined) {
    return 1;
  }
  if (typeof w === 'number') {
    return w;
  }
  return w[name] ?? 1;
}

function nodeWeight(node: ScalarNode, weights: ScalarComplexityWeights): number {
  switch (node.kind) {
    case 'number':
      return weights.number ?? 1;
    case 'symbol':
      return symbolWeight(node.name, weights);
    case 'call':
      return weights.call?.[node.fn] ?? 1;
    case 'op':
      return weights.op?.[node.op] ?? 1;
  }
}

/**
 * Weighted node count of the stored tree. See {@link ScalarComplexityWeights}.
 * The return value is `Math.round` of the sum, so default weights make this
 * equal `scalarSize`. Walks `-` and `/` as stored; it does not rewrite them first.
 */
export function scalarComplexity(node: ScalarNode, weights: ScalarComplexityWeights = {}): number {
  let sum = 0;
  forEachScalar(node, (n) => {
    sum += nodeWeight(n, weights);
  });
  return Math.round(sum);
}

/**
 * Sorted unique `symbol` names in the stored tree. Function names and number
 * literals are not included. Sort is UTF-16 code-unit order (`<` on strings).
 */
export function scalarSymbols(node: ScalarNode): readonly string[] {
  const names = new Set<string>();
  forEachScalar(node, (n) => {
    if (n.kind === 'symbol') {
      names.add(n.name);
    }
  });
  return [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function factorToPowerNode(f: Factor): ScalarNode {
  if (Object.is(f.exp, 1)) {
    return f.base;
  }
  return { kind: 'op', op: '^', args: [f.base, { kind: 'number', value: f.exp }] };
}

function collectFactors(node: ScalarNode): Factor[] {
  if (node.kind === 'op' && node.op === '*') {
    const out: Factor[] = [];
    for (const child of node.args) {
      out.push(...collectFactors(child));
    }
    return out;
  }
  if (node.kind === 'op' && node.op === '^') {
    assertPowerArity(node.args);
    const [base, expNode] = node.args;
    if (expNode.kind === 'number' && Number.isFinite(expNode.value)) {
      return collectFactors(base).map((f) => ({
        base: f.base,
        exp: f.exp * expNode.value,
      }));
    }
    return [{ base: node, exp: 1 }];
  }
  return [{ base: node, exp: 1 }];
}

function fullyFlattenFactors(factors: Factor[]): Factor[] {
  const out: Factor[] = [];
  for (const f of factors) {
    out.push(...collectFactors(factorToPowerNode(f)));
  }
  return out;
}

function encodeCanonicalKey(node: ScalarNode): string {
  switch (node.kind) {
    case 'number':
      return JSON.stringify({ k: 'n', v: spell(node.value) });
    case 'symbol':
      return JSON.stringify({ k: 's', v: node.name });
    case 'call': {
      assertCallFn(node.fn);
      const argKey = encodeCanonicalKey(node.arg);
      const obj = { k: 'c', f: node.fn, a: JSON.parse(argKey) as unknown };
      return JSON.stringify(obj);
    }
    case 'op': {
      if (node.op === '^') {
        assertPowerArity(node.args);
        const [base, exp] = node.args;
        const obj = {
          k: '^',
          b: JSON.parse(encodeCanonicalKey(base)) as unknown,
          e: JSON.parse(encodeCanonicalKey(exp)) as unknown,
        };
        return JSON.stringify(obj);
      }
      if (node.op === '+' || node.op === '*') {
        const keys = node.args
          .map((arg) => encodeCanonicalKey(arg))
          .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const obj = { k: node.op, a: keys.map((k) => JSON.parse(k) as unknown) };
        return JSON.stringify(obj);
      }
      throw new ScalarBuildError(`scalar canonical: unexpected operator '${node.op}'`);
    }
  }
}

function baseKey(node: ScalarNode): string {
  return encodeCanonicalKey(node);
}

function fromProduct(factors: Factor[]): ScalarNode {
  const flat = fullyFlattenFactors(factors);

  const coefficients: Factor[] = [];
  const rest: Factor[] = [];
  for (const f of flat) {
    if (f.base.kind === 'number' && Object.is(f.exp, 1)) {
      coefficients.push(f);
    } else {
      rest.push(f);
    }
  }

  let coeff = 1;
  for (const c of coefficients) {
    if (c.base.kind === 'number') {
      coeff *= c.base.value;
    }
  }

  const groups = new Map<string, { base: ScalarNode; sum: number }>();
  const groupOrder: string[] = [];
  for (const f of rest) {
    const key = baseKey(f.base);
    const existing = groups.get(key);
    if (existing) {
      existing.sum += f.exp;
    } else {
      groups.set(key, { base: f.base, sum: f.exp });
      groupOrder.push(key);
    }
  }

  const materialized: ScalarNode[] = [];
  for (const key of groupOrder) {
    const { base, sum } = groups.get(key)!;
    if (Object.is(sum, 1)) {
      materialized.push(base);
    } else {
      materialized.push({
        kind: 'op',
        op: '^',
        args: [base, { kind: 'number', value: sum }],
      });
    }
  }

  const hasOther = materialized.length > 0;
  if (coefficients.length > 0) {
    if (!Object.is(coeff, 1) || !hasOther) {
      materialized.push({ kind: 'number', value: coeff });
    }
  }

  if (materialized.length === 0) {
    return { kind: 'number', value: 1 };
  }
  if (materialized.length === 1) {
    return materialized[0];
  }

  const sorted = materialized
    .map((node) => ({ node, key: encodeCanonicalKey(node) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.node);

  return { kind: 'op', op: '*', args: sorted };
}

function fromSum(parts: ScalarNode[]): ScalarNode {
  const inlined: ScalarNode[] = [];
  for (const part of parts) {
    if (part.kind === 'op' && part.op === '+') {
      inlined.push(...part.args);
    } else {
      inlined.push(part);
    }
  }

  let numericSum: number | undefined;
  const nonNumbers: ScalarNode[] = [];
  for (const part of inlined) {
    if (part.kind === 'number') {
      numericSum = numericSum === undefined ? part.value : numericSum + part.value;
    } else {
      nonNumbers.push(part);
    }
  }

  const addends: ScalarNode[] = [...nonNumbers];
  if (numericSum !== undefined) {
    addends.push({ kind: 'number', value: numericSum });
  }

  if (addends.length === 0) {
    return { kind: 'number', value: 0 };
  }
  if (addends.length === 1) {
    return addends[0];
  }

  const sorted = addends
    .map((node) => ({ node, key: encodeCanonicalKey(node) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.node);

  return { kind: 'op', op: '+', args: sorted };
}

function canonProductByNumber(node: ScalarNode, coeff: number): ScalarNode {
  return fromProduct([{ base: { kind: 'number', value: coeff }, exp: 1 }, ...collectFactors(node)]);
}

function inversePower(t: ScalarNode): ScalarNode {
  return { kind: 'op', op: '^', args: [t, { kind: 'number', value: -1 }] };
}

function canon(node: ScalarNode): ScalarNode {
  switch (node.kind) {
    case 'number':
    case 'symbol':
      return node;
    case 'call':
      return { kind: 'call', fn: assertCallFn(node.fn), arg: canon(node.arg) };
    case 'op': {
      const op = node.op;
      const args = node.args;
      if (op === '+') {
        if (args.length === 0) {
          return { kind: 'number', value: 0 };
        }
        if (args.length === 1) {
          return canon(args[0]);
        }
        return fromSum(args.map((a) => canon(a)));
      }
      if (op === '-') {
        if (args.length === 0) {
          return { kind: 'number', value: 0 };
        }
        if (args.length === 1) {
          return canon(args[0]);
        }
        const head = canon(args[0]);
        const parts: ScalarNode[] = [head];
        for (let i = 1; i < args.length; i++) {
          parts.push(canonProductByNumber(canon(args[i]), -1));
        }
        return fromSum(parts);
      }
      if (op === '*') {
        if (args.length === 0) {
          return { kind: 'number', value: 1 };
        }
        if (args.length === 1) {
          return canon(args[0]);
        }
        const factors: Factor[] = [];
        for (const a of args) {
          factors.push(...collectFactors(canon(a)));
        }
        return fromProduct(factors);
      }
      if (op === '/') {
        if (args.length === 0) {
          return { kind: 'number', value: 1 };
        }
        if (args.length === 1) {
          return canon(args[0]);
        }
        let factors = collectFactors(canon(args[0]));
        for (let i = 1; i < args.length; i++) {
          factors = factors.concat(collectFactors(inversePower(canon(args[i]))));
        }
        return fromProduct(factors);
      }
      if (op === '^') {
        assertPowerArity(args);
        const base = canon(args[0]);
        const expCanon = canon(args[1]);
        if (expCanon.kind === 'number' && Number.isFinite(expCanon.value)) {
          return fromProduct(
            collectFactors(base).map((f) => ({
              base: f.base,
              exp: f.exp * expCanon.value,
            }))
          );
        }
        return { kind: 'op', op: '^', args: [base, expCanon] };
      }
      throw new ScalarBuildError(`unknown scalar operator '${String(op)}'`);
    }
  }
}

/**
 * Canonical tree. Idempotent: `scalarCanonical(scalarCanonical(n))` is deeply
 * equal to `scalarCanonical(n)`. Does not mutate `n`. The result uses only
 * `number`, `symbol`, `call`, `+`, `*`, and `^`. See the algorithm below.
 */
export function scalarCanonical(node: ScalarNode): ScalarNode {
  return canon(node);
}

/**
 * `JSON.stringify` of {@link scalarCanonical}, with the key order fixed in
 * "Key encoding". Equal keys are the definition of structural equality.
 */
export function scalarCanonicalKey(node: ScalarNode): string {
  return encodeCanonicalKey(scalarCanonical(node));
}

/** `scalarCanonicalKey(a) === scalarCanonicalKey(b)`. */
export function scalarEquals(a: ScalarNode, b: ScalarNode): boolean {
  return scalarCanonicalKey(a) === scalarCanonicalKey(b);
}
