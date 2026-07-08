import { describe, it, expect } from 'vitest';
import type { Scene } from '../src/scene.js';
import { emitTikZ } from '../src/tikz.js';

const scene = (prims: Scene['prims']): Scene => ({ width: 100, height: 50, bg: '#ffffff', prims });

describe('emitTikZ', () => {
  it('wraps a standalone document by default', () => {
    const out = emitTikZ(scene([]));
    expect(out).toContain('\\documentclass');
    expect(out).toContain('standalone');
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).toContain('\\end{document}');
  });

  it('fragment mode emits only the tikzpicture', () => {
    const out = emitTikZ(scene([]), { tikz: { standalone: false } });
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('\\documentclass');
  });

  it('flips y and scales coordinates (geometry oracle)', () => {
    // A line from (0,0) to (100,50) in SVG space, scale 1 → TikZ (0, 50) to (100, 0).
    const out = emitTikZ(
      scene([{ k: 'line', x1: 0, y1: 0, x2: 100, y2: 50, stroke: '#000000', w: 1 }]),
      {
        tikz: { standalone: false, scale: 1 },
      }
    );
    expect(out).toContain('(0,50)');
    expect(out).toContain('(100,0)');
    expect(out).toMatch(/\\draw/);
  });

  it('converts hex color to a tikz rgb color', () => {
    const out = emitTikZ(scene([{ k: 'circle', cx: 10, cy: 10, r: 3, fill: '#2a4d8f' }]), {
      tikz: { standalone: false, scale: 1 },
    });
    expect(out).toContain('{rgb,255:red,42;green,77;blue,143}');
    expect(out).toMatch(/circle/);
  });

  it('splits an 8-hex fill into color + fill opacity', () => {
    const out = emitTikZ(
      scene([
        {
          k: 'polygon',
          pts: [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
          fill: '#2a4d8f55',
          stroke: 'none',
        },
      ]),
      { tikz: { standalone: false, scale: 1 } }
    );
    expect(out).toContain('fill opacity=0.33'); // 0x55/255 ≈ 0.333
  });

  it('escapes LaTeX specials in text', () => {
    const out = emitTikZ(
      scene([
        { k: 'text', x: 5, y: 5, s: 'a_b% & $x$', fill: '#111111', anchor: 'middle', size: 12 },
      ]),
      { tikz: { standalone: false, scale: 1 } }
    );
    expect(out).toContain('a\\_b\\% \\& \\$x\\$');
    expect(out).toMatch(/\\node/);
  });

  it('rotates a text node', () => {
    const out = emitTikZ(
      scene([
        { k: 'text', x: 5, y: 5, s: 'y', fill: '#111111', anchor: 'middle', size: 12, rotate: -90 },
      ]),
      { tikz: { standalone: false, scale: 1 } }
    );
    expect(out).toContain('rotate=-90');
  });
});
