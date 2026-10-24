import { GatewayServer } from '../src/server';
import { createServer, Server } from 'http';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Integration tests for the full GatewayServer request pipeline.
 * These tests create a real upstream HTTP server and route requests
 * through the gateway to verify end-to-end behaviour.
 */

describe('GatewayServer (integration)', () => {
  let upstream: Server;
  let upstreamPort: number;
  let gateway: GatewayServer;
  let configPath: string;

  beforeAll((done) => {
    // Create a simple upstream server
    upstream = createServer((req, res) => {
      if (req.url === '/error') {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        path: req.url,
        method: req.method,
        received: true,
      }));
    });

    upstream.listen(0, () => {
      upstreamPort = (upstream.address() as any).port;
      done();
    });
  });

  afterAll((done) => {
    upstream.close(() => done());
  });

  beforeEach(() => {
    configPath = join(tmpdir(), `gw-config-${Date.now()}.yaml`);
  });

  afterEach(() => {
    if (gateway) {
      gateway.stop();
    }
    if (existsSync(configPath)) unlinkSync(configPath);
  });

  test('routes requests to upstream and returns the response', async () => {
    configPath = join(tmpdir(), `gw-config-${Date.now()}.yaml`);
    writeFileSync(configPath, `port: 0\nroutes:\n  - id: api\n    path: /api\n    upstreams:\n      - name: upstream\n        url: http://localhost:${upstreamPort}\n`);

    const { loadConfig } = await import('../src/config');
    const config = loadConfig(configPath);
    gateway = new GatewayServer({ config });

    await gateway.listen();

    const gwPort = (gateway as any).server?.address()?.port;
    const response = await fetch(`http://localhost:${gwPort}/api/test`);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.path).toBe('/api/test');
    expect(body.received).toBe(true);
  });

  test('returns 404 for unmatched routes', async () => {
    writeFileSync(configPath, `port: 0\nroutes:\n  - id: api\n    path: /api\n    upstreams:\n      - name: upstream\n        url: http://localhost:${upstreamPort}\n`);

    const { loadConfig } = await import('../src/config');
    const config = loadConfig(configPath);
    gateway = new GatewayServer({ config });

    await gateway.listen();

    const gwPort = (gateway as any).server?.address()?.port;
    const response = await fetch(`http://localhost:${gwPort}/unknown`);

    expect(response.status).toBe(404);
  });

  test('serves health check endpoint', async () => {
    writeFileSync(configPath, `port: 0\nroutes:\n  - id: api\n    path: /api\n    upstreams:\n      - name: upstream\n        url: http://localhost:${upstreamPort}\n`);

    const { loadConfig } = await import('../src/config');
    const config = loadConfig(configPath);
    gateway = new GatewayServer({ config });

    await gateway.listen();

    const gwPort = (gateway as any).server?.address()?.port;
    const response = await fetch(`http://localhost:${gwPort}/health`);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.routes).toHaveLength(1);
  });

  test('serves metrics endpoint in Prometheus format', async () => {
    writeFileSync(configPath, `port: 0\nroutes:\n  - id: api\n    path: /api\n    upstreams:\n      - name: upstream\n        url: http://localhost:${upstreamPort}\n`);

    const { loadConfig } = await import('../src/config');
    const config = loadConfig(configPath);
    gateway = new GatewayServer({ config });

    await gateway.listen();

    const gwPort = (gateway as any).server?.address()?.port;
    // Make a request first so metrics are non-empty
    await fetch(`http://localhost:${gwPort}/api/test`);
    const response = await fetch(`http://localhost:${gwPort}/metrics`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('streamline_requests_total');
    expect(body).toContain('streamline_requests_by_route');
  });

  test('rate-limits requests when capacity is exceeded', async () => {
    writeFileSync(configPath, `port: 0\nroutes:\n  - id: api\n    path: /api\n    rateLimit:\n      capacity: 1\n      refillRate: 0\n    upstreams:\n      - name: upstream\n        url: http://localhost:${upstreamPort}\n`);

    const { loadConfig } = await import('../src/config');
    const config = loadConfig(configPath);
    gateway = new GatewayServer({ config });

    await gateway.listen();

    const gwPort = (gateway as any).server?.address()?.port;
    const r1 = await fetch(`http://localhost:${gwPort}/api/test`);
    const r2 = await fetch(`http://localhost:${gwPort}/api/test`);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(429);
  });
});
