#!/usr/bin/env node
/**
 * Writes `functions/tests/fixtures/fourjs-parity.json`: inputs and outputs of the
 * fourJS `Matrix4` and `Frustum` methods that the mat4 and frustum kernels transcribe.
 * `functions/tests/mat4-fourjs-parity.test.ts` compares the kernels with it bit for bit.
 *
 * Run by hand, with Node, against a fourJS checkout whose math package is built
 * (`bun run build` in `packages/math`). CI never runs it; the fixture is committed, and
 * the test needs no fourJS:
 *
 *   node functions/scripts/gen-fourjs-parity.mjs --fourjs <path to the fourJS checkout>
 *
 * Use Node, the engine that runs the test: `Math.tan` differs by one ulp between V8
 * and JavaScriptCore (Bun) for some inputs, so a fixture made under Bun fails on Node.
 *
 * Every float64 is written as 16 hex digits of its bits, because JSON cannot hold
 * Infinity, NaN or -0.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SEED = 0x381;
const COUNT = 24;

const at = process.argv.indexOf('--fourjs');
const fourjs = at >= 0 ? process.argv[at + 1] : undefined;
if (!fourjs) {
  console.error('usage: node functions/scripts/gen-fourjs-parity.mjs --fourjs <fourJS checkout>');
  process.exit(2);
}
const { Matrix4, Frustum, Quaternion, Vector3 } = await import(
  pathToFileURL(join(fourjs, 'packages', 'math', 'dist', 'index.js')).href
);
const sha = execFileSync('git', ['-C', fourjs, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const view = new DataView(new ArrayBuffer(8));
/** float64 → 16 hex digits of its bits, big-endian. */
function hex(x) {
  view.setFloat64(0, x);
  return (
    view.getUint32(0).toString(16).padStart(8, '0') +
    view.getUint32(4).toString(16).padStart(8, '0')
  );
}
const hexes = (xs) => Array.from(xs, hex);

/** mulberry32: a seeded PRNG, so the fixture is reproducible. */
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const uni = (lo, hi) => lo + (hi - lo) * rnd();
/** Non-zero in magnitude, so compose with a zero pivot gives the position bits back. */
const nz = (lo, hi) => {
  const v = uni(lo, hi);
  return v === 0 ? 0.5 : v;
};
function unitQuat() {
  const x = uni(-1, 1);
  const y = uni(-1, 1);
  const z = uni(-1, 1);
  const w = uni(-1, 1);
  const n = Math.hypot(x, y, z, w);
  return new Quaternion(x / n, y / n, z / n, w / n);
}
function randomMatrix() {
  const m = new Matrix4();
  for (let i = 0; i < 16; i++) m.elements[i] = uni(-3, 3);
  return m;
}
function trs() {
  const p = new Vector3(nz(-20, 20), nz(-20, 20), nz(-20, 20));
  const q = unitQuat();
  const s = new Vector3(uni(0.1, 4), uni(0.1, 4), uni(0.1, 4));
  return { p, q, s };
}
/** MathTS quaternion order `[w, x, y, z]`. */
const quatWxyz = (q) => [q.w, q.x, q.y, q.z];
const DEPTHS = ['negative-one-to-one', 'zero-to-one'];

const fixture = {
  generator: 'functions/scripts/gen-fourjs-parity.mjs',
  fourjsCommit: sha,
  engine: `node ${process.versions.node}`,
  seed: SEED,
  multiply: [],
  invert: [],
  compose: [],
  decompose: [],
  perspective: [],
  orthographic: [],
  frustum: [],
};

for (let k = 0; k < COUNT; k++) {
  const a = randomMatrix();
  const b = randomMatrix();
  const ab = new Matrix4().copy(a).multiply(b);
  fixture.multiply.push({ a: hexes(a.elements), b: hexes(b.elements), out: hexes(ab.elements) });

  let m = randomMatrix();
  while (Math.abs(m.determinant()) <= 1e-6) m = randomMatrix();
  const det = m.determinant();
  const inv = new Matrix4().copy(m).invert();
  fixture.invert.push({ m: hexes(m.elements), det: hex(det), out: hexes(inv.elements) });

  const { p, q, s } = trs();
  const c = new Matrix4().compose(p, q, s, new Vector3(0, 0, 0));
  fixture.compose.push({
    position: hexes([p.x, p.y, p.z]),
    rotation: hexes(quatWxyz(q)),
    scale: hexes([s.x, s.y, s.z]),
    out: hexes(c.elements),
  });

  const op = new Vector3();
  const oq = new Quaternion();
  const os = new Vector3();
  c.decompose(op, oq, os);
  fixture.decompose.push({
    m: hexes(c.elements),
    position: hexes([op.x, op.y, op.z]),
    rotation: hexes(quatWxyz(oq)),
    scale: hexes([os.x, os.y, os.z]),
  });

  for (const depthRange of DEPTHS) {
    const fovY = uni(0.2, 2.8);
    const aspect = uni(0.3, 3);
    const near = uni(0.01, 2);
    const far = near + uni(1, 1000);
    const pm = new Matrix4().setPerspective(fovY, aspect, near, far, depthRange);
    fixture.perspective.push({
      args: hexes([fovY, aspect, near, far]),
      depthRange,
      out: hexes(pm.elements),
    });

    const symmetric = k % 2 === 0;
    const w = uni(0.5, 50);
    const h = uni(0.5, 50);
    const left = symmetric ? -w : uni(-50, 10);
    const right = symmetric ? w : left + w;
    const bottom = symmetric ? -h : uni(-50, 10);
    const top = symmetric ? h : bottom + h;
    const on = uni(-5, 5);
    const of = on + uni(1, 500);
    const om = new Matrix4().setOrthographic(left, right, bottom, top, on, of, depthRange);
    fixture.orthographic.push({
      args: hexes([left, right, bottom, top, on, of]),
      depthRange,
      out: hexes(om.elements),
    });

    // View-projection: the projection times the inverse of a random camera transform.
    const cam = trs();
    const world = new Matrix4().compose(cam.p, cam.q, new Vector3(1, 1, 1), new Vector3(0, 0, 0));
    const viewM = new Matrix4().copy(world).invert();
    const proj = k % 3 === 0 ? om : pm;
    const vp = new Matrix4().copy(proj).multiply(viewM);
    const fr = new Frustum().setFromViewProjection(vp, depthRange);
    // Probes: random points, spheres and boxes around the camera, so some fall inside,
    // some straddle a plane and some fall outside.
    const probes = [];
    for (let j = 0; j < 18; j++) {
      const reach = j < 6 ? 2 : j < 12 ? 20 : 400;
      const ctr = new Vector3(
        cam.p.x + uni(-reach, reach),
        cam.p.y + uni(-reach, reach),
        cam.p.z + uni(-reach, reach)
      );
      const r = uni(0, reach / 4);
      const half = new Vector3(uni(0, reach / 4), uni(0, reach / 4), uni(0, reach / 4));
      const min = new Vector3(ctr.x - half.x, ctr.y - half.y, ctr.z - half.z);
      const max = new Vector3(ctr.x + half.x, ctr.y + half.y, ctr.z + half.z);
      probes.push({
        point: hexes([ctr.x, ctr.y, ctr.z]),
        radius: hex(r),
        min: hexes([min.x, min.y, min.z]),
        max: hexes([max.x, max.y, max.z]),
        containsPoint: fr.containsPoint(ctr),
        intersectsSphere: fr.intersectsSphere(ctr, r),
        intersectsBox: fr.intersectsBox(min, max),
      });
    }
    fixture.frustum.push({ m: hexes(vp.elements), depthRange, planes: hexes(fr.planes), probes });
  }
}

// Degenerate matrices: the all-zero matrix gives the everything-inside plane in all six slots.
const zero = new Matrix4();
zero.elements.fill(0);
for (const depthRange of DEPTHS) {
  const fr = new Frustum().setFromViewProjection(zero, depthRange);
  fixture.frustum.push({
    m: hexes(zero.elements),
    depthRange,
    planes: hexes(fr.planes),
    probes: [],
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'tests', 'fixtures', 'fourjs-parity.json');
writeFileSync(out, JSON.stringify(fixture) + '\n');
const counts = Object.entries(fixture)
  .filter(([, v]) => Array.isArray(v))
  .map(([k, v]) => `${k} ${v.length}`)
  .join(', ');
console.log(`wrote ${out}: ${counts}`);
