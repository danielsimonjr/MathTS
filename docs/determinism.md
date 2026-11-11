# Deterministic mode

Deterministic mode makes MathTS give the same float64 bits on every run, whether or not the WASM tier is loaded. Use it for snapshot replay and checksums, for example the PhysJS `checksum()`.

## Turn it on

```ts
import { setDeterministic, isDeterministic } from '@danielsimonjr/mathts-core';

setDeterministic(true);
isDeterministic(); // true
```

The flag is global to the module instance. The default is off. `setDeterministic(false)` restores the normal routing.

## What the mode changes

The mode stops each implicit routing decision that can change bits. A function that has two paths then always takes the JS path, except for the WASM kernels in List A.

| Tier                          | Gate                                                                          | Effect in deterministic mode                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| WASM kernels (`functions`)    | `wasmPolicyAllows`                                                            | Only the List A kernels run. All other kernels use JS. `overrideWasmPolicy` cannot bypass this. |
| Implicit WebGPU (`functions`) | `enableGpu()` and the per-call `gpu` option                                   | Off. The GPU computes in f32, so it cannot match the f64 bits.                                  |
| Worker pool (`parallel`)      | `ComputePool.shouldParallelize`                                               | Always `false`, also with `forceParallel`.                                                      |
| Worker fan-outs (`functions`) | `parallelGaussQuad`, `parallelRomberg`, `sampleN` of the distribution objects | The inline JS path runs.                                                                        |
| Matrix backends (`matrix`)    | `BackendManager.selectBackend`                                                | Always JS, also with `preferredBackend`. This covers `Tensor.matMul`.                           |

The mode has no FMA switch. V8 never fuses `a * b + c` in JS. The AssemblyScript source uses no `fma` and no relaxed-SIMD instruction; its SIMD code uses only `f64x2.add`, `f64x2.mul` and `f64x2.splat`.

## List A: WASM kernel that still runs

This kernel gives the same bits as its JS path. Measured on 2026-11-11 on Node 26: 1,048,576 inputs per kernel, including +0, -0, subnormals, very large and very small values, and NaN. It gave 0 bit differences.

| AS kernel       | Public functions          |
| --------------- | ------------------------- |
| `array_abs_ptr` | `abs` on a `Float64Array` |

The test `functions/tests/deterministic.test.ts` pins this list. When the list changes, measure again and update the test and this table.

## List B: kernels that the mode forces to JS

Each of these kernels gave different bits from its JS path in the same measurement (differences per 1,048,576 values in parentheses):

- Element-wise `sin` (9,002), `cos` (9,641), `log` (1,000), `log10` (17,820), `log1p` (380), `atanh` (623), `sec` (7,504).
- `lgamma` (4,769).
- `sort_f64`, the sort inside `parallelStatMedian`, `parallelStatQuantile` and other users of `sortF64Dispatch`. It gives equal values, but it can put -0 and +0 in a different order from the JS sort.
- The fused chains of `fuseUnaryChain`: `(sin, exp)` (4,532) and `(tanh, expm1)` (411,752).
- The least-squares fits `polyFit`, `chebyshevFit`, `legendreFit` (5 or 6 of 6 coefficients).
- Every other kernel of the WASM dispatch policy, and every bridge that the policy does not list.

## Limits

- The guarantee is for one engine and one engine version. ECMAScript does not specify `Math.sin`, `Math.exp` and the other transcendental functions to the bit. V8, SpiderMonkey and JavaScriptCore can give different results.
- A function that calls `Math.random` without a seed is not deterministic. Give a `seed` where the function accepts one.
- The mode does not gate a tier that you call by name: `gpuMatmul`, `gpuMatrixBackend`, `wasmBackend.*`, direct `computePool.*` calls, and `createScalarBatchPool` or `searchScalars` with a pool.
- `distanceMatrix` has only a worker path. It is not in the guaranteed set.
- A pure-JS function has one path, so it is deterministic on one engine in both modes. Examples are the fixed-size geometry kernels, `solveBoxLcp` and the quaternion functions.
