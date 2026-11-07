/**
 * Node module-resolution hooks for `node --test`.
 *
 * App source imports browser-absolute specifiers ending in `.js`
 * (`/src/domUtils.js`, `/components/Foo.js`) because that is what the browser
 * loads out of `dist/`. Tests run the TypeScript sources directly under Node's
 * native type stripping, so those specifiers need to resolve to `.ts` files.
 */

const projectRoot = new URL('../', import.meta.url);
const BROWSER_ABSOLUTE_PREFIXES = ['/src/', '/components/'];

export function resolve(specifier, context, nextResolve) {
  if (BROWSER_ABSOLUTE_PREFIXES.some(prefix => specifier.startsWith(prefix))) {
    const sourcePath = specifier.replace(/^\//, '').replace(/\.js$/, '.ts');
    return nextResolve(new URL(sourcePath, projectRoot).href, context);
  }

  return nextResolve(specifier, context);
}
