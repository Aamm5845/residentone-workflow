import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getUserSessions,
  deactivateAllUserSessions,
  generateDeviceId
} from '@/lib/session-management'
import {
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  getUserAgent,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// GET /api/sessions - Get current user's active sessions
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessions = await getUserSessions(session.user.id)
    
    // Get current device ID for comparison
    const userAgent = getUserAgent(request)
    const ipAddress = getIPAddress(request)
    let currentDeviceId: string | undefined
    
    if (userAgent) {
      currentDeviceId = generateDeviceId(userAgent, ipAddress)
    }

    // Format session data for client
    const formattedSessions = sessions.map(userSession => ({
      id: userSession.id,
      deviceId: userSession.deviceId,
      ipAddress: userSession.ipAddress,
      userAgent: userSession.userAgent,
      lastSeen: userSession.lastSeen,
      createdAt: userSession.createdAt,
      isCurrent: userSession.deviceId === currentDeviceId
    }))

    return NextResponse.json({
      sessions: formattedSessions,
      currentDeviceId
    })
  } catch (error) {
    console.error('Error fetching user sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/sessions - Sign out from all other devices
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current device ID to preserve this session
    const userAgent = getUserAgent(request)
    let currentDeviceId: string | undefined
    
    if (userAgent) {
      currentDeviceId = generateDeviceId(userAgent, ipAddress)
    }

    // Deactivate all sessions except current device
    const deactivatedCount = await deactivateAllUserSessions(
      session.user.id,
      currentDeviceId
    )

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.LOGOUT,
      entity: EntityTypes.SESSION,
      entityId: 'all-other-devices',
      details: {
        deactivatedSessions: deactivatedCount,
        currentDeviceId,
        signOutAllDevices: true
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: `Signed out from ${deactivatedCount} other device(s)`
    })
  } catch (error) {
    console.error('Error signing out from other devices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
