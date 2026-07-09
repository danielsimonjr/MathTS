---
'@danielsimonjr/mathts-plot': minor
---

Add a Node-only `./render` subpath: `renderToFile(svg, out)` (SVG→PNG/PDF via rsvg-convert/resvg) and `latexToPdf(tex, out)` (LaTeX/TikZ→PDF via pdflatex/tectonic). External-tool bridge — no bundled rendering dependencies; the main entry stays browser-safe and zero-dependency.
