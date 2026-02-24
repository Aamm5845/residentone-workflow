import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/projects/[id]/project-files-v2/file-received?path=...
 * Returns received-file history for a given file (by dropboxPath / fileName match).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const filePath = request.nextUrl.searchParams.get('path')

  if (!filePath) {
    return NextResponse.json({ receivedFiles: [] })
  }

  const fileName = filePath.split('/').pop() || ''

  const items = await prisma.receivedFile.findMany({
    where: {
      projectId: id,
      OR: [
        { dropboxPath: { equals: filePath, mode: 'insensitive' } },
        { fileName: { equals: fileName, mode: 'insensitive' } },
      ],
    },
    include: {
      section: {
        select: { id: true, name: true, shortName: true, color: true },
      },
      creator: {
        select: { id: true, name: true },
      },
    },
    orderBy: { receivedDate: 'desc' },
  })

  const receivedFiles = items.map((rf) => ({
    id: rf.id,
    senderName: rf.senderName,
    senderCompany: rf.senderCompany,
    senderEmail: rf.senderEmail,
    receivedDate: rf.receivedDate,
    title: rf.title,
    section: rf.section
      ? { name: rf.section.name, shortName: rf.section.shortName, color: rf.section.color }
      : null,
    loggedBy: rf.creator?.name || null,
  }))

  return NextResponse.json({ receivedFiles })
}
