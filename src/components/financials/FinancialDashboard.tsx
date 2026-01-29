'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, CreditCard, Receipt, ArrowRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlaidLinkButton } from './PlaidLinkButton'
import { ConnectedBanks } from './ConnectedBanks'

interface Stats {
  bankCount: number
  accountCount: number
  transactionCount: number
  uncategorizedCount: number
}

export function FinancialDashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState<Stats>({
    bankCount: 0,
    accountCount: 0,
    transactionCount: 0,
    uncategorizedCount: 0,
  })
  const [isSyncing, setIsSyncing] = useState(false)

  const handleBankConnected = () => {
    setRefreshKey((prev) => prev + 1)
    fetchStats()
  }

  const fetchStats = async () => {
    try {
      // Fetch bank count
      const banksRes = await fetch('/api/plaid/accounts')
      const banksData = await banksRes.json()
      const banks = banksData.banks || []

      // Fetch transaction count
      const txnRes = await fetch('/api/plaid/all-transactions?limit=1')
      const txnData = await txnRes.json()

      setStats({
        bankCount: banks.length,
        accountCount: banks.reduce((sum: number, b: any) => sum + (b.accounts?.length || 0), 0),
        transactionCount: txnData.total || 0,
        uncategorizedCount: 0, // Could add this to the API
      })
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [refreshKey])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 90 }),
      })
      fetchStats()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-7 w-7 text-green-600" />
              Financials
            </h1>
            <p className="text-gray-500 mt-1">
              Connect your bank accounts to track transactions and match payments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <PlaidLinkButton onSuccess={handleBankConnected} />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Connected Banks</p>
              <p className="text-xl font-semibold">{stats.bankCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Accounts</p>
              <p className="text-xl font-semibold">{stats.accountCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Receipt className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-xl font-semibold">{stats.transactionCount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <Link
          href="/financials/transactions"
          className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-4 text-white hover:from-green-600 hover:to-emerald-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-100">View All</p>
              <p className="text-xl font-semibold">Transactions</p>
            </div>
            <ArrowRight className="h-6 w-6" />
          </div>
        </Link>
      </div>

      {/* Connected Banks Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Connected Bank Accounts</h2>
          <p className="text-sm text-gray-500">
            Click on any account to view recent transactions
          </p>
        </div>
        <ConnectedBanks key={refreshKey} />
      </div>
    </div>
  )
}
