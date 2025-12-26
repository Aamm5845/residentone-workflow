/**
 * Bank Reconciliation Service
 * Handles CSV import from NBC Canada and matches transactions with payments
 */

export interface BankTransaction {
  date: Date
  description: string
  amount: number
  reference?: string
  type: 'credit' | 'debit'
  balance?: number
  rawData: Record<string, string>
}

export interface ReconciliationMatch {
  transaction: BankTransaction
  payment: {
    id: string
    amount: number
    clientQuoteId: string
    quoteNumber: string
    method: string
    paidAt: Date | null
  } | null
  matchConfidence: 'high' | 'medium' | 'low' | 'none'
  matchReason?: string
}

/**
 * Parse NBC Canada CSV format
 * Common columns: Date, Description, Debit, Credit, Balance
 */
export function parseNBCCanadaCSV(csvContent: string): BankTransaction[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim())

  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid')
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())

  // Find column indices
  const dateIdx = findColumnIndex(headers, ['date', 'transaction date', 'posted date'])
  const descIdx = findColumnIndex(headers, ['description', 'memo', 'details', 'transaction description'])
  const debitIdx = findColumnIndex(headers, ['debit', 'withdrawal', 'amount out'])
  const creditIdx = findColumnIndex(headers, ['credit', 'deposit', 'amount in'])
  const balanceIdx = findColumnIndex(headers, ['balance', 'running balance'])
  const refIdx = findColumnIndex(headers, ['reference', 'ref', 'cheque', 'check number'])

  if (dateIdx === -1 || descIdx === -1) {
    throw new Error('CSV must contain Date and Description columns')
  }

  // Parse transactions
  const transactions: BankTransaction[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue

    const rawData: Record<string, string> = {}
    headers.forEach((header, idx) => {
      rawData[header] = values[idx] || ''
    })

    const dateStr = values[dateIdx]
    const description = values[descIdx] || ''
    const debit = debitIdx !== -1 ? parseAmount(values[debitIdx]) : 0
    const credit = creditIdx !== -1 ? parseAmount(values[creditIdx]) : 0
    const balance = balanceIdx !== -1 ? parseAmount(values[balanceIdx]) : undefined
    const reference = refIdx !== -1 ? values[refIdx] : undefined

    // Parse date (handle various formats)
    const date = parseDate(dateStr)
    if (!date) continue

    // Determine if it's a credit or debit
    const amount = credit > 0 ? credit : debit
    const type = credit > 0 ? 'credit' as const : 'debit' as const

    if (amount > 0) {
      transactions.push({
        date,
        description,
        amount,
        reference,
        type,
        balance,
        rawData
      })
    }
  }

  return transactions
}

/**
 * Parse a single CSV line (handling quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Find column index from possible header names
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const idx = headers.findIndex(h => h.includes(name))
    if (idx !== -1) return idx
  }
  return -1
}

/**
 * Parse amount string to number
 */
function parseAmount(str: string): number {
  if (!str) return 0
  // Remove currency symbols, commas, and whitespace
  const cleaned = str.replace(/[$CAD\s,]/gi, '').trim()
  // Handle parentheses as negative
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0
  }
  return parseFloat(cleaned) || 0
}

/**
 * Parse date string to Date object
 */
function parseDate(str: string): Date | null {
  if (!str) return null

  // Try common formats
  const formats = [
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // Month DD, YYYY
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/
  ]

  // Try ISO format first
  const isoMatch = str.match(formats[0])
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]))
  }

  // Try MM/DD/YYYY
  const slashMatch = str.match(formats[1])
  if (slashMatch) {
    return new Date(parseInt(slashMatch[3]), parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]))
  }

  // Try Month name format
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const monthMatch = str.match(formats[3])
  if (monthMatch) {
    const monthIdx = monthNames.findIndex(m => monthMatch[1].toLowerCase().startsWith(m))
    if (monthIdx !== -1) {
      return new Date(parseInt(monthMatch[3]), monthIdx, parseInt(monthMatch[2]))
    }
  }

  // Fallback to Date.parse
  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Match bank transactions with payments
 */
export function matchTransactionsWithPayments(
  transactions: BankTransaction[],
  payments: {
    id: string
    amount: number
    clientQuoteId: string
    quoteNumber: string
    method: string
    paidAt: Date | null
    checkNumber?: string
    wireReference?: string
  }[]
): ReconciliationMatch[] {
  const results: ReconciliationMatch[] = []
  const matchedPaymentIds = new Set<string>()

  // Only look at credit transactions (incoming payments)
  const creditTransactions = transactions.filter(t => t.type === 'credit')

  for (const transaction of creditTransactions) {
    let bestMatch: ReconciliationMatch = {
      transaction,
      payment: null,
      matchConfidence: 'none'
    }

    for (const payment of payments) {
      if (matchedPaymentIds.has(payment.id)) continue

      // Check for exact amount match
      const amountMatch = Math.abs(transaction.amount - payment.amount) < 0.01

      // Check for date proximity (within 3 days)
      const dateMatch = payment.paidAt
        ? Math.abs(transaction.date.getTime() - payment.paidAt.getTime()) < 3 * 24 * 60 * 60 * 1000
        : false

      // Check for reference match (check number, wire reference)
      const refMatch =
        (payment.checkNumber && transaction.description.includes(payment.checkNumber)) ||
        (payment.wireReference && transaction.description.includes(payment.wireReference)) ||
        (transaction.reference && payment.checkNumber === transaction.reference)

      // Check for quote number in description
      const quoteMatch = transaction.description.toLowerCase().includes(payment.quoteNumber.toLowerCase())

      // Determine confidence
      let confidence: 'high' | 'medium' | 'low' = 'low'
      let reason = ''

      if (amountMatch && (refMatch || (dateMatch && quoteMatch))) {
        confidence = 'high'
        reason = refMatch ? 'Amount and reference match' : 'Amount, date, and quote number match'
      } else if (amountMatch && dateMatch) {
        confidence = 'medium'
        reason = 'Amount and date match'
      } else if (amountMatch) {
        confidence = 'low'
        reason = 'Amount matches only'
      }

      if (confidence !== 'low' || (amountMatch && bestMatch.matchConfidence === 'none')) {
        if (
          bestMatch.matchConfidence === 'none' ||
          (confidence === 'high' && bestMatch.matchConfidence !== 'high') ||
          (confidence === 'medium' && bestMatch.matchConfidence === 'low')
        ) {
          bestMatch = {
            transaction,
            payment: {
              id: payment.id,
              amount: payment.amount,
              clientQuoteId: payment.clientQuoteId,
              quoteNumber: payment.quoteNumber,
              method: payment.method,
              paidAt: payment.paidAt
            },
            matchConfidence: confidence,
            matchReason: reason
          }
        }
      }
    }

    // Mark payment as matched if high confidence
    if (bestMatch.matchConfidence === 'high' && bestMatch.payment) {
      matchedPaymentIds.add(bestMatch.payment.id)
    }

    results.push(bestMatch)
  }

  return results
}

/**
 * Generate reconciliation summary
 */
export function generateReconciliationSummary(matches: ReconciliationMatch[]) {
  const summary = {
    totalTransactions: matches.length,
    matched: {
      high: 0,
      medium: 0,
      low: 0
    },
    unmatched: 0,
    totalCredits: 0,
    matchedAmount: 0,
    unmatchedAmount: 0
  }

  for (const match of matches) {
    summary.totalCredits += match.transaction.amount

    if (match.matchConfidence === 'none') {
      summary.unmatched++
      summary.unmatchedAmount += match.transaction.amount
    } else {
      summary.matched[match.matchConfidence]++
      summary.matchedAmount += match.transaction.amount
    }
  }

  return summary
}
