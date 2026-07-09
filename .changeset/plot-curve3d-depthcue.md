---
'@danielsimonjr/mathts-plot': patch
---

curve3d now depth-cues opacity per segment (nearest opaque, farthest translucent), matching scatter3d — drawn as far-first per-segment lines instead of a single flat polyline. Closes the v0.1 caveat that curve3d had no depth cue.
