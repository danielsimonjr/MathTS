/**
 * mathjs 15.3.0 {@link help} wiring for compat (#1776): live `mathWithTransform`
 * name resolution, safe embedded-doc lookup, and compat-only doc entries.
 */
import { embeddedDocs } from '@danielsimonjr/mathts-expression';
import { hasOwnProperty } from '@danielsimonjr/mathts-core/internal';

/** Shape of one mathjs 15.3.0 embedded documentation entry used by compat `help()`. */
export interface CompatHelpDoc {
  name: string;
  category?: string;
  description?: string | string[];
  syntax?: string[];
  examples?: string[];
  seealso?: string[];
  mayThrow?: string[];
}

/** Compat-only `mathWithTransform` keys that are not in mathjs `embeddedDocs`. */
const COMPAT_EMBEDDED_DOCS: Record<string, CompatHelpDoc> = {
  compatBlockResultSet: {
    name: 'compatBlockResultSet',
    category: 'Configuration',
    description:
      'When true, every expression block evaluates to a ResultSet (mathjs compat #1556).',
    syntax: [],
    examples: ['true'],
    seealso: ['evaluate'],
  },
};

function assertSafeEmbeddedDocName(name: string): void {
  if (name in Object.prototype || name in Function.prototype) {
    throw new Error('No access to property "' + name + '"');
  }
}

/**
 * Resolve embedded documentation for a name, mirroring mathjs `getSafeProperty(embeddedDocs, name)`.
 */
export function compatEmbeddedDoc(name: string): CompatHelpDoc | undefined {
  assertSafeEmbeddedDocName(name);
  if (hasOwnProperty(COMPAT_EMBEDDED_DOCS, name)) {
    return COMPAT_EMBEDDED_DOCS[name];
  }
  const docs = embeddedDocs as Record<string, CompatHelpDoc>;
  if (hasOwnProperty(docs, name)) {
    return docs[name];
  }
  return undefined;
}

/**
 * Map a function, constant value, or name string to an embedded-doc name,
 * matching mathjs `createHelp` search resolution over `mathWithTransform`.
 */
export function resolveCompatHelpSearchName(
  search: unknown,
  mathWithTransform: Record<string, unknown>
): string {
  let searchName: unknown = search;
  if (typeof search !== 'string') {
    for (const prop in mathWithTransform) {
      if (hasOwnProperty(mathWithTransform, prop) && search === mathWithTransform[prop]) {
        searchName = prop;
        break;
      }
    }
  }
  if (typeof searchName !== 'string') {
    const label =
      typeof search === 'function'
        ? ((search as { name?: string }).name ?? '')
        : String(searchName ?? search);
    throw new Error(`No documentation found on "${label}"`);
  }
  return searchName;
}

/** Return the embedded doc for a help search value, or throw when none exists. */
export function compatHelpDocForSearch(
  search: unknown,
  mathWithTransform: Record<string, unknown>
): CompatHelpDoc {
  const name = resolveCompatHelpSearchName(search, mathWithTransform);
  const doc = compatEmbeddedDoc(name);
  if (!doc) {
    throw new Error(`No documentation found on "${name}"`);
  }
  return doc;
}

type TypedHelp = (search: unknown) => unknown;

/**
 * Build a typed `help` implementation with mathjs arity and lookup semantics.
 */
export function createCompatTypedHelp(
  typed: (name: string, signatures: { any: (search: unknown) => unknown }) => TypedHelp,
  mathWithTransform: Record<string, unknown>,
  Help: new (doc: CompatHelpDoc) => unknown
): TypedHelp {
  return typed('help', {
    any: (search: unknown) => new Help(compatHelpDocForSearch(search, mathWithTransform)),
  });
}
