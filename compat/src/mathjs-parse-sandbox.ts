/**
 * mathjs rejects unsafe object-literal keys at compile time. MathTS parse drops
 * them silently; compat throws the same errors as mathjs before compile (#1777).
 */

function decodeKeyFragment(fragment: string): string {
  return fragment.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
}

/** mathjs 15.3.0 rejects only these unsafe object-literal keys (security.test.js). */
const FORBIDDEN_OBJECT_LITERAL_KEYS: ReadonlySet<string> = new Set([
  'constructor',
  'hasOwnProperty',
  'toString',
]);

function forbiddenObjectLiteralKey(rawKey: string, _expr: string): string | null {
  const decoded = decodeKeyFragment(rawKey);
  return FORBIDDEN_OBJECT_LITERAL_KEYS.has(decoded) ? decoded : null;
}

/** Inherited Array methods mathjs blocks via `setSafeProperty` (#1777 security.test.js). */
const FORBIDDEN_ARRAY_MEMBER_ASSIGN = new Set([
  'map',
  'filter',
  'forEach',
  'reduce',
  'find',
  'some',
  'every',
]);

/** Block `array.map = …` assignments that must throw before compile (parity shim). */
export function guardMathjsForbiddenArrayMemberAssignment(expr: string): void {
  const re = /(?:^|[;\n])\s*([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(expr)) !== null) {
    const prop = match[2] ?? '';
    if (FORBIDDEN_ARRAY_MEMBER_ASSIGN.has(prop)) {
      throw new Error('No access to property "' + prop + '"');
    }
  }
}

/** Throw when expression source uses object-literal keys that parse would strip. */
export function guardMathjsObjectLiteralKeys(expr: string): void {
  guardMathjsForbiddenArrayMemberAssignment(expr);
  for (const re of [
    /['"]([^'"]+)['"]\s*:/g,
    /(?:\{|,)\s*([A-Za-z_\u0080-\uFFFF][\w\u0080-\uFFFF]*)\s*:/g,
  ]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(expr)) !== null) {
      const raw = match[1] ?? '';
      const forbidden = forbiddenObjectLiteralKey(raw, expr);
      if (forbidden !== null) {
        throw new Error('No access to property "' + forbidden + '"');
      }
    }
  }
  let block: RegExpExecArray | null;
  const objectRe = /\{[^{}]*\}/g;
  while ((block = objectRe.exec(expr)) !== null) {
    const segment = block[0];
    for (const re of [
      /['"]([^'"]+)['"]\s*:/g,
      /(?:\{|,)\s*([A-Za-z_\u0080-\uFFFF][\w\u0080-\uFFFF]*)\s*:/g,
    ]) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(segment)) !== null) {
        const raw = match[1] ?? '';
        const forbidden = forbiddenObjectLiteralKey(raw, expr);
        if (forbidden !== null) {
          throw new Error('No access to property "' + forbidden + '"');
        }
      }
    }
  }
}
