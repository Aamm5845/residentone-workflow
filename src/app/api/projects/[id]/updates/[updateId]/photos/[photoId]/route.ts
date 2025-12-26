import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/auth'
import { revalidatePath } from 'next/cache'

// DELETE /api/projects/[id]/updates/[updateId]/photos/[photoId] - Remove photo from update
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string; photoId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId, photoId } = await params

    // First verify user has access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 })
    }

    // Check if the photo exists and belongs to the specified update
    const photo = await prisma.projectUpdatePhoto.findFirst({
      where: {
        id: photoId,
        updateId
      }
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Verify the update belongs to this project
    const update = await prisma.projectUpdate.findFirst({
      where: {
        id: updateId,
        projectId
      },
      select: { id: true }
    })

    if (!update) {
      return NextResponse.json({ error: 'Update not found in this project' }, { status: 404 })
    }

    // Remove photo
    await prisma.projectUpdatePhoto.delete({
      where: { id: photoId }
    })

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId,
        actorId: session.user.id,
        actionType: 'REMOVE_PHOTO',
        entityType: 'PROJECT_UPDATE_PHOTO',
        entityId: photoId,
        description: `Removed photo${photo.caption ? `: ${photo.caption}` : ''}`,
        metadata: {
          photoId,
          assetId: photo.assetId
        }
      }
    })

    // Revalidate pages
    revalidatePath(`/projects/${projectId}/project-updates`)

    return NextResponse.json({ message: 'Photo removed successfully' })
  } catch (error) {
    console.error('Error removing photo:', error)
    return NextResponse.json(
      { error: 'Failed to remove photo' },
      { status: 500 }
    )
  }
}

