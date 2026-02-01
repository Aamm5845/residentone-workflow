import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Variable expense categories we want to track
const VARIABLE_CATEGORIES = {
  GROCERIES: ['groceries', 'supermarket', 'grocery', 'food market', 'produce', 'costco', 'walmart', 'provigo', 'iga', 'metro'],
  MEAT: ['butcher', 'meat', 'viande', 'boucherie', 'poultry', 'chicken', 'beef', 'lamb'],
  FISH: ['fish', 'poisson', 'seafood', 'salmon', 'tuna', 'fishmarket', 'poissonnerie'],
  GAS: ['gas', 'petro', 'esso', 'shell', 'fuel', 'essence', 'ultramar', 'canadian tire gas', 'costco gas', 'pioneer'],
  MEDICAL: ['pharmacy', 'doctor', 'medical', 'healthcare', 'clinic', 'hospital', 'dentist', 'optometrist', 'pharmaprix', 'jean coutu'],
  CLOTHING: ['clothing', 'apparel', 'shoes', 'fashion', 'clothes', 'footwear', 'department store'],
  CAR_SERVICE: ['car service', 'auto repair', 'mechanic', 'oil change', 'car wash', 'tire', 'auto parts'],
}

interface CategorizedExpense {
  transactionId: string
  name: string
  merchantName: string | null
  amount: number
  date: string
  category: keyof typeof VARIABLE_CATEGORIES | 'UNKNOWN'
  confidence: 'high' | 'medium' | 'low'
}

// GET - Get variable expense analysis for the last 3 months
export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    // Calculate date range for last 3 months
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    // Fetch all expense transactions from last 3 months (Plaid)
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        date: {
          gte: threeMonthsAgo,
        },
        amount: {
          gt: 0, // Expenses are positive in Plaid
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
        aiSubCategory: true,
      },
      orderBy: { date: 'desc' },
    })

    // Fetch statement transactions (non-duplicates) from last 3 months
    const statementTransactions = await prisma.statementTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        date: {
          gte: threeMonthsAgo,
        },
        isDuplicate: false, // Only include non-duplicates
        type: 'DEBIT', // Only expenses
      },
      select: {
        id: true,
        description: true,
        merchantName: true,
        amount: true,
        date: true,
        variableCategory: true,
      },
      orderBy: { date: 'desc' },
    })

    // First pass: categorize using keywords
    const categorized: CategorizedExpense[] = []
    const needsAiReview: typeof transactions = []

    for (const txn of transactions) {
      const searchText = `${txn.merchantName || ''} ${txn.name} ${txn.aiSubCategory || ''} ${(txn.category || []).join(' ')}`.toLowerCase()
      let foundCategory: keyof typeof VARIABLE_CATEGORIES | null = null
      let confidence: 'high' | 'medium' | 'low' = 'low'

      // Check each category's keywords
      for (const [cat, keywords] of Object.entries(VARIABLE_CATEGORIES)) {
        for (const keyword of keywords) {
          if (searchText.includes(keyword)) {
            foundCategory = cat as keyof typeof VARIABLE_CATEGORIES
            confidence = keywords.indexOf(keyword) < 3 ? 'high' : 'medium'
            break
          }
        }
        if (foundCategory) break
      }

      if (foundCategory) {
        categorized.push({
          transactionId: txn.transactionId,
          name: txn.name,
          merchantName: txn.merchantName,
          amount: Number(txn.amount),
          date: txn.date.toISOString(),
          category: foundCategory,
          confidence,
        })
      } else {
        // Check if it might be in our categories based on aiCategory
        const aiCat = txn.aiCategory?.toLowerCase() || ''
        if (aiCat.includes('grocer') || aiCat.includes('healthcare') || aiCat.includes('shopping')) {
          needsAiReview.push(txn)
        }
      }
    }

    // Use AI to categorize ambiguous transactions
    let unknownTransactions: CategorizedExpense[] = []

    if (needsAiReview.length > 0) {
      const aiCategorized = await categorizeWithAI(needsAiReview.slice(0, 100)) // Limit to 100

      for (const result of aiCategorized) {
        if (result.category === 'UNKNOWN') {
          unknownTransactions.push(result)
        } else {
          categorized.push(result)
        }
      }
    }

    // Add statement transactions that have a category assigned
    for (const stmtTxn of statementTransactions) {
      if (stmtTxn.variableCategory && Object.keys(VARIABLE_CATEGORIES).includes(stmtTxn.variableCategory)) {
        categorized.push({
          transactionId: `stmt_${stmtTxn.id}`,
          name: stmtTxn.description,
          merchantName: stmtTxn.merchantName,
          amount: Number(stmtTxn.amount),
          date: stmtTxn.date.toISOString(),
          category: stmtTxn.variableCategory as keyof typeof VARIABLE_CATEGORIES,
          confidence: 'medium',
        })
      } else {
        // Try to categorize statement transactions using keywords
        const searchText = `${stmtTxn.merchantName || ''} ${stmtTxn.description}`.toLowerCase()
        let foundCategory: keyof typeof VARIABLE_CATEGORIES | null = null
        let confidence: 'high' | 'medium' | 'low' = 'low'

        for (const [cat, keywords] of Object.entries(VARIABLE_CATEGORIES)) {
          for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
              foundCategory = cat as keyof typeof VARIABLE_CATEGORIES
              confidence = keywords.indexOf(keyword) < 3 ? 'high' : 'medium'
              break
            }
          }
          if (foundCategory) break
        }

        if (foundCategory) {
          categorized.push({
            transactionId: `stmt_${stmtTxn.id}`,
            name: stmtTxn.description,
            merchantName: stmtTxn.merchantName,
            amount: Number(stmtTxn.amount),
            date: stmtTxn.date.toISOString(),
            category: foundCategory,
            confidence,
          })
        }
      }
    }

    // Aggregate by category and month
    const monthlyTotals: Record<string, Record<string, number>> = {}

    for (const expense of categorized) {
      const month = expense.date.substring(0, 7) // YYYY-MM
      if (!monthlyTotals[expense.category]) {
        monthlyTotals[expense.category] = {}
      }
      if (!monthlyTotals[expense.category][month]) {
        monthlyTotals[expense.category][month] = 0
      }
      monthlyTotals[expense.category][month] += expense.amount
    }

    // Calculate 3-month averages
    const categoryAverages: Record<string, { average: number; months: Record<string, number>; transactions: number }> = {}

    for (const [category, months] of Object.entries(monthlyTotals)) {
      const monthValues = Object.values(months)
      const total = monthValues.reduce((sum, val) => sum + val, 0)
      const avgMonths = Math.max(monthValues.length, 1)

      categoryAverages[category] = {
        average: Math.round(total / avgMonths),
        months,
        transactions: categorized.filter(e => e.category === category).length,
      }
    }

    // Get month labels for the last 3 months
    const monthLabels: string[] = []
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthLabels.push(d.toISOString().substring(0, 7))
    }

    return NextResponse.json({
      categories: categoryAverages,
      unknownTransactions: unknownTransactions.slice(0, 20), // Return top 20 unknown
      monthLabels: monthLabels.reverse(),
      totalTransactionsAnalyzed: transactions.length,
      statementTransactionsIncluded: statementTransactions.length,
    })
  } catch (error: any) {
    console.error('Variable expenses analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze variable expenses' },
      { status: 500 }
    )
  }
}

// POST - User categorizes unknown transactions
export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { categorizations } = await request.json()
    // categorizations: [{ transactionId: string, category: string }]

    if (!Array.isArray(categorizations)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Store user categorizations in a mapping table or update transaction
    // For now, we'll update the aiSubCategory with user's choice
    for (const cat of categorizations) {
      await prisma.bankTransaction.updateMany({
        where: {
          transactionId: cat.transactionId,
          bankAccount: {
            plaidItem: {
              orgId: session.user.orgId,
            },
          },
        },
        data: {
          aiSubCategory: `USER_CATEGORY:${cat.category}`,
        },
      })
    }

    return NextResponse.json({ success: true, updated: categorizations.length })
  } catch (error: any) {
    console.error('Update categorization error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update categorization' },
      { status: 500 }
    )
  }
}

// AI categorization helper
async function categorizeWithAI(transactions: any[]): Promise<CategorizedExpense[]> {
  const results: CategorizedExpense[] = []

  if (transactions.length === 0) return results

  const transactionList = transactions
    .map((t, idx) => `${idx + 1}. "${t.merchantName || t.name}" - $${Math.abs(Number(t.amount)).toFixed(2)}`)
    .join('\n')

  const prompt = `Categorize these transactions into ONE of these specific categories for personal expense tracking:
- GROCERIES (general groceries, supermarkets, produce)
- MEAT (butcher shops, meat markets, poultry)
- FISH (fish stores, seafood markets)
- GAS (gas stations, fuel, petrol)
- MEDICAL (pharmacy, doctors, dental, medical supplies)
- CLOTHING (clothes, shoes, apparel stores)
- CAR_SERVICE (auto repair, oil change, car maintenance, car wash)
- UNKNOWN (if it doesn't fit any above OR if you're not sure)

Transactions:
${transactionList}

Respond with JSON array:
[{"idx": 1, "category": "GROCERIES", "confidence": "high|medium|low"}, ...]

Only use the exact category names above. Use UNKNOWN if unsure.
Respond ONLY with the JSON array.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You categorize financial transactions. Be conservative - if unsure, use UNKNOWN.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content || '[]'
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    const categorizations = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    for (const cat of categorizations) {
      const txn = transactions[cat.idx - 1]
      if (txn) {
        results.push({
          transactionId: txn.transactionId,
          name: txn.name,
          merchantName: txn.merchantName,
          amount: Number(txn.amount),
          date: txn.date.toISOString(),
          category: ['GROCERIES', 'MEAT', 'FISH', 'GAS', 'MEDICAL', 'CLOTHING', 'CAR_SERVICE'].includes(cat.category)
            ? cat.category
            : 'UNKNOWN',
          confidence: cat.confidence || 'low',
        })
      }
    }
  } catch (error) {
    console.error('AI categorization error:', error)
    // Return all as unknown on error
    for (const txn of transactions) {
      results.push({
        transactionId: txn.transactionId,
        name: txn.name,
        merchantName: txn.merchantName,
        amount: Number(txn.amount),
        date: txn.date.toISOString(),
        category: 'UNKNOWN',
        confidence: 'low',
      })
    }
  }

  return results
}
