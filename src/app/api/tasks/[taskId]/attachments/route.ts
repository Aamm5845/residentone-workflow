import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/tasks/[taskId]/attachments - Add attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await params
    const body = await request.json()

    if (!body.name || !body.url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 })
    }

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        name: body.name,
        url: body.url,
        size: body.size || null,
        type: body.type || null,
        uploadedById: session.user.id
      },
      include: {
        uploadedBy: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ attachment }, { status: 201 })
  } catch (error) {
    console.error('Error creating attachment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[taskId]/attachments - Delete attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 })
    }

    await prisma.taskAttachment.delete({ where: { id: attachmentId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
