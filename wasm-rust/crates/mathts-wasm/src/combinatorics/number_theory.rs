//! Number-theory functions — totient, Möbius, Jacobi, factorization,
//! divisors, CRT, integer partitions, harmonic numbers.
//!
//! Gap B P2 (see `docs/roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md`). All
//! functions are allocation-free: scalars return directly, array-valued
//! functions write into a caller-provided buffer and return the count,
//! `partitions` takes a caller-provided DP work buffer. This keeps every
//! export safe to call through the JS-side bump allocator.

const MAX_SAFE_INT: f64 = 9.007199254740992e15; // 2^53

/// Interpret `x` as a non-negative integer, if it is one.
fn as_uint(x: f64) -> Option<u64> {
    if x >= 0.0 && x <= MAX_SAFE_INT && libm::floor(x) == x {
        Some(x as u64)
    } else {
        None
    }
}

/// Interpret `x` as a (possibly negative) integer, if it is one.
fn as_int(x: f64) -> Option<i64> {
    if x >= -MAX_SAFE_INT && x <= MAX_SAFE_INT && libm::floor(x) == x {
        Some(x as i64)
    } else {
        None
    }
}

fn gcd_u(mut a: u64, mut b: u64) -> u64 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    a
}

fn lcm_u(a: u64, b: u64) -> u64 {
    if a == 0 || b == 0 {
        0
    } else {
        (a / gcd_u(a, b)) * b
    }
}

/// Euler's totient `phi(n)` — count of integers in `1..=n` coprime to `n`.
#[no_mangle]
pub extern "C" fn eulerPhi(n: f64) -> f64 {
    let n = match as_uint(n) {
        Some(v) if v >= 1 => v,
        _ => return f64::NAN,
    };
    let mut result = n;
    let mut m = n;
    let mut p = 2u64;
    while p * p <= m {
        if m % p == 0 {
            while m % p == 0 {
                m /= p;
            }
            result -= result / p;
        }
        p += 1;
    }
    if m > 1 {
        result -= result / m;
    }
    result as f64
}

/// Sum of the `k`-th powers of the divisors of `n`, `sigma_k(n)`.
/// `divisorSigma(n, 0)` is the number of divisors.
#[no_mangle]
pub extern "C" fn divisorSigma(n: f64, k: f64) -> f64 {
    let n = match as_uint(n) {
        Some(v) if v >= 1 => v,
        _ => return f64::NAN,
    };
    let k = match as_uint(k) {
        Some(v) => v,
        _ => return f64::NAN,
    };
    let mut sum = 0.0;
    let mut i = 1u64;
    while i * i <= n {
        if n % i == 0 {
            sum += libm::pow(i as f64, k as f64);
            let j = n / i;
            if j != i {
                sum += libm::pow(j as f64, k as f64);
            }
        }
        i += 1;
    }
    sum
}

/// Möbius function `mu(n)` — `1`, `0`, or `-1`.
#[no_mangle]
pub extern "C" fn moebiusMu(n: f64) -> f64 {
    let n = match as_uint(n) {
        Some(v) if v >= 1 => v,
        _ => return f64::NAN,
    };
    if n == 1 {
        return 1.0;
    }
    let mut m = n;
    let mut num_factors = 0u32;
    let mut p = 2u64;
    while p * p <= m {
        if m % p == 0 {
            m /= p;
            if m % p == 0 {
                return 0.0; // squared prime factor
            }
            num_factors += 1;
        }
        p += 1;
    }
    if m > 1 {
        num_factors += 1;
    }
    if num_factors % 2 == 0 {
        1.0
    } else {
        -1.0
    }
}

fn carmichael_prime_power(p: u64, pk: u64) -> u64 {
    if p == 2 {
        if pk <= 2 {
            return 1;
        }
        if pk == 4 {
            return 2;
        }
        return pk / 4;
    }
    (pk / p) * (p - 1)
}

/// Carmichael function `lambda(n)`.
#[no_mangle]
pub extern "C" fn carmichaelLambda(n: f64) -> f64 {
    let n = match as_uint(n) {
        Some(v) if v >= 1 => v,
        _ => return f64::NAN,
    };
    if n == 1 {
        return 1.0;
    }
    let mut m = n;
    let mut result = 1u64;
    let mut p = 2u64;
    while p * p <= m {
        if m % p == 0 {
            let mut pk = 1u64;
            while m % p == 0 {
                pk *= p;
                m /= p;
            }
            result = lcm_u(result, carmichael_prime_power(p, pk));
        }
        p += 1;
    }
    if m > 1 {
        result = lcm_u(result, m - 1);
    }
    result as f64
}

/// Jacobi symbol `(a / n)` — `n` a positive odd integer.
#[no_mangle]
pub extern "C" fn jacobiSymbol(a: f64, n: f64) -> f64 {
    let a = match as_int(a) {
        Some(v) => v,
        _ => return f64::NAN,
    };
    let n = match as_int(n) {
        Some(v) if v >= 1 && v % 2 == 1 => v,
        _ => return f64::NAN,
    };
    if n == 1 {
        return 1.0;
    }
    let mut aa = (((a % n) + n) % n) as u64;
    let mut nn = n as u64;
    let mut result: i64 = 1;
    while aa != 0 {
        while aa % 2 == 0 {
            aa /= 2;
            if nn % 8 == 3 || nn % 8 == 5 {
                result = -result;
            }
        }
        core::mem::swap(&mut aa, &mut nn);
        if aa % 4 == 3 && nn % 4 == 3 {
            result = -result;
        }
        aa %= nn;
    }
    if nn == 1 {
        result as f64
    } else {
        0.0
    }
}

/// `n`-th harmonic number `H(n) = 1 + 1/2 + ... + 1/n`.
#[no_mangle]
pub extern "C" fn harmonicNumber(n: f64) -> f64 {
    let n = match as_uint(n) {
        Some(v) if v >= 1 => v,
        _ => return f64::NAN,
    };
    let mut sum = 0.0;
    let mut i = 1u64;
    while i <= n {
        sum += 1.0 / i as f64;
        i += 1;
    }
    sum
}

/// Scratch length (in `f64`s) required by [`partitions`] — `n + 1`.
#[no_mangle]
pub extern "C" fn partitionsWorkSize(n: f64) -> i32 {
    match as_uint(n) {
        Some(v) => (v + 1) as i32,
        _ => 0,
    }
}

/// Integer partition count `p(n)`.
///
/// # Safety
/// `work_ptr` must point to `partitionsWorkSize(n)` writable `f64`s.
#[no_mangle]
pub unsafe extern "C" fn partitions(n: f64, work_ptr: *mut f64) -> f64 {
    let n = match as_uint(n) {
        Some(v) => v as usize,
        _ => return f64::NAN,
    };
    let dp = core::slice::from_raw_parts_mut(work_ptr, n + 1);
    for x in dp.iter_mut() {
        *x = 0.0;
    }
    dp[0] = 1.0;
    for k in 1..=n {
        for i in k..=n {
            dp[i] += dp[i - k];
        }
    }
    dp[n]
}

/// Prime factorization of `n >= 2` (with multiplicity, ascending).
///
/// Writes the factors into `out_ptr` and returns the count, or `-1` for
/// invalid input. `out_ptr` must hold at least 64 `f64`s (the maximum
/// factor count for a value below 2^53).
///
/// # Safety
/// `out_ptr` must point to at least 64 writable `f64`s.
#[no_mangle]
pub unsafe extern "C" fn primeFactors(n: f64, out_ptr: *mut f64) -> i32 {
    let mut m = match as_uint(n) {
        Some(v) if v >= 2 => v,
        _ => return -1,
    };
    let mut count: i32 = 0;
    let mut d = 2u64;
    while d * d <= m {
        while m % d == 0 {
            *out_ptr.add(count as usize) = d as f64;
            count += 1;
            m /= d;
        }
        d += 1;
    }
    if m > 1 {
        *out_ptr.add(count as usize) = m as f64;
        count += 1;
    }
    count
}

/// All positive divisors of `n >= 1`, ascending.
///
/// Writes the divisors into `out_ptr` and returns the count, or `-1` for
/// invalid input. Size the buffer with `divisorSigma(n, 0)`.
///
/// # Safety
/// `out_ptr` must point to at least `divisorSigma(n, 0)` writable `f64`s.
#[no_mangle]
pub unsafe extern "C" fn divisors(n: f64, out_ptr: *mut f64) -> i32 {
    let n = match as_uint(n) {
        Some(v) if v >= 1 => v,
        _ => return -1,
    };
    // Count first so the large divisors can be placed from the back.
    let mut count: i32 = 0;
    let mut i = 1u64;
    while i * i <= n {
        if n % i == 0 {
            count += if i == n / i { 1 } else { 2 };
        }
        i += 1;
    }
    let mut small: i32 = 0;
    let mut large: i32 = count - 1;
    i = 1;
    while i * i <= n {
        if n % i == 0 {
            *out_ptr.add(small as usize) = i as f64;
            small += 1;
            let j = n / i;
            if j != i {
                *out_ptr.add(large as usize) = j as f64;
                large -= 1;
            }
        }
        i += 1;
    }
    count
}

/// Digits of `n >= 0` in `base >= 2`, most-significant first.
///
/// Writes the digits into `out_ptr` and returns the count, or `-1` for
/// invalid input. `out_ptr` must hold at least 64 `f64`s.
///
/// # Safety
/// `out_ptr` must point to at least 64 writable `f64`s.
#[no_mangle]
pub unsafe extern "C" fn integerDigits(n: f64, base: f64, out_ptr: *mut f64) -> i32 {
    let n = match as_uint(n) {
        Some(v) => v,
        _ => return -1,
    };
    let base = match as_uint(base) {
        Some(v) if v >= 2 => v,
        _ => return -1,
    };
    if n == 0 {
        *out_ptr = 0.0;
        return 1;
    }
    let mut count: i32 = 0;
    let mut m = n;
    while m > 0 {
        count += 1;
        m /= base;
    }
    let mut idx = count - 1;
    m = n;
    while m > 0 {
        *out_ptr.add(idx as usize) = (m % base) as f64;
        m /= base;
        idx -= 1;
    }
    count
}

/// Modular inverse of `a` mod `m` via the extended Euclidean algorithm;
/// `-1` if it does not exist.
fn mod_inverse(a: i64, m: i64) -> i64 {
    let (mut old_r, mut r) = (a, m);
    let (mut old_s, mut s) = (1i64, 0i64);
    while r != 0 {
        let q = old_r / r;
        let nr = old_r - q * r;
        old_r = r;
        r = nr;
        let ns = old_s - q * s;
        old_s = s;
        s = ns;
    }
    if old_r != 1 {
        return -1;
    }
    ((old_s % m) + m) % m
}

/// Chinese Remainder Theorem — smallest non-negative `x` with
/// `x === rem[i] (mod mod[i])` for all `i`. Moduli must be pairwise coprime.
///
/// Exact while the product of moduli stays below 2^53.
///
/// # Safety
/// `rem_ptr` and `mod_ptr` must each point to `count` readable `f64`s.
#[no_mangle]
pub unsafe extern "C" fn chineseRemainder(
    rem_ptr: *const f64,
    mod_ptr: *const f64,
    count: i32,
) -> f64 {
    if count <= 0 {
        return f64::NAN;
    }
    let n = count as usize;
    let rem = core::slice::from_raw_parts(rem_ptr, n);
    let mods = core::slice::from_raw_parts(mod_ptr, n);

    let mut big_m: i64 = 1;
    for &mi in mods.iter() {
        if mi < 1.0 || libm::floor(mi) != mi {
            return f64::NAN;
        }
        big_m *= mi as i64;
    }

    let mut x: i64 = 0;
    for i in 0..n {
        let modi = mods[i] as i64;
        let mi = big_m / modi;
        let yi = mod_inverse(((mi % modi) + modi) % modi, modi);
        if yi == -1 {
            return f64::NAN; // moduli not pairwise coprime
        }
        let ri = match as_int(rem[i]) {
            Some(v) => v,
            None => return f64::NAN,
        };
        x += ri * mi * yi;
    }
    (((x % big_m) + big_m) % big_m) as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn euler_phi() {
        assert_eq!(eulerPhi(1.0), 1.0);
        assert_eq!(eulerPhi(7.0), 6.0);
        assert_eq!(eulerPhi(10.0), 4.0);
        assert_eq!(eulerPhi(12.0), 4.0);
        assert_eq!(eulerPhi(36.0), 12.0);
        assert!(eulerPhi(0.0).is_nan());
    }

    #[test]
    fn divisor_sigma() {
        assert_eq!(divisorSigma(6.0, 1.0), 12.0); // 1+2+3+6
        assert_eq!(divisorSigma(6.0, 0.0), 4.0); // divisor count
        assert_eq!(divisorSigma(12.0, 0.0), 6.0);
        assert_eq!(divisorSigma(10.0, 2.0), 130.0); // 1+4+25+100
    }

    #[test]
    fn moebius_mu() {
        assert_eq!(moebiusMu(1.0), 1.0);
        assert_eq!(moebiusMu(6.0), 1.0);
        assert_eq!(moebiusMu(4.0), 0.0);
        assert_eq!(moebiusMu(30.0), -1.0);
        assert_eq!(moebiusMu(7.0), -1.0);
    }

    #[test]
    fn carmichael_lambda() {
        assert_eq!(carmichaelLambda(1.0), 1.0);
        assert_eq!(carmichaelLambda(8.0), 2.0);
        assert_eq!(carmichaelLambda(15.0), 4.0);
        assert_eq!(carmichaelLambda(21.0), 6.0);
    }

    #[test]
    fn jacobi_symbol() {
        assert_eq!(jacobiSymbol(1.0, 1.0), 1.0);
        assert_eq!(jacobiSymbol(2.0, 15.0), 1.0);
        assert_eq!(jacobiSymbol(3.0, 5.0), -1.0);
        assert_eq!(jacobiSymbol(4.0, 15.0), 1.0);
        assert_eq!(jacobiSymbol(0.0, 9.0), 0.0);
        assert!(jacobiSymbol(2.0, 4.0).is_nan()); // even n
    }

    #[test]
    fn harmonic_number() {
        assert_eq!(harmonicNumber(1.0), 1.0);
        assert!((harmonicNumber(4.0) - 2.083333333333333).abs() < 1e-12);
    }

    #[test]
    fn partition_counts() {
        let mut work = [0.0f64; 64];
        let mut p = |n: f64| unsafe { partitions(n, work.as_mut_ptr()) };
        assert_eq!(p(0.0), 1.0);
        assert_eq!(p(1.0), 1.0);
        assert_eq!(p(4.0), 5.0);
        assert_eq!(p(5.0), 7.0);
        assert_eq!(p(10.0), 42.0);
        assert_eq!(partitionsWorkSize(10.0), 11);
    }

    #[test]
    fn prime_factors() {
        let mut buf = [0.0f64; 64];
        let mut pf = |n: f64| -> alloc::vec::Vec<f64> {
            let c = unsafe { primeFactors(n, buf.as_mut_ptr()) };
            buf[..c as usize].to_vec()
        };
        assert_eq!(pf(12.0), alloc::vec![2.0, 2.0, 3.0]);
        assert_eq!(pf(17.0), alloc::vec![17.0]);
        assert_eq!(pf(360.0), alloc::vec![2.0, 2.0, 2.0, 3.0, 3.0, 5.0]);
    }

    #[test]
    fn divisor_lists() {
        let mut buf = [0.0f64; 64];
        let mut dv = |n: f64| -> alloc::vec::Vec<f64> {
            let c = unsafe { divisors(n, buf.as_mut_ptr()) };
            buf[..c as usize].to_vec()
        };
        assert_eq!(dv(12.0), alloc::vec![1.0, 2.0, 3.0, 4.0, 6.0, 12.0]);
        assert_eq!(dv(7.0), alloc::vec![1.0, 7.0]);
        assert_eq!(dv(1.0), alloc::vec![1.0]);
        assert_eq!(dv(16.0), alloc::vec![1.0, 2.0, 4.0, 8.0, 16.0]);
    }

    #[test]
    fn integer_digits() {
        let mut buf = [0.0f64; 64];
        let mut dg = |n: f64, b: f64| -> alloc::vec::Vec<f64> {
            let c = unsafe { integerDigits(n, b, buf.as_mut_ptr()) };
            buf[..c as usize].to_vec()
        };
        assert_eq!(dg(123.0, 10.0), alloc::vec![1.0, 2.0, 3.0]);
        assert_eq!(dg(255.0, 16.0), alloc::vec![15.0, 15.0]);
        assert_eq!(dg(10.0, 2.0), alloc::vec![1.0, 0.0, 1.0, 0.0]);
        assert_eq!(dg(0.0, 10.0), alloc::vec![0.0]);
    }

    #[test]
    fn chinese_remainder() {
        let rem = [2.0, 3.0, 2.0];
        let mods = [3.0, 5.0, 7.0];
        let x = unsafe { chineseRemainder(rem.as_ptr(), mods.as_ptr(), 3) };
        assert_eq!(x, 23.0);

        let rem2 = [1.0, 2.0];
        let mods2 = [4.0, 6.0]; // not coprime
        assert!(unsafe { chineseRemainder(rem2.as_ptr(), mods2.as_ptr(), 2) }.is_nan());
    }
}
