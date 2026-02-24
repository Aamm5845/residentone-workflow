import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/projects/[id]/project-files-v2/file-transmittals?path=...
 * Returns transmittal history for a given file (by dropboxPath match).
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
    return NextResponse.json({ transmittals: [] })
  }

  const fileName = filePath.split('/').pop() || ''

  // Search TransmittalItems by:
  // 1. item.dropboxPath matches (new flow)
  // 2. item.fileName matches (new flow)
  // 3. drawing.dropboxPath matches (old flow via drawing relation)
  const items = await prisma.transmittalItem.findMany({
    where: {
      transmittal: { projectId: id },
      OR: [
        { dropboxPath: filePath },
        { fileName: fileName },
        { drawing: { dropboxPath: filePath } },
      ],
    },
    include: {
      transmittal: {
        select: {
          id: true,
          transmittalNumber: true,
          recipientName: true,
          recipientEmail: true,
          recipientCompany: true,
          sentAt: true,
          status: true,
          subject: true,
        },
      },
    },
    orderBy: { transmittal: { sentAt: 'desc' } },
  })

  // Deduplicate by transmittal ID
  const seen = new Set<string>()
  const transmittals = items
    .filter(item => {
      if (seen.has(item.transmittalId)) return false
      seen.add(item.transmittalId)
      return true
    })
    .map(item => ({
      id: item.transmittal.id,
      transmittalNumber: item.transmittal.transmittalNumber,
      recipientName: item.transmittal.recipientName,
      recipientEmail: item.transmittal.recipientEmail,
      recipientCompany: item.transmittal.recipientCompany,
      sentAt: item.transmittal.sentAt,
      status: item.transmittal.status,
      subject: item.transmittal.subject,
    }))

  return NextResponse.json({ transmittals })
}
