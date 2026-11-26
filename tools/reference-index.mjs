/**
 * Reader for the generated export index in docs/reference/functions.md.
 *
 * `tools/generate-functions-reference.mjs` writes the index block. The landing
 * generator and the README sync tool read it through this one module, so the export
 * count and the category count have one definition.
 *
 * A "category" is a named domain in the "### Functions by category" section. The
 * catch-all group (UNCATEGORIZED) lists exports that no domain claims. It is not a
 * category, so it is not counted in `categoryCount`. The landing page still shows it
 * as a card, under its own label.
 *
 * Each group is a `**Name** (n):` heading. Names may sit on that heading line
 * (legacy comma-joined form) or one backtick-name per following line.
 */

/** Label of the catch-all group. The reference generator writes it; readers match it. */
export const UNCATEGORIZED = 'Other exports (uncategorized)';

const INDEX_HEADING = '## Complete export index';
const CATEGORY_HEADING = '### Functions by category';

/**
 * @param {string} referenceText content of docs/reference/functions.md
 * @param {string} [source] name used in the error message
 * @returns {{
 *   curatedText: string,
 *   exportTotal: number,
 *   domains: Map<string, string[]>,
 *   categoryCount: number,
 * }} `domains` maps every group, the catch-all included, to its names in index order.
 * @throws {Error} when the index has no export count or no category group
 */
export function parseReferenceIndex(referenceText, source = 'reference') {
  const [curatedText, indexText = ''] = referenceText.split(INDEX_HEADING);
  const exportTotal = Number((indexText.match(/\((\d+) exports\)/) ?? [])[1] ?? 0);

  /** @type {Map<string, string[]>} */
  const domains = new Map();
  const section = indexText.split(CATEGORY_HEADING)[1]?.split(/\n### /)[0] ?? '';
  let current = null;
  for (const line of section.split('\n')) {
    const head = line.match(/^\*\*(.+?)\*\* \((\d+)\):(.*)$/);
    if (head) {
      current = head[1];
      domains.set(current, [...head[3].matchAll(/`([^`]+)`/g)].map((x) => x[1]));
      continue;
    }
    if (current === null) continue;
    if (line.trim() === '') {
      current = null;
      continue;
    }
    domains.get(current).push(...[...line.matchAll(/`([^`]+)`/g)].map((x) => x[1]));
  }

  const categoryCount = [...domains.keys()].filter((name) => name !== UNCATEGORIZED).length;
  if (!exportTotal || !categoryCount) {
    throw new Error(
      `${source} has no "(N exports)" header or no "${CATEGORY_HEADING}" block; run bun run docs:functions`
    );
  }
  return { curatedText, exportTotal, domains, categoryCount };
}
