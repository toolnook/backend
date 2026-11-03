/**
 * Stellar network configuration for the Horizon Gateway.
 *
 * Manages network selection (public/testnet), endpoint URLs,
 * and health checking against Horizon's root endpoint.
 */

import type { StellarNetwork } from './horizon';

/** Default Horizon endpoints per network. */
export const HORIZON_URLS: Record<StellarNetwork, string> = {
  public: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
};

/** Soroban RPC endpoints per network. */
export const SOROBAN_URLS: Record<StellarNetwork, string> = {
  public: 'https://soroban-rpc.stellar.org',
  testnet: 'https://soroban-testnet.stellar.org',
};

/** Network configuration for the gateway. */
export interface NetworkConfig {
  network: StellarNetwork;
  horizonUrl: string;
  sorobanUrl: string;
  passphrase: string;
}

/**
 * Resolve a network configuration from user input.
 * If only network is provided, uses default endpoints.
 */
export function resolveNetwork(opts?: {
  network?: StellarNetwork;
  horizonUrl?: string;
  sorobanUrl?: string;
  passphrase?: string;
}): NetworkConfig {
  const network = opts?.network ?? 'public';
  return {
    network,
    horizonUrl: opts?.horizonUrl ?? HORIZON_URLS[network],
    sorobanUrl: opts?.sorobanUrl ?? SOROBAN_URLS[network],
    passphrase: opts?.passphrase ?? '',
  };
}

/**
 * Check Horizon health by fetching the root endpoint.
 * Returns the horizon version string or null if unreachable.
 */
export async function checkHorizonHealth(horizonUrl: string): Promise<{ healthy: boolean; version?: string; coreVersion?: string }> {
  try {
    const url = new URL(horizonUrl);
    const proto = url.protocol === 'https:' ? require('https') : require('http');
    return new Promise((resolve) => {
      const req = proto.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: '/',
        method: 'GET',
        headers: { 'Accept': 'application/hal+json' },
      }, (res: any) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({ healthy: false });
            return;
          }
          try {
            const data = JSON.parse(body);
            resolve({
              healthy: true,
              version: data.horizon_version,
              coreVersion: data.core_version,
            });
          } catch {
            resolve({ healthy: true });
          }
        });
      });
      req.on('error', () => resolve({ healthy: false }));
      req.setTimeout(5000, () => { req.destroy(); resolve({ healthy: false }); });
      req.end();
    });
  } catch {
    return Promise.resolve({ healthy: false });
  }
}

/**
 * Build a Horizon URL for a given path and network.
 */
export function buildHorizonUrl(network: StellarNetwork, path: string): string {
  return new URL(path, HORIZON_URLS[network]).toString();
}
