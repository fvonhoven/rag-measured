# Metro configuration

Metro is the JavaScript bundler for React Native. It watches the project, transforms each file with Babel, and serves a single bundle to the app during development or writes one to disk for release builds.

## The config file

Configuration lives in `metro.config.js` at the project root. Start from the defaults with `getDefaultConfig` from `@react-native/metro-config` and merge your changes with `mergeConfig`. Overwriting the whole object drops defaults that the platform relies on, such as the asset extension list.

## Resolver options

The `resolver` section controls how imports are found. `sourceExts` lists the extensions Metro tries in order, so adding `mjs` or `cjs` there lets you import packages that ship those files. `assetExts` lists file types treated as assets rather than code. To make Metro treat `.svg` as source (for a transformer that turns SVG into components) you remove `svg` from `assetExts` and add it to `sourceExts`.

## Transformer options

The `transformer` section picks the Babel transformer and its options. `babelTransformerPath` points at a custom transformer, which is how libraries such as SVG transformers hook in. `minifierPath` chooses the minifier used for release bundles.

## Monorepos and watchFolders

Metro only watches the project root by default. In a monorepo where packages live in a sibling folder, add those folders to `watchFolders` so changes are picked up and so Metro can resolve symlinked packages. You usually also need `nodeModulesPaths` to include the workspace root so hoisted dependencies resolve.

## Resetting the cache

Metro caches transformed files. When a config change does not seem to take effect, start the bundler with `--reset-cache`. Stale cache is the most common cause of a change in `metro.config.js` appearing to do nothing.
