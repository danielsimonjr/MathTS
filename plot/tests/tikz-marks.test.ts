import { describe, it, expect } from 'vitest';
import { toTikZ, line, surface, overlay } from '../src/index.js';

describe('TikZ end-to-end (format option + toTikZ)', () => {
  it('line with format:tikz emits a tikzpicture, no <svg>', () => {
    const out = line([0, 1, 2, 3], [0, 1, 4, 9], { format: 'tikz', title: 'sq' });
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('<svg');
    expect(out).toMatch(/\\draw/);
  });
  it('toTikZ("sin(x)") samples + emits a tikz line', () => {
    const out = toTikZ('sin(x)', { from: 0, to: Math.PI, samples: 30 });
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).toMatch(/\\draw/);
  });
  it('toTikZ of a 2-var expr as a surface emits filled polygons', () => {
    const out = toTikZ('x^2 + y^2', { from: -2, to: 2, samples: 8, kind: 'surface' });
    expect(out).toContain('\\filldraw');
  });
  it('surface fragment mode has no documentclass', () => {
    const z = [
      [0, 1, 0],
      [1, 2, 1],
      [0, 1, 0],
    ];
    const out = surface(z, { format: 'tikz', tikz: { standalone: false } });
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('\\documentclass');
  });
  it('overlay tikz preserves both layers (draws + nodes for legend)', () => {
    const out = overlay(
      [
        { type: 'line', x: [0, 1], y: [0, 1], label: 'a' },
        { type: 'scatter', x: [0, 1], y: [1, 0], label: 'b' },
      ],
      { format: 'tikz', legend: true }
    );
    expect(out).toMatch(/\\draw/);
    expect(out).toMatch(/\\filldraw/); // scatter circles
    expect(out).toContain('a'); // legend label a
  });
  it('SVG remains the default (no format)', () => {
    expect(line([0, 1], [0, 1])).toMatch(/^<svg/);
  });
  it('toTikZ(x, y) emits a tikzpicture (x+y shape)', () => {
    const out = toTikZ([0, 1, 2, 3], [0, 1, 4, 9]);
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('<svg');
  });
  it('toTikZ(y) emits a tikzpicture (single-series shape)', () => {
    const out = toTikZ([1, 4, 9]);
    expect(out).toContain('\\begin{tikzpicture}');
  });
  it('toTikZ(layers) overlays in tikz (layer-array shape)', () => {
    const out = toTikZ([
      { type: 'line', x: [0, 1], y: [0, 1], label: 'a' },
      { type: 'scatter', x: [0, 1], y: [1, 0], label: 'b' },
    ]);
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).toMatch(/\\draw/);
    expect(out).toMatch(/\\filldraw/);
  });
});
