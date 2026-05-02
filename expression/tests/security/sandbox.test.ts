import { describe, it, expect } from 'vitest'
import { compile } from '../../src/compiler/compile.js'
import { createEvaluate } from '../../src/evaluator/evaluate.js'

/**
 * Security regression tests — these validate the sandbox restored to the
 * tree-walking compiler. Each MUST throw (or refuse) for malicious AST
 * shapes the parser can produce, while still permitting legitimate access
 * to whitelisted properties and methods.
 *
 * Cross-references:
 *   - expression/src/utils/customs.ts  (getSafeProperty/setSafeProperty/getSafeMethod)
 *   - expression/src/compiler/compile.ts (the call sites being protected)
 */

// -- Mock node helpers --
function constantNode(value: any) {
  return { type: 'ConstantNode', isConstantNode: true, value }
}
function symbolNode(name: string) {
  return { type: 'SymbolNode', isSymbolNode: true, name }
}
function arrayNode(items: any[]) {
  return { type: 'ArrayNode', isArrayNode: true, items }
}
function objectNode(properties: Record<string, any>) {
  return { type: 'ObjectNode', isObjectNode: true, properties }
}
function functionNode(fnName: string, args: any[]) {
  return {
    type: 'FunctionNode',
    isFunctionNode: true,
    fn: symbolNode(fnName),
    args,
    get name() { return fnName }
  }
}
function functionAssignmentNode(name: string, params: string[], expr: any) {
  return {
    type: 'FunctionAssignmentNode',
    isFunctionAssignmentNode: true,
    name,
    params,
    expr
  }
}
function assignmentNode(name: string, value: any) {
  return {
    type: 'AssignmentNode',
    isAssignmentNode: true,
    object: symbolNode(name),
    value,
    name
  }
}
function propertyAccessor(object: any, prop: string) {
  return {
    type: 'AccessorNode',
    isAccessorNode: true,
    object,
    index: {
      isObjectProperty: () => true,
      getObjectProperty: () => prop
    }
  }
}
function propertyAssignment(targetObj: any, prop: string, value: any) {
  return {
    type: 'AssignmentNode',
    isAssignmentNode: true,
    object: {
      type: 'AccessorNode',
      isAccessorNode: true,
      object: targetObj,
      index: {
        isObjectProperty: () => true,
        getObjectProperty: () => prop
      }
    },
    value
  }
}

const mathScope: Record<string, any> = {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b
}

// ---- Sandbox unit tests against compile() directly ----
describe('security: sandbox via tree-walking compiler', () => {
  it('blocks .constructor access on arrays (RCE vector)', () => {
    // arr.constructor — should throw because constructor is on Object.prototype
    const arrSym = symbolNode('arr')
    const node = propertyAccessor(arrSym, 'constructor')
    const compiled = compile(node, mathScope)
    expect(() => compiled.evaluate({ arr: [1, 2, 3] })).toThrow(/No access to property/)
  })

  it('blocks .constructor.constructor("return 1")() chain', () => {
    // (arr.constructor).constructor("return 1")() — the very first hop must fail
    const node = propertyAccessor(propertyAccessor(symbolNode('arr'), 'constructor'), 'constructor')
    const compiled = compile(node, mathScope)
    expect(() => compiled.evaluate({ arr: [1, 2, 3] })).toThrow()
  })

  it('blocks __proto__ assignment (prototype pollution)', () => {
    // obj.__proto__ = something — must throw, must NOT mutate Object.prototype
    const node = propertyAssignment(symbolNode('obj'), '__proto__', constantNode({ polluted: 1 }))
    const compiled = compile(node, mathScope)
    expect(() => compiled.evaluate({ obj: {} })).toThrow(/No access to property/)
    // confirm prototype is untouched
    expect(({} as any).polluted).toBeUndefined()
  })

  it('blocks raw __proto__ property write through ObjectNode literal', () => {
    // {__proto__: {...}} via ObjectNode — keys must go through setSafeProperty.
    // Build the props dict without using `__proto__:` literal syntax (which
    // would set the prototype rather than create an own property).
    const props: Record<string, any> = {}
    Object.defineProperty(props, '__proto__', {
      value: constantNode({ polluted: 1 }),
      enumerable: true,
      configurable: true,
      writable: true
    })
    const node = objectNode(props)
    const compiled = compile(node, mathScope)
    expect(() => compiled.evaluate()).toThrow(/No access to property/)
    expect(({} as any).polluted).toBeUndefined()
  })

  it('blocks .call / .apply method access on function values', () => {
    // fn.call — should throw, "call" lives on Function.prototype
    const node = propertyAccessor(symbolNode('fn'), 'call')
    const compiled = compile(node, mathScope)
    expect(() => compiled.evaluate({ fn: function () { return 1 } })).toThrow(/No access to property/)
  })

  it('allows whitelisted .length on arrays', () => {
    const node = propertyAccessor(symbolNode('arr'), 'length')
    const compiled = compile(node, mathScope)
    expect(compiled.evaluate({ arr: [1, 2, 3] })).toBe(3)
  })

  it('allows safe ObjectNode property writes', () => {
    const node = objectNode({
      sum: constantNode(3),
      label: constantNode('ok')
    })
    expect(compile(node, mathScope).evaluate()).toEqual({ sum: 3, label: 'ok' })
  })
})

// ---- Pre-compile AST validator (forbidden function & assignment block) ----
describe('security: pre-compile AST validator (default-safe)', () => {
  // The validator lives in evaluate.ts and runs by default. It must reject
  // assignment / function-assignment / forbidden-function nodes unless the
  // caller explicitly sets `unsafe: true`.
  function mockParseFromNode(node: any) {
    return () => node
  }

  it('rejects FunctionAssignmentNode by default (f(x) = x.constructor)', () => {
    // f(x) = x.constructor
    const expr = functionAssignmentNode(
      'f',
      ['x'],
      propertyAccessor(symbolNode('x'), 'constructor')
    )
    const evaluate = createEvaluate(mockParseFromNode(expr) as any, mathScope)
    expect(() => evaluate('any')).toThrow(/disabled|unsafe|FunctionAssignment/i)
  })

  it('rejects AssignmentNode by default', () => {
    const expr = assignmentNode('x', constantNode(5))
    const evaluate = createEvaluate(mockParseFromNode(expr) as any, mathScope)
    expect(() => evaluate('x = 5')).toThrow(/disabled|unsafe|Assignment/i)
  })

  it('rejects forbidden function calls (import)', () => {
    const expr = functionNode('import', [constantNode('anything')])
    const evaluate = createEvaluate(mockParseFromNode(expr) as any, mathScope)
    expect(() => evaluate('import(...)')).toThrow(/forbidden|disabled|unsafe/i)
  })

  it('rejects forbidden function calls (createUnit, evaluate, parse, compile, simplify, derivative, help, chain)', () => {
    const forbidden = ['createUnit', 'evaluate', 'parse', 'compile', 'simplify', 'derivative', 'help', 'chain']
    for (const fnName of forbidden) {
      const expr = functionNode(fnName, [constantNode(1)])
      const evaluate = createEvaluate(mockParseFromNode(expr) as any, mathScope)
      expect(() => evaluate(fnName)).toThrow()
    }
  })

  it('allows assignments / function-assignments under unsafe: true', () => {
    const expr = assignmentNode('x', constantNode(5))
    const evaluate = createEvaluate(mockParseFromNode(expr) as any, mathScope)
    expect(() => evaluate('x = 5', undefined as any, { unsafe: true } as any)).not.toThrow()
  })

  it('still permits ordinary arithmetic (sanity)', () => {
    const expr = {
      type: 'OperatorNode',
      isOperatorNode: true,
      op: '+',
      fn: 'add',
      args: [constantNode(2), constantNode(3)]
    }
    const evaluate = createEvaluate(mockParseFromNode(expr) as any, mathScope)
    expect(evaluate('2+3')).toBe(5)
  })
})
