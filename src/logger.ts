/**
 * Structured JSON logger for the Streamline API Gateway.
 *
 * Emits one JSON object per log line so logs can be ingested by
 * structured-log collectors (Loki, Elasticsearch, etc.).
 */

import type { LogEntry } from './types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** A logger that writes JSON to stdout (or a custom writer). */
export class Logger {
  private minLevel: LogLevel;
  private writer: (line: string) => void;
  private defaultFields: Record<string, unknown>;

  constructor(opts?: {
    level?: LogLevel;
    writer?: (line: string) => void;
    defaultFields?: Record<string, unknown>;
  }) {
    this.minLevel = opts?.level ?? 'info';
    this.writer = opts?.writer ?? ((line: string) => process.stdout.write(line + '\n'));
    this.defaultFields = opts?.defaultFields ?? {};
  }

  /** Log at the given level. Extra fields are merged into the JSON output. */
  log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.defaultFields,
      ...fields,
    };

    this.writer(JSON.stringify(entry));
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log('debug', message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.log('info', message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.log('warn', message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.log('error', message, fields);
  }

  /** Log a request/response entry (used by the proxy middleware). */
  request(entry: LogEntry): void {
    this.log('info', entry.message ?? 'request', entry);
  }

  /** Create a child logger with additional default fields. */
  child(fields: Record<string, unknown>): Logger {
    return new Logger({
      level: this.minLevel,
      writer: this.writer,
      defaultFields: { ...this.defaultFields, ...fields },
    });
  }
}

/** Default singleton logger for convenience. */
export const logger = new Logger();
