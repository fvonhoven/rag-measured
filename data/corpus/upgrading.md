# Upgrading React Native

React Native releases a new minor version roughly every two to three months. Each release changes files in the native `ios/` and `android/` folders as well as JavaScript dependencies, which is why upgrading is more involved than bumping one package.

## The Upgrade Helper

The Upgrade Helper is a web tool at react-native-community.github.io/upgrade-helper. Pick your current version and the target version and it shows a diff of every file in a freshly generated template between the two. Apply the diff to your project by hand. It is the recommended way to upgrade a bare project.

## What usually changes

Expect changes in `android/build.gradle` (Gradle and Kotlin versions), `ios/Podfile` (minimum iOS version), `package.json` (React and Metro versions), and `metro.config.js`. Template files such as `MainApplication` change whenever the startup path changes, as it did for the New Architecture.

## Upgrading with Expo

Expo projects upgrade by changing the SDK version with `npx expo install expo@latest` followed by `npx expo install --fix`, which aligns every Expo package to the SDK. Continuous Native Generation regenerates the native folders from `app.json`, so hand edits to `ios/` and `android/` are not needed and are overwritten.

## Third party libraries

After bumping React Native, check each native dependency against the target version. Libraries that have not adopted the New Architecture may need the interop layer or an update. Running `npx react-native doctor` catches environment mismatches such as an old Xcode or JDK.

## One version at a time

Skipping several minors at once multiplies the diff and mixes unrelated changes. Move one minor version per upgrade, build and run on both platforms, commit, then move again.
