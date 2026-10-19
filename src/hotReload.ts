/**
 * Config hot-reload for the Streamline API Gateway.
 *
 * Watches the config file for changes and notifies a callback so
 * the running server can swap routes and middleware without a
 * restart.
 */

import { watch, FSWatcher } from 'fs';
import type { GatewayConfig } from './types';
import { loadConfig } from './config';
import type { Logger } from './logger';

export type ReloadCallback = (config: GatewayConfig) => void;

/**
 * Watch a config file for changes and invoke the callback with
 * the new parsed config.
 *
 * Uses a debounce so rapid saves (e.g. editor atomic writes) don't
 * trigger multiple reloads.
 */
export class HotReloader {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;

  constructor(
    private configPath: string,
    private onReload: ReloadCallback,
    private logger?: Logger,
    opts?: { debounceMs?: number },
  ) {
    this.debounceMs = opts?.debounceMs ?? 300;
  }

  /**
   * Start watching the config file.
   */
  start(): void {
    this.watcher = watch(this.configPath, (eventType) => {
      if (eventType !== 'change') return;
      this.scheduleReload();
    });

    this.watcher.on('error', (err) => {
      this.logger?.error('File watcher error', { error: err.message });
    });

    this.logger?.info('Hot-reload enabled', { path: this.configPath });
  }

  /**
   * Stop watching and clean up.
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.logger?.info('Hot-reload disabled');
  }

  /**
   * Reload the config file immediately.
   */
  reload(): GatewayConfig {
    const config = loadConfig(this.configPath);
    this.onReload(config);
    this.logger?.info('Config reloaded', { routes: config.routes.length });
    return config;
  }

  /**
   * Schedule a debounced reload.
   */
  private scheduleReload(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      try {
        this.reload();
      } catch (err) {
        this.logger?.error('Failed to reload config', { error: (err as Error).message });
      }
    }, this.debounceMs);
  }

  /** Whether the watcher is currently active. */
  isWatching(): boolean {
    return this.watcher !== null;
  }
}
