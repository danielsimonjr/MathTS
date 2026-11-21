/**
 * Isolated Node gate for #1283: `Complex.parse` takes time that grows in step with the length of
 * the text.
 *
 * The text is a run of digits, a run of white space and one digit. The baseline arm parses it with
 * SMALL characters in each run, and the candidate arm with ten times as many. Both texts are not a
 * number, so the parse throws a SyntaxError after it has read them. A parse that is linear in the
 * length gives a ratio near 10. Two patterns gave a ratio near 100. The first was a look-behind
 * and a look-ahead on a `\s+` run: the run was tested again from every start inside it. The second
 * was `\d+\.?\d*` before an exponent: two adjacent digit quantifiers split the digit run in every
 * way. Either pattern alone makes the ratio quadratic. The ratio does not depend on the speed of
 * the machine.
 * Limit and round counts: tools/test/wall-clock-gates.json ("complex-parse-linear").
 * stdout: one JSON line, see reportGate.
 */
import { Complex } from '@danielsimonjr/mathts-core';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('complex-parse-linear');
const SMALL = 4000;
const LARGE = 10 * SMALL;
const text = (n) => '1'.repeat(n) + ' '.repeat(n) + '1';
const small = text(SMALL);
const large = text(LARGE);

/** Parses `text` and reports whether the parse threw the SyntaxError of mathjs (the expected result). */
function parseThrowsSyntaxError(text) {
  try {
    Complex.parse(text);
    return false;
  } catch (error) {
    return error instanceof SyntaxError;
  }
}

const result = wallClockAbGate(
  () => parseThrowsSyntaxError(small),
  () => parseThrowsSyntaxError(large),
  gate
);

reportGate(gate, result, {
  parity: parseThrowsSyntaxError(small) && parseThrowsSyntaxError(large),
});
