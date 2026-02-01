import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { PDFDocument } from 'pdf-lib'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Variable expense categories for AI extraction
const VARIABLE_CATEGORIES = [
  'GROCERIES',
  'MEAT',
  'FISH',
  'GAS',
  'MEDICAL',
  'CLOTHING',
  'CAR_SERVICE',
]

interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  type: 'DEBIT' | 'CREDIT'
  merchantName?: string
  suggestedCategory?: string
}

// POST - Process a statement upload with AI
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { uploadId } = await request.json()

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID required' }, { status: 400 })
    }

    // Get the statement upload
    const statementUpload = await prisma.statementUpload.findFirst({
      where: {
        id: uploadId,
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
      },
      include: {
        bankAccount: {
          include: {
            plaidItem: true,
          },
        },
      },
    })

    if (!statementUpload) {
      return NextResponse.json({ error: 'Statement upload not found' }, { status: 404 })
    }

    // Update status to processing
    await prisma.statementUpload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING' },
    })

    try {
      // Download the PDF from Dropbox
      let pdfBuffer: Buffer

      if (statementUpload.fileUrl.startsWith('local://')) {
        return NextResponse.json(
          { error: 'Local file storage not implemented - file must be uploaded to Dropbox' },
          { status: 400 }
        )
      }

      // Extract the path from the shared link or use direct path
      const dropboxPath = statementUpload.fileUrl.includes('dropbox.com')
        ? statementUpload.fileUrl
        : statementUpload.fileUrl

      try {
        pdfBuffer = await dropboxService.downloadFile(
          dropboxPath.replace(/\?.*$/, '').replace('raw=1', '').replace('dl=1', '')
        )
      } catch (downloadError) {
        console.error('[StatementProcess] Failed to download from Dropbox:', downloadError)
        throw new Error('Failed to download PDF from storage')
      }

      // Load the PDF to get page count
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pageCount = pdfDoc.getPageCount()

      // Update page count
      await prisma.statementUpload.update({
        where: { id: uploadId },
        data: { pageCount },
      })

      // Convert PDF to base64 for GPT-4o Vision
      const base64Pdf = pdfBuffer.toString('base64')

      // Extract transactions using GPT-4o
      const transactions = await extractTransactionsWithAI(base64Pdf, pageCount, statementUpload.bankAccount.name)

      // Get existing Plaid transactions for duplicate detection
      const statementMonth = new Date(statementUpload.statementMonth)
      const monthStart = new Date(statementMonth.getFullYear(), statementMonth.getMonth(), 1)
      const monthEnd = new Date(statementMonth.getFullYear(), statementMonth.getMonth() + 1, 0)

      const plaidTransactions = await prisma.bankTransaction.findMany({
        where: {
          bankAccountId: statementUpload.bankAccountId,
          date: {
            gte: new Date(monthStart.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
            lte: new Date(monthEnd.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days after
          },
        },
        select: {
          id: true,
          transactionId: true,
          amount: true,
          date: true,
          name: true,
          merchantName: true,
        },
      })

      // Create statement transactions
      let createdCount = 0
      let duplicateCount = 0

      for (const txn of transactions) {
        // Check for duplicates by matching date (±1 day) and amount
        const txnDate = new Date(txn.date)
        const duplicate = plaidTransactions.find((pt) => {
          const dateDiff = Math.abs(txnDate.getTime() - new Date(pt.date).getTime())
          const sameAmount = Math.abs(Number(pt.amount) - Math.abs(txn.amount)) < 0.01
          return dateDiff <= 24 * 60 * 60 * 1000 && sameAmount // Within 1 day and same amount
        })

        await prisma.statementTransaction.create({
          data: {
            statementUploadId: uploadId,
            bankAccountId: statementUpload.bankAccountId,
            date: txnDate,
            description: txn.description,
            amount: Math.abs(txn.amount),
            type: txn.type,
            merchantName: txn.merchantName,
            variableCategory: txn.suggestedCategory || null,
            isDuplicate: !!duplicate,
            duplicateOfId: duplicate?.transactionId || null,
            confidence: txn.suggestedCategory ? 'medium' : null,
          },
        })

        createdCount++
        if (duplicate) duplicateCount++
      }

      // Update the upload status
      await prisma.statementUpload.update({
        where: { id: uploadId },
        data: {
          status: 'COMPLETED',
          transactionCount: createdCount,
        },
      })

      return NextResponse.json({
        success: true,
        uploadId,
        pageCount,
        transactionCount: createdCount,
        duplicateCount,
        uniqueCount: createdCount - duplicateCount,
      })
    } catch (processError: any) {
      console.error('[StatementProcess] Processing error:', processError)

      // Update status to failed
      await prisma.statementUpload.update({
        where: { id: uploadId },
        data: {
          status: 'FAILED',
          errorMessage: processError.message || 'Processing failed',
        },
      })

      throw processError
    }
  } catch (error: any) {
    console.error('[StatementProcess] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process statement' },
      { status: 500 }
    )
  }
}

// Extract transactions from PDF using GPT-4o Vision
async function extractTransactionsWithAI(
  base64Pdf: string,
  pageCount: number,
  accountName: string
): Promise<ExtractedTransaction[]> {
  const prompt = `You are extracting transactions from a credit card or bank statement PDF for "${accountName}".

Extract ALL transactions visible in this statement. For each transaction, provide:
- date: The transaction date in YYYY-MM-DD format
- description: The full transaction description as shown
- amount: The transaction amount as a positive number
- type: "DEBIT" for purchases/charges, "CREDIT" for payments/refunds
- merchantName: Clean merchant name extracted from description (if identifiable)
- suggestedCategory: One of these categories if applicable: ${VARIABLE_CATEGORIES.join(', ')} (leave null if not applicable)

Category hints:
- GROCERIES: Supermarkets, grocery stores (Costco, Walmart, Metro, IGA, Loblaws, etc.)
- MEAT: Butcher shops, meat markets, specialty meat stores
- FISH: Fish markets, seafood stores
- GAS: Gas stations (Esso, Shell, Petro-Canada, etc.)
- MEDICAL: Pharmacies, doctors, dentists, clinics
- CLOTHING: Clothing stores, shoe stores
- CAR_SERVICE: Auto repair, car washes, tire shops

Return ONLY a valid JSON object with this structure:
{
  "transactions": [
    {
      "date": "2025-01-15",
      "description": "COSTCO WHOLESALE #123",
      "amount": 156.78,
      "type": "DEBIT",
      "merchantName": "Costco",
      "suggestedCategory": "GROCERIES"
    }
  ]
}

IMPORTANT:
- Extract ALL transactions, not just a sample
- Use the statement date, not today's date
- Amounts should be positive numbers
- Only include actual transactions, not statement headers or totals`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64Pdf}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 16000,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content || '{}'

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[StatementProcess] No JSON found in AI response:', content)
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])
    const transactions = parsed.transactions || []

    // Validate and clean transactions
    return transactions
      .filter((t: any) => t.date && t.description && typeof t.amount === 'number')
      .map((t: any) => ({
        date: t.date,
        description: t.description,
        amount: Math.abs(t.amount),
        type: t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        merchantName: t.merchantName || null,
        suggestedCategory: VARIABLE_CATEGORIES.includes(t.suggestedCategory)
          ? t.suggestedCategory
          : null,
      }))
  } catch (error) {
    console.error('[StatementProcess] AI extraction error:', error)
    throw new Error('Failed to extract transactions from PDF')
  }
}
