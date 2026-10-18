/**
 * Health-check endpoint for the Streamline API Gateway.
 *
 * Returns a JSON status indicating the gateway is alive and
 * optionally the state of each configured route (circuit state).
 */

import type { ServerResponse } from 'http';
import type { CircuitBreakerManager } from './circuitBreaker';
import type { Router } from './router';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  routes: Array<{ id: string; circuit: string }>;
}

/**
 * Handle a health-check request.
 *
 * @param res - The Node.js ServerResponse to write to.
 * @param router - The router (to enumerate routes).
 * @param breaker - The circuit-breaker manager (to report circuit states).
 * @param startTime - Process start time (epoch ms) for uptime calculation.
 */
export function handleHealthCheck(
  res: ServerResponse,
  router: Router,
  breaker: CircuitBreakerManager,
  startTime: number,
): void {
  const routes = router.getRoutes();
  const routeStates = routes.map((r) => ({
    id: r.id,
    circuit: breaker.getState(r.id),
  }));

  const hasOpenCircuit = routeStates.some((r) => r.circuit !== 'closed');
  const status: HealthStatus = {
    status: hasOpenCircuit ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    routes: routeStates,
  };

  res.writeHead(hasOpenCircuit ? 503 : 200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(status));
}
