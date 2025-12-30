import type { NextConfig } from 'next'

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
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Set build-time environment variables
  env: {
    BUILD_TIME: BUILD_TIME,
    NEXT_PUBLIC_BUILD_ID: BUILD_TIME,
  },
}

export default nextConfig
