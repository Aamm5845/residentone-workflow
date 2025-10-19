import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, forceCleanup = false } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Get the active spec book for this project
    const specBook = await prisma.specBook.findFirst({
      where: {
        projectId,
        isActive: true,
        project: {
          orgId: session.user.orgId
        }
      }
    })

    if (!specBook) {
      return NextResponse.json({ error: 'No active spec book found' }, { status: 404 })
    }

    console.log('[CLEANUP] Starting cleanup for spec book:', specBook.id)

    if (forceCleanup) {
      // Hard delete all file links for this spec book
      const deletedLinks = await prisma.dropboxFileLink.deleteMany({
        where: {
          section: {
            specBookId: specBook.id
          }
        }
      })

      console.log('[CLEANUP] Hard deleted', deletedLinks.count, 'file links')

      return NextResponse.json({
        success: true,
        action: 'hard_delete',
        deletedCount: deletedLinks.count,
        message: 'All file links permanently deleted'
      })
    } else {
      // Soft delete - mark all as inactive
      const updatedLinks = await prisma.dropboxFileLink.updateMany({
        where: {
          section: {
            specBookId: specBook.id
          },
          isActive: true
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      })

      console.log('[CLEANUP] Soft deleted', updatedLinks.count, 'file links')

      return NextResponse.json({
        success: true,
        action: 'soft_delete',
        updatedCount: updatedLinks.count,
        message: 'All file links marked as inactive'
      })
    }

  } catch (error) {
    console.error('Cleanup files error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}