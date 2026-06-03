//! Simple rate-limiting middleware for login endpoint.
//!
//! Uses a token bucket algorithm per client IP to prevent brute-force attacks.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// Rate limit state shared across requests.
pub struct RateLimiter {
    /// Max requests per window per key.
    max_requests: u32,
    /// Time window in seconds.
    window_secs: u64,
    /// State per key: (remaining_tokens, window_start).
    buckets: Mutex<HashMap<String, (u32, Instant)>>,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            max_requests,
            window_secs,
            buckets: Mutex::new(HashMap::new()),
        }
    }

    /// Check if request is allowed. Returns true if within limit.
    /// Recovers from poisoned mutex gracefully instead of panicking.
    pub fn check(&self, key: &str) -> bool {
        let mut buckets = self.buckets.lock().unwrap_or_else(|e| e.into_inner());
        Self::check_inner(&mut buckets, self.max_requests, self.window_secs, key)
    }

    fn check_inner(
        buckets: &mut HashMap<String, (u32, Instant)>,
        max_requests: u32,
        window_secs: u64,
        key: &str,
    ) -> bool {
        let now = Instant::now();
        let entry = buckets
            .entry(key.to_string())
            .or_insert_with(|| (max_requests, now));

        // Reset window if expired
        if now.duration_since(entry.1).as_secs() >= window_secs {
            entry.0 = max_requests;
            entry.1 = now;
        }

        if entry.0 > 0 {
            entry.0 -= 1;
            true
        } else {
            false
        }
    }

    /// Periodic cleanup of expired entries.
    /// Recovers from poisoned mutex gracefully instead of panicking.
    pub fn cleanup(&self) {
        let mut buckets = self.buckets.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();
        buckets.retain(|_, (_, start)| now.duration_since(*start).as_secs() < self.window_secs * 2);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allows_requests_within_limit() {
        let limiter = RateLimiter::new(3, 60);
        assert!(limiter.check("127.0.0.1"));
        assert!(limiter.check("127.0.0.1"));
        assert!(limiter.check("127.0.0.1"));
        assert!(!limiter.check("127.0.0.1"));
    }

    #[test]
    fn test_different_keys_independent() {
        let limiter = RateLimiter::new(1, 60);
        assert!(limiter.check("a"));
        assert!(!limiter.check("a"));
        assert!(limiter.check("b"));
    }

    #[test]
    fn test_window_resets_after_expiry() {
        let limiter = RateLimiter::new(2, 1);
        assert!(limiter.check("key"));
        assert!(limiter.check("key"));
        assert!(!limiter.check("key"));
        std::thread::sleep(std::time::Duration::from_secs(2));
        assert!(limiter.check("key"));
    }

    #[test]
    fn test_cleanup_removes_expired_entries() {
        let limiter = RateLimiter::new(1, 0);
        limiter.check("expired");
        limiter.cleanup();
        assert!(limiter.check("expired"));
    }

    #[test]
    fn test_recovers_from_poisoned_mutex() {
        let limiter = RateLimiter::new(10, 60);
        // Manually poison the mutex
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = limiter.buckets.lock().unwrap();
            panic!("simulate panic while holding lock");
        }));
        // After poison, check() and cleanup() should still work
        assert!(limiter.check("recovered"));
        limiter.cleanup();
    }
}
