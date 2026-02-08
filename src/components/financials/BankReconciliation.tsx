'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/pricing'
import {
  parseNBCCanadaCSV,
  matchTransactionsWithPayments,
  generateReconciliationSummary,
  type BankTransaction,
  type ReconciliationMatch,
} from '@/lib/bank-reconciliation'
import { PlaidLinkButton } from './PlaidLinkButton'
import {
  Building2,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BankReconciliationProps {
  isOwner: boolean
}

interface ConnectionInfo {
  institutionName: string
  accounts: any[]
  lastSyncedAt?: string
}

export function BankReconciliation({ isOwner }: BankReconciliationProps) {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [matches, setMatches] = useState<ReconciliationMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [payments, setPayments] = useState<any[]>([])

  // Fetch connection status and transactions on mount
  useEffect(() => {
    fetchTransactions()
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/financials/audit-trail?type=PAYMENT&limit=500')
      if (res.ok) {
        const data = await res.json()
        setPayments(
          data.entries.map((e: any) => ({
            id: e.id,
            amount: e.amount,
            clientQuoteId: '',
            quoteNumber: e.documentNumber.replace('PMT-', ''),
            method: e.description.split(' ')[0],
            paidAt: e.date ? new Date(e.date) : null,
          }))
        )
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
    }
  }

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/financials/plaid/transactions')
      if (res.ok) {
        const data = await res.json()
        if (data.hasConnection) {
          setConnectionInfo({
            institutionName: data.institutionName || 'Connected Bank',
            accounts: data.accounts || [],
            lastSyncedAt: data.lastSyncedAt,
          })
          const parsed = data.transactions.map((t: any) => ({
            ...t,
            date: new Date(t.date),
          }))
          setTransactions(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    await fetchTransactions()
    setSyncing(false)
  }

  // Run matching whenever transactions or payments change
  useEffect(() => {
    if (transactions.length > 0 && payments.length > 0) {
      const results = matchTransactionsWithPayments(transactions, payments)
      setMatches(results)
    }
  }, [transactions, payments])

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      const parsed = parseNBCCanadaCSV(content)
      setTransactions(parsed)
      setConnectionInfo(null) // Clear Plaid info when using CSV
    } catch (error) {
      console.error('CSV parse error:', error)
      alert(error instanceof Error ? error.message : 'Failed to parse CSV file')
    }
  }

  const summary = matches.length > 0 ? generateReconciliationSummary(matches) : null

  const confidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-amber-500" />
      case 'low':
        return <HelpCircle className="w-4 h-4 text-blue-500" />
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const confidenceBadge = (confidence: string) => {
    const styles: Record<string, string> = {
      high: 'bg-emerald-100 text-emerald-800',
      medium: 'bg-amber-100 text-amber-800',
      low: 'bg-blue-100 text-blue-800',
      none: 'bg-gray-100 text-gray-600',
    }
    const labels: Record<string, string> = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      none: 'Unmatched',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${styles[confidence] || styles.none}`}>
        {confidenceIcon(confidence)}
        {labels[confidence] || 'Unmatched'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Connection</h3>

        {connectionInfo ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-full">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {connectionInfo.institutionName}
                </p>
                <p className="text-xs text-gray-500">
                  {connectionInfo.lastSyncedAt
                    ? `Last synced: ${new Date(connectionInfo.lastSyncedAt).toLocaleString()}`
                    : 'Connected'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleSync}
              disabled={syncing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        ) : isOwner ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Connect your bank account to automatically import transactions for reconciliation.
            </p>
            <PlaidLinkButton
              onSuccess={(info) => {
                setConnectionInfo({
                  institutionName: info.institutionName,
                  accounts: info.accounts,
                })
                fetchTransactions()
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Only the owner can connect a bank account. Use CSV upload as an alternative.
          </p>
        )}

        {/* CSV Upload Fallback */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <Upload className="w-4 h-4" />
                Upload CSV
              </span>
            </label>
            <span className="text-xs text-gray-500">
              NBC Canada CSV format supported
            </span>
          </div>
        </div>
      </div>

      {/* Reconciliation Summary */}
      {summary && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Reconciliation Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SummaryCard label="Total Transactions" value={String(summary.totalTransactions)} />
            <SummaryCard
              label="High Confidence"
              value={String(summary.matched.high)}
              color="text-emerald-600"
            />
            <SummaryCard
              label="Medium Confidence"
              value={String(summary.matched.medium)}
              color="text-amber-600"
            />
            <SummaryCard
              label="Low Confidence"
              value={String(summary.matched.low)}
              color="text-blue-600"
            />
            <SummaryCard
              label="Unmatched"
              value={String(summary.unmatched)}
              color="text-gray-500"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div>
              <span className="text-xs text-gray-500">Total Credits</span>
              <p className="text-lg font-semibold">
                {formatCurrency(summary.totalCredits)}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Matched Amount</span>
              <p className="text-lg font-semibold text-emerald-600">
                {formatCurrency(summary.matchedAmount)}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Unmatched Amount</span>
              <p className="text-lg font-semibold text-gray-500">
                {formatCurrency(summary.unmatchedAmount)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Matches Table */}
      {matches.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">
              Transaction Matches ({matches.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Matched To
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {matches.map((match, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(match.transaction.date).toLocaleDateString('en-CA')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[250px] truncate">
                      {match.transaction.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(match.transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {match.payment ? (
                        <span className="font-mono text-xs">
                          {match.payment.quoteNumber} ({formatCurrency(match.payment.amount)})
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No match</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {confidenceBadge(match.matchConfidence)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {match.matchReason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {transactions.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-500">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            No transactions to reconcile
          </p>
          <p className="text-sm">
            Connect your bank account or upload a CSV file to get started.
          </p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color = 'text-gray-900',
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}
