import { coerce1d } from './coerce.js';
import { extent, linearScale, logScale, niceTicks } from './scale.js';
import { THEMES, type Theme, esc, fmt, svgDoc, line as svgLine, text } from './svg.js';
import type { Layer2D, PlotOptions } from './types.js';
import { renderLayer } from './marks2d.js';

const MARGIN = { top: 34, right: 20, bottom: 46, left: 64 };

export interface Frame {
  px: (x: number) => number;
  py: (y: number) => number;
  xdom: [number, number];
  ydom: [number, number];
  theme: Theme;
  width: number;
  height: number;
  color: (i: number) => string;
}

/** Combined [min,max] of a coord across every layer that carries it. */
function combinedExtent(layers: Layer2D[], pick: (l: Layer2D) => number[]): [number, number] {
  const all: number[] = [];
  for (const l of layers) all.push(...pick(l));
  return extent(all);
}

function noData(width: number, height: number, theme: Theme): string {
  return svgDoc(
    width,
    height,
    text(width / 2, height / 2, 'no data', theme.muted, 'middle', 13),
    theme.bg
  );
}

/** Shared 2-D rendering core: axes + ticks + grid + labels + legend + layer marks. Never throws. */
export function draw2D(layers: Layer2D[], opts: PlotOptions = {}): string {
  const width = opts.width ?? 520;
  const height = opts.height ?? 320;
  const theme = THEMES[opts.theme ?? 'light'];
  try {
    // "has data" is decided on the y-series alone (x may legitimately default to indices);
    // an empty/all-non-finite y for every layer means nothing is plottable.
    const yAll = layers.flatMap((l) => coerce1d(l.y));
    if (yAll.length === 0) return noData(width, height, theme);

    const xdom = combinedExtent(layers, (l) =>
      l.x ? coerce1d(l.x) : coerce1d(l.y).map((_, i) => i)
    );
    const ydom = combinedExtent(layers, (l) => coerce1d(l.y));
    if (!Number.isFinite(xdom[0]) || !Number.isFinite(ydom[0])) return noData(width, height, theme);

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

    // grid + ticks
    const xticks = niceTicks(xdom[0], xdom[1]).filter((t) => t >= xdom[0] && t <= xdom[1]);
    const yticks = niceTicks(ydom[0], ydom[1]).filter((t) => t >= ydom[0] && t <= ydom[1]);
    const grid =
      xticks.map((t) => svgLine(px(t), innerY[0], px(t), innerY[1], theme.grid, 1)).join('') +
      yticks.map((t) => svgLine(innerX[0], py(t), innerX[1], py(t), theme.grid, 1)).join('');
    const axes =
      svgLine(
        MARGIN.left,
        height - MARGIN.bottom,
        width - MARGIN.right,
        height - MARGIN.bottom,
        theme.axis,
        1
      ) + svgLine(MARGIN.left, MARGIN.top, MARGIN.left, height - MARGIN.bottom, theme.axis, 1);
    const xtickLabels = xticks
      .map((t) => text(px(t), height - MARGIN.bottom + 16, fmt(t), theme.muted, 'middle', 11))
      .join('');
    const ytickLabels = yticks
      .map((t) => text(MARGIN.left - 8, py(t) + 4, fmt(t), theme.muted, 'end', 11))
      .join('');

    // titles + axis labels
    const title = opts.title ? text(width / 2, 20, opts.title, theme.fg, 'middle', 14) : '';
    const xlab = opts.xLabel
      ? text(
          MARGIN.left + (width - MARGIN.left - MARGIN.right) / 2,
          height - 8,
          opts.xLabel,
          theme.fg,
          'middle',
          12
        )
      : '';
    const ylab = opts.yLabel
      ? `<text transform="translate(16,${MARGIN.top + (height - MARGIN.top - MARGIN.bottom) / 2}) rotate(-90)" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="${theme.fg}">${esc(opts.yLabel)}</text>`
      : '';

    // legend
    let legend = '';
    if (opts.legend && layers.some((l) => l.label)) {
      legend = layers
        .map((l, i) => {
          if (!l.label) return '';
          const ly = MARGIN.top + 4 + i * 16;
          const c = l.color ?? frame.color(i);
          return (
            `<rect x="${width - MARGIN.right - 120}" y="${ly - 8}" width="10" height="10" fill="${c}"/>` +
            text(width - MARGIN.right - 106, ly + 1, l.label, theme.fg, 'start', 11)
          );
        })
        .join('');
    }

    const marks = layers.map((l, i) => renderLayer(l, frame, i)).join('');
    return svgDoc(
      width,
      height,
      grid + axes + xtickLabels + ytickLabels + title + xlab + ylab + marks + legend,
      theme.bg
    );
  } catch {
    return noData(width, height, theme);
  }
}
