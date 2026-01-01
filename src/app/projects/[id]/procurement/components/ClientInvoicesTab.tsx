'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Receipt,
  Send,
  DollarSign,
  Bell,
  Eye,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'

interface ClientInvoicesTabProps {
  projectId: string
  searchQuery: string
}

interface ClientInvoice {
  id: string
  invoiceNumber: string
  itemsCount: number
  totalAmount: number
  paidAmount: number
  balance: number
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID'
  sentAt: string | null
}

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  SENT: { label: 'Sent', color: 'bg-blue-50 text-blue-700' },
  PARTIAL: { label: 'Partial', color: 'bg-amber-50 text-amber-700' },
  PAID: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700' },
}

export default function ClientInvoicesTab({ projectId, searchQuery }: ClientInvoicesTabProps) {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch real client invoices from API
    setLoading(false)
    setInvoices([])
  }, [projectId])

  // Filter invoices based on search
  const filteredInvoices = invoices.filter(invoice =>
    !searchQuery ||
    invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate totals
  const totalBilled = invoices.reduce((sum, i) => sum + i.totalAmount, 0)
  const totalPaid = invoices.reduce((sum, i) => sum + i.paidAmount, 0)
  const outstanding = totalBilled - totalPaid

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Billed</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCurrency(totalBilled)}</p>
              </div>
              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Paid</p>
                <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-gray-200 ${outstanding > 0 ? 'ring-1 ring-amber-200' : ''}`}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Outstanding</p>
                <p className={`text-2xl font-semibold mt-1 ${outstanding > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {formatCurrency(outstanding)}
                </p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${outstanding > 0 ? 'bg-amber-50' : 'bg-gray-100'}`}>
                <ArrowUpRight className={`w-4 h-4 ${outstanding > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Invoices</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-gray-600">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button size="sm" className="h-8 bg-gray-900 hover:bg-gray-800 text-white">
                <Plus className="w-4 h-4 mr-1.5" />
                New Invoice
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No invoices yet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Create invoices from approved supplier quotes
              </p>
              <Button size="sm" className="h-8 bg-gray-900 hover:bg-gray-800 text-white">
                <Plus className="w-4 h-4 mr-1.5" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-500 font-medium">Invoice #</TableHead>
                  <TableHead className="text-gray-500 font-medium">Items</TableHead>
                  <TableHead className="text-gray-500 font-medium">Total</TableHead>
                  <TableHead className="text-gray-500 font-medium">Paid</TableHead>
                  <TableHead className="text-gray-500 font-medium">Balance</TableHead>
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="cursor-pointer">
                    <TableCell className="font-medium text-gray-900">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="text-gray-600">{invoice.itemsCount} items</TableCell>
                    <TableCell className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</TableCell>
                    <TableCell className="text-emerald-600">{formatCurrency(invoice.paidAmount)}</TableCell>
                    <TableCell className={invoice.balance > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                      {formatCurrency(invoice.balance)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[invoice.status].color}>
                        {statusConfig[invoice.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {invoice.status === 'DRAFT' && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700">
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        {(invoice.status === 'SENT' || invoice.status === 'PARTIAL') && (
                          <>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700">
                              <DollarSign className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700">
                              <Bell className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
