import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderToFile, latexToPdf, PlotRenderError } from '../src/render-file.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'plot-render-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

describe('renderToFile', () => {
  it('.svg passthrough writes the SVG bytes (no external tool needed)', async () => {
    const out = join(dir, 'a.svg');
    await renderToFile(SVG, out);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(0);
  });
  it('rejects with PlotRenderError naming the tool when a PNG converter is absent', async () => {
    // force an impossible tool so detection fails deterministically
    await expect(
      renderToFile(SVG, join(dir, 'a.png'), { tool: '__definitely_not_a_real_tool__' })
    ).rejects.toBeInstanceOf(PlotRenderError);
  });
  it('the PlotRenderError names what to install', async () => {
    try {
      await renderToFile(SVG, join(dir, 'b.pdf'), { tool: '__definitely_not_a_real_tool__' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PlotRenderError);
      expect((e as PlotRenderError).message).toMatch(/rsvg-convert|resvg|install/i);
    }
  });
});

describe('latexToPdf', () => {
  const TEX = '\\documentclass{article}\\begin{document}hello\\end{document}';
  it('rejects with PlotRenderError naming a LaTeX engine when none is present', async () => {
    await expect(
      latexToPdf(TEX, join(dir, 'x.pdf'), { tool: '__definitely_not_a_real_tool__' })
    ).rejects.toBeInstanceOf(PlotRenderError);
  });
  it('requires a .pdf output path', async () => {
    await expect(latexToPdf(TEX, join(dir, 'x.png'))).rejects.toBeInstanceOf(PlotRenderError);
  });
});
