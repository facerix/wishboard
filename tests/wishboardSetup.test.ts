import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);

test('PWA manifest uses existing, correctly sized icon assets', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8')) as {
    icons: { src: string; sizes: string }[];
    theme_color: string;
  };

  for (const icon of manifest.icons) {
    assert.match(icon.src, /^\//);
    const path = join(root.pathname, icon.src.slice(1));
    assert.ok((await stat(path)).isFile(), `${icon.src} must exist`);
  }

  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));

  for (const page of ['index.html', 'about.html']) {
    const html = await readFile(new URL(page, root), 'utf8');
    assert.ok(html.includes(`<meta name="theme-color" content="${manifest.theme_color}" />`));
  }
});
