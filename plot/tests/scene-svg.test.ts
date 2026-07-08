import { describe, it, expect } from 'vitest';
import type { Scene } from '../src/scene.js';
import { emitSVG } from '../src/svg.js';
import { emit } from '../src/emit.js';

describe('emitSVG', () => {
  it('serializes prims through the svg builders, wrapped in svgDoc', () => {
    const scene: Scene = {
      width: 100,
      height: 50,
      bg: '#ffffff',
      prims: [
        { k: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#000000' },
        { k: 'circle', cx: 10, cy: 20, r: 3, fill: '#000' },
        {
          k: 'polyline',
          pts: [
            [0, 0],
            [10, 10],
          ],
          stroke: '#123456',
          w: 2,
        },
        { k: 'text', x: 5, y: 5, s: 'a<b>', fill: '#111', anchor: 'middle', size: 12 },
      ],
    };
    const svg = emitSVG(scene);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('viewBox="0 0 100 50"');
    expect(svg).toContain('<circle cx="10" cy="20" r="3" fill="#000"/>');
    expect(svg).toContain('<polyline points="0,0 10,10"');
    expect(svg).toContain('a&lt;b&gt;'); // text escaped at emit time
  });

  it('rotate on a text prim emits the transform form (matches frame.ts ylabel)', () => {
    const scene: Scene = {
      width: 100,
      height: 50,
      bg: '#fff',
      prims: [
        {
          k: 'text',
          x: 16,
          y: 25,
          s: 'y',
          fill: '#1a1a2e',
          anchor: 'middle',
          size: 12,
          rotate: -90,
        },
      ],
    };
    expect(emitSVG(scene)).toContain(
      '<text transform="translate(16,25) rotate(-90)" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#1a1a2e">y</text>'
    );
  });

  it('emit() defaults to SVG', () => {
    const scene: Scene = { width: 10, height: 10, bg: '#fff', prims: [] };
    expect(emit(scene)).toBe(emitSVG(scene));
  });
});
