![Toolnook](docs/assets/toolnook-logo.svg)

# Toolnook Backend

**A helpful front door for Stellar data.** This service sits between your app and Stellar's Horizon API, helping handle repeated requests and temporary upstream problems.

[Read the beginner-friendly guide](https://toolnook.github.io/backend/) · [Browse all Toolnook projects](https://github.com/toolnook)

## What does it do?

Horizon is a web API that applications use to look up Stellar accounts, payments, and ledgers. Calling it directly is often fine for a small project. As your app grows, you may want a cache to reuse recent answers, request limits to avoid sending too much traffic, and a circuit breaker to pause calls when Horizon is having trouble.

Toolnook Backend provides those building blocks as a configurable API gateway. It also includes a Horizon client and a separate route for Soroban RPC. It does not replace Stellar or Horizon.

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
