# Animations

React Native has two built in animation systems, `Animated` and `LayoutAnimation`, and the community library Reanimated is widely used for anything demanding.

## The Animated API

`Animated` drives values over time and binds them to style properties of `Animated.View`, `Animated.Text`, and other animated components. Create a value with `new Animated.Value(0)`, then run `Animated.timing`, `Animated.spring`, or `Animated.decay` to change it. Compose sequences with `Animated.sequence` and `Animated.parallel`.

## useNativeDriver

By default `Animated` computes every frame on the JavaScript thread and sends the result over to native, which stutters whenever JavaScript is busy. Passing `useNativeDriver: true` serializes the whole animation to native once, and the UI thread runs it without touching JavaScript. The native driver only supports non layout properties: `transform` and `opacity` work, `width`, `height`, and `flex` do not.

## LayoutAnimation

`LayoutAnimation.configureNext` animates the next layout change automatically, so adding or removing a view animates the views around it without you describing the transition. On Android it required `UIManager.setLayoutAnimationEnabledExperimental(true)` before the New Architecture.

## Reanimated

Reanimated runs animation code on the UI thread in a separate JavaScript runtime called a worklet. A function marked with the `'worklet'` directive is copied to the UI runtime and can respond to gestures and scroll events with no round trip to the main JavaScript thread. `useSharedValue` holds animated state and `useAnimatedStyle` maps it to styles.

## Choosing between them

Use `Animated` with the native driver for simple fades and moves. Use Reanimated when an animation must track a gesture frame by frame, or when you need to animate layout properties on the UI thread.
