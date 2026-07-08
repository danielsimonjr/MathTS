/**
 * Adapter: workbook ChartSpec → @danielsimonjr/mathts-plot per-type functions.
 * Coerces workbook's value types (Unit via toNumeric, Matrix-like via toArray)
 * to plain numbers, then delegates all rendering (scales/axes/marks/SVG) to the
 * plot package. Never throws. Replaces workbook's former private SVG plotter.
 */
import { line, scatter, bar } from '@danielsimonjr/mathts-plot';

export interface ChartSpec {
  type?: 'line' | 'scatter' | 'bar';
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

function coerce(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  const u = v as { toNumeric?: () => unknown } | null;
  if (u && typeof u.toNumeric === 'function') {
    try {
      return Number(u.toNumeric());
    } catch {
      return NaN;
    }
  }
  return Number(v as number);
}

function toNums(raw: unknown): number[] {
  let arr: unknown = raw;
  const m = raw as { toArray?: () => unknown } | null;
  if (m && typeof m.toArray === 'function') {
    try {
      arr = m.toArray(); // mathjs Matrix -> nested array
    } catch {
      arr = raw;
    }
  }
  return Array.isArray(arr) ? arr.flat(Infinity).map(coerce) : [];
}

/** Render an SVG chart from a spec plus raw x/y data, via the plot package. */
export function renderChart(spec: ChartSpec, xRaw: unknown, yRaw: unknown): string {
  const xs = toNums(xRaw);
  const ys = toNums(yRaw);
  const opts = { title: spec.title, xLabel: spec.xLabel, yLabel: spec.yLabel };
  if (spec.type === 'scatter') return scatter(xs, ys, opts);
  if (spec.type === 'bar') return bar(xs, ys, opts);
  return line(xs, ys, opts);
}
