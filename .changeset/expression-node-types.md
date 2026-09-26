---
'@danielsimonjr/mathts-expression': patch
---

Public type fixes for the expression tree, with no runtime change.

- **Every node class now has the base `Node` members in its type.** Seven node files (`IndexNode`, `ObjectNode`, `OperatorNode`, `ParenthesisNode`, `RangeNode`, `RelationalNode`, `SymbolNode`) typed their `Node` dependency with a local stub interface. At runtime each class extends the real `Node`, but its declared type inherited only the stub, so `equals`, `traverse`, `evaluate`, `compile` and more were missing and a `SymbolNode` was not assignable to `Node`. They now extend the real `MathNode` type, like the other node classes, and nine `@ts-expect-error`s that existed only because of the stub are gone.
- **`parse` has precise overloads.** `parse(string)` returns a node and `parse(string[])` returns an array of nodes. The single `string | string[]` signature made every result a `MathNode | MathNode[]` that callers had to narrow.
- **The `isConstantNode` and `isSymbolNode` guards narrow to shapes that include `value` and `name`.**
