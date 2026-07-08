/** Backend-agnostic drawing primitives. Marks build these; a backend serializes them. */
export type Prim =
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; w: number }
  | { k: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { k: 'polyline'; pts: Array<[number, number]>; stroke: string; w: number }
  | { k: 'polygon'; pts: Array<[number, number]>; fill: string; stroke: string }
  | {
      k: 'text';
      x: number;
      y: number;
      s: string;
      fill: string;
      anchor: 'start' | 'middle' | 'end';
      size: number;
      rotate?: number;
    };

/** A complete drawable: canvas size, background, and an ordered list of primitives. */
export interface Scene {
  width: number;
  height: number;
  bg: string;
  prims: Prim[];
}
