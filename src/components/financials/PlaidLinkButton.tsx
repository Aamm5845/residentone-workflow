'use client'

import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlaidLinkButtonProps {
  onSuccess?: () => void
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch link token when button is clicked
  const fetchLinkToken = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create link token')
      }

      setLinkToken(data.linkToken)
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  // Handle successful bank connection
  const handleSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata?.institution?.institution_id,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to connect bank account')
        }

        // Reset state
        setLinkToken(null)
        setIsLoading(false)

        // Notify parent
        onSuccess?.()
      } catch (err: any) {
        setError(err.message)
        setIsLoading(false)
      }
    },
    [onSuccess]
  )

  // Plaid Link configuration
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: () => {
      setLinkToken(null)
      setIsLoading(false)
    },
  })

  // Open Plaid Link when token is ready
  if (linkToken && ready) {
    open()
  }

  return (
    <div>
      <Button
        onClick={fetchLinkToken}
        disabled={isLoading}
        className="bg-green-600 hover:bg-green-700"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Connect Bank Account
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}
