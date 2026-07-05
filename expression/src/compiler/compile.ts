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
import type { MathNode } from '../node/Node.js';

/**
 * A Map-like scope with has/get/set methods.
 */
export interface Scope {
  has(key: string): boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/**
 * A compiled expression that can be evaluated with an optional user scope.
 */
export interface CompiledExpression {
  evaluate(scope?: Record<string, unknown> | Scope): unknown;
}

/** A math-namespace function resolved and invoked dynamically at runtime. */
type MathFunction = (...args: unknown[]) => unknown;

/**
 * Duck-typed discriminant flags this tree-walker reads off a parsed node.
 * The compiler dispatches on these `isXxxNode` booleans (the mathjs
 * convention) rather than via instanceof, so the base `MathNode` type does
 * not carry them — they are read through a narrowing cast.
 */
interface NodeFlags {
  isConstantNode?: boolean;
  isSymbolNode?: boolean;
  isOperatorNode?: boolean;
  isFunctionNode?: boolean;
  isParenthesisNode?: boolean;
  isArrayNode?: boolean;
  isAssignmentNode?: boolean;
  isBlockNode?: boolean;
  isConditionalNode?: boolean;
  isObjectNode?: boolean;
  isRangeNode?: boolean;
  isRelationalNode?: boolean;
  isFunctionAssignmentNode?: boolean;
  isAccessorNode?: boolean;
  isIndexNode?: boolean;
}

/**
 * Structural view of an IndexNode that may carry a single object-property
 * access (dot notation), used by accessor/assignment/function-call compilers.
 */
interface ObjectPropertyIndex {
  isObjectProperty?: () => boolean;
  getObjectProperty?: () => string;
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
export function compile(node: MathNode, mathScope: Record<string, unknown>): CompiledExpression {
  // Pre-compile the node tree into a closure
  const evalFn = compileNode(node, mathScope, {});

  return {
    evaluate(userScope?: Record<string, unknown> | Scope): unknown {
      let scope: Scope;
      if (!userScope) {
        scope = new ObjectWrappingMap({}) as unknown as Scope;
      } else if (typeof (userScope as Scope).has === 'function') {
        scope = userScope as Scope;
      } else {
        scope = new ObjectWrappingMap(userScope as Record<string, unknown>) as unknown as Scope;
      }
      return evalFn(scope, {}, undefined);
    },
  };
}

/**
 * Internal type for compiled node evaluation functions.
 * Matches the mathjs _compile signature: (scope, args, context) => value
 */
type EvalFunction = (scope: Scope, args: Record<string, unknown>, context: unknown) => unknown;

/**
 * Compile a single AST node into an evaluation function.
 *
 * @param node - AST node
 * @param math - Math namespace
 * @param argNames - Map of argument names (for FunctionAssignment params)
 * @returns Evaluation function
 */
function compileNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const n = node as MathNode & NodeFlags & { content?: MathNode };
  if (n.isConstantNode) {
    return compileConstantNode(node);
  }
  if (n.isSymbolNode) {
    return compileSymbolNode(node, math, argNames);
  }
  if (n.isOperatorNode) {
    return compileOperatorNode(node, math, argNames);
  }
  if (n.isFunctionNode) {
    return compileFunctionNode(node, math, argNames);
  }
  if (n.isParenthesisNode) {
    return compileNode(n.content as MathNode, math, argNames);
  }
  if (n.isArrayNode) {
    return compileArrayNode(node, math, argNames);
  }
  if (n.isAssignmentNode) {
    return compileAssignmentNode(node, math, argNames);
  }
  if (n.isBlockNode) {
    return compileBlockNode(node, math, argNames);
  }
  if (n.isConditionalNode) {
    return compileConditionalNode(node, math, argNames);
  }
  if (n.isObjectNode) {
    return compileObjectNode(node, math, argNames);
  }
  if (n.isRangeNode) {
    return compileRangeNode(node, math, argNames);
  }
  if (n.isRelationalNode) {
    return compileRelationalNode(node, math, argNames);
  }
  if (n.isFunctionAssignmentNode) {
    return compileFunctionAssignmentNode(node, math, argNames);
  }
  if (n.isAccessorNode) {
    return compileAccessorNode(node, math, argNames);
  }
  if (n.isIndexNode) {
    return compileIndexNode(node, math, argNames);
  }

  throw new Error(`Unknown node type: ${node.type || node.constructor?.name}`);
}

// ---- Individual node compilers ----

function compileConstantNode(node: MathNode): EvalFunction {
  const value = (node as MathNode & { value: unknown }).value;
  return function evalConstantNode() {
    return value;
  };
}

function compileSymbolNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const name = (node as MathNode & { name: string }).name;

  if (argNames[name] === true) {
    // This is a function argument (from FunctionAssignmentNode)
    return function evalSymbolArg(_scope: Scope, args: Record<string, unknown>) {
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
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const opNode = node as MathNode & { fn: string; args: MathNode[] };
  const fnName: string = opNode.fn;

  if (typeof fnName !== 'string' || !(fnName in math)) {
    throw new Error(`Function "${fnName}" missing in provided namespace "math"`);
  }

  const fn = math[fnName] as MathFunction & { rawArgs?: boolean };

  // rawArgs (expression-language transforms, e.g. lazy `and`/`or`/`??`): the
  // function receives the UNevaluated argument nodes plus the namespace and
  // scope, so it can short-circuit without evaluating the other side.
  if (fn.rawArgs === true) {
    const rawNodes = opNode.args;
    return function evalOperatorNodeRaw(scope: Scope) {
      return fn(rawNodes, math, scope);
    };
  }

  const evalArgs: EvalFunction[] = opNode.args.map((arg) => compileNode(arg, math, argNames));

  // Optimize for common arity
  if (evalArgs.length === 1) {
    const evalArg0 = evalArgs[0];
    return function evalOperatorNode(
      scope: Scope,
      args: Record<string, unknown>,
      context: unknown
    ) {
      return fn(evalArg0(scope, args, context));
    };
  }

  if (evalArgs.length === 2) {
    const evalArg0 = evalArgs[0];
    const evalArg1 = evalArgs[1];
    return function evalOperatorNode(
      scope: Scope,
      args: Record<string, unknown>,
      context: unknown
    ) {
      return fn(evalArg0(scope, args, context), evalArg1(scope, args, context));
    };
  }

  return function evalOperatorNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
    const values = evalArgs.map((e) => e(scope, args, context));
    return fn(...values);
  };
}

function compileFunctionNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const fnNodeOuter = node as MathNode & {
    args: MathNode[];
    fn: MathNode & {
      isSymbolNode?: boolean;
      name?: string;
      isAccessorNode?: boolean;
      object?: MathNode;
      index?: MathNode & ObjectPropertyIndex;
    };
  };
  // Get the function name from the fn property (which is a SymbolNode)
  const fnNode = fnNodeOuter.fn;
  if (fnNode && fnNode.isSymbolNode) {
    const name: string = fnNode.name as string;

    // rawArgs (expression-language transforms, e.g. map/filter/forEach with
    // 1-based callback indices): statically detectable from the namespace,
    // mirroring mathjs FunctionNode._compile. The function receives the raw
    // argument NODES plus the namespace and scope.
    const staticFn = Object.prototype.hasOwnProperty.call(math, name)
      ? (math[name] as MathFunction & { rawArgs?: boolean })
      : undefined;
    if (typeof staticFn === 'function' && staticFn.rawArgs === true) {
      const rawNodes = fnNodeOuter.args;
      return function evalFunctionNodeRaw(scope: Scope) {
        // the name can be shadowed in scope by a non-rawArgs function
        const shadow = scope.has(name) ? scope.get(name) : undefined;
        if (typeof shadow === 'function' && (shadow as { rawArgs?: boolean }).rawArgs !== true) {
          const values = rawNodes.map((rn) =>
            compileNode(rn, math, argNames)(scope, {}, undefined)
          );
          return (shadow as MathFunction)(...values);
        }
        return staticFn(rawNodes, math, scope);
      };
    }

    const evalArgs: EvalFunction[] = fnNodeOuter.args.map((arg) =>
      compileNode(arg, math, argNames)
    );

    const resolveFn = (scope: Scope): MathFunction => {
      if (scope.has(name)) {
        const value = scope.get(name);
        if (typeof value === 'function') return value as MathFunction;
        throw new TypeError(`'${name}' is not a function; its value is:\n  ${value}`);
      }
      if (Object.prototype.hasOwnProperty.call(math, name)) {
        const value = math[name];
        if (typeof value === 'function') return value as MathFunction;
        throw new TypeError(`'${name}' is not a function; its value is:\n  ${value}`);
      }
      throw new Error(`Undefined function "${name}"`);
    };

    // Optimize for common arities
    switch (evalArgs.length) {
      case 0:
        return function evalFunctionNode(
          scope: Scope,
          _args: Record<string, unknown>,
          _context: unknown
        ) {
          return resolveFn(scope)();
        };
      case 1: {
        const evalArg0 = evalArgs[0];
        return function evalFunctionNode(
          scope: Scope,
          args: Record<string, unknown>,
          context: unknown
        ) {
          return resolveFn(scope)(evalArg0(scope, args, context));
        };
      }
      case 2: {
        const evalArg0 = evalArgs[0];
        const evalArg1 = evalArgs[1];
        return function evalFunctionNode(
          scope: Scope,
          args: Record<string, unknown>,
          context: unknown
        ) {
          return resolveFn(scope)(evalArg0(scope, args, context), evalArg1(scope, args, context));
        };
      }
      default:
        return function evalFunctionNode(
          scope: Scope,
          args: Record<string, unknown>,
          context: unknown
        ) {
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
    const evalArgs: EvalFunction[] = fnNodeOuter.args.map((arg) =>
      compileNode(arg, math, argNames)
    );
    const evalObject = compileNode(fnNode.object as MathNode, math, argNames);
    const methodName: string = fnNode.index.getObjectProperty!();
    return function evalFunctionNode(
      scope: Scope,
      args: Record<string, unknown>,
      context: unknown
    ) {
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
  const evalArgs: EvalFunction[] = fnNodeOuter.args.map((arg) => compileNode(arg, math, argNames));
  const evalFn = compileNode(fnNode, math, argNames);
  return function evalFunctionNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
    const fn = evalFn(scope, args, context);
    if (typeof fn !== 'function') {
      throw new TypeError('Expression does not evaluate to a function');
    }
    const values = evalArgs.map((e) => e(scope, args, context));
    return (fn as MathFunction)(...values);
  };
}

function compileArrayNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const items = (node as MathNode & { items: MathNode[] }).items;
  const evalItems: EvalFunction[] = items.map((item) => compileNode(item, math, argNames));
  return function evalArrayNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
    return evalItems.map((e) => e(scope, args, context));
  };
}

function compileAssignmentNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const asgNode = node as MathNode & {
    value: MathNode;
    name?: string;
    index?: unknown;
    object?: MathNode & {
      isSymbolNode?: boolean;
      name?: string;
      isAccessorNode?: boolean;
      object?: MathNode;
      index?: MathNode & ObjectPropertyIndex;
    };
  };
  const evalValue = compileNode(asgNode.value, math, argNames);

  if (asgNode.object && asgNode.object.isSymbolNode && !asgNode.index) {
    // Simple variable assignment: x = 5
    const name: string = asgNode.object.name as string;
    return function evalAssignmentNode(
      scope: Scope,
      args: Record<string, unknown>,
      context: unknown
    ) {
      const value = evalValue(scope, args, context);
      scope.set(name, value);
      return value;
    };
  }

  if (asgNode.object && asgNode.object.isAccessorNode) {
    // Property assignment: obj.prop = value
    const evalObject = compileNode(asgNode.object.object as MathNode, math, argNames);
    if (asgNode.object.index && asgNode.object.index.isObjectProperty!()) {
      const prop = asgNode.object.index.getObjectProperty!();
      return function evalAssignmentNode(
        scope: Scope,
        args: Record<string, unknown>,
        context: unknown
      ) {
        const obj = evalObject(scope, args, context);
        const value = evalValue(scope, args, context);
        // Sandbox: refuse writes to constructor / __proto__ / etc.
        return setSafeProperty(obj, prop, value);
      };
    }
  }

  // Fallback: treat as symbol assignment using the name property
  const name = asgNode.name || (asgNode.object && asgNode.object.name);
  if (name) {
    return function evalAssignmentNode(
      scope: Scope,
      args: Record<string, unknown>,
      context: unknown
    ) {
      const value = evalValue(scope, args, context);
      scope.set(name, value);
      return value;
    };
  }

  throw new Error('Unsupported assignment target');
}

function compileBlockNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const blocks = (node as MathNode & { blocks: Array<{ node: MathNode; visible: boolean }> })
    .blocks;
  const evalBlocks = blocks.map((block) => ({
    evaluate: compileNode(block.node, math, argNames),
    visible: block.visible,
  }));

  return function evalBlockNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
    const results: unknown[] = [];
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
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const condNode = node as MathNode & {
    condition: MathNode;
    trueExpr: MathNode;
    falseExpr: MathNode;
  };
  const evalCondition = compileNode(condNode.condition, math, argNames);
  const evalTrueExpr = compileNode(condNode.trueExpr, math, argNames);
  const evalFalseExpr = compileNode(condNode.falseExpr, math, argNames);

  return function evalConditionalNode(
    scope: Scope,
    args: Record<string, unknown>,
    context: unknown
  ) {
    const condition = evalCondition(scope, args, context);
    return testCondition(condition)
      ? evalTrueExpr(scope, args, context)
      : evalFalseExpr(scope, args, context);
  };
}

function compileObjectNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const properties = (node as MathNode & { properties: Record<string, MathNode> }).properties;
  const keys = Object.keys(properties);
  const evalProps: Array<{ key: string; evaluate: EvalFunction }> = keys.map((key) => ({
    key,
    evaluate: compileNode(properties[key], math, argNames),
  }));

  return function evalObjectNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
    const result: Record<string, unknown> = {};
    for (const prop of evalProps) {
      // Sandbox: object-literal keys go through setSafeProperty so
      // payloads like `{__proto__: {polluted: 1}}` are rejected.
      setSafeProperty(result, prop.key, prop.evaluate(scope, args, context));
    }
    return result;
  };
}

function compileRangeNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const rangeFn = math.range as MathFunction | undefined;
  if (!rangeFn) {
    throw new Error('Function "range" missing in math namespace (required for range expressions)');
  }

  const rngNode = node as MathNode & { start: MathNode; end: MathNode; step?: MathNode };
  const evalStart = compileNode(rngNode.start, math, argNames);
  const evalEnd = compileNode(rngNode.end, math, argNames);

  if (rngNode.step) {
    const evalStep = compileNode(rngNode.step, math, argNames);
    return function evalRangeNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
      return rangeFn(
        evalStart(scope, args, context),
        evalEnd(scope, args, context),
        evalStep(scope, args, context)
      );
    };
  }

  return function evalRangeNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
    return rangeFn(evalStart(scope, args, context), evalEnd(scope, args, context));
  };
}

function compileRelationalNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const relNode = node as MathNode & { params: MathNode[]; conditionals: string[] };
  const compiled: EvalFunction[] = relNode.params.map((p) => compileNode(p, math, argNames));
  const conditionals: string[] = relNode.conditionals;

  return function evalRelationalNode(
    scope: Scope,
    args: Record<string, unknown>,
    context: unknown
  ): boolean {
    let evalLhs: unknown;
    let evalRhs = compiled[0](scope, args, context);

    for (let i = 0; i < conditionals.length; i++) {
      evalLhs = evalRhs;
      evalRhs = compiled[i + 1](scope, args, context);
      const condFn = math[conditionals[i]] as MathFunction | undefined;
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
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const faNode = node as MathNode & { params: string[]; expr: MathNode; name: string };
  const childArgNames: Record<string, boolean> = Object.create(argNames);
  for (const param of faNode.params) {
    childArgNames[param] = true;
  }

  const evalExpr = compileNode(faNode.expr, math, childArgNames);
  const name: string = faNode.name;
  const params: string[] = faNode.params;

  return function evalFunctionAssignmentNode(
    scope: Scope,
    args: Record<string, unknown>,
    _context: unknown
  ) {
    const fn = function (...fnArgs: unknown[]) {
      const childArgs: Record<string, unknown> = Object.create(args);
      for (let i = 0; i < params.length; i++) {
        childArgs[params[i]] = fnArgs[i];
      }
      return evalExpr(scope, childArgs, undefined);
    };
    (fn as unknown as { syntax: string }).syntax = name + '(' + params.join(', ') + ')';
    scope.set(name, fn);
    return fn;
  };
}

function compileAccessorNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const accNode = node as MathNode & {
    object: MathNode;
    optionalChaining?: boolean;
    index: MathNode & ObjectPropertyIndex;
  };
  const evalObject = compileNode(accNode.object, math, argNames);

  if (accNode.index && accNode.index.isObjectProperty && accNode.index.isObjectProperty()) {
    const prop = accNode.index.getObjectProperty!();
    return function evalAccessorNode(
      scope: Scope,
      args: Record<string, unknown>,
      context: unknown
    ) {
      const object = evalObject(scope, args, context);
      if (accNode.optionalChaining && object == null) return undefined;
      // Sandbox: only whitelisted/own properties readable; constructor /
      // __proto__ / call / apply etc. are rejected.
      return getSafeProperty(object, prop);
    };
  }

  // Array/matrix indexing
  const evalIndex = compileNode(accNode.index, math, argNames);
  return function evalAccessorNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
    const object = evalObject(scope, args, context);
    if (accNode.optionalChaining && object == null) return undefined;
    // The indexed OBJECT is the context for the index evaluation — the
    // IndexNode's `end` symbol resolves against its size (mathjs parity).
    const index = evalIndex(scope, args, object);
    // Use math.subset if available for matrix indexing
    if (math.subset) {
      return (math.subset as MathFunction)(object, index);
    }
    // Numeric (typed) array index is safe; for arbitrary keys defer to
    // getSafeProperty to keep the sandbox closed.
    if (typeof index === 'number') {
      return (object as Record<number, unknown>)[index];
    }
    return getSafeProperty(object, index);
  };
}

function compileIndexNode(
  node: MathNode,
  math: Record<string, unknown>,
  argNames: Record<string, boolean>
): EvalFunction {
  const dimensionNodes = (node as MathNode & { dimensions: MathNode[] }).dimensions;
  // `end` support (mathjs parity): inside dimension i of `A[...]`, the symbol
  // `end` resolves to the size of A along that dimension (1-based last index).
  // Compile each dimension with `end` registered as an argument name; at eval
  // time, supply args.end from the context's size when the dimension uses it.
  const usesEnd = dimensionNodes.map(
    (dim) =>
      (dim as MathNode & { filter?: (cb: (n: unknown) => boolean) => unknown[] }).filter?.(
        (n) =>
          (n as { isSymbolNode?: boolean; name?: string }).isSymbolNode === true &&
          (n as { name?: string }).name === 'end'
      )?.length ?? 0
  );
  const evalDimensions: EvalFunction[] = dimensionNodes.map((dim, i) => {
    if (usesEnd[i]) {
      const childArgNames: Record<string, boolean> = Object.create(argNames);
      childArgNames.end = true;
      return compileNode(dim, math, childArgNames);
    }
    return compileNode(dim, math, argNames);
  });
  const anyEnd = usesEnd.some((n) => n > 0);

  return function evalIndexNode(scope: Scope, args: Record<string, unknown>, context: unknown) {
    const dimensions = evalDimensions.map((e, i) => {
      if (usesEnd[i]) {
        const sizeFn = math.size as ((x: unknown) => unknown) | undefined;
        if (!sizeFn || context === undefined || context === null) {
          throw new Error('Cannot resolve "end": no indexing context');
        }
        const s = sizeFn(context) as { valueOf(): unknown };
        const sizes = (Array.isArray(s) ? s : (s.valueOf() as number[])) as number[];
        const childArgs: Record<string, unknown> = Object.create(args);
        childArgs.end = sizes[i];
        return e(scope, childArgs, context);
      }
      return e(scope, args, context);
    });
    void anyEnd;
    // Use math.index if available
    if (math.index) {
      return (math.index as MathFunction)(...dimensions);
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
function testCondition(condition: unknown): boolean {
  if (
    typeof condition === 'number' ||
    typeof condition === 'boolean' ||
    typeof condition === 'string'
  ) {
    return !!condition;
  }

  if (condition) {
    const c = condition as { isZero?: () => boolean; re?: unknown; im?: unknown };
    // BigNumber
    if (typeof c.isZero === 'function') {
      return !c.isZero();
    }
    // Complex
    if (c.re !== undefined || c.im !== undefined) {
      return !!(c.re || c.im);
    }
  }

  if (condition === null || condition === undefined) {
    return false;
  }

  throw new TypeError(`Unsupported type of condition "${typeof condition}"`);
}
