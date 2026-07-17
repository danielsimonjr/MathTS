# @danielsimonjr/mathts-plot

## 0.3.23

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.39.0

## 0.3.22

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.38.0

## 0.3.21

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.37.0

## 0.3.20

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.36.0

## 0.3.19

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.35.0

## 0.3.18

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.34.0

## 0.3.17

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.33.0

## 0.3.16

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.32.0

## 0.3.15

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.31.0

## 0.3.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.30.0

## 0.3.13

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.29.0

## 0.3.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.28.0

## 0.3.11

### Patch Changes

- Updated dependencies [1174c41]
  - @danielsimonjr/mathts-functions@0.27.0

## 0.3.10

### Patch Changes

- Updated dependencies [199da08]
  - @danielsimonjr/mathts-functions@0.26.0

## 0.3.9

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-functions@0.25.0
  - @danielsimonjr/mathts-expression@0.6.4

## 0.3.8

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-functions@0.24.0
  - @danielsimonjr/mathts-expression@0.6.3

## 0.3.7

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-functions@0.23.0
  - @danielsimonjr/mathts-expression@0.6.2

## 0.3.6

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-functions@0.22.0
  - @danielsimonjr/mathts-expression@0.6.1

## 0.3.5

### Patch Changes

- Updated dependencies [ea044c4]
  - @danielsimonjr/mathts-functions@0.21.0

## 0.3.4

### Patch Changes

- Updated dependencies [b7784ef]
  - @danielsimonjr/mathts-functions@0.20.0

## 0.3.3

### Patch Changes

- Updated dependencies [abbe883]
  - @danielsimonjr/mathts-functions@0.19.0

## 0.3.2

### Patch Changes

- Updated dependencies [7c53d7f]
  - @danielsimonjr/mathts-functions@0.18.0

## 0.3.1

### Patch Changes

- Updated dependencies [2353e0a]
- Updated dependencies [908f19b]
  - @danielsimonjr/mathts-functions@0.17.0

## 0.3.0

### Minor Changes

- 992ba42: Add a Node-only `./render` subpath: `renderToFile(svg, out)` (SVG→PNG/PDF via rsvg-convert/resvg) and `latexToPdf(tex, out)` (LaTeX/TikZ→PDF via pdflatex/tectonic). External-tool bridge — no bundled rendering dependencies; the main entry stays browser-safe and zero-dependency. LaTeX shell-escape is disabled by default (opt-in via the unsafe `shellEscape` option).

### Patch Changes

- Updated dependencies [fd3e417]
  - @danielsimonjr/mathts-expression@0.6.0
  - @danielsimonjr/mathts-functions@0.16.1

## 0.2.0

### Minor Changes

- d7fa53c: Add @danielsimonjr/mathts-plot — headless SVG 2D/3D plotting on the MathTS bedrock (per-type marks, overlay, generic/expression plot(), 3D surface/scatter/curve).
- 50f8841: Add a TikZ rendering backend: `format: 'tikz'` on all functions, a `tikz` option, and a generic `toTikZ()` entry. Internals refactored to a scene + pluggable backend; SVG output is byte-identical (golden-master locked).

### Patch Changes

- 0126e41: curve3d now depth-cues opacity per segment (nearest opaque, farthest translucent), matching scatter3d — drawn as far-first per-segment lines instead of a single flat polyline. Closes the v0.1 caveat that curve3d had no depth cue.
