/**
 * Tree-walking AST compiler/evaluator for MathTS expressions.
 *
 * This module provides a standalone evaluator that walks parsed AST nodes
 * and evaluates them against a math scope. It does not depend on the
 * factory-injected _compile methods on each Node, making it usable
 * without bootstrapping the full mathjs dependency injection system.
 *
 * The scope uses a Map-like interface (has/get/set) consistent with
 * the mathjs scope convention (ObjectWrappingMap, PartitionedMap, etc.).
 *
 * @packageDocumentation
 */

import { ObjectWrappingMap } from '../utils/map.js';
import { getSafeProperty, setSafeProperty, getSafeMethod } from '../utils/customs.js';

/**
 * A Map-like scope with has/get/set methods.
 */
export interface Scope {
  has(key: string): boolean;
  get(key: string): any;
  set(key: string, value: any): void;
}

/**
 * A compiled expression that can be evaluated with an optional user scope.
 */
export interface CompiledExpression {
  evaluate(scope?: Record<string, any> | Scope): any;
}

/**
 * Compile an AST node into a CompiledExpression.
 *
 * @param node - Parsed AST node (from createParse)
 * @param mathScope - Math namespace with functions and constants (e.g., add, sin, pi)
 * @returns CompiledExpression with an evaluate method
 *
 * @example
 * ```ts
 * const node = parse('2 + 3');
 * const compiled = compile(node, { add: (a, b) => a + b });
 * compiled.evaluate(); // 5
 * ```
 */
export function compile(node: any, mathScope: Record<string, any>): CompiledExpression {
  // Pre-compile the node tree into a closure
  const evalFn = compileNode(node, mathScope, {});

  return {
    evaluate(userScope?: Record<string, any> | Scope): any {
      let scope: Scope;
      if (!userScope) {
        scope = new ObjectWrappingMap({}) as unknown as Scope;
      } else if (typeof (userScope as Scope).has === 'function') {
        scope = userScope as Scope;
      } else {
        scope = new ObjectWrappingMap(userScope as Record<string, any>) as unknown as Scope;
      }
      return evalFn(scope, {}, undefined);
    },
  };
}

/**
 * Internal type for compiled node evaluation functions.
 * Matches the mathjs _compile signature: (scope, args, context) => value
 */
type EvalFunction = (scope: Scope, args: Record<string, any>, context: any) => any;

/**
 * Compile a single AST node into an evaluation function.
 *
 * @param node - AST node
 * @param math - Math namespace
 * @param argNames - Map of argument names (for FunctionAssignment params)
 * @returns Evaluation function
 */
function compileNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  if (node.isConstantNode) {
    return compileConstantNode(node);
  }
  if (node.isSymbolNode) {
    return compileSymbolNode(node, math, argNames);
  }
  if (node.isOperatorNode) {
    return compileOperatorNode(node, math, argNames);
  }
  if (node.isFunctionNode) {
    return compileFunctionNode(node, math, argNames);
  }
  if (node.isParenthesisNode) {
    return compileNode(node.content, math, argNames);
  }
  if (node.isArrayNode) {
    return compileArrayNode(node, math, argNames);
  }
  if (node.isAssignmentNode) {
    return compileAssignmentNode(node, math, argNames);
  }
  if (node.isBlockNode) {
    return compileBlockNode(node, math, argNames);
  }
  if (node.isConditionalNode) {
    return compileConditionalNode(node, math, argNames);
  }
  if (node.isObjectNode) {
    return compileObjectNode(node, math, argNames);
  }
  if (node.isRangeNode) {
    return compileRangeNode(node, math, argNames);
  }
  if (node.isRelationalNode) {
    return compileRelationalNode(node, math, argNames);
  }
  if (node.isFunctionAssignmentNode) {
    return compileFunctionAssignmentNode(node, math, argNames);
  }
  if (node.isAccessorNode) {
    return compileAccessorNode(node, math, argNames);
  }
  if (node.isIndexNode) {
    return compileIndexNode(node, math, argNames);
  }

  throw new Error(`Unknown node type: ${node.type || node.constructor?.name}`);
}

// ---- Individual node compilers ----

function compileConstantNode(node: any): EvalFunction {
  const value = node.value;
  return function evalConstantNode() {
    return value;
  };
}

function compileSymbolNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const name = node.name;

  if (argNames[name] === true) {
    // This is a function argument (from FunctionAssignmentNode)
    return function evalSymbolArg(_scope: Scope, args: Record<string, any>) {
      return args[name];
    };
  }

  // Use Object.prototype.hasOwnProperty to avoid resolving prototype-chain
  // names (e.g. "constructor", "toString") against the math namespace.
  // getSafeProperty enforces the safe-property whitelist on access.
  if (Object.prototype.hasOwnProperty.call(math, name)) {
    return function evalSymbolNode(scope: Scope) {
      if (scope.has(name)) {
        return scope.get(name);
      }
      // math namespace lookup — direct read is safe because we already
      // verified `name` is an own property of the trusted math object.
      return math[name];
    };
  }

  // Unknown symbol - check scope at runtime
  return function evalSymbolNode(scope: Scope) {
    if (scope.has(name)) {
      return scope.get(name);
    }
    throw new Error(`Undefined symbol "${name}"`);
  };
}

function compileOperatorNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const fnName: string = node.fn;

  if (typeof fnName !== 'string' || !(fnName in math)) {
    throw new Error(`Function "${fnName}" missing in provided namespace "math"`);
  }

  const fn = math[fnName];
  const evalArgs: EvalFunction[] = node.args.map((arg: any) => compileNode(arg, math, argNames));

  // Optimize for common arity
  if (evalArgs.length === 1) {
    const evalArg0 = evalArgs[0];
    return function evalOperatorNode(scope: Scope, args: Record<string, any>, context: any) {
      return fn(evalArg0(scope, args, context));
    };
  }

  if (evalArgs.length === 2) {
    const evalArg0 = evalArgs[0];
    const evalArg1 = evalArgs[1];
    return function evalOperatorNode(scope: Scope, args: Record<string, any>, context: any) {
      return fn(evalArg0(scope, args, context), evalArg1(scope, args, context));
    };
  }

  return function evalOperatorNode(scope: Scope, args: Record<string, any>, context: any) {
    const values = evalArgs.map((e) => e(scope, args, context));
    return fn(...values);
  };
}

function compileFunctionNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const evalArgs: EvalFunction[] = node.args.map((arg: any) => compileNode(arg, math, argNames));

  // Get the function name from the fn property (which is a SymbolNode)
  const fnNode = node.fn;
  if (fnNode && fnNode.isSymbolNode) {
    const name: string = fnNode.name;

    const resolveFn = (scope: Scope): any => {
      if (scope.has(name)) {
        const value = scope.get(name);
        if (typeof value === 'function') return value;
        throw new TypeError(`'${name}' is not a function; its value is:\n  ${value}`);
      }
      if (Object.prototype.hasOwnProperty.call(math, name)) {
        const value = math[name];
        if (typeof value === 'function') return value;
        throw new TypeError(`'${name}' is not a function; its value is:\n  ${value}`);
      }
      throw new Error(`Undefined function "${name}"`);
    };

    // Optimize for common arities
    switch (evalArgs.length) {
      case 0:
        return function evalFunctionNode(scope: Scope, _args: Record<string, any>, _context: any) {
          return resolveFn(scope)();
        };
      case 1: {
        const evalArg0 = evalArgs[0];
        return function evalFunctionNode(scope: Scope, args: Record<string, any>, context: any) {
          return resolveFn(scope)(evalArg0(scope, args, context));
        };
      }
      case 2: {
        const evalArg0 = evalArgs[0];
        const evalArg1 = evalArgs[1];
        return function evalFunctionNode(scope: Scope, args: Record<string, any>, context: any) {
          return resolveFn(scope)(evalArg0(scope, args, context), evalArg1(scope, args, context));
        };
      }
      default:
        return function evalFunctionNode(scope: Scope, args: Record<string, any>, context: any) {
          const values = evalArgs.map((e) => e(scope, args, context));
          return resolveFn(scope)(...values);
        };
    }
  }

  // Fallback: fn is an expression (e.g., accessor like obj.method()).
  // For AccessorNode-with-property-name we route through getSafeMethod so
  // method calls like ({}).constructor() and arr.constructor() are blocked.
  if (
    fnNode &&
    fnNode.isAccessorNode &&
    fnNode.index &&
    fnNode.index.isObjectProperty &&
    fnNode.index.isObjectProperty()
  ) {
    const evalObject = compileNode(fnNode.object, math, argNames);
    const methodName: string = fnNode.index.getObjectProperty();
    return function evalFunctionNode(scope: Scope, args: Record<string, any>, context: any) {
      const obj = evalObject(scope, args, context);
      const fn = getSafeMethod(obj, methodName);
      if (typeof fn !== 'function') {
        throw new TypeError('Expression does not evaluate to a function');
      }
      const values = evalArgs.map((e) => e(scope, args, context));
      return fn.apply(obj, values);
    };
  }

  // General fallback (computed accessor, etc.)
  const evalFn = compileNode(fnNode, math, argNames);
  return function evalFunctionNode(scope: Scope, args: Record<string, any>, context: any) {
    const fn = evalFn(scope, args, context);
    if (typeof fn !== 'function') {
      throw new TypeError('Expression does not evaluate to a function');
    }
    const values = evalArgs.map((e) => e(scope, args, context));
    return fn(...values);
  };
}

function compileArrayNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const evalItems: EvalFunction[] = node.items.map((item: any) =>
    compileNode(item, math, argNames)
  );
  return function evalArrayNode(scope: Scope, args: Record<string, any>, context: any) {
    return evalItems.map((e) => e(scope, args, context));
  };
}

function compileAssignmentNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const evalValue = compileNode(node.value, math, argNames);

  if (node.object && node.object.isSymbolNode && !node.index) {
    // Simple variable assignment: x = 5
    const name: string = node.object.name;
    return function evalAssignmentNode(scope: Scope, args: Record<string, any>, context: any) {
      const value = evalValue(scope, args, context);
      scope.set(name, value);
      return value;
    };
  }

  if (node.object && node.object.isAccessorNode) {
    // Property assignment: obj.prop = value
    const evalObject = compileNode(node.object.object, math, argNames);
    if (node.object.index && node.object.index.isObjectProperty()) {
      const prop = node.object.index.getObjectProperty();
      return function evalAssignmentNode(scope: Scope, args: Record<string, any>, context: any) {
        const obj = evalObject(scope, args, context);
        const value = evalValue(scope, args, context);
        // Sandbox: refuse writes to constructor / __proto__ / etc.
        return setSafeProperty(obj, prop, value);
      };
    }
  }

  // Fallback: treat as symbol assignment using the name property
  const name: string = node.name || (node.object && node.object.name);
  if (name) {
    return function evalAssignmentNode(scope: Scope, args: Record<string, any>, context: any) {
      const value = evalValue(scope, args, context);
      scope.set(name, value);
      return value;
    };
  }

  throw new Error('Unsupported assignment target');
}

function compileBlockNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const evalBlocks = node.blocks.map((block: any) => ({
    evaluate: compileNode(block.node, math, argNames),
    visible: block.visible,
  }));

  return function evalBlockNode(scope: Scope, args: Record<string, any>, context: any) {
    const results: any[] = [];
    for (const block of evalBlocks) {
      const result = block.evaluate(scope, args, context);
      if (block.visible) {
        results.push(result);
      }
    }
    // Return ResultSet-like array if multiple visible results, otherwise last result
    if (results.length === 1) return results[0];
    if (results.length > 1) return results;
    return undefined;
  };
}

function compileConditionalNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const evalCondition = compileNode(node.condition, math, argNames);
  const evalTrueExpr = compileNode(node.trueExpr, math, argNames);
  const evalFalseExpr = compileNode(node.falseExpr, math, argNames);

  return function evalConditionalNode(scope: Scope, args: Record<string, any>, context: any) {
    const condition = evalCondition(scope, args, context);
    return testCondition(condition)
      ? evalTrueExpr(scope, args, context)
      : evalFalseExpr(scope, args, context);
  };
}

function compileObjectNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const keys = Object.keys(node.properties);
  const evalProps: Array<{ key: string; evaluate: EvalFunction }> = keys.map((key) => ({
    key,
    evaluate: compileNode(node.properties[key], math, argNames),
  }));

  return function evalObjectNode(scope: Scope, args: Record<string, any>, context: any) {
    const result: Record<string, any> = {};
    for (const prop of evalProps) {
      // Sandbox: object-literal keys go through setSafeProperty so
      // payloads like `{__proto__: {polluted: 1}}` are rejected.
      setSafeProperty(result, prop.key, prop.evaluate(scope, args, context));
    }
    return result;
  };
}

function compileRangeNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const rangeFn = math.range;
  if (!rangeFn) {
    throw new Error('Function "range" missing in math namespace (required for range expressions)');
  }

  const evalStart = compileNode(node.start, math, argNames);
  const evalEnd = compileNode(node.end, math, argNames);

  if (node.step) {
    const evalStep = compileNode(node.step, math, argNames);
    return function evalRangeNode(scope: Scope, args: Record<string, any>, context: any) {
      return rangeFn(
        evalStart(scope, args, context),
        evalEnd(scope, args, context),
        evalStep(scope, args, context)
      );
    };
  }

  return function evalRangeNode(scope: Scope, args: Record<string, any>, context: any) {
    return rangeFn(evalStart(scope, args, context), evalEnd(scope, args, context));
  };
}

function compileRelationalNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const compiled: EvalFunction[] = node.params.map((p: any) => compileNode(p, math, argNames));
  const conditionals: string[] = node.conditionals;

  return function evalRelationalNode(
    scope: Scope,
    args: Record<string, any>,
    context: any
  ): boolean {
    let evalLhs: any;
    let evalRhs = compiled[0](scope, args, context);

    for (let i = 0; i < conditionals.length; i++) {
      evalLhs = evalRhs;
      evalRhs = compiled[i + 1](scope, args, context);
      const condFn = math[conditionals[i]];
      if (!condFn) {
        throw new Error(`Unknown comparison function: "${conditionals[i]}"`);
      }
      if (!condFn(evalLhs, evalRhs)) {
        return false;
      }
    }
    return true;
  };
}

function compileFunctionAssignmentNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const childArgNames = Object.create(argNames);
  for (const param of node.params) {
    childArgNames[param] = true;
  }

  const evalExpr = compileNode(node.expr, math, childArgNames);
  const name: string = node.name;
  const params: string[] = node.params;

  return function evalFunctionAssignmentNode(
    scope: Scope,
    args: Record<string, any>,
    _context: any
  ) {
    const fn = function (...fnArgs: any[]) {
      const childArgs = Object.create(args);
      for (let i = 0; i < params.length; i++) {
        childArgs[params[i]] = fnArgs[i];
      }
      return evalExpr(scope, childArgs, undefined);
    };
    (fn as any).syntax = name + '(' + params.join(', ') + ')';
    scope.set(name, fn);
    return fn;
  };
}

function compileAccessorNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const evalObject = compileNode(node.object, math, argNames);

  if (node.index && node.index.isObjectProperty && node.index.isObjectProperty()) {
    const prop = node.index.getObjectProperty();
    return function evalAccessorNode(scope: Scope, args: Record<string, any>, context: any) {
      const object = evalObject(scope, args, context);
      if (node.optionalChaining && object == null) return undefined;
      // Sandbox: only whitelisted/own properties readable; constructor /
      // __proto__ / call / apply etc. are rejected.
      return getSafeProperty(object, prop);
    };
  }

  // Array/matrix indexing
  const evalIndex = compileNode(node.index, math, argNames);
  return function evalAccessorNode(scope: Scope, args: Record<string, any>, context: any) {
    const object = evalObject(scope, args, context);
    if (node.optionalChaining && object == null) return undefined;
    const index = evalIndex(scope, args, context);
    // Use math.subset if available for matrix indexing
    if (math.subset) {
      return math.subset(object, index);
    }
    // Numeric (typed) array index is safe; for arbitrary keys defer to
    // getSafeProperty to keep the sandbox closed.
    if (typeof index === 'number') {
      return object[index];
    }
    return getSafeProperty(object, index);
  };
}

function compileIndexNode(
  node: any,
  math: Record<string, any>,
  argNames: Record<string, boolean>
): EvalFunction {
  const evalDimensions: EvalFunction[] = node.dimensions.map((dim: any) =>
    compileNode(dim, math, argNames)
  );

  return function evalIndexNode(scope: Scope, args: Record<string, any>, context: any) {
    const dimensions = evalDimensions.map((e) => e(scope, args, context));
    // Use math.index if available
    if (math.index) {
      return math.index(...dimensions);
    }
    // For single dimension, return the value directly
    if (dimensions.length === 1) return dimensions[0];
    return dimensions;
  };
}

// ---- Utilities ----

/**
 * Test whether a condition is truthy.
 * Handles numbers, booleans, strings, BigNumbers, Complex numbers.
 */
function testCondition(condition: any): boolean {
  if (
    typeof condition === 'number' ||
    typeof condition === 'boolean' ||
    typeof condition === 'string'
  ) {
    return !!condition;
  }

  if (condition) {
    // BigNumber
    if (typeof condition.isZero === 'function') {
      return !condition.isZero();
    }
    // Complex
    if (condition.re !== undefined || condition.im !== undefined) {
      return !!(condition.re || condition.im);
    }
  }

  if (condition === null || condition === undefined) {
    return false;
  }

  throw new TypeError(`Unsupported type of condition "${typeof condition}"`);
}
