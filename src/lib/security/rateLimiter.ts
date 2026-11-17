/**
 * Rate Limiting System
 * Prevents brute force attacks and API abuse
 * Works both client-side and server-side
 */

interface RateLimitEntry {
  count: number;
  lastReset: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();

  constructor(private config: RateLimitConfig) {}

  public checkLimit(key: string): boolean {
    const now = Date.now();
    const limit = this.limits.get(key);
    
    if (!limit) {
      // First time or expired
      this.limits.set(key, {
        count: 1,
        lastReset: now
      });
      return true;
    }
    
    // Check if window has expired
    if (now - limit.lastReset > this.config.windowMs) {
      this.limits.set(key, {
        count: 1,
        lastReset: now
      });
      return true;
    }
    
    // Check if limit exceeded
    if (limit.count >= this.config.maxAttempts) {
      return false;
    }
    
    // Increment counter
    this.limits.set(key, {
      count: limit.count + 1,
      lastReset: limit.lastReset
    });
    
    return true;
  }

  public resetLimit(key: string): void {
    this.limits.delete(key);
  }

  public getRemainingAttempts(key: string): number {
    const limit = this.limits.get(key);
    if (!limit) return this.config.maxAttempts;
    return Math.max(0, this.config.maxAttempts - limit.count);
  }

  /**
   * Server-side rate limit check with automatic cleanup of old entries
   */
  public checkLimitWithCleanup(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const limit = this.limits.get(key);
    
    if (!limit) {
      this.limits.set(key, { count: 1, lastReset: now });
      return { allowed: true, remaining: this.config.maxAttempts - 1, resetIn: this.config.windowMs };
    }
    
    // Check if window has expired
    if (now - limit.lastReset > this.config.windowMs) {
      this.limits.set(key, { count: 1, lastReset: now });
      return { allowed: true, remaining: this.config.maxAttempts - 1, resetIn: this.config.windowMs };
    }
    
    // Check if limit exceeded
    if (limit.count >= this.config.maxAttempts) {
      const resetIn = this.config.windowMs - (now - limit.lastReset);
      return { allowed: false, remaining: 0, resetIn };
    }
    
    // Increment counter
    const newCount = limit.count + 1;
    this.limits.set(key, { count: newCount, lastReset: limit.lastReset });
    
    // Periodic cleanup of old entries (every 100 checks)
    if (Math.random() < 0.01) {
      this.cleanup(now);
    }
    
    return { allowed: true, remaining: this.config.maxAttempts - newCount, resetIn: this.config.windowMs - (now - limit.lastReset) };
  }

  /**
   * Clean up expired entries to prevent memory leak
   */
  private cleanup(now: number): void {
    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.lastReset > this.config.windowMs * 2) {
        this.limits.delete(key);
      }
    }
  }
}

// Pre-configured limiters for different use cases — each is a separate instance
export const loginRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5 // Max 5 login attempts per 15 minutes
});

export const actionRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxAttempts: 30 // Max 30 server actions per minute per user
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxAttempts: 60 // Max 60 API calls per minute
});

export default RateLimiter;
