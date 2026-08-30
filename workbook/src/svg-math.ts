/**
 * MathML → SVG typesetting. Wraps a MathML fragment in an SVG document so
 * rendered workbooks can emit SVG (browsers, rsvg, inkscape) instead of raw
 * MathML. The glyph metrics are a conservative estimate — consumers that need
 * pixel-perfect layout should typeset with a real engine; this is the
 * no-dependency path the CLI/export uses.
 */

export interface MathSvgOptions {
  /** Display (`block`) or inline. Default `block`. */
  display?: 'block' | 'inline';
  /** Extra padding in CSS pixels. Default 4. */
  padding?: number;
}

/**
 * Wrap a MathML fragment (or a full `<math>` document) in an SVG with a
 * `foreignObject` so the math remains selectable and scalable.
 */
export function mathMLToSVG(mathml: string, options: MathSvgOptions = {}): string {
  const display = options.display ?? 'block';
  const pad = options.padding ?? 4;
  const inner = mathml.includes('<math')
    ? mathml
    : `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${display}">${mathml}</math>`;
  // Rough width/height from character count — enough for a bounding box that
  // does not clip typical expressions. Renderers that honor foreignObject
  // ignore the viewBox for the inner math's intrinsic size.
  const text = inner.replace(/<[^>]+>/g, '');
  const width = Math.max(24, text.length * 10 + pad * 2);
  const height = display === 'block' ? 36 + pad * 2 : 20 + pad * 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}">`,
    inner,
    `</foreignObject>`,
    `</svg>`,
  ].join('');
}
