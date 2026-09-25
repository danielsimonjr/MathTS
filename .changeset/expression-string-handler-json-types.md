---
'@danielsimonjr/mathts-expression': patch
---

More public type fixes for the expression tree, with no runtime change. Type-checking the package's own tests found them.

- **A `toString`/`toTex`/`toHTML` handler can return `undefined`.** `StringOptions.handler` was typed to return `string`, but the nodes already fall back to their default output when a handler returns `undefined`, and mathjs documents that use: a handler customises some nodes and returns nothing for the rest. The return type is now `string | undefined`.
- **`IndexNode#toJSON` and `OperatorNode#toJSON` return their exact JSON shape.** They returned `Record<string, unknown>`, so `IndexNode.fromJSON(node.toJSON())` did not type-check and `json.op` was `unknown`. They now declare their fields, like the other node classes.
