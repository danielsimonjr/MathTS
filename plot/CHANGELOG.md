# @danielsimonjr/mathts-plot

## 0.2.0

### Minor Changes

- d7fa53c: Add @danielsimonjr/mathts-plot — headless SVG 2D/3D plotting on the MathTS bedrock (per-type marks, overlay, generic/expression plot(), 3D surface/scatter/curve).
- 50f8841: Add a TikZ rendering backend: `format: 'tikz'` on all functions, a `tikz` option, and a generic `toTikZ()` entry. Internals refactored to a scene + pluggable backend; SVG output is byte-identical (golden-master locked).

### Patch Changes

- 0126e41: curve3d now depth-cues opacity per segment (nearest opaque, farthest translucent), matching scatter3d — drawn as far-first per-segment lines instead of a single flat polyline. Closes the v0.1 caveat that curve3d had no depth cue.
