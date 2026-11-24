# Hermes

Hermes is the JavaScript engine that ships with React Native. It was built by Meta specifically for running React Native apps on Android and iOS, and it has been the default engine since React Native 0.70.

## Why Hermes exists

Mobile apps care about time to interactive more than peak throughput. A general purpose engine like V8 or JavaScriptCore parses and compiles JavaScript at startup, which costs hundreds of milliseconds on a low end Android phone. Hermes moves that work to build time so the app starts faster and uses less memory.

## Bytecode precompilation

When you build a release app with Hermes enabled, the Metro bundle is compiled ahead of time into Hermes bytecode. The app loads the bytecode file directly instead of parsing JavaScript source. The bytecode file is memory mapped, so pages are only loaded when they are touched. This is the main reason Hermes improves cold start time and reduces peak memory.

## Checking that Hermes is running

You can confirm Hermes is active at runtime by checking the global `HermesInternal` object. If `global.HermesInternal` is defined, the app is running on Hermes. In the developer menu, the debugger banner also names the engine.

## Debugging with Hermes

Hermes speaks the Chrome DevTools Protocol. Open the React Native DevTools from the developer menu and you get breakpoints, a console, and a memory profiler backed by the engine itself, not a proxy. Sampling profiles captured on device can be loaded in the Chrome performance panel.

## Known limitations

Hermes does not implement every ECMAScript feature at the same pace as V8. Historically it lacked full `Intl` support on Android, and some newer syntax needs Babel to transform it. The Hermes project publishes a compatibility table, and the recommended approach is to rely on Metro's default Babel preset rather than shipping untransformed syntax.
