import { CircuitBreakerManager, isFailureStatus } from '../src/circuitBreaker';

describe('CircuitBreakerManager', () => {
  test('starts in closed state and allows requests', () => {
    const mgr = new CircuitBreakerManager();
    expect(mgr.allowRequest('route1')).toBe(true);
    expect(mgr.getState('route1')).toBe('closed');
  });

  test('opens circuit after threshold failures', () => {
    const mgr = new CircuitBreakerManager({ threshold: 3, resetTimeout: 5000 });
    mgr.recordFailure('route1');
    mgr.recordFailure('route1');
    expect(mgr.getState('route1')).toBe('closed');

    mgr.recordFailure('route1');
    expect(mgr.getState('route1')).toBe('open');
    expect(mgr.allowRequest('route1')).toBe(false);
  });

  test('transitions to half-open after reset timeout', () => {
    const mgr = new CircuitBreakerManager({ threshold: 1, resetTimeout: 100 });
    mgr.recordFailure('route1');
    expect(mgr.getState('route1')).toBe('open');

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // After resetTimeout, the next allowRequest should transition to half-open
        const allowed = mgr.allowRequest('route1');
        expect(allowed).toBe(true);
        expect(mgr.getState('route1')).toBe('half-open');
        resolve();
      }, 150);
    });
  });

  test('closes circuit on success from half-open', () => {
    const mgr = new CircuitBreakerManager({ threshold: 1, resetTimeout: 100 });
    mgr.recordFailure('route1');

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        mgr.allowRequest('route1'); // triggers half-open
        expect(mgr.getState('route1')).toBe('half-open');
        mgr.recordSuccess('route1');
        expect(mgr.getState('route1')).toBe('closed');
        resolve();
      }, 150);
    });
  });

  test('re-opens circuit on failure from half-open', () => {
    const mgr = new CircuitBreakerManager({ threshold: 1, resetTimeout: 100 });
    mgr.recordFailure('route1');

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        mgr.allowRequest('route1'); // triggers half-open
        mgr.recordFailure('route1');
        expect(mgr.getState('route1')).toBe('open');
        resolve();
      }, 150);
    });
  });

  test('resets failure count on success in closed state', () => {
    const mgr = new CircuitBreakerManager({ threshold: 3, resetTimeout: 5000 });
    mgr.recordFailure('route1');
    mgr.recordFailure('route1');
    mgr.recordSuccess('route1');
    // After success, failure count resets; need 3 more to open
    mgr.recordFailure('route1');
    mgr.recordFailure('route1');
    expect(mgr.getState('route1')).toBe('closed');
  });

  test('getOpenCircuits returns only non-closed routes', () => {
    const mgr = new CircuitBreakerManager({ threshold: 1, resetTimeout: 5000 });
    mgr.recordFailure('route1'); // opens
    expect(mgr.getOpenCircuits()).toContain('route1');
    expect(mgr.getOpenCircuits()).not.toContain('route2');
  });

  test('reset clears a specific route', () => {
    const mgr = new CircuitBreakerManager({ threshold: 1, resetTimeout: 5000 });
    mgr.recordFailure('route1');
    mgr.reset('route1');
    expect(mgr.getState('route1')).toBe('closed');
  });

  test('isFailureStatus detects 5xx as failures', () => {
    expect(isFailureStatus(500)).toBe(true);
    expect(isFailureStatus(503)).toBe(true);
    expect(isFailureStatus(599)).toBe(true);
    expect(isFailureStatus(404)).toBe(false);
    expect(isFailureStatus(200)).toBe(false);
  });

  test('isFailureStatus respects custom failure statuses', () => {
    expect(isFailureStatus(404, [404, 429])).toBe(true);
    expect(isFailureStatus(500, [404, 429])).toBe(false);
  });
});
