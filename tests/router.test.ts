import { Router, RequestContext } from '../src/router';
import { GatewayConfig, RouteConfig } from '../src/types';

function makeConfig(routes: RouteConfig[]): GatewayConfig {
  return { port: 8080, routes };
}

function makeCtx(method: string, path: string, headers?: Record<string, string>): RequestContext {
  return {
    method,
    path,
    headers: headers ?? {},
    ip: '127.0.0.1',
  };
}

describe('Router', () => {
  const routes: RouteConfig[] = [
    {
      id: 'users',
      path: '/api/users',
      pathPrefix: true,
      upstreams: [{ name: 'user-svc', url: 'http://localhost:3001' }],
    },
    {
      id: 'orders-exact',
      path: '/api/orders',
      pathPrefix: false,
      upstreams: [{ name: 'order-svc', url: 'http://localhost:3002' }],
    },
    {
      id: 'api-key',
      path: '/api/secure',
      pathPrefix: true,
      headers: [{ name: 'X-API-Key', value: 'secret123' }],
      upstreams: [{ name: 'secure-svc', url: 'http://localhost:3003' }],
    },
    {
      id: 'post-only',
      path: '/api/submit',
      pathPrefix: true,
      methods: ['POST'],
      upstreams: [{ name: 'submit-svc', url: 'http://localhost:3004' }],
    },
  ];

  const router = new Router(makeConfig(routes));

  test('matches a prefix path', () => {
    const result = router.match(makeCtx('GET', '/api/users/123'));
    expect(result.matched).toBe(true);
    expect(result.route?.id).toBe('users');
  });

  test('matches exact path only when pathPrefix is false', () => {
    const exact = router.match(makeCtx('GET', '/api/orders'));
    expect(exact.matched).toBe(true);
    expect(exact.route?.id).toBe('orders-exact');

    const notExact = router.match(makeCtx('GET', '/api/orders/123'));
    expect(notExact.matched).toBe(false);
  });

  test('matches header-based routing when header matches', () => {
    const result = router.match(makeCtx('GET', '/api/secure/data', { 'X-API-Key': 'secret123' }));
    expect(result.matched).toBe(true);
    expect(result.route?.id).toBe('api-key');
  });

  test('does not match header-based routing when header is missing', () => {
    const result = router.match(makeCtx('GET', '/api/secure/data'));
    expect(result.matched).toBe(false);
  });

  test('does not match header-based routing when header value is wrong', () => {
    const result = router.match(makeCtx('GET', '/api/secure/data', { 'X-API-Key': 'wrong' }));
    expect(result.matched).toBe(false);
  });

  test('matches only specified HTTP methods', () => {
    const post = router.match(makeCtx('POST', '/api/submit/form'));
    expect(post.matched).toBe(true);

    const get = router.match(makeCtx('GET', '/api/submit/form'));
    expect(get.matched).toBe(false);
  });

  test('returns no match for unknown path', () => {
    const result = router.match(makeCtx('GET', '/unknown'));
    expect(result.matched).toBe(false);
    expect(result.route).toBeNull();
  });

  test('routeCount returns the number of routes', () => {
    expect(router.routeCount()).toBe(4);
  });

  test('updateRoutes replaces the route table', () => {
    const router2 = new Router(makeConfig(routes));
    const newRoutes: RouteConfig[] = [
      { id: 'new', path: '/new', pathPrefix: true, upstreams: [{ name: 'u', url: 'http://localhost:4000' }] },
    ];
    router2.updateRoutes(newRoutes);
    expect(router2.routeCount()).toBe(1);
    expect(router2.match(makeCtx('GET', '/new')).route?.id).toBe('new');
  });
});
