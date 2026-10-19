/**
 * HTTP server for the Streamline API Gateway.
 *
 * Ties together the router, proxy, rate limiter, circuit breaker,
 * metrics, and logging into a single request-handling pipeline.
 * Supports graceful shutdown on SIGINT / SIGTERM.
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import type { GatewayConfig, RouteConfig } from './types';
import { Router, RequestContext } from './router';
import { RateLimiter } from './rateLimiter';
import { CircuitBreakerManager, isFailureStatus } from './circuitBreaker';
import { MetricsCollector } from './metrics';
import { Logger } from './logger';
import { proxyRequest } from './proxy';
import { handleHealthCheck } from './healthCheck';
import { HotReloader } from './hotReload';

export interface ServerOptions {
  config: GatewayConfig;
  logger?: Logger;
}

export class GatewayServer {
  private server: Server | null = null;
  private router: Router;
  private breaker: CircuitBreakerManager;
  private metrics: MetricsCollector;
  private logger: Logger;
  private config: GatewayConfig;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private globalRateLimiter: RateLimiter | null = null;
  private hotReloader: HotReloader | null = null;
  private startTime: number;
  private shuttingDown: boolean = false;

  constructor(opts: ServerOptions) {
    this.config = opts.config;
    this.logger = opts.logger ?? new Logger();
    this.router = new Router(this.config);
    this.breaker = new CircuitBreakerManager();
    this.metrics = new MetricsCollector();
    this.startTime = Date.now();

    // Set up per-route rate limiters
    for (const route of this.config.routes) {
      if (route.rateLimit) {
        this.rateLimiters.set(route.id, new RateLimiter(route.rateLimit));
      }
    }

    // Global rate limiter
    if (this.config.globalRateLimit) {
      this.globalRateLimiter = new RateLimiter(this.config.globalRateLimit);
    }
  }

  /**
   * Start listening for HTTP requests.
   */
  listen(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.listen(this.config.port, this.config.host, () => {
        this.logger.info('Gateway started', {
          port: this.config.port,
          host: this.config.host,
          routes: this.config.routes.length,
        });
        resolve();
      });

      // Graceful shutdown
      const shutdown = (signal: string) => {
        if (this.shuttingDown) return;
        this.shuttingDown = true;
        this.logger.info('Shutting down', { signal });
        this.stop().then(() => process.exit(0));
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    });
  }

  /**
   * Handle a single HTTP request through the full middleware pipeline.
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const ctx: RequestContext = {
      method: req.method ?? 'GET',
      path: req.url ?? '/',
      headers: req.headers as Record<string, string | string[] | undefined>,
      ip: req.socket.remoteAddress ?? 'unknown',
    };

    // Health check
    if (ctx.path === this.config.healthCheckPath) {
      handleHealthCheck(res, this.router, this.breaker, this.startTime);
      return;
    }

    // Metrics endpoint
    if (ctx.path === this.config.metricsPath) {
      this.metrics.writeMetrics(res, this.breaker);
      return;
    }

    // Route matching
    const match = this.router.match(ctx);
    if (!match.matched || !match.route) {
      this.metrics.recordRequest('unmatched', 404, 0);
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'No route', path: ctx.path }));
      return;
    }

    const route = match.route;

    // Global rate limit check
    if (this.globalRateLimiter) {
      const key = RateLimiter.extractKey('ip', ctx);
      if (!this.globalRateLimiter.allow(key)) {
        this.metrics.recordRejection();
        res.writeHead(429, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limited' }));
        return;
      }
    }

    // Per-route rate limit check
    const routeLimiter = this.rateLimiters.get(route.id);
    if (routeLimiter) {
      const keyType = route.rateLimit?.key ?? 'ip';
      const key = RateLimiter.extractKey(keyType, ctx);
      if (!routeLimiter.allow(key)) {
        this.metrics.recordRejection();
        res.writeHead(429, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limited', route: route.id }));
        return;
      }
    }

    // Circuit breaker check
    if (!this.breaker.allowRequest(route.id, route.circuitBreaker)) {
      this.metrics.recordRequest(route.id, 503, 0);
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Circuit open', route: route.id }));
      return;
    }

    // Proxy the request
    const result = await proxyRequest({ route, logger: this.logger, req, res });

    // Record metrics
    this.metrics.recordRequest(route.id, result.statusCode, result.durationMs);

    // Update circuit breaker
    if (isFailureStatus(result.statusCode, route.circuitBreaker?.failureStatuses)) {
      this.breaker.recordFailure(route.id, route.circuitBreaker);
    } else {
      this.breaker.recordSuccess(route.id);
    }

    // Log the request
    if (route.logging && this.config.logging) {
      this.logger.request({
        timestamp: new Date().toISOString(),
        method: ctx.method,
        path: ctx.path,
        routeId: route.id,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        upstream: result.upstream,
      });
    }
  }

  /**
   * Hot-reload the configuration without restarting the server.
   */
  reloadConfig(newConfig: GatewayConfig): void {
    this.config = newConfig;
    this.router.updateRoutes(newConfig.routes);

    // Rebuild rate limiters
    this.rateLimiters.clear();
    for (const route of newConfig.routes) {
      if (route.rateLimit) {
        this.rateLimiters.set(route.id, new RateLimiter(route.rateLimit));
      }
    }

    if (newConfig.globalRateLimit) {
      this.globalRateLimiter = new RateLimiter(newConfig.globalRateLimit);
    }

    this.logger.info('Configuration reloaded', { routes: newConfig.routes.length });
  }

  /**
   * Enable config hot-reload (file watching).
   */
  enableHotReload(): void {
    if (!this.config.configPath) {
      this.logger.warn('Hot-reload requires a config file path');
      return;
    }
    this.hotReloader = new HotReloader(
      this.config.configPath,
      (config) => this.reloadConfig(config),
      this.logger,
    );
    this.hotReloader.start();
  }

  /**
   * Stop the server and clean up.
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.hotReloader) {
        this.hotReloader.stop();
      }
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // --- Accessors for testing ---

  getRouter(): Router { return this.router; }
  getBreaker(): CircuitBreakerManager { return this.breaker; }
  getMetrics(): MetricsCollector { return this.metrics; }
  getConfig(): GatewayConfig { return this.config; }
}
