# Rust → AssemblyScript WASM Parity

**Generated**: 2026-06-26 (by tools/create-dependency-graph)

Grounded diff of the Rust kernels the `functions` bridges actually consume against the AssemblyScript binary's export table (the migration target). Sources: Rust `functions/dist/wasm/mathts.wasm` (1122 exports), AS `matrix/dist/wasm/mathts-as.wasm` (324 exports). Regenerate / guard with `npx tsx tools/create-dependency-graph/create-dependency-graph.ts --check-wasm-parity`.

| Metric | Count |
| --- | --: |
| Consumed Rust kernels | 60 |
| Covered by AS (direct + rename) | 60 |
| Authoring gap (missing in AS) | 0 |

## Gap — consumed Rust kernels missing from AS

_None — AS covers every consumed Rust kernel._

## Rename mappings used (consumed Rust name → AS export name)

| Consumed Rust kernel | AS export |
| --- | --- |
| `bitAndArray` | `bitAnd_i32_array` |
| `bitNotArray` | `bitNot_i32_array` |
| `bitOrArray` | `bitOr_i32_array` |
| `bitXorArray` | `bitXor_i32_array` |
| `leftShiftArrayPerElement` | `leftShift_i32_array` |
| `rightArithShiftArrayPerElement` | `rightArithShift_i32_array` |
| `rightLogShiftArrayPerElement` | `rightLogShift_i32_array` |
| `simd_abs_array` | `array_abs_ptr` |
| `simd_atan_array` | `array_atan_ptr` |
| `simd_atanh_array` | `array_atanh_ptr` |
| `simd_cos_array` | `array_cos_ptr` |
| `simd_cot_array` | `array_cot_ptr` |
| `simd_csc_array` | `array_csc_ptr` |
| `simd_erfc_array` | `array_erfc_ptr` |
| `simd_exp_array` | `array_exp_ptr` |
| `simd_expm1_array` | `array_expm1_ptr` |
| `simd_log10_array` | `array_log10_ptr` |
| `simd_log1p_array` | `array_log1p_ptr` |
| `simd_log2_array` | `array_log2_ptr` |
| `simd_log_array` | `array_log_ptr` |
| `simd_sec_array` | `array_sec_ptr` |
| `simd_sin_array` | `array_sin_ptr` |
| `simd_sinh_array` | `array_sinh_ptr` |
| `simd_tan_array` | `array_tan_ptr` |
| `simd_tanh_array` | `array_tanh_ptr` |

## Consumed kernels per bridge

| Bridge | Consumed | Gap |
| --- | --: | --: |
| `bitwise` | 7 | 0 |
| `elementwise` | 18 | 0 |
| `interpolation` | 2 | 0 |
| `poly` | 7 | 0 |
| `signal` | 5 | 0 |
| `sort` | 3 | 0 |
| `special` | 18 | 0 |

> Note: a consumed kernel "covered via rename" already exists in AS under a different name (no authoring needed beyond an alias). The true *authoring* gap is the table above. See docs/roadmap/RUST_TO_AS_MIGRATION_PLAN.md (Phase 0/2).
