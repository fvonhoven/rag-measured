# Testing

A React Native app can be tested at three levels: unit tests for plain functions, component tests that render React trees in Node, and end to end tests that drive a real build on a device or simulator.

## Jest setup

New projects come with Jest configured through the `react-native` preset. The preset mocks native modules so components can render without a device, and it transforms TypeScript and JSX with Babel. Run tests with `npm test`; the preset is declared in `package.json` under the `jest` key.

## Component tests

React Native Testing Library renders components with `render` and queries the result the way a user would, for example `getByText` or `getByRole`. Prefer those queries over test ids because they fail when the accessible label changes, which is usually a real regression. `fireEvent.press` triggers a press handler.

## Mocking native modules

Libraries that wrap native code often ship a Jest mock, and the preset already mocks the core modules. For a library without one, call `jest.mock('library-name', () => ({ ... }))` in a setup file listed under `setupFiles`. Without a mock, importing the library throws because the native side is absent in Node.

## Snapshot tests

`toMatchSnapshot` stores the rendered tree and fails when it changes. Snapshots are cheap to write and expensive to review; keep them small and delete ones nobody reads.

## End to end tests

Detox and Maestro both automate a real app. Detox runs inside the app process and synchronizes with the animation and network queues so tests do not need sleeps. Maestro drives the app from outside through a YAML flow file and needs no code changes in the app. Both require a built binary, so they run in CI on a simulator or emulator rather than in Node.
