/**
 * @danielsimonjr/mathts-expression
 *
 * Expression parsing and evaluation for MathTS.
 *
 * @packageDocumentation
 */

export * from './types.js';
export * from './keywords.js';
export * from './operators.js';
export * from './parse.js';
export * from './Parser.js';
export { createParser } from './function/parser.js';
export * from './Help.js';
export * from './compiler/index.js';
export * from './evaluator/index.js';

// Rendering generators (alongside node .toTex()/.toHTML()): MathML, Markdown,
// SVG charts, and self-contained HTML document assembly. Zero external deps.
// `toMathML` is a per-node method (like `toTex`); these are the supporting
// helpers for wrapping a node's fragment in a <math> document / a parse error.
export { mathMLDocument, mathMLError, escapeMathML, toMathMLSymbol } from './utils/mathml.js';
export { markdownToHtml } from './markdown.js';
export { renderChart } from './svg.js';
export type { ChartSpec } from './svg.js';
export { toHTML, toCSS } from './html.js';
export type { RenderDoc, RenderCell, ToHtmlOptions } from './html.js';

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
