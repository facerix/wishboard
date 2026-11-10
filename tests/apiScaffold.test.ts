import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const configFile = new URL('api/config.php', root).pathname;
const routerFile = new URL('scripts/dev-router.php', root).pathname;

test('PHP resolves database configuration within the API directory', () => {
  const result = spawnSync(
    'php',
    ['-r', `require ${JSON.stringify(configFile)}; echo db_config_path();`],
    {
      encoding: 'utf8',
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, new URL('api/.dbenv', root).pathname);
});

test('PHP development router denies dotfile requests and serves normal paths', () => {
  for (const [path, expectedOutput] of [
    ['/api/.dbenv', '403'],
    ['/api/%2Edbenv', '403'],
    ['/.hidden/file', '403'],
    ['/api/health.php', '0200'],
  ] as const) {
    const script = `$_SERVER['REQUEST_URI'] = ${JSON.stringify(path)}; http_response_code(200); register_shutdown_function(function () { echo http_response_code(); }); echo (int) include ${JSON.stringify(routerFile)};`;
    const result = spawnSync('php', ['-r', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expectedOutput, path);
  }
});

async function readConfig(contents: string): Promise<SpawnSyncReturns<string>> {
  const directory = await mkdtemp(join(tmpdir(), 'wishboard-config-'));
  const path = join(directory, '.dbenv');
  try {
    await writeFile(path, contents);
    return spawnSync(
      'php',
      [
        '-r',
        `require ${JSON.stringify(configFile)}; echo json_encode(load_db_config($argv[1]));`,
        path,
      ],
      {
        encoding: 'utf8',
      }
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('PHP config preserves literal password characters', async () => {
  const result = await readConfig(
    'DB_HOST=localhost\nDB_NAME=wishboard\nDB_USER=app\nDB_PASSWORD=p#ss=word$!\n'
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    DB_HOST: 'localhost',
    DB_NAME: 'wishboard',
    DB_USER: 'app',
    DB_PASSWORD: 'p#ss=word$!',
  });
});

test('PHP config rejects malformed, duplicate, and missing settings', async () => {
  for (const contents of [
    'DB_HOST localhost\n',
    'DB_HOST=one\nDB_HOST=two\n',
    'DB_HOST=localhost\nDB_NAME=wishboard\nDB_USER=app\n',
  ]) {
    const result = await readConfig(contents);
    assert.notEqual(result.status, 0);
  }
});

test('service worker passes API requests to network without opening a cache', async () => {
  const source = await readFile(new URL('sw-core.js', root), 'utf8');
  let cacheOpened = false;
  const request = { url: 'https://example.test/api/health.php', method: 'GET' };
  const response = { status: 200 };
  const context = vm.createContext({
    self: {},
    URL,
    caches: {
      open: () => {
        cacheOpened = true;
      },
    },
    fetch: async (actual: unknown) => {
      assert.equal(actual, request);
      return response;
    },
  });
  vm.runInContext(source, context);
  const core = (
    context.self as { ServiceWorkerCore: { handleFetch: (...args: unknown[]) => Promise<unknown> } }
  ).ServiceWorkerCore;
  assert.equal(await core.handleFetch(request, { name: 'cache', staticName: 'static' }), response);
  assert.equal(cacheOpened, false);
});
