import { RateLimiter } from '../src/rateLimiter';

describe('RateLimiter (token bucket)', () => {
  test('allows requests up to capacity then rejects', () => {
    const limiter = new RateLimiter({ capacity: 3, refillRate: 0 });
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(false);
  });

  test('refills tokens over time', () => {
    const limiter = new RateLimiter({ capacity: 2, refillRate: 10 });
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(false);

    // Wait for refill
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(limiter.allow('ip1')).toBe(true);
        resolve();
      }, 150);
    });
  });

  test('maintains separate buckets per key', () => {
    const limiter = new RateLimiter({ capacity: 1, refillRate: 0 });
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip2')).toBe(true);
    expect(limiter.allow('ip1')).toBe(false);
    expect(limiter.allow('ip2')).toBe(false);
  });

  test('tracks rejection count', () => {
    const limiter = new RateLimiter({ capacity: 1, refillRate: 0 });
    limiter.allow('ip1');
    limiter.allow('ip1');
    limiter.allow('ip1');
    expect(limiter.getRejectionCount()).toBe(2);
  });

  test('extractKey returns IP for default key type', () => {
    const key = RateLimiter.extractKey(undefined, { ip: '1.2.3.4', path: '/test', headers: {} });
    expect(key).toBe('1.2.3.4');
  });

  test('extractKey returns path for "path" key type', () => {
    const key = RateLimiter.extractKey('path', { ip: '1.2.3.4', path: '/api/test', headers: {} });
    expect(key).toBe('/api/test');
  });

  test('extractKey returns header value for "header:X-Key" key type', () => {
    const key = RateLimiter.extractKey('header:X-Key', {
      ip: '1.2.3.4',
      path: '/test',
      headers: { 'x-key': 'abc' },
    });
    expect(key).toBe('abc');
  });

  test('pruneStaleBuckets removes old buckets', () => {
    const limiter = new RateLimiter({ capacity: 5, refillRate: 1 });
    limiter.allow('old-ip');
    expect(limiter.getBucketCount()).toBe(1);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const removed = limiter.pruneStaleBuckets(50); // prune anything older than 50ms
        expect(removed).toBe(1);
        expect(limiter.getBucketCount()).toBe(0);
        resolve();
      }, 100);
    });
  });
});
