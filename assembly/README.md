# @danielsimonjr/mathts-wasm

High-performance WebAssembly module for MathTS, built with AssemblyScript.

## Features

- **SIMD Acceleration**: Utilizes WebAssembly SIMD for vectorized operations
- **Zero-Copy Operations**: Works directly on typed arrays for minimal overhead
- **Comprehensive Math**: Scalar, array, matrix, and complex number operations
- **Cross-Platform**: Works in browsers, Node.js, Deno, and edge runtimes

## Building

```bash
# Install dependencies
npm install

# Build debug WASM (with debugging info)
npm run asbuild:debug

# Build release WASM (optimized)
npm run asbuild:release

# Build both
npm run asbuild
```

## Usage

The published entry is AssemblyScript-generated glue in `build/mathts.js` (see
`package.json` `exports["."]`). Import named functions directly:

```typescript
import { add_f64, sqrt_f64, sin_f64 } from '@danielsimonjr/mathts-wasm';

console.log(add_f64(2, 3)); // 5
console.log(sqrt_f64(16)); // 4
console.log(sin_f64(Math.PI / 2)); // 1
```

`matrix` and `functions` load the same binary as `mathts-as.wasm` via their own
loaders and SHA-384 verification (`core/src/wasm-loader.ts`).

### Dense decompositions (AS exports)

From `algebra/decomposition.ts` (used by matrix `WASMBackend` tests, not public
`lu()`/`qr()` in JS):

- `matrix_lu_decompose`, `matrix_qr_decompose`, `matrix_cholesky`,
  `matrix_inverse`, `matrix_determinant`

Call `heap_reset` after managed sequences when using bump-allocated scratch
(`heap.ts`). The **functions** WASM bridges call it after each managed call;
matrix does not — it pools buffers.

## Module Structure

```
assembly/
├── src/
│   ├── index.ts              # AS export surface
│   ├── algebra/decomposition.ts
│   ├── elementwise.ts, heap.ts, poly.ts, signal.ts, sort.ts, special.ts, tridiag.ts
│   ├── types/complex.ts
│   └── ops/                  # scalar, array, matrix, complex-ops, fft, …
├── build/                    # mathts.wasm, mathts.js, mathts.d.ts
├── tests/run.js              # debug wasm smoke tests
└── package.json
```

## Available Operations

### Scalar Operations

- Basic: `add_f64`, `sub_f64`, `mul_f64`, `div_f64`, `mod_f64`, `neg_f64`
- Power: `sqrt_f64`, `pow_f64`, `square_f64`, `cube_f64`, `cbrt_f64`
- Exp/Log: `exp_f64`, `log_f64`, `log10_f64`, `log2_f64`
- Trig: `sin_f64`, `cos_f64`, `tan_f64`, `asin_f64`, `acos_f64`, `atan_f64`
- Hyperbolic: `sinh_f64`, `cosh_f64`, `tanh_f64`, `asinh_f64`, `acosh_f64`, `atanh_f64`
- Rounding: `abs_f64`, `floor_f64`, `ceil_f64`, `round_f64`, `trunc_f64`

### Array Operations

- Reductions: `array_sum`, `array_product`, `array_mean`, `array_variance`, `array_min`, `array_max`
- Norms: `array_norm`, `array_norm_l1`, `array_norm_linf`
- Element-wise: `array_add`, `array_sub`, `array_mul`, `array_div`, `array_scale`
- BLAS-like: `array_dot`, `array_axpby`, `array_distance`

### Matrix Operations

- Creation: `matrix_zeros`, `matrix_ones`, `matrix_identity`, `matrix_diag`
- Arithmetic: `matrix_add`, `matrix_sub`, `matrix_scale`, `matrix_multiply`
- Properties: `matrix_trace`, `matrix_norm_frobenius`, `matrix_transpose`
- BLAS: `matrix_gemm`, `matrix_gemv`, `matrix_axpy`

### Complex Operations

- Arithmetic: `complex_add`, `complex_sub`, `complex_mul`, `complex_div`
- Functions: `complex_exp`, `complex_log`, `complex_sqrt`, `complex_pow`
- Trig: `complex_sin`, `complex_cos`, `complex_tan`, `complex_asin`, `complex_acos`
- Properties: `complex_abs`, `complex_arg`, `complex_conj`

## Performance Notes

1. **SIMD**: Enabled by default for vector operations
2. **Memory Layout**: Matrices use row-major order
3. **Complex Arrays**: Use interleaved storage `[re0, im0, re1, im1, ...]`

## Testing

```bash
npm run asbuild          # release + debug (npm test needs release for test:diff)
npm test                 # tests/run.js (debug wasm) + nine kernel tests + test:diff (release wasm)
```

## License

MIT
