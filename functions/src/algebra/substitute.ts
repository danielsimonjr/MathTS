import { factory } from '../utils/factory.js';
import { isNode } from '../utils/is.js';
import type { MathNode } from '../utils/node.js';
import type { TypedFunction } from '../core/function/typed.js';

interface SubstituteDependencies {
  typed: TypedFunction;
  parse: (expr: string) => MathNode;
  resolve: TypedFunction;
  simplifyConstant: (node: MathNode, options?: unknown) => MathNode;
}

const name = 'substitute';
const dependencies = ['typed', 'parse', 'resolve', 'simplifyConstant'] as const;

export const createSubstitute = /* #__PURE__ */ factory(
  name,
  dependencies as unknown as string[],
  ({ typed, parse, resolve, simplifyConstant }: SubstituteDependencies) => {
    function normalizeScope(scope: Record<string, unknown>): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(scope)) {
        if (typeof value === 'number' || typeof value === 'boolean' || isNode(value)) {
          out[key] = value;
        } else if (typeof value === 'string') {
          try {
            out[key] = parse(value);
          } catch {
            out[key] = value;
          }
        } else {
          out[key] = value;
        }
      }
      return out;
    }

    function substituteExpr(expr: string, scope: Record<string, unknown>): MathNode {
      const node = parse(expr);
      const resolved = resolve(node, normalizeScope(scope)) as MathNode;
      return simplifyConstant(resolved);
    }

    return typed(name, {
      'string, Object': substituteExpr,
    });
  }
);
