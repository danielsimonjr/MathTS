import type { Scene } from './scene.js';
import { emitSVG } from './svg.js';
import { emitTikZ } from './tikz.js';
import type { PlotOptions } from './types.js';

/** Serialize a Scene via the backend chosen by opts.format (default 'svg'). */
export function emit(scene: Scene, opts: Pick<PlotOptions, 'format' | 'tikz'> = {}): string {
  return opts.format === 'tikz' ? emitTikZ(scene, opts) : emitSVG(scene);
}
