import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// GET - Get detailed account info
export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (accountId) {
      // Get single account
      const account = await prisma.bankAccount.findFirst({
        where: {
          id: accountId,
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        include: {
          plaidItem: {
            select: { institutionName: true },
          },
        },
      })

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }

      return NextResponse.json({ account: formatAccount(account) })
    }

    // Get all credit accounts with details
    const accounts = await prisma.bankAccount.findMany({
      where: {
        plaidItem: {
          orgId: session.user.orgId,
          status: 'ACTIVE',
        },
        isActive: true,
        type: { in: ['credit', 'loan'] },
      },
      include: {
        plaidItem: {
          select: { institutionName: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      accounts: accounts.map(formatAccount),
    })
  } catch (error: any) {
    console.error('Get account details error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update account details (from screenshot or manual entry)
export async function PUT(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { accountId, ...updates } = body

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    // Verify account belongs to user's org
    const account = await prisma.bankAccount.findFirst({
      where: {
        id: accountId,
        plaidItem: {
          orgId: session.user.orgId,
        },
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Update account with provided details
    const updated = await prisma.bankAccount.update({
      where: { id: accountId },
      data: {
        nickname: updates.nickname,
        creditLimit: updates.creditLimit ? parseFloat(updates.creditLimit) : undefined,
        interestRate: updates.interestRate ? parseFloat(updates.interestRate) : undefined,
        dueDay: updates.dueDay ? parseInt(updates.dueDay) : undefined,
        minimumPayment: updates.minimumPayment ? parseFloat(updates.minimumPayment) : undefined,
        lastStatementBalance: updates.lastStatementBalance ? parseFloat(updates.lastStatementBalance) : undefined,
        statementStartDay: updates.statementStartDay ? parseInt(updates.statementStartDay) : undefined,
        statementEndDay: updates.statementEndDay ? parseInt(updates.statementEndDay) : undefined,
        promoRate: updates.promoRate ? parseFloat(updates.promoRate) : undefined,
        promoRateExpiry: updates.promoRateExpiry ? new Date(updates.promoRateExpiry) : undefined,
        rewardsProgram: updates.rewardsProgram,
        rewardsBalance: updates.rewardsBalance ? parseFloat(updates.rewardsBalance) : undefined,
      },
    })

    return NextResponse.json({ success: true, account: updated })
  } catch (error: any) {
    console.error('Update account details error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Extract account details from screenshot using AI
export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { imageBase64, accountId } = body

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 })
    }

    // Use GPT-4 Vision to extract credit card details
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a financial data extractor. Extract credit card/account details from bank statement screenshots.
Return JSON with these fields (use null if not found):
{
  "cardName": "full card name",
  "cardNumber": "last 4 digits only",
  "currentBalance": number,
  "availableCredit": number,
  "creditLimit": number,
  "dueDate": "YYYY-MM-DD or day number if only day shown",
  "dueDay": number (1-31),
  "minimumPayment": number,
  "lastStatementBalance": number,
  "statementPeriod": "start date - end date",
  "statementStartDay": number,
  "statementEndDay": number,
  "interestRate": number (APR percentage),
  "promoRate": number (if promotional rate shown),
  "lastPaymentDate": "YYYY-MM-DD",
  "lastPaymentAmount": number,
  "rewardsProgram": "program name",
  "rewardsBalance": number
}`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Extract all credit card/account details from this bank screenshot. Return only valid JSON.',
            },
          ],
        },
      ],
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content || '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    // If accountId provided, update the account
    if (accountId && Object.keys(extracted).length > 0) {
      const account = await prisma.bankAccount.findFirst({
        where: {
          id: accountId,
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
      })

      if (account) {
        await prisma.bankAccount.update({
          where: { id: accountId },
          data: {
            creditLimit: extracted.creditLimit || undefined,
            dueDay: extracted.dueDay || undefined,
            minimumPayment: extracted.minimumPayment || undefined,
            lastStatementBalance: extracted.lastStatementBalance || undefined,
            statementStartDay: extracted.statementStartDay || undefined,
            statementEndDay: extracted.statementEndDay || undefined,
            interestRate: extracted.interestRate || undefined,
            promoRate: extracted.promoRate || undefined,
            rewardsProgram: extracted.rewardsProgram || undefined,
            rewardsBalance: extracted.rewardsBalance || undefined,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      extracted,
      message: accountId ? 'Account updated with extracted data' : 'Data extracted (not saved)',
    })
  } catch (error: any) {
    console.error('Extract from screenshot error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function formatAccount(account: any) {
  return {
    id: account.id,
    accountId: account.accountId,
    name: account.name,
    officialName: account.officialName,
    nickname: account.nickname,
    type: account.type,
    subtype: account.subtype,
    mask: account.mask,
    currentBalance: Number(account.currentBalance || 0),
    availableBalance: Number(account.availableBalance || 0),
    creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
    interestRate: account.interestRate ? Number(account.interestRate) : null,
    dueDay: account.dueDay,
    minimumPayment: account.minimumPayment ? Number(account.minimumPayment) : null,
    lastStatementBalance: account.lastStatementBalance ? Number(account.lastStatementBalance) : null,
    statementStartDay: account.statementStartDay,
    statementEndDay: account.statementEndDay,
    promoRate: account.promoRate ? Number(account.promoRate) : null,
    promoRateExpiry: account.promoRateExpiry,
    rewardsProgram: account.rewardsProgram,
    rewardsBalance: account.rewardsBalance ? Number(account.rewardsBalance) : null,
    institutionName: account.plaidItem?.institutionName,
    lastUpdated: account.lastBalanceUpdate,
  }
}
