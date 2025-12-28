/**
 * Get the base URL for the application.
 * This is used for generating links in emails, redirects, etc.
 *
 * @updated 2025-12-27 - Always use production URL for email links
 *
 * IMPORTANT: For email links, we ALWAYS want to use app.meisnerinteriors.com
 * regardless of whether this is a preview deployment or production.
 * This ensures suppliers can always access the portal.
 */
export function getBaseUrl(): string {
  // ALWAYS use production URL when on Vercel (production or preview)
  // This ensures email links always work
  if (process.env.VERCEL) {
    return 'https://app.meisnerinteriors.com'
  }

  // Check for explicitly set environment variables (for local dev)
  if (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL !== '') {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '') // Remove trailing slash
  }

  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL !== '') {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL !== '') {
    return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  }

  if (process.env.APP_URL && process.env.APP_URL !== '') {
    return process.env.APP_URL.replace(/\/$/, '')
  }

  // Development fallback
  return 'http://localhost:3000'
}

/**
 * Get the base URL with a specific path appended
 */
export function getUrlWithPath(path: string): string {
  const baseUrl = getBaseUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${cleanPath}`
}

