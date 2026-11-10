# Wishboard

Wishboard lets people create wishlists and share a read-only link with friends and family.

## Domain

Accounts own lists; each list has a title and at least one named entry, which may include an HTTP(S) URL. The planned server is authoritative. A signed-in client will keep a durable offline copy and an outbox of pending edits. Share tokens allow read-only access to one list and require a server round trip to create or revoke. See [docs/data-model.md](docs/data-model.md) for the proposed schema, permissions, and conflict handling. The current scaffold has no account, sync, or sharing implementation.

## Coding standards

- Use vanilla TypeScript and Web Components; `tsc` emits ES modules to `dist/` without a bundler.
- In app source, use absolute `/` import specifiers ending in `.js`; tests import `.ts` directly.
- Use `h()` from `/src/domUtils.js` for DOM creation and DataStore for local data operations.
- Place Web Components in `components/` with Shadow DOM and a `<style>` tag. Follow each `customElements.define()` with its `HTMLElementTagNameMap` augmentation.
- Keep service workers as hand-authored JavaScript. Register new assets in `scripts/copy-assets.mjs` and `sw-resources.js`.
- Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` after changes.

## Development

`pnpm start` runs `tsc` watch, the asset-copy watcher, and PHP on port 8715. Visit `http://localhost:8715`.
