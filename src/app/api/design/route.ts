import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // This route might be used by the frontend - return basic info
    return NextResponse.json({ 
      message: 'Design endpoint available',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in design route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}