/**
 * Render a workbook RenderDoc to a PDF file. Reuses plot's latexToPdf primitive:
 * toTeX(standalone) → LaTeX → PDF. Charts render as native vector TikZ (no
 * rasterization). Async; throws PlotRenderError if no LaTeX engine is available.
 */
import { latexToPdf, type RenderOptions } from '@danielsimonjr/mathts-plot/render';
import { toTeX } from './tex.js';
import type { RenderDoc } from './html.js';

export interface ToPdfOptions extends RenderOptions {
  parse?: (expr: string) => unknown;
}

export function toPDF(doc: RenderDoc, outPath: string, options: ToPdfOptions = {}): Promise<void> {
  const { parse, ...renderOpts } = options;
  return latexToPdf(toTeX(doc, { parse, fragment: false }), outPath, renderOpts);
}
