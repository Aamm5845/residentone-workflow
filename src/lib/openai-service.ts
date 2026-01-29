import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Standard spending categories
export const SPENDING_CATEGORIES = [
  'Groceries',
  'Dining & Restaurants',
  'Transportation',
  'Gas & Fuel',
  'Shopping',
  'Entertainment',
  'Utilities',
  'Healthcare',
  'Insurance',
  'Subscriptions',
  'Travel',
  'Home & Garden',
  'Personal Care',
  'Education',
  'Business Expense',
  'Office Supplies',
  'Professional Services',
  'Bank Fees',
  'Transfer',
  'Income',
  'Refund',
  'Other',
] as const

export type SpendingCategory = typeof SPENDING_CATEGORIES[number]

interface TransactionToCategories {
  id: string
  name: string
  merchantName: string | null
  amount: number
  plaidCategories: string[]
}

interface CategorizedTransaction {
  id: string
  aiCategory: SpendingCategory
  aiSubCategory: string
  isBusinessExpense: boolean
}

export async function categorizeTransactions(
  transactions: TransactionToCategories[]
): Promise<CategorizedTransaction[]> {
  if (transactions.length === 0) return []

  // Batch transactions for efficiency (max 50 at a time)
  const batchSize = 50
  const results: CategorizedTransaction[] = []

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize)

    const transactionList = batch
      .map(
        (t, idx) =>
          `${idx + 1}. "${t.merchantName || t.name}" - $${Math.abs(t.amount).toFixed(2)} (Plaid: ${t.plaidCategories.join(', ') || 'none'})`
      )
      .join('\n')

    const prompt = `Categorize these financial transactions into the following categories:
${SPENDING_CATEGORIES.join(', ')}

For each transaction, respond with JSON in this exact format:
[
  {"idx": 1, "category": "Category Name", "subCategory": "specific type", "isBusiness": false},
  ...
]

Rules:
- Use "Income" for deposits, refunds, payments received
- Use "Transfer" for transfers between accounts
- Mark as "isBusiness": true if it looks like a business expense (office supplies, professional services, business meals)
- subCategory should be more specific (e.g., "Fast Food" for Dining, "Pharmacy" for Healthcare)

Transactions:
${transactionList}

Respond ONLY with the JSON array, no other text.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a financial transaction categorizer. Respond only with valid JSON arrays.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      })

      const content = response.choices[0]?.message?.content || '[]'
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      const categorizations = jsonMatch ? JSON.parse(jsonMatch[0]) : []

      for (const cat of categorizations) {
        const transaction = batch[cat.idx - 1]
        if (transaction) {
          results.push({
            id: transaction.id,
            aiCategory: SPENDING_CATEGORIES.includes(cat.category)
              ? cat.category
              : 'Other',
            aiSubCategory: cat.subCategory || '',
            isBusinessExpense: cat.isBusiness || false,
          })
        }
      }
    } catch (error) {
      console.error('OpenAI categorization error:', error)
      // Fallback: use Plaid categories
      for (const t of batch) {
        results.push({
          id: t.id,
          aiCategory: mapPlaidCategory(t.plaidCategories),
          aiSubCategory: t.plaidCategories[t.plaidCategories.length - 1] || '',
          isBusinessExpense: false,
        })
      }
    }
  }

  return results
}

// Fallback: map Plaid categories to our categories
function mapPlaidCategory(plaidCategories: string[]): SpendingCategory {
  const cats = plaidCategories.map((c) => c.toLowerCase())

  if (cats.some((c) => c.includes('grocery') || c.includes('supermarket')))
    return 'Groceries'
  if (cats.some((c) => c.includes('restaurant') || c.includes('food')))
    return 'Dining & Restaurants'
  if (cats.some((c) => c.includes('gas') || c.includes('fuel'))) return 'Gas & Fuel'
  if (cats.some((c) => c.includes('transport') || c.includes('uber') || c.includes('taxi')))
    return 'Transportation'
  if (cats.some((c) => c.includes('shop') || c.includes('retail'))) return 'Shopping'
  if (cats.some((c) => c.includes('entertainment') || c.includes('recreation')))
    return 'Entertainment'
  if (cats.some((c) => c.includes('utility') || c.includes('electric') || c.includes('water')))
    return 'Utilities'
  if (cats.some((c) => c.includes('health') || c.includes('medical') || c.includes('pharmacy')))
    return 'Healthcare'
  if (cats.some((c) => c.includes('insurance'))) return 'Insurance'
  if (cats.some((c) => c.includes('subscription'))) return 'Subscriptions'
  if (cats.some((c) => c.includes('travel') || c.includes('hotel') || c.includes('airline')))
    return 'Travel'
  if (cats.some((c) => c.includes('transfer'))) return 'Transfer'
  if (cats.some((c) => c.includes('income') || c.includes('deposit') || c.includes('payroll')))
    return 'Income'

  return 'Other'
}
