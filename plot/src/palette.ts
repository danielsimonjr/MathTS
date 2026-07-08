// 9 anchor stops of the viridis colormap (perceptually uniform), interpolated in sRGB.
const STOPS: Array<[number, number, number]> = [
  [68, 1, 84],
  [72, 40, 120],
  [62, 74, 137],
  [49, 104, 142],
  [38, 130, 142],
  [31, 158, 137],
  [53, 183, 121],
  [110, 206, 88],
  [253, 231, 37],
];

const hex = (n: number): string => Math.round(n).toString(16).padStart(2, '0');

/** viridis colormap: t in [0,1] → "#rrggbb". */
export function viridis(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const s = c * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(s));
  const f = s - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const r = a[0] + (b[0] - a[0]) * f;
  const g = a[1] + (b[1] - a[1]) * f;
  const bl = a[2] + (b[2] - a[2]) * f;
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}
