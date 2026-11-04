---
'@danielsimonjr/mathts-expression': minor
---

MathML parity: `toMathML()` now typesets AccessorNode, ArrayNode, BlockNode, ConditionalNode, FunctionAssignmentNode, IndexNode, ObjectNode and RangeNode (previously escaped `<mtext>`). `evaluate` keeps a bounded (256) LRU of compiled expressions per namespace and parser, so repeated expressions skip parse, validate and compile. Sandbox hardening: `obj?.method()` no longer probes the member with a raw property read; unsafe names (`__proto__`, `constructor`) are rejected through the sandbox helpers. IndexNode converts BigNumber index values explicitly and throws a RangeError for a non-integer instead of truncating. `access` and `assign` TypeErrors name the offending type. Parser operator tables are built once.
