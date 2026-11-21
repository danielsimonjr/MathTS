import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  findMissingEdges,
  findMissingInputEdges,
  readTestInputs,
  workspaceInputs,
} from './check-typecheck-graph.mjs';
import { makeScratch } from './consumer-env.mjs';

const EXPRESSION = '@danielsimonjr/mathts-expression';
const FUNCTIONS = '@danielsimonjr/mathts-functions';
const MATRIX = '@danielsimonjr/mathts-matrix';

const packages = [
  { name: EXPRESSION, scripts: { build: 'x', typecheck: 'x' } },
  { name: FUNCTIONS, scripts: { build: 'x', typecheck: 'x' } },
  { name: MATRIX, scripts: { build: 'x', typecheck: 'x' } },
];

/** A sound graph: every typecheck waits for its own build, expression also for matrix and functions. */
const sound = () => [
  {
    taskId: `${EXPRESSION}#typecheck`,
    dependencies: [`${EXPRESSION}#build`, `${MATRIX}#build`, `${FUNCTIONS}#build`],
  },
  { taskId: `${FUNCTIONS}#typecheck`, dependencies: [`${FUNCTIONS}#build`, `${MATRIX}#build`] },
  { taskId: `${MATRIX}#typecheck`, dependencies: [`${MATRIX}#build`] },
];

test('a graph with every edge has no problem', () => {
  assert.deepEqual(findMissingEdges(sound(), packages), []);
});

test('control: a typecheck that does not wait for its own build is reported', () => {
  const tasks = sound();
  tasks[1].dependencies = [`${MATRIX}#build`]; // functions#typecheck loses functions#build
  assert.deepEqual(findMissingEdges(tasks, packages), [
    `${FUNCTIONS}#typecheck does not wait for ${FUNCTIONS}#build`,
  ]);
});

test('control: expression that does not wait for the matrix and functions builds is reported', () => {
  const tasks = sound();
  tasks[0].dependencies = [`${EXPRESSION}#build`];
  assert.deepEqual(findMissingEdges(tasks, packages), [
    `${EXPRESSION}#typecheck does not wait for ${MATRIX}#build`,
    `${EXPRESSION}#typecheck does not wait for ${FUNCTIONS}#build`,
  ]);
});

test('control: a package with a typecheck script and no task is reported', () => {
  const tasks = sound().slice(0, 2);
  assert.deepEqual(findMissingEdges(tasks, packages), [
    `${MATRIX}#typecheck is not in the task graph`,
  ]);
});

test('a package without a build script owes no build edge', () => {
  const tasks = [{ taskId: `${MATRIX}#typecheck`, dependencies: [] }];
  const only = [{ name: MATRIX, scripts: { typecheck: 'x' } }];
  assert.deepEqual(findMissingEdges(tasks, only, {}), []);
});

test('control: a cross-package entry whose task is absent is reported, not skipped', () => {
  const tasks = sound().slice(1); // expression#typecheck is gone
  const noExpression = packages.slice(1);
  assert.deepEqual(findMissingEdges(tasks, noExpression), [
    `${EXPRESSION}#typecheck is not in the task graph`,
  ]);
});

// ---- test inputs: the builds that a package's tests and typecheck read ----

const UNITS = '@danielsimonjr/mathts-units';
const CORE = '@danielsimonjr/mathts-core';
const COMPAT = '@danielsimonjr/mathts-compat';
const WORKERPOOL = '@danielsimonjr/mathts-workerpool';

const workspace = [
  { name: CORE, dir: 'core' },
  { name: UNITS, dir: 'units' },
  { name: FUNCTIONS, dir: 'functions' },
  { name: COMPAT, dir: 'compat' },
  { name: WORKERPOOL, dir: 'packages/workerpool' },
];

test('workspaceInputs finds a static import', () => {
  assert.deepEqual(workspaceInputs(`import { Unit } from '${UNITS}';`, workspace), [UNITS]);
});

test('workspaceInputs finds a dynamic import and a require with double quotes', () => {
  const text = `const m = await import("${FUNCTIONS}");\nconst c = require("${CORE}");`;
  assert.deepEqual(workspaceInputs(text, workspace), [CORE, FUNCTIONS]);
});

test('workspaceInputs finds a subpath specifier', () => {
  assert.deepEqual(workspaceInputs(`import x from '${CORE}/internal';`, workspace), [CORE]);
});

test('workspaceInputs finds a tsconfig paths key', () => {
  const text = `{ "paths": { "${COMPAT}": ["./stub.d.ts"] } }`;
  assert.deepEqual(workspaceInputs(text, workspace), [COMPAT]);
});

test('workspaceInputs finds a dist path of a workspace folder', () => {
  const text = `"@x/y": ["../../../units/dist/index.d.ts"], "z": ["packages/workerpool/dist/a.js"]`;
  assert.deepEqual(workspaceInputs(text, workspace), [UNITS, WORKERPOOL]);
});

test('control: a name in a comment, a test title or a prefix is not an input', () => {
  // The shape of core/tests/dist-public-api.test.ts: the package is named in a doc comment with
  // backticks and in a test title, and the test imports only its own dist.
  const text = [
    ' * and was not rebuilt before publish. Downstream `@danielsimonjr/mathts-functions`',
    ' * imports `Unit` from core, so consumers hit `Unit is undefined` at runtime.',
    "it('exposes the runtime API that mathts-functions consumes', () => {",
    "import * as publicApi from '../dist/index.js';",
    "import x from '@danielsimonjr/mathts-units-extra';",
    "const p = '../../node_modules/workerpool/dist/index.js';",
    "const q = '../broadcore/dist/a.js';",
  ].join('\n');
  assert.deepEqual(workspaceInputs(text, workspace), []);
});

test('readTestInputs reads the tests folders, skips build output, drops the own name', () => {
  const root = makeScratch('mathts-inputs-');
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put('functions/tests/b.test.ts', `import '${UNITS}'; import '${FUNCTIONS}';`);
  put('functions/tests/a.test.ts', `import '${UNITS}';`);
  put('functions/tests/notes.md', `import '${COMPAT}';`);
  put('functions/tests/node_modules/x/index.js', `import '${COMPAT}';`);
  put('functions/tests/coverage/c.json', `"${COMPAT}"`);
  put('units/tests/u.test.ts', `import '${CORE}';`);
  const found = readTestInputs(workspace, root);
  // The result follows the order of `workspace`: units comes before functions.
  assert.deepEqual(found, [
    { name: UNITS, inputs: new Map([[CORE, 'units/tests/u.test.ts']]) },
    { name: FUNCTIONS, inputs: new Map([[UNITS, 'functions/tests/a.test.ts']]) },
  ]);
});

const typed = (name, extra = {}) => ({
  name,
  scripts: { build: 'x', test: 'x', 'test:coverage': 'x', typecheck: 'x' },
  hasTestTsconfig: true,
  ...extra,
});
const withInputs = [{ name: FUNCTIONS, inputs: new Map([[UNITS, 'functions/tests/g33.test.ts']]) }];
const inputPackages = () => [typed(FUNCTIONS), typed(UNITS), typed(COMPAT)];
const task = (taskId, dependencies) => ({ taskId, dependencies });
/** A graph in which functions waits for units, and the units build exists. */
const soundInputs = () => [
  task(`${UNITS}#build`, []),
  task(`${COMPAT}#build`, [`${UNITS}#build`]),
  task(`${FUNCTIONS}#test`, [`${UNITS}#build`]),
  task(`${FUNCTIONS}#test:coverage`, [`${UNITS}#build`]),
  task(`${FUNCTIONS}#typecheck`, [`${UNITS}#build`]),
  task(`${UNITS}#test`, []),
  task(`${UNITS}#test:coverage`, []),
  task(`${UNITS}#typecheck`, []),
  task(`${COMPAT}#test`, []),
  task(`${COMPAT}#test:coverage`, []),
  task(`${COMPAT}#typecheck`, []),
];

test('findMissingInputEdges accepts a graph in which every read build is awaited', () => {
  assert.deepEqual(findMissingInputEdges(soundInputs(), inputPackages(), withInputs), []);
});

test('control: a test task that does not wait for a build its tests read is reported', () => {
  const tasks = soundInputs();
  tasks[2].dependencies = []; // functions#test loses units#build
  assert.deepEqual(findMissingInputEdges(tasks, inputPackages(), withInputs), [
    `${FUNCTIONS}#test does not wait for ${UNITS}#build (read by functions/tests/g33.test.ts)`,
  ]);
});

test('control: test, test:coverage and typecheck are each reported', () => {
  const tasks = soundInputs();
  for (const t of tasks) if (t.taskId.startsWith(`${FUNCTIONS}#`)) t.dependencies = [];
  assert.deepEqual(findMissingInputEdges(tasks, inputPackages(), withInputs), [
    `${FUNCTIONS}#test does not wait for ${UNITS}#build (read by functions/tests/g33.test.ts)`,
    `${FUNCTIONS}#test:coverage does not wait for ${UNITS}#build (read by functions/tests/g33.test.ts)`,
    `${FUNCTIONS}#typecheck does not wait for ${UNITS}#build (read by functions/tests/g33.test.ts)`,
  ]);
});

test('findMissingInputEdges accepts a transitive edge', () => {
  const tasks = soundInputs();
  tasks[2].dependencies = [`${COMPAT}#build`]; // compat#build waits for units#build
  assert.deepEqual(findMissingInputEdges(tasks, inputPackages(), withInputs), []);
});

test('control: a task that is absent from the graph is reported, not skipped', () => {
  const tasks = soundInputs().filter((t) => t.taskId !== `${FUNCTIONS}#test:coverage`);
  assert.deepEqual(findMissingInputEdges(tasks, inputPackages(), withInputs), [
    `${FUNCTIONS}#test:coverage is not in the task graph`,
  ]);
});

test('a package with no tsconfig.test.json owes no typecheck edge, and no script no task', () => {
  const tasks = soundInputs().filter((t) => t.taskId !== `${FUNCTIONS}#typecheck`);
  const packages = inputPackages();
  packages[0] = typed(FUNCTIONS, { hasTestTsconfig: false });
  assert.deepEqual(findMissingInputEdges(tasks, packages, withInputs), []);
  const noCoverage = soundInputs().filter((t) => t.taskId !== `${FUNCTIONS}#test:coverage`);
  packages[0] = typed(FUNCTIONS, { scripts: { build: 'x', test: 'x', typecheck: 'x' } });
  assert.deepEqual(findMissingInputEdges(noCoverage, packages, withInputs), []);
});

test('an input package without a build script owes no build edge', () => {
  const tasks = soundInputs();
  tasks[2].dependencies = [];
  const packages = inputPackages();
  packages[1] = typed(UNITS, { scripts: { test: 'x' } });
  assert.deepEqual(findMissingInputEdges(tasks, packages, withInputs), []);
});
