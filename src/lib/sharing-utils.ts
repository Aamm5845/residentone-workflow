/**
 * Utility functions for sharing functionality (both project and phase level)
 */

export interface ExpiryStatus {
  status: 'never' | 'active' | 'expiring' | 'expired'
  label: string
  color: string
}

/**
 * Get expiry status information for a token
 */
export function getExpiryStatus(expiresAt?: string | null): ExpiryStatus {
  if (!expiresAt) {
    return { 
      status: 'never', 
      label: 'Never Expires', 
      color: 'bg-gray-100 text-gray-800' 
    }
  }
  
  const expiryDate = new Date(expiresAt)
  const now = new Date()
  const diffTime = expiryDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return { 
      status: 'expired', 
      label: 'Expired', 
      color: 'bg-red-100 text-red-800' 
    }
  } else if (diffDays <= 7) {
    return { 
      status: 'expiring', 
      label: `Expires in ${diffDays}d`, 
      color: 'bg-yellow-100 text-yellow-800' 
    }
  } else {
    return { 
      status: 'active', 
      label: `Expires ${expiryDate.toLocaleDateString()}`, 
      color: 'bg-green-100 text-green-800' 
    }
  }
}

/**
 * Generate a share URL for different entity types
 */
export function generateShareUrl(token: string, entityType: 'project' | 'phase' = 'phase'): string {
  const baseUrl = process.env.NEXTAUTH_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const urlPath = entityType === 'project' ? 'client-progress' : 'phase-progress'
  return `${baseUrl}/${urlPath}/${token}`
}

/**
 * Extract IP address from request headers
 */
export function getClientIP(request: Request): string | null {
  // Try various headers that might contain the real IP
  const xForwardedFor = request.headers.get('x-forwarded-for')
  const xRealIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim()
  }
  
  if (xRealIp) {
    return xRealIp
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  return null
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent')
}

/**
 * Validate token expiry
 */
export function isTokenExpired(expiresAt?: Date | string | null): boolean {
  if (!expiresAt) {
    return false // No expiry means never expired
  }
  
  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return new Date() > expiryDate
}

/**
 * Validate token format
 */
export function isValidTokenFormat(token: string): boolean {
  // Tokens should be alphanumeric and at least 16 characters long
  return /^[a-zA-Z0-9_-]{16,}$/.test(token)
}

/**
 * Sanitize token name for display
 */
export function sanitizeTokenName(name?: string | null, fallback: string = 'Unnamed Access Link'): string {
  if (!name || name.trim().length === 0) {
    return fallback
  }
  
  // Basic sanitization: remove potentially dangerous characters
  return name.trim().replace(/[<>\"'&]/g, '').substring(0, 100)
}