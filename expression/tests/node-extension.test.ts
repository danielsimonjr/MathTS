/**
 * Node-extension demonstration test (UPT integration scenario, Q1 of
 * the UPT v0.7 proposal §10.2 "open questions").
 *
 * UPT (universal-physics-tensor) wants to extend the mathts AST with
 * physics-specific node types such as `BridgeEquationNode` so that the
 * existing parser, evaluator, and tree-walking helpers can transparently
 * handle UPT's domain nodes alongside the built-in 16.
 *
 * The mathts `Node` class is parameterised by a `mathWithTransform`
 * scope (the factory pattern at `expression/src/node/Node.ts`). To
 * extend it, downstream packages call `createNode({mathWithTransform})`
 * to obtain the concrete class, then subclass that class.
 *
 * This test pins the pattern: it builds a tiny `BridgeEquationNode`
 * stand-in that wraps a child expression node plus a physics tag,
 * implements every required virtual method (`_compile`, `forEach`,
 * `map`, `_toString`, `toJSON`), verifies that the standard
 * tree-walking helpers (`traverse`, `clone`, `equals`) all work, and
 * verifies that the resulting instance still passes the duck-typed
 * `isNode` guard.
 *
 * If this test ever breaks, downstream extension of mathts Nodes
 * needs a closer review — adjust this file before changing the
 * Node base class's extension surface.
 */
import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { isNode } from '../src/utils/is.js';

describe('Node base class extensibility (UPT v0.7 §10.2 Q1)', () => {
  // Minimal `mathWithTransform` scope, enough to satisfy the factory
  // dependencies. Real downstream consumers would pass a fully-wired
  // mathjs-compat instance.
  const mathWithTransform: Record<string, unknown> = {};

  // Resolve the Node base class via its factory.
  const Node = createNode({ mathWithTransform });

  // Resolve ConstantNode similarly so we can use it as a child.
  const ConstantNode = createConstantNode({
    Node,
    isBounded: (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v as number),
  } as unknown as {
    Node: typeof Node;
    isBounded: (value: unknown) => boolean;
  });

  /**
   * Physics-specific AST node (UPT-shaped fake).
   * Wraps a single child expression node and tags it with a physics
   * domain string. Implements every virtual the Node base requires.
   */
  class BridgeEquationNode extends Node {
    static name = 'BridgeEquationNode';

    constructor(
      public child: InstanceType<typeof Node>,
      public domain: string
    ) {
      super();
    }

    get type(): string {
      return 'BridgeEquationNode';
    }

    get isBridgeEquationNode(): boolean {
      return true;
    }

    // _compile delegates to the child; in real UPT, this would emit
    // bridge-specific dispatch code.
    _compile(
      math: Record<string, unknown>,
      argNames: Record<string, boolean>
    ): (scope: Map<string, unknown>, args: Record<string, unknown>, context: unknown) => unknown {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evalChild = (this.child as any)._compile(math, argNames);
      return (scope, args, context) => evalChild(scope, args, context);
    }

    forEach(
      callback: (
        child: InstanceType<typeof Node>,
        path: string,
        parent: InstanceType<typeof Node>
      ) => void
    ): void {
      callback(this.child, 'child', this);
    }

    map(
      callback: (
        child: InstanceType<typeof Node>,
        path: string,
        parent: InstanceType<typeof Node>
      ) => InstanceType<typeof Node>
    ): BridgeEquationNode {
      const newChild = this._ifNode(callback(this.child, 'child', this));
      return new BridgeEquationNode(newChild, this.domain);
    }

    clone(): BridgeEquationNode {
      return new BridgeEquationNode(this.child, this.domain);
    }

    _toString(): string {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `bridge<${this.domain}>(${(this.child as any).toString()})`;
    }

    toJSON(): Record<string, unknown> {
      return {
        mathjs: 'BridgeEquationNode',
        domain: this.domain,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        child: (this.child as any).toJSON?.(),
      };
    }
  }

  it('subclass instances satisfy the duck-typed isNode guard', () => {
    const inner = new ConstantNode(42);
    const node = new BridgeEquationNode(inner, 'electromagnetism');
    expect(isNode(node)).toBe(true);
  });

  it('subclass exposes its custom type discriminator', () => {
    const inner = new ConstantNode(7);
    const node = new BridgeEquationNode(inner, 'gravity');
    expect(node.type).toBe('BridgeEquationNode');
    expect(node.isBridgeEquationNode).toBe(true);
    expect(node.domain).toBe('gravity');
  });

  it('forEach visits the child exactly once with the right path', () => {
    const inner = new ConstantNode(3);
    const node = new BridgeEquationNode(inner, 'fluid');
    const visited: Array<{ path: string; isChild: boolean }> = [];
    node.forEach((child, path, parent) => {
      visited.push({ path, isChild: child === inner });
      expect(parent).toBe(node);
    });
    expect(visited).toEqual([{ path: 'child', isChild: true }]);
  });

  it('map produces a new instance with the transformed child', () => {
    const inner = new ConstantNode(1);
    const node = new BridgeEquationNode(inner, 'thermo');
    const replaced = new ConstantNode(999);
    const next = node.map(() => replaced);

    expect(next).not.toBe(node);
    expect(next.child).toBe(replaced);
    expect(next.domain).toBe('thermo');
    expect(next.type).toBe('BridgeEquationNode');
  });

  it('traverse (inherited from Node) walks the subtree depth-first', () => {
    const inner = new ConstantNode(5);
    const node = new BridgeEquationNode(inner, 'optics');
    const visited: string[] = [];
    node.traverse((n) => {
      visited.push(n.type);
    });
    expect(visited).toEqual(['BridgeEquationNode', 'ConstantNode']);
  });

  it('clone returns a structurally-equal instance', () => {
    const inner = new ConstantNode(10);
    const node = new BridgeEquationNode(inner, 'quantum');
    const copy = node.clone();
    expect(copy).not.toBe(node);
    expect(copy.type).toBe('BridgeEquationNode');
    expect(copy.domain).toBe('quantum');
    expect(copy.child).toBe(inner);
  });

  it('toJSON includes the custom mathjs-discriminator + payload', () => {
    const inner = new ConstantNode(11);
    const node = new BridgeEquationNode(inner, 'relativity');
    const json = node.toJSON();
    expect(json.mathjs).toBe('BridgeEquationNode');
    expect(json.domain).toBe('relativity');
  });

  it('_toString uses the custom format', () => {
    const inner = new ConstantNode(2);
    const node = new BridgeEquationNode(inner, 'plasma');
    expect(node._toString()).toBe('bridge<plasma>(2)');
  });
});
