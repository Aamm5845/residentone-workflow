import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { syncIssuesToCursor } from '@/lib/cursor-issues'
import { isValidAuthSession } from '@/lib/attribution'

// POST /api/issues/sync-cursor - Manually sync issues to .cursor/issues.json
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await syncIssuesToCursor()

    return NextResponse.json({ 
      success: true, 
      message: 'Issues synced to .cursor/issues.json' 
    })
  } catch (error) {
    console.error('Error syncing issues to Cursor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - also support GET for easy browser access
export async function GET(request: NextRequest) {
  return POST(request)
}

