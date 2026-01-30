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

// Analyze financial insights using AI
interface FinancialSummary {
  totalIncome: number
  totalExpenses: number
  topCategories: { category: string; amount: number }[]
  recurringCharges: { name: string; amount: number; frequency: string }[]
  upcomingBills: { name: string; amount: number; dueDate: string }[]
}

interface FinancialInsight {
  type: 'warning' | 'tip' | 'alert' | 'success'
  title: string
  description: string
  action?: string
  priority: number // 1 = urgent, 5 = informational
}

export async function generateFinancialInsights(
  summary: FinancialSummary
): Promise<FinancialInsight[]> {
  const prompt = `Analyze this financial summary and provide actionable insights for someone with ADHD who needs clear, simple advice.

Financial Summary:
- Total Income (last month): $${summary.totalIncome.toFixed(2)}
- Total Expenses (last month): $${summary.totalExpenses.toFixed(2)}
- Net: $${(summary.totalIncome - summary.totalExpenses).toFixed(2)}

Top Spending Categories:
${summary.topCategories.map(c => `- ${c.category}: $${c.amount.toFixed(2)}`).join('\n')}

Recurring/Subscription Charges Detected:
${summary.recurringCharges.map(r => `- ${r.name}: $${r.amount.toFixed(2)} (${r.frequency})`).join('\n') || 'None detected'}

Upcoming Bills:
${summary.upcomingBills.map(b => `- ${b.name}: $${b.amount.toFixed(2)} due ${b.dueDate}`).join('\n') || 'None detected'}

Provide 3-5 actionable insights in this JSON format:
[
  {
    "type": "warning|tip|alert|success",
    "title": "Short headline (max 6 words)",
    "description": "Clear explanation (1-2 sentences)",
    "action": "Specific action to take (optional)",
    "priority": 1-5
  }
]

Focus on:
1. Spending patterns that need attention
2. Subscriptions that might be forgotten or unused
3. Bills that are due soon
4. Simple ways to save money
5. Positive habits if any

Be direct and ADHD-friendly - no fluff, just actionable advice.
Respond ONLY with the JSON array.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a friendly financial advisor who gives simple, actionable advice. Always respond with valid JSON arrays.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content || '[]'
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch (error) {
    console.error('OpenAI insights error:', error)
    return []
  }
}

// Detect recurring subscriptions from transactions
interface TransactionForSubscription {
  merchantName: string | null
  name: string
  amount: number
  date: Date
}

export interface DetectedSubscription {
  name: string
  amount: number
  frequency: 'weekly' | 'monthly' | 'yearly'
  lastCharge: Date
  nextExpected: Date
  category: string
  isEssential: boolean
  cancelSuggestion?: string
}

export async function detectSubscriptions(
  transactions: TransactionForSubscription[]
): Promise<DetectedSubscription[]> {
  // Group transactions by merchant
  const merchantGroups: Record<string, TransactionForSubscription[]> = {}

  for (const txn of transactions) {
    const key = (txn.merchantName || txn.name).toLowerCase().trim()
    if (!merchantGroups[key]) merchantGroups[key] = []
    merchantGroups[key].push(txn)
  }

  // Find recurring patterns (3+ similar charges)
  const potentialSubscriptions: { name: string; amounts: number[]; dates: Date[] }[] = []

  for (const [name, txns] of Object.entries(merchantGroups)) {
    if (txns.length >= 2) {
      // Check if amounts are similar (within 10%)
      const amounts = txns.map(t => Math.abs(t.amount))
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
      const allSimilar = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.1)

      if (allSimilar) {
        potentialSubscriptions.push({
          name: txns[0].merchantName || txns[0].name,
          amounts,
          dates: txns.map(t => t.date).sort((a, b) => b.getTime() - a.getTime()),
        })
      }
    }
  }

  if (potentialSubscriptions.length === 0) return []

  // Use AI to categorize and provide cancellation suggestions
  const subList = potentialSubscriptions
    .map((s, i) => `${i + 1}. "${s.name}" - $${(s.amounts.reduce((a, b) => a + b, 0) / s.amounts.length).toFixed(2)} avg, ${s.dates.length} charges`)
    .join('\n')

  const prompt = `Analyze these potential subscriptions and categorize them:

${subList}

For each, respond with JSON:
[
  {
    "idx": 1,
    "category": "Entertainment|Productivity|Utilities|Fitness|News|Storage|Music|Video|Gaming|Software|Other",
    "isEssential": true/false,
    "frequency": "weekly|monthly|yearly",
    "cancelSuggestion": "If not essential, a brief reason why they might cancel (or null if essential)"
  }
]

Respond ONLY with the JSON array.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a subscription analyst. Identify subscription services and suggest which might be unnecessary.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    })

    const content = response.choices[0]?.message?.content || '[]'
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return potentialSubscriptions.map((sub, idx) => {
      const ai = analysis.find((a: any) => a.idx === idx + 1) || {}
      const avgAmount = sub.amounts.reduce((a, b) => a + b, 0) / sub.amounts.length
      const lastDate = sub.dates[0]

      // Calculate frequency based on date gaps
      let frequency: 'weekly' | 'monthly' | 'yearly' = 'monthly'
      if (sub.dates.length >= 2) {
        const gap = (sub.dates[0].getTime() - sub.dates[sub.dates.length - 1].getTime()) / (1000 * 60 * 60 * 24 * (sub.dates.length - 1))
        if (gap < 10) frequency = 'weekly'
        else if (gap > 300) frequency = 'yearly'
      }

      // Calculate next expected date
      const nextExpected = new Date(lastDate)
      if (frequency === 'weekly') nextExpected.setDate(nextExpected.getDate() + 7)
      else if (frequency === 'monthly') nextExpected.setMonth(nextExpected.getMonth() + 1)
      else nextExpected.setFullYear(nextExpected.getFullYear() + 1)

      return {
        name: sub.name,
        amount: avgAmount,
        frequency: ai.frequency || frequency,
        lastCharge: lastDate,
        nextExpected,
        category: ai.category || 'Other',
        isEssential: ai.isEssential ?? false,
        cancelSuggestion: ai.cancelSuggestion || undefined,
      }
    })
  } catch (error) {
    console.error('OpenAI subscription detection error:', error)
    return potentialSubscriptions.map((sub) => ({
      name: sub.name,
      amount: sub.amounts.reduce((a, b) => a + b, 0) / sub.amounts.length,
      frequency: 'monthly' as const,
      lastCharge: sub.dates[0],
      nextExpected: new Date(sub.dates[0].setMonth(sub.dates[0].getMonth() + 1)),
      category: 'Other',
      isEssential: false,
    }))
  }
}

// Generate debt payoff plan
interface DebtAccount {
  name: string
  balance: number
  interestRate?: number
  minimumPayment?: number
}

export interface DebtPayoffPlan {
  strategy: 'avalanche' | 'snowball'
  totalDebt: number
  monthlyPayment: number
  payoffMonths: number
  accounts: {
    name: string
    balance: number
    order: number
    payoffMonth: number
  }[]
  tips: string[]
}

export async function generateDebtPayoffPlan(
  debts: DebtAccount[],
  monthlyBudget: number
): Promise<DebtPayoffPlan> {
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0)

  const prompt = `Create a debt payoff plan for someone with ADHD who needs clear, simple steps.

Debts:
${debts.map(d => `- ${d.name}: $${d.balance.toFixed(2)}${d.interestRate ? ` (${d.interestRate}% APR)` : ''}${d.minimumPayment ? ` (min: $${d.minimumPayment})` : ''}`).join('\n')}

Total Debt: $${totalDebt.toFixed(2)}
Monthly Budget for Debt: $${monthlyBudget.toFixed(2)}

Respond with JSON:
{
  "strategy": "avalanche or snowball",
  "strategyReason": "1 sentence why this strategy",
  "monthlyPayment": recommended monthly payment,
  "payoffMonths": estimated months to pay off,
  "payoffOrder": ["debt name in order of priority"],
  "tips": ["3-4 simple, ADHD-friendly tips for staying on track"]
}

Respond ONLY with the JSON object.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a debt counselor who gives simple, actionable advice for paying off debt.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    })

    const content = response.choices[0]?.message?.content || '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    return {
      strategy: plan.strategy || 'snowball',
      totalDebt,
      monthlyPayment: plan.monthlyPayment || monthlyBudget,
      payoffMonths: plan.payoffMonths || Math.ceil(totalDebt / monthlyBudget),
      accounts: debts.map((d, i) => ({
        name: d.name,
        balance: d.balance,
        order: (plan.payoffOrder || []).indexOf(d.name) + 1 || i + 1,
        payoffMonth: Math.ceil(d.balance / (monthlyBudget / debts.length)),
      })).sort((a, b) => a.order - b.order),
      tips: plan.tips || [
        'Set up automatic payments to never miss a due date',
        'Celebrate small wins when you pay off each debt',
        'Keep one credit card for emergencies only',
      ],
    }
  } catch (error) {
    console.error('OpenAI debt plan error:', error)
    return {
      strategy: 'snowball',
      totalDebt,
      monthlyPayment: monthlyBudget,
      payoffMonths: Math.ceil(totalDebt / monthlyBudget),
      accounts: debts.map((d, i) => ({
        name: d.name,
        balance: d.balance,
        order: i + 1,
        payoffMonth: Math.ceil(d.balance / (monthlyBudget / debts.length)),
      })),
      tips: [
        'Set up automatic payments to never miss a due date',
        'Celebrate small wins when you pay off each debt',
      ],
    }
  }
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
