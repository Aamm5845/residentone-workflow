/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)` | `/(auth)/login` | `/(auth)/setup` | `/(tabs)` | `/(tabs)/` | `/(tabs)/camera-tab` | `/(tabs)/profile` | `/(tabs)/queue` | `/_sitemap` | `/camera` | `/camera-tab` | `/login` | `/profile` | `/queue` | `/setup`;
      DynamicRoutes: `/project/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/project/[id]`;
    }
  }
}
