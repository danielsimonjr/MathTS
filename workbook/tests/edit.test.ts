import { describe, it, expect } from 'vitest';
import { addCell, editCell, removeCell, moveCell, renameCell, setMetadata } from '../src/edit.js';
import type { Workbook, Cell } from '../src/types.js';

const cell = (id: string, dependsOn?: string[], content = '0'): Cell => ({
  id,
  type: 'code',
  content,
  ...(dependsOn ? { dependsOn } : {}),
});

function makeWb(cells: Cell[]): Workbook {
  return {
    version: '1.0',
    metadata: { title: 'Edit' },
    runtime: { engine: 'mathts', execution: 'reactive' },
    cells,
  };
}

describe('addCell', () => {
  it('appends a valid cell by default', () => {
    const wb = makeWb([cell('a')]);
    const out = addCell(wb, { id: 'b', type: 'code', content: 'a + 1', dependsOn: ['a'] });
    expect(out.cells.map((c) => c.id)).toEqual(['a', 'b']);
    expect(out.cells[1]).toMatchObject({ id: 'b', type: 'code', content: 'a + 1', dependsOn: ['a'] });
  });

  it('inserts at before/after/at positions', () => {
    const wb = makeWb([cell('a'), cell('b')]);
    expect(addCell(wb, { id: 'x', type: 'markdown' }, { before: 'b' }).cells.map((c) => c.id)).toEqual(['a', 'x', 'b']);
    expect(addCell(wb, { id: 'x', type: 'markdown' }, { after: 'a' }).cells.map((c) => c.id)).toEqual(['a', 'x', 'b']);
    expect(addCell(wb, { id: 'x', type: 'markdown' }, { at: 0 }).cells.map((c) => c.id)).toEqual(['x', 'a', 'b']);
  });

  it('does not mutate the input workbook (immutability)', () => {
    const wb = makeWb([cell('a')]);
    addCell(wb, { id: 'b', type: 'code' });
    expect(wb.cells.map((c) => c.id)).toEqual(['a']);
  });

  it('rejects duplicate, invalid id, unknown type, missing dep, self-dep', () => {
    const wb = makeWb([cell('a')]);
    expect(() => addCell(wb, { id: 'a', type: 'code' })).toThrow(/[Dd]uplicate/);
    expect(() => addCell(wb, { id: 'bad-id', type: 'code' })).toThrow(/[Ii]nvalid/);
    expect(() => addCell(wb, { id: 'b', type: 'tensor' as never })).toThrow(/[Uu]nsupported/);
    expect(() => addCell(wb, { id: 'b', type: 'code', dependsOn: ['ghost'] })).toThrow(/unknown/);
    expect(() => addCell(wb, { id: 'b', type: 'code', dependsOn: ['b'] })).toThrow(/itself/);
  });

  it('rejects an out-of-range --at and unknown anchors', () => {
    const wb = makeWb([cell('a')]);
    expect(() => addCell(wb, { id: 'b', type: 'code' }, { at: 99 })).toThrow(/range/);
    expect(() => addCell(wb, { id: 'b', type: 'code' }, { before: 'ghost' })).toThrow(/before/);
  });

  it('rejects a cycle-forming addition', () => {
    const wb = makeWb([cell('a', ['b'])]); // a depends on b (b will be added depending on a -> cycle)
    expect(() => addCell(wb, { id: 'b', type: 'code', dependsOn: ['a'] })).toThrow(/cycle/i);
  });
});

describe('editCell', () => {
  it('changes content and deps', () => {
    const wb = makeWb([cell('a'), cell('b')]);
    const out = editCell(wb, 'b', { content: 'a * 2', dependsOn: ['a'] });
    expect(out.cells[1]).toMatchObject({ content: 'a * 2', dependsOn: ['a'] });
  });

  it('rejects a change to a deferred type', () => {
    const wb = makeWb([cell('a')]);
    expect(() => editCell(wb, 'a', { type: 'tensor' as never })).toThrow(/[Uu]nsupported/);
  });

  it('rejects a cycle created via depends_on', () => {
    const wb = makeWb([cell('a', ['b']), cell('b')]);
    expect(() => editCell(wb, 'b', { dependsOn: ['a'] })).toThrow(/cycle/i);
  });

  it('throws for an unknown cell', () => {
    expect(() => editCell(makeWb([cell('a')]), 'ghost', { content: 'x' })).toThrow(/[Nn]o such cell/);
  });
});

describe('removeCell', () => {
  it('removes a leaf cell', () => {
    const out = removeCell(makeWb([cell('a'), cell('b')]), 'b');
    expect(out.workbook.cells.map((c) => c.id)).toEqual(['a']);
    expect(out.changedCells).toEqual([]);
  });

  it('refuses to remove a cell with dependents unless forced', () => {
    const wb = makeWb([cell('a'), cell('b', ['a'])]);
    expect(() => removeCell(wb, 'a')).toThrow(/dependent/i);
  });

  it('with --force removes the cell and strips it from dependents (reported)', () => {
    const wb = makeWb([cell('a'), cell('b', ['a']), cell('c', ['a'])]);
    const out = removeCell(wb, 'a', { force: true });
    expect(out.workbook.cells.map((c) => c.id)).toEqual(['b', 'c']);
    expect(out.changedCells.sort()).toEqual(['b', 'c']);
    expect(out.workbook.cells.every((c) => !(c.dependsOn ?? []).includes('a'))).toBe(true);
  });
});

describe('moveCell', () => {
  it('reorders a cell', () => {
    const wb = makeWb([cell('a'), cell('b'), cell('c')]);
    expect(moveCell(wb, 'c', { at: 0 }).cells.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(moveCell(wb, 'a', { after: 'b' }).cells.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('is a no-op when moved relative to itself', () => {
    const wb = makeWb([cell('a'), cell('b')]);
    expect(moveCell(wb, 'a', { before: 'a' }).cells.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('renameCell', () => {
  it('renames and updates dependents (edge AND by-id content references)', () => {
    const wb = makeWb([cell('a'), cell('b', ['a'], 'a * 2')]);
    const out = renameCell(wb, 'a', 'alpha');
    expect(out.cells.map((c) => c.id)).toEqual(['alpha', 'b']);
    expect(out.cells[1].dependsOn).toEqual(['alpha']);
    expect(out.cells[1].content).toBe('alpha * 2'); // by-id reference rewritten
  });

  it('is a no-op when old === new', () => {
    const wb = makeWb([cell('a')]);
    expect(renameCell(wb, 'a', 'a').cells.map((c) => c.id)).toEqual(['a']);
  });

  it('rejects an invalid or duplicate new id', () => {
    const wb = makeWb([cell('a'), cell('b')]);
    expect(() => renameCell(wb, 'a', 'bad-id')).toThrow(/[Ii]nvalid/);
    expect(() => renameCell(wb, 'a', 'b')).toThrow(/[Dd]uplicate/);
  });
});

describe('edit ops — review hardening', () => {
  it('only rejects INTRODUCED cycles, not pre-existing ones (edit an unrelated cell)', () => {
    // a <-> b is already a cycle; editing unrelated cell c must not throw.
    const wb = makeWb([cell('a', ['b']), cell('b', ['a']), cell('c')]);
    expect(() => editCell(wb, 'c', { content: '5' })).not.toThrow();
  });

  it("clears a cell's cached output when its content changes", () => {
    const wb = makeWb([{ ...cell('a'), output: 42 }]);
    expect(editCell(wb, 'a', { content: '99' }).cells[0].output).toBeUndefined();
  });

  it("clears detached dependents' cached output on force-remove", () => {
    const wb = makeWb([cell('a'), { ...cell('b', ['a']), output: 7 }]);
    const out = removeCell(wb, 'a', { force: true });
    expect(out.workbook.cells.find((c) => c.id === 'b')!.output).toBeUndefined();
  });

  it('rename preserves cached outputs (pure relabel)', () => {
    const wb = makeWb([{ ...cell('a'), output: 42 }]);
    expect(renameCell(wb, 'a', 'alpha').cells[0].output).toBe(42);
  });
});

describe('setMetadata', () => {
  it('updates only the provided metadata fields, immutably', () => {
    const wb = makeWb([cell('a')]);
    const out = setMetadata(wb, { author: 'Ada', tags: ['x', 'y'] });
    expect(out.metadata.title).toBe('Edit'); // unchanged
    expect(out.metadata.author).toBe('Ada');
    expect(out.metadata.tags).toEqual(['x', 'y']);
    expect(wb.metadata.author).toBeUndefined(); // input not mutated
  });
});
