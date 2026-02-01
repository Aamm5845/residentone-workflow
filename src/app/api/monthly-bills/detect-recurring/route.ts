import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Categories we want to detect for recurring bills
const BILL_CATEGORIES = {
  CAR_LEASE: ['car lease', 'car payment', 'auto lease', 'vehicle payment', 'honda', 'toyota', 'ford', 'bmw', 'mercedes', 'audi', 'lexus', 'hyundai', 'kia', 'mazda', 'nissan', 'subaru', 'volkswagen', 'td auto', 'rbc auto', 'scotiabank auto'],
  CAR_INSURANCE: ['car insurance', 'auto insurance', 'vehicle insurance', 'intact', 'desjardins', 'belair', 'td insurance', 'aviva', 'cooperators', 'allstate', 'state farm'],
  HOME_INSURANCE: ['home insurance', 'house insurance', 'property insurance', 'tenant insurance', 'renter insurance', 'condo insurance'],
  LIFE_INSURANCE: ['life insurance', 'term life', 'whole life', 'manulife', 'sun life', 'canada life', 'industrial alliance', 'great west'],
  PHONE: ['phone', 'mobile', 'wireless', 'cellular', 'rogers', 'bell', 'telus', 'fido', 'koodo', 'virgin', 'freedom', 'chatr', 'public mobile'],
  INTERNET: ['internet', 'wifi', 'broadband', 'rogers internet', 'bell internet', 'telus internet', 'shaw', 'teksavvy'],
  UTILITIES: ['hydro', 'electricity', 'electric', 'gas', 'enbridge', 'union gas', 'hydro one', 'toronto hydro', 'alectra', 'utilities'],
  TUITION: ['tuition', 'school', 'yeshiva', 'academy', 'college', 'university', 'education'],
  TZEDAKA: ['tzedaka', 'charity', 'donation', 'chabad', 'synagogue', 'shul', 'jewish federation'],
  PROPERTY_TAX: ['property tax', 'municipal tax', 'city tax', 'real estate tax'],
  MORTGAGE: ['mortgage', 'home loan', 'house payment'],
  LINE_OF_CREDIT: ['line of credit', 'loc payment', 'heloc', 'credit line'],
  CREDIT_CARD: ['credit card payment', 'visa payment', 'mastercard payment', 'amex payment'],
  SUBSCRIPTION: ['netflix', 'spotify', 'amazon prime', 'disney', 'apple', 'google', 'microsoft', 'adobe', 'dropbox', 'youtube'],
}

interface DetectedBill {
  name: string
  merchantName: string
  amount: number
  category: string
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  lastDate: string
  occurrences: number
  confidence: 'high' | 'medium' | 'low'
  monthlyAmounts: Record<string, number>
}

// GET - Detect recurring bills from transactions
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    // Get transactions from last 4 months to detect patterns
    const fourMonthsAgo = new Date()
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        date: {
          gte: fourMonthsAgo,
        },
        amount: {
          gt: 0, // Expenses only
        },
      },
      select: {
        id: true,
        transactionId: true,
        name: true,
        merchantName: true,
        amount: true,
        date: true,
        category: true,
        aiCategory: true,
      },
      orderBy: { date: 'desc' },
    })

    // Group transactions by merchant/name to find recurring ones
    const merchantGroups: Record<string, typeof transactions> = {}

    for (const txn of transactions) {
      // Create a normalized key for grouping
      const key = normalizeTransactionName(txn.merchantName || txn.name)
      if (!merchantGroups[key]) {
        merchantGroups[key] = []
      }
      merchantGroups[key].push(txn)
    }

    // Find recurring patterns (2+ similar charges)
    const potentialBills: {
      name: string
      merchantName: string
      transactions: typeof transactions
      amounts: number[]
      dates: Date[]
    }[] = []

    for (const [key, txns] of Object.entries(merchantGroups)) {
      if (txns.length >= 2) {
        const amounts = txns.map(t => Math.abs(Number(t.amount)))
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length

        // Check if amounts are similar (within 15% - bills can vary slightly)
        const allSimilar = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.15) ||
                          // Or check if it's the same exact amount
                          new Set(amounts.map(a => a.toFixed(2))).size === 1

        if (allSimilar && avgAmount > 10) { // Minimum $10 to be considered a bill
          potentialBills.push({
            name: txns[0].name,
            merchantName: txns[0].merchantName || txns[0].name,
            transactions: txns,
            amounts,
            dates: txns.map(t => t.date).sort((a, b) => b.getTime() - a.getTime()),
          })
        }
      }
    }

    // Categorize using keywords first, then AI for unknowns
    const detectedBills: DetectedBill[] = []
    const needsAiCategorization: typeof potentialBills = []

    for (const bill of potentialBills) {
      const searchText = `${bill.merchantName} ${bill.name}`.toLowerCase()
      let foundCategory: string | null = null
      let confidence: 'high' | 'medium' | 'low' = 'medium'

      // Try to match with keywords
      for (const [category, keywords] of Object.entries(BILL_CATEGORIES)) {
        for (const keyword of keywords) {
          if (searchText.includes(keyword.toLowerCase())) {
            foundCategory = category
            confidence = 'high'
            break
          }
        }
        if (foundCategory) break
      }

      // Calculate frequency
      const frequency = calculateFrequency(bill.dates)

      // Calculate monthly amounts
      const monthlyAmounts: Record<string, number> = {}
      for (const txn of bill.transactions) {
        const month = txn.date.toISOString().substring(0, 7)
        if (!monthlyAmounts[month]) monthlyAmounts[month] = 0
        monthlyAmounts[month] += Number(txn.amount)
      }

      if (foundCategory) {
        detectedBills.push({
          name: bill.name,
          merchantName: bill.merchantName,
          amount: bill.amounts.reduce((a, b) => a + b, 0) / bill.amounts.length,
          category: foundCategory,
          frequency,
          lastDate: bill.dates[0].toISOString(),
          occurrences: bill.transactions.length,
          confidence,
          monthlyAmounts,
        })
      } else {
        needsAiCategorization.push(bill)
      }
    }

    // Use AI to categorize remaining bills
    if (needsAiCategorization.length > 0) {
      const aiCategorized = await categorizeWithAI(needsAiCategorization)
      detectedBills.push(...aiCategorized)
    }

    // Sort by category and amount
    detectedBills.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return b.amount - a.amount
    })

    // Get month labels
    const monthLabels: string[] = []
    const now = new Date()
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthLabels.push(d.toISOString().substring(0, 7))
    }

    // Group by category for summary
    const byCategory: Record<string, DetectedBill[]> = {}
    for (const bill of detectedBills) {
      if (!byCategory[bill.category]) byCategory[bill.category] = []
      byCategory[bill.category].push(bill)
    }

    return NextResponse.json({
      detectedBills,
      byCategory,
      monthLabels: monthLabels.reverse(),
      totalAnalyzed: transactions.length,
      recurringFound: detectedBills.length,
    })
  } catch (error: any) {
    console.error('Detect recurring bills error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to detect recurring bills' },
      { status: 500 }
    )
  }
}

// Normalize transaction name for grouping
function normalizeTransactionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[0-9]+/g, '') // Remove numbers
    .replace(/\s+/g, ' ')   // Normalize spaces
    .replace(/[^a-z ]/g, '') // Remove special chars
    .trim()
    .substring(0, 30) // Limit length
}

// Calculate payment frequency based on dates
function calculateFrequency(dates: Date[]): 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' {
  if (dates.length < 2) return 'MONTHLY'

  // Calculate average gap between payments in days
  let totalGap = 0
  for (let i = 0; i < dates.length - 1; i++) {
    totalGap += (dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
  }
  const avgGap = totalGap / (dates.length - 1)

  if (avgGap < 10) return 'WEEKLY'
  if (avgGap < 20) return 'BIWEEKLY'
  if (avgGap < 45) return 'MONTHLY'
  if (avgGap < 120) return 'QUARTERLY'
  return 'YEARLY'
}

// AI categorization for unknown recurring bills
async function categorizeWithAI(bills: any[]): Promise<DetectedBill[]> {
  const results: DetectedBill[] = []

  if (bills.length === 0) return results

  const billList = bills
    .map((b, idx) => `${idx + 1}. "${b.merchantName}" - $${(b.amounts.reduce((a: number, c: number) => a + c, 0) / b.amounts.length).toFixed(2)} (${b.transactions.length} charges)`)
    .join('\n')

  const categoryList = Object.keys(BILL_CATEGORIES).join(', ')

  const prompt = `Categorize these recurring bills/payments into one of these categories:
${categoryList}, OTHER

Bills:
${billList}

Respond with JSON array:
[{"idx": 1, "category": "PHONE", "confidence": "high|medium|low"}, ...]

Rules:
- Use the exact category names from the list
- Use OTHER if it doesn't fit any category or if it's not a bill (like groceries, restaurants, etc.)
- confidence: high = definitely this category, medium = likely, low = uncertain

Respond ONLY with the JSON array.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You categorize recurring financial bills and payments. Be precise with categories.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    })

    const content = response.choices[0]?.message?.content || '[]'
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    const categorizations = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    for (const cat of categorizations) {
      const bill = bills[cat.idx - 1]
      if (bill && cat.category !== 'OTHER') {
        // Calculate monthly amounts
        const monthlyAmounts: Record<string, number> = {}
        for (const txn of bill.transactions) {
          const month = txn.date.toISOString().substring(0, 7)
          if (!monthlyAmounts[month]) monthlyAmounts[month] = 0
          monthlyAmounts[month] += Number(txn.amount)
        }

        results.push({
          name: bill.name,
          merchantName: bill.merchantName,
          amount: bill.amounts.reduce((a: number, b: number) => a + b, 0) / bill.amounts.length,
          category: cat.category,
          frequency: calculateFrequency(bill.dates),
          lastDate: bill.dates[0].toISOString(),
          occurrences: bill.transactions.length,
          confidence: cat.confidence || 'medium',
          monthlyAmounts,
        })
      }
    }
  } catch (error) {
    console.error('AI categorization error:', error)
  }

  return results
}
