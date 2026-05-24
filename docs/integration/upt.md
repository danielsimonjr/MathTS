# UPT Integration Notes

> Companion notes for **Universal Physics Tensor (UPT)**, the downstream
> physics framework that consumes MathTS. Tracks the API surfaces UPT
> depends on, answers the three open questions raised in UPT's
> [v0.70 proposal](https://github.com/danielsimonjr/universal-physics-tensor/blob/master/docs/planning/UPT%20v0.70%20-%20Proposals.md)
> §10.2, and points at the demonstration tests that pin each answer.

## Headline

**No upstream MathTS PRs are required for UPT v0.7+.** Per the proposal
(§0, §1.1):

> nearly all v0.7 work happens inside the UPT repo, consuming what
> MathTS already ships … MathTS already has every primitive UPT needs.

This document exists so the answer stays true as MathTS evolves. If a
later MathTS change breaks any of the consumed surfaces below, fix it
here first.

## Consumed MathTS APIs (UPT v0.7+)

| UPT proposal              | MathTS package                            | Status  | Key surfaces                                                                             |
| ------------------------- | ----------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| 1 (LabeledTensor)         | `@danielsimonjr/mathts-tensor` v0.1.0     | shipped | `Tensor`, `einsum`, `transpose`, `reshape`, `fromDenseMatrix`, `toDenseMatrix`           |
| 4 (Bridge AST)            | `@danielsimonjr/mathts-expression` v0.2.0 | shipped | `parse`, `compileExpr`, the 16-node AST + `Node` base, `getSafeProperty` sandbox helpers |
| 7 (.mtsw bridges)         | `@danielsimonjr/mathts-workbook` v0.1.2   | shipped | `.mtsw` reactive notebook, `mtsw` CLI (`run` / `validate` / `graph` / `new`)             |
| 8 (Differentiable bridge) | `@danielsimonjr/mathts-autograd` v0.1.0   | shipped | `forwardGrad`, `reverseGrad`, `DualTensor`, `Tape`, `TapedTensor`                        |
| (implicit, all)           | `@danielsimonjr/mathts-functions`         | shipped | `evaluate` sandbox, 500+ typed functions, 52 CODATA constants                            |
| (implicit, heavy)         | `@danielsimonjr/mathts-parallel`          | shipped | `ComputePool` + `thresholdByOp` map, three-tier WASM/worker/in-process dispatch          |

Reading order before any UPT PR lands: confirm each consumed export
still exists in `<package>/src/index.ts` of the relevant package, since
the typed-layer expansion has reshaped some surfaces (e.g. `WASMBackend`
is now AS-only after the Rust/AS split — Rust callers use the separate
`RustWASMBackend`).

## Open questions from UPT v0.70 §10.2

### Q1. Does `mathts-expression`'s AST tolerate downstream node extensions?

**Yes**, by design. The `Node` base class is parameterised on a
`mathWithTransform` scope via the existing factory pattern at
`expression/src/node/Node.ts`. Downstream consumers call
`createNode({mathWithTransform})` to obtain the concrete class, then
subclass that class. Every virtual method (`_compile`, `forEach`, `map`,
`_toString`, `toJSON`, `clone`) is designed to be overridden — the
base implementations throw `Method <name> must be implemented by type
<this.type>`, which is the standard pattern for an abstract-by-
documentation base.

Concrete pattern, demonstrated in
[`expression/tests/node-extension.test.ts`](../../expression/tests/node-extension.test.ts):

```ts
import { createNode } from '@danielsimonjr/mathts-expression';

const Node = createNode({ mathWithTransform: myMathScope });

class BridgeEquationNode extends Node {
  static name = 'BridgeEquationNode';
  get type() { return 'BridgeEquationNode'; }
  get isBridgeEquationNode() { return true; }

  constructor(public child: Node, public domain: string) {
    super();
  }

  _compile(math, argNames) { /* … */ }
  forEach(callback)        { callback(this.child, 'child', this); }
  map(callback)            { /* return new BridgeEquationNode(...) */ }
  clone()                  { return new BridgeEquationNode(this.child, this.domain); }
  _toString()              { return `bridge<${this.domain}>(${this.child.toString()})`; }
  toJSON()                 { return { mathjs: 'BridgeEquationNode', ... }; }
}
```

That test covers the eight conformance points UPT cares about:
`isNode` duck-type guard, custom type discriminator, `forEach`/`map`/
`traverse`/`clone`/`toJSON`/`_toString`. All eight pass — UPT may
ship a `BridgeEquationNode` (and any other physics-AST node) with
confidence that the parser, evaluator, tree-walking helpers, and JSON
round-trip work on it.

### Q2. What's the dimensional-analysis story at the `Tensor` level?

**Intentionally absent in MathTS.** `Tensor` is the canonical numeric
primitive — rank-N, `Float64Array`-backed, unit-free. Dimensional
analysis is a UPT-layer concern; the proposal itself acknowledges this
under §1.3 ("not dimensional analysis on Tensor — this remains a UPT-
only layer").

If a future MathTS version wants to add dimensional analysis, the
natural shape is a thin wrapper type — `UnitTensor` or `DimensionalTensor`
— that holds a `Tensor` plus a `Dimensions` descriptor. The wrapper
delegates math to the wrapped `Tensor` and propagates dimensions per
op. Doing this in MathTS would be a substantial API addition and is
not on the roadmap. UPT continues to own this layer.

### Q3. Does `mathts-autograd` work through WASM-accelerated kernels?

**Yes** — the `Tape` doesn't care about the forward-pass strategy. It
records ops as `(inputIds, outputSize, backwardClosure)` triples and
replays the backward closures in reverse during `tape.backward(...)`.
The forward op can execute through any of:

- In-process JS (`parallel/src/ops/<op>.ts`)
- ComputePool worker pool (above `thresholdByOp[<op>]`)
- WASM kernel (Rust or AS) when the dispatched op has a WASM
  implementation and the input is large enough to amortise the
  marshal cost (see `functions/src/wasm/bitwise/wasm-bridge.ts` for
  the bitwise example; `WASM_BITWISE_THRESHOLD = 64 × 1024`).

The backward closure must supply the analytical adjoint for the op
that ran. The autograd tape does not inspect the forward op's
implementation; it only consumes the produced primal `Float64Array`
and replays the supplied adjoint.

Demonstrated in
[`autograd/tests/ad-wasm-interop.test.ts`](../../autograd/tests/ad-wasm-interop.test.ts):

```ts
// FORWARD via ComputePool — this is the same dispatch surface a
// WASM-routed matmul / besselJ / etc. would traverse.
const { result } = await computePool.add(a, b);

// Record the op on the tape with the analytical adjoint.
const { id: outputId } = tape.record([aLeaf.id, bLeaf.id], result.length, (outputGrad) => {
  for (let i = 0; i < outputGrad.length; i++) {
    aLeaf.gradSlot[i] += outputGrad[i]; // dA = dY for elementwise add
    bLeaf.gradSlot[i] += outputGrad[i]; // dB = dY
  }
});

tape.backward(outputId, cotangent);
```

The test covers three forward ops (`add`, `multiply`, chained
`add → scale`) and verifies gradients against closed-form adjoints.

**Caveat for UPT:** `TapedTensor` currently exposes high-level
`add` / `sub` / `mul` / `scale` methods but NOT `matmul`. If UPT
needs first-class matmul AD ergonomics, the project can either
contribute a `TapedTensor.matmul` upstream (the adjoint is well-
known: `dA = dY·Bᵀ`, `dB = Aᵀ·dY`) or use the low-level
`Tape.record(inputIds, outputSize, backward)` mechanism shown in
the demonstration test.

## Versioning + release pinning

The MathTS `[Unreleased]` CHANGELOG section is large and uncut as of
2026-05-23. UPT is currently consuming `next` / git-HEAD across the
five packages. The CHANGELOG "Open Actions" item #1 (TODO.md) is to
cut a labelled release (likely `0.2.0`) so UPT can pin a stable
version range. Until that lands, UPT should treat MathTS HEAD as the
working contract.

## Related docs

- [MathTS README](../../README.md) — quick-start, performance numbers,
  three-tier dispatch.
- [Migration guide](../migration-guide.md) — for users moving from
  upstream `mathjs` v15 to MathTS; covers the typed-function API,
  parallel overloads, and the WebGPU opt-in.
- [Architecture overview](../Architecture/OVERVIEW.md) and
  [ARCHITECTURE.md](../Architecture/ARCHITECTURE.md) — package layout,
  dispatch tiers, and the AllocatorKind / WASMBackend / RustWASMBackend
  split.
- [TODO.md](../../TODO.md) — current open actions and documented non-
  decisions.
