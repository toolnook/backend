import { HorizonClient, NETWORK_PASSPHRASES, isValidAccountId, isValidTransactionHash, stroopsToXlm, formatXlm } from '../src/stellar/horizon';
import { resolveNetwork, HORIZON_URLS, buildHorizonUrl } from '../src/stellar/network';

describe('Horizon client', () => {
  test('constructs with public network defaults', () => {
    const client = new HorizonClient({ baseUrl: 'https://horizon.stellar.org' });
    expect(client.getNetwork()).toBe('public');
    expect(client.getPassphrase()).toBe(NETWORK_PASSPHRASES.public);
  });

  test('constructs with testnet network', () => {
    const client = new HorizonClient({ baseUrl: 'https://horizon-testnet.stellar.org', network: 'testnet' });
    expect(client.getNetwork()).toBe('testnet');
    expect(client.getPassphrase()).toBe(NETWORK_PASSPHRASES.testnet);
  });

  test('throws on passphrase mismatch', () => {
    expect(() => new HorizonClient({
      baseUrl: 'https://horizon.stellar.org',
      network: 'public',
      passphrase: NETWORK_PASSPHRASES.testnet,
    })).toThrow('mismatch');
  });

  test('cache starts empty', () => {
    const client = new HorizonClient({ baseUrl: 'https://horizon.stellar.org' });
    expect(client.cacheSize()).toBe(0);
  });

  test('clearCache empties the cache', () => {
    const client = new HorizonClient({ baseUrl: 'https://horizon.stellar.org' });
    client.clearCache();
    expect(client.cacheSize()).toBe(0);
  });

  test('isValidAccountId validates Stellar public keys', () => {
    expect(isValidAccountId('G' + 'A'.repeat(55))).toBe(true);
    expect(isValidAccountId('SABC123')).toBe(false);
    expect(isValidAccountId('')).toBe(false);
  });

  test('isValidTransactionHash validates 64-char hex', () => {
    expect(isValidTransactionHash('a'.repeat(64))).toBe(true);
    expect(isValidTransactionHash('xyz')).toBe(false);
  });

  test('stroopsToXlm converts correctly', () => {
    expect(stroopsToXlm('10000000')).toBe('1.0000000');
    expect(stroopsToXlm('5000000')).toBe('0.5000000');
    expect(stroopsToXlm(0)).toBe('0.0000000');
  });

  test('formatXlm formats amount with XLM suffix', () => {
    expect(formatXlm('1.5')).toBe('1.5000000 XLM');
    expect(formatXlm(0)).toBe('0.0000000 XLM');
  });
});

describe('Network configuration', () => {
  test('resolveNetwork returns public defaults', () => {
    const config = resolveNetwork();
    expect(config.network).toBe('public');
    expect(config.horizonUrl).toBe(HORIZON_URLS.public);
  });

  test('resolveNetwork returns testnet when specified', () => {
    const config = resolveNetwork({ network: 'testnet' });
    expect(config.network).toBe('testnet');
    expect(config.horizonUrl).toBe(HORIZON_URLS.testnet);
  });

  test('resolveNetwork allows custom URLs', () => {
    const config = resolveNetwork({ horizonUrl: 'http://localhost:8000' });
    expect(config.horizonUrl).toBe('http://localhost:8000');
  });

  test('buildHorizonUrl constructs full URL', () => {
    const url = buildHorizonUrl('public', '/accounts/GABC');
    expect(url).toBe('https://horizon.stellar.org/accounts/GABC');
  });

  test('HORIZON_URLS has both public and testnet', () => {
    expect(HORIZON_URLS.public).toContain('horizon.stellar.org');
    expect(HORIZON_URLS.testnet).toContain('horizon-testnet');
  });
});
