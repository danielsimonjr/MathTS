/** @danielsimonjr/mathts-plot — headless SVG 2D/3D plotting for MathTS. */
export const VERSION = '0.2.0';

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
