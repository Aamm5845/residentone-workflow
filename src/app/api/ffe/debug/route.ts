import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Debug endpoint to check FFE library items
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomType = searchParams.get('roomType') || 'bathroom'

    // Get all FFE library items for this org
    const allItems = await prisma.fFELibraryItem.findMany({
      where: {
        orgId: session.user.orgId
      },
      select: {
        id: true,
        itemId: true,
        name: true,
        category: true,
        roomTypes: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // Get items that match the specific room type
    const roomTypeItems = allItems.filter(item => 
      item.roomTypes.includes(roomType)
    )

    return NextResponse.json({
      debug: {
        orgId: session.user.orgId,
        requestedRoomType: roomType,
        totalItems: allItems.length,
        matchingItems: roomTypeItems.length
      },
      allItems: allItems,
      roomTypeItems: roomTypeItems,
      roomTypeBreakdown: allItems.reduce((acc, item) => {
        item.roomTypes.forEach(rt => {
          if (!acc[rt]) acc[rt] = 0
          acc[rt]++
        })
        return acc
      }, {} as Record<string, number>)
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
