/**
 * Prometheus-format metrics collector for the Streamline API Gateway.
 *
 * Tracks request counts, response time, rate-limit rejections, and
 * circuit-breaker state.  Exposes them via the `/metrics` endpoint in
 * the text-based Prometheus exposition format.
 */

import type { ServerResponse } from 'http';
import type { CircuitBreakerManager } from './circuitBreaker';

export class MetricsCollector {
  private requestsTotal: number = 0;
  private requestsByRoute: Map<string, number> = new Map();
  private requestsByStatus: Map<number, number> = new Map();
  private responseTimes: number[] = [];
  private rateLimitRejections: number = 0;
  private readonly maxResponseTimeSamples: number = 1000;

  /** Record a completed request. */
  recordRequest(routeId: string, statusCode: number, durationMs: number): void {
    this.requestsTotal++;
    this.requestsByRoute.set(routeId, (this.requestsByRoute.get(routeId) ?? 0) + 1);
    this.requestsByStatus.set(statusCode, (this.requestsByStatus.get(statusCode) ?? 0) + 1);

    // Ring buffer for response times (keep memory bounded)
    if (this.responseTimes.length >= this.maxResponseTimeSamples) {
      this.responseTimes.shift();
    }
    this.responseTimes.push(durationMs);
  }

  /** Record a rate-limit rejection. */
  recordRejection(): void {
    this.rateLimitRejections++;
  }

  /** Get the total number of recorded requests. */
  getTotalRequests(): number {
    return this.requestsTotal;
  }

  /** Calculate the average response time from collected samples. */
  getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.responseTimes.length);
  }

  /** Get the p99 response time from collected samples. */
  getPercentileResponseTime(percentile: number): number {
    if (this.responseTimes.length === 0) return 0;
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const idx = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /** Get the number of rate-limit rejections. */
  getRejectionCount(): number {
    return this.rateLimitRejections;
  }

  /** Get the number of requests recorded for a specific route. */
  getRouteRequests(routeId: string): number {
    return this.requestsByRoute.get(routeId) ?? 0;
  }

  /**
   * Render all metrics in Prometheus text exposition format.
   *
   * @param breaker - The circuit-breaker manager (to report circuit states).
   * @returns A string suitable for the `/metrics` endpoint.
   */
  renderPrometheus(breaker?: CircuitBreakerManager): string {
    const lines: string[] = [];

    // Total requests
    lines.push('# TYPE streamline_requests_total counter');
    lines.push(`streamline_requests_total ${this.requestsTotal}`);

    // Requests by route
    lines.push('# TYPE streamline_requests_by_route counter');
    for (const [routeId, count] of this.requestsByRoute) {
      lines.push(`streamline_requests_by_route{route="${routeId}"} ${count}`);
    }

    // Requests by status code
    lines.push('# TYPE streamline_requests_by_status counter');
    for (const [status, count] of this.requestsByStatus) {
      lines.push(`streamline_requests_by_status{status="${status}"} ${count}`);
    }

    // Response time histogram (summary)
    lines.push('# TYPE streamline_response_time_ms summary');
    lines.push(`streamline_response_time_ms{quantile="avg"} ${this.getAverageResponseTime()}`);
    lines.push(`streamline_response_time_ms{quantile="p50"} ${this.getPercentileResponseTime(50)}`);
    lines.push(`streamline_response_time_ms{quantile="p99"} ${this.getPercentileResponseTime(99)}`);

    // Rate-limit rejections
    lines.push('# TYPE streamline_rate_limit_rejections counter');
    lines.push(`streamline_rate_limit_rejections ${this.rateLimitRejections}`);

    // Circuit breaker states
    if (breaker) {
      lines.push('# TYPE streamline_circuit_state gauge');
      for (const routeId of breaker.getOpenCircuits()) {
        const state = breaker.getState(routeId);
        const numeric = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
        lines.push(`streamline_circuit_state{route="${routeId}"} ${numeric}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Write the metrics to an HTTP response in Prometheus format.
   */
  writeMetrics(res: ServerResponse, breaker?: CircuitBreakerManager): void {
    const body = this.renderPrometheus(breaker);
    res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
    res.end(body);
  }

  /** Reset all metrics (for testing). */
  reset(): void {
    this.requestsTotal = 0;
    this.requestsByRoute.clear();
    this.requestsByStatus.clear();
    this.responseTimes = [];
    this.rateLimitRejections = 0;
  }
}
