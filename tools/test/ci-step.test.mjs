import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ciStepProblem } from './ci-step.mjs';

const CMD = 'node tools/test/x.mjs';
const job = (steps) => `jobs:\n  compile:\n    steps:\n${steps}\n  test:\n    steps: []\n`;

test('a step that runs the command is a gate, inline or in a block', () => {
  assert.equal(ciStepProblem(CMD, job(`      - name: X\n        run: ${CMD}`)), null);
  assert.equal(ciStepProblem(CMD, job(`      - name: X\n        run: |\n          ${CMD}`)), null);
});

test('control: an absent or commented-out command is reported', () => {
  assert.match(ciStepProblem(CMD, job('      - name: X\n        run: true')), /does not run/);
  assert.match(ciStepProblem(CMD, job(`      - name: X\n        # run: ${CMD}`)), /does not run/);
  assert.match(
    ciStepProblem(CMD, job(`      - name: X\n        run: ${CMD} --flag`)),
    /does not run/
  );
});

test('control: a step with continue-on-error or an if is reported', () => {
  const soft = `      - name: X\n        continue-on-error: true\n        run: ${CMD}`;
  assert.match(ciStepProblem(CMD, job(soft)), /cannot fail/);
  const gated = `      - name: X\n        if: false\n        run: ${CMD}`;
  assert.match(ciStepProblem(CMD, job(gated)), /cannot fail/);
});

test('docs-only CI gate if is allowed', () => {
  const steps = `      - name: X\n        if: needs.changes.outputs.docs_only != 'true'\n        run: ${CMD}`;
  assert.equal(ciStepProblem(CMD, job(steps)), null);
});

test('a flag of the next step is not read as a flag of this step', () => {
  const steps = `      - name: X\n        run: ${CMD}\n      - name: Y\n        if: false\n        run: true`;
  assert.equal(ciStepProblem(CMD, job(steps)), null);
});
