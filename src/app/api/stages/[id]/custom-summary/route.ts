import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

/**
 * PUT /api/stages/[id]/custom-summary
 * Save custom edited AI summary
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: stageId } = await params
    const body = await request.json()
    const { summary } = body

    if (!summary || typeof summary !== 'string') {
      return NextResponse.json(
        { error: 'Summary text is required' },
        { status: 400 }
      )
    }

    // Update the stage with custom summary
    const updated = await prisma.stage.update({
      where: { id: stageId },
      data: {
        customAiSummary: summary,
        updatedById: session.user.id
      }
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[Custom Summary] Error saving:', error)
    return NextResponse.json(
      { error: 'Failed to save custom summary' },
      { status: 500 }
    )
  }
}
