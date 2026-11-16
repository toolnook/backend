![Toolnook](docs/assets/toolnook-logo.svg)

# Toolnook Backend

**The API gateway for AssetScope.** The gateway routes browser requests to the issuer snapshot API and dashboard, with rate limiting, health checks, and upstream failure handling.

[Read the beginner-friendly guide](https://toolnook.github.io/backend/) · [Browse all Toolnook projects](https://github.com/toolnook)

## What does it do?

The gateway is the entry point for the AssetScope dashboard. It serves the UI from the Frontend service and forwards `/api/assetscope/*` requests to the Contracts snapshot API. The underlying data and calculation code stays in the Contracts repository; this service does not duplicate that business logic.

## Try it locally

You need Node.js 18 or newer.

```bash
git clone https://github.com/toolnook/backend.git
cd backend
npm ci
npm run build
cp config.example.yaml config.yaml
npm start
```

The server reads `config.yaml`. Start with `config.example.yaml` and choose `public` or `testnet` deliberately so your app uses the intended Stellar network.

## Run the integrated AssetScope app locally

Start the three services in separate terminals. The gateway config binds to localhost and expects the other two services on their documented local ports.

```bash
# Terminal 1: Contracts API
cd ../contracts
python3 -m pip install -e .
asset-scope-api --host 127.0.0.1 --port 8091

# Terminal 2: Frontend dashboard
cd ../frontend
go run ./cmd/assetscope --addr 127.0.0.1:8090

# Terminal 3: Backend gateway
cd ../backend
npm ci
npm run build
npm start -- config.assetscope.yaml
```

Open `http://127.0.0.1:8080`. The browser sends the three CSV snapshots through the gateway to the Contracts API. This local prototype has no authentication; keep it bound to localhost and do not expose it to the public internet.

## Concepts in plain language

| Term | Meaning |
| --- | --- |
| Horizon | Stellar's HTTP API for network data such as accounts and payments. |
| Cache | A short-lived saved response, so identical reads do not need to be fetched again immediately. |
| Rate limit | A cap on how quickly requests are sent. |
| Circuit breaker | A pause after repeated upstream failures, allowing a struggling service time to recover. |
| Soroban RPC | An API used to interact with Soroban smart contracts. |

## Explore and contribute

- [Project guide and configuration examples](https://toolnook.github.io/backend/)
- [Source code](https://github.com/toolnook/backend)
- [Report a problem](https://github.com/toolnook/backend/issues)
- [Contribution guide](CONTRIBUTING.md)

Run the test suite with `npm test`. This project is open source under the [MIT License](LICENSE).
