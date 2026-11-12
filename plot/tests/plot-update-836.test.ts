import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { plot, update } from '../src/index.js';
import { findDescendant } from './dom-helpers.js';

/**
 * Issue #836 — live dashboard can update a line chart without replacing the container each frame.
 */
describe('#836 plot.update patches an existing line chart', () => {
  it('matches the issue repro: line then update in the same container', () => {
    const doc = new DOMParser().parseFromString('<div id="chart"></div>', 'text/html');
    const chart = doc.getElementById('chart');
    expect(chart).not.toBeNull();
    const mount = chart! as unknown as Element;
    update(mount, [0, 1, 2], [0, 1, 4], { title: 'SHO' });
    const rootBefore = findDescendant(
      mount,
      (e) => e.localName === 'svg' && e.getAttribute('data-mathts-plot') === '1'
    );
    expect(rootBefore).not.toBeNull();

    const pointsBefore = findDescendant(
      rootBefore!,
      (e) => e.localName === 'polyline' && e.getAttribute('data-mathts-live') === 'line-0-path'
    )?.getAttribute('points');
    update(mount, [0, 1, 2], [0, 1, 9], { title: 'SHO' });
    const rootAfter = findDescendant(
      mount,
      (e) => e.localName === 'svg' && e.getAttribute('data-mathts-plot') === '1'
    );
    expect(rootAfter).toBe(rootBefore);
    const pointsAfter = findDescendant(
      rootAfter!,
      (e) => e.localName === 'polyline' && e.getAttribute('data-mathts-live') === 'line-0-path'
    )?.getAttribute('points');
    expect(pointsAfter).toMatch(/[\d.]+,[\d.]+/);
    expect(pointsAfter).not.toBe(pointsBefore);
  });

  it('plot.update is the same function as update', () => {
    expect(plot.update).toBe(update);
  });
});
