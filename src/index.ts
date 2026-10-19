#!/usr/bin/env node

/**
 * Streamline API Gateway — entry point.
 *
 * Reads a YAML config from argv or the `GATEWAY_CONFIG` env var,
 * creates the server, and starts listening.
 */

import { GatewayServer } from './server';
import { loadConfig } from './config';
import { Logger } from './logger';

function main(): void {
  const configPath = process.argv[2] ?? process.env.GATEWAY_CONFIG ?? './config.yaml';
  const logger = new Logger({ level: 'info' });

  let config;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    logger.error('Failed to load config', { path: configPath, error: (err as Error).message });
    process.exit(1);
  }

  const server = new GatewayServer({ config, logger });

  server.listen().then(() => {
    server.enableHotReload();
  });
}

main();
