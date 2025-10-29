import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'

export async function GET(request: NextRequest) {
  try {
    
    const session = await getSession()
    
    const sessionInfo = {
      exists: !!session,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        orgId: session.user.orgId,
        orgName: session.user.orgName
      } : null,
      expires: session?.expires,
      isValidAuthSession: isValidAuthSession(session)
    }

    return NextResponse.json({
      success: true,
      sessionInfo,
      cookies: request.headers.get('cookie') || 'No cookies',
      headers: {
        authorization: request.headers.get('authorization'),
        'x-forwarded-for': request.headers.get('x-forwarded-for'),
        'user-agent': request.headers.get('user-agent')
      }
    })

  } catch (error) {
    console.error('❌ Session info error:', error)
    
    return NextResponse.json({ 
      error: 'Session info failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
