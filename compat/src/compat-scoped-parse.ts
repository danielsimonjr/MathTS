/**
 * Instance parse wiring that matches mathjs sized literals (#1786).
 * `functions` `createScopedParse` always binds module `numeric`, ignoring
 * per-instance parse-scope overrides in `buildEvaluatorScope()`.
 */
import { createParse } from '@danielsimonjr/mathts-expression';
const PARSE_NODE_KEYS = [
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
  'SymbolNode',
] as const;

type ParseScopeNumeric = (value: unknown, outputType?: string) => unknown;

/** Build an instance `parse` with mathjs literal rules via {@link parseScopeNumeric}. */
export function createCompatScopedParse(
  mathWithTransform: Record<string, unknown>,
  instance: Record<string, unknown>,
  mathjsSyntax: boolean,
  parseScopeNumeric: ParseScopeNumeric,
  decimalLiteral?: (value: unknown) => unknown
): ReturnType<typeof createParse> {
  const parseNumeric =
    decimalLiteral === undefined
      ? (value: string, type: string) => parseScopeNumeric(value, type)
      : (value: string, type: string) => {
          const parsed = parseScopeNumeric(value, type);
          return type === 'BigNumber' ? decimalLiteral(parsed) : parsed;
        };
  const nodeDeps: Record<string, unknown> = {};
  for (const key of PARSE_NODE_KEYS) {
    nodeDeps[key] = instance[key];
  }
  return createParse({
    typed: instance.typed,
    numeric: parseNumeric,
    config: instance.config,
    ...nodeDeps,
    mathWithTransform,
    mathjsSyntax,
  } as Parameters<typeof createParse>[0]);
}
