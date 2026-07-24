/** @danielsimonjr/mathts-plot — headless SVG 2D/3D plotting for MathTS. */
// Injected at build time by tsup's `define` (see tsup.config.ts) from this
// package's package.json version, so VERSION can never drift.
declare const __PKG_VERSION__: string;
export const VERSION: string = __PKG_VERSION__;

export type { Data, PlotOptions, AxisSpec, Layer2D } from './types.js';
export { plot, toTikZ } from './plot.js';
export { line, scatter, bar, area, step, errorbar, quiver } from './marks2d.js';
export { histogram } from './histogram.js';
export { heatmap } from './heatmap.js';
export { contour } from './contour.js';
export { overlay } from './overlay.js';
export { surface } from './three/surface.js';
export { scatter3d, curve3d } from './three/points3d.js';
export { viridis } from './palette.js';
