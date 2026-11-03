# Changelog

All notable changes to Streamline are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-11-03

### Added
- YAML-based route configuration with validation and defaults
- Path-prefix and exact-path routing
- Header-based route matching (case-insensitive)
- HTTP method filtering per route
- Token-bucket rate limiter (per-route and global)
- Circuit breaker with closed → open → half-open state machine
- Reverse proxy with round-robin load balancing and retry support
- Structured JSON logging with configurable levels
- Prometheus-format metrics endpoint (request counts, response times, circuit states)
- Health check endpoint with per-route circuit status
- Config hot-reload via file watching with debounce
- Graceful shutdown on SIGINT/SIGTERM
- Full test suite (unit + integration)
- CI workflow for GitHub Actions
- Example configuration file
- Issue templates and PR template

[0.1.0]: https://github.com/crafstack/streamline/releases/tag/v0.1.0
