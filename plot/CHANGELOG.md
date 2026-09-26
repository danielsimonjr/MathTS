# @danielsimonjr/mathts-plot

## 0.4.6

### Patch Changes

- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
  - @danielsimonjr/mathts-functions@0.65.0
  - @danielsimonjr/mathts-expression@0.8.2
  - @danielsimonjr/mathts-core@0.15.5

## 0.4.5

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
- Updated dependencies [a13ce7e]
  - @danielsimonjr/mathts-core@0.15.4
  - @danielsimonjr/mathts-expression@0.8.1
  - @danielsimonjr/mathts-functions@0.64.3

## 0.4.4

### Patch Changes

- 611e2fa: Security fix: the SVG output now escapes every attribute value. Before this fix, a caller-supplied value (a layer or palette color, or a width or height passed as a string from JavaScript or a parsed notebook) was written into its attribute without escaping, so a value that contains a quote character could end the attribute and add attributes or elements to the SVG. All SVG elements are now built by one internal helper that passes every attribute value, numbers included, through a new `escAttr` escaper (`&`, `<`, `>`, `"`, `'`). The TikZ backend now writes a caller color only when it is a plain color name or an xcolor mix (letters, digits, `!`, `.`), and uses `black` otherwise. Output for ordinary inputs is byte-identical.

## 0.4.3

### Patch Changes

- 57c8ffd: 3-D surface: quads whose depths differ by at most 1e-9 are drawn in face-index order. Before, the order depended on the last bit of `Math.sin`, which differs between runtimes. SVG output can differ from 0.4.2 for exactly tied quads only.
- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
- Updated dependencies [57c8ffd]
  - @danielsimonjr/mathts-core@0.15.0
  - @danielsimonjr/mathts-expression@0.8.0
  - @danielsimonjr/mathts-functions@0.64.1

## 0.4.2

### Patch Changes

- Updated dependencies [8789126]
  - @danielsimonjr/mathts-functions@0.64.0

## 0.4.1

### Patch Changes

- Updated dependencies [104a1c9]
- Updated dependencies [0592f7b]
  - @danielsimonjr/mathts-core@0.14.1
  - @danielsimonjr/mathts-expression@0.7.1
  - @danielsimonjr/mathts-functions@0.63.0

## 0.3.48

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.61.0

## 0.3.47

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.60.0

## 0.3.46

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.59.0

## 0.3.45

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.58.0

## 0.3.44

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.57.0

## 0.3.43

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.56.0

## 0.3.42

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.55.0

## 0.3.41

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.54.0

## 0.3.40

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.53.0

## 0.3.39

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.52.0

## 0.3.38

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.51.0

## 0.3.37

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.50.0

## 0.3.36

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.49.0

## 0.3.35

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.48.0

## 0.3.34

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.47.0

## 0.3.33

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.46.0

## 0.3.32

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.45.0

## 0.3.31

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.44.0

## 0.3.30

### Patch Changes

- Fix the exported `VERSION` constant, which had silently drifted from each package's published version.

  `VERSION` was a hardcoded string literal that Changesets never bumped, so it drifted: core reported `0.1.0`
  (was really 0.13.0), plot `0.2.0` (was 0.3.29), workbook `0.1.0` (was 0.3.3). Workbook's is user-facing —
  `mtsw version` (and `capabilities`/`introspect`) printed the wrong number.

  Root-cause fix (not a re-hardcode): `VERSION` is now injected at build time from each package's own
  `package.json` via a per-package `tsup.config.ts` (esbuild `define`, read Node-side so `package.json` is
  never bundled into `dist`). Tests import source, so the same define is mirrored into each `vitest.config.ts`;
  `core/tests/version.test.ts` now pins `VERSION` to `package.json` rather than a literal. `VERSION` can no
  longer drift from the published version.

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.1

## 0.3.29

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0
  - @danielsimonjr/mathts-functions@0.43.2
  - @danielsimonjr/mathts-expression@0.6.7

## 0.3.28

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0
  - @danielsimonjr/mathts-functions@0.43.1
  - @danielsimonjr/mathts-expression@0.6.6

## 0.3.27

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.43.0
  - @danielsimonjr/mathts-core@0.11.0
  - @danielsimonjr/mathts-expression@0.6.5

## 0.3.26

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.42.0

## 0.3.25

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.41.0

## 0.3.24

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.40.0

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
