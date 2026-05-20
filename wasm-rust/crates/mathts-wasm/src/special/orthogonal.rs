//! Orthogonal polynomial evaluators — pure scalar recurrences.
//!
//! Gap B P1 (see `docs/roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md`): Chebyshev T,
//! physicists' Hermite H, Laguerre L, and Legendre P were absent from the
//! crate. `n` is taken as `f64` and rounded, matching the JS API.

/// Chebyshev polynomial of the first kind, `T_n(x)`.
#[no_mangle]
pub extern "C" fn chebyshevT(n: f64, x: f64) -> f64 {
    let ni = libm::round(n) as i64;
    if ni < 0 {
        return f64::NAN;
    }
    if ni == 0 {
        return 1.0;
    }
    if ni == 1 {
        return x;
    }
    let mut prev = 1.0;
    let mut curr = x;
    let mut k = 2;
    while k <= ni {
        let next = 2.0 * x * curr - prev;
        prev = curr;
        curr = next;
        k += 1;
    }
    curr
}

/// Hermite polynomial `H_n(x)` (physicists' convention).
#[no_mangle]
pub extern "C" fn hermiteH(n: f64, x: f64) -> f64 {
    let ni = libm::round(n) as i64;
    if ni < 0 {
        return f64::NAN;
    }
    if ni == 0 {
        return 1.0;
    }
    if ni == 1 {
        return 2.0 * x;
    }
    let mut prev = 1.0;
    let mut curr = 2.0 * x;
    let mut k = 2;
    while k <= ni {
        let next = 2.0 * x * curr - 2.0 * (k - 1) as f64 * prev;
        prev = curr;
        curr = next;
        k += 1;
    }
    curr
}

/// Laguerre polynomial `L_n(x)`.
#[no_mangle]
pub extern "C" fn laguerreL(n: f64, x: f64) -> f64 {
    let ni = libm::round(n) as i64;
    if ni < 0 {
        return f64::NAN;
    }
    if ni == 0 {
        return 1.0;
    }
    if ni == 1 {
        return 1.0 - x;
    }
    let mut prev = 1.0;
    let mut curr = 1.0 - x;
    let mut k = 2;
    while k <= ni {
        let kf = k as f64;
        let next = ((2.0 * kf - 1.0 - x) * curr - (kf - 1.0) * prev) / kf;
        prev = curr;
        curr = next;
        k += 1;
    }
    curr
}

/// Legendre polynomial `P_n(x)`.
#[no_mangle]
pub extern "C" fn legendreP(n: f64, x: f64) -> f64 {
    let ni = libm::round(n) as i64;
    if ni < 0 {
        return f64::NAN;
    }
    if ni == 0 {
        return 1.0;
    }
    if ni == 1 {
        return x;
    }
    let mut prev = 1.0;
    let mut curr = x;
    let mut k = 2;
    while k <= ni {
        let kf = k as f64;
        let next = ((2.0 * kf - 1.0) * x * curr - (kf - 1.0) * prev) / kf;
        prev = curr;
        curr = next;
        k += 1;
    }
    curr
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-12
    }

    #[test]
    fn chebyshev_t() {
        assert!(close(chebyshevT(0.0, 0.3), 1.0));
        assert!(close(chebyshevT(1.0, 0.3), 0.3));
        assert!(close(chebyshevT(2.0, 0.5), -0.5)); // 2x^2-1
        assert!(close(chebyshevT(3.0, 1.0), 1.0)); // T_n(1)=1
        assert!(close(chebyshevT(4.0, 0.5), -0.5)); // 8x^4-8x^2+1
        assert!(chebyshevT(-1.0, 0.5).is_nan());
    }

    #[test]
    fn hermite_h() {
        assert!(close(hermiteH(0.0, 0.7), 1.0));
        assert!(close(hermiteH(1.0, 0.7), 1.4));
        assert!(close(hermiteH(2.0, 1.0), 2.0)); // 4x^2-2
        assert!(close(hermiteH(3.0, 0.5), -5.0)); // 8x^3-12x
    }

    #[test]
    fn laguerre_l() {
        assert!(close(laguerreL(0.0, 2.0), 1.0));
        assert!(close(laguerreL(1.0, 2.0), -1.0)); // 1-x
        assert!(close(laguerreL(2.0, 0.0), 1.0)); // (x^2-4x+2)/2 at 0
        assert!(close(laguerreL(2.0, 1.0), -0.5));
    }

    #[test]
    fn legendre_p() {
        assert!(close(legendreP(0.0, 0.4), 1.0));
        assert!(close(legendreP(1.0, 0.4), 0.4));
        assert!(close(legendreP(2.0, 0.5), -0.125)); // (3x^2-1)/2
        assert!(close(legendreP(3.0, 0.5), -0.4375)); // (5x^3-3x)/2
        assert!(close(legendreP(4.0, 1.0), 1.0)); // P_n(1)=1
    }
}
