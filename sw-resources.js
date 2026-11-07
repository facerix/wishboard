// App-specific service-worker resources.
// Add URL paths here when the app introduces pages or assets beyond the
// template defaults. These paths must also be copied into dist/ by
// scripts/copy-assets.mjs.
const AppCacheResources = Object.freeze({
  core: [],
  static: [],
});

self.AppCacheResources = AppCacheResources;
