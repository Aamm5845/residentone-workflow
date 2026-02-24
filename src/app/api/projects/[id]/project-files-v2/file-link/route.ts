import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// GET - Generate a temporary Dropbox download link from a relative dropboxPath
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true, dropboxFolder: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const relativePath = searchParams.get('path')

    if (!relativePath) {
      return NextResponse.json({ error: 'path parameter is required' }, { status: 400 })
    }

    if (!project.dropboxFolder) {
      return NextResponse.json({ error: 'No Dropbox folder configured' }, { status: 400 })
    }

    const absolutePath = `${project.dropboxFolder}/${relativePath}`
    const link = await dropboxService.getTemporaryLink(absolutePath)

    if (!link) {
      return NextResponse.json({ error: 'Could not generate link' }, { status: 404 })
    }

    return NextResponse.json({ url: link })
  } catch (error) {
    console.error('[project-files-v2/file-link] Error:', error)
    return NextResponse.json({ error: 'Failed to get file link' }, { status: 500 })
  }
}
