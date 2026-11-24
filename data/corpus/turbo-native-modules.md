# Turbo Native Modules

A native module lets JavaScript call platform code written in Kotlin, Java, Swift, Objective-C, or C++. Turbo Native Modules are the New Architecture form of that mechanism.

## Writing the spec

Every Turbo Module starts with a spec file in TypeScript, conventionally named `NativeMyModule.ts`. The spec declares an interface that extends `TurboModule` and exports the result of `TurboModuleRegistry.getEnforcing('MyModule')`. Only a subset of TypeScript types is allowed in a spec: primitives, arrays, plain objects, promises, and callbacks. Unions and generics are rejected by Codegen.

## Codegen

At build time Codegen reads the spec and generates the native interfaces: a Java or Kotlin abstract class on Android and an Objective-C protocol on iOS. Your native implementation extends or conforms to the generated type, so a mismatch between the JavaScript spec and the native signature fails to compile instead of failing at runtime. Codegen runs during `pod install` on iOS and as a Gradle task on Android.

## Implementing on Android

The Android class extends the generated `NativeMyModuleSpec` and is registered through a `ReactPackage` that returns it from `getModule`. Methods marked as returning a promise receive a `Promise` argument to resolve or reject.

## Implementing on iOS

The iOS class conforms to the generated protocol and implements `getTurboModule` to return a C++ `TurboModule` wrapper. The module is discovered by name through `RCT_EXPORT_MODULE`.

## Synchronous methods

Because Turbo Modules use JSI, a method can be declared synchronous in the spec and JavaScript will block until native returns. This should be rare. A synchronous call that does disk or network work stalls the JavaScript thread and drops frames.

## Lazy loading

Turbo Modules are not instantiated until JavaScript first touches them. This differs from legacy modules, which were all created during app startup, and it is one of the reasons the New Architecture improves startup time.
