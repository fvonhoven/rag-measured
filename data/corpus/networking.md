# Networking

React Native provides the Fetch API and XMLHttpRequest globally, backed by the platform's own HTTP stack (NSURLSession on iOS and OkHttp on Android).

## Using fetch

`fetch(url, options)` returns a promise that resolves to a `Response`. Parse the body with `response.json()` or `response.text()`. A non 2xx status does not reject the promise; check `response.ok` yourself. Wrap calls in try/catch to handle network failures, which do reject.

## Cleartext traffic

Both platforms block plain HTTP by default. iOS App Transport Security refuses non HTTPS requests unless you add an exception in `Info.plist`. Android 9 and later block cleartext unless `android:usesCleartextTraffic` is set or a network security config allows a specific domain. Use HTTPS in production; add exceptions only for a local development server.

## WebSocket

A `WebSocket` global is available with the same interface as in browsers. It stays open in the background only as long as the OS allows the app to run, which is a few seconds on iOS after backgrounding.

## Uploading files

`FormData` works with `fetch`. Append a file as an object with `uri`, `name`, and `type` fields; the native layer streams it from disk. Do not read the file into memory first.

## Inspecting requests

Requests made through `fetch` appear in the Network panel of React Native DevTools. For lower level inspection, tools such as Proxyman or Charles can proxy the simulator's traffic if you install their certificate.

## Timeouts and retries

`fetch` has no timeout option. Use an `AbortController` and call `abort()` from a `setTimeout`. Retries are your responsibility; a small helper that retries idempotent GET requests with exponential backoff covers most cases.
