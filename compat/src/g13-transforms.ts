/**
 * G13 (#1572): the `expression.transform` functions of the compat instance.
 *
 * mathjs builds one transform function per expression-language factory and
 * places them on `math.expression.transform` (the factory's namespace), while
 * `math.expression.mathWithTransform` is the full function namespace with those
 * transforms in place of the plain functions. Compat builds the same 26
 * transform functions from the `@danielsimonjr/mathts-expression` transform
 * factories, resolving each factory's dependencies (its base function, `typed`,
 * `Index`, …) against the compat instance — the same injection mathjs performs
 * with its own factory loader.
 */

import {
  buildMathjsStdTransform,
  buildMathjsVarianceTransform,
} from './mathjs-dim-statistics-transform.js';
import {
  createAndTransform,
  createApplyTransform,
  createBitAndTransform,
  createBitOrTransform,
  createColumnTransform,
  createConcatTransform,
  createCumSumTransform,
  createDiffTransform,
  createFilterTransform,
  createForEachTransform,
  createIndexTransform,
  createMapTransform,
  createMapSlicesTransform,
  createMaxTransform,
  createMeanTransform,
  createMinTransform,
  createNullishTransform,
  createOrTransform,
  createPrintTransform,
  createQuantileSeqTransform,
  createRangeTransform,
  createRowTransform,
  createStdTransform,
  createSubsetTransform,
  createSumTransform,
  createVarianceTransform,
} from '@danielsimonjr/mathts-expression';

/** The 26 transform keys of mathjs 15.3.0 `math.expression.transform` (#1572). */
export const TRANSFORM_KEYS = [
  'and',
  'apply',
  'bitAnd',
  'bitOr',
  'column',
  'concat',
  'cumsum',
  'diff',
  'filter',
  'forEach',
  'index',
  'map',
  'mapSlices',
  'max',
  'mean',
  'min',
  'nullish',
  'or',
  'print',
  'quantileSeq',
  'range',
  'row',
  'std',
  'subset',
  'sum',
  'variance',
] as const;

type TransformFactory = ((deps: Record<string, unknown>) => unknown) & {
  fn: string;
  dependencies: readonly string[];
};

const TRANSFORM_FACTORIES: readonly TransformFactory[] = [
  createAndTransform,
  createApplyTransform,
  createBitAndTransform,
  createBitOrTransform,
  createColumnTransform,
  createConcatTransform,
  createCumSumTransform,
  createDiffTransform,
  createFilterTransform,
  createForEachTransform,
  createIndexTransform,
  createMapTransform,
  createMapSlicesTransform,
  createMaxTransform,
  createMeanTransform,
  createMinTransform,
  createNullishTransform,
  createOrTransform,
  createPrintTransform,
  createQuantileSeqTransform,
  createRangeTransform,
  createRowTransform,
  createStdTransform,
  createSubsetTransform,
  createSumTransform,
  createVarianceTransform,
] as unknown as readonly TransformFactory[];

/**
 * Build the transform functions against the instance. The instance supplies
 * every dependency (`typed`, the base functions, `Index`,
 * `getMatrixDataType`), so the transforms share the instance's live functions
 * exactly like mathjs. Dependencies the instance does not carry (a bare
 * `create({})` has no functions at all) skip that transform, like the factory
 * scope wiring in `functions/src/factories/evaluate.ts`.
 */
export function buildExpressionTransforms(
  instance: Record<string, unknown>
): Record<string, unknown> {
  const transforms: Record<string, unknown> = {};
  for (const create of TRANSFORM_FACTORIES) {
    if (create.fn === 'std') {
      const stdTransform = buildMathjsStdTransform(instance);
      if (stdTransform !== undefined) transforms.std = stdTransform;
      continue;
    }
    if (create.fn === 'variance') {
      const varianceTransform = buildMathjsVarianceTransform(instance);
      if (varianceTransform !== undefined) transforms.variance = varianceTransform;
      continue;
    }
    const missing = create.dependencies.filter(
      (dependency) => typeof instance[dependency] === 'undefined'
    );
    if (missing.length > 0) continue;
    transforms[create.fn] = create(instance);
  }
  return transforms;
}

/**
 * mathjs resolves the former `apply` name of `mapSlices` to the `mapSlices`
 * transform inside `mathWithTransform` (`lazy(withTransform, former, () =>
 * namespace[name])`), while `expression.transform.apply` is its own factory
 * instance. Mirror that: `apply` reads the `mapSlices` transform.
 */
export function mathWithTransformValue(transforms: Record<string, unknown>, key: string): unknown {
  if (key === 'apply') return transforms.mapSlices;
  return transforms[key];
}

/**
 * Instance names that mathjs keeps out of `math.expression.mathWithTransform`:
 * node classes, error classes, type constructors and type guards, the instance
 * machinery (`chain`, `create`, `emit`, `expression`, `factory`, `import`,
 * `on`/`off`/`once`), and the classes that carry no expression function. These
 * come from mathjs 15.3.0's own factory metadata (classes and the names of
 * `unsafe`), pinned by the G13 parity test.
 */
export const MATH_WITH_TRANSFORM_EXCLUDED: ReadonlySet<string> = new Set([
  'AccessorNode',
  'ArgumentsError',
  'ArrayNode',
  'AssignmentNode',
  'BigNumber',
  'BlockNode',
  'Chain',
  'Complex',
  'ConditionalNode',
  'ConstantNode',
  'DenseMatrix',
  'DimensionError',
  'FibonacciHeap',
  'Fraction',
  'FunctionAssignmentNode',
  'FunctionNode',
  'Help',
  'ImmutableDenseMatrix',
  'Index',
  'IndexError',
  'Matrix',
  'Node',
  'ObjectNode',
  'OperatorNode',
  'ParenthesisNode',
  'Parser',
  'Range',
  'RangeNode',
  'RelationalNode',
  'ResultSet',
  'Spa',
  'SparseMatrix',
  'SymbolNode',
  'Unit',
  'chain',
  'create',
  'emit',
  'expression',
  'factory',
  'import',
  'isAccessorNode',
  'isArray',
  'isArrayNode',
  'isAssignmentNode',
  'isBigInt',
  'isBigNumber',
  'isBlockNode',
  'isBoolean',
  'isChain',
  'isCollection',
  'isComplex',
  'isConditionalNode',
  'isConstantNode',
  'isDate',
  'isDenseMatrix',
  'isFraction',
  'isFunction',
  'isFunctionAssignmentNode',
  'isFunctionNode',
  'isHelp',
  'isIndex',
  'isIndexNode',
  'isMap',
  'isMatrix',
  'isNode',
  'isNull',
  'isNumber',
  'isObject',
  'isObjectNode',
  'isObjectWrappingMap',
  'isOperatorNode',
  'isParenthesisNode',
  'isPartitionedMap',
  'isRange',
  'isRangeNode',
  'isRegExp',
  'isRelationalNode',
  'isResultSet',
  'isSparseMatrix',
  'isString',
  'isSymbolNode',
  'isUndefined',
  'isUnit',
  'off',
  'on',
  'once',
]);
