import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// POST - Extract bill information from a screenshot
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
    const file = formData.get('file') as File
    const hint = formData.get('hint') as string | null // e.g., "line of credit", "credit card statement"

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/png'

    // Use OpenAI Vision to extract bill information
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a financial document analyzer. Extract billing information from bank statements, credit card statements, and other financial documents.

Always respond with a JSON object containing:
{
  "accountName": "The name of the account or card",
  "accountNumber": "Last 4 digits only, if visible",
  "minimumPayment": number or null,
  "currentBalance": number or null,
  "dueDate": "YYYY-MM-DD" or null,
  "dueDay": number (1-31) representing the day of month payment is due,
  "statementDate": "YYYY-MM-DD" or null,
  "interestRate": number or null (as percentage, e.g., 19.99),
  "creditLimit": number or null,
  "bankName": "Name of the financial institution",
  "accountType": "credit_card" | "line_of_credit" | "loan" | "mortgage" | "other",
  "confidence": "high" | "medium" | "low",
  "notes": "Any relevant notes about what was extracted"
}

Focus on finding the MINIMUM PAYMENT amount as this is the most important for monthly bill tracking.
If you cannot find certain information, set it to null.
Only return valid JSON, no other text.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: hint
                ? `Please extract billing information from this ${hint} statement/screenshot.`
                : 'Please extract billing information from this financial document.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content || ''

    // Parse the JSON response
    let extracted
    try {
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
      extracted = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse AI response:', content)
      return NextResponse.json(
        { error: 'Failed to parse extracted information', raw: content },
        { status: 500 }
      )
    }

    // Map to our bill format
    const suggestedBill = {
      name: extracted.accountName || extracted.bankName || 'Unknown Account',
      amount: extracted.minimumPayment || 0,
      category: mapAccountTypeToCategory(extracted.accountType),
      dueDay: extracted.dueDay || null,
      accountNumber: extracted.accountNumber || null,
      payeeName: extracted.bankName || null,
      frequency: 'MONTHLY',
      type: 'PERSONAL',
      source: 'SCREENSHOT_AI',
    }

    return NextResponse.json({
      extracted,
      suggestedBill,
      message: extracted.confidence === 'high'
        ? 'Successfully extracted bill information'
        : 'Extracted information with some uncertainty - please verify',
    })
  } catch (error: any) {
    console.error('Extract from image error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract from image' },
      { status: 500 }
    )
  }
}

function mapAccountTypeToCategory(accountType: string): string {
  switch (accountType?.toLowerCase()) {
    case 'credit_card':
      return 'CREDIT_CARD'
    case 'line_of_credit':
      return 'LINE_OF_CREDIT'
    case 'loan':
      return 'LOAN'
    case 'mortgage':
      return 'MORTGAGE'
    default:
      return 'OTHER'
  }
}
