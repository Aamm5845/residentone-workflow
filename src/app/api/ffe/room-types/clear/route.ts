import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE - Clear all room types for an organization
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Soft delete all room types for this organization
    const result = await prisma.fFELibraryItem.updateMany({
      where: {
        orgId,
        itemType: 'ROOM_TYPE',
        isActive: true
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.count,
      message: `Successfully cleared ${result.count} room types`
    })
  } catch (error) {
    console.error('Error clearing room types:', error)
    return NextResponse.json({ error: 'Failed to clear room types' }, { status: 500 })
  }
}