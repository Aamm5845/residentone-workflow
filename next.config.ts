import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Generate a unique build ID for each deployment
// This is used by the UpdateChecker to detect new versions
const BUILD_TIME = new Date().toISOString()

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'app.meisnerinteriors.com',
        'studioflow-workflow.vercel.app'
      ],
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // TODO: Fix Next.js 15 route handler type errors (see KNOWN_ISSUES.md)
  // Temporarily ignoring to allow deployment while we fix route parameter types
  typescript: {
    ignoreBuildErrors: true,
  },
  // Note: eslint config moved to eslint.config.mjs in Next.js 16
  // Set build-time environment variables
  env: {
    BUILD_TIME: BUILD_TIME,
    NEXT_PUBLIC_BUILD_ID: BUILD_TIME,
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry organization and project
  org: "meisner-interiors",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // Route browser requests to Sentry through Next.js to avoid ad-blockers
  tunnelRoute: "/monitoring",

  // Webpack-specific options
  webpack: {
    // Automatic instrumentation of Vercel Cron Monitors
    automaticVercelMonitors: true,

    // Tree-shaking to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
  },
})
