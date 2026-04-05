# MathTS Scientific Workbook Format Specification

## `.mtsw` — MathTS Scientific Workbook

**Version**: 1.0.0-draft  
**Author**: Daniel Simon Jr. (@danielsimonjr)  
**Date**: December 2025  
**Inspired by**: ipyaml, Maple, Mathematica, Observable, marimo

---

## Executive Summary

The MathTS Scientific Workbook (`.mtsw`) is a YAML-based, human-readable, Git-friendly document format designed for scientific computing. It combines:

- **Maple/Mathematica-style** symbolic and numeric computation
- **Three.js-quality** 3D visualization
- **Reactive execution** (à la Observable/marimo)
- **Publication-ready output** (LaTeX, PDF, HTML)
- **TypeScript-native** runtime (no Python dependency)

The format is designed specifically for theoretical physics research, tensor mathematics, and the **Universal Physics Tensor Framework (UPTF)**.

---

## Design Principles

1. **Human-First**: Readable and editable in any text editor
2. **Git-Friendly**: Clean diffs, mergeable, no binary blobs
3. **Web-Native**: Runs in browser via MathTS + WebGPU/WASM
4. **Reactive**: Cell dependency graph with automatic re-execution
5. **Beautiful**: LaTeX math, Three.js visuals, publication quality
6. **Extensible**: Plugin system for custom cell types and renderers

---

## File Format

### Extension & MIME Type

- **Extension**: `.mtsw` or `.mtsw.yaml`
- **MIME Type**: `application/vnd.mathts.workbook+yaml`
- **Encoding**: UTF-8 (required for mathematical symbols)

---

## Document Structure

```yaml
version: "1.0"

metadata:
  title: "Workbook Title"
  author: "Author Name"
  created: 2025-12-05T20:00:00Z
  modified: 2025-12-05T21:30:00Z
  description: "Description of the workbook"
  tags: [tag1, tag2, tag3]
  license: MIT

runtime:
  engine: mathts           # mathts | python | julia
  version: ">=1.0.0"
  packages:
    - "@danielsimonjr/mathts-core"
    - "@mathts/tensor"
  execution: reactive      # reactive | sequential | manual

cells:
  # Cell definitions...

outputs:
  # Cached execution results (optional, can be gitignored)
```

---

## Cell Types

### 1. Markdown Cell
```yaml
- markdown: |
    # Heading
    
    This is **bold** and $x^2$ is inline math.
    
    $$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$
  id: intro
```

### 2. Code Cell (TypeScript)
```yaml
- code: |
    import { Matrix } from '@danielsimonjr/mathts-core';
    
    const A = Matrix.random(3, 3);
    const det = A.determinant();
    
    console.log('det(A) =', det);
    export { A, det };
  id: matrix-calc
  language: typescript
  depends_on: [some-other-cell]
```

### 3. Tensor Cell (Einstein Notation)
```yaml
- tensor: |
    # Metric tensor
    g_{μν} = diag(-1, 1, 1, 1)
    
    # Christoffel symbols
    Γ^α_{βγ} = (1/2) g^{αδ} (∂_β g_{δγ} + ∂_γ g_{βδ} - ∂_δ g_{βγ})
  id: metric-def
  notation: einstein
```

### 4. Equation Cell (LaTeX)
```yaml
- equation: |
    \frac{d^2 x^\mu}{d\tau^2} + \Gamma^\mu_{\alpha\beta} 
    \frac{dx^\alpha}{d\tau} \frac{dx^\beta}{d\tau} = 0
  id: geodesic-eq
  label: eq:geodesic
  numbered: true
```

### 5. Visualization Cell (Three.js / D3)
```yaml
- visualization: |
    import { Scene, Mesh } from '@mathts/viz';
    
    const scene = new Scene({ renderer: 'webgpu' });
    scene.add(Mesh.sphere({ radius: 1 }));
    scene.render();
  id: viz-3d
  renderer: threejs
  interactive: true
  export_formats: [png, svg, gltf]
```

### 6. Data Cell
```yaml
- data: |
    initial_conditions:
      x0: 10.0
      v0: 0.1
    constants:
      G: 6.674e-11
      c: 2.998e8
  id: params
  format: yaml
```

### 7. Test Cell
```yaml
- test: |
    import { assert, almostEqual } from '@mathts/test';
    import { det } from '#matrix-calc';
    
    assert(det !== 0, 'Matrix should be invertible');
    almostEqual(det, expected, 1e-10);
  id: verify-calc
  timeout: 5000
  critical: true
```

### 8. Export Cell
```yaml
- export: |
    exportFigure('#viz-3d', { format: 'pdf', dpi: 300 });
    exportEquations(['#geodesic-eq'], { format: 'latex' });
  id: pub-export
  on_save: true
```

---

## Dependency & Reactivity

### Explicit Dependencies
```yaml
- code: |
    import { result } from '#previous-cell';
  id: next-cell
  depends_on: [previous-cell]
```

### Auto-Detection
The runtime analyzes `import ... from '#cell-id'` patterns to build the dependency graph automatically.

### Execution Modes
- **reactive**: Cells re-run when dependencies change
- **sequential**: Cells run top-to-bottom
- **manual**: Cells only run when explicitly triggered

---

## CLI Commands

```bash
# Create new workbook
mtsw new "My Workbook" --template tensor-physics

# Run workbook
mtsw run workbook.mtsw

# Run specific cell
mtsw run workbook.mtsw --cell metric-def

# Watch mode
mtsw watch workbook.mtsw

# Validate
mtsw validate workbook.mtsw

# Show dependency graph
mtsw graph workbook.mtsw --format mermaid

# Strip outputs for Git
mtsw strip workbook.mtsw > workbook-clean.mtsw

# Export
mtsw export workbook.mtsw --format html
mtsw export workbook.mtsw --format pdf
mtsw export workbook.mtsw --format ipynb

# Interactive server
mtsw serve workbook.mtsw --port 3000
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Scientific Workbook UI                        │
│         (Monaco editor + reactive cells + LaTeX render)          │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌─────────────────┐    ┌───────────────────┐
│   Expression  │    │  Visualization  │    │  Document Export  │
│    Engine     │    │     Engine      │    │  (PDF, LaTeX)     │
└───────┬───────┘    └────────┬────────┘    └───────────────────┘
        │                     │
        └──────────┬──────────┘
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MathTS Core                              │
│    Tensors · Matrices · Symbolic · Numeric · WASM · WebGPU      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Comparison with Existing Formats

| Feature | `.mtsw` | ipyaml | Jupyter | Maple | Observable |
|---------|---------|--------|---------|-------|------------|
| Human-readable | ✅ YAML | ✅ YAML | ❌ JSON | ❌ Binary | ✅ JS |
| Git-friendly | ✅ | ✅ | ❌ | ❌ | ✅ |
| Reactive | ✅ | ❌ | ❌ | Partial | ✅ |
| Tensor notation | ✅ Native | ❌ | ❌ | ✅ | ❌ |
| 3D Visualization | ✅ Three.js | ❌ | Via libs | ✅ | Via libs |
| WASM/GPU accel | ✅ | ❌ | ❌ | ❌ | ❌ |
| TypeScript native | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## Implementation Status

The scaffolding includes:

- [x] **Type definitions** (`src/types.ts`)
- [x] **YAML parser/serializer** (`src/parser/index.ts`)
- [x] **Dependency graph builder** (`src/runtime/graph.ts`)
- [x] **Cell executor** (`src/runtime/executor.ts`)
- [x] **CLI tool** (`src/cli.ts`)
- [x] **Example workbook** (`examples/schwarzschild-geodesics.mtsw`)
- [ ] MathTS integration
- [ ] Three.js visualization bindings
- [ ] Web UI (Monaco + reactive rendering)
- [ ] LaTeX/PDF export

---

## Next Steps

1. **Review this spec** — Does it capture the vision?
2. **Create the MathTS repo** — Integrate workbook package
3. **Build tensor engine** — WASM-accelerated computation
4. **Add visualization** — Three.js bindings
5. **Build web UI** — Monaco editor + reactive cells
