'use client'

import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlaidLinkButtonProps {
  onSuccess: (connectionInfo: {
    institutionName: string
    accounts: any[]
  }) => void
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLinkToken = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/financials/plaid/create-link-token', {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create link token')
      }
      const data = await res.json()
      setLinkToken(data.linkToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize bank connection')
    } finally {
      setLoading(false)
    }
  }

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        setLoading(true)
        const res = await fetch('/api/financials/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata?.institution?.institution_id,
            institutionName: metadata?.institution?.name,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to connect bank')
        }

        const data = await res.json()
        onSuccess({
          institutionName: data.institutionName || metadata?.institution?.name || 'Bank',
          accounts: data.accounts || [],
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect bank')
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => {
      setLinkToken(null)
    },
  })

  // If we have a link token and Plaid is ready, open it
  if (linkToken && ready) {
    // Auto-open on next render
    setTimeout(() => open(), 0)
  }

  return (
    <div>
      <Button
        onClick={fetchLinkToken}
        disabled={loading}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Building2 className="w-4 h-4 mr-2" />
        )}
        Connect Bank Account
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
