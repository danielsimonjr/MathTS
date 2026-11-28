import {
  isConstantNode,
  isFunctionNode,
  isOperatorNode,
  isParenthesisNode,
} from '@danielsimonjr/mathts-functions';

export { isConstantNode, isSymbolNode as isVariableNode } from '@danielsimonjr/mathts-functions';

export function isNumericNode(x) {
  return isConstantNode(x) || (isOperatorNode(x) && x.isUnary() && isConstantNode(x.args[0]));
}

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