# @danielsimonjr/mathts-autograd API Reference

Automatic differentiation over `@danielsimonjr/mathts-tensor`'s `Tensor` —
**forward-mode** (dual numbers, `DualTensor`) and **reverse-mode** (tape-based,
`Tape` / `TapedTensor`) — plus a JAX-style `grad` / `valueAndGrad` /
`derivative` / `jacobian` convenience layer.

## Installation

```bash
npm install @danielsimonjr/mathts-autograd
```

## Overview

Both `DualTensor` and `TapedTensor` source their elementary-function
primal/derivative pairs from core's shared `DUAL_UNARY_RULES` table, keeping
forward-mode, reverse-mode, and the scalar `Dual` type in lock-step.

> Functions passed to `forwardGrad` / `reverseGrad` / the JAX layer must be
> written using `Tensor` / `TapedTensor` methods (add/sub/mul/scale/...) — NOT
> the plain `@danielsimonjr/mathts-functions` ops, since only these are
> AD-instrumented.

```typescript
import { grad, valueAndGrad, derivative, jacobian } from '@danielsimonjr/mathts-autograd';
```

## Forward Mode

### DualTensor

A primal + tangent `Float64Array` pair of matching `shape`.

```typescript
import { DualTensor } from '@danielsimonjr/mathts-autograd';
```

#### Constructor

```typescript
new DualTensor(shape: number[], primal: Float64Array, tangent: Float64Array)
```

#### Static & Conversion

| Method            | Signature                              | Description                        |
| ----------------- | -------------------------------------- | ---------------------------------- |
| `fromTensor`      | `(t: Tensor) => DualTensor`            | Zero tangent                       |
| `unitAt`          | `(t: Tensor, i: number) => DualTensor` | Unit tangent at flat-index `i`     |
| `toPrimalTensor`  | `() => Tensor`                         | Extract the primal                 |
| `toTangentTensor` | `() => Tensor`                         | Extract the tangent                |
| `data` (getter)   | `Float64Array`                         | Returns primal (structural compat) |

#### Operations

| Method   | Signature                           | Description                                    |
| -------- | ----------------------------------- | ---------------------------------------------- |
| `add`    | `(other: DualTensor) => DualTensor` | Addition                                       |
| `sub`    | `(other: DualTensor) => DualTensor` | Subtraction                                    |
| `mul`    | `(other: DualTensor) => DualTensor` | Product rule (with `this === other` fast path) |
| `scale`  | `(k: number) => DualTensor`         | Scalar multiply                                |
| `divide` | `(other: DualTensor) => DualTensor` | Quotient rule                                  |

Elementary functions (each following the dual-number chain rule, ~24 ops):
`exp`, `log`, `sin`, `cos`, `tan`, `sqrt`, `square`, `reciprocal`, `abs`,
`pow(k)`, `sinh`, `cosh`, `tanh`, `asin`, `acos`, `atan`, `asinh`, `acosh`,
`atanh`, `log2`, `log10`, `log1p`, `expm1`, `cbrt`, `sign`, `atan2(other)`.

### forwardGrad

```typescript
forwardGrad(fn: (x: Tensor) => Tensor, x: Tensor): { value: Tensor; jacobian: ... }
```

Full Jacobian via one `DualTensor` trace per input flat-index. `fn` must be
traceable (only add/sub/mul/scale-composed ops).

## Reverse Mode

### Tape

The reverse-mode op-recording graph.

```typescript
import { Tape } from '@danielsimonjr/mathts-autograd';
```

| Method         | Signature                                                        | Description                         |
| -------------- | ---------------------------------------------------------------- | ----------------------------------- |
| `allocate`     | `(size: number) => {id, gradSlot}`                               | Allocate a graph node               |
| `record`       | `(inputIds, outputSize, backward: BackwardFn) => {id, gradSlot}` | Record an op + its backward closure |
| `backward`     | `(outputId, outputGrad) => void`                                 | Seed + replay in reverse            |
| `getInputGrad` | `(id) => Float64Array`                                           | Read an input's accumulated grad    |

### TapedTensor

A reverse-mode tensor node wrapping a `Tape`.

```typescript
import { TapedTensor } from '@danielsimonjr/mathts-autograd';
```

#### Constructor

```typescript
new TapedTensor(shape, primal, tape, id, axisLabels?)
```

#### Statics & Conversion

| Method              | Signature                                | Description                   |
| ------------------- | ---------------------------------------- | ----------------------------- |
| `fromTensorAsInput` | `(t: Tensor, tape: Tape) => TapedTensor` | Register a Tensor as an input |
| `toPrimalTensor`    | `() => Tensor`                           | Extract the primal            |

#### Operations

| Method         | Signature                             | Description                                                    |
| -------------- | ------------------------------------- | -------------------------------------------------------------- |
| `add`/`sub`    | `(other: TapedTensor) => TapedTensor` | Addition / subtraction                                         |
| `mul`/`divide` | `(other: TapedTensor) => TapedTensor` | Multiplication / division                                      |
| `scale`        | `(k: number) => TapedTensor`          | Scalar multiply                                                |
| `contract`     | `(other: TapedTensor) => TapedTensor` | Reverse-mode AD over `Tensor.contract` (named-index)           |
| `matmul`       | `(other: TapedTensor) => TapedTensor` | Batched matmul adjoint (`dA = dY·Bᵀ`, `dB = Aᵀ·dY`)            |
| `tensordot`    | `(other, axes) => TapedTensor`        | General adjoint (Townsend 2016 / PyTorch `TensorDotBackward0`) |

Reductions: `sum`, `mean`, `prod`, `max`, `min(axis?, {keepDims?})`, and
`norm(opts?: {p: 1 | 2 | 'fro' | 'inf', axis?, keepDims?})` (first-wins
tie-break for max/min/inf-norm gradient scatter).

Elementary functions (each with a documented adjoint, ~26 ops): `log`, `exp`,
`sin`, `cos`, `tan`, `sqrt`, `square`, `pow(k: number | TapedTensor)`,
`reciprocal`, `abs`, `sinh`, `cosh`, `tanh`, `asin`, `acos`, `atan`, `asinh`,
`acosh`, `atanh`, `log2`, `log10`, `log1p`, `expm1`, `cbrt`, `sign`,
`atan2(other)`.

Matrix-calculus adjoints:

| Method | Signature                                            | Description                                                                         |
| ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `svd`  | `() => {U, S, V}`                                    | Reverse-mode AD over full rank-2 SVD (degeneracy-masked subgradient, REL_TOL=1e-10) |
| `eig`  | `(opts: {symmetric: boolean}) => {eigvals, eigvecs}` | Reverse-mode AD over rank-2 eigendecomposition (symmetric or real-diagonalizable)   |

### reverseGrad

```typescript
reverseGrad(fn: (x: Tensor) => Tensor, x: Tensor, cotangent?: Tensor): { value; gradient }
```

Vector-Jacobian product (VJP); default cotangent is ones-like the value.

## JAX-Style Convenience Layer

Operates on `TapedTensor`-using functions over plain numeric input.

```typescript
import { grad, valueAndGrad, derivative, jacobian } from '@danielsimonjr/mathts-autograd';
```

| Function       | Signature                                             | Description                                        |
| -------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `valueAndGrad` | `(fn: ScalarFn, x: NumericInput) => {value, grad}`    | `fn` must return a length-1 (scalar) `TapedTensor` |
| `grad`         | `(fn: ScalarFn) => (x: NumericInput) => Float64Array` | Gradient function                                  |
| `derivative`   | `(fn: ScalarFn, x0: number) => number`                | Scalar derivative                                  |
| `jacobian`     | `(fn: ScalarFn, x: NumericInput) => number[][]`       | Full Jacobian (one reverse pass per output row)    |

## Types

| Type           | Definition                                    |
| -------------- | --------------------------------------------- |
| `ScalarFn`     | `(x: TapedTensor) => TapedTensor`             |
| `NumericInput` | `number \| readonly number[] \| Float64Array` |

## Example

```typescript
import { grad, valueAndGrad, jacobian } from '@danielsimonjr/mathts-autograd';

// f(x) = sum(x^2)  →  grad = 2x
const f = (x) => x.square().sum();

const g = grad(f);
console.log(Array.from(g([1, 2, 3]))); // [2, 4, 6]

const { value, grad: gradient } = valueAndGrad(f, [1, 2, 3]);
console.log(value); // 14

// Jacobian of a vector-valued function
const J = jacobian((x) => x.mul(x), [1, 2, 3]);
```
