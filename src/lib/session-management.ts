import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'
import type { AuthSession } from '@/lib/attribution'

// Configuration for session management
const SESSION_CONFIG = {
  maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5'),
  sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '480'), // 8 hours
  deviceIdSecret: process.env.DEVICE_ID_SECRET || 'default-device-secret',
}

/**
 * Generate a device identifier based on user agent and other factors
 */
export function generateDeviceId(userAgent: string, ipAddress?: string): string {
  const fingerprint = `${userAgent}-${ipAddress || 'unknown'}-${SESSION_CONFIG.deviceIdSecret}`
  return createHash('sha256').update(fingerprint).digest('hex').substring(0, 32)
}

/**
 * Create or update a user session record
 */
export async function createOrUpdateUserSession(
  userId: string,
  deviceId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  try {
    // First, clean up expired sessions
    await cleanupExpiredSessions(userId)

    // Check current active sessions
    const activeSessions = await prisma.userSession.count({
      where: {
        userId,
        isActive: true,
      }
    })

    // If we're at the limit and this is a new device, remove oldest session
    if (activeSessions >= SESSION_CONFIG.maxSessionsPerUser) {
      const existingSession = await prisma.userSession.findUnique({
        where: { 
          userId_deviceId: { userId, deviceId }
        }
      })

      if (!existingSession) {
        // Remove the oldest session to make room
        const oldestSession = await prisma.userSession.findFirst({
          where: {
            userId,
            isActive: true,
          },
          orderBy: {
            lastSeen: 'asc'
          }
        })

        if (oldestSession) {
          await prisma.userSession.update({
            where: { id: oldestSession.id },
            data: { isActive: false }
          })
        }
      }
    }

    // Create or update the session
    const session = await prisma.userSession.upsert({
      where: {
        userId_deviceId: { userId, deviceId }
      },
      update: {
        lastSeen: new Date(),
        ipAddress,
        userAgent,
        isActive: true,
      },
      create: {
        userId,
        deviceId,
        ipAddress,
        userAgent,
        lastSeen: new Date(),
        isActive: true,
      }
    })

    return session.id
  } catch (error) {
    console.error('Error creating/updating user session:', error)
    throw error
  }
}

/**
 * Validate if a session is still active and not expired
 */
export async function validateUserSession(
  userId: string,
  deviceId: string
): Promise<boolean> {
  try {
    const session = await prisma.userSession.findUnique({
      where: {
        userId_deviceId: { userId, deviceId }
      }
    })

    if (!session || !session.isActive) {
      return false
    }

    // Check if session is expired based on last activity
    const timeoutMs = SESSION_CONFIG.sessionTimeoutMinutes * 60 * 1000
    const isExpired = Date.now() - session.lastSeen.getTime() > timeoutMs

    if (isExpired) {
      // Mark session as inactive
      await prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false }
      })
      return false
    }

    // Update last seen timestamp
    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastSeen: new Date() }
    })

    return true
  } catch (error) {
    console.error('Error validating user session:', error)
    return false
  }
}

/**
 * Deactivate a specific user session
 */
export async function deactivateUserSession(
  userId: string,
  deviceId: string
): Promise<void> {
  try {
    await prisma.userSession.updateMany({
      where: {
        userId,
        deviceId,
        isActive: true,
      },
      data: {
        isActive: false,
      }
    })
  } catch (error) {
    console.error('Error deactivating user session:', error)
  }
}

/**
 * Deactivate all sessions for a user (except optionally one)
 */
export async function deactivateAllUserSessions(
  userId: string,
  exceptDeviceId?: string
): Promise<number> {
  try {
    const whereClause: any = {
      userId,
      isActive: true,
    }

    if (exceptDeviceId) {
      whereClause.deviceId = { not: exceptDeviceId }
    }

    const result = await prisma.userSession.updateMany({
      where: whereClause,
      data: {
        isActive: false,
      }
    })

    return result.count
  } catch (error) {
    console.error('Error deactivating all user sessions:', error)
    return 0
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string) {
  try {
    return await prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        lastSeen: 'desc'
      }
    })
  } catch (error) {
    console.error('Error getting user sessions:', error)
    return []
  }
}

/**
 * Clean up expired sessions for a user
 */
export async function cleanupExpiredSessions(userId?: string): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - (SESSION_CONFIG.sessionTimeoutMinutes * 60 * 1000))
    
    const whereClause: any = {
      lastSeen: { lt: cutoffTime },
      isActive: true,
    }

    if (userId) {
      whereClause.userId = userId
    }

    const result = await prisma.userSession.updateMany({
      where: whereClause,
      data: {
        isActive: false,
      }
    })

    return result.count
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error)
    return 0
  }
}

/**
 * Enhanced session validation middleware
 */
export async function validateAndRefreshSession(
  session: AuthSession | null,
  request?: Request
): Promise<AuthSession | null> {
  if (!session?.user?.id) {
    return null
  }

  let deviceId: string | undefined
  let ipAddress: string | undefined
  let userAgent: string | undefined

  if (request) {
    userAgent = request.headers.get('user-agent') || undefined
    ipAddress = getIPFromRequest(request)
    
    if (userAgent) {
      deviceId = generateDeviceId(userAgent, ipAddress)
    }
  }

  // If we can't determine device ID, skip session tracking
  if (!deviceId) {
    return session
  }

  try {
    // Validate the session in our database
    const isValid = await validateUserSession(session.user.id, deviceId)
    
    if (!isValid) {
      return null
    }

    // Session is valid, return it
    return session
  } catch (error) {
    console.error('Session validation error:', error)
    return null
  }
}

/**
 * Extract IP address from request headers
 */
function getIPFromRequest(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (real) {
    return real.trim()
  }
  
  return undefined
}

/**
 * Create a secure session token for JWT
 */
export function generateSecureSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Session management configuration
 */
export { SESSION_CONFIG }
