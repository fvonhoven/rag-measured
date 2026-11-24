# Platform specific code

Most of a React Native app is shared, but some behavior has to differ between iOS and Android. There are three mechanisms, from smallest to largest scope.

## The Platform module

`Platform.OS` is `'ios'` or `'android'` (and `'web'`, `'windows'`, or `'macos'` on those targets). Use it for a single conditional. `Platform.select({ ios: a, android: b, default: c })` picks a value by platform and reads better than a ternary in a style object. `Platform.Version` gives the OS version: a number on Android (the API level) and a string on iOS.

## Platform file extensions

Metro resolves `Button.ios.tsx` and `Button.android.tsx` when you import `./Button`, picking the file for the current platform. The `.native.tsx` extension is chosen on both iOS and Android but not on web, which is useful when a project also targets React Native Web. Use this when the two implementations share little code.

## Native code per platform

Anything the JavaScript layer cannot express lives in the `ios/` and `android/` folders as a native module or native component. This is the largest scope and the most expensive to maintain.

## Common differences

Shadows use `shadowColor`, `shadowOffset`, `shadowOpacity`, and `shadowRadius` on iOS, and `elevation` on Android. The status bar height differs and should come from `react-native-safe-area-context` rather than a hard coded number. Fonts are registered differently: iOS reads them from `Info.plist`, Android from `android/app/src/main/assets/fonts`.

## Testing both platforms

Platform checks are easy to get wrong silently. Run the Jest suite once per platform by setting `haste.defaultPlatform` in two Jest projects, or at least run the app on both simulators before every release.
