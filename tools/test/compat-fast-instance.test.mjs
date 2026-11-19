// Fast-mode check for the compat instance (#1200).
// Run: node --allow-natives-syntax tools/test/compat-fast-instance.test.mjs (after the compat build).
// V8 keeps an object in fast mode only up to 1020 own properties. compat `create` keeps the
// mathjs-parity names on the instance and the other names on prototype levels. This test
// pins %HasFastProperties on the instance and on every level, and the size cap of each level,
// so that a growing surface cannot silently put the instance back in dictionary mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { create, all } = await import(pathToFileURL(join(ROOT, 'compat/dist/index.js')).href);

// The cap has one source: compat/src/instance-layout.ts.
const layoutSource = readFileSync(join(ROOT, 'compat/src/instance-layout.ts'), 'utf8');
const capMatch = /export const PROTOTYPE_LEVEL_CAP = (\d+);/.exec(layoutSource);
assert.ok(capMatch, 'PROTOTYPE_LEVEL_CAP not found in compat/src/instance-layout.ts');
const CAP = Number(capMatch[1]);

/** V8's limit: an object with more own properties is in dictionary mode. */
const V8_FAST_LIMIT = 1020;

const isFast = new Function('o', 'return %HasFastProperties(o);');

/** The instance and each prototype level, above Object.prototype. */
function objectsOf(math) {
  const objects = [];
  for (let o = math; o !== null && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    objects.push(o);
  }
  return objects;
}

function assertFast(math, phase) {
  const objects = objectsOf(math);
  assert.ok(objects.length >= 2, 'expected prototype levels below the instance');
  objects.forEach((o, i) => {
    const size = Object.getOwnPropertyNames(o).length;
    assert.ok(size <= CAP, `${phase}: object ${i} has ${size} names, cap ${CAP}`);
    assert.ok(size <= V8_FAST_LIMIT, `${phase}: object ${i} has ${size} names`);
    assert.equal(isFast(o), true, `${phase}: object ${i} (${size} names) is in dictionary mode`);
  });
}

function allNames(math) {
  const names = [];
  for (const key in math) names.push(key);
  return names;
}

test('every object of the instance chain is fast after create, touch, import and config', () => {
  const math = create(all);
  assertFast(math, 'after create');
  const ownBefore = Object.keys(math).length;
  for (const key of allNames(math)) void math[key];
  assertFast(math, 'after touching every name');
  assert.equal(Object.keys(math).length, ownBefore, 'own key count changed by reads');
  math.import({ compatFastInstanceNewName: (x) => x });
  assertFast(math, 'after import');
  assert.equal(math.compatFastInstanceNewName(3), 3);
  math.config({ precision: 20 });
  assertFast(math, 'after config');
});

test('inherited names behave as names of the instance', () => {
  const math = create(all);
  const inherited = allNames(math).find(
    (key) => !Object.hasOwn(math, key) && typeof math[key] === 'function'
  );
  assert.ok(inherited, 'expected an inherited function name');
  assert.equal(inherited in math, true);
  const own = Object.keys(math).length;
  const replacement = () => 'replaced';
  math[inherited] = replacement; // ES modules are strict: a failed assignment throws
  assert.equal(math[inherited], replacement);
  assert.equal(Object.keys(math).length, own, 'assignment of an inherited name added an own key');
  const frozen = Object.freeze(create(all));
  assert.equal(typeof frozen.det, 'function');
  assert.equal(frozen.det, frozen.det);
  assert.equal(frozen.add(1, 2), 3);
  assert.equal(typeof frozen.integrate, 'function');
  assert.equal(frozen.integrate, frozen.integrate);
  assert.throws(() => {
    frozen.integrate = replacement;
  }, TypeError);
  assert.throws(() => {
    frozen.det = replacement;
  }, TypeError);
});
