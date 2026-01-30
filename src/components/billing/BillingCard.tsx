'use client'

import Link from 'next/link'
import { DollarSign, FileText, Receipt } from 'lucide-react'

interface BillingCardProps {
  projectId: string
  proposalCount?: number
  invoiceCount?: number
  unpaidAmount?: number
}

export default function BillingCard({
  projectId,
  proposalCount = 0,
  invoiceCount = 0,
  unpaidAmount = 0,
}: BillingCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Link href={`/projects/${projectId}/billing`} className="group block">
      <div className="bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 hover:border-emerald-300 rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-800 group-hover:text-emerald-900 transition-colors">
                Billing
              </h3>
              <p className="text-xs text-emerald-600 mt-1">
                Proposals & Invoices
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-4 text-xs text-emerald-700">
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>{proposalCount} proposal{proposalCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5" />
            <span>{invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Unpaid amount if any */}
        {unpaidAmount > 0 && (
          <div className="mt-3 pt-3 border-t border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600">Outstanding</span>
              <span className="text-sm font-semibold text-emerald-800">
                {formatCurrency(unpaidAmount)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
