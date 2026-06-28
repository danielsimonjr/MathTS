/**
 * Render numeric data series to a self-contained inline SVG chart — a
 * MathTS-native, dependency-free plotter for the HTML export (MathTS has no
 * charting; this is the proposed solution). Coerces inputs to finite numbers
 * (drops the rest), computes linear scales, and draws axes/ticks/labels plus a
 * line/scatter/bar series. Never throws: bad/empty data → a "no data" SVG.
 * Explicit colors (not theme-dependent) so it is legible on any background.
 */

export interface ChartSpec {
  type?: 'line' | 'scatter' | 'bar';
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

const W = 520;
const H = 320;
const M = { top: 30, right: 20, bottom: 45, left: 64 };

const STYLE =
  '<style>.t-axis{stroke:#5a5a72;stroke-width:1}.t-line{fill:none;stroke:#2a4d8f;stroke-width:2}' +
  '.t-pt{fill:#2a4d8f}.t-bar{fill:#2a4d8f}.t-title{font:600 14px system-ui,sans-serif;fill:#1a1a2e}' +
  '.t-tick{font:11px system-ui,sans-serif;fill:#5a5a72}.t-lab{font:12px system-ui,sans-serif;fill:#1a1a2e}' +
  '.t-note{font:13px system-ui,sans-serif;fill:#8a8a9a}</style>';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return n.toExponential(2);
  return String(Math.round(n * 1e6) / 1e6);
}

function frame(inner: string, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img">${STYLE}${title}${inner}</svg>`;
}

/** Render an SVG chart from a spec plus raw x/y data (coerced to finite numbers). */
export function renderChart(spec: ChartSpec, xRaw: unknown, yRaw: unknown): string {
  try {
    const title = spec.title
      ? `<text x="${W / 2}" y="18" text-anchor="middle" class="t-title">${esc(spec.title)}</text>`
      : '';

    const xs = toNums(xRaw);
    const ys = toNums(yRaw);
    const count = Math.min(xs.length, ys.length);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pts.push([xs[i], ys[i]]);
    }
    if (pts.length === 0) {
      return frame(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="t-note">no data</text>`, title);
    }

    let xmin = Math.min(...pts.map((p) => p[0]));
    let xmax = Math.max(...pts.map((p) => p[0]));
    let ymin = Math.min(...pts.map((p) => p[1]));
    let ymax = Math.max(...pts.map((p) => p[1]));
    if (xmin === xmax) {
      xmin -= 1;
      xmax += 1;
    }
    if (ymin === ymax) {
      ymin -= 1;
      ymax += 1;
    }
    const px = (x: number): number => M.left + ((x - xmin) / (xmax - xmin)) * (W - M.left - M.right);
    const py = (y: number): number => H - M.bottom - ((y - ymin) / (ymax - ymin)) * (H - M.top - M.bottom);

    const axes =
      `<line x1="${M.left}" y1="${H - M.bottom}" x2="${W - M.right}" y2="${H - M.bottom}" class="t-axis"/>` +
      `<line x1="${M.left}" y1="${M.top}" x2="${M.left}" y2="${H - M.bottom}" class="t-axis"/>`;

    const xticks = [xmin, (xmin + xmax) / 2, xmax]
      .map((t) => `<text x="${px(t)}" y="${H - M.bottom + 16}" text-anchor="middle" class="t-tick">${esc(fmt(t))}</text>`)
      .join('');
    const yticks = [ymin, (ymin + ymax) / 2, ymax]
      .map((t) => `<text x="${M.left - 8}" y="${py(t) + 4}" text-anchor="end" class="t-tick">${esc(fmt(t))}</text>`)
      .join('');

    const xlab = spec.xLabel
      ? `<text x="${M.left + (W - M.left - M.right) / 2}" y="${H - 6}" text-anchor="middle" class="t-lab">${esc(spec.xLabel)}</text>`
      : '';
    const ylab = spec.yLabel
      ? `<text transform="translate(16,${M.top + (H - M.top - M.bottom) / 2}) rotate(-90)" text-anchor="middle" class="t-lab">${esc(spec.yLabel)}</text>`
      : '';

    const type = spec.type ?? 'line';
    let series: string;
    if (type === 'bar') {
      const base = H - M.bottom;
      const bw = ((W - M.left - M.right) / pts.length) * 0.7;
      series = pts
        .map(([x, y]) => {
          const yp = py(y);
          return `<rect x="${px(x) - bw / 2}" y="${yp}" width="${bw}" height="${Math.max(0, base - yp)}" class="t-bar"/>`;
        })
        .join('');
    } else if (type === 'scatter') {
      series = pts.map(([x, y]) => `<circle cx="${px(x)}" cy="${py(y)}" r="3" class="t-pt"/>`).join('');
    } else {
      const line = `<polyline points="${pts.map(([x, y]) => `${px(x)},${py(y)}`).join(' ')}" class="t-line"/>`;
      series = line + pts.map(([x, y]) => `<circle cx="${px(x)}" cy="${py(y)}" r="2.5" class="t-pt"/>`).join('');
    }

    return frame(`${axes}${xticks}${yticks}${xlab}${ylab}${series}`, title);
  } catch {
    return frame(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="t-note">no data</text>`, '');
  }
}
