import { parse, evaluate, range } from '@danielsimonjr/mathts-functions';
import { line } from './marks2d.js';
import { overlay } from './overlay.js';
import { contour } from './contour.js';
import { surface } from './three/surface.js';
import type { Layer2D, PlotOptions } from './types.js';

function isLayerArray(v: unknown): v is Layer2D[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    typeof v[0] === 'object' &&
    v[0] !== null &&
    'type' in (v[0] as object)
  );
}

/** Collect the free symbol names used in a parsed expression (minus known constants/functions). */
function freeVars(source: string): string[] {
  const names = new Set<string>();
  const funcs = new Set<string>();
  try {
    const node = parse(source) as { traverse?: (cb: (n: unknown) => void) => void };
    if (typeof node.traverse === 'function') {
      node.traverse((n: unknown) => {
        const nn = n as { type?: string; name?: string };
        if (nn.type === 'SymbolNode' && nn.name) names.add(nn.name);
        if (nn.type === 'FunctionNode' && nn.name) funcs.add(nn.name);
      });
    }
  } catch {
    /* unparseable → no free vars */
  }
  funcs.forEach((f) => names.delete(f)); // function callees are not plot variables
  ['pi', 'e', 'tau'].forEach((c) => names.delete(c)); // common constants
  return [...names];
}

/** Expression-string form: sample/evaluate a source and auto-select a mark. */
function plotExpr(source: string, opts: PlotOptions): string {
  const { kind, ...rest } = opts;
  const from = opts.from ?? -10;
  const to = opts.to ?? 10;
  const n = opts.samples ?? 200;
  const scope = opts.scope ?? {};
  const rangeFn = range as (from: number, to: number, step: number, includeEnd: boolean) => unknown;
  const grid =
    (rangeFn(from, to, (to - from) / (n - 1), true) as { toArray?: () => number[] }).toArray?.() ??
    Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
  const vars = freeVars(source);
  if (vars.length <= 1) {
    const v = vars[0] ?? 'x';
    const ys = grid.map((val) => {
      try {
        return Number(evaluate(source, { ...scope, [v]: val }));
      } catch {
        return NaN;
      }
    });
    return line(grid, ys, { xLabel: v, title: source, ...rest });
  }
  const [vx, vy] = vars;
  const g2: number[][] = grid.map((yv) =>
    grid.map((xv) => {
      try {
        return Number(evaluate(source, { ...scope, [vx]: xv, [vy]: yv }));
      } catch {
        return NaN;
      }
    })
  );
  return kind === '3d' || kind === 'surface'
    ? surface(g2, { title: source, ...rest })
    : contour(g2, { title: source, ...rest });
}

/**
 * Generic entry point. Data forms:
 *   plot(y, opts?)            → line, x = 0..n-1
 *   plot(x, y, opts?)         → line
 *   plot(layers[], opts?)     → overlay
 *   plot(source, opts?)       → expression sampling (line / contour / surface)
 */
export function plot(a: unknown, b?: unknown, c?: PlotOptions): string {
  if (typeof a === 'string') return plotExpr(a, (b as PlotOptions) ?? {});
  if (isLayerArray(a)) return overlay(a, (b as PlotOptions) ?? {});
  if (Array.isArray(b) || b instanceof Float64Array) return line(a, b as Layer2D['y'], c);
  // single series → indices for x
  return line(undefined, a as Layer2D['y'], (b as PlotOptions) ?? {});
}

/** Generic TikZ entry — same polymorphism as plot(), forced to the TikZ backend. */
export function toTikZ(a: unknown, b?: unknown, c?: PlotOptions): string {
  if (typeof a === 'string') return plot(a, { ...((b as PlotOptions) ?? {}), format: 'tikz' });
  if (
    Array.isArray(a) &&
    a.length > 0 &&
    typeof a[0] === 'object' &&
    a[0] !== null &&
    'type' in (a[0] as object)
  )
    return plot(a, { ...((b as PlotOptions) ?? {}), format: 'tikz' });
  if (Array.isArray(b) || b instanceof Float64Array)
    return plot(a as never, b as never, { ...(c ?? {}), format: 'tikz' });
  return plot(a as never, { ...((b as PlotOptions) ?? {}), format: 'tikz' });
}
