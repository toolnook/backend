import { parseConfig } from '../src/config';
import { mergeConfigs } from '../src/config';
import { GatewayConfig } from '../src/types';

describe('Config loader', () => {
  const validYaml = `
port: 8080
host: 127.0.0.1
routes:
  - id: users
    path: /api/users
    upstreams:
      - name: user-service
        url: http://localhost:3001
    rateLimit:
      capacity: 10
      refillRate: 5
    circuitBreaker:
      threshold: 3
      resetTimeout: 5000
  - id: orders
    path: /api/orders
    pathPrefix: false
    methods: [POST, GET]
    upstreams:
      - name: order-service
        url: http://localhost:3002
        timeout: 10000
        retries: 2
`;

  test('parses valid YAML config with correct port and host', () => {
    const config = parseConfig(validYaml, '/tmp/config.yaml');
    expect(config.port).toBe(8080);
    expect(config.host).toBe('127.0.0.1');
  });

  test('parses routes with upstreams', () => {
    const config = parseConfig(validYaml, '/tmp/config.yaml');
    expect(config.routes).toHaveLength(2);
    expect(config.routes[0].id).toBe('users');
    expect(config.routes[0].upstreams[0].name).toBe('user-service');
    expect(config.routes[0].upstreams[0].url).toBe('http://localhost:3001');
  });

  test('applies default pathPrefix=true when omitted', () => {
    const config = parseConfig(validYaml, '/tmp/config.yaml');
    expect(config.routes[0].pathPrefix).toBe(true);
  });

  test('respects explicit pathPrefix=false', () => {
    const config = parseConfig(validYaml, '/tmp/config.yaml');
    expect(config.routes[1].pathPrefix).toBe(false);
  });

  test('applies default timeout of 30000ms when omitted', () => {
    const config = parseConfig(validYaml, '/tmp/config.yaml');
    expect(config.routes[0].upstreams[0].timeout).toBe(30000);
  });

  test('respects explicit upstream timeout', () => {
    const config = parseConfig(validYaml, '/tmp/config.yaml');
    expect(config.routes[1].upstreams[0].timeout).toBe(10000);
    expect(config.routes[1].upstreams[0].retries).toBe(2);
  });

  test('parses rate limit and circuit breaker configs', () => {
    const config = parseConfig(validYaml, '/tmp/config.yaml');
    expect(config.routes[0].rateLimit).toEqual({ capacity: 10, refillRate: 5 });
    expect(config.routes[0].circuitBreaker).toEqual({ threshold: 3, resetTimeout: 5000 });
  });

  test('throws on missing port', () => {
    const badYaml = `routes: []`;
    expect(() => parseConfig(badYaml)).toThrow('port');
  });

  test('throws on invalid port', () => {
    const badYaml = `port: 99999\nroutes: []`;
    expect(() => parseConfig(badYaml)).toThrow('port');
  });

  test('throws on missing routes array', () => {
    const badYaml = `port: 8080`;
    expect(() => parseConfig(badYaml)).toThrow('routes');
  });

  test('throws on route without upstreams', () => {
    const badYaml = `port: 8080\nroutes:\n  - id: test\n    path: /test`;
    expect(() => parseConfig(badYaml)).toThrow('upstream');
  });

  test('throws on invalid YAML', () => {
    const badYaml = `port: [unclosed`;
    expect(() => parseConfig(badYaml)).toThrow();
  });

  test('mergeConfigs updates routes', () => {
    const base: GatewayConfig = {
      port: 8080,
      routes: [{ id: 'a', path: '/a', pathPrefix: true, upstreams: [{ name: 'u', url: 'http://localhost:3000' }] }],
    };
    const merged = mergeConfigs(base, {
      port: 9090,
      routes: [{ id: 'b', path: '/b', pathPrefix: true, upstreams: [{ name: 'u', url: 'http://localhost:3001' }] }],
    });
    expect(merged.port).toBe(9090);
    expect(merged.routes).toHaveLength(1);
    expect(merged.routes[0].id).toBe('b');
  });
});
