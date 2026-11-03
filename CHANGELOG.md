# Changelog

All notable changes to Streamline are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-11-03

### Added
- Stellar Horizon client with response caching and network passphrase validation
- Network configuration module with public/testnet endpoint resolution
- Horizon health checking endpoint
- Stroop-to-XLM conversion utilities
- Stellar account ID and transaction hash validation
- YAML-based route configuration with validation
- Path-prefix, exact-path, header-based, and HTTP method routing
- Token-bucket rate limiter (per-route and global)
- Circuit breaker with closed → open → half-open state machine
- Reverse proxy with round-robin load balancing
- Structured JSON logging
- Prometheus-format metrics endpoint
- Config hot-reload via file watching
- Graceful shutdown on SIGINT/SIGTERM
- Full test suite including Stellar module tests
- CI workflow for GitHub Actions
- Issue templates and PR template

[0.1.0]: https://github.com/toolnook/backend/releases/tag/v0.1.0
