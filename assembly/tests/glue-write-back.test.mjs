/**
 * Output arguments of the generated ESM glue (#1026).
 *
 * `asc --bindings esm` lowers every typed-array argument into a new buffer in wasm memory and
 * never copies it back. `scripts/patch-glue.mjs` rewrites the glue so that a parameter that the
 * kernel is contracted to write (an `out` row of `OUTPUT_PARAMS`) is copied back to the caller
 * after the call, and so that the debug glue throws when a kernel writes an `in` parameter.
 *
 * Part 1 calls the built glue (release and debug). Part 2 runs `patchGlue` on a stub glue with a
 * fake kernel object, so it can check the error paths and a memory growth during the call.
 *
 * Plain asserts, no framework: the test runs with `node` and with `bun`.
 */
import assert from 'node:assert/strict';
import * as release from '../build/mathts.js';
import * as debug from '../build/mathts-debug.js';
import { OUTPUT_PARAMS, patchGlue } from '../scripts/patch-glue.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(
      `FAIL ${name}\n     ${String(error?.message ?? error)
        .split('\n')
        .join('\n     ')}`
    );
  }
}
const near = (actual, expected, tol = 1e-12) => {
  assert.equal(actual.length, expected.length, `length ${actual.length} vs ${expected.length}`);
  for (let i = 0; i < expected.length; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) <= tol,
      `index ${i}: ${actual[i]} vs ${expected[i]}`
    );
  }
};
const f64 = (...v) => Float64Array.from(v);
const zeros = (n) => new Float64Array(n);

// ---------------------------------------------------------------------------------------------
// Part 1: the built glue
// ---------------------------------------------------------------------------------------------
for (const [label, wasm] of [
  ['release', release],
  ['debug', debug],
]) {
  const t = (name, fn) => test(`${label}: ${name}`, fn);

  t('matrix_multiply writes the product into result', () => {
    const c = zeros(4);
    wasm.matrix_multiply(f64(1, 2, 3, 4), 2, 2, f64(5, 6, 7, 8), 2, c);
    near(c, [19, 22, 43, 50]);
  });

  t('matrix_transpose writes a 2x3 transpose', () => {
    const out = zeros(6);
    wasm.matrix_transpose(f64(1, 2, 3, 4, 5, 6), 2, 3, out);
    near(out, [1, 4, 2, 5, 3, 6]);
  });

  t('matrix_vector_multiply writes result', () => {
    const out = zeros(2);
    wasm.matrix_vector_multiply(f64(1, 2, 3, 4), 2, 2, f64(1, 1), out);
    near(out, [3, 7]);
  });

  t('matrix_gemv reads and writes y (beta = 1)', () => {
    const y = f64(10, 20);
    wasm.matrix_gemv(1, f64(1, 2, 3, 4), 2, 2, f64(1, 1), 1, y);
    near(y, [13, 27]);
    const y0 = zeros(2);
    wasm.matrix_gemv(1, f64(1, 2, 3, 4), 2, 2, f64(1, 1), 0, y0);
    near(y0, [3, 7]);
  });

  t('matrix_inverse writes result and the scratch work buffer', () => {
    const res = zeros(4);
    const work = zeros(6);
    const status = wasm.matrix_inverse(f64(4, 7, 2, 6), 2, res, work);
    assert.equal(status, 0);
    near(res, [0.6, -0.7, -0.2, 0.4], 1e-15);
  });

  t('matrix_cholesky writes l_out', () => {
    const l = zeros(4);
    const status = wasm.matrix_cholesky(f64(4, 2, 2, 3), 2, l);
    assert.equal(status, 0);
    near(l, [2, 0, 1, Math.SQRT2], 1e-15);
  });

  t('matrix_lu_decompose writes l_out, u_out and the Int32Array perm_out', () => {
    const l = zeros(4);
    const u = zeros(4);
    const perm = new Int32Array(2);
    wasm.matrix_lu_decompose(f64(4, 3, 6, 3), 2, l, u, perm);
    near(u, [6, 3, 0, 1], 1e-15);
    near(l, [1, 0, 2 / 3, 1], 1e-15);
    assert.deepEqual(Array.from(perm), [1, 0]);
  });

  t('matrix_qr_decompose writes q_out and r_out; the nullable v_work may be omitted', () => {
    const a = f64(3, 1, 4, 2);
    const q = zeros(4);
    const r = zeros(4);
    wasm.matrix_qr_decompose(a, 2, 2, q, r);
    // The kernel returns Q transposed: A = qT * r.
    const qt = [q[0], q[2], q[1], q[3]];
    const back = [
      qt[0] * r[0] + qt[1] * r[2],
      qt[0] * r[1] + qt[1] * r[3],
      qt[2] * r[0] + qt[3] * r[2],
      qt[2] * r[1] + qt[3] * r[3],
    ];
    near(back, [3, 1, 4, 2], 1e-14);
    assert.equal(r[2], 0, 'below the diagonal');
    const q2 = zeros(4);
    const r2 = zeros(4);
    wasm.matrix_qr_decompose(a, 2, 2, q2, r2, zeros(2));
    near(q2, q, 0);
    near(r2, r, 0);
  });

  t('rfft writes the interleaved spectrum into result', () => {
    const result = zeros(8);
    wasm.rfft(f64(1, 2, 3, 4), 4, result);
    near(result, [10, 0, -2, 2, -2, 0, -2, -2]);
  });

  t('fft transforms data in place', () => {
    const data = f64(1, 0, 2, 0, 3, 0, 4, 0);
    wasm.fft(data, 4, 0);
    near(data, [10, 0, -2, 2, -2, 0, -2, -2]);
  });

  t('in-place array and matrix kernels write their argument', () => {
    const a = f64(1, 2, 3);
    wasm.array_scale_inplace(a, 2);
    near(a, [2, 4, 6]);
    const b = f64(1, 2, 3);
    wasm.array_add_inplace(b, f64(10, 20, 30));
    near(b, [11, 22, 33]);
    const m = f64(1, 2, 3, 4);
    wasm.matrix_add_inplace(m, f64(1, 1, 1, 1));
    near(m, [2, 3, 4, 5]);
    const c = f64(-5, 0.5, 9);
    wasm.array_clamp_inplace(c, 0, 1);
    near(c, [0, 0.5, 1]);
    const y = f64(10, 10, 10);
    wasm.matrix_axpy(2, f64(1, 2, 3), y);
    near(y, [12, 14, 16]);
    const s = zeros(4);
    wasm.matrix_set(s, 2, 1, 0, 7);
    near(s, [0, 0, 7, 0]);
  });

  t('apply_window_f64 and sort_f64 write their argument in place', () => {
    const w = f64(1, 1, 1, 1, 1);
    assert.equal(wasm.apply_window_f64(w, 0), 0);
    near(w, [0, 0.5, 1, 0.5, 0], 1e-15);
    const s = f64(3, 1, 2);
    near(wasm.sort_f64(s), [1, 2, 3]);
    near(s, [1, 2, 3]);
  });

  t('an Int32Array output is written back', () => {
    const out = new Int32Array(2);
    wasm.bitAnd_i32_array(Int32Array.from([12, 10]), Int32Array.from([10, 6]), out);
    assert.deepEqual(Array.from(out), [8, 2]);
  });

  t('an input parameter is bit-equal after the call', () => {
    const a = f64(1, -0, 3, 4);
    const b = f64(5, 6, 7, NaN);
    const before = [Array.from(a), Array.from(b)];
    wasm.matrix_multiply(a, 2, 2, b, 2, zeros(4));
    for (const [i, arr] of [a, b].entries()) {
      arr.forEach((v, j) => assert.ok(Object.is(v, before[i][j]), `input ${i}[${j}] changed`));
    }
  });

  t('a plain Array works as an input and as an output', () => {
    const a = [1, 2, 3, 4];
    const b = [5, 6, 7, 8];
    const c = [0, 0, 0, 0];
    wasm.matrix_multiply(a, 2, 2, b, 2, c);
    assert.deepEqual(c, [19, 22, 43, 50]);
    assert.deepEqual(a, [1, 2, 3, 4]);
    assert.deepEqual(b, [5, 6, 7, 8]);
  });

  t('a failed call copies nothing, now or in a later call', () => {
    const out = f64(7, 7);
    assert.throws(() => wasm.array_add(f64(1, 2), null, out), TypeError);
    assert.deepEqual(Array.from(out), [7, 7]);
    const other = zeros(2);
    wasm.array_scale(f64(1, 2), 3, other);
    near(other, [3, 6]);
    assert.deepEqual(Array.from(out), [7, 7], 'stale output of the failed call');
  });

  t('two calls in a row each write their own output', () => {
    const first = zeros(2);
    const second = zeros(2);
    wasm.array_scale(f64(1, 2), 2, first);
    wasm.array_scale(f64(1, 2), 5, second);
    near(first, [2, 4]);
    near(second, [5, 10]);
  });
}

// ---------------------------------------------------------------------------------------------
// Part 2: patchGlue on a stub glue and a fake kernel object
// ---------------------------------------------------------------------------------------------
const STUB = `
  const adaptedExports = Object.setPrototypeOf({
    kern(a, b, k) {
      // src/x/kern(~lib/typedarray/Float64Array, ~lib/typedarray/Float64Array, f64) => void
      a = __retain(__lowerTypedArray(Float64Array, 5, 3, a) || __notnull());
      b = __lowerTypedArray(Float64Array, 5, 3, b) || __notnull();
      try {
        exports.kern(a, b, k);
      } finally {
        __release(a);
      }
    },
    total(a) {
      // src/x/total(~lib/typedarray/Float64Array) => f64
      a = __lowerTypedArray(Float64Array, 5, 3, a) || __notnull();
      return exports.total(a);
    },
    maybe(a, w) {
      // src/x/maybe(~lib/typedarray/Float64Array, ~lib/typedarray/Float64Array | null) => i32
      a = __retain(__lowerTypedArray(Float64Array, 5, 3, a) || __notnull());
      w = __lowerTypedArray(Float64Array, 5, 3, w);
      try {
        return exports.maybe(a, w);
      } finally {
        __release(a);
      }
    },
  }, exports);
  function __liftTypedArray(constructor, pointer) {
    if (!pointer) return null;
    return new constructor(
      memory.buffer,
      __getU32(pointer + 4),
      __dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
    ).slice();
  }
  function __lowerTypedArray(constructor, id, align, values) {
    if (values == null) return 0;
    const
      length = values.length,
      buffer = exports.__pin(exports.__new(length << align, 1)) >>> 0,
      header = exports.__new(12, id) >>> 0;
    __setU32(header + 0, buffer);
    __dataview.setUint32(header + 4, buffer, true);
    __dataview.setUint32(header + 8, length << align, true);
    new constructor(memory.buffer, buffer, length).set(values);
    exports.__unpin(buffer);
    return header;
  }
  const refcounts = new Map();
  function __retain(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount) refcounts.set(pointer, refcount + 1);
      else refcounts.set(exports.__pin(pointer), 1);
    }
    return pointer;
  }
  function __release(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount === 1) exports.__unpin(pointer), refcounts.delete(pointer);
      else if (refcount) refcounts.set(pointer, refcount - 1);
      else throw Error("invalid refcount");
    }
  }
  function __notnull() {
    throw TypeError("value must not be null");
  }
  let __dataview = new DataView(memory.buffer);
  function __setU32(pointer, value) {
    try {
      __dataview.setUint32(pointer, value, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      __dataview.setUint32(pointer, value, true);
    }
  }
  function __getU32(pointer) {
    try {
      return __dataview.getUint32(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getUint32(pointer, true);
    }
  }
`;
const STUB_TABLE = {
  kern: { a: 'in', b: 'out' },
  total: { a: 'in' },
  maybe: { a: 'in', w: 'out' },
};

/** Run a patched stub over a fake kernel object that has a bump allocator and a real memory. */
function run(text, kernels) {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 64 });
  let top = 16;
  const alloc = (size) => {
    const pointer = top;
    top += (size + 15) & ~15;
    const missing = top - memory.buffer.byteLength;
    if (missing > 0) memory.grow(Math.ceil(missing / 65536));
    return pointer;
  };
  const view = (header) => {
    const dv = new DataView(memory.buffer);
    return new Float64Array(
      memory.buffer,
      dv.getUint32(header + 4, true),
      dv.getUint32(header + 8, true) / 8
    );
  };
  const exports = {
    memory,
    __new: (size) => alloc(size),
    __pin: (pointer) => pointer,
    __unpin() {},
    ...kernels({ memory, view }),
  };
  const body = `${text}\n  return adaptedExports;`;
  return new Function('exports', 'memory', body)(exports, memory);
}
const scaleKernel = (write) => (env) => ({
  kern(a, b, k) {
    if (write.growMemory) env.memory.grow(1);
    const va = env.view(a);
    const vb = env.view(b);
    for (let i = 0; i < va.length; i++) vb[i] = va[i] * k;
    if (write.input) env.view(a)[0] = 99;
  },
});

test('patchGlue: an unclassified lowered parameter fails the build', () => {
  const table = { ...STUB_TABLE, kern: { a: 'in' } };
  assert.throws(() => patchGlue(STUB, table, { debug: false }), /kern\.b is not classified/);
});

test('patchGlue: an export that has no lowered parameter in the glue fails the build', () => {
  const table = { ...STUB_TABLE, ghost: { a: 'in' } };
  assert.throws(() => patchGlue(STUB, table, { debug: false }), /ghost is not in the glue/);
});

test('patchGlue: a table parameter that the export does not lower fails the build', () => {
  const table = { ...STUB_TABLE, kern: { a: 'in', b: 'out', zzz: 'out' } };
  assert.throws(() => patchGlue(STUB, table, { debug: false }), /kern\.zzz is not in the glue/);
});

test('patchGlue: a class other than in or out fails the build', () => {
  const table = { ...STUB_TABLE, kern: { a: 'in', b: 'inout' } };
  assert.throws(() => patchGlue(STUB, table, { debug: false }), /kern\.b has class 'inout'/);
});

test('patchGlue: a glue without the lowering helper fails the build', () => {
  const text = STUB.replace('function __lowerTypedArray(', 'function __lowerOther(');
  assert.throws(
    () => patchGlue(text, STUB_TABLE, { debug: false, file: 'stub.js' }),
    /patch-glue: anchor .* not found in stub\.js/
  );
});

test('patchGlue: a second run returns the text unchanged', () => {
  for (const debugBuild of [false, true]) {
    const once = patchGlue(STUB, STUB_TABLE, { debug: debugBuild });
    assert.notEqual(once, STUB);
    assert.equal(patchGlue(once, STUB_TABLE, { debug: debugBuild }), once);
  }
});

test('patchGlue: the patched stub writes `out` and leaves `in` alone', () => {
  const text = patchGlue(STUB, STUB_TABLE, { debug: false });
  const glue = run(text, scaleKernel({}));
  const a = f64(1, 2, 3);
  const b = zeros(3);
  glue.kern(a, b, 2);
  near(b, [2, 4, 6]);
  near(a, [1, 2, 3]);
});

test('patchGlue: the output is read from memory after a growth during the call', () => {
  const text = patchGlue(STUB, STUB_TABLE, { debug: false });
  const glue = run(text, scaleKernel({ growMemory: true }));
  const b = zeros(3);
  glue.kern(f64(1, 2, 3), b, 3);
  near(b, [3, 6, 9]);
});

test('patchGlue: a null nullable output copies nothing and does not fail', () => {
  const text = patchGlue(STUB, STUB_TABLE, { debug: false });
  const glue = run(text, () => ({
    maybe: () => 5,
  }));
  assert.equal(glue.maybe(f64(1), null), 5);
  assert.equal(glue.maybe(f64(1)), 5);
});

test('patchGlue: a kernel that throws copies nothing, now or in a later call', () => {
  const text = patchGlue(STUB, STUB_TABLE, { debug: false });
  let fail = true;
  const glue = run(text, (env) => ({
    kern(a, b, k) {
      const vb = env.view(b);
      vb[0] = 42;
      if (fail) throw new Error('kernel failed');
      for (let i = 0; i < vb.length; i++) vb[i] = k;
    },
  }));
  const stale = zeros(2);
  assert.throws(() => glue.kern(f64(1, 2), stale, 1), /kernel failed/);
  assert.deepEqual(Array.from(stale), [0, 0]);
  fail = false;
  const fresh = zeros(2);
  glue.kern(f64(1, 2), fresh, 9);
  near(fresh, [9, 9]);
  assert.deepEqual(Array.from(stale), [0, 0], 'stale output of the failed call');
});

test('patchGlue: the debug glue throws when a kernel writes an `in` parameter', () => {
  const debugText = patchGlue(STUB, STUB_TABLE, { debug: true });
  const debugGlue = run(debugText, scaleKernel({ input: true }));
  assert.throws(
    () => debugGlue.kern(f64(1, 2, 3), zeros(3), 2),
    /mathts glue: kern wrote its input parameter a/
  );
  const quiet = run(debugText, scaleKernel({}));
  const b = zeros(3);
  quiet.kern(f64(1, 2, 3), b, 2);
  near(b, [2, 4, 6]);
  const releaseGlue = run(
    patchGlue(STUB, STUB_TABLE, { debug: false }),
    scaleKernel({ input: true })
  );
  const c = zeros(3);
  releaseGlue.kern(f64(1, 2, 3), c, 2);
  near(c, [2, 4, 6]);
});

test('OUTPUT_PARAMS: every row names only in or out', () => {
  for (const [name, params] of Object.entries(OUTPUT_PARAMS)) {
    assert.ok(Object.keys(params).length > 0, `${name} has no parameter`);
    for (const [param, kind] of Object.entries(params)) {
      assert.ok(kind === 'in' || kind === 'out', `${name}.${param} is ${kind}`);
    }
  }
});

console.log(`\nglue-write-back: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
