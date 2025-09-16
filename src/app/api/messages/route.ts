import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In fallback mode, simulate message posting with mock data
    console.log('Database unavailable, using mock message posting')
    
    const data = await request.json()
    const { message, sectionId, roomId } = data

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Generate mock message data
    const mockMessage = {
      id: `msg-${Date.now()}`,
      message: message.trim(),
      createdAt: new Date().toISOString(),
      author: {
        id: session.user.id || 'mock-user',
        name: session.user.name || 'Unknown User',
        role: 'OWNER'
      },
      sectionId,
      roomId
    }

    return NextResponse.json({
      success: true,
      message: mockMessage
    })

  } catch (error) {
    console.error('Error posting message:', error)
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')
    const roomId = searchParams.get('roomId')

    console.log('Database unavailable, using mock messages')

    // Return mock messages
    const mockMessages = [
      {
        id: 'msg-1',
        message: 'Looking great so far! I think the color palette works well.',
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        author: {
          id: 'mock-user-1',
          name: 'Sarah Designer',
          role: 'DESIGNER'
        },
        sectionId,
        roomId
      },
      {
        id: 'msg-2', 
        message: 'Client approved the material selections. Moving forward with this direction.',
        createdAt: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
        author: {
          id: 'mock-user-2',
          name: 'Project Manager',
          role: 'OWNER'
        },
        sectionId,
        roomId
      }
    ]

    return NextResponse.json({
      success: true,
      messages: mockMessages
    })

  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}