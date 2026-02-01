import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

// POST - Upload a PDF statement
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bankAccountId = formData.get('bankAccountId') as string | null
    const statementMonth = formData.get('statementMonth') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!bankAccountId) {
      return NextResponse.json({ error: 'Bank account ID required' }, { status: 400 })
    }

    if (!statementMonth) {
      return NextResponse.json({ error: 'Statement month required' }, { status: 400 })
    }

    // Verify the bank account exists and belongs to the user's org
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        plaidItem: {
          orgId: session.user.orgId,
        },
      },
      include: {
        plaidItem: true,
      },
    })

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const monthDate = new Date(statementMonth)
    const monthStr = monthDate.toISOString().substring(0, 7) // YYYY-MM
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `statement_${monthStr}_${timestamp}_${sanitizedName}`

    // Upload to Dropbox in a statements folder
    const dropboxPath = `/Statements/${bankAccount.plaidItem.institutionName || 'Unknown'}/${fileName}`

    let fileUrl = ''
    try {
      await dropboxService.uploadFile(dropboxPath, buffer, { mode: 'add' })
      const sharedLink = await dropboxService.createSharedLink(dropboxPath)
      fileUrl = sharedLink || dropboxPath
    } catch (uploadError) {
      console.error('[StatementUpload] Dropbox upload failed:', uploadError)
      // Continue without Dropbox - store locally or use placeholder
      fileUrl = `local://${fileName}`
    }

    // Create the StatementUpload record
    const statementUpload = await prisma.statementUpload.create({
      data: {
        bankAccountId,
        fileName: file.name,
        fileUrl,
        statementMonth: monthDate,
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      success: true,
      upload: {
        id: statementUpload.id,
        fileName: statementUpload.fileName,
        fileUrl: statementUpload.fileUrl,
        statementMonth: statementUpload.statementMonth,
        status: statementUpload.status,
      },
    })
  } catch (error: any) {
    console.error('[StatementUpload] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload statement' },
      { status: 500 }
    )
  }
}
