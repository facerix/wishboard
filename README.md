# Wishboard

Wishboard helps people create wishlists and share them with friends and family. This repository is the initial PWA scaffold; account, list, sync, and sharing features are planned in [docs/data-model.md](docs/data-model.md). Built with vanilla TypeScript, Web Components, and Service Workers — compiled with `tsc`, no bundler.

## Architecture

- **No frameworks, no bundler** - Pure vanilla TypeScript compiled with `tsc` to ES modules
- **Web Components** - Custom elements in `/components/` with Shadow DOM
- **Data Store** - Singleton `DataStore` (EventTarget) manages all data in localStorage
- **DOM Creation** - Use `h()` helper from `src/domUtils.ts` for all DOM manipulation
- **Service Workers** - Offline-first caching with automatic update notifications (authored in plain JS, not compiled)

## Requirements

- **Node 24+** (see `.nvmrc`). Tests run TypeScript directly via Node's built-in type stripping, which is on by default in Node 24.

## Setup

```sh
pnpm install
git config core.hooksPath .githooks
```

This activates pre-commit hooks that run lint and format checks before each commit.

## Development

### Commands

- **`pnpm start` / `pnpm dev`** — runs three concurrent processes: `tsc --watch`, a chokidar asset-copy watcher, and PHP's development server on port 8715 serving `dist/`
- **`pnpm build`** — one-shot `tsc` build + asset copy into `dist/`
- **`pnpm typecheck`** — type-check src and tests without emitting
- **`pnpm test`** — typecheck + run `node --test` against `.ts` files with the browser-specifier resolver
- **`pnpm lint` / `pnpm lint:fix`** — oxlint
- **`pnpm format` / `pnpm format:check`** — prettier
- **`pnpm deploy` / `pnpm deploy:dry-run`** — rsync `dist/` to `DEPLOY_TARGET` from `.env`

### How the build works

`tsc` reads source from the repo root (`index.ts`, `about.ts`, `src/**`, `components/**`) and emits compiled `.js` into `dist/` (preserving the tree). `scripts/copy-assets.mjs` copies static files (HTML, CSS, manifest, icons, images, fonts, service workers, and PHP API files) into `dist/`. PHP's development server serves `dist/` as the web root, so the absolute import paths in source (`/src/foo.js`, `/components/Foo.js`) resolve correctly.

### PHP API scaffold

`api/` contains the small PHP boundary and is copied into `dist/api/`. The TypeScript UI can call it through `src/apiClient.ts`; it does not read database credentials. PHP 8.4 with `mysqli` is required for local development and production. The development server serves `dist/` at `http://localhost:8715`; unlike app-template's `live-server`, it executes PHP. It does not provide automatic browser reload.

Create `api/.dbenv` from `.dbenv.example` for local development. The asset copy puts it in `dist/api/.dbenv`. On the host, put a separate `.dbenv` in the deployed `api/` directory; deployment excludes that file so local credentials cannot overwrite production credentials. Apache's `.htaccess` and the local PHP router forbid direct HTTP requests for dotfiles. Use `chmod 600` when PHP runs as the file owner, or `640` with a PHP-readable group. The reader accepts only literal, unquoted `KEY=value` lines and full-line `#` comments; it rejects malformed lines, duplicate keys, and missing or empty required values.

`GET /api/health.php` checks the database connection and returns `{"status":"ok"}` or a generic 503 response. It is a wiring check, not a list endpoint. List, account, sharing, and sync endpoints remain to be implemented according to `docs/data-model.md`. The service worker sends all `/api/` requests directly to the network and never stores their responses in PWA caches.

Service workers (`sw.js`, `sw-dev.js`, `sw-core.js`, and `sw-resources.js`) are **not** compiled by `tsc` — they're hand-authored classic-worker JavaScript and are copied verbatim into `dist/`. Add app-specific cache entries to `sw-resources.js` instead of editing the shared resource lists in `sw-core.js`.

### Tests and browser-style imports

Tests run through `tests/register.mjs`, which installs `tests/browserSpecifierHooks.mjs`. The hook maps browser-absolute imports such as `/src/foo.js` and `/components/Foo.js` to the corresponding TypeScript source files so Node can execute tests without changing production imports.
Keep using `.ts` imports for direct test dependencies; the hook is for transitive app imports that use browser-style absolute `.js` paths.

## Coding Standards

- **TypeScript** - `strict: true`, `verbatimModuleSyntax: true`, `moduleResolution: "bundler"`
- **ES modules** - Always use `import`/`export`. Import paths use the `.js` extension (compiled output), e.g. `import { h } from '/src/domUtils.js'`. The test files are the one exception — they import `.ts` directly so Node can run them without a build step.
- **Private fields** - Use `#fieldName` for encapsulation
- **const > let** - Prefer `const`, avoid `var`
- **Arrow functions** - For callbacks
- **async/await** - For promises

## Project Structure

```
/
├── index.html/.ts             # Main entry point
├── about.html/.ts             # About page
├── main.css                   # Global styles
├── manifest.json              # PWA manifest
├── sw.js                      # Production service worker (hand-authored JS)
├── sw-dev.js                  # Development service worker (hand-authored JS)
├── sw-core.js                 # Shared service worker logic (hand-authored JS)
├── sw-resources.js            # App-specific service-worker resource extensions
├── tsconfig.json              # tsc config for src/components/entries
├── tsconfig.tests.json        # type-check-only config for tests
├── components/                # Web Components (Custom Elements)
│   ├── ConfirmationModal.ts
│   └── UpdateNotification.ts
├── src/                       # Core utilities
│   ├── DataStore.ts           # Singleton data store (localStorage)
│   ├── ServiceWorkerManager.ts # Service worker lifecycle
│   ├── domUtils.ts            # DOM helper functions (h() function)
│   ├── uuid.ts                # Thin wrapper over crypto.randomUUID()
│   └── globals.d.ts           # Ambient types for window-scoped state + custom events
├── scripts/
│   └── copy-assets.mjs        # Copies static files into dist/
├── tests/                     # node --test suites (TypeScript)
│   ├── register.mjs           # Registers the test module-resolution hook
│   └── browserSpecifierHooks.mjs # Maps browser `/src/*.js` imports to `.ts`
├── images/                    # SVG/PNG assets
├── fonts/                     # Optional font assets
├── icons/                     # PWA icons (referenced from manifest.json)
├── favicon.svg                # Browser favicon (scalable)
├── favicon.ico                # Legacy favicon
├── favicon-96x96.png          # 96×96 favicon
└── apple-touch-icon.png       # 180×180 iOS home-screen icon
```

(`dist/` is git-ignored; created by `pnpm build` or `pnpm dev`.)

## Getting Started

See [USING_THIS_TEMPLATE.md](USING_THIS_TEMPLATE.md) for the full step-by-step setup guide.

## Credits

Template created by [Rylee Corradini](https://www.facerix.com/about).
