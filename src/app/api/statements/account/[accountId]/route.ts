import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - List all statement uploads for an account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { accountId } = await params

    // Verify the bank account exists and belongs to the user's org
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: accountId,
        plaidItem: {
          orgId: session.user.orgId,
        },
      },
    })

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    // Get all statement uploads for this account
    const uploads = await prisma.statementUpload.findMany({
      where: {
        bankAccountId: accountId,
      },
      orderBy: {
        statementMonth: 'desc',
      },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    })

    // Get transaction summary for each upload
    const uploadsWithStats = await Promise.all(
      uploads.map(async (upload) => {
        const stats = await prisma.statementTransaction.groupBy({
          by: ['isDuplicate'],
          where: {
            statementUploadId: upload.id,
          },
          _count: true,
        })

        const duplicates = stats.find((s) => s.isDuplicate)?._count || 0
        const unique = stats.find((s) => !s.isDuplicate)?._count || 0

        return {
          id: upload.id,
          fileName: upload.fileName,
          fileUrl: upload.fileUrl,
          statementMonth: upload.statementMonth,
          status: upload.status,
          pageCount: upload.pageCount,
          transactionCount: upload.transactionCount,
          duplicateCount: duplicates,
          uniqueCount: unique,
          errorMessage: upload.errorMessage,
          createdAt: upload.createdAt,
        }
      })
    )

    return NextResponse.json({
      accountId,
      uploads: uploadsWithStats,
    })
  } catch (error: any) {
    console.error('[StatementList] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list statement uploads' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a statement upload and its transactions
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { accountId } = await params
    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get('uploadId')

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID required' }, { status: 400 })
    }

    // Verify the statement belongs to the user's account
    const statementUpload = await prisma.statementUpload.findFirst({
      where: {
        id: uploadId,
        bankAccountId: accountId,
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
      },
    })

    if (!statementUpload) {
      return NextResponse.json({ error: 'Statement upload not found' }, { status: 404 })
    }

    // Delete the statement upload (transactions will cascade delete)
    await prisma.statementUpload.delete({
      where: { id: uploadId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[StatementDelete] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete statement upload' },
      { status: 500 }
    )
  }
}
