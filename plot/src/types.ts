/** Anything the plotter accepts as a data series: numbers, typed arrays, or core values. */
export type Data = unknown;

/** A 2-D coordinate axis. */
export interface AxisSpec {
  label?: string;
  scale?: 'linear' | 'log';
}

/** Options shared by all plot functions (each uses the subset it needs). */
export interface PlotOptions {
  title?: string;
  xLabel?: string;
  yLabel?: string;
  x?: AxisSpec;
  y?: AxisSpec;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  palette?: readonly string[];
  legend?: boolean;
  // expression sampling (generic plot):
  from?: number;
  to?: number;
  samples?: number;
  kind?: '2d' | '3d' | 'surface';
  scope?: Record<string, unknown>;
}

/** One drawable 2-D layer for the shared draw2D core / overlay. */
export interface Layer2D {
  type: 'line' | 'scatter' | 'bar' | 'area' | 'step' | 'errorbar' | 'quiver';
  x?: Data;
  y: Data;
  yerr?: Data; // errorbar
  u?: Data; // quiver dx
  v?: Data; // quiver dy
  label?: string;
  color?: string;
}
