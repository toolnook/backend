/**
 * Token-bucket rate limiter for the Streamline API Gateway.
 *
 * Each bucket has a fixed capacity and refills at a constant rate.
 * When a request arrives one token is consumed; if the bucket is
 * empty the request is rejected.
 *
 * Buckets are keyed on IP address by default but can also key on
 * the request path or a specific header.
 */

import type { RateLimitConfig } from './types';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

/**
 * A rate limiter using the token-bucket algorithm.
 *
 * Create one limiter per route (or one global limiter) and call
 * `allow()` on every request.
 */
export class RateLimiter {
  private buckets: Map<string, Bucket> = new Map();
  private readonly capacity: number;
  private readonly refillRate: number;
  private rejections: number = 0;

  constructor(config: RateLimitConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
  }

  /**
   * Attempt to consume a token for the given key.
   *
   * @param key - The bucket key (IP, path, header value, etc.).
   * @returns `true` if the request is allowed, `false` if rate-limited.
   */
  allow(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    const refilled = Math.min(
      this.capacity,
      bucket.tokens + elapsed * this.refillRate,
    );
    bucket.tokens = refilled;
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    this.rejections++;
    return false;
  }

  /** Number of times a request was rejected since the limiter was created. */
  getRejectionCount(): number {
    return this.rejections;
  }

  /** Number of active buckets. */
  getBucketCount(): number {
    return this.buckets.size;
  }

  /**
   * Extract the bucket key from an incoming request.
   *
   * @param keyType - `ip`, `path`, or `header:<name>`.
   * @param ctx - Request context with IP, path, and headers.
   */
  static extractKey(
    keyType: string | undefined,
    ctx: { ip: string; path: string; headers: Record<string, string | string[] | undefined> },
  ): string {
    if (!keyType || keyType === 'ip') {
      return ctx.ip;
    }
    if (keyType === 'path') {
      return ctx.path;
    }
    if (keyType.startsWith('header:')) {
      const headerName = keyType.slice(7).toLowerCase();
      const val = ctx.headers[headerName];
      if (Array.isArray(val)) return val[0] ?? '';
      return typeof val === 'string' ? val : '';
    }
    return ctx.ip;
  }

  /** Remove stale buckets that haven't been used recently (housekeeping). */
  pruneStaleBuckets(maxAgeMs: number = 300_000): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > maxAgeMs) {
        this.buckets.delete(key);
        removed++;
      }
    }
    return removed;
  }
}
