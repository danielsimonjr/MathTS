import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
let counter = 0;

function fixture(content: string): string {
  const path = join(dir, `wb-${counter++}.mtsw`);
  writeFileSync(path, content, 'utf-8');
  return path;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-cli-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const PASSING = `
cells:
  - markdown: "# Demo"
    id: intro
  - code: "2 + 3"
    id: a
  - data: |
      pi: 3.14
    id: consts
  - test: "a == 5"
    id: checkA
    depends_on: [a]
`;

describe('cli dispatch', () => {
  it('should show help with no args', async () => {
    const r = await dispatch([]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('mtsw');
  });

  it('should error on an unknown command', async () => {
    const r = await dispatch(['frobnicate']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('Unknown command');
  });
});

describe('cli run', () => {
  it('should run a passing workbook (markdown + code + data + test) with exit 0', async () => {
    const r = await dispatch(['run', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain('a (code): 5');
    expect(r.stdout).toContain('checkA (test)');
    expect(r.stdout).toContain('intro (markdown)');
    expect(r.stdout).toContain('consts (data)');
  });

  it('should exit non-zero with parse errors on stderr', async () => {
    const r = await dispatch(['run', fixture('cells:\n  - code: "1"\n    id: bad-id')]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('valid identifier');
    expect(r.stdout).toBe('');
  });

  it('should report a failing test on stderr and still list cells on stdout', async () => {
    const wb = 'cells:\n  - code: "5"\n    id: a\n  - test: "a == 9"\n    id: checkA\n    depends_on: [a]';
    const r = await dispatch(['run', fixture(wb)]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('checkA');
    expect(r.stdout).toContain('a (code): 5');
  });

  it('should emit the envelope and still exit non-zero with --json on failure', async () => {
    const wb = 'cells:\n  - code: "5"\n    id: a\n  - test: "a == 9"\n    id: checkA\n    depends_on: [a]';
    const r = await dispatch(['run', fixture(wb), '--json']);
    expect(r.exitCode).toBe(1);
    const env = JSON.parse(r.stdout);
    expect(env.schemaVersion).toEqual({ major: 1, minor: 0 });
    expect(env.command).toBe('run');
    expect(env.ok).toBe(false);
    expect(env.problems.length).toBeGreaterThan(0);
    expect(env.data.cells.find((c: { id: string }) => c.id === 'checkA').status).toBe('fail');
  });
});

describe('cli run --cell', () => {
  const WB = [
    'cells:',
    '  - code: "10"',
    '    id: a',
    '  - code: "a * 2"',
    '    id: b',
    '    depends_on: [a]',
    '  - code: "999"',
    '    id: unrelated',
  ].join('\n');

  it('runs only the target cell and its transitive deps', async () => {
    const r = await dispatch(['run', fixture(WB), '--cell', 'b', '--json']);
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    const ids = env.data.cells.map((c: { id: string }) => c.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('errors on an unknown cell id', async () => {
    const r = await dispatch(['run', fixture(WB), '--cell', 'ghost', '--json']);
    expect(r.exitCode).toBe(1);
    const env = JSON.parse(r.stdout);
    expect(env.ok).toBe(false);
    expect(env.problems.join(' ')).toContain('ghost');
  });
});

describe('cli describe', () => {
  const WB = 'cells:\n  - code: "1"\n    id: a\n    output: 1\n  - code: "a+1"\n    id: b\n    depends_on: [a]';

  it('emits the structured document envelope with cells, outputs, and graph edges', async () => {
    const r = await dispatch(['describe', fixture(WB), '--json']);
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env.command).toBe('describe');
    expect(env.ok).toBe(true);
    const a = env.data.cells.find((c: { id: string }) => c.id === 'a');
    expect(a).toMatchObject({ type: 'code', content: '1', output: 1 });
    expect(env.data.graph.edges).toContainEqual({ from: 'a', to: 'b' });
  });

  it('returns ok:false with problems on an invalid workbook (still an envelope)', async () => {
    const r = await dispatch(['describe', fixture('cells:\n  - code: "1"\n    id: bad-id'), '--json']);
    expect(r.exitCode).toBe(1);
    const env = JSON.parse(r.stdout);
    expect(env.ok).toBe(false);
    expect(env.problems.length).toBeGreaterThan(0);
  });
});

describe('cli validate --json', () => {
  it('carries the verdict in ok/problems', async () => {
    const okEnv = JSON.parse((await dispatch(['validate', fixture(PASSING), '--json'])).stdout);
    expect(okEnv.ok).toBe(true);
    expect(okEnv.data.cellCount).toBeGreaterThan(0);

    const badEnv = JSON.parse(
      (await dispatch(['validate', fixture('cells:\n  - code: "1"'), '--json'])).stdout
    );
    expect(badEnv.ok).toBe(false);
    expect(badEnv.problems.length).toBeGreaterThan(0);
  });
});

describe('cli capabilities / templates', () => {
  it('capabilities --json reports features and cell types', async () => {
    const env = JSON.parse((await dispatch(['capabilities', '--json'])).stdout);
    expect(env.command).toBe('capabilities');
    expect(env.data.features.json).toBe(true);
    expect(env.data.cellTypes.supported).toContain('code');
  });

  it('templates --json lists a template that `new` accepts', async () => {
    const env = JSON.parse((await dispatch(['templates', '--json'])).stdout);
    const names = env.data.templates.map((t: { name: string }) => t.name);
    expect(names).toContain('basic');
  });
});

describe('cli graph has no --json', () => {
  it('returns a parseable envelope error (directing to describe) when --json is passed', async () => {
    const r = await dispatch(['graph', fixture(PASSING), '--json']);
    expect(r.exitCode).toBe(1);
    const env = JSON.parse(r.stdout);
    expect(env.command).toBe('graph');
    expect(env.ok).toBe(false);
    expect(env.problems.join(' ')).toContain('describe');
  });

  it('still emits human text without --json', async () => {
    const r = await dispatch(['graph', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('checkA: [a]');
  });
});

describe('cli envelope robustness', () => {
  it('describe does not crash on a circular output (YAML anchor) — still emits an envelope', async () => {
    const wb = 'cells:\n  - code: "1"\n    id: a\n    output: &o\n      r: *o';
    const r = await dispatch(['describe', fixture(wb), '--json']);
    let env: unknown;
    expect(() => {
      env = JSON.parse(r.stdout);
    }).not.toThrow();
    expect((env as { command: string }).command).toBe('describe');
    expect(JSON.stringify(env)).toContain('[Circular]');
  });

  it('every command advertised by capabilities is routable (no drift)', async () => {
    const env = JSON.parse((await dispatch(['capabilities', '--json'])).stdout);
    for (const name of env.data.commands as string[]) {
      if (name === 'serve') continue; // long-running stdio loop; covered by the serve smoke
      if (name === 'import') continue; // reads stdin with no args; covered by authoring tests
      // No extra arg → each command hits its own usage/output path, never the
      // "Unknown command" branch, and (importantly) `new` creates no file.
      const r = await dispatch([name]);
      expect(r.stderr).not.toContain('Unknown command');
    }
  });
});

describe('cli cell (mutation)', () => {
  const BASE = 'cells:\n  - code: "1"\n    id: a';
  const A_B = 'cells:\n  - code: "1"\n    id: a\n  - code: "a + 1"\n    id: b\n    depends_on: [a]';

  it('add appends a cell and writes the file', async () => {
    const p = fixture(BASE);
    const r = await dispatch(['cell', 'add', p, '--type', 'code', '--id', 'b', '--content', 'a + 1', '--depends-on', 'a', '--json']);
    expect(r.exitCode).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env.command).toBe('cell');
    expect(env.data.cells.map((c: { id: string }) => c.id)).toEqual(['a', 'b']);
    expect(readFileSync(p, 'utf-8')).toContain('id: b');
  });

  it('add reads content from --content-file', async () => {
    const p = fixture(BASE);
    const cf = join(dir, `content-${counter++}.txt`);
    writeFileSync(cf, 'a * 3', 'utf-8');
    const r = await dispatch(['cell', 'add', p, '--type', 'code', '--id', 'b', '--content-file', cf, '--depends-on', 'a']);
    expect(r.exitCode).toBe(0);
    expect(readFileSync(p, 'utf-8')).toContain('a * 3');
  });

  it('edit changes content', async () => {
    const p = fixture(BASE);
    const r = await dispatch(['cell', 'edit', p, 'a', '--content', '42']);
    expect(r.exitCode).toBe(0);
    expect(readFileSync(p, 'utf-8')).toContain('42');
  });

  it('rm refuses with dependents, --force detaches and reports changedCells', async () => {
    const p = fixture(A_B);
    const refused = await dispatch(['cell', 'rm', p, 'a', '--json']);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).problems.join(' ')).toMatch(/dependent/i);

    const forced = await dispatch(['cell', 'rm', p, 'a', '--force', '--json']);
    expect(forced.exitCode).toBe(0);
    expect(JSON.parse(forced.stdout).data.changedCells).toContain('b');
    expect(readFileSync(p, 'utf-8')).not.toContain('id: a');
  });

  it('rename updates dependents (edge + content) so the workbook still runs', async () => {
    const p = fixture(A_B); // b: content "a + 1", depends_on [a]
    const r = await dispatch(['cell', 'rename', p, 'a', 'alpha']);
    expect(r.exitCode).toBe(0);
    const after = readFileSync(p, 'utf-8');
    expect(after).toContain('id: alpha');
    expect(after).toContain('alpha + 1'); // by-id content reference rewritten
    expect(after).not.toMatch(/\ba \+ 1\b/);
    // and it still runs clean end-to-end
    const run = await dispatch(['run', p, '--json']);
    expect(JSON.parse(run.stdout).ok).toBe(true);
  });

  it('move reorders', async () => {
    const p = fixture('cells:\n  - code: "1"\n    id: a\n  - markdown: "x"\n    id: b');
    const r = await dispatch(['cell', 'move', p, 'b', '--at', '0', '--json']);
    expect(JSON.parse(r.stdout).data.cells.map((c: { id: string }) => c.id)).toEqual(['b', 'a']);
  });

  it('leaves the file byte-for-byte unchanged on an invalid op', async () => {
    const p = fixture(BASE);
    const before = readFileSync(p, 'utf-8');
    const r = await dispatch(['cell', 'add', p, '--type', 'code', '--id', 'a']); // duplicate id
    expect(r.exitCode).toBe(1);
    expect(readFileSync(p, 'utf-8')).toBe(before);
  });

  it('rejects a cycle-forming edit (file unchanged)', async () => {
    const p = fixture('cells:\n  - code: "b"\n    id: a\n    depends_on: [b]\n  - code: "1"\n    id: b');
    const before = readFileSync(p, 'utf-8');
    const r = await dispatch(['cell', 'edit', p, 'b', '--depends-on', 'a', '--json']);
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.stdout).problems.join(' ')).toMatch(/cycle/i);
    expect(readFileSync(p, 'utf-8')).toBe(before);
  });

  it('--dry-run previews without writing', async () => {
    const p = fixture(BASE);
    const before = readFileSync(p, 'utf-8');
    const r = await dispatch(['cell', 'add', p, '--type', 'code', '--id', 'b', '--content', '2', '--dry-run']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('id: b');
    expect(readFileSync(p, 'utf-8')).toBe(before);
  });

  it('rejects a non-integer --at', async () => {
    const p = fixture(BASE);
    const r = await dispatch(['cell', 'add', p, '--type', 'code', '--id', 'b', '--at', 'x', '--json']);
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.stdout).problems.join(' ')).toMatch(/--at/);
  });

  it('normalizes --depends-on (trims, drops empties, de-dups)', async () => {
    const p = fixture(BASE);
    const r = await dispatch(['cell', 'add', p, '--type', 'code', '--id', 'b', '--content', 'a', '--depends-on', 'a, ,a', '--json']);
    expect(r.exitCode).toBe(0);
    const b = JSON.parse(r.stdout).data.cells.find((c: { id: string }) => c.id === 'b');
    expect(b.dependsOn).toEqual(['a']);
  });

  it('errors when both --content and --content-file are given', async () => {
    const p = fixture(BASE);
    const r = await dispatch(['cell', 'edit', p, 'a', '--content', '1', '--content-file', 'x.txt', '--json']);
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.stdout).problems.join(' ').toLowerCase()).toContain('only one');
  });

  it('clears stale persisted output when a cell is edited', async () => {
    const p = fixture('cells:\n  - code: "1"\n    id: a\n    output: 1');
    await dispatch(['cell', 'edit', p, 'a', '--content', '999']);
    const after = readFileSync(p, 'utf-8');
    expect(after).toContain('999');
    expect(after).not.toContain('output');
  });
});

describe('cli functions / meta', () => {
  it('functions --json lists callable names + constants', async () => {
    const env = JSON.parse((await dispatch(['functions', '--json'])).stdout);
    expect(env.command).toBe('functions');
    expect(Array.isArray(env.data.functions)).toBe(true);
    expect(env.data.functions.length).toBeGreaterThan(0);
    expect(Array.isArray(env.data.constants)).toBe(true);
  });

  it('meta get returns workbook metadata', async () => {
    const p = fixture('metadata:\n  title: Hello\n  author: Ada\ncells:\n  - code: "1"\n    id: a');
    const env = JSON.parse((await dispatch(['meta', 'get', p, '--json'])).stdout);
    expect(env.data.title).toBe('Hello');
    expect(env.data.author).toBe('Ada');
  });

  it('meta set updates fields and writes the file', async () => {
    const p = fixture('cells:\n  - code: "1"\n    id: a');
    const r = await dispatch(['meta', 'set', p, '--title', 'New Title', '--tags', 'x, y', '--json']);
    expect(r.exitCode).toBe(0);
    const after = readFileSync(p, 'utf-8');
    expect(after).toContain('New Title');
    const env = JSON.parse(r.stdout);
    expect(env.data.title).toBe('New Title');
    expect(env.data.tags).toEqual(['x', 'y']);
  });

  it('meta set with no fields errors', async () => {
    const p = fixture('cells:\n  - code: "1"\n    id: a');
    const r = await dispatch(['meta', 'set', p, '--json']);
    expect(r.exitCode).toBe(1);
  });
});

describe('cli validate', () => {
  it('should report OK for a valid workbook', async () => {
    const r = await dispatch(['validate', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('OK');
  });

  it('should flag a missing id', async () => {
    const r = await dispatch(['validate', fixture('cells:\n  - code: "1"')]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('missing "id"');
  });

  it('should flag a dependency cycle', async () => {
    const wb =
      'cells:\n  - code: "b"\n    id: a\n    depends_on: [b]\n  - code: "a"\n    id: b\n    depends_on: [a]';
    const r = await dispatch(['validate', fixture(wb)]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toLowerCase()).toContain('cycle');
  });
});

describe('cli graph', () => {
  it('should emit a mermaid diagram with -f mermaid', async () => {
    const r = await dispatch(['graph', fixture(PASSING), '-f', 'mermaid']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/^graph TD/);
    expect(r.stdout).toContain('a --> checkA');
  });

  it('should emit a text adjacency by default', async () => {
    const r = await dispatch(['graph', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('checkA: [a]');
  });

  it('should accept the -f flag before the filename', async () => {
    const r = await dispatch(['graph', '-f', 'mermaid', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/^graph TD/);
  });
});

describe('cli run --write', () => {
  it('should persist outputs back into the file with --write', async () => {
    const path = fixture('cells:\n  - code: "2 + 3"\n    id: a');
    const before = readFileSync(path, 'utf-8');
    expect(before).not.toContain('output');

    const r = await dispatch(['run', path, '--write']);
    expect(r.exitCode).toBe(0);
    const after = readFileSync(path, 'utf-8');
    expect(after).toContain('output: 5');
    // stdout stays clean for pipelines; confirmation goes to stderr
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain(path);
  });

  it('should NOT modify the file without --write', async () => {
    const src = 'cells:\n  - code: "2 + 3"\n    id: a';
    const path = fixture(src);
    const r = await dispatch(['run', path]);
    expect(r.exitCode).toBe(0);
    expect(readFileSync(path, 'utf-8')).toBe(src);
  });
});

describe('cli strip', () => {
  const WITH_OUTPUTS = 'cells:\n  - code: "2 + 3"\n    id: a\n    output: 5';

  it('should strip outputs to stdout by default (file unchanged)', async () => {
    const path = fixture(WITH_OUTPUTS);
    const r = await dispatch(['strip', path]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('id: a');
    expect(r.stdout).not.toContain('output');
    expect(readFileSync(path, 'utf-8')).toBe(WITH_OUTPUTS); // unchanged
  });

  it('should rewrite the file in place with -w', async () => {
    const path = fixture(WITH_OUTPUTS);
    const r = await dispatch(['strip', path, '-w']);
    expect(r.exitCode).toBe(0);
    expect(readFileSync(path, 'utf-8')).not.toContain('output');
    expect(r.stderr).toContain(path);
  });
});

describe('cli new', () => {
  // Keep cwd === d for the WHOLE async operation (await inside the scope).
  async function inDir<T>(d: string, fn: () => Promise<T>): Promise<T> {
    const prev = process.cwd();
    process.chdir(d);
    try {
      return await fn();
    } finally {
      process.chdir(prev);
    }
  }

  it('should scaffold a runnable workbook', async () => {
    const created = await inDir(dir, () => dispatch(['new', 'demo']));
    expect(created.exitCode).toBe(0);
    const content = readFileSync(join(dir, 'demo.mtsw'), 'utf-8');
    expect(content).toContain('cells:');
    // the scaffold must itself parse + run clean
    const run = await inDir(dir, () => dispatch(['run', 'demo.mtsw']));
    expect(run.exitCode).toBe(0);
  });

  it('should refuse to overwrite an existing file without --force', async () => {
    await inDir(dir, () => dispatch(['new', 'dup']));
    const r = await inDir(dir, () => dispatch(['new', 'dup']));
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toLowerCase()).toContain('exists');
  });

  it('should reject a name containing path separators', async () => {
    const r = await inDir(dir, () => dispatch(['new', '../evil']));
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toLowerCase()).toMatch(/separator|invalid|name/);
  });

  it('should reject a name containing a colon (Windows drive-relative / ADS)', async () => {
    const r = await inDir(dir, () => dispatch(['new', 'C:evil']));
    expect(r.exitCode).toBe(1);
  });

  it('should reject dot-only names', async () => {
    const r = await inDir(dir, () => dispatch(['new', '..']));
    expect(r.exitCode).toBe(1);
  });

  it('should reject an unknown template', async () => {
    const r = await inDir(dir, () => dispatch(['new', 'demo2', '-t', 'nope']));
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toLowerCase()).toContain('template');
  });
});
