/**
 * PySR-style mutation and crossover operators over {@link ScalarNode} trees (M12).
 *
 * @packageDocumentation
 */

import {
  createScalarBuilder,
  mapScalar,
  scalarGrammarAccepts,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import type { SeededRng } from '@danielsimonjr/mathts-core';
import { evaluateScalar } from './scalar-eval.js';

/** Roadmap §2.5: probability of negating a perturbed constant. */
export const MUTATE_CONSTANT_NEGATE_PROBABILITY = 0.00743;

/** Default PySR mutation weights (roadmap §2.2, optimize/backsolve omitted). Draw order. */
export const DEFAULT_MUTATION_WEIGHTS = {
  rotateTree: 4.26,
  addNode: 2.47,
  deleteNode: 0.87,
  mutateOperator: 0.293,
  identity: 0.273,
  swapOperands: 0.198,
  mutateFeature: 0.1,
  mutateConstant: 0.0346,
  insertNode: 0.0112,
  simplifyConstants: 0.00209,
  randomizeTree: 0.000502,
} as const;

export type MutationWeightKey = keyof typeof DEFAULT_MUTATION_WEIGHTS;

const MUTATION_DRAW_ORDER: readonly MutationWeightKey[] = [
  'rotateTree',
  'addNode',
  'deleteNode',
  'mutateOperator',
  'identity',
  'swapOperands',
  'mutateFeature',
  'mutateConstant',
  'insertNode',
  'simplifyConstants',
  'randomizeTree',
];

/** Context for mutation operators (no hidden defaults). */
export interface ScalarMutationContext {
  readonly grammar: ScalarGrammar;
  readonly perturbationFactor: number;
  readonly temperature: number;
}

export type ScalarMutationOperator = (
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
) => ScalarNode | null;

type Path = readonly number[];

const builder = createScalarBuilder();

function cloneNode(node: ScalarNode): ScalarNode {
  if (node.kind === 'number' || node.kind === 'symbol') {
    return node;
  }
  if (node.kind === 'call') {
    return { kind: 'call', fn: node.fn, arg: cloneNode(node.arg) };
  }
  return { kind: 'op', op: node.op, args: node.args.map(cloneNode) };
}

function collectPaths(node: ScalarNode, predicate: (n: ScalarNode, path: Path) => boolean): Path[] {
  const out: Path[] = [];
  function walk(n: ScalarNode, path: Path): void {
    if (predicate(n, path)) {
      out.push(path);
    }
    if (n.kind === 'call') {
      walk(n.arg, path);
    } else if (n.kind === 'op') {
      for (let i = 0; i < n.args.length; i++) {
        walk(n.args[i], [...path, i]);
      }
    }
  }
  walk(node, []);
  return out;
}

function nodeAt(root: ScalarNode, path: Path): ScalarNode {
  let cur = root;
  for (const idx of path) {
    if (cur.kind !== 'op') {
      throw new Error('invalid path');
    }
    cur = cur.args[idx];
  }
  return cur;
}

function replaceAt(root: ScalarNode, path: Path, replacement: ScalarNode): ScalarNode {
  if (path.length === 0) {
    return replacement;
  }
  if (root.kind !== 'op') {
    return root;
  }
  const [head, ...rest] = path;
  const newArgs = root.args.map((child, i) =>
    i === head ? replaceAt(child, rest, replacement) : child
  );
  return { kind: 'op', op: root.op, args: newArgs };
}

function leafNames(grammar: ScalarGrammar): string[] {
  const params = grammar.parameters ?? [];
  return [...grammar.variables, ...params];
}

function drawLeaf(grammar: ScalarGrammar, rng: SeededRng): ScalarNode {
  const names = leafNames(grammar);
  const literals = grammar.literals ?? [];
  const kindCount = names.length + literals.length;
  if (kindCount === 0) {
    return builder.symbol(grammar.variables[0] ?? 'x');
  }
  const pick = rng.nextInt(kindCount);
  if (pick < names.length) {
    return builder.symbol(names[pick]);
  }
  return builder.number(literals[pick - names.length]);
}

function accepts(grammar: ScalarGrammar, node: ScalarNode): boolean {
  return scalarGrammarAccepts(grammar, node);
}

/** Returns the input unchanged. Does not consume `rng`. */
export function identity(
  node: ScalarNode,
  _rng?: SeededRng,
  _ctx?: ScalarMutationContext
): ScalarNode | null {
  return node;
}

/** Perturb one numeric leaf; `null` when none or grammar rejects. */
export function mutateConstant(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  const paths = collectPaths(node, (n) => n.kind === 'number');
  if (paths.length === 0) {
    return null;
  }
  const path = paths[rng.nextInt(paths.length)];
  const target = nodeAt(node, path);
  if (target.kind !== 'number') {
    return null;
  }
  let value = target.value;
  const factor = 1 + (2 * rng.next() - 1) * (ctx.perturbationFactor * ctx.temperature);
  value *= factor;
  if (rng.next() < MUTATE_CONSTANT_NEGATE_PROBABILITY) {
    value = -value;
  }
  const next = replaceAt(node, path, builder.number(value));
  return accepts(ctx.grammar, next) ? next : null;
}

/** Replace one operator or call name; `null` on failure. */
export function mutateOperator(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  const opPaths = collectPaths(node, (n) => n.kind === 'op' && ctx.grammar.binary.length > 0);
  const callPaths = collectPaths(node, (n) => n.kind === 'call' && ctx.grammar.unary.length > 0);
  const choices: { path: Path; kind: 'op' | 'call' }[] = [
    ...opPaths.map((path) => ({ path, kind: 'op' as const })),
    ...callPaths.map((path) => ({ path, kind: 'call' as const })),
  ];
  if (choices.length === 0) {
    return null;
  }
  const pick = choices[rng.nextInt(choices.length)];
  const current = nodeAt(node, pick.path);
  if (pick.kind === 'op' && current.kind === 'op') {
    const alts = ctx.grammar.binary.filter((op) => op !== current.op);
    if (alts.length === 0) {
      return null;
    }
    const op = alts[rng.nextInt(alts.length)];
    const next = replaceAt(node, pick.path, { kind: 'op', op, args: current.args });
    return accepts(ctx.grammar, next) ? next : null;
  }
  if (pick.kind === 'call' && current.kind === 'call') {
    const alts = ctx.grammar.unary.filter((fn) => fn !== current.fn);
    if (alts.length === 0) {
      return null;
    }
    const fn = alts[rng.nextInt(alts.length)];
    const next = replaceAt(node, pick.path, { kind: 'call', fn, arg: current.arg });
    return accepts(ctx.grammar, next) ? next : null;
  }
  return null;
}

/** Replace one symbol leaf with another allowed name. */
export function mutateFeature(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  const names = leafNames(ctx.grammar);
  if (names.length < 2) {
    return null;
  }
  const paths = collectPaths(node, (n) => n.kind === 'symbol');
  if (paths.length === 0) {
    return null;
  }
  const path = paths[rng.nextInt(paths.length)];
  const current = nodeAt(node, path);
  if (current.kind !== 'symbol') {
    return null;
  }
  const alts = names.filter((name) => name !== current.name);
  if (alts.length === 0) {
    return null;
  }
  const name = alts[rng.nextInt(alts.length)];
  const next = replaceAt(node, path, builder.symbol(name));
  return accepts(ctx.grammar, next) ? next : null;
}

/** Swap the two operands of one binary operator. */
export function swapOperands(
  node: ScalarNode,
  rng: SeededRng,
  _ctx: ScalarMutationContext
): ScalarNode | null {
  const paths = collectPaths(node, (n) => n.kind === 'op' && n.args.length === 2);
  if (paths.length === 0) {
    return null;
  }
  const path = paths[rng.nextInt(paths.length)];
  const current = nodeAt(node, path);
  if (current.kind !== 'op' || current.args.length !== 2) {
    return null;
  }
  const next = replaceAt(node, path, {
    kind: 'op',
    op: current.op,
    args: [current.args[1], current.args[0]],
  });
  return next;
}

/** Replace a subtree with a binary op or unary call over it and a new leaf. */
export function addNode(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  const paths = collectPaths(node, () => true);
  if (paths.length === 0) {
    return null;
  }
  const path = paths[rng.nextInt(paths.length)];
  const subtree = nodeAt(node, path);
  const useCall =
    ctx.grammar.unary.length > 0 && (ctx.grammar.binary.length === 0 || rng.next() < 0.5);
  let replacement: ScalarNode;
  if (useCall) {
    const fn = ctx.grammar.unary[rng.nextInt(ctx.grammar.unary.length)];
    replacement = builder.call(fn, cloneNode(subtree));
  } else {
    if (ctx.grammar.binary.length === 0) {
      return null;
    }
    const op = ctx.grammar.binary[rng.nextInt(ctx.grammar.binary.length)];
    const leaf = drawLeaf(ctx.grammar, rng);
    const leftFirst = rng.next() < 0.5;
    replacement = leftFirst
      ? builder.op(op, [cloneNode(subtree), leaf])
      : builder.op(op, [leaf, cloneNode(subtree)]);
  }
  const next = replaceAt(node, path, replacement);
  return accepts(ctx.grammar, next) ? next : null;
}

/** Insert a binary operator between a parent and one child. */
export function insertNode(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  if (node.kind !== 'op' || ctx.grammar.binary.length === 0) {
    return null;
  }
  const edges: { path: Path; childIndex: number }[] = [];
  function walk(n: ScalarNode, path: Path): void {
    if (n.kind === 'op' && n.args.length === 2) {
      edges.push({ path, childIndex: 0 });
      edges.push({ path, childIndex: 1 });
    }
    if (n.kind === 'call') {
      walk(n.arg, path);
    } else if (n.kind === 'op') {
      for (let i = 0; i < n.args.length; i++) {
        walk(n.args[i], [...path, i]);
      }
    }
  }
  walk(node, []);
  if (edges.length === 0) {
    return null;
  }
  const edge = edges[rng.nextInt(edges.length)];
  const parent = nodeAt(node, edge.path);
  if (parent.kind !== 'op') {
    return null;
  }
  const child = parent.args[edge.childIndex];
  const op = ctx.grammar.binary[rng.nextInt(ctx.grammar.binary.length)];
  const leaf = drawLeaf(ctx.grammar, rng);
  const inner = rng.next() < 0.5 ? builder.op(op, [child, leaf]) : builder.op(op, [leaf, child]);
  const newArgs = parent.args.map((c, i) => (i === edge.childIndex ? inner : c));
  const next = replaceAt(node, edge.path, { kind: 'op', op: parent.op, args: newArgs });
  return accepts(ctx.grammar, next) ? next : null;
}

/** Replace a binary operator with one of its children. */
export function deleteNode(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  const paths = collectPaths(
    node,
    (n, path) => n.kind === 'op' && n.args.length === 2 && path.length > 0
  );
  const rootBinaries = collectPaths(
    node,
    (n, path) => n.kind === 'op' && n.args.length === 2 && path.length === 0
  );
  const candidates = [...paths, ...rootBinaries];
  if (candidates.length === 0) {
    return null;
  }
  const path = candidates[rng.nextInt(candidates.length)];
  const current = nodeAt(node, path);
  if (current.kind !== 'op' || current.args.length !== 2) {
    return null;
  }
  const child = current.args[rng.nextInt(2)];
  if (path.length === 0) {
    return accepts(ctx.grammar, child) ? child : null;
  }
  const next = replaceAt(node, path, child);
  return accepts(ctx.grammar, next) ? next : null;
}

function rotateLeft(opNode: ScalarNode): ScalarNode | null {
  if (opNode.kind !== 'op' || opNode.args.length !== 2) {
    return null;
  }
  const left = opNode.args[0];
  const right = opNode.args[1];
  if (left.kind !== 'op' || left.args.length !== 2) {
    return null;
  }
  const a = left.args[0];
  const b = left.args[1];
  const newRight = builder.op(opNode.op, [b, right]);
  return builder.op(left.op, [a, newRight]);
}

function rotateRight(opNode: ScalarNode): ScalarNode | null {
  if (opNode.kind !== 'op' || opNode.args.length !== 2) {
    return null;
  }
  const left = opNode.args[0];
  const right = opNode.args[1];
  if (right.kind !== 'op' || right.args.length !== 2) {
    return null;
  }
  const b = right.args[0];
  const c = right.args[1];
  const newLeft = builder.op(opNode.op, [left, b]);
  return builder.op(right.op, [newLeft, c]);
}

/** One left or right rotation at a nested binary node. */
export function rotateTree(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  const paths = collectPaths(
    node,
    (n) =>
      n.kind === 'op' &&
      n.args.length === 2 &&
      ((n.args[0].kind === 'op' && n.args[0].args.length === 2) ||
        (n.args[1].kind === 'op' && n.args[1].args.length === 2))
  );
  if (paths.length === 0) {
    return null;
  }
  const path = paths[rng.nextInt(paths.length)];
  const current = nodeAt(node, path);
  if (current.kind !== 'op') {
    return null;
  }
  const rotated = rng.next() < 0.5 ? rotateLeft(current) : rotateRight(current);
  if (rotated === null) {
    return null;
  }
  const next = replaceAt(node, path, rotated);
  return accepts(ctx.grammar, next) ? next : null;
}

function growRandomTree(grammar: ScalarGrammar, rng: SeededRng, maxSize: number): ScalarNode {
  function grow(remaining: number): ScalarNode {
    if (remaining <= 1) {
      return drawLeaf(grammar, rng);
    }
    const canUnary = grammar.unary.length > 0 && remaining >= 2;
    const canBinary = grammar.binary.length > 0 && remaining >= 3;
    if (!canUnary && !canBinary) {
      return drawLeaf(grammar, rng);
    }
    if (canUnary && (!canBinary || rng.next() < 0.35)) {
      const fn = grammar.unary[rng.nextInt(grammar.unary.length)];
      return builder.call(fn, grow(remaining - 1));
    }
    const op = grammar.binary[rng.nextInt(grammar.binary.length)];
    const leftSize = 1 + rng.nextInt(remaining - 2);
    const rightSize = remaining - 1 - leftSize;
    return builder.op(op, [grow(leftSize), grow(rightSize)]);
  }
  const target = 1 + rng.nextInt(maxSize);
  let tree = grow(target);
  for (let attempt = 0; attempt < 32 && !accepts(grammar, tree); attempt++) {
    tree = grow(target);
  }
  return tree;
}

/** Replace the tree with a random grammar-constrained tree. */
export function randomizeTree(
  node: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  void node;
  const next = growRandomTree(ctx.grammar, rng, ctx.grammar.maxSize);
  return accepts(ctx.grammar, next) ? next : null;
}

/** Fold numeric-only subtrees via {@link evaluateScalar}. */
export function simplifyConstants(node: ScalarNode): ScalarNode {
  return mapScalar(node, (n) => {
    if (n.kind !== 'op' && n.kind !== 'call') {
      return n;
    }
    let allNumbers = true;
    forEachLeaves(n, (leaf) => {
      if (leaf.kind !== 'number') {
        allNumbers = false;
      }
    });
    if (!allNumbers) {
      return n;
    }
    const size = countNodes(n);
    if (size <= 1) {
      return n;
    }
    try {
      const value = evaluateScalar(n, {});
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return n;
      }
      return builder.number(value);
    } catch {
      return n;
    }
  });
}

function forEachLeaves(node: ScalarNode, visit: (n: ScalarNode) => void): void {
  if (node.kind === 'number' || node.kind === 'symbol') {
    visit(node);
    return;
  }
  if (node.kind === 'call') {
    forEachLeaves(node.arg, visit);
    return;
  }
  for (const child of node.args) {
    forEachLeaves(child, visit);
  }
}

function countNodes(node: ScalarNode): number {
  if (node.kind === 'number' || node.kind === 'symbol') {
    return 1;
  }
  if (node.kind === 'call') {
    return 1 + countNodes(node.arg);
  }
  return 1 + node.args.reduce((s, c) => s + countNodes(c), 0);
}

/** Subtree crossover between two individuals. */
export function crossoverSubtrees(
  left: ScalarNode,
  right: ScalarNode,
  rng: SeededRng,
  ctx: ScalarMutationContext
): ScalarNode | null {
  const leftPaths = collectPaths(left, () => true);
  const rightPaths = collectPaths(right, () => true);
  if (leftPaths.length === 0 || rightPaths.length === 0) {
    return null;
  }
  const lp = leftPaths[rng.nextInt(leftPaths.length)];
  const donor = cloneNode(nodeAt(right, rightPaths[rng.nextInt(rightPaths.length)]));
  const next = replaceAt(left, lp, donor);
  return accepts(ctx.grammar, next) ? next : null;
}

/** Draw a mutation operator key from weighted defaults or overrides. */
export function drawMutationOperator(
  rng: SeededRng,
  weights: Readonly<Record<MutationWeightKey, number>> = DEFAULT_MUTATION_WEIGHTS
): MutationWeightKey {
  const sum = MUTATION_DRAW_ORDER.reduce((s, k) => s + weights[k], 0);
  let u = rng.next() * sum;
  for (const key of MUTATION_DRAW_ORDER) {
    u -= weights[key];
    if (u <= 0) {
      return key;
    }
  }
  return MUTATION_DRAW_ORDER[MUTATION_DRAW_ORDER.length - 1];
}

const OPERATOR_BY_KEY: Record<MutationWeightKey, ScalarMutationOperator> = {
  rotateTree,
  addNode,
  deleteNode,
  mutateOperator,
  identity,
  swapOperands,
  mutateFeature,
  mutateConstant,
  insertNode,
  simplifyConstants: (node, _rng, _ctx) => simplifyConstants(node),
  randomizeTree,
};

/** Combine mutation operators with PySR default weights. */
export function weightedMutation(
  weights: Readonly<Record<MutationWeightKey, number>> = DEFAULT_MUTATION_WEIGHTS
): ScalarMutationOperator {
  return (node, rng, ctx) => {
    const key = drawMutationOperator(rng, weights);
    return OPERATOR_BY_KEY[key](node, rng, ctx);
  };
}
