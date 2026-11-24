# Navigation

React Native does not ship a navigation library. The community standard is React Navigation, and Expo Router builds file based routing on top of it.

## Installing React Navigation

Install `@react-navigation/native` plus the navigator packages you need, for example `@react-navigation/native-stack`. The native stack also needs `react-native-screens` and `react-native-safe-area-context`. Wrap the app in `NavigationContainer` once, at the root.

## Stack navigators

A stack navigator pushes screens onto a history and pops them with the back gesture or button. `createNativeStackNavigator` uses the platform's own navigation controller (UINavigationController on iOS, Fragment transactions on Android), so transitions match the OS. The older `createStackNavigator` reimplements transitions in JavaScript and is slower but more customizable.

## Tab and drawer navigators

`createBottomTabNavigator` renders a tab bar and keeps each tab's stack alive when you switch. Drawer navigators slide a menu in from the side. Nesting a stack inside each tab is the usual pattern for apps with a tab bar.

## Passing parameters

Call `navigation.navigate('Details', { id: 42 })` to move to a screen with params. The target screen reads them from `route.params`. Params should be small serializable values such as ids, not whole objects, so that deep links and state restoration keep working.

## Deep linking

Configure `linking` on `NavigationContainer` with a `prefixes` list and a `config` object that maps URL paths to screen names. On iOS the app must also declare associated domains or URL schemes; on Android an intent filter in the manifest.

## Type safety

Declare a `RootStackParamList` type that maps each screen name to its params and pass it as the generic to `createNativeStackNavigator`. With that in place, `navigate` rejects unknown screen names and wrong param shapes at compile time.
