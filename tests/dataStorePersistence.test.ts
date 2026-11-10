import { test } from 'node:test';
import assert from 'node:assert/strict';
import DataStore from '../src/DataStore.ts';

test('invalid stored list data fails without overwriting it', async () => {
  const values = new Map([['wishboard-lists', '{broken']]);
  const writes: string[] = [];
  const priorWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          writes.push(key);
          values.set(key, value);
        },
      },
    },
  });

  try {
    await assert.rejects(DataStore.init(), /Invalid stored list data/);
    assert.equal(values.get('wishboard-lists'), '{broken');
    assert.deepEqual(writes, []);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: priorWindow });
  }
});
