import type { Scene } from './scene.js';
import { emitSVG } from './svg.js';
import type { PlotOptions } from './types.js';

/**
 * Serialize a Scene via the chosen backend. The tikz branch is wired in a later
 * task; today every format returns SVG so callers can be written against emit()
 * once and never re-touched.
 */
export function emit(scene: Scene, _opts: PlotOptions = {}): string {
  return emitSVG(scene);
}
