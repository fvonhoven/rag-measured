# FlatList performance

FlatList renders long lists by only mounting the rows near the viewport. It is built on VirtualizedList. Most performance problems come from the list rendering more than it needs to, or from each row being expensive to render.

## Give every row a stable key

Provide a `keyExtractor` that returns a stable string id for each item. Without it FlatList falls back to the array index, and inserting an item at the top forces every row below it to re-render.

## Memoize row components

Wrap the component returned by `renderItem` in `React.memo` and keep the `renderItem` function itself stable with `useCallback`. If `renderItem` is recreated on every parent render, every visible row re-renders even though its data did not change.

## Tune the window

`windowSize` controls how many viewports worth of rows stay mounted above and below the visible area. The default is 21, meaning ten screens above and ten below. Lowering it to 5 or 7 cuts memory and render work at the cost of blank areas appearing during fast scrolls. `initialNumToRender` sets how many rows mount before the first frame; keep it just large enough to fill the screen.

## Use getItemLayout for fixed height rows

When every row has the same height, pass `getItemLayout`. It returns the offset and length for an index, which lets FlatList skip measuring rows asynchronously and makes `scrollToIndex` work without rendering everything in between.

## Avoid anonymous functions and inline styles in rows

An inline style object or an arrow function passed as a prop creates a new reference on every render and defeats memoization. Hoist styles into `StyleSheet.create` and pass handlers through `useCallback`.

## Measure before tuning

Enable the performance monitor from the developer menu to watch the JS and UI frame rates while scrolling. If the JS thread drops frames, the problem is render cost. If the UI thread drops frames, the problem is usually image decoding or view depth.
