import { coerce1d } from './coerce.js';
import { extent, linearScale, logScale, niceTicks } from './scale.js';
import { THEMES, type Theme, fmt } from './svg.js';
import type { Layer2D, PlotOptions } from './types.js';
import { renderLayer, type Frame } from './render-core.js';
import type { Prim, Scene } from './scene.js';
import { emit } from './emit.js';

const MARGIN = { top: 34, right: 20, bottom: 46, left: 64 };

/** Combined [min,max] of a coord across every layer that carries it. */
function combinedExtent(layers: Layer2D[], pick: (l: Layer2D) => number[]): [number, number] {
  const all: number[] = [];
  for (const l of layers) all.push(...pick(l));
  return extent(all);
}

function noDataScene(width: number, height: number, theme: Theme): Scene {
  return {
    width,
    height,
    bg: theme.bg,
    prims: [
      {
        k: 'text',
        x: width / 2,
        y: height / 2,
        s: 'no data',
        fill: theme.muted,
        anchor: 'middle',
        size: 13,
      },
    ],
  };
}

/** Shared 2-D rendering core: builds a Scene (axes+ticks+grid+labels+legend+marks). Never throws. */
export function draw2D(layers: Layer2D[], opts: PlotOptions = {}): string {
  const width = opts.width ?? 520;
  const height = opts.height ?? 320;
  const theme = THEMES[opts.theme ?? 'light'];
  try {
    // "has data" is decided on the y-series alone (x may legitimately default to indices);
    // an empty/all-non-finite y for every layer means nothing is plottable.
    const yAll = layers.flatMap((l) => coerce1d(l.y));
    if (yAll.length === 0) return emit(noDataScene(width, height, theme), opts);

    const xdom = combinedExtent(layers, (l) =>
      l.x ? coerce1d(l.x) : coerce1d(l.y).map((_, i) => i)
    );
    const ydom = combinedExtent(layers, (l) => coerce1d(l.y));
    if (!Number.isFinite(xdom[0]) || !Number.isFinite(ydom[0]))
      return emit(noDataScene(width, height, theme), opts);

    const innerX: [number, number] = [MARGIN.left, width - MARGIN.right];
    const innerY: [number, number] = [height - MARGIN.bottom, MARGIN.top];
    const xScaleFn = opts.x?.scale === 'log' ? logScale : linearScale;
    const yScaleFn = opts.y?.scale === 'log' ? logScale : linearScale;
    const px = xScaleFn(xdom, innerX);
    const py = yScaleFn(ydom, innerY);
    const frame: Frame = {
      px,
      py,
      xdom,
      ydom,
      theme,
      width,
      height,
      color: (i: number) => theme.series[i % theme.series.length],
    };

    const prims: Prim[] = [];
    const xticks = niceTicks(xdom[0], xdom[1]).filter((t) => t >= xdom[0] && t <= xdom[1]);
    const yticks = niceTicks(ydom[0], ydom[1]).filter((t) => t >= ydom[0] && t <= ydom[1]);
    // grid
    for (const t of xticks)
      prims.push({
        k: 'line',
        x1: px(t),
        y1: innerY[0],
        x2: px(t),
        y2: innerY[1],
        stroke: theme.grid,
        w: 1,
      });
    for (const t of yticks)
      prims.push({
        k: 'line',
        x1: innerX[0],
        y1: py(t),
        x2: innerX[1],
        y2: py(t),
        stroke: theme.grid,
        w: 1,
      });
    // axes
    prims.push({
      k: 'line',
      x1: MARGIN.left,
      y1: height - MARGIN.bottom,
      x2: width - MARGIN.right,
      y2: height - MARGIN.bottom,
      stroke: theme.axis,
      w: 1,
    });
    prims.push({
      k: 'line',
      x1: MARGIN.left,
      y1: MARGIN.top,
      x2: MARGIN.left,
      y2: height - MARGIN.bottom,
      stroke: theme.axis,
      w: 1,
    });
    // tick labels
    for (const t of xticks)
      prims.push({
        k: 'text',
        x: px(t),
        y: height - MARGIN.bottom + 16,
        s: fmt(t),
        fill: theme.muted,
        anchor: 'middle',
        size: 11,
      });
    for (const t of yticks)
      prims.push({
        k: 'text',
        x: MARGIN.left - 8,
        y: py(t) + 4,
        s: fmt(t),
        fill: theme.muted,
        anchor: 'end',
        size: 11,
      });
    // title + axis labels
    if (opts.title)
      prims.push({
        k: 'text',
        x: width / 2,
        y: 20,
        s: opts.title,
        fill: theme.fg,
        anchor: 'middle',
        size: 14,
      });
    if (opts.xLabel)
      prims.push({
        k: 'text',
        x: MARGIN.left + (width - MARGIN.left - MARGIN.right) / 2,
        y: height - 8,
        s: opts.xLabel,
        fill: theme.fg,
        anchor: 'middle',
        size: 12,
      });
    if (opts.yLabel)
      prims.push({
        k: 'text',
        x: 16,
        y: MARGIN.top + (height - MARGIN.top - MARGIN.bottom) / 2,
        s: opts.yLabel,
        fill: theme.fg,
        anchor: 'middle',
        size: 12,
        rotate: -90,
      });
    // marks
    layers.forEach((l, i) => prims.push(...renderLayer(l, frame, i)));
    // legend
    if (opts.legend && layers.some((l) => l.label)) {
      layers.forEach((l, i) => {
        if (!l.label) return;
        const ly = MARGIN.top + 4 + i * 16;
        const c = l.color ?? frame.color(i);
        prims.push({ k: 'rect', x: width - MARGIN.right - 120, y: ly - 8, w: 10, h: 10, fill: c });
        prims.push({
          k: 'text',
          x: width - MARGIN.right - 106,
          y: ly + 1,
          s: l.label,
          fill: theme.fg,
          anchor: 'start',
          size: 11,
        });
      });
    }

    return emit({ width, height, bg: theme.bg, prims }, opts);
  } catch {
    return emit(noDataScene(width, height, theme), opts);
  }
}
