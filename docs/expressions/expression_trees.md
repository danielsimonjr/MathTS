# Expression trees

When MathTS parses an expression, it builds an **abstract syntax tree (AST)** and returns
the root node. You can inspect, traverse, and transform this tree before evaluating.

```typescript
import { parse } from '@danielsimonjr/mathts-functions';

const node = parse('sqrt(2 + x)');
```

The tree for `sqrt(2 + x)` looks like:

```
FunctionNode   sqrt
                |
OperatorNode    +
               / ConstantNode  2   x   SymbolNode
```

---

## Node types

MathTS has 16 node types. Each node sets `is<Type>Node = true` as a boolean property:

| Node type                | `node.type`                | What it represents                      |
| ------------------------ | -------------------------- | --------------------------------------- |
| `ConstantNode`           | `'ConstantNode'`           | A literal value: `2`, `"hello"`, `true` |
| `SymbolNode`             | `'SymbolNode'`             | A named variable or function: `x`, `pi` |
| `OperatorNode`           | `'OperatorNode'`           | An operator: `+`, `*`, `^`, unary `-`   |
| `FunctionNode`           | `'FunctionNode'`           | A function call: `sin(x)`, `max(a, b)`  |
| `FunctionAssignmentNode` | `'FunctionAssignmentNode'` | Function definition: `f(x) = x^2`       |
| `AssignmentNode`         | `'AssignmentNode'`         | Variable assignment: `a = 5`            |
| `BlockNode`              | `'BlockNode'`              | Multiple statements: `a = 1; b = 2`     |
| `ConditionalNode`        | `'ConditionalNode'`        | Ternary: `x > 0 ? x : -x`               |
| `RangeNode`              | `'RangeNode'`              | Range: `1:10`, `0:2:10`                 |
| `ArrayNode`              | `'ArrayNode'`              | Matrix/array literal: `[1, 2, 3]`       |
| `IndexNode`              | `'IndexNode'`              | Index access dimensions                 |
| `AccessorNode`           | `'AccessorNode'`           | Indexed access: `A[1,2]`, `obj.prop`    |
| `ObjectNode`             | `'ObjectNode'`             | Object literal: `{a: 1, b: 2}`          |
| `RelationalNode`         | `'RelationalNode'`         | Chained comparison: `1 < x < 10`        |
| `ParenthesisNode`        | `'ParenthesisNode'`        | Parenthesized sub-expression            |
| `Node`                   | `'Node'`                   | Base class; not directly instantiated   |

---

## Node API

Every node has these methods:

### Inspection

```typescript
node.type                    // string: 'OperatorNode', 'FunctionNode', etc.
node.toString()              // infix string representation
node.toTex()                 // LaTeX string representation
node.toHTML()                // HTML string with CSS class spans
node.equals(other: Node)     // deep equality check
```

### Traversal

```typescript
// Visit every node in the tree
node.forEach((child: Node, path: string, parent: Node) => {
  console.log(path, child.type);
});

// Map over children, return a new tree
const newNode = node.map((child: Node) => {
  // return a replacement node or the original
  return child;
});

// Recursively find nodes matching a predicate
const constants = node.filter((n: Node) => n.isConstantNode);

// Transform the tree by replacing nodes
const doubled = node.transform((n: Node) => {
  if (n.isConstantNode && typeof n.value === 'number') {
    return parse(String(n.value * 2)); // replace
  }
  return n; // keep
});
```

### Cloning

```typescript
node.clone(); // shallow clone (children not cloned)
node.cloneDeep(); // deep clone
```

---

## Evaluating a node

Nodes from `parse()` carry their own `compile()` / `evaluate()` methods, wired to the
full math scope:

```typescript
import { parse } from '@danielsimonjr/mathts-functions';

const node = parse('x^2 + 1');
node.evaluate({ x: 3 }); // 10

// Or compile once and reuse with different scopes
const compiled = node.compile();
compiled.evaluate({ x: 3 }); // 10
```

For most use cases, `evaluate()` and `compileExpr()` (see [parsing.md](parsing.md)) are
simpler — they handle parsing and compilation automatically.

---

## Inspecting node properties

Each node type exposes typed properties:

```typescript
// ConstantNode
const c = parse('42');
// c.isConstantNode === true
// c.value === 42

// OperatorNode
const op = parse('2 + 3');
// op.isOperatorNode === true
// op.op === '+'
// op.fn === 'add'
// op.args: Node[]   [ConstantNode(2), ConstantNode(3)]

// FunctionNode
const fn = parse('sin(x)');
// fn.isFunctionNode === true
// fn.name === 'sin'
// fn.args: Node[]   [SymbolNode('x')]

// SymbolNode
const sym = parse('x');
// sym.isSymbolNode === true
// sym.name === 'x'

// AssignmentNode
const asgn = parse('a = 5');
// asgn.isAssignmentNode === true
// asgn.name === 'a'
// asgn.value: Node  (ConstantNode 5)
```

---

## Custom traversal example

Count the number of operations in an expression:

```typescript
import { parse } from '@danielsimonjr/mathts-functions';

function countOps(expr: string): number {
  const node = parse(expr);
  let count = 0;
  node.forEach(function recurse(child) {
    if (child.isOperatorNode || child.isFunctionNode) count++;
    child.forEach(recurse);
  });
  return count;
}

countOps('2 + 3'); // 1
countOps('sin(x) + cos(x)'); // 3
```

## Substituting variables symbolically

Replace a SymbolNode with a subtree using `transform`:

```typescript
import { parse } from '@danielsimonjr/mathts-functions';

const f = parse('x^2 + x + 1');

// Substitute x -> (y + 1)
const substituted = f.transform((node) => {
  if (node.isSymbolNode && node.name === 'x') {
    return parse('y + 1');
  }
  return node;
});

substituted.toString(); // '(y + 1) ^ 2 + (y + 1) + 1'
```

---

## Building trees manually

Node constructor factories (`createConstantNode`, `createSymbolNode`, etc.) are
exported from `@danielsimonjr/mathts-expression`. You rarely need these directly —
use `parse()` instead — but they are useful for programmatic tree construction.
Each factory must first be called with its dependencies to produce the actual node
constructor; in practice `parse()` does this bootstrapping for you:

```typescript
import { parse } from '@danielsimonjr/mathts-functions';

// Build sqrt(2 + x)
const root = parse('sqrt(2 + x)');

root.toString(); // 'sqrt(2 + x)'
```

In practice, use `parse('sqrt(2 + x)')` — it produces the same tree in one step.
