import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions in dev, reduce in production

  // Session Replay - captures user sessions for debugging
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Set environment
  environment: process.env.NODE_ENV,

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^chrome-extension:\/\//,
    // Network errors that aren't actionable
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    // Common third-party errors
    /gtag/,
    /analytics/,
  ],

  // Only send errors in production, or if explicitly enabled
  enabled: process.env.NODE_ENV === "production" ||
           process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",

  // Add context to errors
  beforeSend(event) {
    // Add current URL
    if (typeof window !== "undefined") {
      event.tags = {
        ...event.tags,
        url: window.location.href,
      };
    }
    return event;
  },
});
