import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMissingEdges } from './check-typecheck-graph.mjs';

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
