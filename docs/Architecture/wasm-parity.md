# WASM Bridge Kernel Parity

**Generated**: 2026-06-26 (by tools/create-dependency-graph)

Grounded diff of the kernels the `functions` bridges actually consume against the AssemblyScript binary's export table. Source: AS `matrix/dist/wasm/mathts-as.wasm` (324 exports). Regenerate / guard with `npx tsx tools/create-dependency-graph/create-dependency-graph.ts --check-wasm-parity`.

| Metric | Count |
| --- | --: |
| Consumed kernels | 33 |
| Covered by AS (direct + rename) | 33 |
| Authoring gap (missing in AS) | 0 |

## Gap — consumed kernels missing from AS

_None — AS covers every consumed kernel._

## Rename mappings used (consumed name → AS export name)

_None._

## Consumed kernels per bridge

| Bridge | Consumed | Gap |
| --- | --: | --: |
| `interpolation` | 2 | 0 |
| `poly` | 7 | 0 |
| `signal` | 5 | 0 |
| `sort` | 3 | 0 |
| `special` | 16 | 0 |

> Note: a consumed kernel "covered via rename" already exists in AS under a different name (no authoring needed beyond an alias). The true *authoring* gap is the table above.
