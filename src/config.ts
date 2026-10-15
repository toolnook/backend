/**
 * Configuration loader for the Streamline API Gateway.
 *
 * Reads a YAML config file, validates it, applies defaults, and
 * returns a strongly-typed `GatewayConfig` object.
 */

import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import type { GatewayConfig, RouteConfig } from './types';

/** Default values applied when the config omits a field. */
const DEFAULTS = {
  host: '0.0.0.0',
  healthCheckPath: '/health',
  metricsPath: '/metrics',
  logging: true,
};

/**
 * Load and validate a gateway config from a YAML file.
 *
 * @param configPath - Absolute or relative path to the YAML file.
 * @returns A validated `GatewayConfig` with defaults applied.
 * @throws If the file does not exist or the YAML is invalid / missing required fields.
 */
export function loadConfig(configPath: string): GatewayConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, 'utf-8');
  return parseConfig(raw, configPath);
}

/**
 * Parse a YAML string into a validated `GatewayConfig`.
 * Separated from `loadConfig` for easier testing.
 *
 * @param yamlString - Raw YAML text.
 * @param configPath - Path to record in the config (for hot-reload).
 */
export function parseConfig(yamlString: string, configPath?: string): GatewayConfig {
  let parsed: Record<string, unknown>;
  try {
    parsed = parse(yamlString);
  } catch (err) {
    throw new Error(`Failed to parse YAML: ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Config must be a YAML mapping');
  }

  const port = parsed.port;
  if (typeof port !== 'number' || port < 0 || port > 65535) {
    throw new Error('Config must include a valid "port" (0–65535)');
  }

  const routes = parseRoutes(parsed.routes);

  const config: GatewayConfig = {
    port,
    host: typeof parsed.host === 'string' ? parsed.host : DEFAULTS.host,
    configPath,
    globalRateLimit: parsed.globalRateLimit as GatewayConfig['globalRateLimit'] ?? undefined,
    healthCheckPath: typeof parsed.healthCheckPath === 'string' ? parsed.healthCheckPath : DEFAULTS.healthCheckPath,
    metricsPath: typeof parsed.metricsPath === 'string' ? parsed.metricsPath : DEFAULTS.metricsPath,
    logging: typeof parsed.logging === 'boolean' ? parsed.logging : DEFAULTS.logging,
    routes,
  };

  return config;
}

/** Validate and normalise the `routes` array from raw YAML. */
function parseRoutes(raw: unknown): RouteConfig[] {
  if (!Array.isArray(raw)) {
    throw new Error('Config must include a "routes" array');
  }

  return raw.map((r, i) => {
    if (!r || typeof r !== 'object') {
      throw new Error(`Route at index ${i} must be a mapping`);
    }

    const route = r as Record<string, unknown>;

    if (typeof route.id !== 'string' || route.id.length === 0) {
      throw new Error(`Route at index ${i} must have a non-empty "id"`);
    }
    if (typeof route.path !== 'string' || route.path.length === 0) {
      throw new Error(`Route "${route.id}" must have a non-empty "path"`);
    }
    if (!Array.isArray(route.upstreams) || route.upstreams.length === 0) {
      throw new Error(`Route "${route.id}" must have at least one upstream`);
    }

    const upstreams = route.upstreams.map((u: Record<string, unknown>, j: number) => {
      if (typeof u.name !== 'string' || u.name.length === 0) {
        throw new Error(`Route "${route.id}" upstream ${j} must have a "name"`);
      }
      if (typeof u.url !== 'string' || !u.url.startsWith('http')) {
        throw new Error(`Route "${route.id}" upstream "${u.name}" must have a valid "url"`);
      }
      return {
        name: u.name,
        url: u.url,
        timeout: typeof u.timeout === 'number' ? u.timeout : 30000,
        retries: typeof u.retries === 'number' ? u.retries : 0,
      };
    });

    return {
      id: route.id,
      path: route.path,
      pathPrefix: typeof route.pathPrefix === 'boolean' ? route.pathPrefix : true,
      methods: Array.isArray(route.methods) ? route.methods as string[] : [],
      headers: Array.isArray(route.headers) ? route.headers as RouteConfig['headers'] : undefined,
      upstreams,
      rateLimit: route.rateLimit as RouteConfig['rateLimit'] ?? undefined,
      circuitBreaker: route.circuitBreaker as RouteConfig['circuitBreaker'] ?? undefined,
      logging: typeof route.logging === 'boolean' ? route.logging : true,
    };
  });
}

/**
 * Deep-merge two config objects (new values override old).
 * Used by the hot-reloader to swap configs atomically.
 */
export function mergeConfigs(base: GatewayConfig, update: Partial<GatewayConfig>): GatewayConfig {
  return {
    ...base,
    ...update,
    routes: update.routes ?? base.routes,
  };
}
