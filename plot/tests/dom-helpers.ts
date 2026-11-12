/** Depth-first element walk (works with @xmldom/xmldom, which lacks querySelector). */
export function findDescendant(el: Element, pred: (e: Element) => boolean): Element | null {
  if (pred(el)) return el;
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (c.nodeType === 1) {
      const hit = findDescendant(c as Element, pred);
      if (hit) return hit;
    }
  }
  return null;
}
