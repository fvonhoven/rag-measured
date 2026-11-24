# The New Architecture

The New Architecture is the name for the set of changes that replaced the original asynchronous bridge between JavaScript and native code. It is the default for new projects created with React Native 0.76 and later.

## What was wrong with the bridge

The original architecture serialized every message between JavaScript and native as JSON and sent it over a single asynchronous queue. Layout, touch handling, and native module calls all waited in that queue. Under load the queue backed up and the UI dropped frames. Because every call was asynchronous, JavaScript could never ask native code a question and get an answer in the same frame.

## JSI

The JavaScript Interface, usually written JSI, is a C++ layer that lets JavaScript hold direct references to native objects. Instead of serializing to JSON, native code exposes host objects whose methods JavaScript calls synchronously. JSI is engine agnostic: the same host object works on Hermes and on JavaScriptCore.

## Fabric

Fabric is the new rendering system. It builds the shadow tree in C++ and can perform layout synchronously when needed, which makes it possible to measure a view and respond in the same frame. Fabric also enables concurrent rendering features from React 18 such as `startTransition` and `Suspense` for data.

## Turbo Modules

Turbo Modules are the New Architecture replacement for legacy native modules. They are loaded lazily on first use instead of eagerly at startup, and their interface is generated from a TypeScript or Flow spec by Codegen, so JavaScript and native signatures cannot drift apart.

## Migrating an existing app

Enable the New Architecture with `newArchEnabled=true` in `android/gradle.properties` and by running `RCT_NEW_ARCH_ENABLED=1 pod install` on iOS. Libraries that still use the legacy bridge run through an interop layer, which works for most modules but not for those that reach into private bridge internals.
