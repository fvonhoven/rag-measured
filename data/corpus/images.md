# Images

The `Image` component renders local and remote images. Handling images well matters because decoding is one of the main causes of dropped frames on the UI thread.

## Local images

Import a local file with `require('./logo.png')` and pass the result to `source`. Metro bundles the file and reads its dimensions at build time, so local images do not need `width` and `height`. Provide `@2x` and `@3x` variants next to the base file and Metro picks the one matching the screen density.

## Remote images

Pass `{ uri: 'https://...' }` to `source`. Remote images have no intrinsic size until loaded, so you must give the component explicit `width` and `height` or it renders at zero size. Add `onLoad` and `onError` handlers to react to completion.

## Caching

iOS caches remote images through NSURLCache; Android through the Fresco library that backs `Image`. Neither cache is under your control from JavaScript beyond the `cache` field on the source object on iOS. For a persistent disk cache with explicit control, projects use `expo-image` or `react-native-fast-image`.

## Resizing

`resizeMode` controls how the image fits its frame: `cover` fills and crops, `contain` fits inside with letterboxing, `stretch` distorts, and `center` keeps the natural size. Downloading a large image and displaying it small still decodes the full resolution; request an appropriately sized asset from the server instead.

## Prefetching

`Image.prefetch(url)` downloads an image into the cache before it is displayed, which is useful for the next screen in a flow. `Image.getSize(url, callback)` returns the dimensions of a remote image without rendering it.

## SVG

`Image` does not render SVG. Use `react-native-svg` and, for importing `.svg` files as components, a Metro transformer such as `react-native-svg-transformer`.
