/**
 * Default dependencies for the AST node constructors.
 *
 * A node constructor needs a `Node` base class. Each math scope gets one
 * memoized base, so every node class built for that scope shares one
 * `instanceof` chain. Host-owned runtime functions (`subset`, `size`, `matrix`,
 * `isBounded`, `ResultSet`) are never defaulted here: the host supplies them.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { createNode } from './Node.js';
import { getDefaultMathScope } from '../default-math-scope.js';
import type { DefaultDependencies } from '../utils/factory.js';

type NodeBase = ReturnType<typeof createNode>;

const nodeBaseByScope = new WeakMap<object, NodeBase>();

/** The shared `Node` base class for one math scope (built once per scope). */
export function nodeBaseFor(math: Record<string, unknown>): NodeBase {
  let base = nodeBaseByScope.get(math);
  if (base === undefined) {
    base = createNode({ mathWithTransform: math });
    nodeBaseByScope.set(math, base);
  }
  return base;
}

/**
 * Defaults for the dependencies this package owns: `Node` (the shared base),
 * `math` (the default math scope) and `typed` (the shared typed instance). The
 * `Node` base follows the caller's `math` when the caller supplied it, so
 * `.compile()` resolves names against that scope.
 */
export const nodeDefaults: DefaultDependencies = (supplied, missing) => {
  const math = (supplied?.math as Record<string, unknown> | undefined) ?? getDefaultMathScope();
  const owned: Record<string, unknown> = {
    Node: nodeBaseFor(math),
    math,
    typed: mathTyped,
  };
  const fill: Record<string, unknown> = {};
  for (const key of missing) {
    if (owned[key] !== undefined) fill[key] = owned[key];
  }
  return fill;
};
