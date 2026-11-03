# Toolnook Backend — Stellar Horizon Gateway

A rate-limiting, caching, and circuit-breaking gateway for the Stellar Horizon API. Built to help developers and applications access Stellar network data reliably without hitting rate limits or cascading failures when Horizon is degraded.

Part of the [Toolnook](https://github.com/toolnook) Stellar developer tooling platform:

| Repo | Role |
|------|------|
| **toolnook/backend** | Horizon gateway with caching, rate limiting, circuit breaker |
| [toolnook/frontend](https://github.com/toolnook/frontend) | Soroban contract documentation generator |
| [toolnook/contracts](https://github.com/toolnook/contracts) | XLM payment reconciliation and double-entry ledger |

## Why this helps Stellar

The Stellar Horizon API enforces rate limits. Applications that query account balances, transaction history, or ledger data frequently will hit 429s. Toolnook Backend sits in front of Horizon and:

- **Caches** idempotent GET responses (account details, ledgers, transactions) to reduce load on Horizon
- **Rate-limits** outgoing requests so your app stays under Horizon's limits
- **Circuit-breaks** when Horizon returns repeated 5xx errors, preventing cascading failures
- **Validates** Stellar network passphrases (public vs testnet) to prevent cross-network mistakes
- **Exposes** Prometheus metrics so you can monitor Horizon API usage

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
stellar:
  network: public        # or testnet
  horizonUrl: https://horizon.stellar.org
  cacheTtl: 10000         # cache responses for 10 seconds

routes:
  - id: horizon
    path: /
    pathPrefix: true
    upstreams:
      - name: stellar-horizon
        url: https://horizon.stellar.org
    rateLimit:
      capacity: 100       # 100 requests per
      refillRate: 50       # 50 per second (stays under Horizon limits)
    circuitBreaker:
      threshold: 5        # trip after 5 consecutive 5xx
      resetTimeout: 30000

  - id: soroban
    path: /soroban
    pathPrefix: true
    upstreams:
      - name: soroban-rpc
        url: https://soroban-rpc.stellar.org
    circuitBreaker:
      threshold: 3
      resetTimeout: 15000
```

## Stellar-specific modules

| Module | File | What it does |
|--------|------|-------------|
| Horizon client | `src/stellar/horizon.ts` | Cached Horizon API calls with network passphrase validation |
| Network config | `src/stellar/network.ts` | Public/testnet URL resolution and health checking |
| Rate limiter | `src/rateLimiter.ts` | Token bucket to stay under Horizon limits |
| Circuit breaker | `src/circuitBreaker.ts` | Protects against Horizon 5xx cascades |
| Metrics | `src/metrics.ts` | Prometheus metrics for monitoring Horizon usage |

## Horizon client

```typescript
import { HorizonClient } from './src/stellar/horizon';

const client = new HorizonClient({
  baseUrl: 'https://horizon.stellar.org',
  network: 'public',
  cacheTtl: 10000,
});

// Cached account lookup
const account = await client.getAccount('GABC...');

// Latest ledger
const ledger = await client.getLatestLedger();

// Payment history (paginated)
const { payments, nextCursor } = await client.getPayments('GABC...');
```

## Running tests

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
