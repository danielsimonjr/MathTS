import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { line, plot, update } from '../src/index.js';
import { findDescendant } from './dom-helpers.js';

/**
 * Issue #836 — live dashboard can update a line chart without replacing the container each frame.
 * Repro shape: `line([0,1,2], [0,1,0], { title: 'SHO' })` into `#chart`, then `update(el, x, y)`.
 */
function chart(): Element {
  const doc = new DOMParser().parseFromString('<div id="chart"></div>', 'text/html');
  const el = doc.getElementById('chart');
  if (!el) throw new Error('chart');
  return el as unknown as Element;
}

function plotSvg(root: Element): Element | null {
  return findDescendant(
    root,
    (e) => e.localName === 'svg' && e.getAttribute('data-mathts-plot') === '1'
  );
}

function livePoints(svg: Element, id: string): string | null {
  return (
    findDescendant(svg, (e) => e.getAttribute('data-mathts-live') === id)?.getAttribute('points') ??
    null
  );
}

function liveCount(svg: Element, prefix: string): number {
  let n = 0;
  const walk = (e: Element): void => {
    const id = e.getAttribute('data-mathts-live');
    if (id?.startsWith(prefix)) n++;
    for (let i = 0; i < e.childNodes.length; i++) {
      const c = e.childNodes[i];
      if (c.nodeType === 1) walk(c as Element);
    }
  };
  walk(svg);
  return n;
}

describe('#836 plot.update patches an existing line chart', () => {
  it('matches the issue repro: line() into #chart, then update keeps one svg and moves the polyline', () => {
    const mount = chart();
    const svg = line([0, 1, 2], [0, 1, 0], { title: 'SHO' });
    expect(svg.startsWith('<svg')).toBe(true);
    update(mount, [0, 1, 2], [0, 1, 0], { title: 'SHO' });
    const rootBefore = plotSvg(mount);
    expect(rootBefore).not.toBeNull();
    const pointsBefore = livePoints(rootBefore!, 'line-0-path');

    update(mount, [0, 1, 2], [0, 1, 0.5], { title: 'SHO' });
    const rootAfter = plotSvg(mount);
    expect(rootAfter).toBe(rootBefore);
    const pointsAfter = livePoints(rootAfter!, 'line-0-path');
    expect(pointsAfter).toMatch(/[\d.]+,[\d.]+/);
    expect(pointsAfter).not.toBe(pointsBefore);

    const fresh = line([0, 1, 2], [0, 1, 0.5], { title: 'SHO' });
    const freshDoc = new DOMParser().parseFromString(fresh, 'image/svg+xml');
    const freshPts = findDescendant(
      freshDoc.documentElement as unknown as Element,
      (e) => e.getAttribute('data-mathts-live') === 'line-0-path'
    )?.getAttribute('points');
    expect(pointsAfter).toBe(freshPts);
  });

  it('plot.update is the same function as update', () => {
    expect(plot.update).toBe(update);
  });

  it('a shorter series drops leftover point nodes', () => {
    const mount = chart();
    update(mount, [0, 1, 2, 3], [0, 1, 0, 1], { title: 'SHO' });
    update(mount, [0, 1], [0, 1], { title: 'SHO' });
    const svg = plotSvg(mount);
    expect(svg).not.toBeNull();
    expect(liveCount(svg!, 'line-0-pt-')).toBe(2);
    expect(livePoints(svg!, 'line-0-path')?.split(' ').length).toBe(2);
  });

  it('a layer type change removes the line polyline', () => {
    const mount = chart();
    update(mount, [0, 1, 2], [0, 1, 0], { title: 'SHO' });
    update(mount, [{ type: 'scatter', x: [0, 1, 2], y: [0, 1, 0] }], { title: 'SHO' });
    const svg = plotSvg(mount);
    expect(svg).not.toBeNull();
    expect(livePoints(svg!, 'line-0-path')).toBeNull();
    expect(liveCount(svg!, 'line-0-')).toBe(0);
  });

  it('a new data range replaces the svg so axis labels match a fresh line()', () => {
    const mount = chart();
    update(mount, [0, 1, 2], [0, 1, 4], { title: 'SHO' });
    const before = plotSvg(mount);
    update(mount, [0, 1, 2], [0, 1, 9], { title: 'SHO' });
    const after = plotSvg(mount);
    expect(after).not.toBe(before);
    const fresh = line([0, 1, 2], [0, 1, 9], { title: 'SHO' });
    const freshDoc = new DOMParser().parseFromString(fresh, 'image/svg+xml');
    const freshRoot = freshDoc.documentElement as unknown as Element;
    const label = (root: Element): string | null =>
      findDescendant(root, (e) => e.localName === 'text' && (e.textContent ?? '').includes('9'))
        ?.textContent ?? null;
    if (!after) throw new Error('svg');
    expect(label(after)).toBe(label(freshRoot));
    expect(livePoints(after, 'line-0-path')).toBe(
      findDescendant(
        freshRoot,
        (e) => e.getAttribute('data-mathts-live') === 'line-0-path'
      )?.getAttribute('points')
    );
  });
});
