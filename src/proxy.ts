/**
 * Reverse-proxy handler for the Streamline API Gateway.
 *
 * Forwards the incoming request to a matched upstream service,
 * streaming the response back to the client.  Includes simple
 * round-robin load balancing when a route has multiple upstreams.
 */

import { request as httpRequest, Agent } from 'http';
import type { RouteConfig, Upstream } from './types';
import type { Logger } from './logger';

/** Per-route round-robin index. */
const rrIndex: Map<string, number> = new Map();

/** Reusable HTTP agent for connection pooling. */
const agent = new Agent({
  keepAlive: true,
  maxSockets: 50,
});

/** Options passed to the proxy handler. */
export interface ProxyOptions {
  route: RouteConfig;
  logger: Logger;
  /** The raw Node.js IncomingMessage. */
  req: import('http').IncomingMessage;
  /** The raw Node.js ServerResponse. */
  res: import('http').ServerResponse;
}

/** Result of a proxy attempt. */
export interface ProxyResult {
  statusCode: number;
  upstream: string;
  durationMs: number;
  error?: string;
}

/**
 * Select the next upstream using round-robin.
 */
export function selectUpstream(route: RouteConfig): Upstream {
  const upstreams = route.upstreams;
  if (upstreams.length === 1) return upstreams[0];

  const idx = rrIndex.get(route.id) ?? 0;
  const upstream = upstreams[idx % upstreams.length];
  rrIndex.set(route.id, idx + 1);
  return upstream;
}

/**
 * Forward the incoming request to the selected upstream and pipe
 * the response back to the client.
 *
 * Resolves with a `ProxyResult` so the caller can log metrics and
 * feed the circuit breaker.
 */
export function proxyRequest(opts: ProxyOptions): Promise<ProxyResult> {
  const { route, logger, req, res } = opts;
  const upstream = selectUpstream(route);
  const start = Date.now();

  return new Promise((resolve) => {
    const targetUrl = new URL(req.url ?? '/', upstream.url);
    const method = req.method ?? 'GET';

    const headers = { ...req.headers };
    // Forward the original host as X-Forwarded-Host
    headers['x-forwarded-host'] = headers.host ?? '';
    headers['x-forwarded-for'] = (headers['x-forwarded-for'] as string ?? '') + (req.socket.remoteAddress ?? '');

    const proxyReq = httpRequest(
      {
        method,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        headers,
        agent,
        timeout: upstream.timeout ?? 30000,
      },
      (proxyRes) => {
        // Copy upstream response headers
        const respHeaders = { ...proxyRes.headers };
        delete respHeaders['transfer-encoding']; // Let Node handle chunking

        res.writeHead(proxyRes.statusCode ?? 502, respHeaders);
        proxyRes.pipe(res);

        proxyRes.on('end', () => {
          const duration = Date.now() - start;
          resolve({
            statusCode: proxyRes.statusCode ?? 502,
            upstream: upstream.name,
            durationMs: duration,
          });
        });
      },
    );

    proxyReq.on('error', (err) => {
      const duration = Date.now() - start;
      logger.error('Proxy error', {
        routeId: route.id,
        upstream: upstream.name,
        error: err.message,
      });
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Gateway', upstream: upstream.name }));
      }
      resolve({
        statusCode: 502,
        upstream: upstream.name,
        durationMs: duration,
        error: err.message,
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      const duration = Date.now() - start;
      logger.error('Proxy timeout', {
        routeId: route.id,
        upstream: upstream.name,
      });
      if (!res.headersSent) {
        res.writeHead(504, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway Timeout', upstream: upstream.name }));
      }
      resolve({
        statusCode: 504,
        upstream: upstream.name,
        durationMs: duration,
        error: 'timeout',
      });
    });

    // Pipe the request body to the upstream
    req.pipe(proxyReq);
  });
}

/** Reset the round-robin index (for testing). */
export function resetRoundRobin(): void {
  rrIndex.clear();
}
