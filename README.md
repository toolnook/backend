# Streamline

A lightweight, self-hosted API gateway and reverse proxy for managing and routing requests to microservices. Think of it as a minimal, configurable alternative to Kong or Traefik for small teams.

## What it does

Streamline sits in front of your backend services and:

- **Routes** incoming HTTP requests to the right upstream based on path prefixes, exact paths, HTTP methods, and header rules
- **Rate-limits** requests per route using a token-bucket algorithm
- **Protects** upstream services with a circuit-breaker pattern that trips on repeated failures
- **Logs** every request as structured JSON for easy ingestion into log aggregators
- **Exposes** a Prometheus-format metrics endpoint for monitoring
- **Hot-reloads** its YAML configuration without restarting

## Why it exists

Most API gateways (Kong, Traefik, Tyk) are powerful but heavy — they require a database, plugins, or a complex control plane. Streamline is a single Node.js process configured by one YAML file. It's for small teams that need routing, rate limiting, and circuit breaking without the operational overhead.

## Quick start

```bash
# Clone and install
git clone https://github.com/forgekit/streamline.git
cd streamline
npm install

# Copy the example config
cp config.example.yaml config.yaml

# Start the gateway
npm start
```

Or run directly:

```bash
npx streamline-gateway ./config.yaml
```

## Configuration

Streamline reads a YAML file (default `./config.yaml`). Set the path via:

```bash
node dist/index.js /path/to/config.yaml
# or
GATEWAY_CONFIG=/path/to/config.yaml npm start
```

### Example

```yaml
port: 8080
host: 0.0.0.0

routes:
  - id: users
    path: /api/users          # prefix match by default
    methods: [GET, POST]
    upstreams:
      - name: user-service
        url: http://localhost:3001
        timeout: 10000
    rateLimit:
      capacity: 20
      refillRate: 10
    circuitBreaker:
      threshold: 5
      resetTimeout: 30000
```

See [`config.example.yaml`](config.example.yaml) for a full example.

## Architecture overview

```
                    ┌─────────────────────────────────────────┐
                    │            Streamline Gateway            │
  HTTP Request ───►│  ┌─────────┐  ┌──────────┐  ┌─────────┐  │──► Upstream 1
                    │  │  Router  │→│ Rate Lim │→│ Circuit │  │──► Upstream 2
                    │  └─────────┘  └──────────┘  └─────────┘  │
                    │       │            │            │        │
                    │  ┌────▼────────────▼────────────▼─────┐  │
                    │  │           Proxy Handler             │  │
                    │  └────────────────────────────────────┘  │
                    │       │                                   │
                    │  ┌────▼────┐  ┌────────┐  ┌───────────┐  │
                    │  │ Metrics │  │ Logger │  │Health Chk │  │
                    │  └─────────┘  └────────┘  └───────────┘  │
                    └─────────────────────────────────────────┘
```

### Request pipeline

1. **Router** — matches the request path, method, and headers against configured routes
2. **Rate limiter** — checks the token bucket for the route (and optionally per-IP)
3. **Circuit breaker** — checks whether the upstream circuit is open
4. **Proxy** — forwards the request to the selected upstream (round-robin if multiple)
5. **Logger** — writes a structured JSON log entry
6. **Metrics** — records request count, status, and response time

### Key modules

| Module | File | Responsibility |
|--------|------|----------------|
| Config loader | `src/config.ts` | Parse and validate YAML config |
| Router | `src/router.ts` | Path/header/method matching |
| Rate limiter | `src/rateLimiter.ts` | Token-bucket algorithm |
| Circuit breaker | `src/circuitBreaker.ts` | Closed → open → half-open state machine |
| Proxy | `src/proxy.ts` | HTTP reverse proxy with round-robin |
| Logger | `src/logger.ts` | Structured JSON logging |
| Metrics | `src/metrics.ts` | Prometheus-format metrics |
| Health check | `src/healthCheck.ts` | Liveness + circuit state |
| Hot reload | `src/hotReload.ts` | File-watching config reload |
| Server | `src/server.ts` | Ties everything together |

## Endpoints

| Path | Description |
|------|-------------|
| `GET /health` | Gateway health status with per-route circuit states |
| `GET /metrics` | Prometheus-format metrics |

## Unique features

### Circuit breaker

Each route can have a circuit breaker that opens after N consecutive failures, short-circuiting requests to the upstream. After a configurable reset timeout, the breaker enters half-open mode and allows one trial request. If it succeeds, the circuit closes; if it fails, it re-opens.

```yaml
circuitBreaker:
  threshold: 5         # failures before opening
  resetTimeout: 30000  # ms before half-open trial
  failureStatuses: [500, 502, 503, 504]
```

### Prometheus metrics

The `/metrics` endpoint exposes:

- `streamline_requests_total` — total requests
- `streamline_requests_by_route{route="..."}` — per-route counts
- `streamline_requests_by_status{status="..."}` — status code distribution
- `streamline_response_time_ms{quantile="..."}` — avg, p50, p99
- `streamline_rate_limit_rejections` — rate-limited request count
- `streamline_circuit_state{route="..."}` — circuit breaker state (0=closed, 1=half-open, 2=open)

## Running tests

```bash
npm test
```

Tests cover all modules with unit tests and the full request pipeline with integration tests (a real upstream server is spun up in the test harness).

## Roadmap

- [ ] TLS termination
- [ ] Request/response transformation middleware
- [ ] WebSocket support
- [ ] Distributed rate limiting (Redis backend)
- [ ] Dashboard UI for route management
- [ ] gRPC proxying

## License

MIT — see [LICENSE](LICENSE).
