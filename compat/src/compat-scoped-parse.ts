/**
 * Instance parse wiring that matches mathjs sized literals (#1786).
 * `functions` `createScopedParse` always binds module `numeric`, ignoring
 * per-instance parse-scope overrides in `buildEvaluatorScope()`.
 */
import { createParse } from '@danielsimonjr/mathts-expression';
import { buildCompatExpressionNodeConstructors } from './compat-expression-nodes.js';

type ParseScopeNumeric = (value: unknown, outputType?: string) => unknown;

const PARSE_NODE_KEYS = [
  'Node',
  'SymbolNode',
  'AccessorNode',
  'ArrayNode',
  'AssignmentNode',
  'BlockNode',
  'ConditionalNode',
  'ConstantNode',
  'FunctionAssignmentNode',
  'FunctionNode',
  'IndexNode',
  'ObjectNode',
  'OperatorNode',
  'ParenthesisNode',
  'RangeNode',
  'RelationalNode',
] as const;

/** Build an instance `parse` with mathjs literal rules via {@link parseScopeNumeric}. */
export function createCompatScopedParse(
  mathWithTransform: Record<string, unknown>,
  instance: Record<string, unknown>,
  _mathjsSyntax: boolean,
  parseScopeNumeric: ParseScopeNumeric,
  decimalLiteral?: (value: unknown) => unknown,
  nodeConstructors?: Record<string, unknown>
): ReturnType<typeof createParse> {
  const parseNumeric =
    decimalLiteral === undefined
      ? (value: string, type: string) => parseScopeNumeric(value, type)
      : (value: string, type: string) => {
          const parsed = parseScopeNumeric(value, type);
          return type === 'BigNumber' ? decimalLiteral(parsed) : parsed;
        };
  const nodes =
    nodeConstructors ??
    (buildCompatExpressionNodeConstructors(mathWithTransform) as Record<string, unknown>);
  const exprNodes: Record<string, unknown> = {};
  for (const key of PARSE_NODE_KEYS) {
    if (typeof nodes[key] === 'function') exprNodes[key] = nodes[key];
  }
  return createParse({
    typed: instance.typed,
    numeric: parseNumeric,
    config: instance.config,
    subset: instance.subset,
    matrix: instance.matrix,
    size: instance.size,
    isBounded: instance.isBounded,
    ResultSet: instance.ResultSet,
    Unit: instance.Unit,
    ...exprNodes,
    mathWithTransform,
    mathjsSyntax: true,
  } as Parameters<typeof createParse>[0]);
}
