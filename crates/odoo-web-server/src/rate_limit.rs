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
    pub fn check(&self, key: &str) -> bool {
        let mut buckets = self.buckets.lock().unwrap();
        let now = Instant::now();
        let entry = buckets
            .entry(key.to_string())
            .or_insert_with(|| (self.max_requests, now));

        // Reset window if expired
        if now.duration_since(entry.1).as_secs() >= self.window_secs {
            entry.0 = self.max_requests;
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
    pub fn cleanup(&self) {
        let mut buckets = self.buckets.lock().unwrap();
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
}
