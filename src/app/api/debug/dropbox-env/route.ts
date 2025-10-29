import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only show env status, not actual values for security
    const envStatus = {
      DROPBOX_ACCESS_TOKEN: !!process.env.DROPBOX_ACCESS_TOKEN,
      DROPBOX_TEAM_MEMBER_ID: !!process.env.DROPBOX_TEAM_MEMBER_ID,
      DROPBOX_REFRESH_TOKEN: !!process.env.DROPBOX_REFRESH_TOKEN,
      DROPBOX_APP_KEY: !!process.env.DROPBOX_APP_KEY,
      DROPBOX_APP_SECRET: !!process.env.DROPBOX_APP_SECRET,
      CLOUDCONVERT_API_KEY: !!process.env.CLOUDCONVERT_API_KEY,
      BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN
    }

    const hasBasicAuth = envStatus.DROPBOX_ACCESS_TOKEN && envStatus.DROPBOX_TEAM_MEMBER_ID
    const hasRefreshAuth = envStatus.DROPBOX_REFRESH_TOKEN && envStatus.DROPBOX_APP_KEY && envStatus.DROPBOX_APP_SECRET && envStatus.DROPBOX_TEAM_MEMBER_ID

    return NextResponse.json({
      success: true,
      environmentVariables: envStatus,
      authenticationReady: hasBasicAuth || hasRefreshAuth,
      authMethod: hasRefreshAuth ? 'refresh_token' : hasBasicAuth ? 'access_token' : 'none',
      recommendations: {
        missingCritical: Object.entries(envStatus)
          .filter(([key, value]) => !value && (key.startsWith('DROPBOX_') || key === 'CLOUDCONVERT_API_KEY'))
          .map(([key]) => key),
        setupRequired: !hasBasicAuth && !hasRefreshAuth
      }
    })

  } catch (error) {
    console.error('Environment debug error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
