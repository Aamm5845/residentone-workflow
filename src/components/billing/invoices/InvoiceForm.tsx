'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Send, Loader2, Plus, Trash2, Calculator, User, Clock, DollarSign, CreditCard, Building2, Banknote, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  // Billing information
  billingName?: string | null
  billingEmail?: string | null
  billingAddress?: string | null
  billingCity?: string | null
  billingProvince?: string | null
  billingPostalCode?: string | null
  billingCountry?: string | null
}

interface LineItem {
  id?: string
  type: 'FIXED' | 'HOURLY' | 'MILESTONE' | 'DEPOSIT' | 'ADJUSTMENT'
  description: string
  quantity: number
  unitPrice: number
  hours?: number
  hourlyRate?: number
  milestoneTitle?: string
  milestonePercent?: number
  amount: number
  order: number
}

interface PaymentScheduleItem {
  title: string
  amount: number
  percent?: number
  dueOn: 'signing' | 'milestone' | 'completion' | 'custom'
  description?: string
}

interface FromProposal {
  id: string
  number: string
  title: string
  billingType: 'FIXED' | 'HOURLY' | 'HYBRID'
  clientName: string
  clientEmail: string
  clientPhone: string | null
  clientAddress: string | null
  subtotal: number
  totalAmount: number
  gstRate?: number
  qstRate?: number
  hourlyRate?: number
  depositAmount?: number
  ccFeePercent?: number
  paymentSchedule?: PaymentScheduleItem[]
}

interface InvoiceFormProps {
  projectId: string
  projectName: string
  client: Client
  defaultGstRate?: number
  defaultQstRate?: number
  fromProposal?: FromProposal
  existingInvoice?: any
}

export default function InvoiceForm({
  projectId,
  projectName,
  client,
  defaultGstRate = 5,
  defaultQstRate = 9.975,
  fromProposal,
  existingInvoice,
}: InvoiceFormProps) {
  const router = useRouter()
  const isEditing = !!existingInvoice

  // Form state
  const [title, setTitle] = useState(
    existingInvoice?.title || fromProposal?.title || `${projectName} - Services`
  )
  const [description, setDescription] = useState(existingInvoice?.description || '')

  // Check if billing info is available
  const hasBillingInfo = !!(client.billingName || client.billingEmail || client.billingAddress)

  // Build full billing address from components
  const buildBillingAddress = () => {
    const parts = [
      client.billingAddress,
      client.billingCity,
      client.billingProvince,
      client.billingPostalCode,
      client.billingCountry
    ].filter(Boolean)
    return parts.join(', ')
  }

  // State to select billing info vs client info
  const [useBillingInfo, setUseBillingInfo] = useState(
    existingInvoice?.useBillingInfo ?? false
  )

  // Client info comes from client record or billing info based on selection
  const clientName = useBillingInfo && client.billingName
    ? client.billingName
    : (fromProposal?.clientName || client.name)
  const clientEmail = useBillingInfo && client.billingEmail
    ? client.billingEmail
    : (fromProposal?.clientEmail || client.email)
  const clientPhone = fromProposal?.clientPhone || client.phone || ''
  const clientAddress = useBillingInfo && client.billingAddress
    ? buildBillingAddress()
    : (fromProposal?.clientAddress || '')

  // Create initial line items - start clean so user can pick from presets
  const getInitialLineItems = (): LineItem[] => {
    if (existingInvoice?.lineItems) {
      return existingInvoice.lineItems
    }

    // Start with empty item - user picks from presets
    return [{ type: 'FIXED', description: '', quantity: 1, unitPrice: 0, amount: 0, order: 0 }]
  }

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>(getInitialLineItems)

  // Pricing - GST/QST always apply at default rates
  const gstRate = existingInvoice?.gstRate ?? fromProposal?.gstRate ?? defaultGstRate
  const qstRate = existingInvoice?.qstRate ?? fromProposal?.qstRate ?? defaultQstRate

  // CC Fee - always 3% (or from proposal)
  const ccFeePercent = existingInvoice?.ccFeePercent ?? fromProposal?.ccFeePercent ?? 3

  // Dates - default to today (due upon receipt)
  const [dueDate, setDueDate] = useState(
    existingInvoice?.dueDate
      ? new Date(existingInvoice.dueDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0] // Due today (upon receipt)
  )

  // Notes
  const [notes, setNotes] = useState(existingInvoice?.notes || '')

  // Payment method options
  const [allowCreditCard, setAllowCreditCard] = useState(existingInvoice?.allowCreditCard ?? true)
  const [allowBankTransfer, setAllowBankTransfer] = useState(existingInvoice?.allowBankTransfer ?? true)
  const [allowEtransfer, setAllowEtransfer] = useState(existingInvoice?.allowEtransfer ?? true)
  const [allowCheck, setAllowCheck] = useState(existingInvoice?.allowCheck ?? true)

  // Selected milestone for quick-create
  const [selectedMilestone, setSelectedMilestone] = useState<string>('')

  // UI state
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const gstAmount = subtotal * (gstRate / 100)
  const qstAmount = subtotal * (qstRate / 100)
  const totalAmount = subtotal + gstAmount + qstAmount
  const ccFeeAmount = totalAmount * (ccFeePercent / 100)
  const totalWithCC = totalAmount + ccFeeAmount

  // Update line item
  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...lineItems]
    const item = { ...newItems[index] }

    if (field === 'quantity' || field === 'unitPrice' || field === 'hours' || field === 'hourlyRate') {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value
      item[field] = numValue

      // Recalculate amount
      if (item.type === 'HOURLY') {
        item.amount = (item.hours || 0) * (item.hourlyRate || 0)
      } else {
        item.amount = item.quantity * item.unitPrice
      }
    } else {
      (item as any)[field] = value
    }

    newItems[index] = item
    setLineItems(newItems)
  }

  const addLineItem = (type: 'FIXED' | 'HOURLY' = 'FIXED') => {
    const hourlyRate = fromProposal?.hourlyRate || 200
    const newItem: LineItem = type === 'HOURLY'
      ? { type: 'HOURLY', description: 'Additional Hours', quantity: 1, unitPrice: hourlyRate, hours: 0, hourlyRate, amount: 0, order: lineItems.length }
      : { type: 'FIXED', description: '', quantity: 1, unitPrice: 0, amount: 0, order: lineItems.length }
    setLineItems([...lineItems, newItem])
  }

  const addMilestoneItem = (milestone: PaymentScheduleItem) => {
    setLineItems([
      ...lineItems,
      {
        type: milestone.dueOn === 'signing' ? 'DEPOSIT' : 'MILESTONE',
        description: milestone.title,
        quantity: 1,
        unitPrice: milestone.amount,
        milestoneTitle: milestone.title,
        milestonePercent: milestone.percent || undefined,
        amount: milestone.amount,
        order: lineItems.length,
      }
    ])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index))
    }
  }

  // Clear all and start fresh
  const clearItems = () => {
    setLineItems([{ type: 'FIXED', description: '', quantity: 1, unitPrice: 0, amount: 0, order: 0 }])
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  // Save invoice
  const handleSave = async (andSend = false) => {
    if (!title) {
      alert('Please enter a title')
      return
    }

    if (lineItems.filter(i => i.description && i.amount > 0).length === 0) {
      alert('Please add at least one line item with an amount')
      return
    }

    if (andSend) {
      setSending(true)
    } else {
      setSaving(true)
    }

    try {
      const invoiceData = {
        projectId,
        proposalId: fromProposal?.id,
        title,
        description: description || null,
        type: 'STANDARD', // Always standard - type is determined by line items
        clientName,
        clientEmail,
        clientPhone: clientPhone || null,
        clientAddress: clientAddress || null,
        lineItems: lineItems.filter(i => i.description && i.amount > 0).map((item, index) => ({
          ...item,
          order: index,
        })),
        subtotal,
        gstRate,
        qstRate,
        totalAmount,
        dueDate,
        notes: notes || null,
        termsAndConditions: 'Payment is due within 7 days of invoice date.',
        allowCreditCard,
        allowBankTransfer,
        allowEtransfer,
        allowCheck,
        ccFeePercent,
      }

      let invoiceId = existingInvoice?.id

      if (isEditing) {
        const response = await fetch(`/api/billing/invoices/${existingInvoice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update invoice')
        }
      } else {
        const response = await fetch('/api/billing/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceData),
        })

        if (!response.ok) {
          const error = await response.json()
          if (error.details) {
            const details = error.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join('\n')
            throw new Error(`Validation failed:\n${details}`)
          }
          throw new Error(error.error || 'Failed to create invoice')
        }

        const newInvoice = await response.json()
        invoiceId = newInvoice.id
      }

      // If sending, show preview first (save as draft, then redirect to preview)
      if (andSend && invoiceId) {
        // Redirect to preview page instead of directly sending
        router.push(`/projects/${projectId}/billing/invoices/${invoiceId}/preview`)
        return
      }

      router.push(`/projects/${projectId}/billing`)
      router.refresh()
    } catch (err: any) {
      console.error('Error saving invoice:', err)
      alert(err.message || 'Failed to save invoice')
    } finally {
      setSaving(false)
      setSending(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/projects/${projectId}/billing`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Edit Invoice' : 'New Invoice'}
                </h1>
                <p className="text-sm text-gray-500">{projectName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || sending}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Draft
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSave(true)} disabled={saving || sending}>
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Save & Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Presets from Payment Agreement */}
        {fromProposal && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-emerald-800">
                Payment Agreement Presets
              </h3>
              <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                From {fromProposal.number}
              </span>
            </div>
            <p className="text-sm text-emerald-700 mb-4">
              Click to add items from the signed proposal. Just enter quantity/hours after adding.
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Payment Schedule Milestones */}
              {fromProposal.paymentSchedule && fromProposal.paymentSchedule.map((milestone, index) => (
                <Button
                  key={`milestone-${index}`}
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                  onClick={() => addMilestoneItem(milestone)}
                >
                  <DollarSign className="w-3 h-3 mr-1" />
                  {milestone.title} ({formatCurrency(milestone.amount)})
                </Button>
              ))}
              {/* Hourly Rate Preset */}
              {(fromProposal.billingType === 'HOURLY' || fromProposal.billingType === 'HYBRID' || fromProposal.hourlyRate) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-300 bg-white text-blue-700 hover:bg-blue-100"
                  onClick={() => addLineItem('HOURLY')}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Design Hours @ {formatCurrency(fromProposal.hourlyRate || 200)}/hr
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl border p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Design Services - Deposit"
                    className="text-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">Line Items</label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearItems}>
                    Clear All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addLineItem('FIXED')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </Button>
                  {(fromProposal?.billingType === 'HOURLY' || fromProposal?.billingType === 'HYBRID' || fromProposal?.hourlyRate) && (
                    <Button variant="outline" size="sm" onClick={() => addLineItem('HOURLY')}>
                      <Clock className="w-4 h-4 mr-1" />
                      Add Hours
                    </Button>
                  )}
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b">
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-right py-2 font-medium w-20">Qty/Hrs</th>
                    <th className="text-right py-2 font-medium w-28">Price/Rate</th>
                    <th className="text-right py-2 font-medium w-28">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          {item.type === 'HOURLY' && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Hourly</span>
                          )}
                          {item.type === 'DEPOSIT' && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">Deposit</span>
                          )}
                          {item.type === 'MILESTONE' && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Milestone</span>
                          )}
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            placeholder="Item description"
                            className="flex-1"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          value={item.type === 'HOURLY' ? item.hours || 0 : item.quantity}
                          onChange={(e) => updateLineItem(index, item.type === 'HOURLY' ? 'hours' : 'quantity', e.target.value)}
                          className="text-right"
                          min="0"
                          step={item.type === 'HOURLY' ? '0.5' : '1'}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          value={item.type === 'HOURLY' ? item.hourlyRate || 0 : item.unitPrice}
                          onChange={(e) => updateLineItem(index, item.type === 'HOURLY' ? 'hourlyRate' : 'unitPrice', e.target.value)}
                          className="text-right"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="py-2 pl-1 text-right font-medium">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-2 pl-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          className="text-gray-400 hover:text-red-500"
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (shown to client)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full h-20 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Methods
              </h3>
              <p className="text-sm text-gray-500 mb-4">Select which payment methods are available for this invoice</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Credit Card</p>
                      <p className="text-xs text-gray-500">+{ccFeePercent}% processing fee</p>
                    </div>
                  </div>
                  <Switch
                    checked={allowCreditCard}
                    onCheckedChange={setAllowCreditCard}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Bank Transfer / Wire</p>
                      <p className="text-xs text-gray-500">Direct deposit or wire transfer</p>
                    </div>
                  </div>
                  <Switch
                    checked={allowBankTransfer}
                    onCheckedChange={setAllowBankTransfer}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Banknote className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Interac e-Transfer</p>
                      <p className="text-xs text-gray-500">Canadian electronic transfer</p>
                    </div>
                  </div>
                  <Switch
                    checked={allowEtransfer}
                    onCheckedChange={setAllowEtransfer}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Check</p>
                      <p className="text-xs text-gray-500">Mail a check</p>
                    </div>
                  </div>
                  <Switch
                    checked={allowCheck}
                    onCheckedChange={setAllowCheck}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Client Info - Read Only */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                Bill To
              </h3>

              {/* Option to use billing info */}
              {hasBillingInfo && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Use Billing Info</p>
                      <p className="text-xs text-blue-600">Use saved billing contact instead of client</p>
                    </div>
                    <Switch
                      checked={useBillingInfo}
                      onCheckedChange={setUseBillingInfo}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">{clientName}</p>
                  <p className="text-gray-600">{clientEmail}</p>
                  {clientPhone && <p className="text-gray-500">{clientPhone}</p>}
                  {clientAddress && <p className="text-gray-500 mt-1">{clientAddress}</p>}
                </div>

                {/* Show what billing info looks like if not selected */}
                {hasBillingInfo && !useBillingInfo && (
                  <div className="text-xs text-gray-500 mt-2">
                    Billing contact available: {client.billingName || client.billingEmail}
                  </div>
                )}
              </div>
            </div>

            {/* Summary - All values shown */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST ({gstRate}%)</span>
                  <span>{formatCurrency(gstAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">QST ({qstRate}%)</span>
                  <span>{formatCurrency(qstAmount)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-emerald-600">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>

                {/* CC Fee Info */}
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-gray-500 mb-2">If paying by credit card:</p>
                  <div className="flex justify-between text-gray-600">
                    <span>CC Fee ({ccFeePercent}%)</span>
                    <span>+{formatCurrency(ccFeeAmount)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-gray-900 mt-1">
                    <span>Total with CC</span>
                    <span>{formatCurrency(totalWithCC)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
