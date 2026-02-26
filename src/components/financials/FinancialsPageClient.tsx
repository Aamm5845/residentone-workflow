'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { FinancialsOverview } from './FinancialsOverview'
import { ProjectBreakdownTable } from './ProjectBreakdownTable'
import { AuditTrail } from './AuditTrail'
import { BankReconciliation } from './BankReconciliation'
import QuickBooksExportDialog from './QuickBooksExportDialog'
import { DollarSign, FileSpreadsheet } from 'lucide-react'

interface FinancialsPageClientProps {
  isOwner: boolean
}

export default function FinancialsPageClient({ isOwner }: FinancialsPageClientProps) {
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
              <p className="text-sm text-gray-500">
                Procurement profit, tax tracking & bank reconciliation
              </p>
            </div>
          </div>
          <Button
            onClick={() => setExportOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export for QuickBooks
          </Button>
        </div>
      </div>

      <QuickBooksExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">By Project</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="reconciliation">Bank Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <FinancialsOverview />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectBreakdownTable />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTrail />
        </TabsContent>

        <TabsContent value="reconciliation">
          <BankReconciliation isOwner={isOwner} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
