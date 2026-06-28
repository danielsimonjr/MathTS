import { describe, it, expect } from 'vitest';
import {
  properties,
  getPrecedence,
  getAssociativity,
  isAssociativeWith,
  getOperator,
} from '../src/operators.js';

// ─── Minimal node stubs ───────────────────────────────────────────────────────
// These replicate just enough of the Node interface for the operator utilities.

function opNode(fn: string, args: unknown[] = [], implicit = false) {
  return {
    type: 'OperatorNode',
    isOperatorNode: true,
    fn,
    args,
    implicit,
    getIdentifier() {
      return `OperatorNode:${fn}`;
    },
    getContent() {
      return this;
    },
  };
}

function _constantNode(value: unknown) {
  return {
    type: 'ConstantNode',
    isConstantNode: true,
    value,
    getIdentifier() {
      return 'ConstantNode';
    },
    getContent() {
      return this;
    },
  };
}

function _symbolNode(name: string) {
  return {
    type: 'SymbolNode',
    isSymbolNode: true,
    name,
    getIdentifier() {
      return 'SymbolNode';
    },
    getContent() {
      return this;
    },
  };
}

function _relationalNode() {
  return {
    type: 'RelationalNode',
    isRelationalNode: true,
    getIdentifier() {
      return 'RelationalNode';
    },
    getContent() {
      return this;
    },
  };
}

function assignmentNode() {
  return {
    type: 'AssignmentNode',
    isAssignmentNode: true,
    getIdentifier() {
      return 'AssignmentNode';
    },
    getContent() {
      return this;
    },
  };
}

function conditionalNode() {
  return {
    type: 'ConditionalNode',
    isConditionalNode: true,
    getIdentifier() {
      return 'ConditionalNode';
    },
    getContent() {
      return this;
    },
  };
}

function parenthesisNode(inner: unknown) {
  return {
    type: 'ParenthesisNode',
    isParenthesisNode: true,
    content: inner,
    getIdentifier() {
      return 'ParenthesisNode';
    },
    getContent() {
      return inner;
    },
  };
}

// ─── properties array structure ───────────────────────────────────────────────

describe('operators - properties array', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(properties)).toBe(true);
    expect(properties.length).toBeGreaterThan(0);
  });

  it('each entry is an object', () => {
    for (const entry of properties) {
      expect(typeof entry).toBe('object');
      expect(entry).not.toBeNull();
    }
  });

  it('contains entry for AssignmentNode at the first group', () => {
    expect('AssignmentNode' in properties[0]).toBe(true);
  });

  it('contains an entry for OperatorNode:add with correct op', () => {
    const found = properties.find((group) => 'OperatorNode:add' in group);
    expect(found).toBeDefined();
    expect(found!['OperatorNode:add'].op).toBe('+');
  });

  it('contains an entry for OperatorNode:multiply with correct op', () => {
    const found = properties.find((group) => 'OperatorNode:multiply' in group);
    expect(found).toBeDefined();
    expect(found!['OperatorNode:multiply'].op).toBe('*');
  });

  it('contains an entry for OperatorNode:pow with correct op', () => {
    const found = properties.find((group) => 'OperatorNode:pow' in group);
    expect(found).toBeDefined();
    expect(found!['OperatorNode:pow'].op).toBe('^');
  });

  it('contains entry for OperatorNode:divide', () => {
    const found = properties.find((group) => 'OperatorNode:divide' in group);
    expect(found).toBeDefined();
    expect(found!['OperatorNode:divide'].op).toBe('/');
  });

  it('contains entry for OperatorNode:factorial', () => {
    const found = properties.find((group) => 'OperatorNode:factorial' in group);
    expect(found).toBeDefined();
    expect(found!['OperatorNode:factorial'].op).toBe('!');
  });

  it('contains entry for OperatorNode:or with correct op', () => {
    const found = properties.find((group) => 'OperatorNode:or' in group);
    expect(found).toBeDefined();
    expect(found!['OperatorNode:or'].op).toBe('or');
  });

  it('contains entry for RelationalNode', () => {
    const found = properties.find((group) => 'RelationalNode' in group);
    expect(found).toBeDefined();
  });

  it('contains entry for OperatorNode:mod', () => {
    const found = properties.find((group) => 'OperatorNode:mod' in group);
    expect(found).toBeDefined();
    expect(found!['OperatorNode:mod'].op).toBe('mod');
  });

  it('contains entry for OperatorNode:unaryMinus', () => {
    const found = properties.find((group) => 'OperatorNode:unaryMinus' in group);
    expect(found).toBeDefined();
    expect(found!['OperatorNode:unaryMinus'].op).toBe('-');
  });
});

// ─── getPrecedence ────────────────────────────────────────────────────────────

describe('getPrecedence', () => {
  it('returns a number for OperatorNode:add', () => {
    const node = opNode('add');
    const prec = getPrecedence(node, 'auto', 'hide', null);
    expect(typeof prec).toBe('number');
  });

  it('returns a number for OperatorNode:multiply', () => {
    const node = opNode('multiply');
    const prec = getPrecedence(node, 'auto', 'hide', null);
    expect(typeof prec).toBe('number');
  });

  it('multiply has higher precedence than add', () => {
    const mul = opNode('multiply');
    const add = opNode('add');
    const mulPrec = getPrecedence(mul, 'auto', 'hide', null);
    const addPrec = getPrecedence(add, 'auto', 'hide', null);
    expect(mulPrec).toBeGreaterThan(addPrec!);
  });

  it('pow has higher precedence than multiply', () => {
    const pow = opNode('pow');
    const mul = opNode('multiply');
    const powPrec = getPrecedence(pow, 'auto', 'hide', null);
    const mulPrec = getPrecedence(mul, 'auto', 'hide', null);
    expect(powPrec).toBeGreaterThan(mulPrec!);
  });

  it('returns null for an unknown node type', () => {
    const node = {
      type: 'UnknownNode',
      getIdentifier() {
        return 'UnknownNode';
      },
      getContent() {
        return this;
      },
    };
    const prec = getPrecedence(node, 'auto', 'hide', null);
    expect(prec).toBeNull();
  });

  it('assignment has lower precedence than addition', () => {
    const assign = assignmentNode();
    const add = opNode('add');
    const assignPrec = getPrecedence(assign, 'auto', 'hide', null);
    const addPrec = getPrecedence(add, 'auto', 'hide', null);
    // Both should be non-null numbers
    expect(assignPrec).not.toBeNull();
    expect(addPrec).not.toBeNull();
    expect(assignPrec!).toBeLessThan(addPrec!);
  });

  it('works in keep mode without unwrapping parentheses', () => {
    const inner = opNode('add');
    const paren = parenthesisNode(inner);
    // In keep mode, the parenthesis node itself is looked up, not the inner
    const prec = getPrecedence(paren, 'keep', 'hide', null);
    // ParenthesisNode is not in properties, so should be null
    expect(prec).toBeNull();
  });

  it('works in auto mode by unwrapping parentheses', () => {
    const inner = opNode('add');
    const paren = parenthesisNode(inner);
    // In auto mode, parenthesis is stripped, should find add's precedence
    const prec = getPrecedence(paren, 'auto', 'hide', null);
    const addPrec = getPrecedence(opNode('add'), 'auto', 'hide', null);
    expect(prec).toBe(addPrec);
  });
});

// ─── getAssociativity ─────────────────────────────────────────────────────────

describe('getAssociativity', () => {
  it('addition is left-associative', () => {
    const node = opNode('add');
    expect(getAssociativity(node, 'auto')).toBe('left');
  });

  it('subtraction is left-associative', () => {
    const node = opNode('subtract');
    expect(getAssociativity(node, 'auto')).toBe('left');
  });

  it('pow is right-associative', () => {
    const node = opNode('pow');
    expect(getAssociativity(node, 'auto')).toBe('right');
  });

  it('unaryMinus is right-associative', () => {
    const node = opNode('unaryMinus');
    expect(getAssociativity(node, 'auto')).toBe('right');
  });

  it('multiply is left-associative', () => {
    const node = opNode('multiply');
    expect(getAssociativity(node, 'auto')).toBe('left');
  });

  it('factorial is left-associative', () => {
    const node = opNode('factorial');
    expect(getAssociativity(node, 'auto')).toBe('left');
  });

  it('returns null for unknown node type', () => {
    const node = {
      type: 'UnknownNode',
      getIdentifier() {
        return 'UnknownNode';
      },
      getContent() {
        return this;
      },
    };
    expect(getAssociativity(node, 'auto')).toBeNull();
  });

  it('ConditionalNode returns null (no associativity defined)', () => {
    const node = conditionalNode();
    // ConditionalNode is in properties but has no associativity
    expect(getAssociativity(node, 'auto')).toBeNull();
  });
});

// ─── isAssociativeWith ────────────────────────────────────────────────────────

describe('isAssociativeWith', () => {
  it('add is associative with add', () => {
    const a = opNode('add');
    const b = opNode('add');
    const result = isAssociativeWith(a, b, 'auto');
    expect(result).toBe(true);
  });

  it('add is associative with subtract', () => {
    const a = opNode('add');
    const b = opNode('subtract');
    const result = isAssociativeWith(a, b, 'auto');
    expect(result).toBe(true);
  });

  it('multiply is associative with divide', () => {
    const a = opNode('multiply');
    const b = opNode('divide');
    const result = isAssociativeWith(a, b, 'auto');
    expect(result).toBe(true);
  });

  it('pow is not associative with anything', () => {
    const a = opNode('pow');
    const b = opNode('pow');
    const result = isAssociativeWith(a, b, 'auto');
    // pow has associativeWith: [] which is empty
    expect(result).toBe(false);
  });

  it('returns null for unknown node type', () => {
    const a = {
      type: 'UnknownNode',
      getIdentifier() {
        return 'UnknownNode';
      },
      getContent() {
        return this;
      },
    };
    const b = opNode('add');
    const result = isAssociativeWith(a, b, 'auto');
    expect(result).toBeNull();
  });

  it('or has empty associativeWith, returns false for or-or', () => {
    const a = opNode('or');
    const b = opNode('or');
    const result = isAssociativeWith(a, b, 'auto');
    expect(result).toBe(false);
  });
});

// ─── getOperator ──────────────────────────────────────────────────────────────

describe('getOperator', () => {
  it('returns "+" for "add"', () => {
    expect(getOperator('add')).toBe('+');
  });

  it('returns "-" for "subtract"', () => {
    expect(getOperator('subtract')).toBe('-');
  });

  it('returns "*" for "multiply"', () => {
    expect(getOperator('multiply')).toBe('*');
  });

  it('returns "/" for "divide"', () => {
    expect(getOperator('divide')).toBe('/');
  });

  it('returns "^" for "pow"', () => {
    expect(getOperator('pow')).toBe('^');
  });

  it('returns "!" for "factorial"', () => {
    expect(getOperator('factorial')).toBe('!');
  });

  it('returns "mod" for "mod"', () => {
    expect(getOperator('mod')).toBe('mod');
  });

  it('returns "or" for "or"', () => {
    expect(getOperator('or')).toBe('or');
  });

  it('returns "and" for "and"', () => {
    expect(getOperator('and')).toBe('and');
  });

  it('returns "not" for "not"', () => {
    expect(getOperator('not')).toBe('not');
  });

  it('returns "??" for "nullish"', () => {
    expect(getOperator('nullish')).toBe('??');
  });

  it('returns null for unknown function name', () => {
    expect(getOperator('unknownFn')).toBeNull();
    expect(getOperator('sqrt')).toBeNull();
    expect(getOperator('')).toBeNull();
  });

  it('returns "<" for "smaller"', () => {
    expect(getOperator('smaller')).toBe('<');
  });

  it('returns ">" for "larger"', () => {
    expect(getOperator('larger')).toBe('>');
  });

  it('returns "==" for "equal"', () => {
    expect(getOperator('equal')).toBe('==');
  });

  it('returns "!=" for "unequal"', () => {
    expect(getOperator('unequal')).toBe('!=');
  });
});
