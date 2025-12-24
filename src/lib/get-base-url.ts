/**
 * Get the base URL for the application.
 * This is used for generating links in emails, redirects, etc.
 * 
 * @updated 2025-12-24 - Deployment test v2
 * 
 * Order of preference:
 * 1. NEXT_PUBLIC_BASE_URL (if explicitly set)
 * 2. NEXT_PUBLIC_APP_URL (if explicitly set)
 * 3. NEXTAUTH_URL (if explicitly set)
 * 4. APP_URL (if explicitly set)
 * 5. Production URL for app.meisnerinteriors.com
 */
export function getBaseUrl(): string {
  // Check for explicitly set environment variables
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
  
  // Default production URL for Meisner Interiors
  // This takes priority over VERCEL_URL to ensure email links always go to production domain
  if (process.env.NODE_ENV === 'production') {
    return 'https://app.meisnerinteriors.com'
  }
  
  // In preview deployments (non-production Vercel), use the Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
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

