/**
 * Circuit-breaker implementation for the Streamline API Gateway.
 *
 * The circuit breaker protects upstream services from cascading
 * failures.  It has three states:
 *
 *  - **closed**   – requests flow normally; failures are counted.
 *  - **open**     – all requests are short-circuited immediately.
 *  - **half-open** – a single trial request is allowed; on success
 *    the circuit closes, on failure it re-opens.
 *
 * After `resetTimeout` ms in the open state the breaker moves to
 * half-open and allows one trial request.
 */

import type { CircuitBreakerConfig } from './types';

export type CircuitState = 'closed' | 'open' | 'half-open';

interface BreakerInternal {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  openedAt: number;
}

/**
 * Manages one circuit breaker per route ID.
 */
export class CircuitBreakerManager {
  private breakers: Map<string, BreakerInternal> = new Map();
  private readonly defaultConfig: CircuitBreakerConfig;

  constructor(defaultConfig?: CircuitBreakerConfig) {
    this.defaultConfig = defaultConfig ?? { threshold: 5, resetTimeout: 30_000 };
  }

  /**
   * Get the config for a route, falling back to the default.
   */
  private getConfig(routeConfig?: CircuitBreakerConfig): CircuitBreakerConfig {
    return routeConfig ?? this.defaultConfig;
  }

  /**
   * Check whether a request to the given route should be allowed.
   *
   * @param routeId - The route identifier.
   * @param routeConfig - Optional per-route circuit-breaker config.
   * @returns `true` if the request is allowed, `false` if the circuit is open.
   */
  allowRequest(routeId: string, routeConfig?: CircuitBreakerConfig): boolean {
    let breaker = this.breakers.get(routeId);
    const config = this.getConfig(routeConfig);

    if (!breaker) {
      breaker = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        openedAt: 0,
      };
      this.breakers.set(routeId, breaker);
    }

    const now = Date.now();

    switch (breaker.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if enough time has passed to try half-open
        if (now - breaker.openedAt >= config.resetTimeout) {
          breaker.state = 'half-open';
          return true; // allow the trial request
        }
        return false;

      case 'half-open':
        // Only one trial request at a time; subsequent requests are rejected
        // until the trial succeeds or fails
        return false;

      default:
        return true;
    }
  }

  /**
   * Record a successful response for the given route.
   */
  recordSuccess(routeId: string): void {
    const breaker = this.breakers.get(routeId);
    if (!breaker) return;

    if (breaker.state === 'half-open') {
      // Trial succeeded — close the circuit
      breaker.state = 'closed';
      breaker.failureCount = 0;
    } else if (breaker.state === 'closed') {
      // Reset failure count on success (sliding window)
      breaker.failureCount = 0;
    }
  }

  /**
   * Record a failure for the given route.
   *
   * @param routeId - The route identifier.
   * @param routeConfig - Optional per-route config.
   * @returns The new state of the circuit.
   */
  recordFailure(routeId: string, routeConfig?: CircuitBreakerConfig): CircuitState {
    let breaker = this.breakers.get(routeId);
    const config = this.getConfig(routeConfig);

    if (!breaker) {
      breaker = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        openedAt: 0,
      };
      this.breakers.set(routeId, breaker);
    }

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.state === 'half-open') {
      // Trial failed — re-open the circuit
      breaker.state = 'open';
      breaker.openedAt = Date.now();
    } else if (breaker.state === 'closed' && breaker.failureCount >= config.threshold) {
      // Threshold reached — open the circuit
      breaker.state = 'open';
      breaker.openedAt = Date.now();
    }

    return breaker.state;
  }

  /** Get the current state of the circuit for a route. */
  getState(routeId: string): CircuitState {
    return this.breakers.get(routeId)?.state ?? 'closed';
  }

  /** Get all route IDs with non-closed circuits (for metrics). */
  getOpenCircuits(): string[] {
    const open: string[] = [];
    for (const [routeId, breaker] of this.breakers) {
      if (breaker.state !== 'closed') {
        open.push(routeId);
      }
    }
    return open;
  }

  /** Reset the circuit for a specific route (manual recovery). */
  reset(routeId: string): void {
    this.breakers.delete(routeId);
  }

  /** Reset all circuits. */
  resetAll(): void {
    this.breakers.clear();
  }
}

/**
 * Check whether an HTTP status code counts as a failure.
 *
 * @param statusCode - The HTTP status code.
 * @param failureStatuses - Custom list of failure statuses (default 500–599).
 */
export function isFailureStatus(
  statusCode: number,
  failureStatuses?: number[],
): boolean {
  if (failureStatuses && failureStatuses.length > 0) {
    return failureStatuses.includes(statusCode);
  }
  return statusCode >= 500 && statusCode < 600;
}
