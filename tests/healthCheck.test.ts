import { handleHealthCheck } from '../src/healthCheck';
import { Router } from '../src/router';
import { CircuitBreakerManager } from '../src/circuitBreaker';
import { GatewayConfig, RouteConfig } from '../src/types';

function mockResponse() {
  const chunks: Buffer[] = [];
  let statusCode = 0;
  const res = {
    writeHead: (code: number, _headers?: Record<string, string>) => { statusCode = code; },
    end: (data?: string) => { if (data) chunks.push(Buffer.from(data)); },
    getStatusCode: () => statusCode,
    getBody: () => JSON.parse(Buffer.concat(chunks).toString()),
  };
  return res;
}

describe('Health check endpoint', () => {
  const routes: RouteConfig[] = [
    { id: 'users', path: '/api/users', pathPrefix: true, upstreams: [{ name: 'u', url: 'http://localhost:3000' }] },
  ];
  const router = new Router({ port: 8080, routes } as GatewayConfig);

  test('returns ok status when all circuits are closed', () => {
    const breaker = new CircuitBreakerManager();
    const startTime = Date.now();
    const res = mockResponse();
    handleHealthCheck(res as any, router, breaker, startTime);

    expect(res.getStatusCode()).toBe(200);
    const body = res.getBody();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.routes).toHaveLength(1);
    expect(body.routes[0].circuit).toBe('closed');
  });

  test('returns degraded status when a circuit is open', () => {
    const breaker = new CircuitBreakerManager({ threshold: 1, resetTimeout: 5000 });
    breaker.recordFailure('users');
    const startTime = Date.now();
    const res = mockResponse();
    handleHealthCheck(res as any, router, breaker, startTime);

    expect(res.getStatusCode()).toBe(503);
    const body = res.getBody();
    expect(body.status).toBe('degraded');
    expect(body.routes[0].circuit).toBe('open');
  });
});
