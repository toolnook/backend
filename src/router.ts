/**
 * Request router for the Streamline API Gateway.
 *
 * Matches incoming requests against configured routes using
 * path-based and header-based rules.
 */

import type { RouteConfig, GatewayConfig } from './types';

/** Context extracted from the incoming HTTP request. */
export interface RequestContext {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
}

/** Result of matching a request against routes. */
export interface RouteMatch {
  /** The matched route, or `null` if no route matched. */
  route: RouteConfig | null;
  /** Whether the request matched a route. */
  matched: boolean;
  /** Reason for non-match (for logging). */
  reason?: string;
}

/**
 * Route matcher that finds the best matching route for a request.
 *
 * Routes are evaluated in the order they appear in the config.
 * The first matching route wins.
 */
export class Router {
  private routes: RouteConfig[];

  constructor(config: GatewayConfig) {
    this.routes = config.routes;
  }

  /** Update the route table (used by hot-reload). */
  updateRoutes(routes: RouteConfig[]): void {
    this.routes = routes;
  }

  /**
   * Find the first route that matches the given request context.
   */
  match(ctx: RequestContext): RouteMatch {
    for (const route of this.routes) {
      if (this.matchRoute(route, ctx)) {
        return { route, matched: true };
      }
    }
    return { route: null, matched: false, reason: 'no route matched' };
  }

  /**
   * Check whether a single route matches the request.
   */
  private matchRoute(route: RouteConfig, ctx: RequestContext): boolean {
    // 1. Path match
    if (!this.matchPath(route, ctx.path)) return false;

    // 2. Method match
    if (route.methods && route.methods.length > 0) {
      if (!route.methods.map(m => m.toUpperCase()).includes(ctx.method.toUpperCase())) {
        return false;
      }
    }

    // 3. Header match
    if (route.headers && route.headers.length > 0) {
      if (!this.matchHeaders(route, ctx)) return false;
    }

    return true;
  }

  /** Match the request path against the route path. */
  private matchPath(route: RouteConfig, requestPath: string): boolean {
    if (route.pathPrefix === false) {
      return requestPath === route.path;
    }
    // Prefix match: requestPath must start with route.path
    // Allow trailing slash differences
    const routePath = route.path.endsWith('/') ? route.path.slice(0, -1) : route.path;
    const reqPath = requestPath.endsWith('/') ? requestPath.slice(0, -1) : requestPath;
    return reqPath === routePath || reqPath.startsWith(routePath + '/');
  }

  /** Match all configured header rules against the request. */
  private matchHeaders(route: RouteConfig, ctx: RequestContext): boolean {
    if (!route.headers) return true;

    for (const rule of route.headers) {
      const headerVal = this.getHeader(ctx.headers, rule.name);
      if (headerVal === undefined) return false;
      if (rule.value !== undefined && headerVal !== rule.value) return false;
    }
    return true;
  }

  /** Case-insensitive header lookup. */
  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lower) {
        if (Array.isArray(value)) return value[0];
        return value;
      }
    }
    return undefined;
  }

  /** Get all configured routes (for inspection / metrics). */
  getRoutes(): RouteConfig[] {
    return [...this.routes];
  }

  /** Count of configured routes. */
  routeCount(): number {
    return this.routes.length;
  }
}
