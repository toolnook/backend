# Toolnook Backend

The API gateway and reverse proxy for the Toolnook platform. A lightweight, self-hostable service for routing requests to microservices with rate limiting, circuit breaking, and Prometheus metrics.

Part of the [Toolnook](https://github.com/toolnook) open-source developer infrastructure platform:

| Repo | Role |
|------|------|
| **toolnook/backend** | API gateway, reverse proxy, rate limiting, circuit breaker |
| [toolnook/frontend](https://github.com/toolnook/frontend) | Documentation-as-code generator with dependency graphs |
| [toolnook/contracts](https://github.com/toolnook/contracts) | Double-entry accounting CLI with project profitability |

## What it does

Toolnook Backend sits in front of your services and:

- **Routes** incoming HTTP requests to the right upstream based on path, method, and headers
- **Rate-limits** requests per route using a token-bucket algorithm
- **Protects** upstream services with a circuit breaker that trips on repeated failures
- **Logs** every request as structured JSON
- **Exposes** a Prometheus-format metrics endpoint
- **Hot-reloads** its YAML configuration without restarting

## Quick start

```bash
git clone https://github.com/toolnook/backend.git
cd backend
npm install
cp config.example.yaml config.yaml
npm start
```

## Configuration

```yaml
port: 8080
routes:
  - id: users
    path: /api/users
    upstreams:
      - name: user-service
        url: http://localhost:3001
    rateLimit:
      capacity: 20
      refillRate: 10
    circuitBreaker:
      threshold: 5
      resetTimeout: 30000
```

See [`config.example.yaml`](config.example.yaml) for a full example.

## Endpoints

| Path | Description |
|------|-------------|
| `GET /health` | Gateway health with per-route circuit states |
| `GET /metrics` | Prometheus-format metrics |

## Architecture

```
Request → Router → Rate Limiter → Circuit Breaker → Proxy → Upstream
                                                        ↓
                                              Logger + Metrics
```

| Module | File | Responsibility |
|--------|------|----------------|
| Config | `src/config.ts` | YAML parsing and validation |
| Router | `src/router.ts` | Path/header/method matching |
| Rate limiter | `src/rateLimiter.ts` | Token-bucket algorithm |
| Circuit breaker | `src/circuitBreaker.ts` | Closed → open → half-open state machine |
| Proxy | `src/proxy.ts` | HTTP reverse proxy with round-robin |
| Metrics | `src/metrics.ts` | Prometheus-format metrics |
| Server | `src/server.ts` | Full request pipeline |

## Running tests

```bash
npm test
```

## Roadmap

- [ ] TLS termination
- [ ] Request/response transformation
- [ ] WebSocket support
- [ ] Distributed rate limiting (Redis)

## License

MIT — see [LICENSE](LICENSE).
