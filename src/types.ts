/**
 * Core type definitions for the Streamline API Gateway.
 *
 * These interfaces describe route configuration, upstream service
 * definitions, and middleware options that the gateway uses to
 * route and proxy incoming requests.
 */

/** A single upstream service that the gateway can proxy to. */
export interface Upstream {
  /** Human-readable name for the upstream (used in logs and metrics). */
  name: string;
  /** Target URL including scheme, host, and port (e.g. `http://localhost:3001`). */
  url: string;
  /** Connection timeout in milliseconds (default 30 000). */
  timeout?: number;
  /** Number of retry attempts on failure (default 0). */
  retries?: number;
}

/** Header-based matching rule for advanced routing. */
export interface HeaderMatch {
  /** Header name to check (case-insensitive). */
  name: string;
  /** Expected header value. If omitted, matches any value (presence check). */
  value?: string;
}

/** Route definition parsed from the YAML config. */
export interface RouteConfig {
  /** Unique route identifier (used in logs and metrics). */
  id: string;
  /** Path prefix or exact path to match (e.g. `/api/v1/users`). */
  path: string;
  /** Whether `path` is a prefix match (`true`, default) or an exact match (`false`). */
  pathPrefix?: boolean;
  /** HTTP methods to match; empty or omitted means all methods. */
  methods?: string[];
  /** Header rules — all must match for the route to apply. */
  headers?: HeaderMatch[];
  /** Upstream services to proxy to (round-robin if more than one). */
  upstreams: Upstream[];
  /** Rate-limiting options for this route. */
  rateLimit?: RateLimitConfig;
  /** Circuit-breaker options for this route. */
  circuitBreaker?: CircuitBreakerConfig;
  /** Whether request/response logging is enabled for this route (default true). */
  logging?: boolean;
}

/** Token-bucket rate-limit configuration. */
export interface RateLimitConfig {
  /** Maximum tokens in the bucket (burst capacity). */
  capacity: number;
  /** Tokens added per second (refill rate). */
  refillRate: number;
  /** Key to bucket on: `ip`, `path`, or `header:<name>`. Default `ip`. */
  key?: string;
}

/** Circuit-breaker configuration. */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. */
  threshold: number;
  /** Time in ms before attempting to half-open the circuit. */
  resetTimeout: number;
  /** HTTP status codes that count as failures (default 500–599). */
  failureStatuses?: number[];
}

/** Top-level gateway configuration. */
export interface GatewayConfig {
  /** Port the gateway listens on. */
  port: number;
  /** Host/interface to bind (default `0.0.0.0`). */
  host?: string;
  /** Path to the config file (set internally). */
  configPath?: string;
  /** Global rate-limit applied to all routes. */
  globalRateLimit?: RateLimitConfig;
  /** Health-check endpoint path (default `/health`). */
  healthCheckPath?: string;
  /** Metrics endpoint path (default `/metrics`). */
  metricsPath?: string;
  /** Whether structured logging is enabled (default true). */
  logging?: boolean;
  /** Routes loaded from the YAML file. */
  routes: RouteConfig[];
}

/** Request-level log entry. */
export interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  routeId: string | null;
  statusCode: number;
  durationMs: number;
  upstream: string | null;
  message?: string;
  [key: string]: unknown;
}

/** Metrics snapshot for the Prometheus endpoint. */
export interface MetricsSnapshot {
  requestsTotal: number;
  requestsByRoute: Record<string, number>;
  requestsByStatus: Record<number, number>;
  responseTimeMs: number;
  circuitBreakerState: Record<string, string>;
  rateLimitRejections: number;
}
