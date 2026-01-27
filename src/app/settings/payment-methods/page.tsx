'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import SavedPaymentMethods from '@/components/settings/saved-payment-methods'

export default function PaymentMethodsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                ← Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Payment Methods</h1>
              <p className="text-sm text-gray-500">Manage saved credit cards for supplier payments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <SavedPaymentMethods />
      </div>
    </div>
  )
}
