import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, filePath } = await request.json()

    if (!projectId || !filePath) {
      return NextResponse.json(
        { error: 'projectId and filePath are required' },
        { status: 400 }
      )
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Find and deactivate the file link
    const updated = await prisma.dropboxFileLink.updateMany({
      where: {
        dropboxPath: filePath,
        section: {
          specBook: {
            projectId: projectId
          }
        }
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      unlinkedCount: updated.count
    })

  } catch (error) {
    console.error('Unlink files API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}