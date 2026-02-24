import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// DELETE - Remove a received file record
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; receivedFileId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, receivedFileId } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const existing = await prisma.receivedFile.findFirst({
      where: { id: receivedFileId, projectId: id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Received file not found' }, { status: 404 })
    }

    await prisma.receivedFile.delete({ where: { id: receivedFileId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[receive-files/[receivedFileId]] Error deleting received file:', error)
    return NextResponse.json(
      { error: 'Failed to delete received file' },
      { status: 500 }
    )
  }
}
