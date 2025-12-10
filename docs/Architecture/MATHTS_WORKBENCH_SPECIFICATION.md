# MathTS Scientific Workbench Design Specification

## `.mtsw` Format & Runtime Architecture

**Version**: 2.0.0  
**Author**: Daniel Simon Jr. (@danielsimonjr)  
**Date**: December 2025  
**Status**: Draft Specification  
**Purpose**: Complete design specification for the MathTS Scientific Workbench

-----

# Part 1: System Overview & YAML Format Specification

-----

## 1. Executive Summary

The **MathTS Scientific Workbench (MTSW)** is a comprehensive scientific computing environment designed to rival Mathematica and Maple. It consists of:

1. **YAML-based Document Format** (`.mtsw`) — Human-readable, Git-friendly notebook format
1. **Abstract Computation Layer** — Interfaces between YAML cells and MathTS core
1. **Visualization Engines** — MathJax (symbolic), Graphviz (2D graphs), Three.js (3D)
1. **Reactive Runtime** — Dependency-tracked cell execution with live updates
1. **Export Pipeline** — LaTeX, PDF, HTML, Jupyter notebook output

### Design Philosophy

|Principle            |Implementation                       |
|---------------------|-------------------------------------|
|**Human-First**      |YAML is readable without tooling     |
|**Git-Friendly**     |Text-based, diff-able, mergeable     |
|**Web-Native**       |Runs in browser via TypeScript       |
|**Reactive**         |Cells update when dependencies change|
|**Publication-Ready**|Export to LaTeX/PDF quality          |
|**Extensible**       |Plugin architecture for custom cells |

-----

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MTSW Workbench UI                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Monaco Editor  │  │  Output Panel   │  │  Sidebar        │                  │
│  │  (Cell Input)   │  │  (Rendered)     │  │  (Variables)    │                  │
│  └────────┬────────┘  └────────▲────────┘  └────────▲────────┘                  │
│           │                    │                    │                            │
│           ▼                    │                    │                            │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                        Reactive Cell Manager                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │ │
│  │  │ Dependency   │  │ Execution    │  │ State        │  │ Output       │   │ │
│  │  │ Graph        │  │ Scheduler    │  │ Manager      │  │ Cache        │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Abstract Computation Layer                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                          Cell Type Registry                                │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │  │
│  │  │Markdown │ │  Code   │ │ Tensor  │ │Equation │ │  Viz    │ │  Data   │ │  │
│  │  │ Cell    │ │  Cell   │ │  Cell   │ │  Cell   │ │  Cell   │ │  Cell   │ │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ │  │
│  │       │           │           │           │           │           │       │  │
│  │       ▼           ▼           ▼           ▼           ▼           ▼       │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    Cell Compiler / Transpiler                       │  │  │
│  │  │   YAML AST → Intermediate Repr → Executable TypeScript/WASM        │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            ▼                           ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│   Visualization       │   │    MathTS Core        │   │   Export Engine       │
│   Engine Manager      │   │    Computation        │   │                       │
│                       │   │                       │   │                       │
│ ┌───────────────────┐ │   │ ┌───────────────────┐ │   │ ┌───────────────────┐ │
│ │ MathJax Renderer  │ │   │ │ @mathts/symbolic  │ │   │ │ LaTeX Generator   │ │
│ │ (Symbolic Math)   │ │   │ │ Expression Engine │ │   │ │                   │ │
│ └───────────────────┘ │   │ └───────────────────┘ │   │ └───────────────────┘ │
│                       │   │                       │   │                       │
│ ┌───────────────────┐ │   │ ┌───────────────────┐ │   │ ┌───────────────────┐ │
│ │ Graphviz Renderer │ │   │ │ @mathts/tensor    │ │   │ │ PDF Renderer      │ │
│ │ (2D Diagrams)     │ │   │ │ Tensor Algebra    │ │   │ │ (via Puppeteer)   │ │
│ └───────────────────┘ │   │ └───────────────────┘ │   │ └───────────────────┘ │
│                       │   │                       │   │                       │
│ ┌───────────────────┐ │   │ ┌───────────────────┐ │   │ ┌───────────────────┐ │
│ │ Three.js Renderer │ │   │ │ @mathts/core      │ │   │ │ Jupyter Exporter  │ │
│ │ (3D Visualization)│ │   │ │ Matrix/Numeric    │ │   │ │ (.ipynb)          │ │
│ └───────────────────┘ │   │ └───────────────────┘ │   │ └───────────────────┘ │
│                       │   │                       │   │                       │
│ ┌───────────────────┐ │   │ ┌───────────────────┐ │   │ ┌───────────────────┐ │
│ │ D3.js Renderer    │ │   │ │ WASM Backend      │ │   │ │ HTML Exporter     │ │
│ │ (2D Charts)       │ │   │ │ WebGPU Backend    │ │   │ │ (Standalone)      │ │
│ └───────────────────┘ │   │ └───────────────────┘ │   │ └───────────────────┘ │
└───────────────────────┘   └───────────────────────┘   └───────────────────────┘
```

-----

## 3. YAML File Format Specification (`.mtsw`)

### 3.1 File Structure

```yaml
# MathTS Scientific Workbench Document
# Specification Version: 2.0.0

#═══════════════════════════════════════════════════════════════════════════════
# DOCUMENT HEADER
#═══════════════════════════════════════════════════════════════════════════════

mtsw_version: "2.0.0"

metadata:
  # Required fields
  title: "Document Title"
  id: "uuid-v4-generated-on-creation"
  created: "2025-12-06T12:00:00Z"
  modified: "2025-12-06T14:30:00Z"
  
  # Optional fields
  author: "Author Name"
  email: "author@example.com"
  institution: "Institution Name"
  description: |
    Multi-line description of the document.
    Supports markdown formatting.
  
  tags: [physics, tensor, general-relativity, UPTF]
  license: "MIT"
  
  # Bibliography (optional)
  bibliography:
    - key: "einstein1915"
      type: article
      author: "Albert Einstein"
      title: "Die Feldgleichungen der Gravitation"
      journal: "Sitzungsberichte der Preußischen Akademie der Wissenschaften"
      year: 1915
      pages: "844-847"

#═══════════════════════════════════════════════════════════════════════════════
# RUNTIME CONFIGURATION
#═══════════════════════════════════════════════════════════════════════════════

runtime:
  engine: mathts                    # mathts | python | julia | r
  version: ">=1.0.0"
  
  # Package dependencies
  packages:
    - name: "@mathts/core"
      version: "^1.0.0"
    - name: "@mathts/tensor"
      version: "^1.0.0"
    - name: "@mathts/symbolic"
      version: "^1.0.0"
    - name: "@mathts/viz"
      version: "^1.0.0"
  
  # Execution mode
  execution:
    mode: reactive                  # reactive | sequential | manual
    auto_run: true                  # Run cells on load
    parallel: true                  # Allow parallel cell execution
    max_workers: 4                  # WebWorker pool size
    timeout: 30000                  # Cell execution timeout (ms)
    
  # Computation backend preferences
  backend:
    prefer: webgpu                  # webgpu | wasm | js
    fallback: [wasm, js]            # Fallback chain
    precision: double               # double | single | arbitrary
    
  # Memory limits
  limits:
    max_matrix_size: 10000          # Max N for NxN matrix
    max_tensor_rank: 8              # Max tensor rank
    max_symbolic_depth: 100         # Max expression tree depth

#═══════════════════════════════════════════════════════════════════════════════
# KERNEL STATE & VARIABLES
#═══════════════════════════════════════════════════════════════════════════════

kernel:
  # Initial variable definitions (loaded before any cell runs)
  init:
    - name: c
      type: constant
      value: 299792458
      unit: "m/s"
      description: "Speed of light"
      
    - name: G
      type: constant  
      value: 6.67430e-11
      unit: "m³/(kg·s²)"
      description: "Gravitational constant"
      
    - name: ℏ
      type: constant
      value: 1.054571817e-34
      unit: "J·s"
      description: "Reduced Planck constant"
  
  # Coordinate system definitions
  coordinates:
    - name: cartesian
      symbols: [x, y, z]
      domain: real
      
    - name: spherical
      symbols: [r, θ, φ]
      domain: real
      constraints:
        r: ">= 0"
        θ: "[0, π]"
        φ: "[0, 2π)"
        
    - name: spacetime
      symbols: [t, x, y, z]
      signature: [-1, 1, 1, 1]
      type: lorentzian

#═══════════════════════════════════════════════════════════════════════════════
# VISUALIZATION DEFAULTS
#═══════════════════════════════════════════════════════════════════════════════

visualization:
  # MathJax configuration
  mathjax:
    macros:
      "\\R": "\\mathbb{R}"
      "\\C": "\\mathbb{C}"
      "\\N": "\\mathbb{N}"
      "\\Z": "\\mathbb{Z}"
      "\\dd": "\\mathrm{d}"
      "\\pp": "\\partial"
      "\\grad": "\\nabla"
      "\\div": "\\nabla \\cdot"
      "\\curl": "\\nabla \\times"
      "\\laplacian": "\\nabla^2"
      "\\christoffel": "\\Gamma"
      "\\riemann": "R"
      "\\ricci": "R"
      "\\metric": "g"
    packages: [ams, physics, tensor]
    
  # Three.js default scene configuration
  threejs:
    renderer:
      type: webgpu                   # webgpu | webgl2 | webgl
      antialias: true
      pixelRatio: "device"           # number | "device"
      
    camera:
      type: perspective              # perspective | orthographic
      fov: 75
      near: 0.1
      far: 1000
      position: [5, 5, 5]
      lookAt: [0, 0, 0]
      
    controls:
      type: orbit                    # orbit | fly | trackball
      enableDamping: true
      dampingFactor: 0.05
      
    lighting:
      ambient:
        color: 0xffffff
        intensity: 0.4
      directional:
        color: 0xffffff
        intensity: 0.8
        position: [10, 10, 10]
        
    style:
      background: 0x1a1a2e
      gridHelper: true
      axesHelper: true
      
  # Graphviz configuration
  graphviz:
    engine: dot                      # dot | neato | fdp | sfdp | circo | twopi
    format: svg
    rankdir: TB                      # TB | BT | LR | RL
    splines: spline                  # spline | line | ortho | polyline
    node:
      shape: ellipse
      style: filled
      fillcolor: "#e8e8e8"
      fontname: "Arial"
    edge:
      fontname: "Arial"
      fontsize: 10
      
  # D3.js configuration
  d3:
    margin: { top: 20, right: 20, bottom: 30, left: 50 }
    colorScheme: viridis
    
  # Color maps for scientific visualization
  colormaps:
    default: viridis
    available: [viridis, plasma, inferno, magma, cividis, turbo, coolwarm, spectral]

#═══════════════════════════════════════════════════════════════════════════════
# EXPORT CONFIGURATION
#═══════════════════════════════════════════════════════════════════════════════

export:
  latex:
    documentclass: article
    packages:
      - amsmath
      - amssymb
      - physics
      - tensor
      - graphicx
      - hyperref
    preamble: |
      \newcommand{\R}{\mathbb{R}}
      \newcommand{\christoffel}{\Gamma}
      
  pdf:
    engine: pdflatex                 # pdflatex | xelatex | lualatex
    paper: letter                    # letter | a4 | a5
    margin: 1in
    
  html:
    template: default                # default | minimal | presentation
    theme: light                     # light | dark | auto
    standalone: true                 # Include all assets inline
    
  jupyter:
    kernel: python3                  # Target Jupyter kernel
    include_outputs: true

#═══════════════════════════════════════════════════════════════════════════════
# CELLS
#═══════════════════════════════════════════════════════════════════════════════

cells:
  # Cells are defined here - see Cell Type specifications below

#═══════════════════════════════════════════════════════════════════════════════
# OUTPUT CACHE (Optional - can be stripped for Git)
#═══════════════════════════════════════════════════════════════════════════════

outputs:
  # Cell outputs cached here - see Output specification below
```

-----

### 3.2 Cell Type Specifications

#### 3.2.1 Markdown Cell

```yaml
cells:
  - type: markdown
    id: intro-section
    content: |
      # Introduction
      
      This document explores the **Schwarzschild metric** and derives
      the geodesic equations using the MathTS tensor algebra system.
      
      The line element is given by:
      
      $$ds^2 = -\left(1 - \frac{r_s}{r}\right)c^2 dt^2 + 
               \left(1 - \frac{r_s}{r}\right)^{-1} dr^2 + 
               r^2 d\Omega^2$$
      
      where $r_s = \frac{2GM}{c^2}$ is the Schwarzschild radius.
      
    # Optional metadata
    collapsed: false
    hidden: false
    tags: [introduction, theory]
```

#### 3.2.2 Code Cell (TypeScript)

```yaml
cells:
  - type: code
    id: metric-computation
    language: typescript              # typescript | javascript | python
    
    # Cell source code
    source: |
      import { MetricTensor, symbol, schwarzschild } from '@mathts/tensor';
      import { simplify } from '@mathts/symbolic';
      
      // Define mass parameter
      const M = symbol('M', { positive: true });
      
      // Create Schwarzschild metric
      const g = schwarzschild(M);
      
      // Compute Christoffel symbols
      const Gamma = g.christoffelSecond();
      
      // Export for use in other cells
      export { g, Gamma, M };
      
    # Execution options
    options:
      autorun: true                   # Run when dependencies change
      cache: true                     # Cache output
      timeout: 10000                  # Cell-specific timeout
      display: auto                   # auto | none | explicit
      
    # Explicit dependencies (auto-detected if omitted)
    depends_on: []
    
    # Cell outputs specification
    outputs:
      - name: g
        display: latex
        label: "Metric tensor $g_{\\mu\\nu}$"
      - name: Gamma
        display: table
        label: "Christoffel symbols"
```

#### 3.2.3 Tensor Cell (Einstein Notation)

```yaml
cells:
  - type: tensor
    id: geodesic-equation
    
    # Einstein notation content
    notation: einstein
    content: |
      # Define the geodesic equation
      # d²x^μ/dτ² + Γ^μ_{αβ} (dx^α/dτ)(dx^β/dτ) = 0
      
      geodesic := D²[x^μ, τ] + Γ^μ_{αβ} * D[x^α, τ] * D[x^β, τ] = 0
      
      # Riemann curvature tensor
      R^ρ_{σμν} := ∂_μ Γ^ρ_{νσ} - ∂_ν Γ^ρ_{μσ} 
                   + Γ^ρ_{μλ} Γ^λ_{νσ} - Γ^ρ_{νλ} Γ^λ_{μσ}
      
      # Ricci tensor (contraction)
      R_{μν} := R^ρ_{μρν}
      
      # Ricci scalar
      R := g^{μν} R_{μν}
      
      # Einstein tensor
      G_{μν} := R_{μν} - (1/2) g_{μν} R
      
    # Tensor cell options
    options:
      coordinates: spacetime          # Reference to kernel.coordinates
      metric: g                       # Symbol for metric tensor
      dimension: 4
      simplify: true                  # Auto-simplify results
      
    # Dependencies
    depends_on: [metric-computation]
    
    # Output display
    display:
      format: latex
      numbered: true
      align: true
```

#### 3.2.4 Equation Cell (LaTeX Display)

```yaml
cells:
  - type: equation
    id: field-equations
    
    content: |
      G_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4} T_{\mu\nu}
      
    options:
      numbered: true
      label: "eq:einstein-field"
      align: center
      
    # Reference label for cross-referencing
    ref: "eq:einstein-field"
```

#### 3.2.5 Visualization Cell (Three.js / Graphviz / D3)

```yaml
cells:
  # 3D Visualization with Three.js
  - type: visualization
    id: geodesic-3d
    
    renderer: threejs
    
    source: |
      import { Scene, GeodesicPlotter } from '@mathts/viz';
      import { g, Gamma } from '#metric-computation';
      
      // Create scene
      const scene = new Scene({
        width: 800,
        height: 600,
        camera: { position: [10, 10, 10] }
      });
      
      // Add coordinate grid
      scene.addGrid({ size: 20, divisions: 20 });
      
      // Create geodesic plotter
      const plotter = new GeodesicPlotter(g, Gamma);
      
      // Plot geodesic from initial conditions
      const geodesic = plotter.solve({
        initialPosition: [0, 10, Math.PI/2, 0],  // t, r, θ, φ
        initialVelocity: [1, -0.1, 0, 0.05],
        tauRange: [0, 100],
        steps: 1000
      });
      
      // Add to scene with coloring by proper time
      scene.addCurve(geodesic, {
        color: 'tau',                  // Color by parameter
        colormap: 'viridis',
        lineWidth: 2
      });
      
      // Add event horizon sphere
      const rs = 2;  // Schwarzschild radius
      scene.addSphere({
        radius: rs,
        color: 0x000000,
        opacity: 0.8
      });
      
      // Render
      scene.render();
      
      export { scene };
      
    options:
      interactive: true
      controls: orbit
      animate: false
      
    display:
      width: 800
      height: 600
      caption: "Geodesic trajectory in Schwarzschild spacetime"
      
  # 2D Graph with Graphviz
  - type: visualization
    id: tensor-structure
    
    renderer: graphviz
    
    source: |
      digraph TensorHierarchy {
        rankdir=TB;
        node [shape=box, style=rounded];
        
        // Nodes
        g [label="Metric\\ng_{μν}", fillcolor="#e1f5fe", style=filled];
        Gamma [label="Christoffel\\nΓ^α_{βγ}", fillcolor="#fff3e0", style=filled];
        R [label="Riemann\\nR^ρ_{σμν}", fillcolor="#fce4ec", style=filled];
        Ric [label="Ricci\\nR_{μν}", fillcolor="#f3e5f5", style=filled];
        S [label="Scalar\\nR", fillcolor="#e8f5e9", style=filled];
        G [label="Einstein\\nG_{μν}", fillcolor="#fffde7", style=filled];
        
        // Edges
        g -> Gamma [label="∂g"];
        Gamma -> R [label="∂Γ + ΓΓ"];
        R -> Ric [label="contract"];
        Ric -> S [label="trace"];
        Ric -> G;
        S -> G;
        g -> G;
      }
      
    options:
      engine: dot
      format: svg
      
    display:
      width: 600
      height: 400
      caption: "Curvature tensor hierarchy"
      
  # 2D Chart with D3
  - type: visualization
    id: curvature-plot
    
    renderer: d3
    
    source: |
      import { LineChart } from '@mathts/viz/d3';
      import { Kretschmann } from '#curvature-scalars';
      
      // Evaluate Kretschmann scalar vs r
      const rValues = linspace(2.1, 20, 100);  // Start just outside horizon
      const kValues = rValues.map(r => Kretschmann.evaluate({ r, M: 1 }));
      
      const chart = new LineChart({
        width: 600,
        height: 400,
        margin: { top: 20, right: 20, bottom: 50, left: 60 }
      });
      
      chart.plot(rValues, kValues, {
        xLabel: 'r / M',
        yLabel: 'K (Kretschmann scalar)',
        title: 'Curvature singularity',
        color: '#e53935',
        lineWidth: 2
      });
      
      // Add vertical line at horizon
      chart.addVerticalLine(2, {
        label: 'Horizon (r = 2M)',
        style: 'dashed',
        color: '#1565c0'
      });
      
      export { chart };
      
    options:
      format: svg
      
    display:
      width: 600
      height: 400
      caption: "Kretschmann scalar K = R^{αβγδ}R_{αβγδ} as function of r"
```

#### 3.2.6 Data Cell

```yaml
cells:
  - type: data
    id: physical-constants
    
    format: yaml                      # yaml | json | csv | table
    
    content:
      constants:
        c: 299792458                  # m/s
        G: 6.67430e-11               # m³/(kg·s²)
        M_sun: 1.989e30              # kg
        M_earth: 5.972e24            # kg
        
      schwarzschild_radii:
        sun: 2953.25                  # meters
        earth: 0.00887                # meters
        sagA: 1.27e10                 # meters (Sgr A*)
        
    options:
      export: true                    # Make available to other cells
      
    display:
      style: table
      caption: "Physical constants and derived quantities"
```

#### 3.2.7 Test Cell

```yaml
cells:
  - type: test
    id: metric-tests
    
    source: |
      import { expect, describe, it } from '@mathts/test';
      import { g, Gamma } from '#metric-computation';
      
      describe('Schwarzschild Metric', () => {
        it('should be symmetric', () => {
          for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
              expect(g.at(i, j)).toEqual(g.at(j, i));
            }
          }
        });
        
        it('should have signature (-,+,+,+)', () => {
          const [p, q] = g.signature();
          expect(p).toBe(3);
          expect(q).toBe(1);
        });
        
        it('should reduce to Minkowski at infinity', () => {
          const gInf = g.evaluate({ r: Infinity, M: 1 });
          expect(gInf.at(0, 0)).toBeCloseTo(-1);
          expect(gInf.at(1, 1)).toBeCloseTo(1);
        });
      });
      
    options:
      autorun: false                  # Don't run on load
      critical: true                  # Fail document if tests fail
      timeout: 5000
```

#### 3.2.8 Import Cell

```yaml
cells:
  - type: import
    id: external-imports
    
    # Import from other .mtsw files
    from: "./metrics-library.mtsw"
    import:
      - name: kerrMetric
        as: kerr
      - name: reissnerNordstromMetric
        as: RN
        
    # Import from npm packages
    packages:
      - from: "@mathts/cosmology"
        import: [FRWMetric, deSitterMetric]
```

#### 3.2.9 Export Cell

```yaml
cells:
  - type: export
    id: document-exports
    
    # What to export from this document
    exports:
      - name: g
        from: metric-computation
        description: "Schwarzschild metric tensor"
        
      - name: geodesicSolver
        from: geodesic-solver
        description: "Configured geodesic solver"
        
    # Actions on document save/export
    on_save:
      - action: export_figures
        cells: [geodesic-3d, tensor-structure, curvature-plot]
        format: [svg, png]
        directory: "./figures"
        
      - action: export_latex
        cells: [field-equations, geodesic-equation]
        file: "./equations.tex"
```

-----

### 3.3 Cell Reference System

Cells can reference each other using the `#cell-id` syntax:

```yaml
cells:
  - type: code
    id: base-metric
    source: |
      export const g = schwarzschild(M);
      
  - type: code
    id: curvature
    source: |
      // Import from another cell
      import { g } from '#base-metric';
      
      const curvature = new CurvatureTensors(g);
      export const R = curvature.riemann();
      
    depends_on: [base-metric]  # Explicit dependency
```

-----

### 3.4 Output Cache Format

```yaml
outputs:
  # Outputs keyed by cell ID
  metric-computation:
    executed_at: "2025-12-06T14:30:00Z"
    duration_ms: 245
    status: success
    
    # Output values
    values:
      g:
        type: MetricTensor
        display: |
          $$g_{\mu\nu} = \begin{pmatrix}
            -(1-\frac{r_s}{r}) & 0 & 0 & 0 \\
            0 & (1-\frac{r_s}{r})^{-1} & 0 & 0 \\
            0 & 0 & r^2 & 0 \\
            0 & 0 & 0 & r^2\sin^2\theta
          \end{pmatrix}$$
        serialized: "base64-encoded-binary-representation"
        
      Gamma:
        type: ChristoffelSymbol
        display: table
        data:
          # Non-zero components only
          - indices: [1, 0, 0]
            value: "(r_s c²)/(2r²(1-r_s/r))"
          - indices: [0, 0, 1]
            value: "(r_s c²)/(2r²(1-r_s/r))"
          # ... more components
          
  geodesic-3d:
    executed_at: "2025-12-06T14:30:01Z"
    duration_ms: 1520
    status: success
    
    values:
      scene:
        type: ThreeScene
        display: canvas
        snapshot: "data:image/png;base64,..."  # Static preview
        state: "base64-encoded-scene-state"
        
  # Console output
  console:
    - type: log
      content: "Metric computed successfully"
      timestamp: "2025-12-06T14:30:00.123Z"
    - type: warn
      content: "Using fallback WASM backend"
      timestamp: "2025-12-06T14:30:00.456Z"
```

-----

### 3.5 File Extension Variants

|Extension   |Description          |Use Case          |
|------------|---------------------|------------------|
|`.mtsw`     |Standard workbook    |Normal use        |
|`.mtsw.yaml`|Explicit YAML        |Editor association|
|`.mtsw.gz`  |Compressed           |Large documents   |
|`.mtswx`    |With embedded outputs|Distribution      |

-----

### 3.6 Git Integration

For clean Git diffs, outputs should be stripped:

```bash
# Strip outputs before commit
mtsw strip document.mtsw > document-clean.mtsw

# Or use Git filter
# .gitattributes
*.mtsw filter=mtsw-strip

# .git/config
[filter "mtsw-strip"]
    clean = mtsw strip --stdin
    smudge = cat
```

-----

## 4. MIME Types and File Associations

```yaml
# MIME type registration
mime_types:
  application/vnd.mathts.workbook+yaml:
    extensions: [.mtsw, .mtsw.yaml]
    magic: "mtsw_version:"
    
  application/vnd.mathts.workbook+yaml+gzip:
    extensions: [.mtsw.gz]
    
# VS Code language association
vscode:
  language_id: mtsw
  configuration:
    comments:
      lineComment: "#"
    brackets:
      - ["{", "}"]
      - ["[", "]"]
    autoClosingPairs:
      - ["{", "}"]
      - ["[", "]"]
      - ["\"", "\""]
      - ["'", "'"]
```

-----

*End of Part 1 — Continue to Part 2 for Abstract Layer and Control Interfaces*

# MathTS Scientific Workbench Design Specification

# Part 2: Abstract Computation Layer & Control Interfaces

-----

## 5. Abstract Computation Layer Architecture

The Abstract Computation Layer (ACL) bridges the YAML document format and the MathTS core engines. It provides a unified interface for cell execution, dependency management, and output routing.

### 5.1 Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Abstract Computation Layer                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          Document Controller                             │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   YAML      │  │  Schema     │  │  Document   │  │  Lifecycle  │    │    │
│  │  │   Parser    │  │  Validator  │  │  Model      │  │  Manager    │    │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │    │
│  │         │                │                │                │            │    │
│  │         └────────────────┴────────────────┴────────────────┘            │    │
│  │                                   │                                      │    │
│  └───────────────────────────────────┼──────────────────────────────────────┘    │
│                                      ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          Cell Type Registry                              │    │
│  │                                                                          │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │                      ICellHandler Interface                      │    │    │
│  │  │   parse() → compile() → execute() → render() → serialize()     │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  │                                                                          │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │Markdown │ │  Code   │ │ Tensor  │ │Equation │ │  Viz    │  ...      │    │
│  │  │Handler  │ │ Handler │ │ Handler │ │ Handler │ │ Handler │           │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │    │
│  │       │           │           │           │           │                 │    │
│  └───────┴───────────┴───────────┴───────────┴───────────┴─────────────────┘    │
│                                      │                                           │
│  ┌───────────────────────────────────┼──────────────────────────────────────┐   │
│  │                    Execution Engine                                       │   │
│  │                                   ▼                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ Dependency  │  │ Execution   │  │  Scope      │  │  Output     │     │   │
│  │  │ Graph       │  │ Scheduler   │  │  Manager    │  │  Router     │     │   │
│  │  │             │  │             │  │             │  │             │     │   │
│  │  │ • Build DAG │  │ • Topolog.  │  │ • Variable  │  │ • Format    │     │   │
│  │  │ • Detect    │  │   sort      │  │   binding   │  │   dispatch  │     │   │
│  │  │   cycles    │  │ • Parallel  │  │ • Isolation │  │ • Cache     │     │   │
│  │  │ • Incremen. │  │   execute   │  │ • Snapshot  │  │ • Stream    │     │   │
│  │  │   update    │  │ • Priority  │  │ • GC        │  │             │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
└──────────────────────────────────────┼───────────────────────────────────────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  MathTS Core        │   │  Visualization      │   │  Export Engine      │
│  Interface          │   │  Interface          │   │  Interface          │
│                     │   │                     │   │                     │
│  @mathts/symbolic   │   │  MathJax Controller │   │  LaTeX Generator    │
│  @mathts/tensor     │   │  Graphviz Controller│   │  PDF Renderer       │
│  @mathts/core       │   │  Three.js Controller│   │  Jupyter Exporter   │
│  @mathts/calculus   │   │  D3.js Controller   │   │  HTML Exporter      │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

-----

### 5.2 Core Interfaces

#### 5.2.1 Document Controller Interface

```typescript
// src/acl/document/controller.ts

/**
 * Main document controller - orchestrates all document operations
 */
export interface IDocumentController {
  // Document lifecycle
  load(source: string | URL | File): Promise<MTSWDocument>;
  save(document: MTSWDocument, options?: SaveOptions): Promise<void>;
  close(document: MTSWDocument): Promise<void>;
  
  // Document operations
  validate(document: MTSWDocument): ValidationResult;
  execute(document: MTSWDocument, options?: ExecuteOptions): Promise<ExecutionResult>;
  export(document: MTSWDocument, format: ExportFormat): Promise<Blob | string>;
  
  // Cell operations
  addCell(document: MTSWDocument, cell: CellDefinition, position?: number): string;
  removeCell(document: MTSWDocument, cellId: string): void;
  moveCell(document: MTSWDocument, cellId: string, newPosition: number): void;
  updateCell(document: MTSWDocument, cellId: string, updates: Partial<CellDefinition>): void;
  
  // Execution control
  executeCell(document: MTSWDocument, cellId: string): Promise<CellOutput>;
  executeCells(document: MTSWDocument, cellIds: string[]): Promise<Map<string, CellOutput>>;
  interruptExecution(document: MTSWDocument): void;
  
  // State management
  getState(document: MTSWDocument): DocumentState;
  getScope(document: MTSWDocument): Scope;
  getVariable(document: MTSWDocument, name: string): any;
  setVariable(document: MTSWDocument, name: string, value: any): void;
  
  // Events
  on(event: DocumentEvent, handler: EventHandler): Unsubscribe;
}

/**
 * Document model representing a loaded .mtsw file
 */
export interface MTSWDocument {
  readonly id: string;
  readonly version: string;
  readonly metadata: DocumentMetadata;
  readonly runtime: RuntimeConfig;
  readonly kernel: KernelConfig;
  readonly visualization: VisualizationConfig;
  readonly cells: Map<string, Cell>;
  readonly outputs: Map<string, CellOutput>;
  
  // Computed properties
  readonly dependencyGraph: DependencyGraph;
  readonly executionOrder: string[];
  readonly isDirty: boolean;
}

/**
 * Document events
 */
type DocumentEvent = 
  | 'cell:added'
  | 'cell:removed'
  | 'cell:updated'
  | 'cell:executed'
  | 'cell:error'
  | 'document:loaded'
  | 'document:saved'
  | 'document:modified'
  | 'scope:changed'
  | 'dependency:changed';
```

#### 5.2.2 Cell Handler Interface

```typescript
// src/acl/cells/handler.ts

/**
 * Base interface for all cell type handlers
 */
export interface ICellHandler<T extends Cell = Cell> {
  readonly type: CellType;
  readonly version: string;
  
  /**
   * Parse raw YAML content into cell structure
   */
  parse(raw: unknown, schema: CellSchema): T;
  
  /**
   * Validate cell structure and content
   */
  validate(cell: T): ValidationResult;
  
  /**
   * Compile cell content to executable form
   */
  compile(cell: T, context: CompilationContext): CompiledCell;
  
  /**
   * Execute compiled cell
   */
  execute(compiled: CompiledCell, scope: Scope): Promise<ExecutionResult>;
  
  /**
   * Render cell output for display
   */
  render(output: ExecutionResult, options: RenderOptions): RenderedOutput;
  
  /**
   * Serialize cell state for caching/export
   */
  serialize(cell: T, output?: ExecutionResult): SerializedCell;
  
  /**
   * Extract dependencies from cell content
   */
  extractDependencies(cell: T): string[];
  
  /**
   * Extract exports from cell content
   */
  extractExports(cell: T): string[];
  
  /**
   * Convert cell to different formats
   */
  toLatex?(cell: T, output?: ExecutionResult): string;
  toJupyter?(cell: T, output?: ExecutionResult): JupyterCell;
  toHTML?(cell: T, output?: ExecutionResult): string;
}

/**
 * Compilation context provided to cell handlers
 */
export interface CompilationContext {
  document: MTSWDocument;
  scope: Scope;
  dependencies: Map<string, any>;
  runtime: RuntimeConfig;
  
  // Helpers
  resolveImport(specifier: string): any;
  getCell(id: string): Cell | undefined;
  getCellOutput(id: string): ExecutionResult | undefined;
}

/**
 * Compiled cell ready for execution
 */
export interface CompiledCell {
  id: string;
  type: CellType;
  executable: Function | CompiledModule;
  sourceMap?: SourceMap;
  metadata: CellMetadata;
}
```

#### 5.2.3 Code Cell Handler Implementation

```typescript
// src/acl/cells/handlers/code.ts

import * as ts from 'typescript';
import { ICellHandler, CodeCell, CompilationContext } from '../types';

export class CodeCellHandler implements ICellHandler<CodeCell> {
  readonly type = 'code';
  readonly version = '1.0.0';
  
  private readonly transpiler: TypeScriptTranspiler;
  private readonly moduleResolver: ModuleResolver;
  
  constructor(config: CodeHandlerConfig) {
    this.transpiler = new TypeScriptTranspiler(config.tsConfig);
    this.moduleResolver = new ModuleResolver(config.moduleConfig);
  }
  
  parse(raw: unknown, schema: CellSchema): CodeCell {
    const validated = schema.validate(raw);
    
    return {
      id: validated.id,
      type: 'code',
      language: validated.language ?? 'typescript',
      source: validated.source,
      options: {
        autorun: validated.options?.autorun ?? true,
        cache: validated.options?.cache ?? true,
        timeout: validated.options?.timeout ?? 30000,
        display: validated.options?.display ?? 'auto'
      },
      dependsOn: validated.depends_on ?? [],
      outputs: validated.outputs ?? []
    };
  }
  
  validate(cell: CodeCell): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for syntax errors
    const syntaxResult = this.transpiler.checkSyntax(cell.source);
    if (!syntaxResult.valid) {
      errors.push(...syntaxResult.errors.map(e => ({
        type: 'syntax' as const,
        message: e.message,
        line: e.line,
        column: e.column
      })));
    }
    
    // Check for unresolved imports
    const imports = this.extractImports(cell.source);
    for (const imp of imports) {
      if (!this.moduleResolver.canResolve(imp)) {
        warnings.push({
          type: 'import',
          message: `Cannot resolve import: ${imp}`,
          suggestion: `Ensure module "${imp}" is available`
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  compile(cell: CodeCell, context: CompilationContext): CompiledCell {
    // Transform cell references (#cell-id) to variable references
    const transformedSource = this.transformCellReferences(cell.source, context);
    
    // Transpile TypeScript to JavaScript
    const transpiled = this.transpiler.transpile(transformedSource, {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      sourceMap: true
    });
    
    // Create executable module
    const moduleFactory = new Function(
      'require', 'exports', 'scope', '__mathts__',
      `
      "use strict";
      const { ${this.getMathtsCoreImports().join(', ')} } = __mathts__;
      ${transpiled.code}
      `
    );
    
    return {
      id: cell.id,
      type: 'code',
      executable: moduleFactory,
      sourceMap: transpiled.sourceMap,
      metadata: {
        language: cell.language,
        imports: this.extractImports(cell.source),
        exports: this.extractExports(cell.source)
      }
    };
  }
  
  async execute(compiled: CompiledCell, scope: Scope): Promise<ExecutionResult> {
    const exports: Record<string, any> = {};
    const console = new CapturedConsole();
    
    const require = (specifier: string) => {
      return this.moduleResolver.require(specifier, scope);
    };
    
    const startTime = performance.now();
    
    try {
      // Execute in isolated context
      await Promise.race([
        (async () => {
          compiled.executable(require, exports, scope, getMathtsCore());
        })(),
        this.timeout(compiled.metadata.timeout ?? 30000)
      ]);
      
      const duration = performance.now() - startTime;
      
      return {
        status: 'success',
        exports,
        console: console.getOutput(),
        duration,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      return {
        status: 'error',
        error: {
          name: error.name,
          message: error.message,
          stack: this.mapStackTrace(error.stack, compiled.sourceMap)
        },
        console: console.getOutput(),
        duration,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  render(output: ExecutionResult, options: RenderOptions): RenderedOutput {
    if (output.status === 'error') {
      return {
        type: 'error',
        content: this.formatError(output.error),
        mimeType: 'text/html'
      };
    }
    
    const rendered: RenderedOutput[] = [];
    
    // Render console output
    if (output.console.length > 0) {
      rendered.push({
        type: 'console',
        content: this.formatConsole(output.console),
        mimeType: 'text/html'
      });
    }
    
    // Render exports based on type
    for (const [name, value] of Object.entries(output.exports)) {
      rendered.push(this.renderValue(name, value, options));
    }
    
    return {
      type: 'composite',
      children: rendered,
      mimeType: 'application/x-mtsw-output'
    };
  }
  
  extractDependencies(cell: CodeCell): string[] {
    const deps = new Set<string>();
    
    // Explicit dependencies
    for (const dep of cell.dependsOn) {
      deps.add(dep);
    }
    
    // Implicit dependencies from #cell-id references
    const cellRefRegex = /from\s+['"]#([a-zA-Z0-9_-]+)['"]/g;
    let match;
    while ((match = cellRefRegex.exec(cell.source)) !== null) {
      deps.add(match[1]);
    }
    
    return Array.from(deps);
  }
  
  extractExports(cell: CodeCell): string[] {
    const exports: string[] = [];
    
    // Match: export { name } or export const name
    const exportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)|export\s*\{\s*([^}]+)\s*\}/g;
    let match;
    
    while ((match = exportRegex.exec(cell.source)) !== null) {
      if (match[1]) {
        exports.push(match[1]);
      }
      if (match[2]) {
        const names = match[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
        exports.push(...names);
      }
    }
    
    return exports;
  }
  
  toLatex(cell: CodeCell, output?: ExecutionResult): string {
    // Generate LaTeX listing for code
    return `
\\begin{lstlisting}[language=TypeScript, caption=${cell.id}]
${cell.source}
\\end{lstlisting}
    `.trim();
  }
  
  toJupyter(cell: CodeCell, output?: ExecutionResult): JupyterCell {
    return {
      cell_type: 'code',
      source: cell.source.split('\n'),
      metadata: {
        mtsw_id: cell.id,
        language: cell.language
      },
      outputs: output ? this.convertOutputToJupyter(output) : [],
      execution_count: null
    };
  }
  
  private transformCellReferences(source: string, context: CompilationContext): string {
    // Transform: import { x } from '#cell-id'
    // To: const { x } = __scope__.cells['cell-id'].exports;
    
    return source.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]#([a-zA-Z0-9_-]+)['"]/g,
      (_, imports, cellId) => {
        return `const {${imports}} = __scope__.cells['${cellId}'].exports`;
      }
    );
  }
  
  private renderValue(name: string, value: any, options: RenderOptions): RenderedOutput {
    // Determine best rendering based on value type
    if (value instanceof Tensor) {
      return {
        type: 'tensor',
        content: this.renderTensorToLatex(value),
        mimeType: 'text/latex'
      };
    }
    
    if (value instanceof Matrix) {
      return {
        type: 'matrix',
        content: this.renderMatrixToLatex(value),
        mimeType: 'text/latex'
      };
    }
    
    if (value instanceof Expression) {
      return {
        type: 'expression',
        content: value.toLatex(),
        mimeType: 'text/latex'
      };
    }
    
    if (value instanceof Scene) {
      return {
        type: 'threejs',
        content: value.toJSON(),
        mimeType: 'application/x-threejs-scene'
      };
    }
    
    // Default: JSON representation
    return {
      type: 'json',
      content: JSON.stringify(value, null, 2),
      mimeType: 'application/json'
    };
  }
}
```

#### 5.2.4 Tensor Cell Handler Implementation

```typescript
// src/acl/cells/handlers/tensor.ts

import { ICellHandler, TensorCell, CompilationContext } from '../types';
import { EinsteinParser, TensorExpression } from '@mathts/tensor';

export class TensorCellHandler implements ICellHandler<TensorCell> {
  readonly type = 'tensor';
  readonly version = '1.0.0';
  
  private readonly parser: EinsteinParser;
  
  constructor() {
    this.parser = new EinsteinParser();
  }
  
  parse(raw: unknown, schema: CellSchema): TensorCell {
    const validated = schema.validate(raw);
    
    return {
      id: validated.id,
      type: 'tensor',
      notation: validated.notation ?? 'einstein',
      content: validated.content,
      options: {
        coordinates: validated.options?.coordinates ?? 'spacetime',
        metric: validated.options?.metric ?? 'g',
        dimension: validated.options?.dimension ?? 4,
        simplify: validated.options?.simplify ?? true
      },
      dependsOn: validated.depends_on ?? [],
      display: validated.display ?? { format: 'latex', numbered: true }
    };
  }
  
  validate(cell: TensorCell): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Parse and validate tensor notation
    try {
      const statements = this.parseContent(cell.content);
      
      for (const stmt of statements) {
        const result = this.validateStatement(stmt);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
      
    } catch (e) {
      errors.push({
        type: 'parse',
        message: `Failed to parse tensor notation: ${e.message}`,
        line: this.getErrorLine(e)
      });
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }
  
  compile(cell: TensorCell, context: CompilationContext): CompiledCell {
    // Parse tensor statements
    const statements = this.parseContent(cell.content);
    
    // Compile each statement to executable form
    const compiledStatements = statements.map(stmt => 
      this.compileStatement(stmt, context)
    );
    
    // Create combined executable
    const executable = async (scope: Scope) => {
      const results: Record<string, any> = {};
      
      for (const compiled of compiledStatements) {
        const result = await compiled.execute(scope);
        if (compiled.name) {
          results[compiled.name] = result;
          scope.set(compiled.name, result);
        }
      }
      
      return results;
    };
    
    return {
      id: cell.id,
      type: 'tensor',
      executable,
      metadata: {
        statements: statements.map(s => s.name),
        notation: cell.notation
      }
    };
  }
  
  async execute(compiled: CompiledCell, scope: Scope): Promise<ExecutionResult> {
    const startTime = performance.now();
    
    try {
      const results = await compiled.executable(scope);
      
      // Simplify results if requested
      if (compiled.metadata.simplify) {
        for (const [name, value] of Object.entries(results)) {
          if (value instanceof TensorExpression) {
            results[name] = value.simplify();
          }
        }
      }
      
      return {
        status: 'success',
        exports: results,
        duration: performance.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        duration: performance.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  render(output: ExecutionResult, options: RenderOptions): RenderedOutput {
    if (output.status === 'error') {
      return {
        type: 'error',
        content: this.formatError(output.error),
        mimeType: 'text/html'
      };
    }
    
    // Render each tensor expression as LaTeX
    const equations: string[] = [];
    
    for (const [name, value] of Object.entries(output.exports)) {
      if (value instanceof TensorExpression || value instanceof Tensor) {
        equations.push(this.renderTensorEquation(name, value, options));
      }
    }
    
    return {
      type: 'latex',
      content: equations.join('\n\n'),
      mimeType: 'text/latex'
    };
  }
  
  private parseContent(content: string): TensorStatement[] {
    const statements: TensorStatement[] = [];
    const lines = content.split('\n');
    
    let currentStatement = '';
    
    for (const line of lines) {
      // Skip comments
      if (line.trim().startsWith('#')) continue;
      if (line.trim() === '') continue;
      
      currentStatement += line + '\n';
      
      // Statement ends with definition (:=) or equation (=)
      if (line.includes(':=') || line.match(/[^:!<>=]=(?!=)/)) {
        statements.push(this.parser.parseStatement(currentStatement.trim()));
        currentStatement = '';
      }
    }
    
    return statements;
  }
  
  private compileStatement(
    stmt: TensorStatement, 
    context: CompilationContext
  ): CompiledTensorStatement {
    switch (stmt.type) {
      case 'definition':
        return this.compileDefinition(stmt, context);
      case 'equation':
        return this.compileEquation(stmt, context);
      case 'contraction':
        return this.compileContraction(stmt, context);
      default:
        throw new Error(`Unknown statement type: ${stmt.type}`);
    }
  }
  
  private compileDefinition(
    stmt: TensorDefinition,
    context: CompilationContext
  ): CompiledTensorStatement {
    const { lhs, rhs } = stmt;
    
    // Parse left-hand side for tensor name and indices
    const { name, indices } = this.parser.parseIndexedSymbol(lhs);
    
    // Compile right-hand side expression
    const rhsCompiled = this.compileExpression(rhs, context);
    
    return {
      name,
      execute: async (scope: Scope) => {
        // Get metric from scope for index operations
        const metric = scope.get(context.document.visualization.tensor?.metric ?? 'g');
        
        // Evaluate RHS
        const value = await rhsCompiled.evaluate(scope);
        
        // Wrap as Tensor with proper index structure
        return new Tensor(value, indices, { metric });
      }
    };
  }
  
  private renderTensorEquation(
    name: string, 
    value: TensorExpression | Tensor,
    options: RenderOptions
  ): string {
    const latex = value.toLatex();
    
    if (options.numbered) {
      return `\\begin{equation}\\label{eq:${name}}\n${name} = ${latex}\n\\end{equation}`;
    }
    
    return `$$${name} = ${latex}$$`;
  }
  
  toLatex(cell: TensorCell, output?: ExecutionResult): string {
    const lines: string[] = [];
    
    if (output?.status === 'success') {
      for (const [name, value] of Object.entries(output.exports)) {
        lines.push(this.renderTensorEquation(name, value, cell.display));
      }
    }
    
    return lines.join('\n\n');
  }
  
  extractDependencies(cell: TensorCell): string[] {
    const deps = new Set<string>(cell.dependsOn);
    
    // Extract dependencies from tensor expressions
    // Look for references like: from #cell-id or using metric from other cell
    const refRegex = /#([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = refRegex.exec(cell.content)) !== null) {
      deps.add(match[1]);
    }
    
    return Array.from(deps);
  }
  
  extractExports(cell: TensorCell): string[] {
    const exports: string[] = [];
    
    // Extract defined tensor names
    const defRegex = /(\w+)\s*:=/g;
    let match;
    while ((match = defRegex.exec(cell.content)) !== null) {
      exports.push(match[1]);
    }
    
    return exports;
  }
}
```

-----

### 5.3 Dependency Graph Manager

```typescript
// src/acl/execution/dependency-graph.ts

/**
 * Manages cell dependencies and execution order
 */
export class DependencyGraph {
  private nodes: Map<string, GraphNode>;
  private edges: Map<string, Set<string>>;  // cell -> dependencies
  private reverseEdges: Map<string, Set<string>>;  // cell -> dependents
  
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.reverseEdges = new Map();
  }
  
  /**
   * Add a cell to the graph
   */
  addCell(cell: Cell, handler: ICellHandler): void {
    const id = cell.id;
    const dependencies = handler.extractDependencies(cell);
    const exports = handler.extractExports(cell);
    
    this.nodes.set(id, {
      id,
      cell,
      dependencies,
      exports,
      state: 'pending'
    });
    
    // Set up edges
    this.edges.set(id, new Set(dependencies));
    
    for (const dep of dependencies) {
      if (!this.reverseEdges.has(dep)) {
        this.reverseEdges.set(dep, new Set());
      }
      this.reverseEdges.get(dep)!.add(id);
    }
  }
  
  /**
   * Remove a cell from the graph
   */
  removeCell(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    // Remove edges
    for (const dep of this.edges.get(id) ?? []) {
      this.reverseEdges.get(dep)?.delete(id);
    }
    this.edges.delete(id);
    
    // Remove reverse edges
    for (const dependent of this.reverseEdges.get(id) ?? []) {
      this.edges.get(dependent)?.delete(id);
    }
    this.reverseEdges.delete(id);
    
    this.nodes.delete(id);
  }
  
  /**
   * Update cell dependencies
   */
  updateCell(cell: Cell, handler: ICellHandler): void {
    this.removeCell(cell.id);
    this.addCell(cell, handler);
  }
  
  /**
   * Get topologically sorted execution order
   */
  getExecutionOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new CyclicDependencyError(this.findCycle(id));
      }
      
      visiting.add(id);
      
      for (const dep of this.edges.get(id) ?? []) {
        if (this.nodes.has(dep)) {
          visit(dep);
        }
      }
      
      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };
    
    for (const id of this.nodes.keys()) {
      visit(id);
    }
    
    return order;
  }
  
  /**
   * Get cells that need re-execution when a cell changes
   */
  getAffectedCells(changedId: string): string[] {
    const affected = new Set<string>();
    const queue = [changedId];
    
    while (queue.length > 0) {
      const id = queue.shift()!;
      affected.add(id);
      
      for (const dependent of this.reverseEdges.get(id) ?? []) {
        if (!affected.has(dependent)) {
          queue.push(dependent);
        }
      }
    }
    
    // Return in execution order
    const order = this.getExecutionOrder();
    return order.filter(id => affected.has(id));
  }
  
  /**
   * Get parallel execution groups
   * Returns groups of cells that can be executed in parallel
   */
  getParallelGroups(): string[][] {
    const order = this.getExecutionOrder();
    const levels = new Map<string, number>();
    
    // Compute level for each cell (max level of dependencies + 1)
    for (const id of order) {
      let maxDepLevel = -1;
      for (const dep of this.edges.get(id) ?? []) {
        if (levels.has(dep)) {
          maxDepLevel = Math.max(maxDepLevel, levels.get(dep)!);
        }
      }
      levels.set(id, maxDepLevel + 1);
    }
    
    // Group by level
    const groups: string[][] = [];
    for (const [id, level] of levels) {
      if (!groups[level]) {
        groups[level] = [];
      }
      groups[level].push(id);
    }
    
    return groups.filter(g => g.length > 0);
  }
  
  /**
   * Detect if adding a dependency would create a cycle
   */
  wouldCreateCycle(from: string, to: string): boolean {
    // Check if 'to' can reach 'from' through existing edges
    const visited = new Set<string>();
    const queue = [to];
    
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (id === from) return true;
      if (visited.has(id)) continue;
      
      visited.add(id);
      
      for (const dep of this.edges.get(id) ?? []) {
        queue.push(dep);
      }
    }
    
    return false;
  }
  
  /**
   * Find cycle starting from a node
   */
  private findCycle(startId: string): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    
    const dfs = (id: string): boolean => {
      if (path.includes(id)) {
        path.push(id);
        return true;
      }
      if (visited.has(id)) return false;
      
      visited.add(id);
      path.push(id);
      
      for (const dep of this.edges.get(id) ?? []) {
        if (dfs(dep)) return true;
      }
      
      path.pop();
      return false;
    };
    
    dfs(startId);
    
    // Extract just the cycle part
    const cycleStart = path.indexOf(path[path.length - 1]);
    return path.slice(cycleStart);
  }
  
  /**
   * Visualize graph as Graphviz DOT
   */
  toDot(): string {
    const lines = ['digraph DependencyGraph {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=rounded];');
    
    // Add nodes
    for (const [id, node] of this.nodes) {
      const color = this.getNodeColor(node.state);
      lines.push(`  "${id}" [label="${id}", fillcolor="${color}", style=filled];`);
    }
    
    // Add edges
    for (const [id, deps] of this.edges) {
      for (const dep of deps) {
        lines.push(`  "${dep}" -> "${id}";`);
      }
    }
    
    lines.push('}');
    return lines.join('\n');
  }
  
  private getNodeColor(state: CellState): string {
    switch (state) {
      case 'pending': return '#e8e8e8';
      case 'running': return '#fff3e0';
      case 'success': return '#e8f5e9';
      case 'error': return '#ffebee';
      default: return '#e8e8e8';
    }
  }
}

interface GraphNode {
  id: string;
  cell: Cell;
  dependencies: string[];
  exports: string[];
  state: CellState;
}

type CellState = 'pending' | 'running' | 'success' | 'error' | 'stale';

class CyclicDependencyError extends Error {
  constructor(public cycle: string[]) {
    super(`Cyclic dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CyclicDependencyError';
  }
}
```

-----

### 5.4 Execution Scheduler

```typescript
// src/acl/execution/scheduler.ts

/**
 * Schedules and orchestrates cell execution
 */
export class ExecutionScheduler {
  private readonly workerPool: WorkerPool;
  private readonly dependencyGraph: DependencyGraph;
  private readonly scopeManager: ScopeManager;
  private readonly outputRouter: OutputRouter;
  
  private activeExecutions: Map<string, AbortController>;
  private executionQueue: PriorityQueue<ExecutionTask>;
  
  constructor(config: SchedulerConfig) {
    this.workerPool = new WorkerPool(config.maxWorkers);
    this.dependencyGraph = new DependencyGraph();
    this.scopeManager = new ScopeManager();
    this.outputRouter = new OutputRouter();
    this.activeExecutions = new Map();
    this.executionQueue = new PriorityQueue((a, b) => a.priority - b.priority);
  }
  
  /**
   * Execute a single cell
   */
  async executeCell(
    cellId: string,
    context: ExecutionContext
  ): Promise<CellOutput> {
    const cell = context.document.cells.get(cellId);
    if (!cell) {
      throw new Error(`Cell not found: ${cellId}`);
    }
    
    const handler = context.registry.getHandler(cell.type);
    const compiled = handler.compile(cell, context.compilationContext);
    
    // Create abort controller for this execution
    const abortController = new AbortController();
    this.activeExecutions.set(cellId, abortController);
    
    try {
      // Get scope with dependencies
      const scope = this.scopeManager.createScope(cellId, context);
      
      // Execute
      const result = await this.executeWithTimeout(
        () => handler.execute(compiled, scope),
        cell.options?.timeout ?? context.document.runtime.execution.timeout,
        abortController.signal
      );
      
      // Update scope with exports
      if (result.status === 'success') {
        this.scopeManager.updateExports(cellId, result.exports);
      }
      
      // Route output
      const rendered = handler.render(result, context.renderOptions);
      this.outputRouter.route(cellId, rendered);
      
      return {
        cellId,
        result,
        rendered,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      this.activeExecutions.delete(cellId);
    }
  }
  
  /**
   * Execute all cells in dependency order
   */
  async executeAll(context: ExecutionContext): Promise<ExecutionSummary> {
    const order = this.dependencyGraph.getExecutionOrder();
    const results = new Map<string, CellOutput>();
    const errors: CellError[] = [];
    
    const startTime = performance.now();
    
    if (context.document.runtime.execution.parallel) {
      // Parallel execution by levels
      const groups = this.dependencyGraph.getParallelGroups();
      
      for (const group of groups) {
        const groupResults = await Promise.all(
          group.map(id => this.executeCell(id, context).catch(e => ({
            cellId: id,
            error: e
          })))
        );
        
        for (const result of groupResults) {
          if ('error' in result) {
            errors.push({ cellId: result.cellId, error: result.error });
          } else {
            results.set(result.cellId, result);
          }
        }
      }
      
    } else {
      // Sequential execution
      for (const id of order) {
        try {
          const result = await this.executeCell(id, context);
          results.set(id, result);
        } catch (e) {
          errors.push({ cellId: id, error: e });
          // Continue or stop based on config
          if (context.document.runtime.execution.stopOnError) {
            break;
          }
        }
      }
    }
    
    return {
      totalCells: order.length,
      executed: results.size,
      failed: errors.length,
      results,
      errors,
      duration: performance.now() - startTime
    };
  }
  
  /**
   * Execute affected cells after a change
   */
  async executeAffected(
    changedCellId: string,
    context: ExecutionContext
  ): Promise<ExecutionSummary> {
    const affected = this.dependencyGraph.getAffectedCells(changedCellId);
    
    // Mark affected cells as stale
    for (const id of affected) {
      this.scopeManager.markStale(id);
    }
    
    // Execute in order
    const results = new Map<string, CellOutput>();
    const errors: CellError[] = [];
    
    const startTime = performance.now();
    
    for (const id of affected) {
      try {
        const result = await this.executeCell(id, context);
        results.set(id, result);
      } catch (e) {
        errors.push({ cellId: id, error: e });
      }
    }
    
    return {
      totalCells: affected.length,
      executed: results.size,
      failed: errors.length,
      results,
      errors,
      duration: performance.now() - startTime
    };
  }
  
  /**
   * Interrupt execution of a cell
   */
  interruptCell(cellId: string): boolean {
    const controller = this.activeExecutions.get(cellId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }
  
  /**
   * Interrupt all executions
   */
  interruptAll(): void {
    for (const controller of this.activeExecutions.values()) {
      controller.abort();
    }
  }
  
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    signal: AbortSignal
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new TimeoutError(`Execution timed out after ${timeout}ms`));
        }, timeout);
        
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new AbortError('Execution aborted'));
        });
      })
    ]);
  }
}

interface ExecutionTask {
  cellId: string;
  priority: number;
  context: ExecutionContext;
}

interface ExecutionSummary {
  totalCells: number;
  executed: number;
  failed: number;
  results: Map<string, CellOutput>;
  errors: CellError[];
  duration: number;
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortError';
  }
}
```

-----

*End of Part 2 — Continue to Part 3 for Visualization Engine Interfaces*

# MathTS Scientific Workbench Design Specification

# Part 3: Visualization Engine Interfaces

-----

## 6. Visualization Engine Manager

The Visualization Engine Manager orchestrates multiple rendering backends for different output types.

### 6.1 Visualization Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Visualization Engine Manager                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        Renderer Registry                                 │    │
│  │                                                                          │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │    │
│  │  │MathJax  │ │Graphviz │ │Three.js │ │  D3.js  │ │ Custom  │            │    │
│  │  │Renderer │ │Renderer │ │Renderer │ │Renderer │ │Renderer │            │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │    │
│  │       │           │           │           │           │                  │    │
│  └───────┴───────────┴───────────┴───────────┴───────────┴──────────────────┘   │
│                                      │                                           │
│  ┌───────────────────────────────────┼──────────────────────────────────────┐   │
│  │                    Render Pipeline                                        │   │
│  │                                                                           │   │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐             │   │
│  │  │    Input      │    │   Transform   │    │    Output     │             │   │
│  │  │   Adapter     │───▶│    Chain      │───▶│   Formatter   │             │   │
│  │  └───────────────┘    └───────────────┘    └───────────────┘             │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

-----

## 7. MathJax Renderer (Symbolic Math Display)

### 7.1 MathJax Controller Implementation

```typescript
// src/viz/mathjax/renderer.ts

import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { CHTML } from 'mathjax-full/js/output/chtml.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';

/**
 * MathJax renderer for symbolic math expressions
 */
export class MathJaxRenderer implements IRenderer {
  readonly type = 'mathjax';
  readonly version = '3.2.0';
  
  private adaptor: ReturnType<typeof liteAdaptor>;
  private texInput: TeX<any, any, any>;
  private svgOutput: SVG<any, any, any>;
  private chtmlOutput: CHTML<any, any, any>;
  private document: any;
  
  private config: MathJaxConfig;
  private macros: Record<string, string>;
  private initialized = false;
  
  constructor(config: MathJaxConfig) {
    this.config = config;
    this.macros = config.macros ?? {};
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Create adaptor
    this.adaptor = liteAdaptor();
    RegisterHTMLHandler(this.adaptor);
    
    // Configure TeX input
    this.texInput = new TeX({
      packages: AllPackages,
      macros: this.buildMacros(),
      tags: 'ams',
      tagSide: 'right',
      tagIndent: '0.8em',
      useLabelIds: true,
      maxMacros: 10000,
      maxBuffer: 10 * 1024
    });
    
    // Configure outputs
    this.svgOutput = new SVG({
      fontCache: 'local',
      scale: 1,
      minScale: 0.5
    });
    
    this.chtmlOutput = new CHTML({
      fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
      scale: 1,
      minScale: 0.5
    });
    
    // Create MathJax document
    this.document = mathjax.document('', {
      InputJax: this.texInput,
      OutputJax: this.svgOutput
    });
    
    this.initialized = true;
  }
  
  async render(value: any, options?: MathJaxRenderOptions): Promise<RenderedOutput> {
    await this.initialize();
    
    // Convert value to LaTeX
    const latex = this.toLatex(value, options);
    
    // Choose display mode
    const displayMode = options?.display ?? this.detectDisplayMode(latex);
    
    // Render
    const format = options?.format ?? 'svg';
    
    if (format === 'svg') {
      return this.renderToSVG(latex, displayMode, options);
    } else {
      return this.renderToHTML(latex, displayMode, options);
    }
  }
  
  private async renderToSVG(
    latex: string,
    display: boolean,
    options?: MathJaxRenderOptions
  ): Promise<RenderedOutput> {
    // Update output jax
    this.document.outputJax = this.svgOutput;
    
    // Clear and convert
    this.document.clear();
    const wrapper = display ? `\\[${latex}\\]` : `\\(${latex}\\)`;
    
    const node = this.document.convert(wrapper, {
      display,
      em: 16,
      ex: 8,
      containerWidth: options?.width ?? 800
    });
    
    const svg = this.adaptor.outerHTML(node);
    
    return {
      type: 'math',
      format: 'svg',
      content: svg,
      mimeType: 'image/svg+xml',
      interactive: false,
      toSVG: async () => svg,
      toPNG: async () => this.svgToPNG(svg),
      toHTML: () => `<div class="mtsw-math">${svg}</div>`
    };
  }
  
  private async renderToHTML(
    latex: string,
    display: boolean,
    options?: MathJaxRenderOptions
  ): Promise<RenderedOutput> {
    this.document.outputJax = this.chtmlOutput;
    this.document.clear();
    
    const wrapper = display ? `\\[${latex}\\]` : `\\(${latex}\\)`;
    const node = this.document.convert(wrapper, { display });
    const html = this.adaptor.outerHTML(node);
    
    return {
      type: 'math',
      format: 'html',
      content: html,
      mimeType: 'text/html',
      interactive: false,
      toHTML: () => html
    };
  }
  
  /**
   * Convert MathTS objects to LaTeX
   */
  toLatex(value: any, options?: MathJaxRenderOptions): string {
    // Expression objects
    if (value instanceof Expression) {
      return this.expressionToLatex(value);
    }
    
    // Tensor objects
    if (value instanceof Tensor) {
      return this.tensorToLatex(value, options);
    }
    
    // Matrix objects
    if (value instanceof Matrix) {
      return this.matrixToLatex(value, options);
    }
    
    // Complex numbers
    if (value instanceof Complex) {
      return this.complexToLatex(value);
    }
    
    // Fraction
    if (value instanceof Fraction) {
      return this.fractionToLatex(value);
    }
    
    // Already LaTeX string
    if (typeof value === 'string') {
      return value;
    }
    
    // Fallback
    return String(value);
  }
  
  /**
   * Convert Expression tree to LaTeX
   */
  private expressionToLatex(expr: Expression): string {
    switch (expr.type) {
      case 'number':
        return this.numberToLatex(expr.value);
        
      case 'symbol':
        return this.symbolToLatex(expr.name, expr.subscript, expr.superscript);
        
      case 'add':
        return expr.children.map((c, i) => {
          const latex = this.expressionToLatex(c);
          if (i === 0) return latex;
          if (c.type === 'number' && c.value < 0) {
            return latex; // Already has minus sign
          }
          return `+ ${latex}`;
        }).join(' ');
        
      case 'multiply':
        return expr.children.map((c, i) => {
          const latex = this.expressionToLatex(c);
          const needsParens = c.type === 'add';
          return needsParens ? `\\left(${latex}\\right)` : latex;
        }).join(' \\cdot ');
        
      case 'divide':
        const [num, den] = expr.children;
        return `\\frac{${this.expressionToLatex(num)}}{${this.expressionToLatex(den)}}`;
        
      case 'power':
        const [base, exp] = expr.children;
        const baseLatex = this.expressionToLatex(base);
        const expLatex = this.expressionToLatex(exp);
        const needsParens = base.type === 'add' || base.type === 'multiply';
        return needsParens 
          ? `\\left(${baseLatex}\\right)^{${expLatex}}`
          : `${baseLatex}^{${expLatex}}`;
          
      case 'sqrt':
        if (expr.children.length === 1) {
          return `\\sqrt{${this.expressionToLatex(expr.children[0])}}`;
        }
        return `\\sqrt[${this.expressionToLatex(expr.children[1])}]{${this.expressionToLatex(expr.children[0])}}`;
        
      case 'function':
        return this.functionToLatex(expr.name, expr.children);
        
      case 'derivative':
        return this.derivativeToLatex(expr);
        
      case 'integral':
        return this.integralToLatex(expr);
        
      case 'sum':
        return this.sumToLatex(expr);
        
      case 'product':
        return this.productToLatex(expr);
        
      case 'limit':
        return this.limitToLatex(expr);
        
      default:
        return expr.toString();
    }
  }
  
  /**
   * Convert Tensor to LaTeX with proper index notation
   */
  private tensorToLatex(tensor: Tensor, options?: MathJaxRenderOptions): string {
    const name = tensor.symbol ?? 'T';
    
    // Build index string
    const upperIndices = tensor.indices
      .filter(i => i.position === 'up')
      .map(i => this.greekToLatex(i.name))
      .join('');
      
    const lowerIndices = tensor.indices
      .filter(i => i.position === 'down')
      .map(i => this.greekToLatex(i.name))
      .join('');
    
    let latex = name;
    if (upperIndices) latex += `^{${upperIndices}}`;
    if (lowerIndices) latex += `_{${lowerIndices}}`;
    
    // Add components if requested
    if (options?.showComponents && tensor.dimension <= 4) {
      latex += ' = ' + this.tensorComponentsToLatex(tensor);
    }
    
    return latex;
  }
  
  /**
   * Render tensor components as matrix
   */
  private tensorComponentsToLatex(tensor: Tensor): string {
    if (tensor.rank === 0) {
      return this.expressionToLatex(tensor.at());
    }
    
    if (tensor.rank === 1) {
      const components = [];
      for (let i = 0; i < tensor.dimension; i++) {
        components.push(this.expressionToLatex(tensor.at(i)));
      }
      return `\\begin{pmatrix} ${components.join(' \\\\ ')} \\end{pmatrix}`;
    }
    
    if (tensor.rank === 2) {
      const rows = [];
      for (let i = 0; i < tensor.dimension; i++) {
        const row = [];
        for (let j = 0; j < tensor.dimension; j++) {
          row.push(this.expressionToLatex(tensor.at(i, j)));
        }
        rows.push(row.join(' & '));
      }
      return `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`;
    }
    
    // Higher rank: show representative components
    return `\\text{(rank-${tensor.rank} tensor)}`;
  }
  
  /**
   * Convert Matrix to LaTeX
   */
  private matrixToLatex(matrix: Matrix, options?: MathJaxRenderOptions): string {
    const env = options?.matrixStyle ?? 'pmatrix';
    const rows = [];
    
    for (let i = 0; i < matrix.rows; i++) {
      const row = [];
      for (let j = 0; j < matrix.cols; j++) {
        const val = matrix.get(i, j);
        row.push(typeof val === 'number' 
          ? this.numberToLatex(val)
          : this.expressionToLatex(val));
      }
      rows.push(row.join(' & '));
    }
    
    return `\\begin{${env}} ${rows.join(' \\\\ ')} \\end{${env}}`;
  }
  
  /**
   * Convert Greek letter names to LaTeX
   */
  private greekToLatex(name: string): string {
    const greekMap: Record<string, string> = {
      'alpha': '\\alpha', 'beta': '\\beta', 'gamma': '\\gamma',
      'delta': '\\delta', 'epsilon': '\\epsilon', 'zeta': '\\zeta',
      'eta': '\\eta', 'theta': '\\theta', 'iota': '\\iota',
      'kappa': '\\kappa', 'lambda': '\\lambda', 'mu': '\\mu',
      'nu': '\\nu', 'xi': '\\xi', 'pi': '\\pi',
      'rho': '\\rho', 'sigma': '\\sigma', 'tau': '\\tau',
      'upsilon': '\\upsilon', 'phi': '\\phi', 'chi': '\\chi',
      'psi': '\\psi', 'omega': '\\omega',
      'Gamma': '\\Gamma', 'Delta': '\\Delta', 'Theta': '\\Theta',
      'Lambda': '\\Lambda', 'Xi': '\\Xi', 'Pi': '\\Pi',
      'Sigma': '\\Sigma', 'Upsilon': '\\Upsilon', 'Phi': '\\Phi',
      'Psi': '\\Psi', 'Omega': '\\Omega'
    };
    
    return greekMap[name] ?? name;
  }
  
  /**
   * Standard function to LaTeX mapping
   */
  private functionToLatex(name: string, args: Expression[]): string {
    const standardFunctions = [
      'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
      'sinh', 'cosh', 'tanh', 'coth',
      'arcsin', 'arccos', 'arctan',
      'exp', 'log', 'ln', 'lg',
      'det', 'tr', 'dim', 'ker', 'im'
    ];
    
    const argsLatex = args.map(a => this.expressionToLatex(a)).join(', ');
    
    if (standardFunctions.includes(name)) {
      return `\\${name}\\left(${argsLatex}\\right)`;
    }
    
    // Special handling
    switch (name) {
      case 'abs':
        return `\\left|${argsLatex}\\right|`;
      case 'norm':
        return `\\left\\|${argsLatex}\\right\\|`;
      case 'floor':
        return `\\left\\lfloor${argsLatex}\\right\\rfloor`;
      case 'ceil':
        return `\\left\\lceil${argsLatex}\\right\\rceil`;
      default:
        return `\\mathrm{${name}}\\left(${argsLatex}\\right)`;
    }
  }
  
  /**
   * Build custom macros
   */
  private buildMacros(): Record<string, any> {
    const defaultMacros: Record<string, string> = {
      // Sets
      'R': '\\mathbb{R}',
      'C': '\\mathbb{C}',
      'N': '\\mathbb{N}',
      'Z': '\\mathbb{Z}',
      'Q': '\\mathbb{Q}',
      
      // Operators
      'dd': '\\mathrm{d}',
      'pp': '\\partial',
      'grad': '\\nabla',
      'div': '\\nabla \\cdot',
      'curl': '\\nabla \\times',
      'laplacian': '\\nabla^2',
      
      // Tensors
      'christoffel': '\\Gamma',
      'riemann': 'R',
      'ricci': 'R',
      'metric': 'g',
      
      // Physics
      'bra': ['\\langle #1 |', 1],
      'ket': ['| #1 \\rangle', 1],
      'braket': ['\\langle #1 | #2 \\rangle', 2],
      'comm': ['\\left[ #1, #2 \\right]', 2],
      'anticomm': ['\\left\\{ #1, #2 \\right\\}', 2]
    };
    
    return { ...defaultMacros, ...this.macros };
  }
  
  canRender(value: any): boolean {
    return (
      value instanceof Expression ||
      value instanceof Tensor ||
      value instanceof Matrix ||
      value instanceof Complex ||
      value instanceof Fraction ||
      typeof value === 'string'
    );
  }
  
  getSupportedFormats(): OutputFormat[] {
    return ['svg', 'html'];
  }
  
  dispose(): void {
    // Cleanup
    this.initialized = false;
  }
  
  private async svgToPNG(svg: string): Promise<Blob> {
    // Create canvas and render SVG
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width * 2;  // 2x for retina
        canvas.height = img.height * 2;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create PNG'));
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    });
  }
  
  private numberToLatex(n: number): string {
    if (Number.isInteger(n)) return String(n);
    if (!Number.isFinite(n)) {
      if (n === Infinity) return '\\infty';
      if (n === -Infinity) return '-\\infty';
      return '\\text{NaN}';
    }
    // Scientific notation for very large/small
    if (Math.abs(n) > 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) {
      const exp = Math.floor(Math.log10(Math.abs(n)));
      const mantissa = n / Math.pow(10, exp);
      return `${mantissa.toFixed(3)} \\times 10^{${exp}}`;
    }
    return n.toPrecision(6).replace(/\.?0+$/, '');
  }
  
  private symbolToLatex(name: string, sub?: string, sup?: string): string {
    let latex = this.greekToLatex(name);
    if (sub) latex += `_{${sub}}`;
    if (sup) latex += `^{${sup}}`;
    return latex;
  }
  
  private complexToLatex(c: Complex): string {
    const re = this.numberToLatex(c.re);
    const im = this.numberToLatex(Math.abs(c.im));
    if (c.im === 0) return re;
    if (c.re === 0) return c.im < 0 ? `-${im}i` : `${im}i`;
    return c.im < 0 ? `${re} - ${im}i` : `${re} + ${im}i`;
  }
  
  private fractionToLatex(f: Fraction): string {
    if (f.d === 1) return String(f.n);
    return `\\frac{${f.n}}{${f.d}}`;
  }
  
  private derivativeToLatex(expr: Expression): string {
    const { func, variable, order } = expr.metadata;
    const funcLatex = this.expressionToLatex(func);
    const varLatex = this.expressionToLatex(variable);
    
    if (order === 1) {
      return `\\frac{\\dd ${funcLatex}}{\\dd ${varLatex}}`;
    }
    return `\\frac{\\dd^{${order}} ${funcLatex}}{\\dd ${varLatex}^{${order}}}`;
  }
  
  private integralToLatex(expr: Expression): string {
    const { integrand, variable, lower, upper } = expr.metadata;
    const intLatex = this.expressionToLatex(integrand);
    const varLatex = this.expressionToLatex(variable);
    
    if (lower !== undefined && upper !== undefined) {
      const lowerLatex = this.expressionToLatex(lower);
      const upperLatex = this.expressionToLatex(upper);
      return `\\int_{${lowerLatex}}^{${upperLatex}} ${intLatex} \\, \\dd ${varLatex}`;
    }
    return `\\int ${intLatex} \\, \\dd ${varLatex}`;
  }
  
  private sumToLatex(expr: Expression): string {
    const { summand, index, lower, upper } = expr.metadata;
    const sumLatex = this.expressionToLatex(summand);
    const idxLatex = this.expressionToLatex(index);
    const lowerLatex = this.expressionToLatex(lower);
    const upperLatex = this.expressionToLatex(upper);
    
    return `\\sum_{${idxLatex}=${lowerLatex}}^{${upperLatex}} ${sumLatex}`;
  }
  
  private productToLatex(expr: Expression): string {
    const { factor, index, lower, upper } = expr.metadata;
    const prodLatex = this.expressionToLatex(factor);
    const idxLatex = this.expressionToLatex(index);
    const lowerLatex = this.expressionToLatex(lower);
    const upperLatex = this.expressionToLatex(upper);
    
    return `\\prod_{${idxLatex}=${lowerLatex}}^{${upperLatex}} ${prodLatex}`;
  }
  
  private limitToLatex(expr: Expression): string {
    const { func, variable, approaching, direction } = expr.metadata;
    const funcLatex = this.expressionToLatex(func);
    const varLatex = this.expressionToLatex(variable);
    const appLatex = this.expressionToLatex(approaching);
    
    let dirSymbol = '';
    if (direction === 'left') dirSymbol = '^-';
    if (direction === 'right') dirSymbol = '^+';
    
    return `\\lim_{${varLatex} \\to ${appLatex}${dirSymbol}} ${funcLatex}`;
  }
  
  private detectDisplayMode(latex: string): boolean {
    // Display mode for equations, matrices, etc.
    return (
      latex.includes('\\frac') ||
      latex.includes('\\sum') ||
      latex.includes('\\int') ||
      latex.includes('\\prod') ||
      latex.includes('\\lim') ||
      latex.includes('begin{') ||
      latex.length > 50
    );
  }
}

interface MathJaxConfig {
  macros?: Record<string, string | [string, number]>;
  packages?: string[];
}

interface MathJaxRenderOptions extends RenderOptions {
  display?: boolean;
  format?: 'svg' | 'html';
  showComponents?: boolean;
  matrixStyle?: 'pmatrix' | 'bmatrix' | 'vmatrix' | 'Vmatrix' | 'matrix';
  width?: number;
}
```

-----

## 8. Graphviz Renderer (2D Diagrams)

### 8.1 Graphviz Controller Implementation

```typescript
// src/viz/graphviz/renderer.ts

import { Graphviz } from '@hpcc-js/wasm/graphviz';

/**
 * Graphviz renderer for 2D graphs and diagrams
 */
export class GraphvizRenderer implements IRenderer {
  readonly type = 'graphviz';
  readonly version = '1.0.0';
  
  private graphviz: Graphviz | null = null;
  private config: GraphvizConfig;
  private initialized = false;
  
  constructor(config: GraphvizConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.graphviz = await Graphviz.load();
    this.initialized = true;
  }
  
  async render(value: any, options?: GraphvizRenderOptions): Promise<RenderedOutput> {
    await this.initialize();
    
    // Convert value to DOT language
    const dot = this.toDot(value, options);
    
    // Select engine
    const engine = options?.engine ?? this.config.engine ?? 'dot';
    
    // Render
    const format = options?.format ?? 'svg';
    
    try {
      const result = this.graphviz!.layout(dot, format, engine);
      
      return {
        type: 'graph',
        format: format === 'svg' ? 'svg' : 'text',
        content: result,
        mimeType: format === 'svg' ? 'image/svg+xml' : 'text/plain',
        interactive: false,
        toSVG: async () => format === 'svg' ? result : this.graphviz!.layout(dot, 'svg', engine),
        toPNG: async () => this.svgToPNG(this.graphviz!.layout(dot, 'svg', engine)),
        toHTML: () => `<div class="mtsw-graphviz">${result}</div>`
      };
      
    } catch (error) {
      throw new GraphvizError(`Failed to render graph: ${error.message}`, dot);
    }
  }
  
  /**
   * Convert various inputs to DOT language
   */
  toDot(value: any, options?: GraphvizRenderOptions): string {
    // Already DOT string
    if (typeof value === 'string') {
      return value;
    }
    
    // Graph object
    if (value instanceof Graph) {
      return this.graphToDot(value, options);
    }
    
    // Dependency graph
    if (value instanceof DependencyGraph) {
      return value.toDot();
    }
    
    // Expression tree
    if (value instanceof Expression) {
      return this.expressionTreeToDot(value, options);
    }
    
    // Tensor network
    if (value instanceof TensorNetwork) {
      return this.tensorNetworkToDot(value, options);
    }
    
    // State machine
    if (value.states && value.transitions) {
      return this.stateMachineToDot(value, options);
    }
    
    // Adjacency matrix/list
    if (Array.isArray(value) || value instanceof Matrix) {
      return this.adjacencyToDot(value, options);
    }
    
    throw new Error(`Cannot convert ${typeof value} to DOT`);
  }
  
  /**
   * Convert Graph object to DOT
   */
  private graphToDot(graph: Graph, options?: GraphvizRenderOptions): string {
    const directed = graph.directed ?? true;
    const graphType = directed ? 'digraph' : 'graph';
    const edgeOp = directed ? '->' : '--';
    
    const lines: string[] = [];
    lines.push(`${graphType} G {`);
    
    // Global attributes
    lines.push(`  rankdir=${options?.rankdir ?? this.config.rankdir ?? 'TB'};`);
    lines.push(`  splines=${options?.splines ?? this.config.splines ?? 'spline'};`);
    
    // Node defaults
    const nodeDefaults = { ...this.config.node, ...options?.nodeDefaults };
    lines.push(`  node [${this.formatAttributes(nodeDefaults)}];`);
    
    // Edge defaults
    const edgeDefaults = { ...this.config.edge, ...options?.edgeDefaults };
    lines.push(`  edge [${this.formatAttributes(edgeDefaults)}];`);
    
    // Nodes
    for (const node of graph.nodes) {
      const attrs = this.formatAttributes(node.attributes ?? {});
      const label = node.label ?? node.id;
      lines.push(`  "${node.id}" [label="${label}"${attrs ? ', ' + attrs : ''}];`);
    }
    
    // Edges
    for (const edge of graph.edges) {
      const attrs = this.formatAttributes(edge.attributes ?? {});
      const label = edge.label ? `label="${edge.label}"` : '';
      const attrStr = [label, attrs].filter(Boolean).join(', ');
      lines.push(`  "${edge.from}" ${edgeOp} "${edge.to}"${attrStr ? ' [' + attrStr + ']' : ''};`);
    }
    
    // Subgraphs/clusters
    if (graph.subgraphs) {
      for (const [name, nodes] of Object.entries(graph.subgraphs)) {
        lines.push(`  subgraph cluster_${name} {`);
        lines.push(`    label="${name}";`);
        for (const nodeId of nodes) {
          lines.push(`    "${nodeId}";`);
        }
        lines.push('  }');
      }
    }
    
    lines.push('}');
    return lines.join('\n');
  }
  
  /**
   * Convert expression tree to DOT for visualization
   */
  private expressionTreeToDot(expr: Expression, options?: GraphvizRenderOptions): string {
    const lines: string[] = [];
    lines.push('digraph ExpressionTree {');
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=circle, style=filled, fillcolor="#e8e8e8"];');
    
    let nodeId = 0;
    
    const addNode = (e: Expression, parentId?: number): number => {
      const id = nodeId++;
      const label = this.getExpressionNodeLabel(e);
      const shape = this.getExpressionNodeShape(e);
      const color = this.getExpressionNodeColor(e);
      
      lines.push(`  n${id} [label="${label}", shape=${shape}, fillcolor="${color}"];`);
      
      if (parentId !== undefined) {
        lines.push(`  n${parentId} -> n${id};`);
      }
      
      // Add children
      if (e.children) {
        for (const child of e.children) {
          addNode(child, id);
        }
      }
      
      return id;
    };
    
    addNode(expr);
    
    lines.push('}');
    return lines.join('\n');
  }
  
  /**
   * Convert tensor network to DOT
   */
  private tensorNetworkToDot(network: TensorNetwork, options?: GraphvizRenderOptions): string {
    const lines: string[] = [];
    lines.push('graph TensorNetwork {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box, style=rounded];');
    
    // Tensors as nodes
    for (const tensor of network.tensors) {
      const label = tensor.name + this.formatTensorIndices(tensor.indices);
      lines.push(`  "${tensor.id}" [label="${label}"];`);
    }
    
    // Contractions as edges
    for (const contraction of network.contractions) {
      const label = contraction.index;
      lines.push(`  "${contraction.tensor1}" -- "${contraction.tensor2}" [label="${label}"];`);
    }
    
    // Open indices as dangling edges
    for (const openIdx of network.openIndices) {
      const dummyId = `open_${openIdx.index}`;
      lines.push(`  "${dummyId}" [shape=point];`);
      lines.push(`  "${openIdx.tensor}" -- "${dummyId}" [label="${openIdx.index}"];`);
    }
    
    lines.push('}');
    return lines.join('\n');
  }
  
  /**
   * Convert state machine to DOT
   */
  private stateMachineToDot(
    sm: { states: State[], transitions: Transition[], initial?: string, final?: string[] },
    options?: GraphvizRenderOptions
  ): string {
    const lines: string[] = [];
    lines.push('digraph StateMachine {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=circle];');
    
    // Initial state indicator
    if (sm.initial) {
      lines.push('  __start__ [shape=point];');
      lines.push(`  __start__ -> "${sm.initial}";`);
    }
    
    // Final states
    const finalStates = new Set(sm.final ?? []);
    
    // States
    for (const state of sm.states) {
      const shape = finalStates.has(state.id) ? 'doublecircle' : 'circle';
      const label = state.label ?? state.id;
      lines.push(`  "${state.id}" [label="${label}", shape=${shape}];`);
    }
    
    // Transitions
    for (const trans of sm.transitions) {
      const label = trans.label ?? trans.event ?? '';
      lines.push(`  "${trans.from}" -> "${trans.to}" [label="${label}"];`);
    }
    
    lines.push('}');
    return lines.join('\n');
  }
  
  /**
   * Convert adjacency representation to DOT
   */
  private adjacencyToDot(
    adj: number[][] | Matrix,
    options?: GraphvizRenderOptions
  ): string {
    const matrix = adj instanceof Matrix ? adj : new Matrix(adj);
    const n = matrix.rows;
    const directed = !this.isSymmetric(matrix);
    
    const graphType = directed ? 'digraph' : 'graph';
    const edgeOp = directed ? '->' : '--';
    
    const lines: string[] = [];
    lines.push(`${graphType} G {`);
    
    // Nodes
    for (let i = 0; i < n; i++) {
      lines.push(`  "${i}";`);
    }
    
    // Edges
    for (let i = 0; i < n; i++) {
      const jStart = directed ? 0 : i;
      for (let j = jStart; j < n; j++) {
        const weight = matrix.get(i, j);
        if (weight !== 0) {
          const label = weight !== 1 ? `label="${weight}"` : '';
          lines.push(`  "${i}" ${edgeOp} "${j}"${label ? ' [' + label + ']' : ''};`);
        }
      }
    }
    
    lines.push('}');
    return lines.join('\n');
  }
  
  private formatAttributes(attrs: Record<string, any>): string {
    return Object.entries(attrs)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k}="${v}"`)
      .join(', ');
  }
  
  private formatTensorIndices(indices: TensorIndex[]): string {
    const upper = indices.filter(i => i.position === 'up').map(i => i.name).join('');
    const lower = indices.filter(i => i.position === 'down').map(i => i.name).join('');
    
    let result = '';
    if (upper) result += `^{${upper}}`;
    if (lower) result += `_{${lower}}`;
    return result;
  }
  
  private getExpressionNodeLabel(expr: Expression): string {
    switch (expr.type) {
      case 'number': return String(expr.value);
      case 'symbol': return expr.name;
      case 'add': return '+';
      case 'multiply': return '×';
      case 'divide': return '÷';
      case 'power': return '^';
      case 'function': return expr.name;
      default: return expr.type;
    }
  }
  
  private getExpressionNodeShape(expr: Expression): string {
    switch (expr.type) {
      case 'number': return 'box';
      case 'symbol': return 'ellipse';
      default: return 'circle';
    }
  }
  
  private getExpressionNodeColor(expr: Expression): string {
    switch (expr.type) {
      case 'number': return '#e3f2fd';
      case 'symbol': return '#e8f5e9';
      case 'add': case 'multiply': return '#fff3e0';
      case 'function': return '#fce4ec';
      default: return '#e8e8e8';
    }
  }
  
  private isSymmetric(matrix: Matrix): boolean {
    for (let i = 0; i < matrix.rows; i++) {
      for (let j = i + 1; j < matrix.cols; j++) {
        if (matrix.get(i, j) !== matrix.get(j, i)) return false;
      }
    }
    return true;
  }
  
  canRender(value: any): boolean {
    return (
      typeof value === 'string' ||
      value instanceof Graph ||
      value instanceof DependencyGraph ||
      value instanceof Expression ||
      value instanceof TensorNetwork ||
      (value.states && value.transitions) ||
      Array.isArray(value) ||
      value instanceof Matrix
    );
  }
  
  getSupportedFormats(): OutputFormat[] {
    return ['svg', 'text'];
  }
  
  dispose(): void {
    this.graphviz = null;
    this.initialized = false;
  }
  
  private async svgToPNG(svg: string): Promise<Blob> {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create PNG'));
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    });
  }
}

interface GraphvizConfig {
  engine?: 'dot' | 'neato' | 'fdp' | 'sfdp' | 'circo' | 'twopi';
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
  splines?: 'spline' | 'line' | 'ortho' | 'polyline' | 'curved';
  node?: Record<string, any>;
  edge?: Record<string, any>;
}

interface GraphvizRenderOptions extends RenderOptions {
  engine?: 'dot' | 'neato' | 'fdp' | 'sfdp' | 'circo' | 'twopi';
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
  splines?: string;
  nodeDefaults?: Record<string, any>;
  edgeDefaults?: Record<string, any>;
  format?: 'svg' | 'dot' | 'json';
}

interface Graph {
  directed?: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  subgraphs?: Record<string, string[]>;
}

interface GraphNode {
  id: string;
  label?: string;
  attributes?: Record<string, any>;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  attributes?: Record<string, any>;
}

class GraphvizError extends Error {
  constructor(message: string, public dot: string) {
    super(message);
    this.name = 'GraphvizError';
  }
}
```

-----

## 9. Three.js Renderer (3D Visualization)

### 9.1 Three.js Controller Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Three.js Renderer                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        Scene Manager                                     │    │
│  │                                                                          │    │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                    │    │
│  │  │   Scene     │   │   Camera    │   │  Renderer   │                    │    │
│  │  │   Graph     │   │  Controller │   │   Context   │                    │    │
│  │  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                    │    │
│  │         └─────────────────┴─────────────────┘                            │    │
│  │                           │                                              │    │
│  └───────────────────────────┼──────────────────────────────────────────────┘   │
│                              │                                                   │
│  ┌───────────────────────────┼──────────────────────────────────────────────┐   │
│  │                    Scientific Visualization Objects                       │   │
│  │                                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ Surfaces    │  │ Curves      │  │ Vector      │  │ Tensor      │     │   │
│  │  │             │  │             │  │ Fields      │  │ Fields      │     │   │
│  │  │ • z=f(x,y)  │  │ • Geodesics │  │ • Arrows    │  │ • Ellipsoids│     │   │
│  │  │ • Parametric│  │ • Orbits    │  │ • Streamlin.│  │ • Glyphs    │     │   │
│  │  │ • Implicit  │  │ • Splines   │  │ • LIC       │  │             │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │                                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ Coordinate  │  │ Spacetime   │  │ Annotations │  │ Animation   │     │   │
│  │  │ Frames      │  │ Diagrams    │  │             │  │ Controller  │     │   │
│  │  │             │  │             │  │ • Labels    │  │             │     │   │
│  │  │ • Cartesian │  │ • Penrose   │  │ • Axes      │  │ • Timeline  │     │   │
│  │  │ • Spherical │  │ • Light cone│  │ • Legends   │  │ • Keyframes │     │   │
│  │  │ • Minkowski │  │ • Embedding │  │ • Captions  │  │ • Physics   │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Three.js Controller Implementation

```typescript
// src/viz/threejs/renderer.ts

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { WebGPURenderer } from 'three/examples/jsm/renderers/webgpu/WebGPURenderer';

/**
 * Three.js renderer for 3D scientific visualization
 */
export class ThreeJSRenderer implements IRenderer {
  readonly type = 'threejs';
  readonly version = '1.0.0';
  
  private config: ThreeJSConfig;
  private activeScenes: Map<string, ManagedScene>;
  private animationLoop: number | null = null;
  
  constructor(config: ThreeJSConfig) {
    this.config = config;
    this.activeScenes = new Map();
  }
  
  async initialize(): Promise<void> {
    // Check WebGPU support
    if (this.config.renderer.type === 'webgpu') {
      if (!navigator.gpu) {
        console.warn('WebGPU not supported, falling back to WebGL');
        this.config.renderer.type = 'webgl2';
      }
    }
  }
  
  async render(value: any, options?: ThreeJSRenderOptions): Promise<RenderedOutput> {
    await this.initialize();
    
    // Create managed scene
    const sceneId = options?.sceneId ?? `scene-${Date.now()}`;
    const scene = this.createManagedScene(sceneId, options);
    
    // Add objects based on value type
    await this.addToScene(scene, value, options);
    
    // Setup lighting
    this.setupLighting(scene, options);
    
    // Render initial frame
    const rendered = scene.render();
    
    // Store for interaction
    this.activeScenes.set(sceneId, scene);
    
    return {
      type: 'scene3d',
      format: 'webgl',
      content: scene.domElement,
      mimeType: 'application/x-threejs-scene',
      width: options?.width ?? this.config.width,
      height: options?.height ?? this.config.height,
      interactive: options?.interactive ?? true,
      
      toSVG: async () => this.renderToSVG(scene),
      toPNG: async () => this.renderToPNG(scene),
      toHTML: () => this.renderToHTML(scene, sceneId)
    };
  }
  
  /**
   * Create a managed scene with camera and controls
   */
  private createManagedScene(id: string, options?: ThreeJSRenderOptions): ManagedScene {
    const width = options?.width ?? this.config.width ?? 800;
    const height = options?.height ?? this.config.height ?? 600;
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(
      options?.background ?? this.config.style?.background ?? 0x1a1a2e
    );
    
    // Create camera
    const cameraConfig = { ...this.config.camera, ...options?.camera };
    const camera = this.createCamera(cameraConfig, width, height);
    
    // Create renderer
    const renderer = this.createRenderer(width, height, options);
    
    // Create controls
    const controlsConfig = { ...this.config.controls, ...options?.controls };
    const controls = this.createControls(controlsConfig, camera, renderer.domElement);
    
    return {
      id,
      scene,
      camera,
      renderer,
      controls,
      domElement: renderer.domElement,
      objects: new Map(),
      
      render: () => {
        controls.update();
        renderer.render(scene, camera);
        return renderer.domElement;
      },
      
      dispose: () => {
        controls.dispose();
        renderer.dispose();
        scene.clear();
      }
    };
  }
  
  /**
   * Add objects to scene based on value type
   */
  private async addToScene(
    scene: ManagedScene,
    value: any,
    options?: ThreeJSRenderOptions
  ): Promise<void> {
    // Scene DSL object
    if (value instanceof SceneBuilder) {
      for (const obj of value.objects) {
        await this.addObject(scene, obj);
      }
      return;
    }
    
    // Surface function z = f(x,y)
    if (value.type === 'surface' || typeof value === 'function') {
      await this.addSurface(scene, value, options);
      return;
    }
    
    // Parametric surface
    if (value.type === 'parametric') {
      await this.addParametricSurface(scene, value, options);
      return;
    }
    
    // Curve/geodesic
    if (value.type === 'curve' || value instanceof Curve) {
      await this.addCurve(scene, value, options);
      return;
    }
    
    // Vector field
    if (value.type === 'vectorField') {
      await this.addVectorField(scene, value, options);
      return;
    }
    
    // Tensor field
    if (value.type === 'tensorField' || value instanceof TensorField) {
      await this.addTensorField(scene, value, options);
      return;
    }
    
    // Point cloud
    if (value.type === 'points' || Array.isArray(value)) {
      await this.addPointCloud(scene, value, options);
      return;
    }
    
    // Metric visualization (embedding)
    if (value instanceof MetricTensor) {
      await this.addMetricVisualization(scene, value, options);
      return;
    }
  }
  
  /**
   * Add surface z = f(x,y)
   */
  private async addSurface(
    scene: ManagedScene,
    surface: SurfaceSpec | ((x: number, y: number) => number),
    options?: ThreeJSRenderOptions
  ): Promise<THREE.Mesh> {
    const func = typeof surface === 'function' ? surface : surface.func;
    const domain = typeof surface === 'function' 
      ? { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
      : surface.domain;
    const resolution = options?.resolution ?? 64;
    
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    
    const xStep = (domain.xMax - domain.xMin) / resolution;
    const yStep = (domain.yMax - domain.yMin) / resolution;
    
    // Generate vertices
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const x = domain.xMin + i * xStep;
        const y = domain.yMin + j * yStep;
        const z = func(x, y);
        
        vertices.push(x, z, y);  // y-up convention
        zMin = Math.min(zMin, z);
        zMax = Math.max(zMax, z);
      }
    }
    
    // Generate colors based on z
    const colormap = this.getColormap(options?.colormap ?? 'viridis');
    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const idx = i * (resolution + 1) + j;
        const z = vertices[idx * 3 + 1];
        const t = (z - zMin) / (zMax - zMin || 1);
        const color = colormap(t);
        colors.push(color.r, color.g, color.b);
      }
    }
    
    // Generate indices
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const a = i * (resolution + 1) + j;
        const b = a + 1;
        const c = a + (resolution + 1);
        const d = c + 1;
        
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: options?.flatShading ?? false
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.scene.add(mesh);
    scene.objects.set('surface', mesh);
    
    // Add wireframe if requested
    if (options?.wireframe) {
      const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.3, transparent: true })
      );
      scene.scene.add(wireframe);
    }
    
    return mesh;
  }
  
  /**
   * Add curve/geodesic
   */
  private async addCurve(
    scene: ManagedScene,
    curve: CurveSpec | Curve,
    options?: ThreeJSRenderOptions
  ): Promise<THREE.Line> {
    const points = curve instanceof Curve 
      ? curve.points 
      : curve.points;
    
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    
    // Get parameter values for coloring
    const params = curve instanceof Curve ? curve.parameters : null;
    const colormap = this.getColormap(options?.colormap ?? 'viridis');
    
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      vertices.push(p.x, p.y, p.z);
      
      // Color by parameter or index
      const t = params ? (params[i] - params[0]) / (params[params.length - 1] - params[0]) : i / points.length;
      const color = colormap(t);
      colors.push(color.r, color.g, color.b);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: options?.lineWidth ?? 2
    });
    
    const line = new THREE.Line(geometry, material);
    scene.scene.add(line);
    scene.objects.set('curve', line);
    
    return line;
  }
  
  /**
   * Add vector field visualization
   */
  private async addVectorField(
    scene: ManagedScene,
    field: VectorFieldSpec,
    options?: ThreeJSRenderOptions
  ): Promise<THREE.Group> {
    const group = new THREE.Group();
    
    const domain = field.domain;
    const resolution = options?.vectorResolution ?? 8;
    const scale = options?.vectorScale ?? 0.5;
    
    const xStep = (domain.xMax - domain.xMin) / resolution;
    const yStep = (domain.yMax - domain.yMin) / resolution;
    const zStep = domain.zMin !== undefined 
      ? (domain.zMax! - domain.zMin) / resolution 
      : 0;
    
    const arrowHelper = (origin: THREE.Vector3, direction: THREE.Vector3, length: number, color: THREE.Color) => {
      const arrow = new THREE.ArrowHelper(
        direction.normalize(),
        origin,
        length * scale,
        color.getHex(),
        length * scale * 0.3,
        length * scale * 0.15
      );
      group.add(arrow);
    };
    
    const colormap = this.getColormap(options?.colormap ?? 'viridis');
    
    // Find max magnitude for normalization
    let maxMag = 0;
    const vectors: { origin: THREE.Vector3, dir: THREE.Vector3, mag: number }[] = [];
    
    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        for (let k = 0; k <= (domain.zMin !== undefined ? resolution : 0); k++) {
          const x = domain.xMin + i * xStep;
          const y = domain.yMin + j * yStep;
          const z = domain.zMin !== undefined ? domain.zMin + k * zStep : 0;
          
          const v = field.func(x, y, z);
          const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
          
          vectors.push({
            origin: new THREE.Vector3(x, z, y),  // y-up
            dir: new THREE.Vector3(v.x, v.z, v.y),
            mag
          });
          
          maxMag = Math.max(maxMag, mag);
        }
      }
    }
    
    // Create arrows
    for (const v of vectors) {
      if (v.mag > 0.01 * maxMag) {  // Skip tiny vectors
        const t = v.mag / maxMag;
        const color = colormap(t);
        arrowHelper(v.origin, v.dir, v.mag / maxMag, color);
      }
    }
    
    scene.scene.add(group);
    scene.objects.set('vectorField', group);
    
    return group;
  }
  
  /**
   * Add tensor field visualization (stress tensors, metric fields)
   */
  private async addTensorField(
    scene: ManagedScene,
    field: TensorField | TensorFieldSpec,
    options?: ThreeJSRenderOptions
  ): Promise<THREE.Group> {
    const group = new THREE.Group();
    
    // Use ellipsoids to visualize symmetric rank-2 tensors
    const domain = field.domain;
    const resolution = options?.tensorResolution ?? 6;
    
    const xStep = (domain.xMax - domain.xMin) / resolution;
    const yStep = (domain.yMax - domain.yMin) / resolution;
    
    const ellipsoidGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    
    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const x = domain.xMin + i * xStep;
        const y = domain.yMin + j * yStep;
        
        // Get tensor at point
        const T = field.at(x, y);
        
        // Eigendecomposition for visualization
        const { eigenvalues, eigenvectors } = this.eigenDecompose2D(T);
        
        // Create scaled ellipsoid
        const material = new THREE.MeshPhongMaterial({
          color: this.tensorColor(eigenvalues),
          transparent: true,
          opacity: 0.7
        });
        
        const ellipsoid = new THREE.Mesh(ellipsoidGeometry, material);
        
        // Scale by eigenvalues
        ellipsoid.scale.set(
          Math.abs(eigenvalues[0]) * 0.5,
          Math.abs(eigenvalues[1]) * 0.5,
          0.05
        );
        
        // Rotate by eigenvectors
        const angle = Math.atan2(eigenvectors[0][1], eigenvectors[0][0]);
        ellipsoid.rotation.z = angle;
        
        // Position
        ellipsoid.position.set(x, 0, y);
        
        group.add(ellipsoid);
      }
    }
    
    scene.scene.add(group);
    scene.objects.set('tensorField', group);
    
    return group;
  }
  
  /**
   * Visualize metric tensor as embedded surface
   */
  private async addMetricVisualization(
    scene: ManagedScene,
    metric: MetricTensor,
    options?: ThreeJSRenderOptions
  ): Promise<THREE.Mesh> {
    // For 2D metrics, embed in 3D
    // For spacetime metrics, use embedding diagrams
    
    if (metric.dimension === 2) {
      // Embed 2D metric as surface
      return this.embedMetric2D(scene, metric, options);
    }
    
    if (metric.dimension === 4 && metric.isLorentzian) {
      // Create embedding diagram (e.g., Flamm paraboloid for Schwarzschild)
      return this.createEmbeddingDiagram(scene, metric, options);
    }
    
    throw new Error(`Cannot visualize ${metric.dimension}D metric directly`);
  }
  
  /**
   * Create Flamm paraboloid or similar embedding
   */
  private async createEmbeddingDiagram(
    scene: ManagedScene,
    metric: MetricTensor,
    options?: ThreeJSRenderOptions
  ): Promise<THREE.Mesh> {
    // For Schwarzschild: z(r) = 2√(rs(r - rs))
    const rs = options?.schwarzschildRadius ?? 2;
    const rMin = rs * 1.01;
    const rMax = options?.rMax ?? 10;
    const resolution = options?.resolution ?? 64;
    
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    
    const colormap = this.getColormap('plasma');
    
    // Generate paraboloid
    for (let i = 0; i <= resolution; i++) {
      const r = rMin + (rMax - rMin) * (i / resolution);
      const z = 2 * Math.sqrt(rs * (r - rs));
      
      for (let j = 0; j <= resolution; j++) {
        const phi = 2 * Math.PI * j / resolution;
        
        vertices.push(
          r * Math.cos(phi),
          z,
          r * Math.sin(phi)
        );
        
        const t = (r - rMin) / (rMax - rMin);
        const color = colormap(t);
        colors.push(color.r, color.g, color.b);
      }
    }
    
    // Generate indices
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const a = i * (resolution + 1) + j;
        const b = a + 1;
        const c = a + (resolution + 1);
        const d = c + 1;
        
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.scene.add(mesh);
    
    // Add event horizon sphere
    const horizonGeometry = new THREE.SphereGeometry(rs, 32, 32);
    const horizonMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000
    });
    const horizon = new THREE.Mesh(horizonGeometry, horizonMaterial);
    scene.scene.add(horizon);
    
    return mesh;
  }
  
  /**
   * Setup scene lighting
   */
  private setupLighting(scene: ManagedScene, options?: ThreeJSRenderOptions): void {
    const lightConfig = { ...this.config.lighting, ...options?.lighting };
    
    // Ambient light
    const ambient = new THREE.AmbientLight(
      lightConfig.ambient?.color ?? 0xffffff,
      lightConfig.ambient?.intensity ?? 0.4
    );
    scene.scene.add(ambient);
    
    // Directional light
    const directional = new THREE.DirectionalLight(
      lightConfig.directional?.color ?? 0xffffff,
      lightConfig.directional?.intensity ?? 0.8
    );
    const dirPos = lightConfig.directional?.position ?? [10, 10, 10];
    directional.position.set(dirPos[0], dirPos[1], dirPos[2]);
    scene.scene.add(directional);
    
    // Add grid and axes helpers
    if (this.config.style?.gridHelper ?? true) {
      const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
      scene.scene.add(grid);
    }
    
    if (this.config.style?.axesHelper ?? true) {
      const axes = new THREE.AxesHelper(5);
      scene.scene.add(axes);
    }
  }
  
  /**
   * Get colormap function
   */
  private getColormap(name: string): (t: number) => THREE.Color {
    const colormaps: Record<string, (t: number) => THREE.Color> = {
      viridis: (t) => {
        // Simplified viridis
        const r = Math.min(1, Math.max(0, 0.267 + t * (0.993 - 0.267)));
        const g = Math.min(1, Math.max(0, 0.004 + t * 0.906));
        const b = Math.min(1, Math.max(0, 0.329 + t * (0.143 - 0.329 + 0.5)));
        return new THREE.Color(r, g, b);
      },
      plasma: (t) => {
        const r = Math.min(1, 0.05 + t * 0.95);
        const g = Math.min(1, t * 0.9);
        const b = Math.max(0, 0.53 - t * 0.3);
        return new THREE.Color(r, g, b);
      },
      coolwarm: (t) => {
        if (t < 0.5) {
          return new THREE.Color(0.23, 0.3 + t * 0.7, 0.75 + t * 0.25);
        }
        return new THREE.Color(0.75 + (t - 0.5) * 0.25, 0.3 + (1 - t) * 0.7, 0.23);
      }
    };
    
    return colormaps[name] ?? colormaps.viridis;
  }
  
  private createCamera(config: CameraConfig, width: number, height: number): THREE.Camera {
    if (config.type === 'orthographic') {
      const aspect = width / height;
      const size = config.size ?? 10;
      return new THREE.OrthographicCamera(
        -size * aspect, size * aspect,
        size, -size,
        config.near ?? 0.1,
        config.far ?? 1000
      );
    }
    
    const camera = new THREE.PerspectiveCamera(
      config.fov ?? 75,
      width / height,
      config.near ?? 0.1,
      config.far ?? 1000
    );
    
    const pos = config.position ?? [5, 5, 5];
    camera.position.set(pos[0], pos[1], pos[2]);
    
    const lookAt = config.lookAt ?? [0, 0, 0];
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    
    return camera;
  }
  
  private createRenderer(width: number, height: number, options?: ThreeJSRenderOptions): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: this.config.renderer.antialias ?? true,
      alpha: true
    });
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      this.config.renderer.pixelRatio === 'device' 
        ? window.devicePixelRatio 
        : this.config.renderer.pixelRatio ?? 1
    );
    
    return renderer;
  }
  
  private createControls(config: ControlsConfig, camera: THREE.Camera, domElement: HTMLElement): OrbitControls {
    const controls = new OrbitControls(camera, domElement);
    
    controls.enableDamping = config.enableDamping ?? true;
    controls.dampingFactor = config.dampingFactor ?? 0.05;
    
    return controls;
  }
  
  private async renderToPNG(scene: ManagedScene): Promise<Blob> {
    scene.render();
    return new Promise((resolve, reject) => {
      scene.renderer.domElement.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG'));
      }, 'image/png');
    });
  }
  
  private async renderToSVG(scene: ManagedScene): Promise<string> {
    // Use SVGRenderer for vector output
    // This is a simplified version
    throw new Error('SVG export not yet implemented');
  }
  
  private renderToHTML(scene: ManagedScene, id: string): string {
    return `<div class="mtsw-threejs" data-scene-id="${id}"></div>`;
  }
  
  private tensorColor(eigenvalues: number[]): THREE.Color {
    // Color based on tensor character
    const trace = eigenvalues.reduce((a, b) => a + b, 0);
    if (trace > 0) return new THREE.Color(0.2, 0.6, 1.0);  // Blue for tension
    if (trace < 0) return new THREE.Color(1.0, 0.4, 0.2);  // Red for compression
    return new THREE.Color(0.5, 0.5, 0.5);  // Gray for traceless
  }
  
  private eigenDecompose2D(T: number[][]): { eigenvalues: number[], eigenvectors: number[][] } {
    const a = T[0][0], b = T[0][1], c = T[1][0], d = T[1][1];
    const trace = a + d;
    const det = a * d - b * c;
    const disc = Math.sqrt(trace * trace - 4 * det);
    
    const l1 = (trace + disc) / 2;
    const l2 = (trace - disc) / 2;
    
    // Eigenvectors
    let v1: number[], v2: number[];
    if (b !== 0) {
      v1 = [l1 - d, b];
      v2 = [l2 - d, b];
    } else if (c !== 0) {
      v1 = [c, l1 - a];
      v2 = [c, l2 - a];
    } else {
      v1 = [1, 0];
      v2 = [0, 1];
    }
    
    // Normalize
    const norm1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
    const norm2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
    
    return {
      eigenvalues: [l1, l2],
      eigenvectors: [
        [v1[0] / norm1, v1[1] / norm1],
        [v2[0] / norm2, v2[1] / norm2]
      ]
    };
  }
  
  canRender(value: any): boolean {
    return (
      value instanceof SceneBuilder ||
      value instanceof Curve ||
      value instanceof TensorField ||
      value instanceof MetricTensor ||
      typeof value === 'function' ||
      value.type === 'surface' ||
      value.type === 'parametric' ||
      value.type === 'curve' ||
      value.type === 'vectorField' ||
      value.type === 'tensorField' ||
      value.type === 'points'
    );
  }
  
  getSupportedFormats(): OutputFormat[] {
    return ['webgl', 'canvas'];
  }
  
  dispose(): void {
    for (const scene of this.activeScenes.values()) {
      scene.dispose();
    }
    this.activeScenes.clear();
  }
}

// Supporting interfaces and types

interface ManagedScene {
  id: string;
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  domElement: HTMLCanvasElement;
  objects: Map<string, THREE.Object3D>;
  render: () => HTMLCanvasElement;
  dispose: () => void;
}

interface ThreeJSConfig {
  width?: number;
  height?: number;
  renderer: {
    type: 'webgpu' | 'webgl2' | 'webgl';
    antialias?: boolean;
    pixelRatio?: number | 'device';
  };
  camera: CameraConfig;
  controls: ControlsConfig;
  lighting: LightingConfig;
  style?: {
    background?: number;
    gridHelper?: boolean;
    axesHelper?: boolean;
  };
}

interface CameraConfig {
  type?: 'perspective' | 'orthographic';
  fov?: number;
  near?: number;
  far?: number;
  position?: [number, number, number];
  lookAt?: [number, number, number];
  size?: number;
}

interface ControlsConfig {
  type?: 'orbit' | 'fly' | 'trackball';
  enableDamping?: boolean;
  dampingFactor?: number;
}

interface LightingConfig {
  ambient?: { color?: number; intensity?: number };
  directional?: { color?: number; intensity?: number; position?: [number, number, number] };
}

interface ThreeJSRenderOptions extends RenderOptions {
  sceneId?: string;
  width?: number;
  height?: number;
  background?: number;
  camera?: Partial<CameraConfig>;
  controls?: Partial<ControlsConfig>;
  lighting?: Partial<LightingConfig>;
  colormap?: string;
  resolution?: number;
  vectorResolution?: number;
  tensorResolution?: number;
  vectorScale?: number;
  wireframe?: boolean;
  flatShading?: boolean;
  interactive?: boolean;
  schwarzschildRadius?: number;
  rMax?: number;
  lineWidth?: number;
}

interface SurfaceSpec {
  type: 'surface';
  func: (x: number, y: number) => number;
  domain: { xMin: number; xMax: number; yMin: number; yMax: number };
}

interface CurveSpec {
  type: 'curve';
  points: { x: number; y: number; z: number }[];
}

interface VectorFieldSpec {
  type: 'vectorField';
  func: (x: number, y: number, z: number) => { x: number; y: number; z: number };
  domain: { xMin: number; xMax: number; yMin: number; yMax: number; zMin?: number; zMax?: number };
}

interface TensorFieldSpec {
  type: 'tensorField';
  at: (x: number, y: number) => number[][];
  domain: { xMin: number; xMax: number; yMin: number; yMax: number };
}
```

-----

*End of Part 3 — Continue to Part 4 for Export Engine and Integration*

# MathTS Scientific Workbench Design Specification

# Part 4: Export Engine, Integration & API Reference

-----

## 10. Export Engine

### 10.1 LaTeX Exporter (continued)

```typescript
// src/export/latex.ts

export class LaTeXExporter implements IExporter {
  readonly format = 'latex';
  readonly mimeType = 'application/x-latex';
  
  async transform(content: CollectedContent, options?: ExportOptions): Promise<TransformedContent> {
    const sections: string[] = [];
    
    sections.push(this.generatePreamble(content, options));
    sections.push('\\begin{document}');
    
    if (content.metadata.title) {
      sections.push(`\\title{${this.escapeLatex(content.metadata.title)}}`);
      if (content.metadata.author) {
        sections.push(`\\author{${this.escapeLatex(content.metadata.author)}}`);
      }
      sections.push('\\maketitle');
    }
    
    for (const cell of content.cells) {
      sections.push(await this.transformCell(cell, content, options));
    }
    
    if (content.bibliography?.length) {
      sections.push(this.generateBibliography(content.bibliography));
    }
    
    sections.push('\\end{document}');
    
    return { format: 'latex', content: sections.join('\n\n') };
  }
  
  async generate(transformed: TransformedContent): Promise<string> {
    return transformed.content;
  }
  
  private generatePreamble(content: CollectedContent, options?: ExportOptions): string {
    const config = content.config?.latex ?? {};
    
    return `
\\documentclass{${config.documentclass ?? 'article'}}

% Packages
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{physics}
\\usepackage{tensor}
\\usepackage{graphicx}
\\usepackage{float}
\\usepackage{hyperref}
\\usepackage{cleveref}
\\usepackage{listings}
\\usepackage{xcolor}

% Code listing style
\\lstset{
  basicstyle=\\ttfamily\\small,
  keywordstyle=\\color{blue},
  commentstyle=\\color{gray},
  stringstyle=\\color{red},
  breaklines=true,
  frame=single,
  numbers=left,
  numberstyle=\\tiny\\color{gray}
}

% Custom macros
\\newcommand{\\R}{\\mathbb{R}}
\\newcommand{\\C}{\\mathbb{C}}
\\newcommand{\\N}{\\mathbb{N}}
\\newcommand{\\Z}{\\mathbb{Z}}
\\newcommand{\\dd}{\\mathrm{d}}
\\newcommand{\\pp}{\\partial}
\\newcommand{\\christoffel}{\\Gamma}
\\newcommand{\\riemann}{R}

${config.preamble ?? ''}
    `.trim();
  }
  
  private async transformCell(
    cell: CollectedCell,
    content: CollectedContent,
    options?: ExportOptions
  ): Promise<string> {
    switch (cell.type) {
      case 'markdown':
        return this.markdownToLatex(cell.content);
        
      case 'code':
        if (options?.includeCode ?? true) {
          return `\\begin{lstlisting}[language=TypeScript,caption=${cell.id}]
${cell.content}
\\end{lstlisting}`;
        }
        return '';
        
      case 'tensor':
      case 'equation':
        return cell.equations?.map(eq => 
          `\\begin{equation}\\label{${eq.label}}
${eq.latex}
\\end{equation}`
        ).join('\n\n') ?? '';
        
      case 'visualization':
        return cell.figures?.map(fig => `
\\begin{figure}[H]
  \\centering
  \\includegraphics[width=${fig.width ? fig.width + 'px' : '0.8\\textwidth'}]{${fig.id}.pdf}
  ${fig.caption ? `\\caption{${this.escapeLatex(fig.caption)}}` : ''}
  \\label{fig:${fig.id}}
\\end{figure}
        `.trim()).join('\n\n') ?? '';
        
      case 'data':
        return this.dataToLatexTable(cell);
        
      default:
        return '';
    }
  }
  
  private markdownToLatex(md: string): string {
    let latex = md;
    
    // Headers
    latex = latex.replace(/^# (.+)$/gm, '\\section{$1}');
    latex = latex.replace(/^## (.+)$/gm, '\\subsection{$1}');
    latex = latex.replace(/^### (.+)$/gm, '\\subsubsection{$1}');
    
    // Bold and italic
    latex = latex.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
    latex = latex.replace(/\*(.+?)\*/g, '\\textit{$1}');
    
    // Code
    latex = latex.replace(/`([^`]+)`/g, '\\texttt{$1}');
    
    // Links
    latex = latex.replace(/\[(.+?)\]\((.+?)\)/g, '\\href{$2}{$1}');
    
    // Math (already in LaTeX)
    // Keep $...$ and $$...$$ as-is
    
    // Lists
    latex = latex.replace(/^- (.+)$/gm, '\\item $1');
    latex = latex.replace(/((?:\\item .+\n)+)/g, '\\begin{itemize}\n$1\\end{itemize}\n');
    
    return latex;
  }
  
  private dataToLatexTable(cell: CollectedCell): string {
    const data = cell.data;
    if (!data || !Array.isArray(data)) return '';
    
    const headers = Object.keys(data[0] || {});
    const cols = headers.length;
    
    let table = `\\begin{table}[H]
\\centering
\\begin{tabular}{${'l'.repeat(cols)}}
\\hline
${headers.map(h => this.escapeLatex(h)).join(' & ')} \\\\
\\hline
`;
    
    for (const row of data) {
      table += headers.map(h => this.escapeLatex(String(row[h] ?? ''))).join(' & ') + ' \\\\\n';
    }
    
    table += `\\hline
\\end{tabular}
\\end{table}`;
    
    return table;
  }
  
  private escapeLatex(text: string): string {
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[&%$#_{}]/g, '\\$&')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }
  
  private generateBibliography(refs: BibEntry[]): string {
    const items = refs.map(ref => {
      switch (ref.type) {
        case 'article':
          return `\\bibitem{${ref.key}} ${ref.author}, \\textit{${ref.title}}, ${ref.journal}, ${ref.year}.`;
        case 'book':
          return `\\bibitem{${ref.key}} ${ref.author}, \\textit{${ref.title}}, ${ref.publisher}, ${ref.year}.`;
        default:
          return `\\bibitem{${ref.key}} ${ref.author}, ${ref.title}, ${ref.year}.`;
      }
    });
    
    return `\\begin{thebibliography}{99}
${items.join('\n')}
\\end{thebibliography}`;
  }
}
```

### 10.2 PDF Exporter

```typescript
// src/export/pdf.ts

import puppeteer from 'puppeteer';

export class PDFExporter implements IExporter {
  readonly format = 'pdf';
  readonly mimeType = 'application/pdf';
  
  private htmlExporter: HTMLExporter;
  
  constructor() {
    this.htmlExporter = new HTMLExporter();
  }
  
  async transform(content: CollectedContent, options?: ExportOptions): Promise<TransformedContent> {
    // First transform to HTML
    return this.htmlExporter.transform(content, {
      ...options,
      standalone: true,
      pdfOptimized: true
    });
  }
  
  async generate(transformed: TransformedContent, options?: ExportOptions): Promise<Blob> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(transformed.content, {
      waitUntil: 'networkidle0'
    });
    
    // Wait for MathJax to render
    await page.waitForFunction(() => {
      return !document.querySelector('.MathJax_Processing');
    }, { timeout: 30000 });
    
    // Generate PDF
    const pdfConfig = options?.pdf ?? {};
    const pdf = await page.pdf({
      format: pdfConfig.paper ?? 'letter',
      margin: {
        top: pdfConfig.margin ?? '1in',
        right: pdfConfig.margin ?? '1in',
        bottom: pdfConfig.margin ?? '1in',
        left: pdfConfig.margin ?? '1in'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 10px; text-align: center; width: 100%;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `
    });
    
    await browser.close();
    
    return new Blob([pdf], { type: 'application/pdf' });
  }
}
```

### 10.3 HTML Exporter

```typescript
// src/export/html.ts

export class HTMLExporter implements IExporter {
  readonly format = 'html';
  readonly mimeType = 'text/html';
  
  async transform(content: CollectedContent, options?: ExportOptions): Promise<TransformedContent> {
    const html = this.generateHTML(content, options);
    return { format: 'html', content: html };
  }
  
  async generate(transformed: TransformedContent): Promise<string> {
    return transformed.content;
  }
  
  private generateHTML(content: CollectedContent, options?: ExportOptions): string {
    const config = content.config?.html ?? {};
    const theme = config.theme ?? 'light';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(content.metadata.title ?? 'MathTS Document')}</title>
  
  <!-- MathJax -->
  <script>
    MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
        macros: {
          R: '\\\\mathbb{R}',
          C: '\\\\mathbb{C}',
          N: '\\\\mathbb{N}',
          Z: '\\\\mathbb{Z}',
          dd: '\\\\mathrm{d}',
          pp: '\\\\partial',
          christoffel: '\\\\Gamma',
          riemann: 'R'
        },
        packages: ['base', 'ams', 'physics', 'tensor']
      },
      svg: { fontCache: 'global' }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
  
  <!-- Highlight.js for code -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  
  <!-- Three.js for 3D -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  
  <style>
    :root {
      --bg-color: ${theme === 'dark' ? '#1a1a2e' : '#ffffff'};
      --text-color: ${theme === 'dark' ? '#e0e0e0' : '#333333'};
      --code-bg: ${theme === 'dark' ? '#2d2d44' : '#f5f5f5'};
      --border-color: ${theme === 'dark' ? '#444466' : '#dddddd'};
      --accent-color: #4a90d9;
    }
    
    * { box-sizing: border-box; }
    
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: var(--bg-color);
      color: var(--text-color);
    }
    
    h1, h2, h3, h4 {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin-top: 2em;
      margin-bottom: 0.5em;
    }
    
    h1 { font-size: 2.5em; border-bottom: 2px solid var(--accent-color); padding-bottom: 0.3em; }
    h2 { font-size: 1.8em; }
    h3 { font-size: 1.4em; }
    
    .mtsw-cell {
      margin: 1.5rem 0;
      padding: 1rem;
      border-left: 3px solid var(--accent-color);
      background: var(--code-bg);
      border-radius: 0 4px 4px 0;
    }
    
    .mtsw-code {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
      overflow-x: auto;
    }
    
    .mtsw-code pre {
      margin: 0;
      padding: 1rem;
      background: var(--code-bg);
      border-radius: 4px;
    }
    
    .mtsw-equation {
      overflow-x: auto;
      padding: 1rem 0;
    }
    
    .mtsw-equation .eq-number {
      float: right;
      color: #888;
    }
    
    .mtsw-figure {
      text-align: center;
      margin: 2rem 0;
    }
    
    .mtsw-figure img, .mtsw-figure svg {
      max-width: 100%;
      height: auto;
    }
    
    .mtsw-figure figcaption {
      font-style: italic;
      color: #666;
      margin-top: 0.5rem;
    }
    
    .mtsw-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    
    .mtsw-table th, .mtsw-table td {
      border: 1px solid var(--border-color);
      padding: 0.5rem;
      text-align: left;
    }
    
    .mtsw-table th {
      background: var(--code-bg);
    }
    
    .mtsw-threejs-container {
      width: 100%;
      aspect-ratio: 4/3;
      background: #1a1a2e;
      border-radius: 4px;
      overflow: hidden;
    }
    
    @media print {
      body { max-width: none; padding: 0; }
      .mtsw-cell { break-inside: avoid; }
      .mtsw-figure { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <article class="mtsw-document">
    ${content.metadata.title ? `<h1>${this.escapeHtml(content.metadata.title)}</h1>` : ''}
    ${content.metadata.author ? `<p class="author">By ${this.escapeHtml(content.metadata.author)}</p>` : ''}
    ${content.metadata.description ? `<div class="abstract"><h2>Abstract</h2><p>${this.markdownToHtml(content.metadata.description)}</p></div>` : ''}
    
    ${content.cells.map(cell => this.renderCell(cell, options)).join('\n')}
    
    ${content.bibliography?.length ? this.renderBibliography(content.bibliography) : ''}
  </article>
  
  <script>
    // Initialize code highlighting
    document.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    
    // Initialize Three.js scenes
    document.querySelectorAll('[data-threejs-scene]').forEach(container => {
      const sceneData = JSON.parse(container.dataset.threejsScene);
      initThreeScene(container, sceneData);
    });
  </script>
</body>
</html>`;
  }
  
  private renderCell(cell: CollectedCell, options?: ExportOptions): string {
    switch (cell.type) {
      case 'markdown':
        return `<div class="mtsw-cell mtsw-markdown">${this.markdownToHtml(cell.content)}</div>`;
        
      case 'code':
        if (!(options?.includeCode ?? true)) return '';
        return `
<div class="mtsw-cell mtsw-code">
  <pre><code class="language-typescript">${this.escapeHtml(cell.content)}</code></pre>
</div>`;
        
      case 'tensor':
      case 'equation':
        return cell.equations?.map((eq, i) => `
<div class="mtsw-cell mtsw-equation" id="${eq.label}">
  <span class="eq-number">(${i + 1})</span>
  $$${eq.latex}$$
</div>`).join('\n') ?? '';
        
      case 'visualization':
        return cell.figures?.map(fig => `
<figure class="mtsw-figure" id="fig-${fig.id}">
  ${fig.svg ?? `<img src="data:image/png;base64,${fig.pngBase64}" alt="${fig.caption ?? ''}">`}
  ${fig.caption ? `<figcaption>Figure: ${this.escapeHtml(fig.caption)}</figcaption>` : ''}
</figure>`).join('\n') ?? '';
        
      case 'data':
        return this.renderDataTable(cell);
        
      default:
        return '';
    }
  }
  
  private renderDataTable(cell: CollectedCell): string {
    const data = cell.data;
    if (!data || !Array.isArray(data)) return '';
    
    const headers = Object.keys(data[0] || {});
    
    return `
<div class="mtsw-cell mtsw-data">
  <table class="mtsw-table">
    <thead>
      <tr>${headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${data.map(row => `<tr>${headers.map(h => `<td>${this.escapeHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('\n')}
    </tbody>
  </table>
</div>`;
  }
  
  private renderBibliography(refs: BibEntry[]): string {
    return `
<section class="mtsw-bibliography">
  <h2>References</h2>
  <ol>
    ${refs.map(ref => `<li id="ref-${ref.key}">${this.escapeHtml(ref.author)}, <em>${this.escapeHtml(ref.title)}</em>, ${ref.year}.</li>`).join('\n')}
  </ol>
</section>`;
  }
  
  private markdownToHtml(md: string): string {
    let html = md;
    
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    
    // Paragraphs
    html = html.split('\n\n').map(p => 
      p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') 
        ? p 
        : `<p>${p}</p>`
    ).join('\n');
    
    return html;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
```

### 10.4 Jupyter Exporter

```typescript
// src/export/jupyter.ts

export class JupyterExporter implements IExporter {
  readonly format = 'jupyter';
  readonly mimeType = 'application/x-ipynb+json';
  
  async transform(content: CollectedContent, options?: ExportOptions): Promise<TransformedContent> {
    const notebook: JupyterNotebook = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          display_name: options?.jupyter?.kernel ?? 'TypeScript',
          language: 'typescript',
          name: 'typescript'
        },
        language_info: {
          name: 'typescript',
          version: '5.0.0'
        },
        mtsw: {
          version: '2.0.0',
          source: content.metadata.title
        }
      },
      cells: []
    };
    
    // Title cell
    if (content.metadata.title) {
      notebook.cells.push({
        cell_type: 'markdown',
        metadata: {},
        source: [`# ${content.metadata.title}\n`]
      });
    }
    
    // Convert cells
    for (const cell of content.cells) {
      notebook.cells.push(...this.convertCell(cell, options));
    }
    
    return {
      format: 'jupyter',
      content: JSON.stringify(notebook, null, 2)
    };
  }
  
  async generate(transformed: TransformedContent): Promise<string> {
    return transformed.content;
  }
  
  private convertCell(cell: CollectedCell, options?: ExportOptions): JupyterCell[] {
    switch (cell.type) {
      case 'markdown':
        return [{
          cell_type: 'markdown',
          metadata: { mtsw_id: cell.id },
          source: cell.content.split('\n').map(l => l + '\n')
        }];
        
      case 'code':
        const codeCell: JupyterCell = {
          cell_type: 'code',
          metadata: { mtsw_id: cell.id },
          source: cell.content.split('\n').map(l => l + '\n'),
          outputs: [],
          execution_count: null
        };
        
        // Add outputs if available
        if (cell.output && options?.jupyter?.includeOutputs !== false) {
          codeCell.outputs = this.convertOutputs(cell.output);
        }
        
        return [codeCell];
        
      case 'tensor':
      case 'equation':
        return [{
          cell_type: 'markdown',
          metadata: { mtsw_id: cell.id },
          source: cell.equations?.map(eq => `$$${eq.latex}$$\n`) ?? []
        }];
        
      case 'visualization':
        // Include both code and output
        const vizCells: JupyterCell[] = [];
        
        if (cell.source) {
          vizCells.push({
            cell_type: 'code',
            metadata: { mtsw_id: cell.id },
            source: cell.source.split('\n').map(l => l + '\n'),
            outputs: [],
            execution_count: null
          });
        }
        
        // Add figure as output
        if (cell.figures?.length) {
          const fig = cell.figures[0];
          vizCells.push({
            cell_type: 'markdown',
            metadata: {},
            source: [`![${fig.caption ?? ''}](data:image/png;base64,${fig.pngBase64})\n`]
          });
        }
        
        return vizCells;
        
      default:
        return [];
    }
  }
  
  private convertOutputs(output: any): JupyterOutput[] {
    const outputs: JupyterOutput[] = [];
    
    if (output.console?.length) {
      outputs.push({
        output_type: 'stream',
        name: 'stdout',
        text: output.console.filter((c: any) => c.type === 'log').map((c: any) => c.content + '\n')
      });
    }
    
    if (output.exports) {
      for (const [name, value] of Object.entries(output.exports)) {
        if (value instanceof Expression || value instanceof Tensor) {
          outputs.push({
            output_type: 'display_data',
            data: {
              'text/latex': [`$${(value as any).toLatex()}$`]
            },
            metadata: {}
          });
        }
      }
    }
    
    return outputs;
  }
}

interface JupyterNotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: any;
  cells: JupyterCell[];
}

interface JupyterCell {
  cell_type: 'markdown' | 'code' | 'raw';
  metadata: any;
  source: string[];
  outputs?: JupyterOutput[];
  execution_count?: number | null;
}

interface JupyterOutput {
  output_type: 'stream' | 'display_data' | 'execute_result' | 'error';
  name?: string;
  text?: string[];
  data?: Record<string, any>;
  metadata?: any;
}
```

-----

## 11. UI Integration

### 11.1 Workbench UI Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          MTSW Workbench UI                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                            Menu Bar                                       │   │
│  │  File  Edit  View  Cell  Kernel  Tools  Help                             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                            Toolbar                                        │   │
│  │  [▶ Run] [⏹ Stop] [↻ Restart] [+Code] [+Md] [+Tensor] [+Viz] | [Export] │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────┬────────────────────────────────────────┐   │
│  │         Cell Editor             │           Output Panel                  │   │
│  │                                 │                                         │   │
│  │  ┌─────────────────────────┐    │    ┌────────────────────────────┐     │   │
│  │  │ [▶] Code Cell 1         │    │    │                            │     │   │
│  │  │ ─────────────────────── │    │    │    MathJax Rendered        │     │   │
│  │  │ const g = schwarzschild │    │    │    Equation Display        │     │   │
│  │  │ (M);                    │    │    │                            │     │   │
│  │  │ const Gamma = g.christ- │    │    │    $g_{\mu\nu}$ = ...     │     │   │
│  │  │ offelSecond();          │    │    │                            │     │   │
│  │  └─────────────────────────┘    │    └────────────────────────────┘     │   │
│  │                                 │                                         │   │
│  │  ┌─────────────────────────┐    │    ┌────────────────────────────┐     │   │
│  │  │ [▶] Tensor Cell 2       │    │    │                            │     │   │
│  │  │ ─────────────────────── │    │    │    Three.js 3D Scene       │     │   │
│  │  │ R^ρ_{σμν} := ∂_μ Γ^ρ_  │    │    │                            │     │   │
│  │  │ {νσ} - ...              │    │    │    [Interactive Canvas]    │     │   │
│  │  └─────────────────────────┘    │    │                            │     │   │
│  │                                 │    └────────────────────────────┘     │   │
│  │  ┌─────────────────────────┐    │                                         │   │
│  │  │ [▶] Viz Cell 3          │    │    ┌────────────────────────────┐     │   │
│  │  │ ─────────────────────── │    │    │    Graphviz SVG            │     │   │
│  │  │ renderer: threejs       │    │    │    Dependency Graph        │     │   │
│  │  │ source: |               │    │    └────────────────────────────┘     │   │
│  │  │   scene.addGeodesic()   │    │                                         │   │
│  │  └─────────────────────────┘    │                                         │   │
│  │                                 │                                         │   │
│  └─────────────────────────────────┴────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                        Status Bar                                         │   │
│  │  Ready | Cells: 3 | Last run: 2.3s | Memory: 45MB | Backend: WebGPU     │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 React Component Structure

```typescript
// src/ui/components/Workbench.tsx

import React, { useState, useCallback, useMemo } from 'react';
import { Monaco } from '@monaco-editor/react';
import { DocumentController } from '../acl/document/controller';
import { VisualizationManager } from '../viz/manager';

export const Workbench: React.FC<WorkbenchProps> = ({ initialDocument }) => {
  const [document, setDocument] = useState<MTSWDocument>(initialDocument);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [executionState, setExecutionState] = useState<ExecutionState>('idle');
  
  const controller = useMemo(() => new DocumentController(), []);
  const vizManager = useMemo(() => new VisualizationManager(document.visualization), []);
  
  const handleCellExecute = useCallback(async (cellId: string) => {
    setExecutionState('running');
    try {
      const output = await controller.executeCell(document, cellId);
      setDocument(prev => ({
        ...prev,
        outputs: new Map(prev.outputs).set(cellId, output)
      }));
    } finally {
      setExecutionState('idle');
    }
  }, [controller, document]);
  
  const handleExecuteAll = useCallback(async () => {
    setExecutionState('running');
    try {
      await controller.execute(document);
      setDocument(controller.getState(document).document);
    } finally {
      setExecutionState('idle');
    }
  }, [controller, document]);
  
  const handleExport = useCallback(async (format: ExportFormat) => {
    const result = await controller.export(document, format);
    downloadFile(result.content, result.filename, result.mimeType);
  }, [controller, document]);
  
  return (
    <div className="mtsw-workbench">
      <MenuBar 
        onNew={() => setDocument(createEmptyDocument())}
        onOpen={handleOpen}
        onSave={() => controller.save(document)}
        onExport={handleExport}
      />
      
      <Toolbar
        onRunAll={handleExecuteAll}
        onStop={() => controller.interruptExecution(document)}
        onAddCell={handleAddCell}
        executionState={executionState}
      />
      
      <div className="mtsw-main">
        <CellList
          cells={Array.from(document.cells.values())}
          outputs={document.outputs}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
          onExecuteCell={handleCellExecute}
          onUpdateCell={handleUpdateCell}
          onDeleteCell={handleDeleteCell}
          onMoveCell={handleMoveCell}
        />
        
        <OutputPanel
          selectedCell={selectedCell}
          output={selectedCell ? document.outputs.get(selectedCell) : null}
          vizManager={vizManager}
        />
      </div>
      
      <Sidebar
        document={document}
        scope={controller.getScope(document)}
      />
      
      <StatusBar
        state={executionState}
        cellCount={document.cells.size}
        lastRunTime={lastRunTime}
        backend={document.runtime.backend.prefer}
      />
    </div>
  );
};
```

### 11.3 Cell Editor Component

```typescript
// src/ui/components/CellEditor.tsx

import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

export const CellEditor: React.FC<CellEditorProps> = ({
  cell,
  onUpdate,
  onExecute,
  isSelected,
  isRunning
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Configure Monaco for cell type
    const language = getLanguageForCell(cell);
    
    editorRef.current = monaco.editor.create(containerRef.current, {
      value: cell.content ?? cell.source ?? '',
      language,
      theme: 'mtsw-theme',
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'Fira Code', 'Consolas', monospace",
      tabSize: 2
    });
    
    // Add keyboard shortcuts
    editorRef.current.addCommand(
      monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => onExecute()
    );
    
    // Update on change
    editorRef.current.onDidChangeModelContent(() => {
      const value = editorRef.current?.getValue() ?? '';
      onUpdate({ ...cell, source: value, content: value });
    });
    
    return () => {
      editorRef.current?.dispose();
    };
  }, [cell.id]);
  
  return (
    <div className={`mtsw-cell-editor ${isSelected ? 'selected' : ''}`}>
      <div className="mtsw-cell-header">
        <span className="mtsw-cell-type">{cell.type}</span>
        <span className="mtsw-cell-id">{cell.id}</span>
        <div className="mtsw-cell-actions">
          <button 
            onClick={onExecute} 
            disabled={isRunning}
            title="Run cell (Shift+Enter)"
          >
            {isRunning ? '⏳' : '▶'}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="mtsw-editor-container" />
    </div>
  );
};

// Register custom Monaco languages for MTSW
monaco.languages.register({ id: 'mtsw-tensor' });
monaco.languages.setMonarchTokensProvider('mtsw-tensor', {
  tokenizer: {
    root: [
      // Einstein notation indices
      [/[_^]\{[^}]+\}/, 'tensor.index'],
      [/[_^][a-zA-Zαβγδεζηθικλμνξπρστυφχψω]/, 'tensor.index'],
      
      // Greek letters
      [/[αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΥΦΨΩ]/, 'tensor.greek'],
      
      // Operators
      [/:=/, 'operator.definition'],
      [/[∂∇]/, 'operator.derivative'],
      [/[+\-*/=]/, 'operator'],
      
      // Comments
      [/#.*$/, 'comment'],
      
      // Numbers
      [/\d+(\.\d+)?/, 'number'],
      
      // Identifiers
      [/[a-zA-Z_]\w*/, 'identifier']
    ]
  }
});

function getLanguageForCell(cell: Cell): string {
  switch (cell.type) {
    case 'code': return cell.language ?? 'typescript';
    case 'tensor': return 'mtsw-tensor';
    case 'markdown': return 'markdown';
    case 'equation': return 'latex';
    default: return 'plaintext';
  }
}
```

### 11.4 Output Panel Component

```typescript
// src/ui/components/OutputPanel.tsx

import React, { useEffect, useRef } from 'react';
import katex from 'katex';

export const OutputPanel: React.FC<OutputPanelProps> = ({
  selectedCell,
  output,
  vizManager
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!output || !containerRef.current) return;
    
    renderOutput(output, containerRef.current, vizManager);
  }, [output, vizManager]);
  
  if (!selectedCell || !output) {
    return (
      <div className="mtsw-output-panel empty">
        <p>Select a cell and run it to see output</p>
      </div>
    );
  }
  
  return (
    <div className="mtsw-output-panel">
      <div className="mtsw-output-header">
        <span>Output: {selectedCell}</span>
        <span className="mtsw-output-duration">
          {output.duration ? `${output.duration.toFixed(0)}ms` : ''}
        </span>
      </div>
      <div ref={containerRef} className="mtsw-output-content" />
    </div>
  );
};

async function renderOutput(
  output: CellOutput,
  container: HTMLDivElement,
  vizManager: VisualizationManager
): Promise<void> {
  container.innerHTML = '';
  
  if (output.status === 'error') {
    container.innerHTML = `
      <div class="mtsw-error">
        <strong>${output.error.name}:</strong> ${output.error.message}
        <pre>${output.error.stack}</pre>
      </div>
    `;
    return;
  }
  
  // Render console output
  if (output.console?.length) {
    const consoleDiv = document.createElement('div');
    consoleDiv.className = 'mtsw-console';
    
    for (const entry of output.console) {
      const line = document.createElement('div');
      line.className = `mtsw-console-${entry.type}`;
      line.textContent = entry.content;
      consoleDiv.appendChild(line);
    }
    
    container.appendChild(consoleDiv);
  }
  
  // Render exports
  if (output.exports) {
    for (const [name, value] of Object.entries(output.exports)) {
      const rendered = await vizManager.render(value);
      
      const outputDiv = document.createElement('div');
      outputDiv.className = 'mtsw-output-item';
      
      const label = document.createElement('div');
      label.className = 'mtsw-output-label';
      label.textContent = name;
      outputDiv.appendChild(label);
      
      const content = document.createElement('div');
      content.className = 'mtsw-output-value';
      
      if (rendered.format === 'svg' || rendered.format === 'html') {
        content.innerHTML = rendered.content as string;
      } else if (rendered.content instanceof HTMLElement) {
        content.appendChild(rendered.content);
      } else {
        content.textContent = String(rendered.content);
      }
      
      outputDiv.appendChild(content);
      container.appendChild(outputDiv);
    }
  }
}
```

-----

## 12. Complete API Reference

### 12.1 Core Types

```typescript
// src/types/index.ts

/**
 * Cell types
 */
export type CellType = 
  | 'markdown'
  | 'code'
  | 'tensor'
  | 'equation'
  | 'visualization'
  | 'data'
  | 'test'
  | 'import'
  | 'export';

/**
 * Base cell interface
 */
export interface Cell {
  readonly id: string;
  readonly type: CellType;
  options?: CellOptions;
  dependsOn?: string[];
}

export interface CellOptions {
  autorun?: boolean;
  cache?: boolean;
  timeout?: number;
  display?: 'auto' | 'none' | 'explicit';
  collapsed?: boolean;
  hidden?: boolean;
  tags?: string[];
}

/**
 * Code cell
 */
export interface CodeCell extends Cell {
  type: 'code';
  language: 'typescript' | 'javascript' | 'python';
  source: string;
  outputs?: OutputSpec[];
}

/**
 * Tensor cell (Einstein notation)
 */
export interface TensorCell extends Cell {
  type: 'tensor';
  notation: 'einstein' | 'index' | 'abstract';
  content: string;
  options: TensorCellOptions;
  display?: TensorDisplayOptions;
}

export interface TensorCellOptions extends CellOptions {
  coordinates?: string;
  metric?: string;
  dimension?: number;
  simplify?: boolean;
}

export interface TensorDisplayOptions {
  format: 'latex' | 'unicode' | 'components';
  numbered?: boolean;
  align?: boolean;
}

/**
 * Visualization cell
 */
export interface VisualizationCell extends Cell {
  type: 'visualization';
  renderer: 'threejs' | 'graphviz' | 'd3' | 'mathjax';
  source: string;
  options?: VisualizationOptions;
  display?: DisplayOptions;
}

export interface VisualizationOptions extends CellOptions {
  interactive?: boolean;
  controls?: string;
  animate?: boolean;
}

export interface DisplayOptions {
  width?: number;
  height?: number;
  caption?: string;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  status: 'success' | 'error';
  exports?: Record<string, any>;
  console?: ConsoleEntry[];
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration: number;
  timestamp: string;
}

export interface ConsoleEntry {
  type: 'log' | 'warn' | 'error' | 'info';
  content: string;
  timestamp: string;
}

/**
 * Rendered output
 */
export interface RenderedOutput {
  type: OutputType;
  format: OutputFormat;
  content: string | ArrayBuffer | HTMLElement;
  mimeType: string;
  width?: number;
  height?: number;
  interactive?: boolean;
  children?: RenderedOutput[];
  toSVG?(): Promise<string>;
  toPNG?(): Promise<Blob>;
  toHTML?(): string;
}

export type OutputType = 
  | 'math'
  | 'graph'
  | 'chart'
  | 'scene3d'
  | 'table'
  | 'image'
  | 'text'
  | 'error'
  | 'composite';

export type OutputFormat = 
  | 'html'
  | 'svg'
  | 'canvas'
  | 'webgl'
  | 'text'
  | 'latex'
  | 'json';

/**
 * Export types
 */
export type ExportFormat = 'latex' | 'pdf' | 'html' | 'jupyter' | 'markdown';

export interface ExportOptions {
  includeCode?: boolean;
  includeOutputs?: boolean;
  latex?: LaTeXExportOptions;
  pdf?: PDFExportOptions;
  html?: HTMLExportOptions;
  jupyter?: JupyterExportOptions;
}

export interface ExportResult {
  format: ExportFormat;
  content: Blob | string;
  mimeType: string;
  filename: string;
}
```

### 12.2 Document Model API

```typescript
// Public API for document operations

export class MTSWDocument {
  // Properties
  readonly id: string;
  readonly version: string;
  readonly metadata: DocumentMetadata;
  readonly cells: ReadonlyMap<string, Cell>;
  readonly outputs: ReadonlyMap<string, CellOutput>;
  
  // Cell operations
  getCell(id: string): Cell | undefined;
  getCellsByType(type: CellType): Cell[];
  getCellOutput(id: string): CellOutput | undefined;
  
  // Dependency graph
  getDependencyGraph(): DependencyGraph;
  getExecutionOrder(): string[];
  getAffectedCells(changedId: string): string[];
  
  // Scope
  getVariable(name: string): any;
  getVariables(): Map<string, any>;
}

export class DocumentController {
  // Lifecycle
  load(source: string | URL | File): Promise<MTSWDocument>;
  save(document: MTSWDocument, options?: SaveOptions): Promise<void>;
  close(document: MTSWDocument): Promise<void>;
  
  // Validation
  validate(document: MTSWDocument): ValidationResult;
  
  // Execution
  execute(document: MTSWDocument, options?: ExecuteOptions): Promise<ExecutionSummary>;
  executeCell(document: MTSWDocument, cellId: string): Promise<CellOutput>;
  interruptExecution(document: MTSWDocument): void;
  
  // Export
  export(document: MTSWDocument, format: ExportFormat, options?: ExportOptions): Promise<ExportResult>;
  
  // Cell manipulation
  addCell(document: MTSWDocument, cell: CellDefinition, position?: number): string;
  updateCell(document: MTSWDocument, cellId: string, updates: Partial<Cell>): void;
  removeCell(document: MTSWDocument, cellId: string): void;
  moveCell(document: MTSWDocument, cellId: string, newPosition: number): void;
  
  // State
  getState(document: MTSWDocument): DocumentState;
  getScope(document: MTSWDocument): Scope;
}
```

### 12.3 Visualization API

```typescript
// Public API for visualization

export class VisualizationManager {
  // Rendering
  render(value: any, options?: RenderOptions): Promise<RenderedOutput>;
  renderWith(renderer: RendererType, value: any, options?: RenderOptions): Promise<RenderedOutput>;
  
  // Renderer access
  getRenderer<T extends IRenderer>(type: RendererType): T;
  registerRenderer(type: RendererType, renderer: IRenderer): void;
}

// MathJax specific
export class MathJaxRenderer {
  render(value: any, options?: MathJaxRenderOptions): Promise<RenderedOutput>;
  toLatex(value: any, options?: MathJaxRenderOptions): string;
}

// Graphviz specific
export class GraphvizRenderer {
  render(value: any, options?: GraphvizRenderOptions): Promise<RenderedOutput>;
  toDot(value: any, options?: GraphvizRenderOptions): string;
}

// Three.js specific
export class ThreeJSRenderer {
  render(value: any, options?: ThreeJSRenderOptions): Promise<RenderedOutput>;
  
  // Scene building DSL
  createScene(options?: SceneOptions): SceneBuilder;
}

export class SceneBuilder {
  addSurface(func: (x: number, y: number) => number, options?: SurfaceOptions): this;
  addParametricSurface(params: ParametricSpec, options?: SurfaceOptions): this;
  addCurve(points: Point3D[], options?: CurveOptions): this;
  addGeodesic(metric: MetricTensor, initial: GeodesicInitial, options?: GeodesicOptions): this;
  addVectorField(field: VectorFieldSpec, options?: VectorFieldOptions): this;
  addTensorField(field: TensorFieldSpec, options?: TensorFieldOptions): this;
  addSphere(center: Point3D, radius: number, options?: SphereOptions): this;
  addGrid(options?: GridOptions): this;
  addAxes(options?: AxesOptions): this;
  setCamera(position: Point3D, lookAt?: Point3D): this;
  setLighting(config: LightingConfig): this;
  build(): ManagedScene;
}
```

-----

## 13. File Summary

This specification consists of 4 parts totaling approximately 4,000 lines:

|Part  |Content                   |Size        |
|------|--------------------------|------------|
|Part 1|YAML Format Specification |~1,200 lines|
|Part 2|Abstract Computation Layer|~1,000 lines|
|Part 3|Visualization Engines     |~1,200 lines|
|Part 4|Export & Integration      |~800 lines  |

**Key deliverables:**

1. **Complete YAML Schema** for `.mtsw` files with all cell types
1. **Abstract Computation Layer** with cell handlers, dependency graph, execution scheduler
1. **MathJax Integration** for symbolic math rendering with tensor support
1. **Graphviz Integration** for 2D graph visualization
1. **Three.js Integration** for 3D scientific visualization
1. **Export Pipeline** for LaTeX, PDF, HTML, Jupyter
1. **React UI Components** for the workbench interface
1. **Complete TypeScript API** for programmatic access

-----

*End of MathTS Scientific Workbench Design Specification v2.0.0*

# MathTS Scientific Workbench Design Specification

# Part 5: Canonical Export Formats & 3D Scene Exporters

-----

## 14. Canonical Export Formats

The MTSW workbench defines six canonical file formats for exporting visualizations and content. Five are human-readable for version control and collaboration; one is binary-optimized for web delivery.

### 14.1 Format Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      MTSW Canonical Export Formats                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   HUMAN-READABLE (Git-friendly, diffable, editable)                             │
│   ─────────────────────────────────────────────────                             │
│                                                                                  │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│   │  .tex   │  │  .dot   │  │  .svg   │  │ .gltf   │  │ .usda   │              │
│   │         │  │         │  │         │  │         │  │         │              │
│   │ LaTeX   │  │Graphviz │  │ Vector  │  │ 3D Web  │  │ 3D USD  │              │
│   │ Math    │  │ Graphs  │  │Graphics │  │ Scenes  │  │ Scenes  │              │
│   │         │  │         │  │         │  │ (JSON)  │  │ (ASCII) │              │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘              │
│        │            │            │            │            │                    │
│        ▼            ▼            ▼            ▼            ▼                    │
│   Publication   Diagrams     Charts      Three.js    Omniverse                 │
│   PDF/Print     Structure    Plots       WebGL       NVIDIA                    │
│                                                                                  │
│   BINARY-OPTIMIZED (Fast loading, compact)                                      │
│   ────────────────────────────────────────                                      │
│                                                                                  │
│   ┌─────────┐                                                                   │
│   │  .glb   │  Binary glTF — optimized 3D for web delivery                     │
│   └─────────┘                                                                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 14.2 Format Specifications

|Extension|MIME Type            |Engine       |Readable|Primary Use                             |
|---------|---------------------|-------------|--------|----------------------------------------|
|`.tex`   |`application/x-latex`|MathJax/LaTeX|✓       |Symbolic math, equations, publication   |
|`.dot`   |`text/vnd.graphviz`  |Graphviz     |✓       |2D graphs, tensor networks, diagrams    |
|`.svg`   |`image/svg+xml`      |D3.js        |✓       |2D vector graphics, charts, plots       |
|`.gltf`  |`model/gltf+json`    |Three.js     |✓       |3D scenes, web visualization            |
|`.glb`   |`model/gltf-binary`  |Three.js     |✗       |3D scenes, optimized delivery           |
|`.usda`  |`application/vnd.usd`|USD/Omniverse|✓       |3D scenes, production rendering, physics|

### 14.3 Format Selection Guidelines

```typescript
// src/export/format-selector.ts

export type CanonicalFormat = 'tex' | 'dot' | 'svg' | 'gltf' | 'glb' | 'usda';

export interface FormatCapabilities {
  humanReadable: boolean;
  supportsAnimation: boolean;
  supportsPhysics: boolean;
  supportsLayers: boolean;
  webNative: boolean;
  maxComplexity: 'low' | 'medium' | 'high' | 'unlimited';
}

export const FORMAT_CAPABILITIES: Record<CanonicalFormat, FormatCapabilities> = {
  tex: {
    humanReadable: true,
    supportsAnimation: false,
    supportsPhysics: false,
    supportsLayers: false,
    webNative: false,
    maxComplexity: 'high'
  },
  dot: {
    humanReadable: true,
    supportsAnimation: false,
    supportsPhysics: false,
    supportsLayers: true,  // subgraphs
    webNative: false,
    maxComplexity: 'medium'
  },
  svg: {
    humanReadable: true,
    supportsAnimation: true,  // SMIL/CSS animations
    supportsPhysics: false,
    supportsLayers: true,  // groups
    webNative: true,
    maxComplexity: 'medium'
  },
  gltf: {
    humanReadable: true,
    supportsAnimation: true,
    supportsPhysics: false,  // no native physics
    supportsLayers: false,
    webNative: true,
    maxComplexity: 'high'
  },
  glb: {
    humanReadable: false,
    supportsAnimation: true,
    supportsPhysics: false,
    supportsLayers: false,
    webNative: true,
    maxComplexity: 'high'
  },
  usda: {
    humanReadable: true,
    supportsAnimation: true,
    supportsPhysics: true,   // USD Physics schema
    supportsLayers: true,    // composition arcs
    webNative: false,
    maxComplexity: 'unlimited'
  }
};

/**
 * Select optimal format based on content and requirements
 */
export function selectFormat(
  content: ExportableContent,
  requirements: ExportRequirements
): CanonicalFormat {
  // Math expressions → LaTeX
  if (content.type === 'math' || content.type === 'equation') {
    return 'tex';
  }
  
  // Graph structures → Graphviz
  if (content.type === 'graph' || content.type === 'network') {
    return 'dot';
  }
  
  // 2D charts/plots → SVG
  if (content.type === 'chart' || content.type === 'plot') {
    return 'svg';
  }
  
  // 3D content → depends on target
  if (content.type === 'scene3d') {
    // Production rendering / physics simulation
    if (requirements.target === 'omniverse' || 
        requirements.needsPhysics ||
        requirements.needsLayers) {
      return 'usda';
    }
    
    // Web delivery, optimized
    if (requirements.optimizeSize) {
      return 'glb';
    }
    
    // Web delivery, human-readable
    return 'gltf';
  }
  
  // Default to SVG for unknown 2D content
  return 'svg';
}
```

-----

## 15. glTF Exporter (Three.js)

### 15.1 glTF/GLB Export Implementation

```typescript
// src/export/gltf/exporter.ts

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

/**
 * glTF/GLB exporter for Three.js scenes
 */
export class GLTFSceneExporter implements ISceneExporter {
  readonly format = 'gltf';
  readonly formats = ['gltf', 'glb'] as const;
  
  private exporter: GLTFExporter;
  
  constructor() {
    this.exporter = new GLTFExporter();
  }
  
  /**
   * Export scene to glTF (JSON) or GLB (binary)
   */
  async export(
    scene: THREE.Scene | ManagedScene,
    options?: GLTFExportOptions
  ): Promise<ExportedScene> {
    const threeScene = scene instanceof THREE.Scene ? scene : scene.scene;
    
    const binary = options?.binary ?? false;
    const includeCustomExtensions = options?.includeCustomExtensions ?? true;
    
    // Prepare scene for export
    const preparedScene = this.prepareScene(threeScene, options);
    
    // Configure exporter
    const exporterOptions: GLTFExporterOptions = {
      binary,
      trs: options?.trs ?? false,
      onlyVisible: options?.onlyVisible ?? true,
      truncateDrawRange: options?.truncateDrawRange ?? true,
      maxTextureSize: options?.maxTextureSize ?? 4096,
      animations: this.collectAnimations(preparedScene),
      includeCustomExtensions
    };
    
    // Add MTSW custom extension for scientific metadata
    if (includeCustomExtensions) {
      this.addMTSWExtension(preparedScene, options?.metadata);
    }
    
    return new Promise((resolve, reject) => {
      this.exporter.parse(
        preparedScene,
        (result) => {
          if (binary) {
            resolve({
              format: 'glb',
              content: result as ArrayBuffer,
              mimeType: 'model/gltf-binary',
              extension: '.glb',
              humanReadable: false
            });
          } else {
            const json = JSON.stringify(result, null, 2);
            resolve({
              format: 'gltf',
              content: json,
              mimeType: 'model/gltf+json',
              extension: '.gltf',
              humanReadable: true
            });
          }
        },
        (error) => reject(error),
        exporterOptions
      );
    });
  }
  
  /**
   * Export to human-readable glTF JSON
   */
  async exportGLTF(
    scene: THREE.Scene | ManagedScene,
    options?: Omit<GLTFExportOptions, 'binary'>
  ): Promise<ExportedScene> {
    return this.export(scene, { ...options, binary: false });
  }
  
  /**
   * Export to optimized GLB binary
   */
  async exportGLB(
    scene: THREE.Scene | ManagedScene,
    options?: Omit<GLTFExportOptions, 'binary'>
  ): Promise<ExportedScene> {
    return this.export(scene, { ...options, binary: true });
  }
  
  /**
   * Prepare scene for export (optimize, clean up)
   */
  private prepareScene(
    scene: THREE.Scene,
    options?: GLTFExportOptions
  ): THREE.Scene {
    const clone = scene.clone(true);
    
    // Remove non-exportable objects
    clone.traverse((obj) => {
      // Remove helpers if not requested
      if (!options?.includeHelpers) {
        if (obj instanceof THREE.GridHelper ||
            obj instanceof THREE.AxesHelper ||
            obj instanceof THREE.CameraHelper) {
          obj.removeFromParent();
        }
      }
      
      // Remove lights if embedding in USD later
      if (options?.stripLights && obj instanceof THREE.Light) {
        obj.removeFromParent();
      }
    });
    
    // Optimize geometries
    if (options?.optimizeGeometries) {
      clone.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry = obj.geometry.toNonIndexed();
          obj.geometry.computeVertexNormals();
        }
      });
    }
    
    return clone;
  }
  
  /**
   * Collect animations from scene
   */
  private collectAnimations(scene: THREE.Scene): THREE.AnimationClip[] {
    const animations: THREE.AnimationClip[] = [];
    
    scene.traverse((obj) => {
      if (obj.animations?.length) {
        animations.push(...obj.animations);
      }
    });
    
    return animations;
  }
  
  /**
   * Add MTSW scientific metadata extension
   */
  private addMTSWExtension(
    scene: THREE.Scene,
    metadata?: MTSWSceneMetadata
  ): void {
    if (!metadata) return;
    
    // Store as userData (will be exported as extras)
    scene.userData.MTSW_metadata = {
      version: '2.0.0',
      type: metadata.type,
      coordinates: metadata.coordinates,
      metric: metadata.metric,
      tensorFields: metadata.tensorFields,
      geodesics: metadata.geodesics,
      timestamp: new Date().toISOString()
    };
  }
}

interface GLTFExportOptions {
  binary?: boolean;
  trs?: boolean;
  onlyVisible?: boolean;
  truncateDrawRange?: boolean;
  maxTextureSize?: number;
  includeCustomExtensions?: boolean;
  includeHelpers?: boolean;
  stripLights?: boolean;
  optimizeGeometries?: boolean;
  metadata?: MTSWSceneMetadata;
}

interface MTSWSceneMetadata {
  type: 'tensor-field' | 'geodesic' | 'embedding' | 'generic';
  coordinates?: string;
  metric?: string;
  tensorFields?: Array<{
    name: string;
    rank: number;
    type: string;
  }>;
  geodesics?: Array<{
    name: string;
    parameters: Record<string, number>;
  }>;
}

interface ExportedScene {
  format: 'gltf' | 'glb';
  content: string | ArrayBuffer;
  mimeType: string;
  extension: string;
  humanReadable: boolean;
}
```

-----

## 16. USD Exporter (Omniverse)

### 16.1 USD ASCII (.usda) Export Implementation

```typescript
// src/export/usd/exporter.ts

import * as THREE from 'three';

/**
 * USD ASCII exporter for Omniverse compatibility
 * Exports Three.js scenes to human-readable .usda format
 */
export class USDSceneExporter implements ISceneExporter {
  readonly format = 'usda';
  readonly formats = ['usda', 'usd'] as const;
  
  private indentLevel = 0;
  private primPaths: Map<THREE.Object3D, string> = new Map();
  
  /**
   * Export scene to USD ASCII format
   */
  async export(
    scene: THREE.Scene | ManagedScene,
    options?: USDExportOptions
  ): Promise<ExportedScene> {
    const threeScene = scene instanceof THREE.Scene ? scene : scene.scene;
    
    this.indentLevel = 0;
    this.primPaths.clear();
    
    const lines: string[] = [];
    
    // USD Header
    lines.push('#usda 1.0');
    lines.push('(');
    lines.push('    defaultPrim = "World"');
    lines.push(`    metersPerUnit = ${options?.metersPerUnit ?? 1}`);
    lines.push(`    upAxis = "${options?.upAxis ?? 'Y'}"`);
    lines.push('    doc = "Generated by MathTS Scientific Workbench"');
    
    // Custom layer data for MTSW
    if (options?.metadata) {
      lines.push('    customLayerData = {');
      lines.push('        string mtsw_version = "2.0.0"');
      lines.push(`        string mtsw_type = "${options.metadata.type}"`);
      if (options.metadata.coordinates) {
        lines.push(`        string mtsw_coordinates = "${options.metadata.coordinates}"`);
      }
      if (options.metadata.metric) {
        lines.push(`        string mtsw_metric = "${options.metadata.metric}"`);
      }
      lines.push('    }');
    }
    
    lines.push(')');
    lines.push('');
    
    // World prim
    lines.push('def Xform "World" (');
    lines.push('    kind = "assembly"');
    lines.push(')');
    lines.push('{');
    this.indentLevel++;
    
    // Export scene hierarchy
    threeScene.children.forEach((child, index) => {
      lines.push(...this.exportObject(child, `Object_${index}`, options));
    });
    
    // Export materials
    if (options?.exportMaterials !== false) {
      lines.push('');
      lines.push(this.indent() + 'def Scope "Materials"');
      lines.push(this.indent() + '{');
      this.indentLevel++;
      lines.push(...this.exportMaterials(threeScene));
      this.indentLevel--;
      lines.push(this.indent() + '}');
    }
    
    this.indentLevel--;
    lines.push('}');
    
    const content = lines.join('\n');
    
    return {
      format: 'usda',
      content,
      mimeType: 'application/vnd.usd',
      extension: '.usda',
      humanReadable: true
    };
  }
  
  /**
   * Export a Three.js object to USD
   */
  private exportObject(
    obj: THREE.Object3D,
    name: string,
    options?: USDExportOptions
  ): string[] {
    const lines: string[] = [];
    const safeName = this.sanitizeName(name);
    
    // Skip invisible objects unless requested
    if (!obj.visible && !options?.includeInvisible) {
      return lines;
    }
    
    // Determine USD prim type
    const primType = this.getPrimType(obj);
    
    lines.push('');
    lines.push(this.indent() + `def ${primType} "${safeName}"`);
    lines.push(this.indent() + '{');
    this.indentLevel++;
    
    // Transform
    lines.push(...this.exportTransform(obj));
    
    // Type-specific export
    if (obj instanceof THREE.Mesh) {
      lines.push(...this.exportMesh(obj, options));
    } else if (obj instanceof THREE.Line) {
      lines.push(...this.exportCurve(obj, options));
    } else if (obj instanceof THREE.Points) {
      lines.push(...this.exportPoints(obj, options));
    } else if (obj instanceof THREE.Light) {
      lines.push(...this.exportLight(obj));
    } else if (obj instanceof THREE.Camera) {
      lines.push(...this.exportCamera(obj));
    }
    
    // Custom properties (userData)
    if (obj.userData && Object.keys(obj.userData).length > 0) {
      lines.push(...this.exportCustomData(obj.userData));
    }
    
    // Children
    obj.children.forEach((child, index) => {
      lines.push(...this.exportObject(child, `${safeName}_child_${index}`, options));
    });
    
    this.indentLevel--;
    lines.push(this.indent() + '}');
    
    return lines;
  }
  
  /**
   * Export transform (TRS)
   */
  private exportTransform(obj: THREE.Object3D): string[] {
    const lines: string[] = [];
    
    // Position
    const pos = obj.position;
    if (pos.x !== 0 || pos.y !== 0 || pos.z !== 0) {
      lines.push(this.indent() + `double3 xformOp:translate = (${pos.x}, ${pos.y}, ${pos.z})`);
    }
    
    // Rotation (as quaternion)
    const quat = obj.quaternion;
    if (quat.x !== 0 || quat.y !== 0 || quat.z !== 0 || quat.w !== 1) {
      lines.push(this.indent() + `quatf xformOp:orient = (${quat.w}, ${quat.x}, ${quat.y}, ${quat.z})`);
    }
    
    // Scale
    const scale = obj.scale;
    if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
      lines.push(this.indent() + `float3 xformOp:scale = (${scale.x}, ${scale.y}, ${scale.z})`);
    }
    
    // XformOpOrder
    const ops: string[] = [];
    if (pos.x !== 0 || pos.y !== 0 || pos.z !== 0) ops.push('"xformOp:translate"');
    if (quat.x !== 0 || quat.y !== 0 || quat.z !== 0 || quat.w !== 1) ops.push('"xformOp:orient"');
    if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) ops.push('"xformOp:scale"');
    
    if (ops.length > 0) {
      lines.push(this.indent() + `uniform token[] xformOpOrder = [${ops.join(', ')}]`);
    }
    
    return lines;
  }
  
  /**
   * Export mesh geometry
   */
  private exportMesh(mesh: THREE.Mesh, options?: USDExportOptions): string[] {
    const lines: string[] = [];
    const geometry = mesh.geometry;
    
    // Get vertex positions
    const positions = geometry.getAttribute('position');
    if (!positions) return lines;
    
    // Points
    const points: string[] = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      points.push(`(${x}, ${y}, ${z})`);
    }
    lines.push(this.indent() + `point3f[] points = [${points.join(', ')}]`);
    
    // Face vertex counts and indices
    const indices = geometry.getIndex();
    if (indices) {
      const faceVertexCounts: number[] = [];
      const faceVertexIndices: number[] = [];
      
      for (let i = 0; i < indices.count; i += 3) {
        faceVertexCounts.push(3);
        faceVertexIndices.push(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2));
      }
      
      lines.push(this.indent() + `int[] faceVertexCounts = [${faceVertexCounts.join(', ')}]`);
      lines.push(this.indent() + `int[] faceVertexIndices = [${faceVertexIndices.join(', ')}]`);
    }
    
    // Normals
    const normals = geometry.getAttribute('normal');
    if (normals && options?.exportNormals !== false) {
      const normalArray: string[] = [];
      for (let i = 0; i < normals.count; i++) {
        const x = normals.getX(i);
        const y = normals.getY(i);
        const z = normals.getZ(i);
        normalArray.push(`(${x}, ${y}, ${z})`);
      }
      lines.push(this.indent() + `normal3f[] normals = [${normalArray.join(', ')}]`);
      lines.push(this.indent() + `uniform token normals:interpolation = "vertex"`);
    }
    
    // UVs
    const uvs = geometry.getAttribute('uv');
    if (uvs && options?.exportUVs !== false) {
      const uvArray: string[] = [];
      for (let i = 0; i < uvs.count; i++) {
        const u = uvs.getX(i);
        const v = uvs.getY(i);
        uvArray.push(`(${u}, ${v})`);
      }
      lines.push(this.indent() + `texCoord2f[] primvars:st = [${uvArray.join(', ')}]`);
      lines.push(this.indent() + `uniform token primvars:st:interpolation = "vertex"`);
    }
    
    // Vertex colors (important for scientific visualization)
    const colors = geometry.getAttribute('color');
    if (colors) {
      const colorArray: string[] = [];
      for (let i = 0; i < colors.count; i++) {
        const r = colors.getX(i);
        const g = colors.getY(i);
        const b = colors.getZ(i);
        colorArray.push(`(${r}, ${g}, ${b})`);
      }
      lines.push(this.indent() + `color3f[] primvars:displayColor = [${colorArray.join(', ')}]`);
      lines.push(this.indent() + `uniform token primvars:displayColor:interpolation = "vertex"`);
    }
    
    // Subdivision scheme
    lines.push(this.indent() + `uniform token subdivisionScheme = "none"`);
    
    return lines;
  }
  
  /**
   * Export curve (for geodesics)
   */
  private exportCurve(line: THREE.Line, options?: USDExportOptions): string[] {
    const lines: string[] = [];
    const geometry = line.geometry;
    const positions = geometry.getAttribute('position');
    
    if (!positions) return lines;
    
    // Points
    const points: string[] = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      points.push(`(${x}, ${y}, ${z})`);
    }
    
    lines.push(this.indent() + `point3f[] points = [${points.join(', ')}]`);
    lines.push(this.indent() + `int[] curveVertexCounts = [${positions.count}]`);
    lines.push(this.indent() + `uniform token type = "linear"`);
    lines.push(this.indent() + `uniform token wrap = "nonperiodic"`);
    
    // Vertex colors for parameter visualization
    const colors = geometry.getAttribute('color');
    if (colors) {
      const colorArray: string[] = [];
      for (let i = 0; i < colors.count; i++) {
        const r = colors.getX(i);
        const g = colors.getY(i);
        const b = colors.getZ(i);
        colorArray.push(`(${r}, ${g}, ${b})`);
      }
      lines.push(this.indent() + `color3f[] primvars:displayColor = [${colorArray.join(', ')}]`);
      lines.push(this.indent() + `uniform token primvars:displayColor:interpolation = "vertex"`);
    }
    
    // Width
    const material = line.material as THREE.LineBasicMaterial;
    const width = material.linewidth ?? 1;
    lines.push(this.indent() + `float[] widths = [${width}]`);
    lines.push(this.indent() + `uniform token widths:interpolation = "constant"`);
    
    return lines;
  }
  
  /**
   * Export point cloud
   */
  private exportPoints(points: THREE.Points, options?: USDExportOptions): string[] {
    const lines: string[] = [];
    const geometry = points.geometry;
    const positions = geometry.getAttribute('position');
    
    if (!positions) return lines;
    
    const pointArray: string[] = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      pointArray.push(`(${x}, ${y}, ${z})`);
    }
    
    lines.push(this.indent() + `point3f[] points = [${pointArray.join(', ')}]`);
    
    // Colors
    const colors = geometry.getAttribute('color');
    if (colors) {
      const colorArray: string[] = [];
      for (let i = 0; i < colors.count; i++) {
        const r = colors.getX(i);
        const g = colors.getY(i);
        const b = colors.getZ(i);
        colorArray.push(`(${r}, ${g}, ${b})`);
      }
      lines.push(this.indent() + `color3f[] primvars:displayColor = [${colorArray.join(', ')}]`);
    }
    
    // Point size
    const material = points.material as THREE.PointsMaterial;
    const size = material.size ?? 1;
    lines.push(this.indent() + `float[] widths = [${size}]`);
    
    return lines;
  }
  
  /**
   * Export light
   */
  private exportLight(light: THREE.Light): string[] {
    const lines: string[] = [];
    
    const color = light.color;
    lines.push(this.indent() + `color3f inputs:color = (${color.r}, ${color.g}, ${color.b})`);
    lines.push(this.indent() + `float inputs:intensity = ${light.intensity}`);
    
    if (light instanceof THREE.DirectionalLight) {
      lines.push(this.indent() + `float inputs:angle = 0`);
    } else if (light instanceof THREE.PointLight) {
      lines.push(this.indent() + `float inputs:radius = 0`);
    } else if (light instanceof THREE.SpotLight) {
      lines.push(this.indent() + `float inputs:coneAngle = ${light.angle * 180 / Math.PI}`);
      lines.push(this.indent() + `float inputs:coneSoftness = ${light.penumbra}`);
    }
    
    return lines;
  }
  
  /**
   * Export camera
   */
  private exportCamera(camera: THREE.Camera): string[] {
    const lines: string[] = [];
    
    if (camera instanceof THREE.PerspectiveCamera) {
      lines.push(this.indent() + `float focalLength = ${camera.getFocalLength()}`);
      lines.push(this.indent() + `float horizontalAperture = ${camera.getFilmWidth()}`);
      lines.push(this.indent() + `float verticalAperture = ${camera.getFilmHeight()}`);
      lines.push(this.indent() + `float2 clippingRange = (${camera.near}, ${camera.far})`);
      lines.push(this.indent() + `token projection = "perspective"`);
    } else if (camera instanceof THREE.OrthographicCamera) {
      lines.push(this.indent() + `float2 clippingRange = (${camera.near}, ${camera.far})`);
      lines.push(this.indent() + `token projection = "orthographic"`);
    }
    
    return lines;
  }
  
  /**
   * Export materials
   */
  private exportMaterials(scene: THREE.Scene): string[] {
    const lines: string[] = [];
    const materials = new Map<string, THREE.Material>();
    
    // Collect unique materials
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const mat = obj.material as THREE.Material;
        if (!materials.has(mat.uuid)) {
          materials.set(mat.uuid, mat);
        }
      }
    });
    
    // Export each material
    materials.forEach((material, uuid) => {
      const name = material.name || `Material_${uuid.substring(0, 8)}`;
      lines.push('');
      lines.push(this.indent() + `def Material "${this.sanitizeName(name)}"`);
      lines.push(this.indent() + '{');
      this.indentLevel++;
      
      lines.push(this.indent() + 'token outputs:surface.connect = </World/Materials/' + 
        this.sanitizeName(name) + '/PBRShader.outputs:surface>');
      
      // PBR Shader
      lines.push('');
      lines.push(this.indent() + 'def Shader "PBRShader"');
      lines.push(this.indent() + '{');
      this.indentLevel++;
      
      lines.push(this.indent() + 'uniform token info:id = "UsdPreviewSurface"');
      
      if (material instanceof THREE.MeshStandardMaterial) {
        const color = material.color;
        lines.push(this.indent() + `color3f inputs:diffuseColor = (${color.r}, ${color.g}, ${color.b})`);
        lines.push(this.indent() + `float inputs:metallic = ${material.metalness}`);
        lines.push(this.indent() + `float inputs:roughness = ${material.roughness}`);
        lines.push(this.indent() + `float inputs:opacity = ${material.opacity}`);
      } else if (material instanceof THREE.MeshBasicMaterial) {
        const color = material.color;
        lines.push(this.indent() + `color3f inputs:diffuseColor = (${color.r}, ${color.g}, ${color.b})`);
        lines.push(this.indent() + `float inputs:metallic = 0`);
        lines.push(this.indent() + `float inputs:roughness = 1`);
      }
      
      lines.push(this.indent() + 'token outputs:surface');
      
      this.indentLevel--;
      lines.push(this.indent() + '}');
      
      this.indentLevel--;
      lines.push(this.indent() + '}');
    });
    
    return lines;
  }
  
  /**
   * Export custom data (userData)
   */
  private exportCustomData(userData: Record<string, any>): string[] {
    const lines: string[] = [];
    
    lines.push('');
    lines.push(this.indent() + 'custom dictionary mtsw:data = {');
    this.indentLevel++;
    
    for (const [key, value] of Object.entries(userData)) {
      if (typeof value === 'number') {
        lines.push(this.indent() + `double ${this.sanitizeName(key)} = ${value}`);
      } else if (typeof value === 'string') {
        lines.push(this.indent() + `string ${this.sanitizeName(key)} = "${value}"`);
      } else if (typeof value === 'boolean') {
        lines.push(this.indent() + `bool ${this.sanitizeName(key)} = ${value}`);
      } else if (Array.isArray(value) && value.length <= 4 && typeof value[0] === 'number') {
        const type = value.length === 2 ? 'double2' : 
                     value.length === 3 ? 'double3' : 'double4';
        lines.push(this.indent() + `${type} ${this.sanitizeName(key)} = (${value.join(', ')})`);
      }
    }
    
    this.indentLevel--;
    lines.push(this.indent() + '}');
    
    return lines;
  }
  
  /**
   * Determine USD prim type for Three.js object
   */
  private getPrimType(obj: THREE.Object3D): string {
    if (obj instanceof THREE.Mesh) return 'Mesh';
    if (obj instanceof THREE.Line) return 'BasisCurves';
    if (obj instanceof THREE.Points) return 'Points';
    if (obj instanceof THREE.DirectionalLight) return 'DistantLight';
    if (obj instanceof THREE.PointLight) return 'SphereLight';
    if (obj instanceof THREE.SpotLight) return 'DiskLight';
    if (obj instanceof THREE.PerspectiveCamera) return 'Camera';
    if (obj instanceof THREE.OrthographicCamera) return 'Camera';
    return 'Xform';
  }
  
  /**
   * Sanitize name for USD
   */
  private sanitizeName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1');
  }
  
  /**
   * Current indentation
   */
  private indent(): string {
    return '    '.repeat(this.indentLevel);
  }
}

interface USDExportOptions {
  metersPerUnit?: number;
  upAxis?: 'Y' | 'Z';
  exportMaterials?: boolean;
  exportNormals?: boolean;
  exportUVs?: boolean;
  includeInvisible?: boolean;
  metadata?: MTSWSceneMetadata;
}
```

-----

## 17. Unified Scene Export Manager

```typescript
// src/export/scene-manager.ts

import { GLTFSceneExporter } from './gltf/exporter';
import { USDSceneExporter } from './usd/exporter';
import * as THREE from 'three';

/**
 * Unified manager for all 3D scene export formats
 */
export class SceneExportManager {
  private gltfExporter: GLTFSceneExporter;
  private usdExporter: USDSceneExporter;
  
  constructor() {
    this.gltfExporter = new GLTFSceneExporter();
    this.usdExporter = new USDSceneExporter();
  }
  
  /**
   * Export scene to specified format
   */
  async export(
    scene: THREE.Scene | ManagedScene,
    format: '3d',
    options?: SceneExportOptions
  ): Promise<ExportedScene> {
    const targetFormat = options?.format ?? 'gltf';
    
    switch (targetFormat) {
      case 'gltf':
        return this.gltfExporter.exportGLTF(scene, options);
        
      case 'glb':
        return this.gltfExporter.exportGLB(scene, options);
        
      case 'usda':
        return this.usdExporter.export(scene, options);
        
      default:
        throw new Error(`Unsupported 3D export format: ${targetFormat}`);
    }
  }
  
  /**
   * Export to all 3D formats
   */
  async exportAll(
    scene: THREE.Scene | ManagedScene,
    options?: SceneExportOptions
  ): Promise<Map<string, ExportedScene>> {
    const results = new Map<string, ExportedScene>();
    
    results.set('gltf', await this.gltfExporter.exportGLTF(scene, options));
    results.set('glb', await this.gltfExporter.exportGLB(scene, options));
    results.set('usda', await this.usdExporter.export(scene, options));
    
    return results;
  }
  
  /**
   * Get recommended format based on use case
   */
  getRecommendedFormat(useCase: SceneUseCase): '3dFormat' {
    switch (useCase) {
      case 'web-interactive':
        return 'glb';  // Optimized binary for web
        
      case 'web-debug':
        return 'gltf';  // Human-readable for debugging
        
      case 'omniverse':
      case 'production-render':
      case 'physics-simulation':
        return 'usda';  // Full USD features
        
      case 'archive':
        return 'gltf';  // Human-readable for long-term storage
        
      default:
        return 'glb';
    }
  }
}

type SceneUseCase = 
  | 'web-interactive'
  | 'web-debug'
  | 'omniverse'
  | 'production-render'
  | 'physics-simulation'
  | 'archive';

interface SceneExportOptions extends GLTFExportOptions, USDExportOptions {
  format?: 'gltf' | 'glb' | 'usda';
}
```

-----

## 18. Complete Export Format Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MTSW Complete Export Pipeline                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Source: .mtsw (YAML notebook)                                                  │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                      Cell Type → Export Format                          │     │
│  ├────────────────────────────────────────────────────────────────────────┤     │
│  │                                                                         │     │
│  │  equation/tensor ─────────────────────────────────────────▶ .tex       │     │
│  │  markdown ────────────────────────────────────────────────▶ .tex/.md   │     │
│  │                                                                         │     │
│  │  visualization (graphviz) ────────────────────────────────▶ .dot       │     │
│  │  visualization (d3) ──────────────────────────────────────▶ .svg       │     │
│  │                                                                         │     │
│  │  visualization (threejs) ─────┬───────────────────────────▶ .gltf      │     │
│  │                               ├───────────────────────────▶ .glb       │     │
│  │                               └───────────────────────────▶ .usda      │     │
│  │                                                                         │     │
│  │  code ────────────────────────────────────────────────────▶ .ts/.js    │     │
│  │  data ────────────────────────────────────────────────────▶ .csv/.json │     │
│  │                                                                         │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  Document Export:                                                                │
│  ────────────────                                                               │
│  .mtsw ──────────────────┬───────────────────────────────────▶ .pdf             │
│                          ├───────────────────────────────────▶ .html            │
│                          ├───────────────────────────────────▶ .tex             │
│                          └───────────────────────────────────▶ .ipynb           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Format Decision Tree

```
Is it math/equations?
  └─▶ YES ─▶ .tex
  └─▶ NO ──▶ Is it a 2D graph/network?
               └─▶ YES ─▶ .dot
               └─▶ NO ──▶ Is it a 2D chart/plot?
                           └─▶ YES ─▶ .svg
                           └─▶ NO ──▶ Is it 3D?
                                       └─▶ YES ─▶ Target?
                                                   ├─▶ Web (optimized) ─▶ .glb
                                                   ├─▶ Web (readable)  ─▶ .gltf
                                                   └─▶ Omniverse/Prod  ─▶ .usda
                                       └─▶ NO ──▶ .svg (fallback)
```

-----

*End of Part 5 — Canonical Export Formats & 3D Scene Exporters*