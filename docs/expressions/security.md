# Security

The MathTS expression evaluator is designed to execute untrusted math expressions safely.
This page describes the safety model, its guarantees, and its limits.

---

## The safety model

The evaluator is a **tree-walking interpreter**. When you call `evaluate('expr')`:

1. The parser reads the string and builds an AST (abstract syntax tree).
2. The compiler walks the AST and produces a pure JavaScript closure for each node.
3. The closure is called with a scope that contains only the math namespace.

At no point does the evaluator call:
- `eval()`
- `new Function()`
- `setTimeout` / `setInterval`
- Any Node.js built-in (`fs`, `process`, `require`, etc.)

This is fundamentally safer than approaches that compile expressions to JavaScript code
and then execute that code string, because there is no string-to-code boundary.

---

## Scope isolation

The math scope passed to the evaluator contains only math functions and constants.
User code cannot reach:

- The global JavaScript environment (`window`, `globalThis`)
- Node.js built-ins (`process`, `require`, `Buffer`)
- The host application's variables

A user expression can only read and write variables that are explicitly placed in the
scope you provide:

```typescript
import { evaluate } from '@danielsimonjr/mathts-functions';

const scope = { x: 3 };
evaluate('x * 2', scope);    // 6 — reads x from scope
evaluate('y = 99', scope);   // 99 — writes y to scope
scope.y;                     // 99

// Cannot escape scope:
evaluate('process.exit(1)'); // throws: Undefined symbol 'process'
evaluate('globalThis');      // throws: Undefined symbol 'globalThis'
```

---

## What expressions can do

| Action | Allowed | Notes |
|---|---|---|
| Arithmetic | Yes | All operators |
| Call math functions | Yes | Functions in the math scope only |
| Read scope variables | Yes | Only variables you placed there |
| Write scope variables | Yes | Only to the scope you passed |
| Define functions | Yes | Stored in scope, pure closures |
| Access JavaScript globals | No | Not in scope |
| Call arbitrary JS code | No | No code generation |
| Import modules | No | `import` is not an operator |
| Access the file system | No | Not in scope |
| Infinite loops | Partially | `for`/`while` don't exist; recursion can stack-overflow |

---

## High-risk expression functions

Certain math functions accept expressions as arguments and re-parse them internally.
Be especially careful when exposing these to untrusted users:

- `simplify(expr)` — parses arbitrary input into a manipulable AST
- `derivative(expr, variable)` — same
- `rationalize(expr)` — same
- `parse(expr)` — direct AST construction from user input

These functions are no less safe than `evaluate` from a sandbox perspective — they
use the same tree-walking evaluator. However, they expose more attack surface because
they accept expression strings and can be used to construct large ASTs that consume
memory or CPU.

### Mitigating expression DoS

To limit resource consumption from untrusted input:

```typescript
// Set a maximum expression length before parsing
function safeEvaluate(expr: string, scope?: Record<string, any>) {
  if (expr.length > 1000) throw new Error('Expression too long');
  return evaluate(expr, scope);
}
```

Consider running untrusted evaluation in a Web Worker or worker_threads context
with a timeout if expressions come from end users in a server context.

---

## Compared to mathjs

mathjs v4+ uses the same tree-walking approach and also avoids `eval()`.
MathTS matches that security model. The key difference is that MathTS's evaluator
is a standalone module (`@danielsimonjr/mathts-expression`) with no dependency on
a global `math` instance, so the scope boundary is explicit at the call site.

---

## Summary

- No `eval()` or `new Function()` — no string-to-code attack surface.
- Scope is isolated — user expressions cannot reach JavaScript globals.
- Safe to run untrusted math expressions with the default scope.
- Add expression-length limits and worker-thread timeouts for server-side use.
