# Debugging

React Native ships with a developer menu, an in app error overlay, and a DevTools frontend. Together they cover most day to day debugging without extra tools.

## The developer menu

Shake the device, or press Cmd+D in the iOS simulator and Cmd+M in the Android emulator, to open the developer menu. It offers Reload, Open DevTools, toggle the element inspector, toggle the performance monitor, and Fast Refresh settings.

## React Native DevTools

React Native DevTools replaced the old Chrome remote debugger and Flipper as the default debugger in React Native 0.76. It is a build of Chrome DevTools that connects directly to Hermes over the Chrome DevTools Protocol. It provides a console, source level breakpoints, the React Components and Profiler panels, a Network panel, and a memory panel. Launch it by pressing `j` in the terminal running Metro.

## LogBox

Errors and warnings render in LogBox, the in app overlay. A red screen is an uncaught error; a yellow box is a warning. Call `LogBox.ignoreLogs(['pattern'])` to hide specific warnings during development, and `LogBox.ignoreAllLogs()` to silence it entirely. Ignored logs still print to the terminal.

## Fast Refresh

Fast Refresh reloads edited modules while keeping component state when possible. State is reset if the edited file exports something other than React components, or if the component tree changes shape. Add `// @refresh reset` at the top of a file to force a remount on every edit.

## Native logs

Console output from JavaScript is forwarded to the Metro terminal. Native logs go to Logcat on Android (`adb logcat`) and to the Xcode console or `Console.app` on iOS. Crashes in native code do not reach LogBox and must be read from those tools.
