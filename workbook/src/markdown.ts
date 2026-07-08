/**
 * Minimal, dependency-free Markdown → HTML for rendered documents. A small
 * subset (headings, paragraphs, bold/italic/code, fenced code, lists, links,
 * hr) — NOT CommonMark-complete. XSS-safe: text is HTML-escaped first, then
 * inline markers are applied to the escaped text, and link hrefs pass a strict
 * protocol allowlist (not a denylist).
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Allow only http(s)/mailto absolute URLs and clearly-relative links; reject
 * protocol-relative (`//host`) and every other scheme, after percent-decoding +
 * lowercasing so encoded/cased tricks can't slip past.
 * The allowlist decision, returning the raw safe href (unescaped) or null.
 */
function sanitizeHrefRaw(href: string): string | null {
  const h = href.trim();
  let probe = h.replace(/&amp;/g, '&');
  try {
    probe = decodeURIComponent(probe);
  } catch {
    // malformed escape — inspect the raw form
  }
  probe = probe.trim().toLowerCase();
  if (probe.startsWith('//')) return null;
  if (probe.startsWith('http://') || probe.startsWith('https://') || probe.startsWith('mailto:'))
    return h;
  if (
    probe.startsWith('/') ||
    probe.startsWith('./') ||
    probe.startsWith('../') ||
    probe.startsWith('#')
  )
    return h;
  if (/^[a-z][a-z0-9+.-]*:/.test(probe)) return null;
  return null;
}

/** HTML: allowlisted href, quote-escaped for an attribute (or null to drop). */
function sanitizeHref(href: string): string | null {
  const raw = sanitizeHrefRaw(href);
  return raw === null ? null : raw.replace(/"/g, '&quot;');
}

function inline(escaped: string): string {
  let s = escaped.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const safe = sanitizeHref(href);
    return safe ? `<a href="${safe}">${text}</a>` : text;
  });
  return s;
}

const HR = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const UL = /^\s*[-*+]\s+/;
const OL = /^\s*\d+\.\s+/;

function isBlockStart(line: string): boolean {
  return (
    line.trim() === '' ||
    /^```/.test(line.trim()) ||
    HEADING.test(line) ||
    UL.test(line) ||
    OL.test(line) ||
    HR.test(line)
  );
}

export function markdownToHtml(src: string): string {
  if (!src) return '';
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence (or run off the end)
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(esc(h[2].trim()))}</h${lvl}>`);
      i++;
      continue;
    }
    if (UL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL.test(lines[i])) {
        items.push(`<li>${inline(esc(lines[i].replace(UL, '')))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (OL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL.test(lines[i])) {
        items.push(`<li>${inline(esc(lines[i].replace(OL, '')))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !isBlockStart(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(esc(para.join(' ')))}</p>`);
  }

  return out.join('\n');
}

/** Escape LaTeX specials in a single pass (an escape's own backslash/braces are never re-scanned). */
export function texEscape(s: string): string {
  return s.replace(/[\\&%$#_{}~^]/g, (c) => {
    switch (c) {
      case '\\':
        return '\\textbackslash{}';
      case '~':
        return '\\textasciitilde{}';
      case '^':
        return '\\textasciicircum{}';
      default:
        return `\\${c}`;
    }
  });
}

function inlineTex(text: string): string {
  // Escape first, then apply inline markers to the escaped text (markers are ASCII, unaffected by texEscape).
  let s = texEscape(text);
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => `\\texttt{${code}}`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}');
  s = s.replace(/\*([^*]+)\*/g, '\\emph{$1}');
  s = s.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const raw = sanitizeHrefRaw(href);
    return raw ? `\\href{${texEscape(raw)}}{${label}}` : label;
  });
  return s;
}

/** Minimal Markdown → LaTeX, same subset + safety discipline as markdownToHtml. */
export function markdownToTex(src: string): string {
  if (!src) return '';
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  const SEC = ['\\section*', '\\subsection*', '\\subsubsection*', '\\paragraph'];
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(`\\begin{lstlisting}\n${buf.join('\n')}\n\\end{lstlisting}`);
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push('\\par\\noindent\\rule{\\linewidth}{0.4pt}\\par');
      i++;
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      const lvl = Math.min(h[1].length, 4);
      out.push(`${SEC[lvl - 1]}{${inlineTex(h[2].trim())}}`);
      i++;
      continue;
    }
    if (UL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL.test(lines[i])) {
        items.push(`  \\item ${inlineTex(lines[i].replace(UL, ''))}`);
        i++;
      }
      out.push(`\\begin{itemize}\n${items.join('\n')}\n\\end{itemize}`);
      continue;
    }
    if (OL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL.test(lines[i])) {
        items.push(`  \\item ${inlineTex(lines[i].replace(OL, ''))}`);
        i++;
      }
      out.push(`\\begin{enumerate}\n${items.join('\n')}\n\\end{enumerate}`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !isBlockStart(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(inlineTex(para.join(' ')));
  }
  return out.join('\n\n');
}
