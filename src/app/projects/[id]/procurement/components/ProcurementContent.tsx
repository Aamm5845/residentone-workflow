'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProcurementHeader from './ProcurementHeader'
import StatusSummaryStrip from './StatusSummaryStrip'
import ProcurementTabs from './ProcurementTabs'
import InboxTab from './InboxTab'
import RFQsTab from './RFQsTab'
import SupplierQuotesTab from './SupplierQuotesTab'
import ClientInvoicesTab from './ClientInvoicesTab'
import OrdersTab from './OrdersTab'
import DeliveryTrackerTab from './DeliveryTrackerTab'

interface Project {
  id: string
  name: string
  client: {
    id: string
    name: string
    email: string | null
  } | null
}

interface Stats {
  pendingQuotes: number
  unpaidInvoices: number
  overdueOrders: number
  upcomingDeliveries: number
}

interface ProcurementContentProps {
  project: Project
  stats: Stats
  initialTab: string
}

export default function ProcurementContent({
  project,
  stats,
  initialTab
}: ProcurementContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog states
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)

  // Refresh key to trigger data refetch in tabs
  const [refreshKey, setRefreshKey] = useState(0)

  // Selected quote ID for navigation from RFQs/Inbox to Supplier Quotes
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  // Handle tab change with URL sync
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  // Calculate inbox count for badge
  const inboxCount = stats.pendingQuotes + stats.unpaidInvoices + stats.overdueOrders

  // Handle Invoice creation success
  const handleInvoiceSuccess = useCallback(() => {
    setShowCreateInvoice(false)
    setRefreshKey(prev => prev + 1)
    handleTabChange('client-invoices')
  }, [])

  // Navigate to a specific quote in Supplier Quotes tab
  const handleViewQuote = useCallback((quoteId: string) => {
    setSelectedQuoteId(quoteId)
    handleTabChange('supplier-quotes')
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <ProcurementHeader
        project={project}
        onSearch={handleSearch}
        onNewInvoice={() => setShowCreateInvoice(true)}
      />

      {/* Status Summary Strip */}
      <StatusSummaryStrip
        stats={stats}
        onIndicatorClick={handleTabChange}
      />

      {/* Tab Navigation */}
      <ProcurementTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        inboxCount={inboxCount}
      />

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'inbox' && (
          <InboxTab
            projectId={project.id}
            searchQuery={searchQuery}
            onNavigateToQuote={handleViewQuote}
          />
        )}
        {activeTab === 'rfqs' && (
          <RFQsTab
            projectId={project.id}
            searchQuery={searchQuery}
            refreshKey={refreshKey}
            onViewQuote={handleViewQuote}
          />
        )}
        {activeTab === 'supplier-quotes' && (
          <SupplierQuotesTab
            projectId={project.id}
            searchQuery={searchQuery}
            highlightQuoteId={selectedQuoteId}
            onQuoteViewed={() => setSelectedQuoteId(null)}
          />
        )}
        {activeTab === 'client-invoices' && (
          <ClientInvoicesTab projectId={project.id} searchQuery={searchQuery} />
        )}
        {activeTab === 'orders' && (
          <OrdersTab projectId={project.id} searchQuery={searchQuery} />
        )}
        {activeTab === 'delivery' && (
          <DeliveryTrackerTab projectId={project.id} searchQuery={searchQuery} />
        )}
      </div>
    </div>
  )
}
