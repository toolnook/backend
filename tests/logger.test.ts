import { Logger } from '../src/logger';

function captureLines(): { lines: string[]; writer: (line: string) => void } {
  const lines: string[] = [];
  return { lines, writer: (line: string) => { lines.push(line); } };
}

describe('Logger', () => {
  test('writes JSON to the configured writer', () => {
    const { lines, writer } = captureLines();
    const log = new Logger({ writer });
    log.info('hello', { key: 'value' });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('hello');
    expect(parsed.key).toBe('value');
    expect(parsed.timestamp).toBeDefined();
  });

  test('respects minimum log level', () => {
    const { lines, writer } = captureLines();
    const log = new Logger({ writer, level: 'warn' });
    log.debug('should not appear');
    log.info('should not appear');
    log.warn('should appear');
    log.error('should appear');
    expect(lines).toHaveLength(2);
  });

  test('child logger merges default fields', () => {
    const { lines, writer } = captureLines();
    const log = new Logger({ writer, defaultFields: { service: 'gateway' } });
    const child = log.child({ routeId: 'users' });
    child.info('request');
    const parsed = JSON.parse(lines[0]);
    expect(parsed.service).toBe('gateway');
    expect(parsed.routeId).toBe('users');
  });

  test('request method logs structured request entry', () => {
    const { lines, writer } = captureLines();
    const log = new Logger({ writer });
    log.request({
      timestamp: '2026-01-01T00:00:00Z',
      method: 'GET',
      path: '/api/users',
      routeId: 'users',
      statusCode: 200,
      durationMs: 42,
      upstream: 'user-svc',
    });
    const parsed = JSON.parse(lines[0]);
    expect(parsed.method).toBe('GET');
    expect(parsed.statusCode).toBe(200);
    expect(parsed.durationMs).toBe(42);
  });
});
