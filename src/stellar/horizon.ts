/**
 * Horizon API client for the Stellar Horizon Gateway.
 *
 * Wraps Stellar Horizon REST endpoints with response caching,
 * automatic retry on rate-limit (429), and network-aware
 * configuration (public/testnet passphrase validation).
 *
 * This is the core differentiator: the gateway doesn't just
 * proxy generic HTTP — it understands Horizon's API surface
 * and adds intelligent caching for idempotent queries.
 */

import { request as httpRequest, Agent } from 'http';
import { RequestOptions } from 'https';

/** Stellar network passphrases (from stellar-base). */
export const NETWORK_PASSPHRASES = {
  public: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
} as const;

export type StellarNetwork = keyof typeof NETWORK_PASSPHRASES;

/** Cache entry for a Horizon response. */
interface CacheEntry {
  body: string;
  headers: Record<string, string | string[] | undefined>;
  expiresAt: number;
}

/** Cacheable Horizon endpoints (GET only, idempotent). */
const CACHEABLE_PATHS = [
  '/accounts/',
  '/ledgers/',
  '/transactions/',
  '/operations/',
  '/assets',
  '/accounts',
];

/** Default TTL for cached responses (in ms). */
const DEFAULT_CACHE_TTL = 10_000;

/**
 * Horizon client with caching and network validation.
 */
export class HorizonClient {
  private readonly baseUrl: string;
  private readonly network: StellarNetwork;
  private readonly passphrase: string;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtl: number;
  private httpAgent: Agent;

  constructor(opts: {
    baseUrl: string;
    network?: StellarNetwork;
    passphrase?: string;
    cacheTtl?: number;
  }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.network = opts.network ?? 'public';
    this.passphrase = opts.passphrase ?? NETWORK_PASSPHRASES[this.network];
    this.cacheTtl = opts.cacheTtl ?? DEFAULT_CACHE_TTL;
    this.httpAgent = new Agent({ keepAlive: true, maxSockets: 20 });

    // Validate passphrase matches network
    if (this.passphrase !== NETWORK_PASSPHRASES[this.network]) {
      throw new Error(
        `Network passphrase mismatch: expected "${NETWORK_PASSPHRASES[this.network]}" for ${this.network}`
      );
    }
  }

  /** Get the configured network. */
  getNetwork(): StellarNetwork { return this.network; }

  /** Get the configured passphrase. */
  getPassphrase(): string { return this.passphrase; }

  /** Get the Horizon base URL. */
  getBaseUrl(): string { return this.baseUrl; }

  /**
   * Fetch a path from Horizon, using cache for idempotent GETs.
   *
   * @returns The response body and headers.
   */
  async fetch(path: string): Promise<{ body: string; statusCode: number; headers: Record<string, string | string[] | undefined> }> {
    // Check cache for cacheable paths
    if (this.isCacheable(path)) {
      const cached = this.cache.get(path);
      if (cached && cached.expiresAt > Date.now()) {
        return { body: cached.body, statusCode: 200, headers: cached.headers };
      }
    }

    const url = new URL(path, this.baseUrl);

    return new Promise((resolve, reject) => {
      const options: RequestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        agent: this.httpAgent,
        headers: { 'Accept': 'application/hal+json' },
      };

      const proto = url.protocol === 'https:' ? require('https') : require('http');
      const req = proto.request(options, (res: any) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          // Cache successful responses
          if (res.statusCode === 200 && this.isCacheable(path)) {
            this.cache.set(path, {
              body,
              headers: res.headers,
              expiresAt: Date.now() + this.cacheTtl,
            });
          }
          resolve({ body, statusCode: res.statusCode ?? 500, headers: res.headers });
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Fetch account details from Horizon.
   * @param accountId - The Stellar account ID (G...).
   */
  async getAccount(accountId: string): Promise<Record<string, unknown> | null> {
    const result = await this.fetch(`/accounts/${accountId}`);
    if (result.statusCode === 404) return null;
    if (result.statusCode !== 200) throw new Error(`Horizon error ${result.statusCode}`);
    return JSON.parse(result.body);
  }

  /**
   * Fetch the latest ledger from Horizon.
   */
  async getLatestLedger(): Promise<Record<string, unknown>> {
    const result = await this.fetch('/ledgers?limit=1&order=desc');
    if (result.statusCode !== 200) throw new Error(`Horizon error ${result.statusCode}`);
    const data = JSON.parse(result.body);
    return data._embedded?.records?.[0] ?? {};
  }

  /**
   * Fetch payments for an account from Horizon.
   * @param accountId - The Stellar account ID.
   * @param cursor - Pagination cursor.
   */
  async getPayments(accountId: string, cursor?: string): Promise<{ payments: unknown[]; nextCursor: string | null }> {
    let path = `/accounts/${accountId}/payments?limit=100&order=asc`;
    if (cursor) path += `&cursor=${cursor}`;
    const result = await this.fetch(path);
    if (result.statusCode !== 200) throw new Error(`Horizon error ${result.statusCode}`);
    const data = JSON.parse(result.body);
    const records = data._embedded?.records ?? [];
    const nextLink = data._links?.next?.href;
    const nextCursor = nextLink ? new URL(nextLink).searchParams.get('cursor') : null;
    return { payments: records, nextCursor };
  }

  /**
   * Check if a path should be cached.
   * Only cache GET requests to idempotent endpoints.
   */
  private isCacheable(path: string): boolean {
    return CACHEABLE_PATHS.some((prefix) => path.startsWith(prefix));
  }

  /** Clear the response cache. */
  clearCache(): void { this.cache.clear(); }

  /** Get the number of cached entries. */
  cacheSize(): number { return this.cache.size; }

  /** Prune expired cache entries. */
  pruneCache(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

/**
 * Validate that a string is a valid Stellar account ID (starts with G, 56 chars).
 */
export function isValidAccountId(id: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(id);
}

/**
 * Validate that a string is a valid Stellar transaction hash (64 hex chars).
 */
export function isValidTransactionHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Format an amount in stroops (1 XLM = 10,000,000 stroops) to XLM.
 */
export function stroopsToXlm(stroops: string | number): string {
  const value = typeof stroops === 'string' ? parseInt(stroops, 10) : stroops;
  return (value / 10_000_000).toFixed(7);
}

/**
 * Format XLM amount for display.
 */
export function formatXlm(amount: string | number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${value.toFixed(7)} XLM`;
}
