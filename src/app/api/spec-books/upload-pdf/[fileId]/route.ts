import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await params

    // Verify file link exists and user has access
    const fileLink = await prisma.dropboxFileLink.findFirst({
      where: {
        id: fileId,
        section: {
          specBook: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      }
    })

    if (!fileLink) {
      return NextResponse.json(
        { error: 'File link not found or access denied' },
        { status: 404 }
      )
    }

    // Delete the file link
    await prisma.dropboxFileLink.delete({
      where: { id: fileId }
    })

    return NextResponse.json({
      success: true,
      message: 'PDF removed successfully'
    })

  } catch (error) {
    console.error('Error removing PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
