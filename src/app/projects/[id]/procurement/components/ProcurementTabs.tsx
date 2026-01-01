'use client'

import {
  Inbox,
  FileText,
  Building2,
  Receipt,
  Package,
  Truck
} from 'lucide-react'

interface ProcurementTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
  inboxCount: number
}

const tabs = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, color: 'text-amber-500' },
  { id: 'rfqs', label: 'RFQs', icon: FileText, color: 'text-blue-500' },
  { id: 'supplier-quotes', label: 'Supplier Quotes', icon: Building2, color: 'text-purple-500' },
  { id: 'client-invoices', label: 'Client Invoices', icon: Receipt, color: 'text-emerald-500' },
  { id: 'orders', label: 'Orders', icon: Package, color: 'text-indigo-500' },
  { id: 'delivery', label: 'Delivery Tracker', icon: Truck, color: 'text-cyan-500' },
]

export default function ProcurementTabs({ activeTab, onTabChange, inboxCount }: ProcurementTabsProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* Full-width segmented control */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const showBadge = tab.id === 'inbox' && inboxCount > 0

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-150
                  ${isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${tab.color}`} />
                {tab.label}
                {showBadge && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-semibold bg-red-500 text-white rounded-full">
                    {inboxCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
