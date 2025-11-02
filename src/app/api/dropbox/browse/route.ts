import { NextRequest, NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service-v2'
import { getSession } from '@/auth'

export async function GET(request: NextRequest) {
  try {
    
    const session = await getSession()
    if (!session?.user) {
      
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''
    const cursor = searchParams.get('cursor') || undefined
    const memberId = searchParams.get('memberId') || undefined

    const result = await dropboxService.listFolder(path, memberId, cursor)
    
    return NextResponse.json({
      success: true,
      ...result
    })

  } catch (error) {
    console.error('Dropbox browse API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to browse Dropbox folder' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, maxResults } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'query parameter is required' }, 
        { status: 400 }
      )
    }

    const files = await dropboxService.searchCADFiles(query, maxResults || 50)

    return NextResponse.json({
      success: true,
      files
    })

  } catch (error) {
    console.error('Dropbox search API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search Dropbox files' 
      },
      { status: 500 }
    )
  }
}
