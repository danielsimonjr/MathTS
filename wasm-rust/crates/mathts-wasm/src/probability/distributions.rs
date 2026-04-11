//! Probability distributions and RNG (ported from src/wasm/probability/distributions.ts)
//! Uses xorshift64 PRNG since we're in no_std.

use libm;

static mut RNG_STATE: u64 = 12345;

fn xorshift64() -> u64 {
    unsafe {
        let mut s = RNG_STATE;
        s ^= s << 13;
        s ^= s >> 7;
        s ^= s << 17;
        RNG_STATE = s;
        s
    }
}

fn random_f64() -> f64 {
    (xorshift64() >> 11) as f64 / ((1u64 << 53) as f64)
}

fn random_u32() -> u32 {
    xorshift64() as u32
}

#[no_mangle]
pub unsafe extern "C" fn setSeed(seed: f64) {
    RNG_STATE = if seed as u64 == 0 { 1 } else { seed as u64 };
}

#[no_mangle]
pub unsafe extern "C" fn random() -> f64 {
    random_f64()
}

#[no_mangle]
pub unsafe extern "C" fn randomInt(min: i32, max: i32) -> i32 {
    let range = (max - min + 1) as u32;
    let threshold = u32::MAX - (u32::MAX % range);
    let r = loop {
        let r = random_u32();
        if r < threshold {
            break r;
        }
    };
    min + (r % range) as i32
}

#[no_mangle]
pub unsafe extern "C" fn randomRange(min: f64, max: f64) -> f64 {
    min + random_f64() * (max - min)
}

#[no_mangle]
pub unsafe extern "C" fn uniform(a: f64, b: f64) -> f64 {
    a + random_f64() * (b - a)
}

#[no_mangle]
pub unsafe extern "C" fn normal(mu: f64, sigma: f64) -> f64 {
    let u1_raw = random_f64();
    let u1 = if u1_raw < f64::EPSILON {
        f64::EPSILON
    } else {
        u1_raw
    };
    let u2 = random_f64();
    let z0 = libm::sqrt(-2.0 * libm::log(u1)) * libm::cos(2.0 * core::f64::consts::PI * u2);
    mu + sigma * z0
}

#[no_mangle]
pub unsafe extern "C" fn exponential(lambda: f64) -> f64 {
    if lambda <= 0.0 {
        return f64::NAN;
    }
    -libm::log(1.0 - random_f64()) / lambda
}

#[no_mangle]
pub unsafe extern "C" fn bernoulli(p: f64) -> i32 {
    if random_f64() < p {
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn binomial(n: i32, p: f64) -> i32 {
    let mut successes = 0;
    for _ in 0..n {
        if random_f64() < p {
            successes += 1;
        }
    }
    successes
}

#[no_mangle]
pub unsafe extern "C" fn poisson(lambda: f64) -> i32 {
    let big_l = libm::exp(-lambda);
    let mut k = 0;
    let mut p = 1.0;
    loop {
        k += 1;
        p *= random_f64();
        if p <= big_l {
            break;
        }
    }
    k - 1
}

#[no_mangle]
pub unsafe extern "C" fn geometric(p: f64) -> i32 {
    libm::ceil(libm::log(1.0 - random_f64()) / libm::log(1.0 - p)) as i32
}

#[no_mangle]
pub unsafe extern "C" fn fillUniform(output_ptr: *mut f64, length: i32, min: f64, max: f64) {
    for i in 0..length as usize {
        *output_ptr.add(i) = uniform(min, max);
    }
}

#[no_mangle]
pub unsafe extern "C" fn fillNormal(output_ptr: *mut f64, length: i32, mu: f64, sigma: f64) {
    for i in 0..length as usize {
        *output_ptr.add(i) = normal(mu, sigma);
    }
}

#[no_mangle]
pub unsafe extern "C" fn normalPDF(x: f64, mu: f64, sigma: f64) -> f64 {
    let z = (x - mu) / sigma;
    libm::exp(-0.5 * z * z) / (sigma * libm::sqrt(2.0 * core::f64::consts::PI))
}

#[no_mangle]
pub unsafe extern "C" fn standardNormalCDF(x: f64) -> f64 {
    // CDF(x) = 0.5 * (1 + erf(x / sqrt(2)))
    0.5 * (1.0 + erf_approx(x / core::f64::consts::SQRT_2))
}

#[no_mangle]
pub unsafe extern "C" fn normalCDF(x: f64, mu: f64, sigma: f64) -> f64 {
    standardNormalCDF((x - mu) / sigma)
}

#[no_mangle]
pub unsafe extern "C" fn exponentialPDF(x: f64, lambda: f64) -> f64 {
    if x < 0.0 {
        0.0
    } else {
        lambda * libm::exp(-lambda * x)
    }
}

#[no_mangle]
pub unsafe extern "C" fn exponentialCDF(x: f64, lambda: f64) -> f64 {
    if x < 0.0 {
        0.0
    } else {
        1.0 - libm::exp(-lambda * x)
    }
}

#[no_mangle]
pub unsafe extern "C" fn klDivergence(p_ptr: *const f64, q_ptr: *const f64, length: i32) -> f64 {
    let mut kl = 0.0;
    for i in 0..length as usize {
        let p_val = *p_ptr.add(i);
        let q_val = *q_ptr.add(i);
        if p_val > 0.0 && q_val > 0.0 {
            kl += p_val * libm::log(p_val / q_val);
        }
    }
    kl
}

#[no_mangle]
pub unsafe extern "C" fn jsDivergence(
    p_ptr: *const f64,
    q_ptr: *const f64,
    length: i32,
    work_ptr: *mut f64,
) -> f64 {
    for i in 0..length as usize {
        *work_ptr.add(i) = 0.5 * (*p_ptr.add(i) + *q_ptr.add(i));
    }
    0.5 * klDivergence(p_ptr, work_ptr, length) + 0.5 * klDivergence(q_ptr, work_ptr, length)
}

#[no_mangle]
pub unsafe extern "C" fn entropy(p_ptr: *const f64, length: i32) -> f64 {
    let mut h = 0.0;
    for i in 0..length as usize {
        let p_val = *p_ptr.add(i);
        if p_val > 0.0 {
            h -= p_val * libm::log(p_val);
        }
    }
    h
}

#[no_mangle]
pub unsafe extern "C" fn shuffle(arr_ptr: *mut f64, length: i32) {
    for i in (1..length as usize).rev() {
        let j = randomInt(0, i as i32) as usize;
        let tmp = *arr_ptr.add(i);
        *arr_ptr.add(i) = *arr_ptr.add(j);
        *arr_ptr.add(j) = tmp;
    }
}

#[no_mangle]
pub unsafe extern "C" fn sampleWithoutReplacement(
    arr_ptr: *const f64,
    length: i32,
    k: i32,
    output_ptr: *mut f64,
    work_ptr: *mut f64,
) {
    for i in 0..length as usize {
        *work_ptr.add(i) = *arr_ptr.add(i);
    }
    for i in 0..k as usize {
        let j = randomInt(i as i32, length - 1) as usize;
        let tmp = *work_ptr.add(i);
        *work_ptr.add(i) = *work_ptr.add(j);
        *work_ptr.add(j) = tmp;
        *output_ptr.add(i) = *work_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn sampleWithReplacement(
    arr_ptr: *const f64,
    length: i32,
    k: i32,
    output_ptr: *mut f64,
) {
    for i in 0..k as usize {
        let j = randomInt(0, length - 1) as usize;
        *output_ptr.add(i) = *arr_ptr.add(j);
    }
}

// ============================================================
// _wasm-suffixed distribution API
// ============================================================

/// Fast erf approximation (Abramowitz & Stegun 7.1.26, max error < 1.5e-7).
/// Used internally to avoid a cross-module call into special::functions.
#[inline(always)]
fn erf_approx(x: f64) -> f64 {
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let t = 1.0 / (1.0 + 0.3275911 * libm::fabs(x));
    let poly = t
        * (0.254829592
            + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    sign * (1.0 - poly * libm::exp(-x * x))
}

/// Normal PDF: (1 / (sigma * sqrt(2π))) * exp(-0.5 * ((x-mu)/sigma)^2).
#[no_mangle]
pub unsafe extern "C" fn normal_pdf_wasm(x: f64, mu: f64, sigma: f64) -> f64 {
    let z = (x - mu) / sigma;
    libm::exp(-0.5 * z * z) / (sigma * libm::sqrt(2.0 * core::f64::consts::PI))
}

/// Normal CDF using erf: 0.5 * (1 + erf((x-mu) / (sigma*sqrt(2)))).
#[no_mangle]
pub unsafe extern "C" fn normal_cdf_wasm(x: f64, mu: f64, sigma: f64) -> f64 {
    0.5 * (1.0 + erf_approx((x - mu) / (sigma * core::f64::consts::SQRT_2)))
}

/// Binomial PMF computed in log-space to avoid overflow.
/// Returns P(X = k) for X ~ Binomial(n, p).
#[no_mangle]
pub unsafe extern "C" fn binomial_pmf_wasm(k: i32, n: i32, p: f64) -> f64 {
    if k < 0 || k > n || p < 0.0 || p > 1.0 {
        return 0.0;
    }
    if p == 0.0 {
        return if k == 0 { 1.0 } else { 0.0 };
    }
    if p == 1.0 {
        return if k == n { 1.0 } else { 0.0 };
    }
    // log C(n,k) = log_gamma(n+1) - log_gamma(k+1) - log_gamma(n-k+1)
    let log_binom = log_gamma_approx((n + 1) as f64)
        - log_gamma_approx((k + 1) as f64)
        - log_gamma_approx((n - k + 1) as f64);
    let log_pmf = log_binom + k as f64 * libm::log(p) + (n - k) as f64 * libm::log(1.0 - p);
    libm::exp(log_pmf)
}

/// Poisson PMF computed in log-space.
/// Returns P(X = k) for X ~ Poisson(lambda).
#[no_mangle]
pub unsafe extern "C" fn poisson_pmf_wasm(k: i32, lambda: f64) -> f64 {
    if k < 0 || lambda < 0.0 {
        return 0.0;
    }
    if lambda == 0.0 {
        return if k == 0 { 1.0 } else { 0.0 };
    }
    let log_pmf = k as f64 * libm::log(lambda) - lambda - log_gamma_approx((k + 1) as f64);
    libm::exp(log_pmf)
}

/// Gamma PDF: rate^shape / Gamma(shape) * x^(shape-1) * exp(-rate*x) for x > 0.
#[no_mangle]
pub unsafe extern "C" fn gamma_pdf_wasm(x: f64, shape: f64, rate: f64) -> f64 {
    if x <= 0.0 || shape <= 0.0 || rate <= 0.0 {
        return 0.0;
    }
    let log_pdf =
        shape * libm::log(rate) - log_gamma_approx(shape) + (shape - 1.0) * libm::log(x) - rate * x;
    libm::exp(log_pdf)
}

/// Stirling-series log-gamma approximation (accurate for x > 0).
/// log Γ(x) ≈ 0.5*log(2π) + (x-0.5)*log(x) - x  for large x;
/// uses Lanczos g=5 for small x.
#[inline]
fn log_gamma_approx(x: f64) -> f64 {
    // Lanczos approximation with g=5, n=6 coefficients
    const G: f64 = 5.0;
    const C: [f64; 6] = [
        76.18009172947146,
        -86.50532032941677,
        24.01409824083091,
        -1.231739572450155,
        0.1208650973866179e-2,
        -0.5395239384953e-5,
    ];
    let z = x - 1.0;
    let mut ser = 1.000000000190015;
    let mut t = z;
    for &c in &C {
        t += 1.0;
        ser += c / t;
    }
    let tmp = z + G + 0.5;
    0.5 * libm::log(2.0 * core::f64::consts::PI) + (z + 0.5) * libm::log(tmp) - tmp + libm::log(ser)
}
