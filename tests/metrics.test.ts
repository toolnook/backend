import { MetricsCollector } from '../src/metrics';
import { CircuitBreakerManager } from '../src/circuitBreaker';

describe('MetricsCollector', () => {
  test('records and counts total requests', () => {
    const m = new MetricsCollector();
    m.recordRequest('users', 200, 10);
    m.recordRequest('users', 200, 20);
    m.recordRequest('orders', 404, 5);
    expect(m.getTotalRequests()).toBe(3);
  });

  test('counts requests per route', () => {
    const m = new MetricsCollector();
    m.recordRequest('users', 200, 10);
    m.recordRequest('users', 200, 20);
    m.recordRequest('orders', 200, 5);
    expect(m.getRouteRequests('users')).toBe(2);
    expect(m.getRouteRequests('orders')).toBe(1);
    expect(m.getRouteRequests('unknown')).toBe(0);
  });

  test('calculates average response time', () => {
    const m = new MetricsCollector();
    m.recordRequest('r', 200, 10);
    m.recordRequest('r', 200, 20);
    m.recordRequest('r', 200, 30);
    expect(m.getAverageResponseTime()).toBe(20);
  });

  test('calculates percentile response time', () => {
    const m = new MetricsCollector();
    for (let i = 1; i <= 100; i++) {
      m.recordRequest('r', 200, i);
    }
    expect(m.getPercentileResponseTime(50)).toBeGreaterThanOrEqual(49);
    expect(m.getPercentileResponseTime(99)).toBeGreaterThanOrEqual(98);
  });

  test('tracks rate-limit rejections', () => {
    const m = new MetricsCollector();
    m.recordRejection();
    m.recordRejection();
    m.recordRejection();
    expect(m.getRejectionCount()).toBe(3);
  });

  test('renders Prometheus format output', () => {
    const m = new MetricsCollector();
    m.recordRequest('users', 200, 42);
    const output = m.renderPrometheus();
    expect(output).toContain('streamline_requests_total 1');
    expect(output).toContain('streamline_requests_by_route{route="users"} 1');
    expect(output).toContain('streamline_requests_by_status{status="200"} 1');
    expect(output).toContain('# TYPE streamline_requests_total counter');
  });

  test('includes circuit breaker state in Prometheus output', () => {
    const m = new MetricsCollector();
    const breaker = new CircuitBreakerManager({ threshold: 1, resetTimeout: 5000 });
    breaker.recordFailure('route1');
    const output = m.renderPrometheus(breaker);
    expect(output).toContain('streamline_circuit_state{route="route1"} 2');
  });

  test('reset clears all metrics', () => {
    const m = new MetricsCollector();
    m.recordRequest('r', 200, 10);
    m.recordRejection();
    m.reset();
    expect(m.getTotalRequests()).toBe(0);
    expect(m.getRejectionCount()).toBe(0);
  });
});
