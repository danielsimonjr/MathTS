import {
  isConstantNode,
  isFunctionNode,
  isOperatorNode,
  isParenthesisNode,
} from '@danielsimonjr/mathts-functions';

export { isConstantNode, isSymbolNode as isVariableNode } from '@danielsimonjr/mathts-functions';

/** True when `x` is a constant or a unary-minus constant node. */
export function isNumericNode(x) {
  return isConstantNode(x) || (isOperatorNode(x) && x.isUnary() && isConstantNode(x.args[0]));
}

/** True when `x` is a tree of constant nodes (no free symbols). */
export function isConstantExpression(x) {
  if (isConstantNode(x)) {
    return true;
  }
  if ((isFunctionNode(x) || isOperatorNode(x)) && x.args.every(isConstantExpression)) {
    return true;
  }
  if (isParenthesisNode(x) && isConstantExpression(x.content)) {
    return true;
  }
  return false;
}
