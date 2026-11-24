# Layout with Flexbox

React Native lays out views with a flexbox implementation called Yoga. It follows the CSS flexbox spec closely, with a few defaults changed to suit mobile screens.

## Defaults that differ from the web

`flexDirection` defaults to `column`, not `row`, because phone screens are tall. `alignContent` defaults to `flex-start`. `flexShrink` defaults to 0, so children do not shrink unless you ask. `position` defaults to `relative`. Every view is `display: flex`; there is no block layout.

## flex

The `flex` property on a child is a single number. `flex: 1` tells the child to fill available space along the main axis, shared proportionally with siblings that also set `flex`. A child with `flex: 2` takes twice the space of a sibling with `flex: 1`. Setting `flex: 0` sizes the child to its content.

## Main axis and cross axis

`justifyContent` positions children along the main axis, which is vertical by default. `alignItems` positions them along the cross axis. `alignSelf` overrides `alignItems` for one child. Swapping `flexDirection` to `row` swaps which axis each property controls.

## Units

Dimensions are unitless numbers that represent density independent pixels, so a `width: 100` view is the same physical size on screens of different densities. Percent strings such as `'50%'` are allowed for width, height, and margins.

## Absolute positioning

`position: 'absolute'` removes a view from the flex flow and positions it against its parent's edges with `top`, `left`, `right`, and `bottom`. There is no `fixed` positioning; to pin something to the window, place it absolutely inside the root view.

## Gap

`gap`, `rowGap`, and `columnGap` are supported since React Native 0.71 and are the preferred way to space children instead of margins on each child.
