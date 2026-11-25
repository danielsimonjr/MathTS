/** @danielsimonjr/mathts-plot — headless SVG 2D/3D plotting for MathTS. */
// Injected at build time by tsdown's `define` (see tsdown.config.ts) from this
// package's package.json version, so VERSION can never drift.
// Source execution (Bun `paths` / docs:functions) falls back to globalThis.
declare const __PKG_VERSION__: string;
export const VERSION: string = readDefinedPkgVersion();

function readDefinedPkgVersion(): string {
  try {
    return __PKG_VERSION__;
  } catch (error) {
    if (error instanceof ReferenceError) {
      const injected = (globalThis as { __PKG_VERSION__?: string }).__PKG_VERSION__;
      if (typeof injected === 'string') return injected;
    }
    throw error;
  }
}

export type { Data, PlotOptions, AxisSpec, Layer2D } from './types.js';
export { plot, toTikZ } from './plot.js';
export { update } from './update.js';
export { line, scatter, bar, area, step, errorbar, quiver } from './marks2d.js';
export { histogram } from './histogram.js';
export { heatmap } from './heatmap.js';
export { contour } from './contour.js';
export { overlay } from './overlay.js';
export { surface } from './three/surface.js';
export { scatter3d, curve3d } from './three/points3d.js';
export { viridis } from './palette.js';
