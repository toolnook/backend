import { HotReloader } from '../src/hotReload';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('HotReloader', () => {
  test('reloads config when file changes', () => {
    const configPath = join(tmpdir(), `test-config-${Date.now()}.yaml`);
    writeFileSync(configPath, `port: 8080\nroutes:\n  - id: test\n    path: /test\n    upstreams:\n      - name: u\n        url: http://localhost:3000\n`);

    let reloadedConfig: any = null;
    const reloader = new HotReloader(configPath, (config) => {
      reloadedConfig = config;
    }, undefined, { debounceMs: 50 });

    reloader.start();

    return new Promise<void>((resolve) => {
      // Wait a moment, then modify the file
      setTimeout(() => {
        writeFileSync(configPath, `port: 9090\nroutes:\n  - id: test2\n    path: /test2\n    upstreams:\n      - name: u\n        url: http://localhost:3001\n`);
      }, 100);

      setTimeout(() => {
        expect(reloadedConfig).not.toBeNull();
        expect(reloadedConfig.port).toBe(9090);
        expect(reloadedConfig.routes[0].id).toBe('test2');
        reloader.stop();
        if (existsSync(configPath)) unlinkSync(configPath);
        resolve();
      }, 300);
    });
  });

  test('reload() loads config immediately', () => {
    const configPath = join(tmpdir(), `test-config-immediate-${Date.now()}.yaml`);
    writeFileSync(configPath, `port: 7070\nroutes:\n  - id: t\n    path: /t\n    upstreams:\n      - name: u\n        url: http://localhost:3000\n`);

    let reloadedConfig: any = null;
    const reloader = new HotReloader(configPath, (config) => {
      reloadedConfig = config;
    });

    const config = reloader.reload();
    expect(config.port).toBe(7070);
    expect(reloadedConfig.port).toBe(7070);

    if (existsSync(configPath)) unlinkSync(configPath);
  });

  test('isWatching reflects watcher state', () => {
    const configPath = join(tmpdir(), `test-config-watch-${Date.now()}.yaml`);
    writeFileSync(configPath, `port: 8080\nroutes:\n  - id: t\n    path: /t\n    upstreams:\n      - name: u\n        url: http://localhost:3000\n`);

    const reloader = new HotReloader(configPath, () => {});
    expect(reloader.isWatching()).toBe(false);
    reloader.start();
    expect(reloader.isWatching()).toBe(true);
    reloader.stop();
    expect(reloader.isWatching()).toBe(false);

    if (existsSync(configPath)) unlinkSync(configPath);
  });
});
