/**
 * Write the output arguments of the generated ESM glue back to the caller.
 *
 * `asc --bindings esm` lowers each typed-array argument into a NEW buffer in wasm memory
 * (`__lowerTypedArray`) and never copies it back. A kernel that writes its output buffer, its
 * in-place buffer or its scratch buffer therefore writes into a copy that no caller sees.
 * Run as a step of `gen:manifest`, after `asc` has written `build/mathts.js` and
 * `build/mathts-debug.js`.
 *
 * The patch copies back only the parameters that `OUTPUT_PARAMS` marks `out`: a kernel is
 * contracted to write these (an output buffer, an in-place buffer or caller-provided scratch).
 * An `in` parameter is never copied back. A kernel that writes an `in` parameter has a defect
 * and must work in its output or work buffer.
 *
 * How the patch works, for each adapted export that lowers a typed array:
 * - An `out` parameter gets a `track` argument in its `__lowerTypedArray` call. The helper
 *   records the caller's object and the wasm header of the lowered buffer.
 * - The call `exports.<name>(...)` is wrapped in `__writeBack(...)`. After the call returns, it
 *   copies each recorded buffer into the caller's object and passes the call result through.
 *   It reads `memory.buffer` after the call, because the memory can grow during the call. When
 *   the call throws, nothing is copied: the first tracked parameter of the next call clears the
 *   records.
 * - A caller's object that is an ArrayBuffer view gets `values.set(view)`. Any other array-like
 *   (a plain Array) gets one assignment per index.
 * - The debug glue (`debug: true`) also records a snapshot of each `in` parameter. After the
 *   call it throws `mathts glue: <export> wrote its input parameter <param>` when the buffer
 *   differs from the snapshot (`Object.is`, so NaN and -0 compare right).
 *
 * The table and the glue must agree, in both directions. The patch throws, and so the build
 * fails, for: a lowered parameter that the table does not classify, a table export or
 * parameter that the glue does not have, a class other than `in` or `out`, and an anchor of the
 * glue that is not found (a change of the `asc` glue shape).
 *
 * A synchronous adapted call releases temporary allocations after lifting its result. A live
 * internref or caller-owned raw allocation keeps the heap intact.
 *
 * The same step adds the abort translation. The binary has no `env.abort` import (#1019), so an
 * AssemblyScript abort traps as a `WebAssembly.RuntimeError`, and the binary keeps the message,
 * the file, the line and the column in globals (`assembly/src/abort.ts`). Each export of the glue
 * catches that trap, reads the record and throws `Error('<message> in <file>:<line>:<column>')`,
 * the text that the `env.abort` of the generated glue threw before.
 *
 * The packages `matrix` and `functions` do not use this glue: they load `mathts.wasm` and pass
 * pointers. Their loaders translate the trap with `translateWasmAbort` of
 * `@danielsimonjr/mathts-core/internal`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKER = '/* mathts: typed-array write-back */';

/**
 * Class of every typed-array parameter of every adapted export: `out` when the kernel is
 * contracted to write it, `in` when it must not. Each row was classified from the AssemblyScript
 * source of the kernel, including writes through an alias or a helper function.
 * `matrix_qr_decompose.v_work` and the `work` buffers are caller-provided scratch: `out`.
 */
export const OUTPUT_PARAMS = {
  array_sum: { data: 'in' },
  array_product: { data: 'in' },
  array_mean: { data: 'in' },
  array_variance: { data: 'in' },
  array_stddev: { data: 'in' },
  array_min: { data: 'in' },
  array_max: { data: 'in' },
  array_argmin: { data: 'in' },
  array_argmax: { data: 'in' },
  array_norm: { data: 'in' },
  array_norm_l1: { data: 'in' },
  array_norm_linf: { data: 'in' },
  array_dot: { a: 'in', b: 'in' },
  array_add: { a: 'in', b: 'in', result: 'out' },
  array_sub: { a: 'in', b: 'in', result: 'out' },
  array_mul: { a: 'in', b: 'in', result: 'out' },
  array_div: { a: 'in', b: 'in', result: 'out' },
  array_scale: { a: 'in', result: 'out' },
  array_add_scalar: { a: 'in', result: 'out' },
  array_neg: { a: 'in', result: 'out' },
  array_abs: { a: 'in', result: 'out' },
  array_sqrt: { a: 'in', result: 'out' },
  array_square: { a: 'in', result: 'out' },
  array_exp: { a: 'in', result: 'out' },
  array_log: { a: 'in', result: 'out' },
  array_sin: { a: 'in', result: 'out' },
  array_cos: { a: 'in', result: 'out' },
  array_axpby: { a: 'in', b: 'in', result: 'out' },
  array_distance: { a: 'in', b: 'in' },
  array_cosine_similarity: { a: 'in', b: 'in' },
  array_scale_inplace: { a: 'out' },
  array_add_scalar_inplace: { a: 'out' },
  array_add_inplace: { a: 'out', b: 'in' },
  array_clamp_inplace: { a: 'out' },
  array_fill: { a: 'out' },
  array_copy: { src: 'in', dst: 'out' },
  matrix_diag: { values: 'in' },
  matrix_get: { data: 'in' },
  matrix_set: { data: 'out' },
  matrix_get_row: { data: 'in' },
  matrix_get_col: { data: 'in' },
  matrix_get_diag: { data: 'in' },
  matrix_add: { a: 'in', b: 'in', result: 'out' },
  matrix_sub: { a: 'in', b: 'in', result: 'out' },
  matrix_mul_elementwise: { a: 'in', b: 'in', result: 'out' },
  matrix_div_elementwise: { a: 'in', b: 'in', result: 'out' },
  matrix_scale: { a: 'in', result: 'out' },
  matrix_add_scalar: { a: 'in', result: 'out' },
  matrix_neg: { a: 'in', result: 'out' },
  matrix_multiply: { a: 'in', b: 'in', result: 'out' },
  matrix_vector_multiply: { a: 'in', x: 'in', result: 'out' },
  vector_matrix_multiply: { x: 'in', a: 'in', result: 'out' },
  matrix_outer: { x: 'in', y: 'in', result: 'out' },
  matrix_transpose: { a: 'in', result: 'out' },
  matrix_sum: { data: 'in' },
  matrix_mean: { data: 'in' },
  matrix_min: { data: 'in' },
  matrix_max: { data: 'in' },
  matrix_norm_frobenius: { data: 'in' },
  matrix_trace: { data: 'in' },
  matrix_sum_rows: { data: 'in', result: 'out' },
  matrix_sum_cols: { data: 'in', result: 'out' },
  matrix_is_symmetric: { data: 'in' },
  matrix_is_diagonal: { data: 'in' },
  matrix_is_identity: { data: 'in' },
  matrix_scale_inplace: { data: 'out' },
  matrix_add_scalar_inplace: { data: 'out' },
  matrix_add_inplace: { a: 'out', b: 'in' },
  matrix_copy: { src: 'in', dst: 'out' },
  matrix_axpy: { x: 'in', y: 'out' },
  matrix_gemm: { a: 'in', b: 'in', c: 'out' },
  matrix_gemv: { a: 'in', x: 'in', y: 'out' },
  fft: { data: 'out' },
  rfft: { data: 'in', result: 'out' },
  powerSpectrum: { data: 'in', result: 'out' },
  matrix_lu_decompose: { a: 'in', l_out: 'out', u_out: 'out', perm_out: 'out' },
  matrix_qr_decompose: { a: 'in', q_out: 'out', r_out: 'out', v_work: 'out' },
  matrix_cholesky: { a: 'in', l_out: 'out' },
  matrix_inverse: { a: 'in', result: 'out', work: 'out' },
  matrix_determinant: { a: 'in', work: 'out' },
  chineseRemainder: { rem: 'in', mods: 'in' },
  polyadd: { a: 'in', b: 'in' },
  polynomialQuotient: { a: 'in', b: 'in' },
  polynomialRemainder: { a: 'in', b: 'in' },
  polynomialGCD: { a: 'in', b: 'in' },
  polynomialLCM: { a: 'in', b: 'in' },
  discriminant: { coeffs: 'in' },
  resultant: { p: 'in', q: 'in' },
  resample: { x: 'in' },
  medfilt: { x: 'in' },
  apply_window_f64: { samples: 'out' },
  welch_psd_f64: { samples: 'in' },
  bartlett_psd_f64: { samples: 'in' },
  goertzel_f64: { samples: 'in' },
  chirp_z_transform_f64: { samples: 'in' },
  rowReduce: { a: 'in' },
  characteristicPolynomial: { a: 'in' },
  expfit: { xs: 'in', ys: 'in' },
  logfit: { xs: 'in', ys: 'in' },
  powerfit: { xs: 'in', ys: 'in' },
  quadprog: { h: 'in', f: 'in', a: 'in', b: 'in' },
  linprog: { c: 'in', a: 'in', b: 'in' },
  nullspace: { a: 'in' },
  residue: { p: 'in', q: 'in' },
  padeApproximant: { coeffs: 'in' },
  tensorTranspose: { data: 'in', shape: 'in', perm: 'in' },
  bitAnd_i32_array: { a: 'in', b: 'in', result: 'out' },
  bitOr_i32_array: { a: 'in', b: 'in', result: 'out' },
  bitXor_i32_array: { a: 'in', b: 'in', result: 'out' },
  bitNot_i32_array: { a: 'in', result: 'out' },
  leftShift_i32_array: { a: 'in', b: 'in', result: 'out' },
  rightArithShift_i32_array: { a: 'in', b: 'in', result: 'out' },
  rightLogShift_i32_array: { a: 'in', b: 'in', result: 'out' },
  poly_mul_f64: { a: 'in', b: 'in' },
  poly_div_mod_f64: { num: 'in', den: 'in' },
  poly_fit_f64: { xs: 'in', ys: 'in' },
  cheb_fit_f64: { xs: 'in', ys: 'in' },
  legendre_fit_f64: { xs: 'in', ys: 'in' },
  poly_resultant_f64: { p: 'in', q: 'in' },
  poly_discriminant_f64: { p: 'in' },
  tridiag_solve_f64: { diag: 'in', lower: 'in', upper: 'in', rhs: 'in' },
  divided_difference_f64: { xs: 'in', ys: 'in' },
  bessel_j0_f64: { xs: 'in' },
  bessel_j1_f64: { xs: 'in' },
  bessel_jn_f64: { xs: 'in' },
  bessel_j_f64: { xs: 'in' },
  bessel_y0_f64: { xs: 'in' },
  bessel_y1_f64: { xs: 'in' },
  bessel_yn_f64: { xs: 'in' },
  bessel_y_f64: { xs: 'in' },
  airy_ai_f64: { xs: 'in' },
  airy_bi_f64: { xs: 'in' },
  elliptic_k_f64: { ms: 'in' },
  elliptic_e_f64: { ms: 'in' },
  lgamma_f64: { xs: 'in' },
  carlson_rc_f64: { xs: 'in', ys: 'in' },
  carlson_rf_f64: { xs: 'in', ys: 'in', zs: 'in' },
  carlson_rd_f64: { xs: 'in', ys: 'in', zs: 'in' },
  carlson_rj_f64: { xs: 'in', ys: 'in', zs: 'in', ps: 'in' },
  elliptic_f_incomplete_f64: { phis: 'in', ms: 'in' },
  elliptic_e_incomplete_f64: { phis: 'in', ms: 'in' },
  elliptic_pi_incomplete_f64: { ns: 'in', phis: 'in', ms: 'in' },
  sort_f64: { data: 'out' },
  argsort_f64: { data: 'in' },
  rank_f64: { data: 'in' },
  complex_array_get: { data: 'in' },
  complex_array_set: { data: 'out' },
  complex_array_set_parts: { data: 'out' },
  complex_array_get_re: { data: 'in' },
  complex_array_get_im: { data: 'in' },
  complex_array_length: { data: 'in' },
  complex_array_add: { a: 'in', b: 'in', result: 'out' },
  complex_array_sub: { a: 'in', b: 'in', result: 'out' },
  complex_array_mul: { a: 'in', b: 'in', result: 'out' },
  complex_array_div: { a: 'in', b: 'in', result: 'out' },
  complex_array_scale_real: { a: 'in', result: 'out' },
  complex_array_scale_complex: { a: 'in', result: 'out' },
  complex_array_neg: { a: 'in', result: 'out' },
  complex_array_conj: { a: 'in', result: 'out' },
  complex_array_abs: { a: 'in', result: 'out' },
  complex_array_arg: { a: 'in', result: 'out' },
  complex_array_abs_squared: { a: 'in', result: 'out' },
  complex_array_real: { a: 'in', result: 'out' },
  complex_array_imag: { a: 'in', result: 'out' },
  complex_array_exp: { a: 'in', result: 'out' },
  complex_array_log: { a: 'in', result: 'out' },
  complex_array_sqrt: { a: 'in', result: 'out' },
  complex_array_sum: { a: 'in' },
  complex_array_mean: { a: 'in' },
  complex_array_dot: { a: 'in', b: 'in' },
  complex_array_norm: { a: 'in' },
  complex_array_scale_inplace: { a: 'out' },
  complex_array_conj_inplace: { a: 'out' },
  complex_array_add_inplace: { a: 'out', b: 'in' },
  complex_array_copy: { src: 'in', dst: 'out' },
};

// Bits of the `track` argument of `__lowerTypedArray`.
const TRACK_OUT = 1;
const TRACK_IN = 2;
const TRACK_FIRST = 4;

const LOWER_SITE = /(\w+) = (?:__retain\()?__lowerTypedArray\((\w+), (\d+), (\d+), \1\)/g;
const METHOD = /\n    (\w+)\(([^)]*)\) \{\n((?:      [^\n]*\n|\n)*?)    \},/g;

// The two places of the asc helper that the patch changes.
const HELPER_HEAD = `  function __lowerTypedArray(constructor, id, align, values) {
    if (values == null) return 0;
`;
const HELPER_TAIL = `    new constructor(memory.buffer, buffer, length).set(values);
    exports.__unpin(buffer);
    return header;
  }
`;

// The return of `instantiate`: the patch returns the exports through `__abortAware`.
const ABORT_TAIL = `  return adaptedExports;
`;

/**
 * The abort translation. `__liftString` is the helper of `asc` (the generated glue drops it when
 * the binary has no `abort` import). A trap that is not an abort is not translated: the flag of
 * `abort_take` is clear for it. The runtime helpers (`__new`, ...) are wrapped too: an abort of
 * `__new` that no wrapper reads would stay pending and give its record to a later trap.
 */
function abortGlue() {
  return `  function __liftString(pointer) {
    if (!pointer) return null;
    const end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let start = pointer >>> 1, string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }
  function __abortError(error) {
    if (!(error instanceof WebAssembly.RuntimeError) || !exports.abort_take()) return error;
    const message = __liftString(exports.abort_message() >>> 0);
    const fileName = __liftString(exports.abort_file() >>> 0);
    return Error(\`\${message} in \${fileName}:\${exports.abort_line() >>> 0}:\${exports.abort_column() >>> 0}\`, { cause: error });
  }
  function __abortAware(adapted) {
    const guarded = {};
    let depth = 0;
    let rawAllocations = false;
    for (const key of new Set([...Object.keys(exports), ...Object.keys(adapted)])) {
      const value = adapted[key];
      guarded[key] =
        typeof value === "function" && !key.startsWith("abort_")
          ? (...args) => {
              const previous = __out;
              __out = [];
              depth++;
              if (key === "__new" || key === "__pin") rawAllocations = true;
              try {
                const result = value(...args);
                if (key === "heap_reset") rawAllocations = false;
                return result;
              } catch (error) {
                throw __abortError(error);
              } finally {
                __out = previous;
                if (--depth === 0 && Object.hasOwn(adapted, key)
                    && !rawAllocations && refcounts.size === 0
                    && typeof exports.heap_reset === "function") {
                  exports.heap_reset();
                }
              }
            }
          : value;
    }
    return guarded;
  }
  return __abortAware(adaptedExports);
`;
}

function helperHead() {
  return `  ${MARKER}
  let __out = [];
  function __lowerTypedArray(constructor, id, align, values, track, name) {
    if (track & ${TRACK_FIRST}) __out.length = 0;
    if (values == null) return 0;
`;
}

function helperTail(debug) {
  const record = debug
    ? `{ values, header, constructor, track, name, snapshot: track & ${TRACK_IN} ? new constructor(memory.buffer, buffer, length).slice() : null }`
    : '{ values, header, constructor }';
  const fields = debug
    ? '{ values, header, constructor, track, name, snapshot }'
    : '{ values, header, constructor }';
  const check = debug
    ? `      if (track & ${TRACK_IN}) {
        for (let i = 0; i < snapshot.length; i++) {
          if (!Object.is(view[i], snapshot[i])) {
            throw Error(\`mathts glue: \${exportName} wrote its input parameter \${name}\`);
          }
        }
        continue;
      }
`
    : '';
  return `    new constructor(memory.buffer, buffer, length).set(values);
    exports.__unpin(buffer);
    if (track) __out.push(${record});
    return header;
  }
  function __writeBack(result${debug ? ', exportName' : ''}) {
    for (const ${fields} of __out.splice(0)) {
      const view = new constructor(
        memory.buffer,
        __getU32(header + 4),
        __dataview.getUint32(header + 8, true) / constructor.BYTES_PER_ELEMENT
      );
${check}      if (ArrayBuffer.isView(values)) values.set(view);
      else for (let i = 0; i < view.length; i++) values[i] = view[i];
    }
    return result;
  }
`;
}

/** Wrap the one call `exports.<name>(...)` of a method body in `__writeBack(...)`. */
function wrapCall(body, name, debug) {
  const needle = `exports.${name}(`;
  const open = body.indexOf(needle);
  if (open < 0 || body.indexOf(needle, open + 1) >= 0) return null;
  let depth = 0;
  for (let i = open + needle.length - 1; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')' && --depth === 0) {
      const call = body.slice(open, i + 1);
      const tail = debug ? `, ${JSON.stringify(name)}` : '';
      return `${body.slice(0, open)}__writeBack(${call}${tail})${body.slice(i + 1)}`;
    }
  }
  return null;
}

/** The number of matches of a global regular expression. */
function countOf(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

/** The number of lowering calls that lie in a method that `METHOD` matches and `LOWER_SITE` reads. */
function classifiedSiteCount(text) {
  let count = 0;
  for (const method of text.matchAll(METHOD)) count += countOf(method[3], LOWER_SITE);
  return count;
}

/**
 * Patch the text of an `asc` ESM glue. Pure: text in, text out.
 * @param {string} text glue text
 * @param {Record<string, Record<string, 'in' | 'out'>>} table class of each lowered parameter
 * @param {{ debug?: boolean, file?: string }} [options] `debug` adds the input-write check
 */
export function patchGlue(text, table, { debug = false, file = 'glue' } = {}) {
  if (text.includes(MARKER)) return text;
  const problems = [];
  for (const [exportName, params] of Object.entries(table)) {
    for (const [param, kind] of Object.entries(params)) {
      if (kind !== 'in' && kind !== 'out') {
        problems.push(`patch-glue: ${exportName}.${param} has class '${kind}' (use 'in' or 'out')`);
      }
    }
  }

  // Every call of the lowering helper must lie in a method that this patch classifies. A call that
  // `METHOD` or `LOWER_SITE` does not match (a new asc layout, a nested array of typed arrays)
  // would keep the old copy-in-only behaviour without a sign.
  const calls =
    countOf(text, /__lowerTypedArray\(/g) - countOf(text, /function __lowerTypedArray\(/g);
  const classified = classifiedSiteCount(text);
  if (calls !== classified) {
    problems.push(
      `patch-glue: ${calls} lowering calls in ${file}, ${classified} of them in a classified export`
    );
  }

  const seen = new Set();
  let patched = text.replace(METHOD, (method, exportName, _params, body) => {
    const lowered = [...body.matchAll(LOWER_SITE)].map((site) => site[1]);
    if (lowered.length === 0) return method;
    seen.add(exportName);
    const classes = table[exportName];
    for (const param of lowered) {
      if (!classes || !(param in classes)) {
        problems.push(`patch-glue: ${exportName}.${param} is not classified`);
      }
    }
    for (const param of Object.keys(classes ?? {})) {
      if (!lowered.includes(param)) {
        problems.push(`patch-glue: ${exportName}.${param} is not in the glue`);
      }
    }
    if (!classes) return method;

    let first = true;
    let tracked = false;
    let next = body.replace(LOWER_SITE, (site, param) => {
      const bit = classes[param] === 'out' ? TRACK_OUT : debug ? TRACK_IN : 0;
      if (bit === 0) return site;
      tracked = true;
      const track = first ? bit | TRACK_FIRST : bit;
      first = false;
      const name = bit === TRACK_IN ? `, ${JSON.stringify(param)}` : '';
      return site.replace(/\)$/, `, ${track}${name})`);
    });
    if (!tracked) return method;
    next = wrapCall(next, exportName, debug);
    if (next === null) {
      problems.push(`patch-glue: anchor exports.${exportName}( not found in ${file}`);
      return method;
    }
    return method.replace(body, next);
  });

  for (const exportName of Object.keys(table)) {
    if (!seen.has(exportName)) problems.push(`patch-glue: ${exportName} is not in the glue`);
  }
  for (const anchor of [HELPER_HEAD, HELPER_TAIL, ABORT_TAIL]) {
    if (!patched.includes(anchor)) {
      const line = JSON.stringify(anchor.split('\n')[0].trim());
      problems.push(`patch-glue: anchor ${line} not found in ${file}`);
    }
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));

  patched = patched
    .replace(HELPER_HEAD, () => helperHead())
    .replace(HELPER_TAIL, () => helperTail(debug))
    .replace(ABORT_TAIL, () => abortGlue());
  return patched;
}

/** Patch a glue file in place. A file that holds the marker is left as it is. */
export function patchFile(file, table, debug) {
  if (!existsSync(file)) throw new Error(`patch-glue: ${file} does not exist`);
  const before = readFileSync(file, 'utf8');
  const after = patchGlue(before, table, { debug, file });
  if (after !== before) writeFileSync(file, after);
  return after !== before;
}

const TARGETS = [
  ['mathts.js', false],
  ['mathts-debug.js', true],
];

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const buildDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'build');
  for (const [name, debug] of TARGETS) {
    const changed = patchFile(join(buildDir, name), OUTPUT_PARAMS, debug);
    console.log(`[patch-glue] ${changed ? 'patched' : 'already patched'} ${name}`);
  }
}
