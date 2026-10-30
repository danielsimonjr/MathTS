/**
 * @danielsimonjr/mathts-expression
 *
 * Expression parsing and evaluation for MathTS.
 *
 * @packageDocumentation
 */

export * from './types.js';
export type { MathNode, StringOptions } from './node/Node.js';
export * from './keywords.js';
export * from './operators.js';
export * from './parse.js';
export * from './Parser.js';
export { createParser } from './function/parser.js';
export * from './Help.js';
export { embeddedDocs } from './embeddedDocs/embeddedDocs.js';
export * from './compiler/index.js';
export * from './evaluator/index.js';

// MathML serialization (alongside node .toTex()/.toHTML()): `toMathML` is a
// per-node method; these are the helpers to wrap a node's fragment in a <math>
// document / report a parse error. (Document/chart/markdown rendering lives in
// the workbook package, where the .mtsw document model is.)
export { mathMLDocument, mathMLError, escapeMathML, toMathMLSymbol } from './utils/mathml.js';

// Node constructors (for bootstrapping parse outside the expression package)
export { createNode } from './node/Node.js';
export { createAccessorNode } from './node/AccessorNode.js';
export { createArrayNode } from './node/ArrayNode.js';
export { createAssignmentNode } from './node/AssignmentNode.js';
export { createBlockNode } from './node/BlockNode.js';
export { createConditionalNode } from './node/ConditionalNode.js';
export { createConstantNode } from './node/ConstantNode.js';
export { createFunctionAssignmentNode } from './node/FunctionAssignmentNode.js';
export { createFunctionNode } from './node/FunctionNode.js';
export { createIndexNode } from './node/IndexNode.js';
export { createObjectNode } from './node/ObjectNode.js';
export { createOperatorNode } from './node/OperatorNode.js';
export { createParenthesisNode } from './node/ParenthesisNode.js';
export { createRangeNode } from './node/RangeNode.js';
export { createRelationalNode } from './node/RelationalNode.js';
export { createSymbolNode } from './node/SymbolNode.js';
// One public entry for the shared string-index helpers. functions subset
// imports getStringSubset from this barrel (functions → expression is allowed).
export { getStringSubset, setStringSubset } from './node/utils/stringSubset.js';
export type { IndexLike } from './node/utils/stringSubset.js';

// Scalar trees for numeric ExprNode lowering (UPT). No formula string is parsed.
export {
  createScalarBuilder,
  SCALAR_FUNCTIONS,
  SCALAR_FUNCTION_LOWERING,
  ScalarBuildError,
} from './scalar-builder.js';
export type {
  LoweredScalarFn,
  ScalarBuilder,
  ScalarFunctionName,
  ScalarNode,
  ScalarOperator,
} from './scalar-builder.js';
export {
  forEachScalar,
  mapScalar,
  scalarSize,
  scalarDepth,
  scalarComplexity,
  scalarSymbols,
  scalarCanonical,
  scalarCanonicalKey,
  scalarEquals,
} from './scalar-structure.js';
export type { ScalarComplexityWeights } from './scalar-structure.js';
export { enumerateScalars, scalarGrammarAccepts } from './scalar-enumerate.js';
export type { EnumerationBudget, EnumerationStop, ScalarGrammar } from './scalar-enumerate.js';

// Expression-language transforms (1-based indices/dims, lazy logical operators).
// Each factory takes its base function as an injected dependency; hosts assemble
// them into their expression evaluation scope (see functions/factories/evaluate).
export * from './transform/index.js';
