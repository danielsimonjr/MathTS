# @danielsimonjr/mathts-plot

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
