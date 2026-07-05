// list of identifiers of nodes in order of their precedence
// also contains information about left/right associativity
// and which other operator the operator is associative with
// Example:
// addition is associative with addition and subtraction, because:
// (a+b)+c=a+(b+c)
// (a+b)-c=a+(b-c)
//
// postfix operators are left associative, prefix operators
// are right associative
//
// It's also possible to set the following properties:
// latexParens: if set to false, this node doesn't need to be enclosed
//              in parentheses when using LaTeX
// latexLeftParens: if set to false, this !OperatorNode's!
//                  left argument doesn't need to be enclosed
//                  in parentheses
// latexRightParens: the same for the right argument

/** Precedence/associativity metadata for a single operator identifier. */
interface OperatorProperty {
  op?: string;
  associativity?: string;
  associativeWith?: string[];
  latexParens?: boolean;
  latexLeftParens?: boolean;
  latexRightParens?: boolean;
}

export const properties: Array<Record<string, OperatorProperty>> = [
  {
    // assignment
    AssignmentNode: {},
    FunctionAssignmentNode: {},
  },
  {
    // conditional expression
    ConditionalNode: {
      latexLeftParens: false,
      latexRightParens: false,
      latexParens: false,
      // conditionals don't need parentheses in LaTeX because
      // they are 2 dimensional
    },
  },
  {
    // logical or
    'OperatorNode:or': {
      op: 'or',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // logical xor
    'OperatorNode:xor': {
      op: 'xor',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // logical and
    'OperatorNode:and': {
      op: 'and',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // bitwise or
    'OperatorNode:bitOr': {
      op: '|',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // bitwise xor
    'OperatorNode:bitXor': {
      op: '^|',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // bitwise and
    'OperatorNode:bitAnd': {
      op: '&',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // relational operators
    'OperatorNode:equal': {
      op: '==',
      associativity: 'left',
      associativeWith: [],
    },
    'OperatorNode:unequal': {
      op: '!=',
      associativity: 'left',
      associativeWith: [],
    },
    'OperatorNode:smaller': {
      op: '<',
      associativity: 'left',
      associativeWith: [],
    },
    'OperatorNode:larger': {
      op: '>',
      associativity: 'left',
      associativeWith: [],
    },
    'OperatorNode:smallerEq': {
      op: '<=',
      associativity: 'left',
      associativeWith: [],
    },
    'OperatorNode:largerEq': {
      op: '>=',
      associativity: 'left',
      associativeWith: [],
    },
    RelationalNode: {
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // bitshift operators
    'OperatorNode:leftShift': {
      op: '<<',
      associativity: 'left',
      associativeWith: [],
    },
    'OperatorNode:rightArithShift': {
      op: '>>',
      associativity: 'left',
      associativeWith: [],
    },
    'OperatorNode:rightLogShift': {
      op: '>>>',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // unit conversion
    'OperatorNode:to': {
      op: 'to',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // range
    RangeNode: {},
  },
  {
    // addition, subtraction
    'OperatorNode:add': {
      op: '+',
      associativity: 'left',
      associativeWith: ['OperatorNode:add', 'OperatorNode:subtract'],
    },
    'OperatorNode:subtract': {
      op: '-',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // multiply, divide, modulus
    'OperatorNode:multiply': {
      op: '*',
      associativity: 'left',
      associativeWith: [
        'OperatorNode:multiply',
        'OperatorNode:divide',
        'Operator:dotMultiply',
        'Operator:dotDivide',
      ],
    },
    'OperatorNode:divide': {
      op: '/',
      associativity: 'left',
      associativeWith: [],
      latexLeftParens: false,
      latexRightParens: false,
      latexParens: false,
      // fractions don't require parentheses because
      // they're 2 dimensional, so parens aren't needed
      // in LaTeX
    },
    'OperatorNode:dotMultiply': {
      op: '.*',
      associativity: 'left',
      associativeWith: [
        'OperatorNode:multiply',
        'OperatorNode:divide',
        'OperatorNode:dotMultiply',
        'OperatorNode:doDivide',
      ],
    },
    'OperatorNode:dotDivide': {
      op: './',
      associativity: 'left',
      associativeWith: [],
    },
    'OperatorNode:mod': {
      op: 'mod',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // Repeat multiplication for implicit multiplication
    'OperatorNode:multiply': {
      associativity: 'left',
      associativeWith: [
        'OperatorNode:multiply',
        'OperatorNode:divide',
        'Operator:dotMultiply',
        'Operator:dotDivide',
      ],
    },
  },
  {
    // unary prefix operators
    'OperatorNode:unaryPlus': {
      op: '+',
      associativity: 'right',
    },
    'OperatorNode:unaryMinus': {
      op: '-',
      associativity: 'right',
    },
    'OperatorNode:bitNot': {
      op: '~',
      associativity: 'right',
    },
    'OperatorNode:not': {
      op: 'not',
      associativity: 'right',
    },
  },
  {
    // exponentiation
    'OperatorNode:pow': {
      op: '^',
      associativity: 'right',
      associativeWith: [],
      latexRightParens: false,
      // the exponent doesn't need parentheses in
      // LaTeX because it's 2 dimensional
      // (it's on top)
    },
    'OperatorNode:dotPow': {
      op: '.^',
      associativity: 'right',
      associativeWith: [],
    },
  },
  {
    // nullish coalescing
    'OperatorNode:nullish': {
      op: '??',
      associativity: 'left',
      associativeWith: [],
    },
  },
  {
    // factorial
    'OperatorNode:factorial': {
      op: '!',
      associativity: 'left',
    },
  },
  {
    // matrix transpose
    'OperatorNode:ctranspose': {
      op: "'",
      associativity: 'left',
    },
  },
];

/**
 * Get the operator associated with a function name.
 * Returns a string with the operator symbol, or null if the
 * input is not the name of a function associated with an
 * operator.
 *
 * @param {string} Function name
 * @return {string | null} Associated operator symbol, if any
 */
export function getOperator(fn: string): string | null {
  const identifier = 'OperatorNode:' + fn;
  for (const group of properties) {
    if (identifier in group) {
      return group[identifier].op ?? null;
    }
  }
  return null;
}
