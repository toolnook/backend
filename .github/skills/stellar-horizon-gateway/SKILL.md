---
name: stellar-horizon-gateway
description: Use when configuring, extending, or explaining Toolnook Backend's Stellar Horizon and Soroban RPC gateway.
---

# Stellar Horizon gateway

Help maintain the gateway that routes requests to Stellar Horizon and Soroban RPC.

- Read the existing route configuration and tests before changing behavior. Reuse its current rate-limit, cache, health-check, and circuit-breaker patterns.
- Explain the public network and testnet as separate environments. Never suggest using a secret key for a read-only Horizon request.
- Keep upstream URLs, network passphrases, and cache behavior consistent; add or adjust focused tests when changing them.
- Treat upstream errors and invalid configuration explicitly. Do not silently substitute another network or return made-up successful data.
- For documentation, define terms such as Horizon, cache, rate limit, and circuit breaker the first time they appear.
- Run the relevant tests and build after code changes. Do not include credentials or add contributor/author entries that were not requested.
